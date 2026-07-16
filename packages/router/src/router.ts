/**
 * @nextrush/router - Router Implementation
 *
 * High-performance router using a segment trie for route matching.
 * Routes are keyed by full path segments (e.g. "users", ":id"), not by
 * individual characters — this is a segment-based trie, not a compressed
 * segment trie. Supports parameters, wildcards, and method-based routing.
 *
 * @packageDocumentation
 */

import {
    HTTP_METHODS,
    type Context,
    type HttpMethod,
    type Middleware,
    type RouteDefinition,
    type RouteEntry,
    type RouteHandler,
    type RouteMatch,
    type RouterOptions,
} from '@nextrush/types';
import {
    createNode,
    NOOP_NEXT,
    type HandlerEntry,
    type TrieNode,
} from './segment-trie';
import { type RedirectStatus } from './redirect';
import { GroupRouter, type RouteGroup } from './group-router';
import { findAllowedMethods } from './matching';
import { matchRoute } from './match-route';
import { copyRoutes } from './composition';
import { sealRouterMiddleware as sealRouterMiddlewareImpl } from './middleware-adapter';
import { addRoute as addRouteImpl, registerRedirect } from './registration';

/**
 * Inline route metadata declaration — re-exported from its own module (RT-3).
 */
export { endpoint } from './route-metadata';

/**
 * Router class — high-performance segment trie router.
 *
 * Routes are indexed by path segment, giving O(d) lookup where d is the
 * number of segments. Static routes are additionally stored in a hash map
 * for O(1) fast-path lookup.
 *
 * @see {@link https://github.com/0xTanzim/nextRush/blob/main/packages/router/README.md | @nextrush/router README} for the full mental model and usage examples.
 */
export class Router {
  private readonly root: TrieNode;
  private readonly opts: Required<RouterOptions>;
  private readonly routerMiddleware: Middleware[] = [];

  /**
   * Static route hash map for O(1) lookup.
   * Key: "METHOD path" (e.g. "GET /users"), Value: HandlerEntry
   */
  private readonly staticRoutes = new Map<string, HandlerEntry>();

  /**
   * Introspection registry: every registered route as a RouteDefinition.
   * Kept SEPARATE from the hot-path structures (segment trie + staticRoutes) so
   * request dispatch never reads metadata — only getRoutes() (at doc-generation
   * time) touches this.
   */
  private readonly routeDefinitions: RouteDefinition[] = [];

  /** Whether any routes have params or wildcards (disables static-only fast path) */
  private hasParamRoutes = false;

  /** Whether router-level middleware has already been sealed into executors (audit RT-7) */
  private _sealed = false;

  constructor(options: RouterOptions = {}) {
    this.root = createNode('');
    this.opts = {
      prefix: options.prefix ?? '',
      caseSensitive: options.caseSensitive ?? false,
      strict: options.strict ?? false,
      decode: options.decode ?? true,
    };
  }

  /**
   * Normalize path based on router options
   */
  private normalizePath(path: string): string {
    // Handle prefix with trailing slash and path with leading slash
    let prefix = this.opts.prefix;
    if (prefix.endsWith('/') && path.startsWith('/')) {
      prefix = prefix.slice(0, -1);
    }

    let normalized = prefix + path;

    // Fast-path: skip regex when no double slashes (99%+ of requests)
    if (normalized.includes('//')) {
      normalized = normalized.replace(/\/+/g, '/');
    }

    // For non-strict mode during registration, remove trailing slash
    if (!this.opts.strict && normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    return normalized.startsWith('/') ? normalized : '/' + normalized;
  }

  /**
   * Add a route to the segment trie. Validates the raw path and normalizes it
   * (both `Router`-specific concerns — `normalizePath` only touches `opts`),
   * then delegates the actual trie insertion to the extracted `addRoute`
   * (design.md D2 — `addRoute`'s internals extracted since it was 116 lines,
   * the highest-complexity function in the file). The extracted function
   * returns whether the route had a param/wildcard segment since a primitive
   * boolean can't be mutated back through a passed struct field.
   */
  private addRoute(
    method: HttpMethod,
    path: string,
    entries: RouteEntry[],
    middleware: Middleware[] = []
  ): void {
    // Runtime guard for untyped JS callers — without this, a non-string path is
    // silently coerced (`'' + null` → 'null') into a bogus literal route.
    const rawPath: unknown = path;
    if (typeof rawPath !== 'string') {
      throw new TypeError(
        `Route path must be a string, received ${rawPath === null ? 'null' : typeof rawPath}.`
      );
    }
    const normalized = this.normalizePath(path);

    const hasParams = addRouteImpl(method, normalized, entries, middleware, {
      root: this.root,
      caseSensitive: this.opts.caseSensitive,
      staticRoutes: this.staticRoutes,
      routeDefinitions: this.routeDefinitions,
    });
    if (hasParams) this.hasParamRoutes = true;
  }

  // ===========================================================================
  // HTTP Method Shortcuts
  // ===========================================================================

  get(path: string, ...entries: RouteEntry[]): this {
    this.addRoute('GET', path, entries);
    return this;
  }

  post(path: string, ...entries: RouteEntry[]): this {
    this.addRoute('POST', path, entries);
    return this;
  }

  put(path: string, ...entries: RouteEntry[]): this {
    this.addRoute('PUT', path, entries);
    return this;
  }

  delete(path: string, ...entries: RouteEntry[]): this {
    this.addRoute('DELETE', path, entries);
    return this;
  }

  patch(path: string, ...entries: RouteEntry[]): this {
    this.addRoute('PATCH', path, entries);
    return this;
  }

  head(path: string, ...entries: RouteEntry[]): this {
    this.addRoute('HEAD', path, entries);
    return this;
  }

  options(path: string, ...entries: RouteEntry[]): this {
    this.addRoute('OPTIONS', path, entries);
    return this;
  }

  all(path: string, ...entries: RouteEntry[]): this {
    for (const method of HTTP_METHODS) {
      this.addRoute(method, path, entries);
    }
    return this;
  }

  route(method: HttpMethod, path: string, ...entries: RouteEntry[]): this {
    this.addRoute(method, path, entries);
    return this;
  }

  /**
   * Return every registered route as a read-only list of RouteDefinitions.
   *
   * Consumed by renderers (`@nextrush/openapi`, and future SDK/Postman/RPC
   * generators). This is a doc-generation-time projection of the introspection
   * registry — the request hot path never calls it.
   */
  getRoutes(): readonly RouteDefinition[] {
    return this.routeDefinitions;
  }

  /**
   * Register a redirect route from one path to another.
   *
   * @param from - Source path to redirect from
   * @param to - Target path or URL to redirect to
   * @param status - HTTP status code (default: 301 permanent redirect)
   * @returns this for chaining
   * @see {@link https://github.com/0xTanzim/nextRush/blob/main/packages/router/README.md#redirects | README: Redirects} for usage examples
   */
  redirect(from: string, to: string, status: RedirectStatus = 301): this {
    registerRedirect(from, to, status, (method, path, entries) =>
      this.addRoute(method, path, entries)
    );
    return this;
  }

  // ===========================================================================
  // Router Composition
  // ===========================================================================

  use(pathOrMiddleware: string | Middleware | Router, routerOrUndefined?: Router): this {
    if (typeof pathOrMiddleware === 'function') {
      // Middleware function
      this.routerMiddleware.push(pathOrMiddleware);
    } else if (typeof pathOrMiddleware === 'string' && routerOrUndefined instanceof Router) {
      // Mount sub-router at path
      this.mountRouter(pathOrMiddleware, routerOrUndefined);
    } else if (typeof pathOrMiddleware === 'string') {
      // String prefix without a Router — unsupported, throw clear error
      throw new Error(
        `router.use('${pathOrMiddleware}', ...) requires a Router instance as the second argument. ` +
          'Use router.group(prefix, callback) for prefix-scoped middleware, ' +
          'or router.use(middlewareFn) to register middleware without a prefix.'
      );
    } else if (pathOrMiddleware instanceof Router) {
      // Mount router at root
      this.mountRouter('', pathOrMiddleware);
    }
    return this;
  }

  /**
   * Mount a sub-router at a path prefix (Hono-style).
   *
   * This is the explicit API for mounting sub-routers.
   * Equivalent to `router.use(path, subRouter)` but more semantic.
   *
   * @param path - Path prefix for the sub-router
   * @param router - Router instance to mount
   * @returns this for chaining
   * @see {@link https://github.com/0xTanzim/nextRush/blob/main/packages/router/README.md#sub-router-mounting | README: Sub-Router Mounting} for usage examples
   */
  mount(path: string, router: Router): this {
    this.mountRouter(path, router);
    return this;
  }

  /**
   * Mount a sub-router (internal)
   *
   * Carries the sub-router's own `routerMiddleware` forward so that
   * `subrouter.use(mw)` middleware applies to every copied route.
   */
  private mountRouter(prefix: string, router: Router): void {
    copyRoutes(router.root, prefix, [], router.routerMiddleware, this.addRoute.bind(this));
  }

  // ===========================================================================
  // Route Matching
  // ===========================================================================

  /**
   * Match a route and return handler + params. Delegates to the extracted
   * `matchRoute` (design.md D1) — this is the "thin delegating wrapper"
   * D1 describes; it only attaches `routerMiddleware` (not read by
   * `matchRoute` itself) to the result.
   */
  match(method: HttpMethod, path: string): RouteMatch | null {
    const result = matchRoute(
      method,
      path,
      this.root,
      this.staticRoutes,
      this.hasParamRoutes,
      this.opts.caseSensitive,
      this.opts.strict,
      this.opts.decode
    );
    if (!result) return null;

    return {
      handler: result.handler,
      params: result.params,
      middleware: this.routerMiddleware,
      executor: result.executor,
    };
  }

  // ===========================================================================
  // Middleware Generation
  // ===========================================================================

  /**
   * Get routes middleware function. Mount this on the application.
   * @see {@link https://github.com/0xTanzim/nextRush/blob/main/packages/router/README.md#routerroutes | README: router.routes()}
   */
  routes(): Middleware {
    // Seal router-level middleware into route executors at routes() call time
    // This avoids per-request closure creation
    const hasRouterMiddleware = this.routerMiddleware.length > 0;
    if (hasRouterMiddleware) {
      this.sealRouterMiddleware();
    }

    return async (ctx: Context, next?: () => Promise<void>): Promise<void> => {
      const match = this.match(ctx.method, ctx.path);

      if (!match) {
        // No route matched — set 404 so allowedMethods() and notFoundHandler() can act
        ctx.status = 404;
        if (next) await next();
        return;
      }

      // Set params on context
      ctx.params = match.params;

      // Use pre-compiled executor (includes router middleware if any)
      if (match.executor) {
        await match.executor(ctx);
        return;
      }

      // Fallback: No executor (shouldn't happen but be safe)
      await match.handler(ctx, NOOP_NEXT);
    };
  }

  /**
   * Re-compile all route executors to include router-level middleware.
   * Called once when routes() is invoked, not per-request.
   */
  private sealRouterMiddleware(): void {
    // Idempotent: sealing prepends routerMiddleware into every executor in
    // place, so running it twice would prepend the middleware twice (audit
    // RT-7). routes() can be invoked more than once (e.g. mounted and also
    // app.route()'d), so guard against re-sealing.
    if (this._sealed) return;
    this._sealed = true;

    sealRouterMiddlewareImpl(this.root, this.staticRoutes, this.routerMiddleware);
  }

  /**
   * Generate allowed methods middleware
   * Responds to OPTIONS and sets Allow header
   */
  allowedMethods(): Middleware {
    return async (ctx: Context, next?: () => Promise<void>): Promise<void> => {
      if (next) {
        await next();
      }

      if (ctx.status !== 404) return;

      // Single tree walk to find all allowed methods instead of N×match()
      const allowed = findAllowedMethods(ctx.path, this.root, this.opts.caseSensitive, this.opts.strict);

      if (allowed.length === 0) return;

      const allowHeader = allowed.join(', ');

      // If OPTIONS request, respond with allowed methods
      if (ctx.method === 'OPTIONS') {
        ctx.status = 200;
        ctx.set('Allow', allowHeader);
        ctx.body = '';
        return;
      }

      // Otherwise, return 405 Method Not Allowed
      ctx.status = 405;
      ctx.set('Allow', allowHeader);
    };
  }

  // ===========================================================================
  // Route Groups
  // ===========================================================================

  /**
   * Create a route group with shared prefix and middleware.
   *
   * @param prefix - Path prefix for all routes in the group
   * @param middlewareOrCallback - Middleware array or callback function
   * @param callback - Callback function if middleware is provided
   * @returns this for chaining
   * @see {@link https://github.com/0xTanzim/nextRush/blob/main/packages/router/README.md#route-groups | README: Route Groups} for usage examples
   */
  group(
    prefix: string,
    middlewareOrCallback: Middleware[] | ((router: RouteGroup) => void),
    callback?: (router: RouteGroup) => void
  ): this {
    let middleware: Middleware[] = [];
    let cb: (router: RouteGroup) => void;

    if (Array.isArray(middlewareOrCallback)) {
      middleware = middlewareOrCallback;
      if (!callback) {
        throw new Error('Callback function is required when providing middleware array');
      }
      cb = callback;
    } else {
      cb = middlewareOrCallback;
    }

    // Collect the group's routes via a GroupRouter (RT-6: properly typed, no cast).
    const groupRouter = new GroupRouter(this, prefix, middleware);
    cb(groupRouter);

    return this;
  }

  /**
   * Remove all registered routes and middleware, resetting the router to its
   * initial state. Useful for test isolation or hot-reload scenarios that
   * need to re-register routes on the same router instance.
   */
  reset(): void {
    this.root.children.clear();
    this.root.handlers.clear();
    this.root.paramChild = undefined;
    this.root.wildcardChild = undefined;
    this.staticRoutes.clear();
    this.routerMiddleware.length = 0;
    this.hasParamRoutes = false;
    // Clear the introspection registry too, or getRoutes()/OpenAPI would emit
    // ghost routes after a reset (audit RT-1).
    this.routeDefinitions.length = 0;
    this._sealed = false;
  }

  /**
   * Internal method to add route with group context
   * @internal
   */
  _addGroupRoute(
    method: HttpMethod,
    path: string,
    handlers: RouteHandler[],
    groupMiddleware: Middleware[]
  ): void {
    this.addRoute(method, path, handlers, groupMiddleware);
  }
}

/**
 * Create a new Router instance.
 *
 * @param options - Router options
 * @returns New Router instance
 * @see {@link https://github.com/0xTanzim/nextRush/blob/main/packages/router/README.md#quick-start | README: Quick Start} for usage examples
 */
export function createRouter(options?: RouterOptions): Router {
  return new Router(options);
}

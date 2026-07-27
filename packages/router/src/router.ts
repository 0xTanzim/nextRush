/**
 * @nextrush/router - Router Implementation
 *
 * The public `Router` shell: a thin, chainable facade delegating registration,
 * matching, dispatch, composition, and grouping to focused sibling modules
 * (design.md D1/D2). Segment trie keyed by whole path segments, not a radix tree.
 *
 * @packageDocumentation
 */

import {
  HTTP_METHODS,
  type HttpMethod,
  type Middleware,
  type RouteDefinition,
  type RouteEntry,
  type RouteHandler,
  type RouteMatch,
  type RouterOptions,
} from '@nextrush/types';
import { clearNode, createNode, type StaticRouteMap, type TrieNode } from './segment-trie';
import { type RedirectStatus } from './redirect';
import { runRouteGroup, type RouteGroup } from './group-router';
import { resolveMatch, type MatchState } from './match-route';
import { copyRoutes } from './composition';
import { sealRouterMiddleware as sealRouterMiddlewareImpl } from './middleware-adapter';
import {
  addRoute as addRouteImpl,
  normalizeRegistrationPath,
  pushAnyMethodDefinition,
  registerRedirect,
  type RegistrationState,
} from './registration';
import { createAllowedMethodsMiddleware, createRoutesMiddleware } from './dispatch';
import { createRouterState, resolveRouterOptions } from './state';
import { canonicalizePath } from './canonicalize';

/** '/'.charCodeAt(0) — used by {@link Router.matchesMountPrefix}'s boundary check. */
const SLASH_CHAR_CODE = 0x2f;

/** Inline route metadata declaration — re-exported from its own module (RT-3). */
export { endpoint } from './route-metadata';

/**
 * High-performance segment-trie router: O(d) lookup by path segment, with a
 * static-route hash map for an O(1) fast path.
 * @see {@link https://github.com/0xTanzim/nextRush/blob/main/packages/router/README.md | @nextrush/router README}
 */
export class Router {
  private readonly root: TrieNode;
  private readonly opts: Required<RouterOptions>;
  private readonly routerMiddleware: Middleware[] = [];

  /** Static-route fast path: method-nested map for O(1) lookup with no per-request key string (HP-9). */
  private readonly staticRoutes: StaticRouteMap = new Map();

  /**
   * Introspection registry, kept SEPARATE from the hot-path trie/staticRoutes
   * so request dispatch never reads metadata — only getRoutes() touches it.
   */
  private readonly routeDefinitions: RouteDefinition[] = [];

  /** Whether any routes have params or wildcards (disables static-only fast path) */
  private hasParamRoutes = false;

  /** Whether router-level middleware has already been sealed into executors (audit RT-7) */
  private _sealed = false;

  /** Memoized state the extracted registration/matching functions read (see {@link createRouterState}). */
  private readonly state: RegistrationState & MatchState;

  constructor(options: RouterOptions = {}) {
    this.root = createNode('');
    this.opts = resolveRouterOptions(options);
    this.state = createRouterState(
      this.root,
      this.opts,
      this.staticRoutes,
      this.routeDefinitions,
      this.routerMiddleware
    );
  }

  /**
   * Validate + normalize a raw path, then delegate trie insertion to the
   * extracted `addRoute` (design.md D2); flips `hasParamRoutes` from its return.
   */
  private addRoute(
    method: HttpMethod,
    path: string,
    entries: RouteEntry[],
    middleware: Middleware[] = [],
    recordIntrospection = true
  ): void {
    // Guard untyped-JS callers: a non-string path would coerce to a bogus literal route.
    const rawPath: unknown = path;
    if (typeof rawPath !== 'string') {
      throw new TypeError(
        `Route path must be a string, received ${rawPath === null ? 'null' : typeof rawPath}.`
      );
    }
    const normalized = normalizeRegistrationPath(path, this.opts.prefix, this.opts.strict);
    if (addRouteImpl(method, normalized, entries, middleware, this.state, recordIntrospection)) {
      this.hasParamRoutes = true;
    }
  }

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

  /**
   * Register a route for every HTTP method under one consolidated `isAnyMethod`
   * introspection row (T016) — matching is unchanged (see {@link pushAnyMethodDefinition}).
   */
  all(path: string, ...entries: RouteEntry[]): this {
    // recordIntrospection=false: insert each per-method handler without its own
    // introspection row; the single consolidated row below replaces all 7.
    for (const method of HTTP_METHODS) {
      this.addRoute(method, path, entries, [], false);
    }
    pushAnyMethodDefinition(
      this.routeDefinitions,
      normalizeRegistrationPath(path, this.opts.prefix, this.opts.strict)
    );
    return this;
  }

  route(method: HttpMethod, path: string, ...entries: RouteEntry[]): this {
    this.addRoute(method, path, entries);
    return this;
  }

  /**
   * Every registered route as a read-only list, for renderers (`@nextrush/openapi`,
   * SDK/RPC generators). Doc-generation-time only — never on the request path.
   */
  getRoutes(): readonly RouteDefinition[] {
    return this.routeDefinitions;
  }

  /**
   * Register a redirect from one path to another (301 by default). 307/308
   * additionally register POST/PUT/PATCH/DELETE to preserve the method.
   * @see {@link https://github.com/0xTanzim/nextRush/blob/main/packages/router/README.md#redirects | README: Redirects}
   */
  redirect(from: string, to: string, status: RedirectStatus = 301): this {
    registerRedirect(from, to, status, (method, path, entries) => {
      this.addRoute(method, path, entries);
    });
    return this;
  }

  use(pathOrMiddleware: string | Middleware | Router, routerOrUndefined?: Router): this {
    if (typeof pathOrMiddleware === 'function') {
      this.routerMiddleware.push(pathOrMiddleware);
    } else if (typeof pathOrMiddleware === 'string' && routerOrUndefined instanceof Router) {
      this.mountRouter(pathOrMiddleware, routerOrUndefined);
    } else if (typeof pathOrMiddleware === 'string') {
      throw new Error(
        `router.use('${pathOrMiddleware}', ...) requires a Router instance as the second argument. ` +
          'Use router.group(prefix, callback) for prefix-scoped middleware, ' +
          'or router.use(middlewareFn) to register middleware without a prefix.'
      );
    } else if (pathOrMiddleware instanceof Router) {
      this.mountRouter('', pathOrMiddleware);
    }
    return this;
  }

  /**
   * Mount a sub-router at a path prefix (Hono-style) — the explicit, more
   * semantic equivalent of `router.use(path, subRouter)`.
   * @see {@link https://github.com/0xTanzim/nextRush/blob/main/packages/router/README.md#sub-router-mounting | README: Sub-Router Mounting}
   */
  mount(path: string, router: Router): this {
    this.mountRouter(path, router);
    return this;
  }

  /** Mount a sub-router, carrying its own `routerMiddleware` onto every copied route. */
  private mountRouter(prefix: string, router: Router): void {
    copyRoutes(router.root, prefix, [], router.routerMiddleware, this.addRoute.bind(this));
  }

  /** Match a request to a route — delegates to {@link resolveMatch} (design.md D1). */
  match(method: HttpMethod, path: string): RouteMatch | null {
    return resolveMatch(this.state, this.hasParamRoutes, method, path);
  }

  /**
   * Test whether `path` falls under `prefix` using this router's OWN
   * canonicalization (case folding per `caseSensitive`, structural
   * normalization) — the mount-boundary counterpart to {@link match}, so a
   * router mounted via `Application.route()` is tested with the identical
   * rule it dispatches with (RFC-029, task 3.8). Implements the optional
   * `Routable.matchesMountPrefix` contract from `@nextrush/core`.
   *
   * @param path - The full request path being tested for this mount.
   * @param prefix - The normalized mount prefix (leading `/`, no trailing `/`).
   * @returns The path's remainder past the prefix (e.g. `/users` for a
   *   `/ADMIN/Users` request mounted at `/admin`), or `undefined` when `path`
   *   is not under `prefix` per this router's canonicalization.
   */
  matchesMountPrefix(path: string, prefix: string): string | undefined {
    const canonical = canonicalizePath(path, this.opts.caseSensitive, this.opts.strict);
    if (canonical.rejected) return undefined;

    const canonicalPrefix = canonicalizePath(prefix, this.opts.caseSensitive, this.opts.strict).path;
    const prefixLen = canonicalPrefix.length;
    if (!canonical.path.startsWith(canonicalPrefix)) return undefined;

    const hasCharAfterPrefix = prefixLen < canonical.path.length;
    if (hasCharAfterPrefix && canonical.path.charCodeAt(prefixLen) !== SLASH_CHAR_CODE) {
      return undefined;
    }

    return canonical.path.slice(prefixLen) || '/';
  }

  /**
   * Return the router's dispatch middleware — mount this on the application.
   * @see {@link https://github.com/0xTanzim/nextRush/blob/main/packages/router/README.md#routerroutes | README: router.routes()}
   */
  routes(): Middleware {
    // Seal router middleware into every executor once (audit RT-7 idempotency):
    // routes() may run more than once, so the _sealed guard prevents re-prepend.
    if (this.routerMiddleware.length > 0 && !this._sealed) {
      this._sealed = true;
      sealRouterMiddlewareImpl(this.root, this.staticRoutes, this.routerMiddleware);
    }
    return createRoutesMiddleware(
      (method, path) => this.match(method, path),
      this.opts.caseSensitive,
      this.opts.strict
    );
  }

  /**
   * Generate allowed-methods middleware. Responds to OPTIONS with an `Allow`
   * header and returns 405 for a known path hit with an unregistered method.
   */
  allowedMethods(): Middleware {
    return createAllowedMethodsMiddleware(this.root, this.opts.caseSensitive, this.opts.strict);
  }

  /**
   * Create a route group with a shared prefix and middleware. The callback
   * receives a {@link RouteGroup} to register routes against.
   * @see {@link https://github.com/0xTanzim/nextRush/blob/main/packages/router/README.md#route-groups | README: Route Groups}
   */
  group(
    prefix: string,
    middlewareOrCallback: Middleware[] | ((router: RouteGroup) => void),
    callback?: (router: RouteGroup) => void
  ): this {
    runRouteGroup(this, prefix, middlewareOrCallback, callback);
    return this;
  }

  /**
   * Remove all routes and middleware, resetting the router to its initial
   * state — for test isolation or hot-reload re-registration.
   */
  reset(): void {
    clearNode(this.root);
    this.staticRoutes.clear();
    this.routerMiddleware.length = 0;
    this.hasParamRoutes = false;
    // Clear the introspection registry too, or getRoutes()/OpenAPI would emit
    // ghost routes after a reset (audit RT-1).
    this.routeDefinitions.length = 0;
    this._sealed = false;
  }

  /** Register a route on behalf of a {@link RouteGroup} (group context). @internal */
  _addGroupRoute(
    method: HttpMethod,
    path: string,
    handlers: RouteHandler[],
    groupMiddleware: Middleware[],
    recordIntrospection = true
  ): void {
    this.addRoute(method, path, handlers, groupMiddleware, recordIntrospection);
  }

  /**
   * Group-facing entry point to {@link pushAnyMethodDefinition} — a group's `.all()`
   * records its consolidated row here since group routes live on the parent. @internal
   */
  _pushAnyMethodRouteDefinition(path: string): void {
    pushAnyMethodDefinition(
      this.routeDefinitions,
      normalizeRegistrationPath(path, this.opts.prefix, this.opts.strict)
    );
  }
}

/**
 * Create a new {@link Router} instance.
 * @see {@link https://github.com/0xTanzim/nextRush/blob/main/packages/router/README.md#quick-start | README: Quick Start}
 */
export function createRouter(options?: RouterOptions): Router {
  return new Router(options);
}

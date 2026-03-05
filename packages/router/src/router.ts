/**
 * @nextrush/router - Router Implementation
 *
 * High-performance router using a segment trie for route matching.
 * Routes are keyed by full path segments (e.g. "users", ":id"), not by
 * individual characters — this is a segment-based trie, not a compressed
 * radix tree. Supports parameters, wildcards, and method-based routing.
 *
 * @packageDocumentation
 */

import {
  HTTP_METHODS,
  type Context,
  type HttpMethod,
  type Middleware,
  type RouteHandler,
  type RouteMatch,
  type RouterOptions,
} from '@nextrush/types';
import {
  compileExecutor,
  createNode,
  NodeType,
  NOOP_NEXT,
  parseSegments,
  type HandlerEntry,
  type RadixNode,
} from './radix-tree';

/** Frozen empty params for static routes — avoids allocation per request */
const EMPTY_PARAMS: Record<string, string> = Object.freeze(
  Object.create(null) as Record<string, string>
);

/**
 * Router class — high-performance segment trie router
 *
 * Routes are indexed by path segment, giving O(d) lookup where d is the
 * number of segments. Static routes are additionally stored in a hash map
 * for O(1) fast-path lookup.
 *
 * @example
 * ```typescript
 * const router = createRouter();
 *
 * router.get('/users', listUsers);
 * router.get('/users/:id', getUser);
 * router.post('/users', createUser);
 *
 * app.use(router.routes());
 * ```
 */
export class Router {
  private readonly root: RadixNode;
  private readonly opts: Required<RouterOptions>;
  private readonly routerMiddleware: Middleware[] = [];

  /**
   * Static route hash map for O(1) lookup.
   * Key: "METHOD path" (e.g. "GET /users"), Value: HandlerEntry
   */
  private readonly staticRoutes = new Map<string, HandlerEntry>();

  /** Whether any routes have params or wildcards (disables static-only fast path) */
  private hasParamRoutes = false;

  constructor(options: RouterOptions = {}) {
    this.root = createNode('');
    this.opts = {
      prefix: options.prefix ?? '',
      caseSensitive: options.caseSensitive ?? false,
      strict: options.strict ?? false,
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
   * Add a route to the radix tree
   */
  private addRoute(
    method: HttpMethod,
    path: string,
    handlers: RouteHandler[],
    middleware: Middleware[] = []
  ): void {
    const normalized = this.normalizePath(path);
    const segments = parseSegments(normalized, this.opts.caseSensitive);

    let node = this.root;

    for (const seg of segments) {
      if (seg.type === NodeType.PARAM) {
        if (!node.paramChild) {
          node.paramChild = createNode(seg.segment, NodeType.PARAM);
          node.paramChild.paramName = seg.paramName;
        } else if (node.paramChild.paramName !== seg.paramName) {
          // Warn about param name collision — same position, different names
          // This helps catch accidental mismatches like :id vs :userId
          if (typeof process !== 'undefined' && process.env?.['NODE_ENV'] !== 'production') {
            const existing = node.paramChild.paramName;
            // eslint-disable-next-line no-console
            console.warn(
              `[nextrush:router] Route param name conflict at "${normalized}": ` +
                `":${seg.paramName}" conflicts with existing ":${existing}". ` +
                `The existing name ":${existing}" will be used.`
            );
          }
        }
        node = node.paramChild;
      } else if (seg.type === NodeType.WILDCARD) {
        if (!node.wildcardChild) {
          node.wildcardChild = createNode('*', NodeType.WILDCARD);
        }
        node = node.wildcardChild;
        break; // Wildcard must be last
      } else {
        const key = seg.segment;
        let child = node.children.get(key);
        if (!child) {
          child = createNode(seg.segment, NodeType.STATIC);
          node.children.set(key, child);
        }
        node = child;
      }
    }

    // Combine multiple handlers into single handler with inline middleware
    const combinedMiddleware = [...middleware];
    const finalHandler = handlers[handlers.length - 1];

    if (!finalHandler) {
      throw new Error('At least one handler is required');
    }

    const inlineMiddleware = handlers.slice(0, -1);

    // Add inline middleware (handlers before the last one)
    for (const mw of inlineMiddleware) {
      combinedMiddleware.push(mw as Middleware);
    }

    // Pre-compile executor at registration time (not per-request!)
    const executor = compileExecutor(finalHandler, combinedMiddleware);

    const entry: HandlerEntry = {
      handler: finalHandler,
      middleware: combinedMiddleware,
      executor,
    };

    // Detect duplicate route registration
    if (node.handlers.has(method)) {
      throw new Error(
        `Route conflict: ${method} ${normalized} is already registered. ` +
          'Remove the duplicate or use a different path.'
      );
    }

    node.handlers.set(method, entry);

    // Populate static route hash map for O(1) lookup
    const hasParams = segments.some(
      (s) => s.type === NodeType.PARAM || s.type === NodeType.WILDCARD
    );
    if (hasParams) {
      this.hasParamRoutes = true;
    } else {
      const normalizedKey = this.opts.caseSensitive ? normalized : normalized.toLowerCase();
      this.staticRoutes.set(`${method} ${normalizedKey}`, entry);
    }
  }

  // ===========================================================================
  // HTTP Method Shortcuts
  // ===========================================================================

  get(path: string, ...handlers: RouteHandler[]): this {
    this.addRoute('GET', path, handlers);
    return this;
  }

  post(path: string, ...handlers: RouteHandler[]): this {
    this.addRoute('POST', path, handlers);
    return this;
  }

  put(path: string, ...handlers: RouteHandler[]): this {
    this.addRoute('PUT', path, handlers);
    return this;
  }

  delete(path: string, ...handlers: RouteHandler[]): this {
    this.addRoute('DELETE', path, handlers);
    return this;
  }

  patch(path: string, ...handlers: RouteHandler[]): this {
    this.addRoute('PATCH', path, handlers);
    return this;
  }

  head(path: string, ...handlers: RouteHandler[]): this {
    this.addRoute('HEAD', path, handlers);
    return this;
  }

  options(path: string, ...handlers: RouteHandler[]): this {
    this.addRoute('OPTIONS', path, handlers);
    return this;
  }

  all(path: string, ...handlers: RouteHandler[]): this {
    for (const method of HTTP_METHODS) {
      this.addRoute(method, path, handlers);
    }
    return this;
  }

  route(method: HttpMethod, path: string, ...handlers: RouteHandler[]): this {
    this.addRoute(method, path, handlers);
    return this;
  }

  /**
   * Register a redirect route from one path to another
   *
   * @param from - Source path to redirect from
   * @param to - Target path or URL to redirect to
   * @param status - HTTP status code (default: 301 permanent redirect)
   * @returns this for chaining
   *
   * @example
   * ```typescript
   * // Permanent redirect (301)
   * router.redirect('/old-page', '/new-page');
   *
   * // Temporary redirect (302)
   * router.redirect('/temp', '/destination', 302);
   *
   * // Redirect to external URL
   * router.redirect('/docs', 'https://docs.example.com');
   *
   * // With parameters - redirects /users/:id to /profiles/:id
   * router.redirect('/users/:id', '/profiles/:id');
   * ```
   */
  redirect(from: string, to: string, status: 301 | 302 | 303 | 307 | 308 = 301): this {
    // Precompile the target template at registration time.
    // If `to` contains route-style `:param` placeholders, build a parts
    // array of alternating literal / param-name entries so the per-request
    // handler can substitute without sorting or scanning the string.
    //
    // Only `:` preceded by `/` or at position 0 is a param slot.  This
    // avoids misinterpreting `https://` or other non-route colons.
    let compiledParts: string[] | undefined;

    {
      const parts: string[] = [];
      let pos = 0;
      let found = false;

      while (pos < to.length) {
        // Find next `:` that looks like a route param
        let idx = -1;
        for (let i = pos; i < to.length; i++) {
          if (
            to[i] === ':' &&
            (i === 0 || to[i - 1] === '/') &&
            i + 1 < to.length &&
            to[i + 1] !== '/'
          ) {
            idx = i;
            break;
          }
        }
        if (idx === -1) break;

        found = true;
        parts.push(to.slice(pos, idx)); // literal before ':'
        const end = to.indexOf('/', idx + 1);
        if (end === -1) {
          parts.push(to.slice(idx + 1)); // param name (rest of string)
          pos = to.length;
        } else {
          parts.push(to.slice(idx + 1, end)); // param name
          pos = end;
        }
      }

      if (found) {
        parts.push(to.slice(pos)); // trailing literal
        compiledParts = parts;
      }
    }

    const redirectHandler: RouteHandler = (ctx: Context) => {
      let targetPath: string;

      if (compiledParts) {
        // Fast path: build from precompiled template
        const params = ctx.params;
        const parts = compiledParts;
        let result = parts[0]!; // first literal
        for (let i = 1; i < parts.length - 1; i += 2) {
          result += (params[parts[i]!] ?? '') + (parts[i + 1] ?? '');
        }
        targetPath = result;
      } else {
        targetPath = to;
      }

      ctx.status = status;
      ctx.set('Location', targetPath);
      ctx.body = '';
    };

    // Register for common methods. 307/308 preserve the original method,
    // so register all standard methods for those status codes.
    this.addRoute('GET', from, [redirectHandler]);
    this.addRoute('HEAD', from, [redirectHandler]);
    if (status === 307 || status === 308) {
      this.addRoute('POST', from, [redirectHandler]);
      this.addRoute('PUT', from, [redirectHandler]);
      this.addRoute('PATCH', from, [redirectHandler]);
      this.addRoute('DELETE', from, [redirectHandler]);
    }

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
   * Mount a sub-router at a path prefix (Hono-style)
   *
   * This is the explicit API for mounting sub-routers.
   * Equivalent to `router.use(path, subRouter)` but more semantic.
   *
   * @param path - Path prefix for the sub-router
   * @param router - Router instance to mount
   * @returns this for chaining
   *
   * @example
   * ```typescript
   * // Create modular routers
   * const users = createRouter();
   * users.get('/', listUsers);
   * users.get('/:id', getUser);
   *
   * const posts = createRouter();
   * posts.get('/', listPosts);
   *
   * // Mount sub-routers
   * const api = createRouter();
   * api.mount('/users', users);
   * api.mount('/posts', posts);
   *
   * // Or use on main router
   * const router = createRouter();
   * router.mount('/api', api);
   *
   * app.use(router.routes());
   * ```
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
    this.copyRoutes(router.root, prefix, [], router.routerMiddleware);
  }

  /**
   * Recursively copy routes from another router
   */
  private copyRoutes(
    node: RadixNode,
    prefix: string,
    segments: string[],
    subRouterMiddleware: Middleware[]
  ): void {
    // Copy handlers at this node
    for (const [method, entry] of node.handlers) {
      const path = prefix + '/' + segments.join('/');
      // Prepend sub-router middleware so it runs before the route's own middleware
      const combined =
        subRouterMiddleware.length > 0
          ? [...subRouterMiddleware, ...entry.middleware]
          : entry.middleware;
      this.addRoute(method, path || '/', [entry.handler], combined);
    }

    // Copy static children
    for (const [, child] of node.children) {
      this.copyRoutes(child, prefix, [...segments, child.segment], subRouterMiddleware);
    }

    // Copy param child
    if (node.paramChild) {
      this.copyRoutes(
        node.paramChild,
        prefix,
        [...segments, node.paramChild.segment],
        subRouterMiddleware
      );
    }

    // Copy wildcard child
    if (node.wildcardChild) {
      this.copyRoutes(node.wildcardChild, prefix, [...segments, '*'], subRouterMiddleware);
    }
  }

  // ===========================================================================
  // Route Matching
  // ===========================================================================

  /**
   * Match a route and return handler + params
   */
  match(method: HttpMethod, path: string): RouteMatch | null {
    const isCaseInsensitive = !this.opts.caseSensitive;
    let normalized = isCaseInsensitive ? path.toLowerCase() : path;

    // Fast-path: skip regex when no double slashes (99%+ of requests)
    if (normalized.includes('//')) {
      normalized = normalized.replace(/\/+/g, '/');
    }

    // For strict mode, keep trailing slash; otherwise remove it
    if (!this.opts.strict && normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    // FAST PATH: O(1) static route lookup (no tree traversal)
    // For static routes, trailing slash is irrelevant — always strip for lookup
    const staticKey =
      normalized.length > 1 && normalized.endsWith('/')
        ? `${method} ${normalized.slice(0, -1)}`
        : `${method} ${normalized}`;
    const staticEntry = this.staticRoutes.get(staticKey);
    if (staticEntry) {
      return {
        handler: staticEntry.handler,
        params: EMPTY_PARAMS,
        middleware: this.routerMiddleware,
        executor: staticEntry.executor,
      };
    }

    // Only walk tree if we have param/wildcard routes
    if (!this.hasParamRoutes) return null;

    // Use index-based path scanning instead of split('/').filter(Boolean)
    const params: Record<string, string> = {};

    // For case-insensitive mode, preserve original-case path for param values
    let originalPath: string | undefined;
    if (isCaseInsensitive) {
      originalPath = path;
      if (originalPath.includes('//')) {
        originalPath = originalPath.replace(/\/+/g, '/');
      }
      if (!this.opts.strict && originalPath.length > 1 && originalPath.endsWith('/')) {
        originalPath = originalPath.slice(0, -1);
      }
    }

    const result = this.matchNodeIndexed(
      this.root,
      normalized,
      1, // Start after leading '/'
      params,
      method,
      originalPath
    );
    if (!result) return null;

    // Check if any params were actually set
    let hasParams = false;
    for (const key in params) {
      if (params[key] === undefined) {
        delete params[key];
      } else {
        hasParams = true;
      }
    }

    return {
      handler: result.handler,
      params: hasParams ? params : EMPTY_PARAMS,
      middleware: this.routerMiddleware,
      executor: result.executor,
    };
  }

  /**
   * Extract the next segment from path at given position without allocating arrays.
   * Returns [segment, nextIndex] where nextIndex is position after the trailing '/'.
   */
  private extractSegment(path: string, start: number): [segment: string, nextIndex: number] {
    const slashPos = path.indexOf('/', start);
    if (slashPos === -1) {
      return [path.slice(start), path.length];
    }
    return [path.slice(start, slashPos), slashPos + 1];
  }

  /**
   * Index-based recursive node matching (avoids array allocation)
   */
  private matchNodeIndexed(
    node: RadixNode,
    path: string,
    pos: number,
    params: Record<string, string>,
    method: HttpMethod,
    originalPath?: string
  ): HandlerEntry | null {
    // Reached end of path
    if (pos >= path.length) {
      return node.handlers.get(method) ?? null;
    }

    const [segment, nextPos] = this.extractSegment(path, pos);
    if (segment === '') return node.handlers.get(method) ?? null;

    // Try static match first (most specific)
    const staticChild = node.children.get(segment);
    if (staticChild) {
      const result = this.matchNodeIndexed(
        staticChild,
        path,
        nextPos,
        params,
        method,
        originalPath
      );
      if (result) return result;
    }

    // Try parameter match — use original-case segment for param value
    if (node.paramChild) {
      const paramName = node.paramChild.paramName!;
      if (originalPath) {
        const [origSeg] = this.extractSegment(originalPath, pos);
        params[paramName] = origSeg;
      } else {
        params[paramName] = segment;
      }
      const result = this.matchNodeIndexed(
        node.paramChild,
        path,
        nextPos,
        params,
        method,
        originalPath
      );
      if (result) return result;
      params[paramName] = undefined as unknown as string;
    }

    // Try wildcard match (catches remaining path) — use original-case path
    if (node.wildcardChild) {
      const src = originalPath ?? path;
      params['*'] = src.slice(pos);
      return node.wildcardChild.handlers.get(method) ?? null;
    }

    return null;
  }

  // ===========================================================================
  // Middleware Generation
  // ===========================================================================

  /**
   * Get routes middleware function
   * Mount this on the application
   *
   * @example
   * ```typescript
   * app.use(router.routes());
   * ```
   */
  routes(): Middleware {
    // Seal router-level middleware into route executors at routes() call time
    // This avoids per-request closure creation
    const hasRouterMiddleware = this.routerMiddleware.length > 0;
    if (hasRouterMiddleware) {
      this.sealRouterMiddleware();
    }

    return async (ctx: Context, next?: () => Promise<void>): Promise<void> => {
      const match = this.match(ctx.method as HttpMethod, ctx.path);

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
    const routerMw = [...this.routerMiddleware];

    // Walk the tree and re-compile every handler entry
    const walk = (node: RadixNode): void => {
      for (const [method, entry] of node.handlers) {
        const combinedMw = [...routerMw, ...entry.middleware];
        entry.executor = compileExecutor(entry.handler, combinedMw);
        node.handlers.set(method, entry);
      }
      for (const [, child] of node.children) {
        walk(child);
      }
      if (node.paramChild) walk(node.paramChild);
      if (node.wildcardChild) walk(node.wildcardChild);
    };

    walk(this.root);

    // Also update static route entries
    for (const [key, entry] of this.staticRoutes) {
      const combinedMw = [...routerMw, ...entry.middleware];
      entry.executor = compileExecutor(entry.handler, combinedMw);
      this.staticRoutes.set(key, entry);
    }
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
      const allowed = this.findAllowedMethods(ctx.path);

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

  /**
   * Find all HTTP methods registered for a given path via single tree walk
   * @internal
   */
  private findAllowedMethods(path: string): HttpMethod[] {
    let normalized = this.opts.caseSensitive ? path : path.toLowerCase();

    if (normalized.includes('//')) {
      normalized = normalized.replace(/\/+/g, '/');
    }

    if (!this.opts.strict && normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    const segments = normalized.split('/').filter(Boolean);
    const node = this.findNode(this.root, segments, 0);
    if (!node || node.handlers.size === 0) return [];

    return Array.from(node.handlers.keys());
  }

  /**
   * Walk the tree to find the node matching a path (ignoring HTTP method)
   * @internal
   */
  private findNode(node: RadixNode, segments: string[], index: number): RadixNode | null {
    if (index === segments.length) {
      return node;
    }

    const segment = segments[index];
    if (segment === undefined) return null;

    // Static match
    const staticChild = node.children.get(segment);
    if (staticChild) {
      const result = this.findNode(staticChild, segments, index + 1);
      if (result) return result;
    }

    // Param match
    if (node.paramChild) {
      const result = this.findNode(node.paramChild, segments, index + 1);
      if (result) return result;
    }

    // Wildcard match
    if (node.wildcardChild) {
      return node.wildcardChild;
    }

    return null;
  }

  // ===========================================================================
  // Route Groups
  // ===========================================================================

  /**
   * Create a route group with shared prefix and middleware
   *
   * @param prefix - Path prefix for all routes in the group
   * @param middlewareOrCallback - Middleware array or callback function
   * @param callback - Callback function if middleware is provided
   * @returns this for chaining
   *
   * @example
   * ```typescript
   * // Simple group with prefix
   * router.group('/api', (r) => {
   *   r.get('/users', listUsers);
   *   r.get('/posts', listPosts);
   * });
   *
   * // Group with middleware
   * router.group('/admin', [authMiddleware], (r) => {
   *   r.get('/dashboard', dashboard);
   *   r.post('/settings', updateSettings);
   * });
   *
   * // Nested groups
   * router.group('/api/v1', (r) => {
   *   r.group('/users', [rateLimit], (ur) => {
   *     ur.get('/', listUsers);
   *     ur.get('/:id', getUser);
   *   });
   * });
   * ```
   */
  group(
    prefix: string,
    middlewareOrCallback: Middleware[] | ((router: Router) => void),
    callback?: (router: Router) => void
  ): this {
    let middleware: Middleware[] = [];
    let cb: (router: Router) => void;

    if (Array.isArray(middlewareOrCallback)) {
      middleware = middlewareOrCallback;
      if (!callback) {
        throw new Error('Callback function is required when providing middleware array');
      }
      cb = callback;
    } else {
      cb = middlewareOrCallback;
    }

    // Create a temporary router to collect routes
    const groupRouter = new GroupRouter(this, prefix, middleware);

    // Execute callback with the group router
    cb(groupRouter as unknown as Router);

    return this;
  }

  /**
   * Remove all registered routes and middleware, resetting the router to its initial state.
   * Useful for plugin `destroy()` to cleanly un-register routes.
   */
  reset(): void {
    this.root.children.clear();
    this.root.handlers.clear();
    this.root.paramChild = undefined;
    this.root.wildcardChild = undefined;
    this.staticRoutes.clear();
    this.routerMiddleware.length = 0;
    this.hasParamRoutes = false;
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
 * Internal router class for handling route groups
 * Wraps the parent router and adds prefix/middleware to all routes
 * @internal
 */
class GroupRouter {
  private readonly parent: Router;
  private readonly prefix: string;
  private readonly middleware: Middleware[];

  constructor(parent: Router, prefix: string, middleware: Middleware[]) {
    this.parent = parent;
    this.prefix = prefix;
    this.middleware = middleware;
  }

  private fullPath(path: string): string {
    // Handle root path in group
    if (path === '/' || path === '') {
      return this.prefix;
    }
    // Combine prefix and path
    const cleanPrefix = this.prefix.endsWith('/') ? this.prefix.slice(0, -1) : this.prefix;
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    return cleanPrefix + cleanPath;
  }

  get(path: string, ...handlers: RouteHandler[]): this {
    this.parent._addGroupRoute('GET', this.fullPath(path), handlers, this.middleware);
    return this;
  }

  post(path: string, ...handlers: RouteHandler[]): this {
    this.parent._addGroupRoute('POST', this.fullPath(path), handlers, this.middleware);
    return this;
  }

  put(path: string, ...handlers: RouteHandler[]): this {
    this.parent._addGroupRoute('PUT', this.fullPath(path), handlers, this.middleware);
    return this;
  }

  delete(path: string, ...handlers: RouteHandler[]): this {
    this.parent._addGroupRoute('DELETE', this.fullPath(path), handlers, this.middleware);
    return this;
  }

  patch(path: string, ...handlers: RouteHandler[]): this {
    this.parent._addGroupRoute('PATCH', this.fullPath(path), handlers, this.middleware);
    return this;
  }

  head(path: string, ...handlers: RouteHandler[]): this {
    this.parent._addGroupRoute('HEAD', this.fullPath(path), handlers, this.middleware);
    return this;
  }

  options(path: string, ...handlers: RouteHandler[]): this {
    this.parent._addGroupRoute('OPTIONS', this.fullPath(path), handlers, this.middleware);
    return this;
  }

  all(path: string, ...handlers: RouteHandler[]): this {
    for (const method of HTTP_METHODS) {
      this.parent._addGroupRoute(method, this.fullPath(path), handlers, this.middleware);
    }
    return this;
  }

  /**
   * Register a redirect within the group
   */
  redirect(from: string, to: string, status: 301 | 302 | 303 | 307 | 308 = 301): this {
    const redirectHandler: RouteHandler = (ctx: Context) => {
      let targetPath = to;

      if (ctx.params && targetPath.includes(':')) {
        const entries = Object.entries(ctx.params).sort((a, b) => b[0].length - a[0].length);
        for (const [key, value] of entries) {
          targetPath = targetPath.replaceAll(`:${key}`, value);
        }
      }

      ctx.status = status;
      ctx.set('Location', targetPath);
      ctx.body = '';
    };

    this.parent._addGroupRoute('GET', this.fullPath(from), [redirectHandler], this.middleware);
    this.parent._addGroupRoute('HEAD', this.fullPath(from), [redirectHandler], this.middleware);

    return this;
  }

  /**
   * Nested group support
   */
  group(
    prefix: string,
    middlewareOrCallback: Middleware[] | ((router: GroupRouter) => void),
    callback?: (router: GroupRouter) => void
  ): this {
    let nestedMiddleware: Middleware[] = [];
    let cb: (router: GroupRouter) => void;

    if (Array.isArray(middlewareOrCallback)) {
      nestedMiddleware = middlewareOrCallback;
      if (!callback) {
        throw new Error('Callback function is required when providing middleware array');
      }
      cb = callback;
    } else {
      cb = middlewareOrCallback;
    }

    // Create nested group with combined prefix and middleware
    const nestedRouter = new GroupRouter(this.parent, this.fullPath(prefix), [
      ...this.middleware,
      ...nestedMiddleware,
    ]);

    cb(nestedRouter);

    return this;
  }
}

/**
 * Create a new Router instance
 *
 * @param options - Router options
 * @returns New Router instance
 *
 * @example
 * ```typescript
 * const router = createRouter();
 * const apiRouter = createRouter({ prefix: '/api/v1' });
 * ```
 */
export function createRouter(options?: RouterOptions): Router {
  return new Router(options);
}

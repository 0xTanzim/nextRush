/**
 * @nextrush/router - Router Implementation
 *
 * High-performance router using radix tree for route matching.
 * Supports parameters, wildcards, and method-based routing.
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
    createNode,
    NodeType,
    parseSegments,
    type HandlerEntry,
    type RadixNode,
} from './radix-tree';

/**
 * Router class - High-performance radix tree router
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

    // Remove any double slashes
    normalized = normalized.replace(/\/+/g, '/');

    // Only lowercase for case-insensitive matching of static segments
    // Parameter names are preserved separately in parseSegments
    if (!this.opts.caseSensitive) {
      // Only lowercase static parts, not parameter names
      normalized = normalized.toLowerCase();
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
    const segments = parseSegments(normalized);

    let node = this.root;

    for (const seg of segments) {
      if (seg.type === NodeType.PARAM) {
        if (!node.paramChild) {
          node.paramChild = createNode(seg.segment, NodeType.PARAM);
          node.paramChild.paramName = seg.paramName;
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
      combinedMiddleware.push(mw as unknown as Middleware);
    }

    const entry: HandlerEntry = {
      handler: finalHandler,
      middleware: combinedMiddleware,
    };

    node.handlers.set(method, entry);
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
    const redirectHandler: RouteHandler = (ctx: Context) => {
      // Support parameter interpolation in target path
      let targetPath = to;

      // Replace :param placeholders with actual values from ctx.params
      if (ctx.params && targetPath.includes(':')) {
        for (const [key, value] of Object.entries(ctx.params)) {
          targetPath = targetPath.replace(`:${key}`, value);
        }
      }

      ctx.status = status;
      ctx.set('Location', targetPath);
      ctx.body = '';
    };

    // Register for all common methods that might be redirected
    this.addRoute('GET', from, [redirectHandler]);
    this.addRoute('HEAD', from, [redirectHandler]);

    return this;
  }

  // ===========================================================================
  // Router Composition
  // ===========================================================================

  use(pathOrMiddleware: string | Middleware | Router, routerOrUndefined?: Router): this {
    if (typeof pathOrMiddleware === 'function') {
      // Middleware function
      this.routerMiddleware.push(pathOrMiddleware);
    } else if (typeof pathOrMiddleware === 'string' && routerOrUndefined) {
      // Mount sub-router at path
      this.mountRouter(pathOrMiddleware, routerOrUndefined);
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
   */
  private mountRouter(prefix: string, router: Router): void {
    // Copy all routes from sub-router with prefix
    this.copyRoutes(router.root, prefix, []);
  }

  /**
   * Recursively copy routes from another router
   */
  private copyRoutes(node: RadixNode, prefix: string, segments: string[]): void {
    // Copy handlers at this node
    for (const [method, entry] of node.handlers) {
      const path = prefix + '/' + segments.join('/');
      this.addRoute(method, path || '/', [entry.handler], entry.middleware);
    }

    // Copy static children
    for (const [, child] of node.children) {
      this.copyRoutes(child, prefix, [...segments, child.segment]);
    }

    // Copy param child
    if (node.paramChild) {
      this.copyRoutes(node.paramChild, prefix, [...segments, node.paramChild.segment]);
    }

    // Copy wildcard child
    if (node.wildcardChild) {
      this.copyRoutes(node.wildcardChild, prefix, [...segments, '*']);
    }
  }

  // ===========================================================================
  // Route Matching
  // ===========================================================================

  /**
   * Match a route and return handler + params
   */
  match(method: HttpMethod, path: string): RouteMatch | null {
    let normalized = this.opts.caseSensitive ? path : path.toLowerCase();

    // Normalize double slashes
    normalized = normalized.replace(/\/+/g, '/');

    // For strict mode, keep trailing slash; otherwise remove it
    let cleanPath = normalized;
    if (!this.opts.strict && cleanPath.length > 1 && cleanPath.endsWith('/')) {
      cleanPath = cleanPath.slice(0, -1);
    }

    const segments = cleanPath.split('/').filter(Boolean);
    const params: Record<string, string> = {};

    const result = this.matchNode(this.root, segments, 0, params, method);
    if (!result) return null;

    return {
      handler: result.handler,
      params,
      middleware: [...this.routerMiddleware, ...result.middleware],
    };
  }

  /**
   * Recursive node matching
   */
  private matchNode(
    node: RadixNode,
    segments: string[],
    index: number,
    params: Record<string, string>,
    method: HttpMethod
  ): HandlerEntry | null {
    // Reached end of path
    if (index === segments.length) {
      return node.handlers.get(method) ?? null;
    }

    const segment = segments[index];
    if (segment === undefined) return null;

    // Try static match first (most specific)
    const staticChild = node.children.get(this.opts.caseSensitive ? segment : segment.toLowerCase());
    if (staticChild) {
      const result = this.matchNode(staticChild, segments, index + 1, params, method);
      if (result) return result;
    }

    // Try parameter match
    if (node.paramChild) {
      const paramName = node.paramChild.paramName!;
      params[paramName] = segment;
      const result = this.matchNode(node.paramChild, segments, index + 1, params, method);
      if (result) return result;
      delete params[paramName]; // Backtrack
    }

    // Try wildcard match (catches remaining path)
    if (node.wildcardChild) {
      params['*'] = segments.slice(index).join('/');
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
    return async (ctx: Context, next?: () => Promise<void>): Promise<void> => {
      const match = this.match(ctx.method as HttpMethod, ctx.path);

      if (!match) {
        // No route matched, call next middleware
        if (next) await next();
        return;
      }

      // Set params on context
      ctx.params = match.params;

      // Build middleware chain: router middleware + route middleware + handler
      const chain: Middleware[] = [...match.middleware];

      // Execute middleware chain, then handler
      let index = 0;

      const dispatch = async (): Promise<void> => {
        if (index < chain.length) {
          const mw = chain[index++];
          if (mw) {
            // Wire up ctx.next() if the context supports it
            if (typeof (ctx as any).setNext === 'function') {
              (ctx as any).setNext(dispatch);
            }
            await mw(ctx, dispatch);
          } else {
            await dispatch();
          }
        } else {
          // Finally call the handler
          // Wire up ctx.next() to a no-op for the final handler
          if (typeof (ctx as any).setNext === 'function') {
            (ctx as any).setNext(async () => {});
          }
          await match.handler(ctx, async () => {});
        }
      };

      await dispatch();
    };
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

      // Check what methods are allowed for this path
      const allowed: HttpMethod[] = [];

      for (const method of HTTP_METHODS) {
        if (this.match(method, ctx.path)) {
          allowed.push(method);
        }
      }

      if (allowed.length === 0) return;

      // If OPTIONS request, respond with allowed methods
      if (ctx.method === 'OPTIONS') {
        ctx.status = 200;
        ctx.set('Allow', allowed.join(', '));
        ctx.body = '';
        return;
      }

      // Otherwise, return 405 Method Not Allowed
      ctx.status = 405;
      ctx.set('Allow', allowed.join(', '));
    };
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
        for (const [key, value] of Object.entries(ctx.params)) {
          targetPath = targetPath.replace(`:${key}`, value);
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
    const nestedRouter = new GroupRouter(
      this.parent,
      this.fullPath(prefix),
      [...this.middleware, ...nestedMiddleware]
    );

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

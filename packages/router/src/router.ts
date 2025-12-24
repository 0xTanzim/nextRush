/**
 * @nextrush/router - Router Implementation
 *
 * High-performance router using radix tree for route matching.
 * Supports parameters, wildcards, and method-based routing.
 *
 * @packageDocumentation
 */

import type {
  Context,
  HttpMethod,
  Middleware,
  RouteHandler,
  RouteMatch,
  RouterOptions,
} from '@nextrush/types';
import {
  createNode,
  NodeType,
  parseSegments,
  type HandlerEntry,
  type RadixNode,
} from './radix-tree';

/**
 * HTTP methods array for iteration
 */
const HTTP_METHODS: HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'HEAD',
  'OPTIONS',
];

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
   * Mount a sub-router
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
            await mw(ctx, dispatch);
          } else {
            await dispatch();
          }
        } else {
          // Finally call the handler
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

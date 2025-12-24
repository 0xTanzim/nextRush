/**
 * Optimized Radix Tree Router for NextRush v2
 *
 * High-performance router with O(k) lookup performance
 * where k is path length, not route count.
 *
 * @packageDocumentation
 */

import { ROUTER_CONSTANTS } from '@/core/constants';
import type {
  Middleware,
  RouteConfig,
  RouteHandler,
  Router as RouterInterface,
} from '@/types/context';
import { ParamPool } from './param-pool';
import { PathSplitter } from './path-splitter';
import { RouteCache } from './route-cache';
import { RouteTree } from './route-tree';
import { StaticRouteMap } from './static-routes';
import type {
  OptimizedRouteMatch,
  RouteData,
  RouterStats
} from './types';

/**
 * Optimized Router class with performance improvements
 *
 * Uses a radix tree for O(k) route matching with:
 * - Static route fast path (O(1) for common routes)
 * - Parameter object pooling for zero-allocation matching
 * - LRU cache for frequently accessed routes
 *
 * @example
 * ```typescript
 * const router = new OptimizedRouter('/api');
 *
 * router.get('/users', async (ctx) => {
 *   ctx.res.json({ users: [] });
 * });
 *
 * router.get('/users/:id', async (ctx) => {
 *   ctx.res.json({ id: ctx.params.id });
 * });
 * ```
 */
export class OptimizedRouter implements RouterInterface {
  private tree: RouteTree;
  private middleware: Middleware[] = [];
  private prefix: string;
  private cache: RouteCache;
  private paramPool: ParamPool;
  private staticRoutes: StaticRouteMap;

  constructor(
    prefix: string = '',
    cacheSize: number = ROUTER_CONSTANTS.DEFAULT_CACHE_SIZE
  ) {
    this.prefix = prefix;
    this.tree = new RouteTree();
    this.cache = new RouteCache(cacheSize);
    this.paramPool = new ParamPool();
    this.staticRoutes = new StaticRouteMap();
  }

  /**
   * Register a GET route
   */
  public get(path: string, handler: RouteHandler | RouteConfig): OptimizedRouter {
    this.registerRoute('GET', path, handler);
    return this;
  }

  /**
   * Register a POST route
   */
  public post(path: string, handler: RouteHandler | RouteConfig): OptimizedRouter {
    this.registerRoute('POST', path, handler);
    return this;
  }

  /**
   * Register a PUT route
   */
  public put(path: string, handler: RouteHandler | RouteConfig): OptimizedRouter {
    this.registerRoute('PUT', path, handler);
    return this;
  }

  /**
   * Register a DELETE route
   */
  public delete(path: string, handler: RouteHandler | RouteConfig): OptimizedRouter {
    this.registerRoute('DELETE', path, handler);
    return this;
  }

  /**
   * Register a PATCH route
   */
  public patch(path: string, handler: RouteHandler | RouteConfig): OptimizedRouter {
    this.registerRoute('PATCH', path, handler);
    return this;
  }

  /**
   * Use middleware or mount sub-router
   */
  public use(
    middlewareOrPrefix: string | Middleware,
    router?: RouterInterface
  ): OptimizedRouter {
    if (typeof middlewareOrPrefix === 'string') {
      if (router) {
        const subRouter = router as OptimizedRouter;
        const subRoutes = subRouter.getRoutes();

        for (const [routeKey, routeData] of subRoutes) {
          const colonIndex = routeKey.indexOf(':');
          if (colonIndex !== -1) {
            const method = routeKey.substring(0, colonIndex);
            const path = routeKey.substring(colonIndex + 1);
            if (method && path) {
              const fullPath = `${middlewareOrPrefix}${path}`;
              this.registerRoute(method, fullPath, routeData);
            }
          }
        }
      }
    } else {
      this.middleware.push(middlewareOrPrefix);
    }

    return this;
  }

  /**
   * Get all registered routes
   */
  public getRoutes(): Map<string, RouteData> {
    return this.tree.collectRoutes();
  }

  /**
   * Get router middleware
   */
  public getMiddleware(): Middleware[] {
    return [...this.middleware];
  }

  /**
   * Inject compiled handler for a route
   */
  public setCompiledHandler(
    method: string,
    pattern: string,
    compiledExecute: (ctx: unknown) => Promise<void>
  ): void {
    // Update in static routes if exists
    const staticRoute = this.staticRoutes.get(method, pattern);
    if (staticRoute) {
      staticRoute.compiled = compiledExecute;
      return;
    }

    // Update in tree
    this.tree.setCompiledHandler(method, pattern, compiledExecute);
  }

  /**
   * Get cache and performance statistics
   */
  public getCacheStats(): RouterStats {
    return {
      cache: this.cache.getStats(),
      pool: this.paramPool.getStats(),
      performance: {
        totalRoutes: this.tree.countRoutes(),
        pathCacheSize: PathSplitter.getCacheSize(),
      },
    };
  }

  /**
   * Clear the route cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Find a route match
   */
  public find(method: string, path: string): OptimizedRouteMatch | null {
    // Check cache first
    const cacheKey = `${method}:${path}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    // Try to find route
    const result = this.findInternal(method, path);
    if (result) {
      this.cache.set(cacheKey, result);
      return result;
    }

    // Try trailing slash alternative
    if (path.length > 1) {
      const altPath = path.endsWith('/') ? path.slice(0, -1) : `${path}/`;
      const altResult = this.findInternal(method, altPath);
      if (altResult) {
        this.cache.set(cacheKey, altResult);
        return altResult;
      }
    }

    this.cache.set(cacheKey, null);
    return null;
  }

  /**
   * Internal route finding logic
   */
  private findInternal(method: string, path: string): OptimizedRouteMatch | null {
    // Fast path: static routes
    const staticRoute = this.staticRoutes.get(method, path);
    if (staticRoute) {
      return staticRoute;
    }

    // Tree traversal
    return this.tree.find(method, path, () => this.paramPool.acquire());
  }

  /**
   * Register a route
   */
  private registerRoute(
    method: string,
    path: string,
    handler: RouteHandler | RouteConfig | RouteData
  ): void {
    const fullPath = this.prefix ? `${this.prefix}${path}` : path;

    // Handle RouteData directly (from sub-router)
    if (this.isRouteData(handler)) {
      this.tree.register(method, fullPath, handler.handler, handler.middleware);

      if (StaticRouteMap.isStaticPath(fullPath)) {
        this.staticRoutes.set(method, fullPath, {
          handler: handler.handler,
          middleware: handler.middleware,
          params: {},
          path: fullPath,
        });
      }
      return;
    }

    // Extract handler and middleware
    let actualHandler: RouteHandler;
    let routeMiddleware: Middleware[] = [];

    if (typeof handler === 'function') {
      actualHandler = handler;
    } else {
      actualHandler = handler.handler;
      if (handler.middleware) {
        routeMiddleware = Array.isArray(handler.middleware)
          ? handler.middleware
          : [handler.middleware];
      }
    }

    // Register in tree
    this.tree.register(method, fullPath, actualHandler, routeMiddleware);

    // Add to static route map if no params/wildcards
    if (StaticRouteMap.isStaticPath(fullPath)) {
      this.staticRoutes.set(method, fullPath, {
        handler: actualHandler,
        middleware: routeMiddleware,
        params: {},
        path: fullPath,
      });
    }
  }

  /**
   * Type guard for RouteData
   */
  private isRouteData(obj: unknown): obj is RouteData {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'handler' in obj &&
      'middleware' in obj &&
      typeof (obj as RouteData).handler === 'function' &&
      Array.isArray((obj as RouteData).middleware)
    );
  }
}

/**
 * Create a new optimized router instance
 *
 * @param prefix - Optional route prefix
 * @param cacheSize - Optional cache size (default: 1000)
 * @returns OptimizedRouter instance
 *
 * @example
 * ```typescript
 * const userRouter = createOptimizedRouter('/users', 2000);
 *
 * userRouter.get('/profile', async (ctx) => {
 *   ctx.res.json({ user: 'profile' });
 * });
 * ```
 */
export function createOptimizedRouter(
  prefix: string = '',
  cacheSize: number = ROUTER_CONSTANTS.DEFAULT_CACHE_SIZE
): OptimizedRouter {
  return new OptimizedRouter(prefix, cacheSize);
}

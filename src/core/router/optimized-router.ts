/**
 * Optimized Radix Tree Router for NextRush v2
 *
 * High-performance router with O(k) lookup performance
 * where k is path length, not route count.
 *
 * Performance optimizations:
 * - Zero-copy path splitting
 * - LRU cache for frequent paths
 * - Iterative traversal (no recursion)
 * - Pre-allocated parameter objects
 * - Optimized parameter matching
 *
 * @packageDocumentation
 */

import type {
  Middleware,
  RouteConfig,
  RouteData,
  RouteHandler,
  Router as RouterInterface,
} from '@/types/context';

/**
 * Optimized radix tree node
 */
interface OptimizedRadixNode {
  path: string;
  handlers: Map<string, RouteData>;
  children: Map<string, OptimizedRadixNode>;
  paramChild?: OptimizedRadixNode; // Single parameter child for O(1) access
  isParam: boolean;
  paramName?: string;
  paramIndex?: number; // Pre-computed parameter index
  wildcardChild?: OptimizedRadixNode;
  regex?: RegExp; // For regex patterns
}

/**
 * Route match result with pre-allocated parameter object
 */
interface OptimizedRouteMatch {
  handler: RouteHandler;
  middleware: Middleware[];
  params: Record<string, string>;
  path: string;
}

/**
 * High-performance cache using Map for O(1) operations
 * Simplified design eliminates LRU overhead for better performance
 */
class RouteCache {
  private cache = new Map<string, OptimizedRouteMatch | null>();
  private maxSize: number;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: string): OptimizedRouteMatch | null | undefined {
    const result = this.cache.get(key);
    if (result !== undefined) {
      this.cacheHits++;
      return result;
    }
    this.cacheMisses++;
    return undefined;
  }

  set(key: string, value: OptimizedRouteMatch | null): void {
    // Simple size-based eviction - clear half when full for better performance
    if (this.cache.size >= this.maxSize) {
      const entries = Array.from(this.cache.entries());
      this.cache.clear();
      // Keep the second half (more recently used entries)
      const keepFrom = Math.floor(entries.length / 2);
      for (let i = keepFrom; i < entries.length; i++) {
        const entry = entries[i];
        if (entry) {
          this.cache.set(entry[0], entry[1]);
        }
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  getSize(): number {
    return this.cache.size;
  }

  getStats(): { size: number; hitRate: number; hits: number; misses: number } {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total === 0 ? 0 : this.cacheHits / total;
    return {
      size: this.getSize(),
      hitRate,
      hits: this.cacheHits,
      misses: this.cacheMisses,
    };
  }
}

/**
 * Ultra-fast path splitter with optimized splitting algorithm
 */
class PathSplitter {
  private static readonly CACHE_SIZE = 500; // Increased cache size
  private static pathCache = new Map<string, string[]>();

  // Pre-compiled common patterns for faster detection
  private static readonly PARAM_CHAR_CODE = 58; // ':'
  private static readonly SLASH_CHAR_CODE = 47; // '/'

  /**
   * Get cache size for statistics
   */
  static getCacheSize(): number {
    return this.pathCache.size;
  }

  static split(path: string): string[] {
    if (path === '/' || path === '') return [];

    // Check cache first for frequently used paths
    const cached = this.pathCache.get(path);
    if (cached) {
      return cached;
    }

    const parts: string[] = [];
    let start = path.charCodeAt(0) === this.SLASH_CHAR_CODE ? 1 : 0;

    // Ultra-optimized splitting using single pass with charCodeAt
    for (let i = start; i <= path.length; i++) {
      const charCode =
        i < path.length ? path.charCodeAt(i) : this.SLASH_CHAR_CODE;

      if (charCode === this.SLASH_CHAR_CODE || i === path.length) {
        if (i > start) {
          parts.push(path.substring(start, i));
        }
        start = i + 1;
      }
    }

    // Cache result for future lookups
    if (this.pathCache.size < this.CACHE_SIZE) {
      this.pathCache.set(path, parts);
    }

    return parts;
  }

  static clearCache(): void {
    this.pathCache.clear();
  }

  /**
   * Ultra-fast parameter detection
   */
  static isParameterized(segment: string): boolean {
    return segment.length > 0 && segment.charCodeAt(0) === this.PARAM_CHAR_CODE;
  }

  /**
   * Extract parameter name from path segment (optimized)
   */
  static extractParamName(segment: string): string | null {
    return this.isParameterized(segment) ? segment.substring(1) : null;
  }
}

/**
 * Optimized Router class with performance improvements
 */
export class OptimizedRouter implements RouterInterface {
  private root: OptimizedRadixNode;
  private middleware: Middleware[] = [];
  private prefix: string = '';
  private cache: RouteCache;
  private paramPool: Record<string, string>[] = [];
  private maxPoolSize = 200; // Increased pool size for better performance
  private poolHits = 0;
  private poolMisses = 0;

  constructor(prefix: string = '', cacheSize: number = 1000) {
    this.prefix = prefix;
    this.cache = new RouteCache(cacheSize);
    this.root = {
      path: '',
      handlers: new Map(),
      children: new Map(),
      isParam: false,
    };

    // Pre-allocate parameter objects with better sizing
    for (let i = 0; i < 200; i++) {
      this.paramPool.push({});
    }
  }

  /**
   * Optimized parameter object management
   */
  private getParamObject(): Record<string, string> {
    if (this.paramPool.length > 0) {
      this.poolHits++;
      const params = this.paramPool.pop()!;
      // Efficiently clear object properties
      for (const key in params) {
        if (Object.prototype.hasOwnProperty.call(params, key)) {
          delete params[key];
        }
      }
      return params;
    }

    this.poolMisses++;
    return {}; // Create new object if pool is empty
  }

  /**
   * Get pool statistics for monitoring
   */
  private getPoolStats() {
    const total = this.poolHits + this.poolMisses;
    return {
      poolSize: this.paramPool.length,
      maxSize: this.maxPoolSize,
      hits: this.poolHits,
      misses: this.poolMisses,
      hitRate: total === 0 ? 0 : this.poolHits / total,
    };
  }

  /**
   * Register a GET route
   */
  public get(
    path: string,
    handler: RouteHandler | RouteConfig
  ): OptimizedRouter {
    this.registerRoute('GET', path, handler);
    return this;
  }

  /**
   * Register a POST route
   */
  public post(
    path: string,
    handler: RouteHandler | RouteConfig
  ): OptimizedRouter {
    this.registerRoute('POST', path, handler);
    return this;
  }

  /**
   * Register a PUT route
   */
  public put(
    path: string,
    handler: RouteHandler | RouteConfig
  ): OptimizedRouter {
    this.registerRoute('PUT', path, handler);
    return this;
  }

  /**
   * Register a DELETE route
   */
  public delete(
    path: string,
    handler: RouteHandler | RouteConfig
  ): OptimizedRouter {
    this.registerRoute('DELETE', path, handler);
    return this;
  }

  /**
   * Register a PATCH route
   */
  public patch(
    path: string,
    handler: RouteHandler | RouteConfig
  ): OptimizedRouter {
    this.registerRoute('PATCH', path, handler);
    return this;
  }

  /**
   * Use middleware or create sub-router
   */
  public use(
    middlewareOrPrefix: string | Middleware,
    router?: RouterInterface
  ): OptimizedRouter {
    if (typeof middlewareOrPrefix === 'string') {
      // Create sub-router
      if (router) {
        const subRouter = router as OptimizedRouter;
        const subRoutes = subRouter.getRoutes();

        // Add sub-router routes with prefix
        for (const [routeKey, handler] of subRoutes) {
          const colonIndex = routeKey.indexOf(':');
          if (colonIndex !== -1) {
            const method = routeKey.substring(0, colonIndex);
            const path = routeKey.substring(colonIndex + 1);
            if (method && path) {
              const fullPath = `${middlewareOrPrefix}${path}`;
              this.registerRoute(method, fullPath, handler);
            }
          }
        }
      }
    } else {
      // Add middleware
      this.middleware.push(middlewareOrPrefix);
    }

    return this;
  }

  /**
   * Get all registered routes for sub-router integration
   */
  public getRoutes(): Map<string, RouteData> {
    const routes = new Map<string, RouteData>();
    this.collectRoutesIterative(this.root, '', routes);
    return routes;
  }

  /**
   * Get router middleware
   */
  public getMiddleware(): Middleware[] {
    return [...this.middleware];
  }

  /**
   * Get comprehensive cache and performance statistics
   */
  public getCacheStats() {
    const cacheStats = this.cache.getStats();
    const poolStats = this.getPoolStats();

    return {
      cache: cacheStats,
      pool: poolStats,
      performance: {
        totalRoutes: this.getTotalRoutes(),
        pathCacheSize: PathSplitter.getCacheSize(),
      },
    };
  }

  /**
   * Get total number of registered routes
   */
  private getTotalRoutes(): number {
    let count = 0;

    function countRoutes(node: OptimizedRadixNode): void {
      count += node.handlers.size;
      for (const child of node.children.values()) {
        countRoutes(child);
      }
      if (node.paramChild) countRoutes(node.paramChild);
      if (node.wildcardChild) countRoutes(node.wildcardChild);
    }

    countRoutes(this.root);
    return count;
  }

  /**
   * Clear the route cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Ultra-fast route finder with aggressive optimizations
   */
  public find(method: string, path: string): OptimizedRouteMatch | null {
    // Ultra-fast cache check
    const cacheKey = `${method}:${path}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    // Fast path: direct match without alternative paths
    const result = this.findInternalOptimized(method, path);

    // Cache and return immediately if found
    if (result) {
      this.cache.set(cacheKey, result);
      return result;
    }

    // Slow path: only try alternatives for non-root paths
    if (path.length > 1) {
      const alternativePath = path.endsWith('/')
        ? path.slice(0, -1)
        : `${path}/`;
      const alternativeResult = this.findInternalOptimized(
        method,
        alternativePath
      );

      if (alternativeResult) {
        this.cache.set(cacheKey, alternativeResult);
        return alternativeResult;
      }
    }

    // Cache null result and return
    this.cache.set(cacheKey, null);
    return null;
  }

  /**
   * Hyper-optimized internal finder with minimal allocations
   */
  private findInternalOptimized(
    method: string,
    path: string
  ): OptimizedRouteMatch | null {
    // Fast root path check
    if (path === '/' || path === '') {
      const routeData = this.root.handlers.get(method);
      return routeData
        ? {
            handler: routeData.handler,
            middleware: routeData.middleware,
            params: {},
            path,
          }
        : null;
    }

    // Ultra-fast path splitting
    const pathParts = PathSplitter.split(path);
    if (pathParts.length === 0) {
      const routeData = this.root.handlers.get(method);
      return routeData
        ? {
            handler: routeData.handler,
            middleware: routeData.middleware,
            params: {},
            path,
          }
        : null;
    }

    let currentNode = this.root;
    const params = this.getParamObject();

    // Optimized single-pass traversal
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      if (!part) continue;

      // Try exact match first (hot path)
      const exactChild = currentNode.children.get(part);
      if (exactChild) {
        currentNode = exactChild;
        continue;
      }

      // Parameter match (warm path)
      const paramChild = currentNode.paramChild;
      if (paramChild?.paramName) {
        params[paramChild.paramName] = part;
        currentNode = paramChild;
        continue;
      }

      // Wildcard match (cold path)
      const wildcardChild = currentNode.wildcardChild;
      if (wildcardChild) {
        params['*'] = pathParts.slice(i).join('/');
        currentNode = wildcardChild;
        break;
      }

      // No match - early exit
      return null;
    }

    // Final handler check
    const routeData = currentNode.handlers.get(method);
    return routeData
      ? {
          handler: routeData.handler,
          middleware: routeData.middleware,
          params,
          path,
        }
      : null;
  }

  /**
   * Optimized route registration with O(k) insertion
   */
  private registerRoute(
    method: string,
    path: string,
    handler: RouteHandler | RouteConfig
  ): void {
    const fullPath = this.prefix ? `${this.prefix}${path}` : path;
    const pathParts = PathSplitter.split(fullPath);
    let currentNode = this.root;

    // Extract handler and middleware efficiently
    let actualHandler: RouteHandler;
    let routeMiddleware: Middleware[] = [];

    if (typeof handler === 'function') {
      actualHandler = handler;
      console.log(
        `📝 Registering function handler for ${method} ${fullPath} - No middleware`
      );
    } else {
      actualHandler = handler.handler;
      if (handler.middleware) {
        routeMiddleware = Array.isArray(handler.middleware)
          ? handler.middleware
          : [handler.middleware];
        console.log(
          `📝 Registering RouteConfig for ${method} ${fullPath} - Found ${routeMiddleware.length} middleware`
        );
      } else {
        console.log(
          `📝 Registering RouteConfig for ${method} ${fullPath} - No middleware in config`
        );
      }
    }

    // Create route data with handler and middleware
    const routeData: RouteData = {
      handler: actualHandler,
      middleware: routeMiddleware,
    };

    // Handle root path case
    if (pathParts.length === 0) {
      currentNode.handlers.set(method, routeData);
      return;
    }

    // Build tree with optimized node creation
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      if (!part) continue; // Skip empty parts

      if (PathSplitter.isParameterized(part)) {
        // Parameter node
        const paramName = PathSplitter.extractParamName(part);

        if (!currentNode.paramChild && paramName) {
          currentNode.paramChild = {
            path: part,
            handlers: new Map(),
            children: new Map(),
            isParam: true,
            paramName,
            paramIndex: i,
          };
        }
        if (currentNode.paramChild) {
          currentNode = currentNode.paramChild;
        }
      } else if (part === '*') {
        // Wildcard node
        if (!currentNode.wildcardChild) {
          currentNode.wildcardChild = {
            path: part,
            handlers: new Map(),
            children: new Map(),
            isParam: false,
          };
        }
        currentNode = currentNode.wildcardChild;
      } else {
        // Static node - optimized creation
        let childNode = currentNode.children.get(part);
        if (!childNode) {
          childNode = {
            path: part,
            handlers: new Map(),
            children: new Map(),
            isParam: false,
          };
          currentNode.children.set(part, childNode);
        }
        currentNode = childNode;
      }
    }

    // Set handler at final node
    currentNode.handlers.set(method, routeData);
  }

  /**
   * Iteratively collect all routes from the tree (no recursion)
   */
  private collectRoutesIterative(
    startNode: OptimizedRadixNode,
    startPath: string,
    routes: Map<string, RouteData>
  ): void {
    const stack: Array<{ node: OptimizedRadixNode; path: string }> = [
      { node: startNode, path: startPath },
    ];

    while (stack.length > 0) {
      const { node, path } = stack.pop()!;

      // Add handlers at current node
      for (const [method, routeData] of node.handlers) {
        const routeKey = `${method}:${path || '/'}`;
        routes.set(routeKey, routeData);
      }

      // Add children to stack
      for (const childNode of node.children.values()) {
        const childPath = `${path}/${childNode.path}`;
        stack.push({ node: childNode, path: childPath });
      }

      // Add parameter child to stack
      if (node.paramChild) {
        const childPath = `${path}/${node.paramChild.path}`;
        stack.push({ node: node.paramChild, path: childPath });
      }

      // Add wildcard child to stack
      if (node.wildcardChild) {
        const childPath = `${path}/${node.wildcardChild.path}`;
        stack.push({ node: node.wildcardChild, path: childPath });
      }
    }
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
 * import { createOptimizedRouter } from 'nextrush-v2';
 *
 * const userRouter = createOptimizedRouter('/users', 2000);
 *
 * userRouter.get('/profile', async (ctx) => {
 *   ctx.res.json({ user: 'profile' });
 * });
 *
 * app.use(userRouter);
 * ```
 */
export function createOptimizedRouter(
  prefix: string = '',
  cacheSize: number = 1000
): OptimizedRouter {
  return new OptimizedRouter(prefix, cacheSize);
}

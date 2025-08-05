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
  RouteHandler,
  Router as RouterInterface,
} from '@/types/context';

/**
 * Optimized radix tree node
 */
interface OptimizedRadixNode {
  path: string;
  handlers: Map<string, RouteHandler>;
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
  params: Record<string, string>;
  path: string;
}

/**
 * LRU Cache for route matching
 */
class RouteCache {
  private cache = new Map<string, OptimizedRouteMatch | null>();
  private maxSize: number;
  private accessOrder: string[] = [];
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: string): OptimizedRouteMatch | null | undefined {
    const result = this.cache.get(key);
    if (result !== undefined) {
      this.cacheHits++;
      // Update access order
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      this.accessOrder.push(key);
    } else {
      this.cacheMisses++;
    }
    return result;
  }

  set(key: string, value: OptimizedRouteMatch | null): void {
    if (this.cache.size >= this.maxSize) {
      // Remove least recently used
      const lruKey = this.accessOrder.shift();
      if (lruKey) {
        this.cache.delete(lruKey);
      }
    }
    this.cache.set(key, value);
    this.accessOrder.push(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.length = 0;
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
 * Optimized path splitter with zero allocations
 */
class PathSplitter {
  private static readonly CACHE_SIZE = 100;
  private static pathCache = new Map<string, string[]>();

  static split(path: string): string[] {
    if (path === '/' || path === '') return [];

    // Check cache first for frequently used paths
    if (this.pathCache.has(path)) {
      return this.pathCache.get(path)!;
    }

    const parts: string[] = [];
    let start = path.charCodeAt(0) === 47 ? 1 : 0; // 47 is '/'

    // Optimized splitting using charCodeAt for better performance
    for (let i = start; i < path.length; i++) {
      if (path.charCodeAt(i) === 47) {
        // Found '/'
        if (i > start) {
          parts.push(path.substring(start, i));
        }
        start = i + 1;
      }
    }

    // Add remaining part
    if (start < path.length) {
      parts.push(path.substring(start));
    }

    // Cache result if cache is not full
    if (this.pathCache.size < this.CACHE_SIZE) {
      this.pathCache.set(path, parts);
    }

    return parts;
  }

  static clearCache(): void {
    this.pathCache.clear();
  }

  /**
   * Check if path is parameterized
   */
  static isParameterized(path: string): boolean {
    return path.includes(':');
  }

  /**
   * Extract parameter name from path segment
   */
  static extractParamName(segment: string): string | null {
    return segment.startsWith(':') ? segment.slice(1) : null;
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
  private maxPoolSize = 1000;
  // private poolIndex = 0; // Currently unused but kept for future pool rotation
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

    // Pre-allocate parameter objects
    for (let i = 0; i < 100; i++) {
      this.paramPool.push({});
    }
  }

  /**
   * Get a parameter object from the pool (enhanced with metrics)
   */
  private getParamObject(): Record<string, string> {
    if (this.paramPool.length === 0) {
      this.poolMisses++;
      return {}; // Create new object if pool is empty
    }

    this.poolHits++;
    const params = this.paramPool.shift()!;
    // Clear all properties efficiently
    for (const key in params) {
      delete params[key];
    }
    return params;
  }

  // Currently unused but kept for future optimization
  // private releaseParamObject(params: Record<string, string>): void {
  //   if (this.paramPool.length < this.maxPoolSize) {
  //     this.paramPool.push(params);
  //   }
  // }

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
  public getRoutes(): Map<string, RouteHandler> {
    const routes = new Map<string, RouteHandler>();
    this.collectRoutesIterative(this.root, '', routes);
    return routes;
  }

  /**
   * Recursively collect all routes from the tree
   */
  private collectRoutes(
    node: OptimizedRadixNode,
    currentPath: string,
    routes: Map<string, RouteHandler>
  ): void {
    // Add handlers from current node
    for (const [method, handler] of node.handlers) {
      const routeKey = `${method}:${currentPath}`;
      routes.set(routeKey, handler);
    }

    // Recursively collect from children
    for (const [path, child] of node.children) {
      const childPath = currentPath ? `${currentPath}/${path}` : `/${path}`;
      this.collectRoutes(child, childPath, routes);
    }

    // Collect from parameter child
    if (node.paramChild) {
      const paramName = node.paramChild.paramName;
      if (paramName) {
        const paramPath = currentPath
          ? `${currentPath}/:${paramName}`
          : `/:${paramName}`;
        this.collectRoutes(node.paramChild, paramPath, routes);
      }
    }
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
        pathCacheSize:
          (PathSplitter as { pathCache?: Map<string, string[]> }).pathCache
            ?.size || 0,
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
   * Find route with O(k) lookup and caching
   */
  public find(method: string, path: string): OptimizedRouteMatch | null {
    // Check cache first
    const cacheKey = `${method}:${path}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    // Try the main matching logic
    const result = this.findInternal(method, path);
    if (result) {
      this.cache.set(cacheKey, result);
      return result;
    }

    // Handle trailing slash normalization - try the opposite
    let alternativePath: string;
    if (path.endsWith('/') && path !== '/') {
      alternativePath = path.slice(0, -1); // Remove trailing slash
    } else {
      alternativePath = `${path}/`; // Add trailing slash
    }

    const alternativeResult = this.findInternal(method, alternativePath);
    if (alternativeResult) {
      this.cache.set(cacheKey, alternativeResult);
      return alternativeResult;
    }

    // No match found
    this.cache.set(cacheKey, null);
    return null;
  }

  /**
   * Internal find method that does the actual tree traversal
   */
  private findInternal(
    method: string,
    path: string
  ): OptimizedRouteMatch | null {
    const pathParts = PathSplitter.split(path);
    const params = this.getParamObject();
    let currentNode = this.root;

    // Handle root path case
    if (pathParts.length === 1 && pathParts[0] === '') {
      const handler = currentNode.handlers.get(method);
      if (!handler) {
        return null;
      }
      return { handler, params, path };
    }

    // Handle empty path case
    if (pathParts.length === 0) {
      const handler = currentNode.handlers.get(method);
      if (!handler) {
        return null;
      }
      return { handler, params, path };
    }

    // Traverse the tree
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];

      // Skip empty parts
      if (!part) continue;

      // Try exact match first
      if (currentNode.children.has(part)) {
        const childNode = currentNode.children.get(part);
        if (childNode) {
          currentNode = childNode;
          continue;
        }
      }

      // Try parameter match
      if (currentNode.paramChild) {
        const paramName = currentNode.paramChild.paramName;
        if (paramName) {
          params[paramName] = part;
        }
        currentNode = currentNode.paramChild;
        continue;
      }

      // Try wildcard match
      if (currentNode.wildcardChild) {
        const remaining = pathParts.slice(i).join('/');
        params['*'] = remaining;
        currentNode = currentNode.wildcardChild;
        break; // Wildcard consumes rest
      }

      // Try regex match
      if (currentNode.regex && currentNode.regex.test(part)) {
        // Assuming a single child or a way to handle regex match
        // For simplicity, we'll just move to the next part if regex matches
        currentNode = currentNode.children.get(part) || currentNode; // Assuming regex matches a static part
        continue;
      }

      // No match found
      return null;
    }

    // Check if we have a handler for this method
    const handler = currentNode.handlers.get(method);
    if (!handler) {
      return null;
    }

    return { handler, params, path };
  }

  /**
   * Register a route with O(k) insertion
   */
  private registerRoute(
    method: string,
    path: string,
    handler: RouteHandler | RouteConfig
  ): void {
    const fullPath = this.prefix ? `${this.prefix}${path}` : path;
    const pathParts = PathSplitter.split(fullPath);
    let currentNode = this.root;

    // Extract the actual handler and middleware
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
        this.middleware.push(...routeMiddleware);
      }
    }

    // Handle root path case
    if (pathParts.length === 1 && pathParts[0] === '') {
      currentNode.handlers.set(method, actualHandler);
      return;
    }

    // Handle empty path case
    if (pathParts.length === 0) {
      currentNode.handlers.set(method, actualHandler);
      return;
    }

    // Build the tree
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];

      if (!part) continue; // Skip empty parts

      const isParam = part.startsWith(':');

      if (isParam) {
        // Parameter node
        const paramName = part.slice(1);

        if (!currentNode.paramChild) {
          currentNode.paramChild = {
            path: part,
            handlers: new Map(),
            children: new Map(),
            isParam: true,
            paramName,
            paramIndex: i,
          };
        }

        currentNode = currentNode.paramChild;
      } else if (part === '*') {
        // Wildcard
        if (!currentNode.wildcardChild) {
          currentNode.wildcardChild = {
            path: part,
            handlers: new Map(),
            children: new Map(),
            isParam: false,
          };
        }
        currentNode = currentNode.wildcardChild;
      } else if (part.startsWith('(') && part.endsWith(')')) {
        // Regex pattern
        const regexStr = part.slice(1, -1);
        currentNode.regex = new RegExp(regexStr);
        // Handle as static for tree, but match with regex in find
      } else {
        // Static node
        if (!currentNode.children.has(part)) {
          currentNode.children.set(part, {
            path: part,
            handlers: new Map(),
            children: new Map(),
            isParam: false,
          });
        }

        const childNode = currentNode.children.get(part);
        if (childNode) {
          currentNode = childNode;
        }
      }
    }

    // Add handler to the final node
    currentNode.handlers.set(method, actualHandler);
  }

  /**
   * Iteratively collect all routes from the tree (no recursion)
   */
  private collectRoutesIterative(
    startNode: OptimizedRadixNode,
    startPath: string,
    routes: Map<string, RouteHandler>
  ): void {
    const stack: Array<{ node: OptimizedRadixNode; path: string }> = [
      { node: startNode, path: startPath },
    ];

    while (stack.length > 0) {
      const { node, path } = stack.pop()!;

      // Add handlers at current node
      for (const [method, handler] of node.handlers) {
        const routeKey = `${method}:${path || '/'}`;
        routes.set(routeKey, handler);
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

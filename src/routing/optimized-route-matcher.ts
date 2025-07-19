/**
 * 🚀 Optimized Route Matcher - NextRush Framework
 *
 * High-performance route matching using radix tree/trie data structure
 * Provides O(log n) route lookup instead of O(n) linear search
 *
 * Performance Improvements:
 * - Radix tree for fast prefix matching
 * - Static route prioritization
 * - Compiled regex caching
 * - Method-based route grouping
 * - Path parameter extraction optimization
 */

import { Path, Route, RouteMatch } from '../types/routing';

interface RouteNode {
  path: string;
  isEndpoint: boolean;
  route?: Route;
  children: Map<string, RouteNode>;
  paramChildren: RouteNode[];
  wildcardChild?: RouteNode;
  regex?: RegExp;
  paramNames?: string[];
  isStatic: boolean;
}

interface CompiledRoute {
  route: Route;
  regex: RegExp;
  paramNames: string[];
  isStatic: boolean;
  priority: number;
}

export interface OptimizedRouteMatcherOptions {
  caseSensitive?: boolean;
  strict?: boolean;
  cacheSize?: number;
  enablePrefixOptimization?: boolean;
}

/**
 * High-performance route matcher using radix tree and optimization techniques
 */
export class OptimizedRouteMatcher {
  private options: OptimizedRouteMatcherOptions;
  private staticRoutes = new Map<string, Route>(); // Exact string matches (fastest)
  private dynamicRoutes: CompiledRoute[] = []; // Routes with parameters
  private routeCache = new Map<string, RouteMatch | null>(); // LRU cache
  private maxCacheSize: number;
  private radixRoot: RouteNode;

  constructor(options: OptimizedRouteMatcherOptions = {}) {
    this.options = {
      caseSensitive: false,
      strict: false,
      cacheSize: 5000, // 🚀 Increased cache size for better performance
      enablePrefixOptimization: true,
      ...options,
    };

    this.maxCacheSize = this.options.cacheSize!;
    this.radixRoot = this.createNode('', false);
  }

  /**
   * Add a route to the optimized matcher
   */
  addRoute(route: Route): void {
    const normalizedPath = this.normalizePath(route.path);
    const compiledRoute = this.compileRoute(route, normalizedPath);

    if (compiledRoute.isStatic) {
      // Static routes get fastest lookup
      this.staticRoutes.set(normalizedPath, route);
    } else {
      // Dynamic routes use radix tree
      this.addToRadixTree(route, normalizedPath);
      this.dynamicRoutes.push(compiledRoute);
      // Sort by priority (static segments first, fewer params first)
      this.dynamicRoutes.sort((a, b) => b.priority - a.priority);
    }

    // Clear cache when routes change
    this.routeCache.clear();
  }

  /**
   * Find matching route with optimized lookup
   */
  findMatch(requestPath: string): RouteMatch | null {
    const normalizedPath = this.normalizePath(requestPath);

    // Check cache first
    const cached = this.routeCache.get(normalizedPath);
    if (cached !== undefined) {
      return cached;
    }

    let result: RouteMatch | null = null;

    // 1. Check static routes first (O(1) lookup)
    const staticRoute = this.staticRoutes.get(normalizedPath);
    if (staticRoute) {
      result = { route: staticRoute, params: {} };
    } else {
      // 2. Check radix tree for dynamic routes (O(log n))
      result = this.findInRadixTree(normalizedPath);

      // 3. Fallback to compiled dynamic routes if needed
      if (!result) {
        result = this.findInDynamicRoutes(normalizedPath);
      }
    }

    // Cache the result (with LRU eviction)
    this.cacheResult(normalizedPath, result);

    return result;
  }

  /**
   * Compile a route for optimized matching
   */
  private compileRoute(route: Route, path: string): CompiledRoute {
    const pathStr =
      typeof route.path === 'string' ? route.path : route.path.source;

    // Check if route is static (no parameters or wildcards)
    const isStatic =
      !pathStr.includes(':') &&
      !pathStr.includes('*') &&
      typeof route.path === 'string';

    if (isStatic) {
      return {
        route,
        regex: new RegExp(`^${this.escapeRegex(pathStr)}$`),
        paramNames: [],
        isStatic: true,
        priority: 100, // Highest priority for static routes
      };
    }

    // Compile dynamic route
    const { regex, paramNames } = this.pathToRegex(pathStr);
    const staticSegments = pathStr
      .split('/')
      .filter((seg) => seg && !seg.includes(':') && !seg.includes('*')).length;

    return {
      route,
      regex,
      paramNames,
      isStatic: false,
      priority: staticSegments * 10 - paramNames.length, // Prefer more static segments, fewer params
    };
  }

  /**
   * Convert path pattern to regex with parameter extraction
   */
  private pathToRegex(path: string): { regex: RegExp; paramNames: string[] } {
    const paramNames: string[] = [];

    // Handle string patterns with parameters
    let regexStr = path
      .split('/')
      .map((segment) => {
        if (segment.startsWith(':')) {
          const paramName = segment.slice(1);
          paramNames.push(paramName);
          return '([^/]+)'; // Match any character except /
        }
        if (segment === '*') {
          paramNames.push('0'); // Wildcard parameter
          return '(.*)';
        }
        return this.escapeRegex(segment);
      })
      .join('/');

    // Ensure exact match
    regexStr = `^${regexStr}$`;

    if (!this.options.strict && !regexStr.endsWith('$')) {
      regexStr = regexStr.slice(0, -1) + '/?$';
    }

    return {
      regex: new RegExp(regexStr, this.options.caseSensitive ? '' : 'i'),
      paramNames,
    };
  }

  /**
   * Add route to radix tree for efficient prefix matching
   */
  private addToRadixTree(route: Route, path: string): void {
    const segments = path.split('/').filter((seg) => seg);
    let node = this.radixRoot;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      if (segment.startsWith(':')) {
        // Parameter segment
        const paramName = segment.slice(1);
        let paramNode = node.paramChildren.find(
          (child) => child.path === paramName
        );

        if (!paramNode) {
          paramNode = this.createNode(paramName, false);
          node.paramChildren.push(paramNode);
        }
        node = paramNode;
      } else if (segment === '*') {
        // Wildcard segment
        if (!node.wildcardChild) {
          node.wildcardChild = this.createNode('*', false);
        }
        node = node.wildcardChild;
      } else {
        // Static segment
        if (!node.children.has(segment)) {
          node.children.set(segment, this.createNode(segment, false));
        }
        node = node.children.get(segment)!;
      }
    }

    node.isEndpoint = true;
    node.route = route;
  }

  /**
   * Find route in radix tree
   */
  private findInRadixTree(path: string): RouteMatch | null {
    const segments = path.split('/').filter((seg) => seg);
    return this.searchRadixNode(this.radixRoot, segments, 0, {});
  }

  /**
   * Recursively search radix tree nodes
   */
  private searchRadixNode(
    node: RouteNode,
    segments: string[],
    index: number,
    params: Record<string, string>
  ): RouteMatch | null {
    // If we've consumed all segments, check if this is an endpoint
    if (index >= segments.length) {
      return node.isEndpoint && node.route
        ? { route: node.route, params }
        : null;
    }

    const segment = segments[index];

    // 1. Try static children first (fastest)
    const staticChild = node.children.get(segment);
    if (staticChild) {
      const result = this.searchRadixNode(
        staticChild,
        segments,
        index + 1,
        params
      );
      if (result) return result;
    }

    // 2. Try parameter children
    for (const paramChild of node.paramChildren) {
      const newParams = { ...params, [paramChild.path]: segment };
      const result = this.searchRadixNode(
        paramChild,
        segments,
        index + 1,
        newParams
      );
      if (result) return result;
    }

    // 3. Try wildcard child (matches rest of path)
    if (node.wildcardChild) {
      const remainingPath = segments.slice(index).join('/');
      const newParams = { ...params, '0': remainingPath };

      if (node.wildcardChild.isEndpoint && node.wildcardChild.route) {
        return { route: node.wildcardChild.route, params: newParams };
      }
    }

    return null;
  }

  /**
   * Find route in compiled dynamic routes (fallback)
   */
  private findInDynamicRoutes(path: string): RouteMatch | null {
    for (const compiledRoute of this.dynamicRoutes) {
      const match = compiledRoute.regex.exec(path);
      if (match) {
        const params: Record<string, string> = {};

        // Extract parameters
        for (let i = 0; i < compiledRoute.paramNames.length; i++) {
          const paramName = compiledRoute.paramNames[i];
          const paramValue = match[i + 1];
          if (paramValue !== undefined) {
            params[paramName] = decodeURIComponent(paramValue);
          }
        }

        return { route: compiledRoute.route, params };
      }
    }

    return null;
  }

  /**
   * Create a new radix tree node
   */
  private createNode(path: string, isEndpoint: boolean): RouteNode {
    return {
      path,
      isEndpoint,
      children: new Map(),
      paramChildren: [],
      isStatic: !path.includes(':') && !path.includes('*'),
    };
  }

  /**
   * Cache result with LRU eviction
   */
  private cacheResult(path: string, result: RouteMatch | null): void {
    if (this.routeCache.size >= this.maxCacheSize) {
      // Simple LRU: remove first entry
      const firstKey = this.routeCache.keys().next().value;
      if (firstKey) {
        this.routeCache.delete(firstKey);
      }
    }

    this.routeCache.set(path, result);
  }

  /**
   * Normalize path based on options
   */
  private normalizePath(path: Path): string {
    let pathStr = typeof path === 'string' ? path : path.source;

    if (!this.options.caseSensitive) {
      pathStr = pathStr.toLowerCase();
    }

    if (!this.options.strict && pathStr.length > 1 && pathStr.endsWith('/')) {
      pathStr = pathStr.slice(0, -1);
    }

    return pathStr;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get performance stats
   */
  getStats(): {
    staticRoutes: number;
    dynamicRoutes: number;
    cacheSize: number;
    cacheHitRate: number;
  } {
    return {
      staticRoutes: this.staticRoutes.size,
      dynamicRoutes: this.dynamicRoutes.length,
      cacheSize: this.routeCache.size,
      cacheHitRate: 0, // Would need to track hits/misses for accurate calculation
    };
  }

  /**
   * Clear all routes and cache
   */
  clear(): void {
    this.staticRoutes.clear();
    this.dynamicRoutes.length = 0;
    this.routeCache.clear();
    this.radixRoot = this.createNode('', false);
  }
}

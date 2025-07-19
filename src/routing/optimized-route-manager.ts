/**
 * 🚀 Optimized Route Manager - NextRush F  constructor(options: OptimizedRouteManagerOptions = {}) {
    this.options = {
      maxRoutes: 10000,
      caseSensitive: false,
      strict: false,
      cacheSize: 5000,        // 🚀 Increased cache size for better performance
      enablePrefixOptimization: true,
      enableBatchOperations: true,
      enableMetrics: false,   // 🚀 Disabled by default for performance
      ...options,
    };
  } * High-performance route management using optimized route matcher
 * Provides significant performance improvements over linear route searching
 *
 * Performance Features:
 * - O(1) static route lookup
 * - O(log n) dynamic route lookup via radix tree
 * - Route caching with LRU eviction
 * - Method-based route grouping
 * - Batch route operations
 * - Memory-efficient route storage
 */

import { ValidationError } from '../errors';
import { HttpMethod, Path, Route, RouteMatch } from '../types/routing';
import {
  OptimizedRouteMatcher,
  OptimizedRouteMatcherOptions,
} from './optimized-route-matcher';

export interface OptimizedRouteManagerOptions
  extends OptimizedRouteMatcherOptions {
  maxRoutes?: number;
  enableBatchOperations?: boolean;
  enableMetrics?: boolean;
}

interface RouteMetrics {
  totalRequests: number;
  averageLatency: number;
  lastAccessed: number;
  hitCount: number;
}

/**
 * High-performance route manager with optimized lookup algorithms
 */
export class OptimizedRouteManager {
  private methodMatchers = new Map<HttpMethod, OptimizedRouteMatcher>();
  private allRoutes = new Map<string, Route>(); // Route ID -> Route mapping
  private routesByMethod = new Map<HttpMethod, Route[]>(); // 🚀 Cache routes by method
  private options: OptimizedRouteManagerOptions;
  private routeMetrics = new Map<string, RouteMetrics>();
  private totalRoutes = 0;

  constructor(options: OptimizedRouteManagerOptions = {}) {
    this.options = {
      maxRoutes: 10000, // Increased default limit
      caseSensitive: false,
      strict: false,
      cacheSize: 1000,
      enablePrefixOptimization: true,
      enableBatchOperations: true,
      enableMetrics: false,
      ...options,
    };
  }

  /**
   * Add a single route with optimization
   */
  addRoute(route: Route): void {
    this.validateRoute(route);
    this.checkRouteLimit();
    this.checkDuplicateRoute(route);

    // Get or create matcher for this HTTP method
    let matcher = this.methodMatchers.get(route.method);
    if (!matcher) {
      matcher = new OptimizedRouteMatcher({
        caseSensitive: this.options.caseSensitive ?? false,
        strict: this.options.strict ?? false,
        cacheSize: this.options.cacheSize ?? 1000,
        enablePrefixOptimization: this.options.enablePrefixOptimization ?? true,
      });
      this.methodMatchers.set(route.method, matcher);
    }

    // Add route to matcher and tracking
    matcher.addRoute(route);
    this.allRoutes.set(route.id, route);

    // 🚀 Update method-specific cache
    if (!this.routesByMethod.has(route.method)) {
      this.routesByMethod.set(route.method, []);
    }
    this.routesByMethod.get(route.method)!.push(route);

    this.totalRoutes++;

    // Initialize metrics if enabled
    if (this.options.enableMetrics) {
      this.routeMetrics.set(route.id, {
        totalRequests: 0,
        averageLatency: 0,
        lastAccessed: Date.now(),
        hitCount: 0,
      });
    }
  }

  /**
   * Add multiple routes in batch (more efficient)
   */
  addRoutes(routes: Route[]): void {
    if (!this.options.enableBatchOperations) {
      // Fallback to individual additions
      routes.forEach((route) => this.addRoute(route));
      return;
    }

    // Validate all routes first
    routes.forEach((route) => this.validateRoute(route));

    // Check total route limit
    if (this.totalRoutes + routes.length > this.options.maxRoutes!) {
      throw new ValidationError(
        `Adding ${routes.length} routes would exceed maximum limit of ${this.options.maxRoutes}`
      );
    }

    // Group routes by method for efficient batch addition
    const routesByMethod = new Map<HttpMethod, Route[]>();

    for (const route of routes) {
      this.checkDuplicateRoute(route);

      if (!routesByMethod.has(route.method)) {
        routesByMethod.set(route.method, []);
      }
      routesByMethod.get(route.method)!.push(route);
    }

    // Add routes to matchers in batches
    for (const [method, methodRoutes] of Array.from(routesByMethod)) {
      let matcher = this.methodMatchers.get(method);
      if (!matcher) {
        matcher = new OptimizedRouteMatcher({
          caseSensitive: this.options.caseSensitive ?? false,
          strict: this.options.strict ?? false,
          cacheSize: this.options.cacheSize ?? 1000,
          enablePrefixOptimization:
            this.options.enablePrefixOptimization ?? true,
        });
        this.methodMatchers.set(method, matcher);
      }

      // Batch add routes to matcher
      for (const route of methodRoutes) {
        matcher.addRoute(route);
        this.allRoutes.set(route.id, route);
        this.totalRoutes++;

        // Initialize metrics if enabled
        if (this.options.enableMetrics) {
          this.routeMetrics.set(route.id, {
            totalRequests: 0,
            averageLatency: 0,
            lastAccessed: Date.now(),
            hitCount: 0,
          });
        }
      }
    }
  }

  /**
   * Remove a route by ID with cleanup
   */
  removeRoute(routeId: string): boolean {
    const route = this.allRoutes.get(routeId);
    if (!route) {
      return false;
    }

    // Remove from tracking
    this.allRoutes.delete(routeId);
    this.routeMetrics.delete(routeId);
    this.totalRoutes--;

    // Note: OptimizedRouteMatcher doesn't have remove method yet
    // For now, we'll need to rebuild the matcher if removal is needed
    this.rebuildMatcherForMethod(route.method);

    return true;
  }

  /**
   * Find matching route with performance tracking
   */
  findRoute(method: HttpMethod, path: string): RouteMatch | null {
    const startTime = this.options.enableMetrics ? performance.now() : 0;

    // Get matcher for the HTTP method
    const matcher = this.methodMatchers.get(method);
    if (!matcher) {
      return null;
    }

    // 🚀 PERFORMANCE FIX: Use the matcher directly without filtering
    // The matcher already has the routes internally, no need to pass them
    const match = matcher.findMatch(path);

    // Update metrics if enabled
    if (this.options.enableMetrics && match) {
      const latency = performance.now() - startTime;
      this.updateRouteMetrics(match.route.id, latency);
    }

    return match;
  }

  /**
   * Get route by ID
   */
  getRoute(routeId: string): Route | undefined {
    return this.allRoutes.get(routeId);
  }

  /**
   * Get all routes for a specific method
   */
  getRoutesByMethod(method: HttpMethod): Route[] {
    // 🚀 Use cached method-specific routes for O(1) lookup
    return this.routesByMethod.get(method) || [];
  }

  /**
   * Get all routes
   */
  getAllRoutes(): Route[] {
    return Array.from(this.allRoutes.values());
  }

  /**
   * Clear all routes and reset state
   */
  clear(): void {
    this.methodMatchers.clear();
    this.allRoutes.clear();
    this.routesByMethod.clear(); // 🚀 Clear method cache
    this.routeMetrics.clear();
    this.totalRoutes = 0;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    totalRoutes: number;
    routesByMethod: Record<HttpMethod, number>;
    matcherStats: Record<HttpMethod, any>;
    topRoutes?: Array<{
      routeId: string;
      requests: number;
      avgLatency: number;
    }>;
  } {
    const routesByMethod: Record<string, number> = {};
    const matcherStats: Record<string, any> = {};

    // Count routes by method
    for (const route of Array.from(this.allRoutes.values())) {
      routesByMethod[route.method] = (routesByMethod[route.method] || 0) + 1;
    }

    // Get matcher statistics
    for (const [method, matcher] of Array.from(this.methodMatchers)) {
      matcherStats[method] = matcher.getStats();
    }

    const stats: any = {
      totalRoutes: this.totalRoutes,
      routesByMethod,
      matcherStats,
    };

    // Add top routes if metrics are enabled
    if (this.options.enableMetrics) {
      const topRoutes = Array.from(this.routeMetrics.entries())
        .sort(([, a], [, b]) => b.totalRequests - a.totalRequests)
        .slice(0, 10)
        .map(([routeId, metrics]) => ({
          routeId,
          requests: metrics.totalRequests,
          avgLatency: metrics.averageLatency,
        }));

      stats.topRoutes = topRoutes;
    }

    return stats;
  }

  /**
   * Optimize route order based on access patterns
   */
  optimizeRoutes(): void {
    if (!this.options.enableMetrics) {
      return;
    }

    // This could reorder routes within matchers based on hit frequency
    // For now, we'll just clear caches to force rebuilding
    for (const matcher of Array.from(this.methodMatchers.values())) {
      matcher.clear();
    }

    // Re-add routes sorted by hit count (most accessed first)
    const sortedRoutes = Array.from(this.allRoutes.values()).sort((a, b) => {
      const aMetrics = this.routeMetrics.get(a.id);
      const bMetrics = this.routeMetrics.get(b.id);
      return (bMetrics?.hitCount || 0) - (aMetrics?.hitCount || 0);
    });

    // Rebuild matchers with optimized order
    this.allRoutes.clear();
    this.totalRoutes = 0;

    for (const route of sortedRoutes) {
      this.addRoute(route);
    }
  }

  /**
   * Validate route before adding
   */
  private validateRoute(route: Route): void {
    if (!route.id) {
      throw new ValidationError('Route must have an ID');
    }

    if (!route.method) {
      throw new ValidationError('Route must have an HTTP method');
    }

    if (!route.path) {
      throw new ValidationError('Route must have a path');
    }

    if (!route.handler) {
      throw new ValidationError('Route must have a handler');
    }
  }

  /**
   * Check if we're within route limits
   */
  private checkRouteLimit(): void {
    if (this.totalRoutes >= this.options.maxRoutes!) {
      throw new ValidationError(
        `Maximum number of routes (${this.options.maxRoutes}) exceeded`
      );
    }
  }

  /**
   * Check for duplicate routes
   */
  private checkDuplicateRoute(route: Route): void {
    const existingRoute = Array.from(this.allRoutes.values()).find(
      (r) => r.method === route.method && this.routesEqual(r.path, route.path)
    );

    if (existingRoute) {
      throw new ValidationError(
        `Route already exists: ${route.method} ${route.path}`,
        { existingRouteId: existingRoute.id, newRouteId: route.id }
      );
    }
  }

  /**
   * Compare two route paths for equality
   */
  private routesEqual(path1: Path, path2: Path): boolean {
    if (typeof path1 === 'string' && typeof path2 === 'string') {
      return this.normalizePath(path1) === this.normalizePath(path2);
    }

    if (path1 instanceof RegExp && path2 instanceof RegExp) {
      return path1.source === path2.source && path1.flags === path2.flags;
    }

    return false;
  }

  /**
   * Normalize path for comparison
   */
  private normalizePath(path: string): string {
    let normalized = path;

    if (!this.options.caseSensitive) {
      normalized = normalized.toLowerCase();
    }

    if (
      !this.options.strict &&
      normalized.length > 1 &&
      normalized.endsWith('/')
    ) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  }

  /**
   * Rebuild matcher for a specific method (used after route removal)
   */
  private rebuildMatcherForMethod(method: HttpMethod): void {
    const matcher = this.methodMatchers.get(method);
    if (!matcher) {
      return;
    }

    // Clear the matcher
    matcher.clear();

    // Re-add all routes for this method
    const routes = this.getRoutesByMethod(method);
    for (const route of routes) {
      matcher.addRoute(route);
    }
  }

  /**
   * Update metrics for a route
   */
  private updateRouteMetrics(routeId: string, latency: number): void {
    const metrics = this.routeMetrics.get(routeId);
    if (!metrics) {
      return;
    }

    metrics.totalRequests++;
    metrics.hitCount++;
    metrics.lastAccessed = Date.now();

    // Update rolling average latency
    metrics.averageLatency =
      (metrics.averageLatency * (metrics.totalRequests - 1) + latency) /
      metrics.totalRequests;
  }
}

/**
 * Route manager - handles route storage and management
 * Now with performance optimizations for NextRush v1.0
 */
import { ValidationError } from '../errors';
import {
  HttpMethod,
  MiddlewareHandler,
  Path,
  Route,
  RouteHandler,
} from '../types/routing';
import { OptimizedRouteManager } from './optimized-route-manager';
import { RouteMatcher, RouteMatcherOptions } from './route-matcher-deprecated';

export interface RouteManagerOptions extends RouteMatcherOptions {
  maxRoutes?: number;
  useOptimizedMatcher?: boolean; // New option to enable optimization
  enableMetrics?: boolean;
  cacheSize?: number;
  enableCaching?: boolean; // New option to enable optimized routes
  enableOptimizedRoutes?: boolean; // New option to enable optimized routes
  enablePrefixOptimization?: boolean; // New option for prefix optimization
  // Include RouteMatcherOptions properties explicitly
  caseSensitive?: boolean;
  strict?: boolean;
}

export class RouteManager {
  private routes = new Map<string, Route[]>(); // Group by method (legacy)
  private matcher?: RouteMatcher; // Legacy matcher
  private optimizedManager?: OptimizedRouteManager; // New optimized manager
  private options: RouteManagerOptions;
  private useOptimized: boolean;

  constructor(options: RouteManagerOptions = {}) {
    this.options = {
      maxRoutes: 10000, // Increased default limit to match OptimizedRouteManager
      enableOptimizedRoutes: true,
      enableCaching: true,
      caseSensitive: false,
      strict: false,
      cacheSize: 1000,
      enablePrefixOptimization: true,
      ...options,
    };

    this.useOptimized = this.options.useOptimizedMatcher ?? true;

    if (this.useOptimized) {
      // Use the new optimized route manager
      this.optimizedManager = new OptimizedRouteManager({
        maxRoutes: this.options.maxRoutes ?? 10000,
        caseSensitive: this.options.caseSensitive ?? false,
        strict: this.options.strict ?? false,
        enableMetrics: this.options.enableMetrics ?? false,
        cacheSize: this.options.cacheSize ?? 1000,
        enableBatchOperations: true,
        enablePrefixOptimization: true,
      });
    } else {
      // Use legacy matcher for backward compatibility
      this.matcher = new RouteMatcher({
        caseSensitive: this.options.caseSensitive ?? false,
        strict: this.options.strict ?? false,
      });
    }
  }

  /**
   * Add a route to the manager
   */
  addRoute(route: Route): void {
    if (this.useOptimized && this.optimizedManager) {
      this.optimizedManager.addRoute(route);
      return;
    }

    // Legacy implementation
    this.validateRoute(route);

    if (!this.routes.has(route.method)) {
      this.routes.set(route.method, []);
    }

    const methodRoutes = this.routes.get(route.method)!;

    // Check for duplicate routes
    const existingRoute = methodRoutes.find((r) =>
      this.routesEqual(r.path, route.path)
    );

    if (existingRoute) {
      throw new ValidationError(
        `Route already exists: ${route.method} ${route.path}`,
        { existingRouteId: existingRoute.id, newRouteId: route.id }
      );
    }

    // Check max routes limit
    const totalRoutes = Array.from(this.routes.values()).reduce(
      (sum, routes) => sum + routes.length,
      0
    );
    if (totalRoutes >= (this.options.maxRoutes ?? 10000)) {
      throw new ValidationError(
        `Maximum number of routes (${this.options.maxRoutes}) exceeded`
      );
    }

    methodRoutes.push(route);
  }

  /**
   * Add multiple routes in batch (optimized version only)
   */
  addRoutes(routes: Route[]): void {
    if (this.useOptimized && this.optimizedManager) {
      this.optimizedManager.addRoutes(routes);
      return;
    }

    // Fallback to individual additions for legacy mode
    routes.forEach((route) => this.addRoute(route));
  }

  /**
   * Remove a route by ID
   */
  removeRoute(routeId: string): boolean {
    if (this.useOptimized && this.optimizedManager) {
      return this.optimizedManager.removeRoute(routeId);
    }

    // Legacy implementation
    for (const [method, routes] of Array.from(this.routes.entries())) {
      const index = routes.findIndex((route) => route.id === routeId);
      if (index !== -1) {
        routes.splice(index, 1);
        if (routes.length === 0) {
          this.routes.delete(method);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Find matching route for a request
   */
  findRoute(method: HttpMethod, path: string): Route | null {
    if (this.useOptimized && this.optimizedManager) {
      const match = this.optimizedManager.findRoute(method, path);
      return match?.route || null;
    }

    // Legacy implementation
    const routes = this.routes.get(method) || [];
    if (!this.matcher) {
      return null;
    }
    const match = this.matcher.findMatch(path, routes);
    return match?.route || null;
  }

  /**
   * Find matching route with parameters
   */
  findRouteWithParams(
    method: HttpMethod,
    path: string
  ): { route: Route; params: Record<string, string> } | null {
    if (this.useOptimized && this.optimizedManager) {
      const match = this.optimizedManager.findRoute(method, path);
      return match ? { route: match.route, params: match.params } : null;
    }

    // Legacy implementation
    const routes = this.routes.get(method) || [];
    if (!this.matcher) {
      return null;
    }
    const match = this.matcher.findMatch(path, routes);
    return match ? { route: match.route, params: match.params } : null;
  }

  /**
   * Get all routes for a specific method
   */
  getRoutes(method?: HttpMethod): Route[] {
    if (this.useOptimized && this.optimizedManager) {
      if (method) {
        return this.optimizedManager.getRoutesByMethod(method);
      }
      return this.optimizedManager.getAllRoutes();
    }

    // Legacy implementation
    if (method) {
      return [...(this.routes.get(method) || [])];
    }

    const allRoutes: Route[] = [];
    for (const routes of Array.from(this.routes.values())) {
      allRoutes.push(...routes);
    }
    return allRoutes;
  }

  /**
   * Get route statistics
   */
  getStats(): {
    totalRoutes: number;
    routesByMethod: Record<HttpMethod, number>;
    methods: HttpMethod[];
    performanceStats?: any;
  } {
    if (this.useOptimized && this.optimizedManager) {
      const optimizedStats = this.optimizedManager.getPerformanceStats();
      return {
        totalRoutes: optimizedStats.totalRoutes,
        routesByMethod: optimizedStats.routesByMethod as Record<
          HttpMethod,
          number
        >,
        methods: Object.keys(optimizedStats.routesByMethod) as HttpMethod[],
        performanceStats: optimizedStats,
      };
    }

    // Legacy implementation
    const routesByMethod = {} as Record<HttpMethod, number>;
    let totalRoutes = 0;

    for (const [method, routes] of Array.from(this.routes.entries())) {
      routesByMethod[method as HttpMethod] = routes.length;
      totalRoutes += routes.length;
    }

    return {
      totalRoutes,
      routesByMethod,
      methods: Array.from(this.routes.keys()) as HttpMethod[],
    };
  }

  /**
   * Clear all routes
   */
  clear(): void {
    if (this.useOptimized && this.optimizedManager) {
      this.optimizedManager.clear();
      return;
    }

    // Legacy implementation
    this.routes.clear();
  }

  /**
   * Optimize routes based on access patterns (optimized version only)
   */
  optimizeRoutes(): void {
    if (this.useOptimized && this.optimizedManager) {
      this.optimizedManager.optimizeRoutes();
    }
    // Legacy mode doesn't support optimization
  }

  /**
   * Helper method to create a route with generated ID
   */
  createRoute(
    method: HttpMethod,
    path: Path,
    handler: RouteHandler,
    middleware?: MiddlewareHandler[]
  ): Route {
    return {
      id: this.generateRouteId(method, path),
      method,
      path,
      handler,
      middleware: middleware || [],
    };
  }

  /**
   * Get a specific route by ID
   */
  getRoute(routeId: string): Route | undefined {
    if (this.useOptimized && this.optimizedManager) {
      return this.optimizedManager.getRoute(routeId);
    }

    // Legacy implementation
    for (const routes of Array.from(this.routes.values())) {
      const route = routes.find((r) => r.id === routeId);
      if (route) return route;
    }
    return undefined;
  }

  private validateRoute(route: Route): void {
    if (!route.id) {
      throw new ValidationError('Route ID is required');
    }

    if (!route.method) {
      throw new ValidationError('Route method is required');
    }

    if (!route.path) {
      throw new ValidationError('Route path is required');
    }

    if (!route.handler) {
      throw new ValidationError('Route handler is required');
    }

    if (typeof route.handler !== 'function') {
      throw new ValidationError('Route handler must be a function');
    }
  }

  private routesEqual(path1: Path, path2: Path): boolean {
    if (typeof path1 === 'string' && typeof path2 === 'string') {
      return path1 === path2;
    }

    if (path1 instanceof RegExp && path2 instanceof RegExp) {
      return path1.source === path2.source && path1.flags === path2.flags;
    }

    return false;
  }

  private generateRouteId(method: HttpMethod, path: Path): string {
    const pathStr = typeof path === 'string' ? path : path.source;
    return `${method.toLowerCase()}_${pathStr.replace(
      /[^a-zA-Z0-9]/g,
      '_'
    )}_${Date.now()}`;
  }

  /**
   * Configure the route manager
   */
  configure(options: Partial<RouteManagerOptions>): void {
    this.options = { ...this.options, ...options };

    // Only configure legacy matcher if it exists
    if (!this.useOptimized && this.matcher) {
      this.matcher.configure({
        caseSensitive: this.options.caseSensitive ?? false,
        strict: this.options.strict ?? false,
      });
    }
  }
}

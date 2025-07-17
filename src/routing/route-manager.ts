/**
 * Route manager - handles route storage and management
 */
import { ValidationError } from '../errors';
import {
  HttpMethod,
  MiddlewareHandler,
  Path,
  Route,
  RouteHandler,
} from '../types/routing';
import { RouteMatcher, RouteMatcherOptions } from './route-matcher';

export interface RouteManagerOptions extends RouteMatcherOptions {
  maxRoutes?: number;
}

export class RouteManager {
  private routes = new Map<string, Route[]>(); // Group by method
  private matcher: RouteMatcher;
  private options: RouteManagerOptions;

  constructor(options: RouteManagerOptions = {}) {
    this.options = {
      maxRoutes: 1000,
      caseSensitive: false,
      strict: false,
      ...options,
    };

    this.matcher = new RouteMatcher({
      caseSensitive: this.options.caseSensitive ?? false,
      strict: this.options.strict ?? false,
    });
  }

  /**
   * Add a route to the manager
   */
  addRoute(route: Route): void {
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
    if (totalRoutes >= this.options.maxRoutes!) {
      throw new ValidationError(
        `Maximum number of routes (${this.options.maxRoutes}) exceeded`
      );
    }

    methodRoutes.push(route);
  }

  /**
   * Remove a route by ID
   */
  removeRoute(routeId: string): boolean {
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
    const routes = this.routes.get(method) || [];
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
    const routes = this.routes.get(method) || [];
    const match = this.matcher.findMatch(path, routes);
    return match ? { route: match.route, params: match.params } : null;
  }

  /**
   * Get all routes for a specific method
   */
  getRoutes(method?: HttpMethod): Route[] {
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
  } {
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
    this.routes.clear();
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
    this.matcher.configure({
      caseSensitive: this.options.caseSensitive ?? false,
      strict: this.options.strict ?? false,
    });
  }
}

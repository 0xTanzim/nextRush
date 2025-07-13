import { Handler, Method, Path, Route } from '../types';
import { RouteError, ValidationError } from '../types/Errors';
import { RouteMatcher } from '../utils/RouteMatcher';

interface Middleware {
  handler: Handler;
  path?: Path;
}

export class RouteManager {
  private routes: Route[] = [];
  private middlewares: Middleware[] = [];
  private readonly maxRoutes = 1000; // Prevent memory issues

  register(method: Method, path: Path, handler: Handler): void {
    try {
      // Check route limit
      if (this.routes.length >= this.maxRoutes) {
        throw new RouteError(
          `Maximum number of routes exceeded (${this.maxRoutes})`,
          `${method} ${path}`
        );
      }

      // Validate the route
      const route: Route = { method, path, handler };
      RouteMatcher.validateRoute(route);

      // Check for duplicate routes
      const existing = this.routes.find(
        (r) =>
          r.method === method &&
          ((typeof r.path === 'string' &&
            typeof path === 'string' &&
            r.path === path) ||
            (r.path instanceof RegExp &&
              path instanceof RegExp &&
              r.path.source === path.source))
      );

      if (existing) {
        console.warn(`Route ${method} ${path} already exists. Overriding...`);
        // Remove existing route
        const index = this.routes.indexOf(existing);
        this.routes.splice(index, 1);
      }

      this.routes.push(route);
      console.debug(`Registered route: ${method} ${path}`);
    } catch (error) {
      console.error('Error registering route:', error);
      throw error;
    }
  }

  getRoutes(): Route[] {
    return [...this.routes]; // Return copy to prevent external modification
  }

  getRouteCount(): number {
    return this.routes.length;
  }

  getRoutesByMethod(method: Method): Route[] {
    try {
      if (!method || typeof method !== 'string') {
        throw new ValidationError('Method must be a non-empty string');
      }

      return this.routes.filter(
        (route) => route.method === method.toUpperCase()
      );
    } catch (error) {
      console.error('Error getting routes by method:', error);
      return [];
    }
  }

  removeRoute(method: Method, path: Path): boolean {
    try {
      const index = this.routes.findIndex(
        (route) =>
          route.method === method &&
          ((typeof route.path === 'string' &&
            typeof path === 'string' &&
            route.path === path) ||
            (route.path instanceof RegExp &&
              path instanceof RegExp &&
              route.path.source === path.source))
      );

      if (index !== -1) {
        this.routes.splice(index, 1);
        console.debug(`Removed route: ${method} ${path}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error removing route:', error);
      return false;
    }
  }

  clearRoutes(): void {
    const count = this.routes.length;
    this.routes = [];
    console.debug(`Cleared ${count} routes`);
  }

  // HTTP method helpers with enhanced error handling
  get(path: Path, handler: Handler): void {
    try {
      this.register('GET', path, handler);
    } catch (error) {
      throw new RouteError(`Failed to register GET route: ${error}`);
    }
  }

  post(path: Path, handler: Handler): void {
    try {
      this.register('POST', path, handler);
    } catch (error) {
      throw new RouteError(`Failed to register POST route: ${error}`);
    }
  }

  put(path: Path, handler: Handler): void {
    try {
      this.register('PUT', path, handler);
    } catch (error) {
      throw new RouteError(`Failed to register PUT route: ${error}`);
    }
  }

  delete(path: Path, handler: Handler): void {
    try {
      this.register('DELETE', path, handler);
    } catch (error) {
      throw new RouteError(`Failed to register DELETE route: ${error}`);
    }
  }

  patch(path: Path, handler: Handler): void {
    try {
      this.register('PATCH', path, handler);
    } catch (error) {
      throw new RouteError(`Failed to register PATCH route: ${error}`);
    }
  }

  options(path: Path, handler: Handler): void {
    try {
      this.register('OPTIONS', path, handler);
    } catch (error) {
      throw new RouteError(`Failed to register OPTIONS route: ${error}`);
    }
  }

  head(path: Path, handler: Handler): void {
    try {
      this.register('HEAD', path, handler);
    } catch (error) {
      throw new RouteError(`Failed to register HEAD route: ${error}`);
    }
  }

  // Middleware management
  addMiddleware(handler: Handler, path?: Path): void {
    try {
      if (typeof handler !== 'function') {
        throw new ValidationError('Middleware must be a function');
      }

      this.middlewares.push({ handler, path });
      console.debug(
        `Added middleware${path ? ` for path ${path}` : ' (global)'}`
      );
    } catch (error) {
      console.error('Error adding middleware:', error);
      throw error;
    }
  }

  getMiddlewares(): Middleware[] {
    return [...this.middlewares];
  }

  clearMiddlewares(): void {
    const count = this.middlewares.length;
    this.middlewares = [];
    console.debug(`Cleared ${count} middlewares`);
  }

  // Debug and introspection methods
  printRoutes(): void {
    console.log('\n=== Registered Routes ===');
    if (this.routes.length === 0) {
      console.log('No routes registered');
      return;
    }

    this.routes.forEach((route, index) => {
      console.log(`${index + 1}. ${route.method} ${route.path}`);
    });
    console.log(`Total: ${this.routes.length} routes\n`);
  }

  validateAllRoutes(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (let i = 0; i < this.routes.length; i++) {
      try {
        RouteMatcher.validateRoute(this.routes[i]);
      } catch (error) {
        errors.push(`Route ${i + 1}: ${(error as Error).message}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

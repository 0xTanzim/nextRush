import { Handler, Method, Path, Route } from '../types';
import { RouteMatcher } from '../utils/RouteMatcher';

export interface RouterOptions {
  caseSensitive?: boolean;
  mergeParams?: boolean;
  strict?: boolean;
}

export class Router {
  public readonly isRouter = true; // Identifier for instanceof checks
  private routes: Route[] = [];
  private middlewares: Handler[] = [];
  private basePath: string = '';
  private routerOptions: RouterOptions;

  constructor(options: RouterOptions = {}) {
    this.routerOptions = {
      caseSensitive: false,
      mergeParams: false,
      strict: false,
      ...options,
    };
  }

  // Private method to normalize path
  private normalizePath(path: Path): string {
    if (typeof path === 'string') {
      // Remove trailing slash unless it's root
      let normalized = path === '/' ? '/' : path.replace(/\/$/, '');

      // Add leading slash if missing
      if (!normalized.startsWith('/')) {
        normalized = '/' + normalized;
      }

      return normalized;
    }
    return path.source; // For RegExp paths
  }

  // Private method to combine base path with route path
  private combinePaths(basePath: string, routePath: Path): string {
    const normalizedBase = this.normalizePath(basePath);
    const normalizedRoute = this.normalizePath(routePath);

    if (normalizedBase === '/') {
      return normalizedRoute;
    }

    if (normalizedRoute === '/') {
      return normalizedBase;
    }

    return normalizedBase + normalizedRoute;
  }

  // Private method to register route
  private register(method: Method, path: Path, handler: Handler): void {
    try {
      // Validate the route
      const route: Route = { method, path, handler };
      RouteMatcher.validateRoute(route);

      // Check for duplicate routes within this router
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
        console.warn(
          `Route ${method} ${path} already exists in router. Overriding...`
        );
        const index = this.routes.indexOf(existing);
        this.routes.splice(index, 1);
      }

      this.routes.push(route);
      console.debug(`Registered route in router: ${method} ${path}`);
    } catch (error) {
      console.error('Error registering route in router:', error);
      throw error;
    }
  }

  // Middleware registration and router mounting
  use(handler: Handler): Router;
  use(path: Path, handler: Handler): Router;
  use(path: Path, router: Router): Router;
  use(
    pathOrHandlerOrRouter: Path | Handler | Router,
    handlerOrRouter?: Handler | Router
  ): Router {
    if (typeof pathOrHandlerOrRouter === 'function') {
      // router.use(middleware)
      this.middlewares.push(pathOrHandlerOrRouter);
    } else if (
      pathOrHandlerOrRouter &&
      typeof pathOrHandlerOrRouter === 'object' &&
      'isRouter' in pathOrHandlerOrRouter
    ) {
      // router.use(subRouter) - mount router at root
      this.mountSubRouter('/', pathOrHandlerOrRouter as Router);
    } else if (
      handlerOrRouter &&
      typeof handlerOrRouter === 'object' &&
      'isRouter' in handlerOrRouter
    ) {
      // router.use('/path', subRouter) - mount router at path
      this.mountSubRouter(pathOrHandlerOrRouter, handlerOrRouter as Router);
    } else if (typeof handlerOrRouter === 'function') {
      // router.use('/path', middleware) - for specific paths
      this.middlewares.push(handlerOrRouter);
    }
    return this;
  }

  // Mount sub-router
  private mountSubRouter(basePath: Path, router: Router): void {
    try {
      const routes = router.getRoutes(
        typeof basePath === 'string' ? basePath : '/'
      );
      const middlewares = router.getMiddlewares();

      // Add sub-router's middlewares
      middlewares.forEach((middleware) => {
        this.middlewares.push(middleware);
      });

      // Add sub-router's routes
      routes.forEach((route) => {
        this.routes.push(route);
      });

      console.debug(
        `Mounted sub-router at ${basePath} with ${routes.length} routes`
      );
    } catch (error) {
      console.error('Error mounting sub-router:', error);
      throw error;
    }
  }

  // HTTP method handlers
  get(path: Path, handler: Handler): Router {
    this.register('GET', path, handler);
    return this;
  }

  post(path: Path, handler: Handler): Router {
    this.register('POST', path, handler);
    return this;
  }

  put(path: Path, handler: Handler): Router {
    this.register('PUT', path, handler);
    return this;
  }

  delete(path: Path, handler: Handler): Router {
    this.register('DELETE', path, handler);
    return this;
  }

  patch(path: Path, handler: Handler): Router {
    this.register('PATCH', path, handler);
    return this;
  }

  options(path: Path, handler: Handler): Router {
    this.register('OPTIONS', path, handler);
    return this;
  }

  head(path: Path, handler: Handler): Router {
    this.register('HEAD', path, handler);
    return this;
  }

  // Get all routes from this router with combined paths
  getRoutes(basePath: string = ''): Route[] {
    return this.routes.map((route) => ({
      ...route,
      path:
        typeof route.path === 'string'
          ? this.combinePaths(basePath, route.path)
          : route.path, // RegExp paths remain as-is for now
    }));
  }

  // Get middlewares
  getMiddlewares(): Handler[] {
    return [...this.middlewares];
  }

  // Debug methods
  printRoutes(basePath: string = ''): void {
    console.log('\n=== Router Routes ===');
    this.routes.forEach((route) => {
      const fullPath =
        typeof route.path === 'string'
          ? this.combinePaths(basePath, route.path)
          : route.path.source;
      console.log(`${route.method.padEnd(7)} ${fullPath}`);
    });
    console.log('=====================\n');
  }

  getRouteCount(): number {
    return this.routes.length;
  }

  // Clear all routes (useful for testing)
  clear(): void {
    this.routes = [];
    this.middlewares = [];
  }

  // Validate all routes in this router
  validateAllRoutes(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const route of this.routes) {
      try {
        RouteMatcher.validateRoute(route);
      } catch (error) {
        errors.push(
          `Invalid route ${route.method} ${route.path}: ${
            (error as Error).message
          }`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

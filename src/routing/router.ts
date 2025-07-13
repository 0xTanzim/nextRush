/**
 * Router - handles route registration and request routing
 */
import { MethodNotAllowedError, NotFoundError } from '../errors';
import { RequestContext } from '../types/http';
import {
  HttpMethod,
  MiddlewareHandler,
  Path,
  Route,
  RouteHandler,
  RouterOptions,
} from '../types/routing';
import { RouteManager } from './route-manager';

export class Router {
  private routeManager: RouteManager;
  private globalMiddleware: MiddlewareHandler[] = [];
  private routerOptions: RouterOptions;

  constructor(options: RouterOptions = {}) {
    this.routerOptions = {
      caseSensitive: false,
      strict: false,
      mergeParams: false,
      ...options,
    };

    this.routeManager = new RouteManager({
      caseSensitive: this.routerOptions.caseSensitive ?? false,
      strict: this.routerOptions.strict ?? false,
    });
  }

  /**
   * Add global middleware that runs for all routes
   */
  use(middleware: MiddlewareHandler): this {
    this.globalMiddleware.push(middleware);
    return this;
  }

  /**
   * Register a GET route
   */
  get(
    path: Path,
    handler: RouteHandler,
    ...middleware: MiddlewareHandler[]
  ): this {
    return this.addRoute('GET', path, handler, middleware);
  }

  /**
   * Register a POST route
   */
  post(
    path: Path,
    handler: RouteHandler,
    ...middleware: MiddlewareHandler[]
  ): this {
    return this.addRoute('POST', path, handler, middleware);
  }

  /**
   * Register a PUT route
   */
  put(
    path: Path,
    handler: RouteHandler,
    ...middleware: MiddlewareHandler[]
  ): this {
    return this.addRoute('PUT', path, handler, middleware);
  }

  /**
   * Register a DELETE route
   */
  delete(
    path: Path,
    handler: RouteHandler,
    ...middleware: MiddlewareHandler[]
  ): this {
    return this.addRoute('DELETE', path, handler, middleware);
  }

  /**
   * Register a PATCH route
   */
  patch(
    path: Path,
    handler: RouteHandler,
    ...middleware: MiddlewareHandler[]
  ): this {
    return this.addRoute('PATCH', path, handler, middleware);
  }

  /**
   * Register a HEAD route
   */
  head(
    path: Path,
    handler: RouteHandler,
    ...middleware: MiddlewareHandler[]
  ): this {
    return this.addRoute('HEAD', path, handler, middleware);
  }

  /**
   * Register an OPTIONS route
   */
  options(
    path: Path,
    handler: RouteHandler,
    ...middleware: MiddlewareHandler[]
  ): this {
    return this.addRoute('OPTIONS', path, handler, middleware);
  }

  /**
   * Handle incoming request
   */
  async handle(context: RequestContext): Promise<void> {
    const { request } = context;
    const method = (request.method?.toUpperCase() || 'GET') as HttpMethod;
    const path = request.pathname || '/';

    // Find matching route
    const routeMatch = this.routeManager.findRouteWithParams(method, path);

    if (!routeMatch) {
      // Check if path exists with different method
      const allMethods: HttpMethod[] = [
        'GET',
        'POST',
        'PUT',
        'DELETE',
        'PATCH',
        'HEAD',
        'OPTIONS',
      ];
      const allowedMethods: HttpMethod[] = [];

      for (const checkMethod of allMethods) {
        if (this.routeManager.findRoute(checkMethod, path)) {
          allowedMethods.push(checkMethod);
        }
      }

      if (allowedMethods.length > 0) {
        throw new MethodNotAllowedError(method, allowedMethods);
      }

      throw new NotFoundError(`Route not found: ${method} ${path}`);
    }

    // Set route parameters
    if (this.routerOptions.mergeParams) {
      context.params = { ...context.params, ...routeMatch.params };
    } else {
      context.params = routeMatch.params;
    }

    // Execute middleware chain
    await this.executeMiddlewareChain(context, routeMatch.route);
  }

  /**
   * Execute middleware chain and route handler
   */
  private async executeMiddlewareChain(
    context: RequestContext,
    route: Route
  ): Promise<void> {
    const middlewares = [...this.globalMiddleware, ...(route.middleware || [])];

    let currentIndex = 0;

    const next = async (): Promise<void> => {
      if (currentIndex < middlewares.length) {
        const middleware = middlewares[currentIndex++];
        await middleware(context, next);
      } else {
        // All middleware executed, now run the route handler
        await route.handler(context);
      }
    };

    await next();
  }

  /**
   * Add a route with the specified method
   */
  private addRoute(
    method: HttpMethod,
    path: Path,
    handler: RouteHandler,
    middleware: MiddlewareHandler[]
  ): this {
    const route = this.routeManager.createRoute(
      method,
      path,
      handler,
      middleware
    );
    this.routeManager.addRoute(route);
    return this;
  }

  /**
   * Get all registered routes
   */
  getRoutes(method?: HttpMethod): Route[] {
    return this.routeManager.getRoutes(method);
  }

  /**
   * Get router statistics
   */
  getStats() {
    return {
      ...this.routeManager.getStats(),
      globalMiddleware: this.globalMiddleware.length,
    };
  }

  /**
   * Clear all routes and middleware
   */
  clear(): void {
    this.routeManager.clear();
    this.globalMiddleware = [];
  }

  /**
   * Create a sub-router with merged options
   */
  createSubRouter(options: Partial<RouterOptions> = {}): Router {
    const mergedOptions = { ...this.routerOptions, ...options };
    return new Router(mergedOptions);
  }

  /**
   * Mount another router with a path prefix
   */
  mount(pathPrefix: string, router: Router): this {
    const routes = router.getRoutes();

    for (const route of routes) {
      const prefixedPath = this.combinePaths(pathPrefix, route.path);
      const newRoute = this.routeManager.createRoute(
        route.method,
        prefixedPath,
        route.handler,
        route.middleware
      );
      this.routeManager.addRoute(newRoute);
    }

    return this;
  }

  private combinePaths(prefix: string, path: Path): Path {
    if (typeof path === 'string') {
      const normalizedPrefix = prefix.replace(/\/$/, '');
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      return `${normalizedPrefix}${normalizedPath}`;
    }

    // For RegExp paths, we can't easily combine them
    return path;
  }

  /**
   * Configure the router
   */
  configure(options: Partial<RouterOptions>): void {
    this.routerOptions = { ...this.routerOptions, ...options };
    this.routeManager.configure({
      caseSensitive: this.routerOptions.caseSensitive ?? false,
      strict: this.routerOptions.strict ?? false,
    });
  }
}

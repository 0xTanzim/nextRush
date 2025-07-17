/**
 * Router - handles route registration and request routing
 */
import { RequestEnhancer } from '../http/request/request-enhancer';
import { ResponseEnhancer } from '../http/response/response-enhancer';
import { MethodNotAllowedError, NotFoundError } from '../errors';
import {
  ExpressHandler,
  ExpressMiddleware,
  NextRushRequest,
  NextRushResponse,
} from '../types/express';
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
  use(middleware: MiddlewareHandler | ExpressMiddleware): this {
    const convertedMiddleware = this.convertMiddleware(middleware);
    this.globalMiddleware.push(convertedMiddleware);
    return this;
  }

  /**
   * Register a GET route
   */
  // Overload 1: Just handler (Express-style)
  get(
    path: Path,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 2: Just handler (Context-style)
  get(
    path: Path,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Overload 3: One middleware + handler (Express-style)
  get(
    path: Path,
    middleware: ExpressMiddleware,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 4: One middleware + handler (Context-style)
  get(
    path: Path,
    middleware: ExpressMiddleware,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Overload 5: Two middleware + handler (Express-style)
  get(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 6: Two middleware + handler (Context-style)
  get(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Overload 7: Three middleware + handler (Express-style)
  get(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    middleware3: ExpressMiddleware,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 8: Three middleware + handler (Context-style)
  get(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    middleware3: ExpressMiddleware,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Implementation
  get(
    path: Path,
    ...args: (
      | RouteHandler
      | ExpressHandler
      | MiddlewareHandler
      | ExpressMiddleware
    )[]
  ): this {
    if (args.length === 0) {
      throw new Error('GET route requires at least a handler');
    }

    const handler = args[args.length - 1] as RouteHandler | ExpressHandler;
    const middleware = args.slice(0, -1) as (
      | MiddlewareHandler
      | ExpressMiddleware
    )[];

    return this.addRoute('GET', path, handler, middleware);
  }

  /**
   * Register a POST route
   */
  // Overload 1: Just handler (Express-style)
  post(
    path: Path,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 2: Just handler (Context-style)
  post(
    path: Path,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Overload 3: One middleware + handler (Express-style)
  post(
    path: Path,
    middleware: ExpressMiddleware,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 4: One middleware + handler (Context-style)
  post(
    path: Path,
    middleware: ExpressMiddleware,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Overload 5: Two middleware + handler (Express-style)
  post(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 6: Two middleware + handler (Context-style)
  post(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Overload 7: Three middleware + handler (Express-style)
  post(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    middleware3: ExpressMiddleware,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 8: Three middleware + handler (Context-style)
  post(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    middleware3: ExpressMiddleware,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Overload 4: Three middleware + handler
  post(
    path: Path,
    middleware1: MiddlewareHandler | ExpressMiddleware,
    middleware2: MiddlewareHandler | ExpressMiddleware,
    middleware3: MiddlewareHandler | ExpressMiddleware,
    handler: RouteHandler
  ): this;
  post(
    path: Path,
    middleware1: MiddlewareHandler | ExpressMiddleware,
    middleware2: MiddlewareHandler | ExpressMiddleware,
    middleware3: MiddlewareHandler | ExpressMiddleware,
    handler: ExpressHandler
  ): this;

  // Implementation
  post(
    path: Path,
    ...args: (
      | RouteHandler
      | ExpressHandler
      | MiddlewareHandler
      | ExpressMiddleware
    )[]
  ): this {
    if (args.length === 0) {
      throw new Error('POST route requires at least a handler');
    }

    const handler = args[args.length - 1] as RouteHandler | ExpressHandler;
    const middleware = args.slice(0, -1) as (
      | MiddlewareHandler
      | ExpressMiddleware
    )[];

    return this.addRoute('POST', path, handler, middleware);
  }

  /**
   * Register a PUT route
   */
  // Overload 1: Just handler (Express-style)
  put(
    path: Path,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 2: Just handler (Context-style)
  put(
    path: Path,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Overload 3: One middleware + handler (Express-style)
  put(
    path: Path,
    middleware: ExpressMiddleware,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 4: One middleware + handler (Context-style)
  put(
    path: Path,
    middleware: ExpressMiddleware,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Overload 5: Two middleware + handler (Express-style)
  put(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 6: Two middleware + handler (Context-style)
  put(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Overload 7: Three middleware + handler (Express-style)
  put(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    middleware3: ExpressMiddleware,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 8: Three middleware + handler (Context-style)
  put(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    middleware3: ExpressMiddleware,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Implementation
  put(
    path: Path,
    ...args: (
      | RouteHandler
      | ExpressHandler
      | MiddlewareHandler
      | ExpressMiddleware
    )[]
  ): this {
    if (args.length === 0) {
      throw new Error('PUT route requires at least a handler');
    }

    const handler = args[args.length - 1] as RouteHandler | ExpressHandler;
    const middleware = args.slice(0, -1) as (
      | MiddlewareHandler
      | ExpressMiddleware
    )[];

    return this.addRoute('PUT', path, handler, middleware);
  }

  /**
   * Register a DELETE route
   */
  // Overload 1: Just handler (Express-style)
  delete(
    path: Path,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 2: Just handler (Context-style)
  delete(
    path: Path,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Overload 3: One middleware + handler (Express-style)
  delete(
    path: Path,
    middleware: ExpressMiddleware,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 4: One middleware + handler (Context-style)
  delete(
    path: Path,
    middleware: ExpressMiddleware,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Overload 5: Two middleware + handler (Express-style)
  delete(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 6: Two middleware + handler (Context-style)
  delete(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Overload 7: Three middleware + handler (Express-style)
  delete(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    middleware3: ExpressMiddleware,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 8: Three middleware + handler (Context-style)
  delete(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    middleware3: ExpressMiddleware,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Implementation
  delete(
    path: Path,
    ...args: (
      | RouteHandler
      | ExpressHandler
      | MiddlewareHandler
      | ExpressMiddleware
    )[]
  ): this {
    if (args.length === 0) {
      throw new Error('DELETE route requires at least a handler');
    }

    const handler = args[args.length - 1] as RouteHandler | ExpressHandler;
    const middleware = args.slice(0, -1) as (
      | MiddlewareHandler
      | ExpressMiddleware
    )[];

    return this.addRoute('DELETE', path, handler, middleware);
  }

  /**
   * Register a PATCH route
   */
  // Overload 1: Just handler (Express-style)
  patch(
    path: Path,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 2: Just handler (Context-style)
  patch(
    path: Path,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Overload 3: One middleware + handler (Express-style)
  patch(
    path: Path,
    middleware: ExpressMiddleware,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 4: One middleware + handler (Context-style)
  patch(
    path: Path,
    middleware: ExpressMiddleware,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Overload 5: Two middleware + handler (Express-style)
  patch(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 6: Two middleware + handler (Context-style)
  patch(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Overload 7: Three middleware + handler (Express-style)
  patch(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    middleware3: ExpressMiddleware,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 8: Three middleware + handler (Context-style)
  patch(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    middleware3: ExpressMiddleware,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Implementation
  patch(
    path: Path,
    ...args: (
      | RouteHandler
      | ExpressHandler
      | MiddlewareHandler
      | ExpressMiddleware
    )[]
  ): this {
    if (args.length === 0) {
      throw new Error('PATCH route requires at least a handler');
    }

    const handler = args[args.length - 1] as RouteHandler | ExpressHandler;
    const middleware = args.slice(0, -1) as (
      | MiddlewareHandler
      | ExpressMiddleware
    )[];

    return this.addRoute('PATCH', path, handler, middleware);
  }

  /**
   * Register a HEAD route
   */
  // Overload 1: Just handler (Express-style)
  head(
    path: Path,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 2: Just handler (Context-style)
  head(
    path: Path,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Overload 3: One middleware + handler (Express-style)
  head(
    path: Path,
    middleware: ExpressMiddleware,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 4: One middleware + handler (Context-style)
  head(
    path: Path,
    middleware: ExpressMiddleware,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Overload 5: Two middleware + handler (Express-style)
  head(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 6: Two middleware + handler (Context-style)
  head(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Overload 7: Three middleware + handler (Express-style)
  head(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    middleware3: ExpressMiddleware,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 8: Three middleware + handler (Context-style)
  head(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    middleware3: ExpressMiddleware,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Implementation
  head(
    path: Path,
    ...args: (
      | RouteHandler
      | ExpressHandler
      | MiddlewareHandler
      | ExpressMiddleware
    )[]
  ): this {
    if (args.length === 0) {
      throw new Error('HEAD route requires at least a handler');
    }

    const handler = args[args.length - 1] as RouteHandler | ExpressHandler;
    const middleware = args.slice(0, -1) as (
      | MiddlewareHandler
      | ExpressMiddleware
    )[];

    return this.addRoute('HEAD', path, handler, middleware);
  }

  /**
   * Register an OPTIONS route
   */
  // Overload 1: Just handler (Express-style)
  options(
    path: Path,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 2: Just handler (Context-style)
  options(
    path: Path,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Overload 3: One middleware + handler (Express-style)
  options(
    path: Path,
    middleware: ExpressMiddleware,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 4: One middleware + handler (Context-style)
  options(
    path: Path,
    middleware: ExpressMiddleware,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Overload 5: Two middleware + handler (Express-style)
  options(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 6: Two middleware + handler (Context-style)
  options(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Overload 7: Three middleware + handler (Express-style)
  options(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    middleware3: ExpressMiddleware,
    handler: (
      req: NextRushRequest,
      res: NextRushResponse
    ) => void | Promise<void>
  ): this;

  // Overload 8: Three middleware + handler (Context-style)
  options(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    middleware3: ExpressMiddleware,
    handler: (context: RequestContext) => void | Promise<void>
  ): this;

  // Implementation
  options(
    path: Path,
    ...args: (
      | RouteHandler
      | ExpressHandler
      | MiddlewareHandler
      | ExpressMiddleware
    )[]
  ): this {
    if (args.length === 0) {
      throw new Error('OPTIONS route requires at least a handler');
    }

    const handler = args[args.length - 1] as RouteHandler | ExpressHandler;
    const middleware = args.slice(0, -1) as (
      | MiddlewareHandler
      | ExpressMiddleware
    )[];

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
   * Add a route with the specified method (internal)
   */
  private registerRoute(
    method: HttpMethod,
    path: Path,
    handler: RouteHandler | ExpressHandler,
    middleware: (MiddlewareHandler | ExpressMiddleware)[]
  ): this {
    // Convert Express-style handler to NextRush handler
    const convertedHandler = this.convertHandler(handler);

    // Convert Express-style middleware to NextRush middleware
    const convertedMiddleware = middleware.map((mw) =>
      this.convertMiddleware(mw)
    );

    const route = this.routeManager.createRoute(
      method,
      path,
      convertedHandler,
      convertedMiddleware
    );
    this.routeManager.addRoute(route);
    return this;
  }

  /**
   * Add a route to this router (public API for mounting)
   */
  addRoute(
    method: HttpMethod,
    path: Path,
    handler: RouteHandler | ExpressHandler,
    middleware: (MiddlewareHandler | ExpressMiddleware)[] = []
  ): this {
    return this.registerRoute(method, path, handler, middleware);
  }

  /**
   * Internal method for Application class - allows spreading middleware
   */
  private _addRoute(
    method: HttpMethod,
    path: Path,
    handler: RouteHandler | ExpressHandler,
    middleware: (MiddlewareHandler | ExpressMiddleware)[] = []
  ): this {
    return this.addRoute(method, path, handler, middleware);
  }

  /**
   * Internal GET method for Application class
   */
  _get(
    path: Path,
    handler: RouteHandler | ExpressHandler,
    middleware: (MiddlewareHandler | ExpressMiddleware)[] = []
  ): this {
    return this._addRoute('GET', path, handler, middleware);
  }

  /**
   * Internal POST method for Application class
   */
  _post(
    path: Path,
    handler: RouteHandler | ExpressHandler,
    middleware: (MiddlewareHandler | ExpressMiddleware)[] = []
  ): this {
    return this._addRoute('POST', path, handler, middleware);
  }

  /**
   * Internal PUT method for Application class
   */
  _put(
    path: Path,
    handler: RouteHandler | ExpressHandler,
    middleware: (MiddlewareHandler | ExpressMiddleware)[] = []
  ): this {
    return this._addRoute('PUT', path, handler, middleware);
  }

  /**
   * Internal DELETE method for Application class
   */
  _delete(
    path: Path,
    handler: RouteHandler | ExpressHandler,
    middleware: (MiddlewareHandler | ExpressMiddleware)[] = []
  ): this {
    return this._addRoute('DELETE', path, handler, middleware);
  }

  /**
   * Internal PATCH method for Application class
   */
  _patch(
    path: Path,
    handler: RouteHandler | ExpressHandler,
    middleware: (MiddlewareHandler | ExpressMiddleware)[] = []
  ): this {
    return this._addRoute('PATCH', path, handler, middleware);
  }

  /**
   * Internal HEAD method for Application class
   */
  _head(
    path: Path,
    handler: RouteHandler | ExpressHandler,
    middleware: (MiddlewareHandler | ExpressMiddleware)[] = []
  ): this {
    return this._addRoute('HEAD', path, handler, middleware);
  }

  /**
   * Internal OPTIONS method for Application class
   */
  _options(
    path: Path,
    handler: RouteHandler | ExpressHandler,
    middleware: (MiddlewareHandler | ExpressMiddleware)[] = []
  ): this {
    return this._addRoute('OPTIONS', path, handler, middleware);
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

  /**
   * Check if a handler is an Express-style handler
   */
  private isExpressHandler(
    handler: RouteHandler | ExpressHandler
  ): handler is ExpressHandler {
    return handler.length === 2; // Express handler has (req, res)
  }

  /**
   * Convert Express-style handler to NextRush handler
   */
  private convertHandler(handler: RouteHandler | ExpressHandler): RouteHandler {
    if (this.isExpressHandler(handler)) {
      return async (context: RequestContext) => {
        const req = RequestEnhancer.enhance(context.request);
        const res = ResponseEnhancer.enhance(context.response);

        // Set params and body from context
        req.params = context.params;
        req.body = context.body;

        await handler(req, res);
      };
    }
    return handler;
  }

  /**
   * Check if middleware is Express-style
   */
  private isExpressMiddleware(
    middleware: MiddlewareHandler | ExpressMiddleware
  ): middleware is ExpressMiddleware {
    return middleware.length === 3; // Express middleware has (req, res, next)
  }

  /**
   * Convert Express-style middleware to NextRush middleware
   */
  private convertMiddleware(
    middleware: MiddlewareHandler | ExpressMiddleware
  ): MiddlewareHandler {
    if (this.isExpressMiddleware(middleware)) {
      return async (context: RequestContext, next: () => Promise<void>) => {
        const req = RequestEnhancer.enhance(context.request);
        const res = ResponseEnhancer.enhance(context.response);

        // Set params and body from context
        req.params = context.params;
        req.body = context.body;

        await new Promise<void>((resolve, reject) => {
          const expressNext = (error?: any) => {
            if (error) {
              reject(error);
            } else {
              next().then(resolve).catch(reject);
            }
          };

          try {
            const result = middleware(req, res, expressNext);
            if (result instanceof Promise) {
              result.catch(reject);
            }
          } catch (error) {
            reject(error);
          }
        });
      };
    }
    return middleware;
  }
}

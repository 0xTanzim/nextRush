/**
 * 🚀 Router Component - SOLID Architecture Implementation
 * Handles all HTTP routing with Express.js compatibility
 * 
 * SOLID Principles Applied:
 * - Single Responsibility: Only handles routing logic
 * - Open/Closed: Extensible for new HTTP methods
 * - Liskov Substitution: Properly extends BaseComponent
 * - Interface Segregation: Clean, focused interfaces
 * - Dependency Inversion: Depends on abstractions, not concretions
 */

import { IncomingMessage, ServerResponse } from 'http';
import { BaseComponent } from '../../core/base-component';
import { MinimalApplication } from '../../core/interfaces';
import { ComponentErrorFactory } from '../../types/component-errors';
import { Path, RouteHandler as NextRushRouteHandler, MiddlewareHandler } from '../../types/routing';
import { ExpressHandler, ExpressMiddleware } from '../../types/express';
import { RequestContext } from '../../types/http';

/**
 * Express-style route handler for internal use
 */
export interface ExpressRouteHandler {
  (
    req: IncomingMessage,
    res: ServerResponse,
    next: (error?: Error) => void
  ): void | Promise<void>;
}

export interface ExpressRoute {
  method: string;
  path: string;
  handler: ExpressRouteHandler;
  middleware: ExpressRouteHandler[];
}

/**
 * Router Component - SOLID Implementation
 */
export class RouterComponent extends BaseComponent {
  readonly name = 'Router';
  private routes: ExpressRoute[] = [];
  private globalMiddleware: ExpressRouteHandler[] = [];

  constructor() {
    super('Router');
  }

  /**
   * Install router methods on application (Adapter Pattern for Type Safety)
   */
  install(app: MinimalApplication): void {
    this.setApp(app);

    // Type-safe method installation using proper NextRush types
    this.installHttpMethods(app);
    this.installMiddlewareMethod(app);
    this.installRequestHandler(app);

    this.log('info', 'Router component installed with proper type adapters');
  }

  /**
   * Install HTTP method handlers - Adapter Pattern
   */
  private installHttpMethods(app: MinimalApplication): void {
    const methods = [
      'get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'all'
    ] as const;

    methods.forEach((method) => {
      // Create adapter function that converts Express handlers to NextRush handlers
      (app as any)[method] = (path: Path, ...handlers: (ExpressHandler | MiddlewareHandler | NextRushRouteHandler)[]) => {
        // Convert handlers and route to internal format
        const expressHandlers = this.convertToExpressHandlers(handlers);
        this.addRoute(method.toUpperCase(), String(path), expressHandlers);
        return app;
      };
    });
  }

  /**
   * Install middleware method - Adapter Pattern
   */
  private installMiddlewareMethod(app: MinimalApplication): void {
    (app as any).use = (
      pathOrHandler: string | ExpressHandler | MiddlewareHandler,
      handler?: ExpressHandler | MiddlewareHandler
    ) => {
      if (typeof pathOrHandler === 'function') {
        // Global middleware
        const expressHandler = this.convertHandlerToExpress(pathOrHandler);
        this.globalMiddleware.push(expressHandler);
      } else if (typeof pathOrHandler === 'string' && handler) {
        // Path-specific middleware
        const expressHandler = this.convertHandlerToExpress(handler);
        this.addRoute('*', pathOrHandler, [expressHandler]);
      }
      return app;
    };
  }

  /**
   * Install request handler - Bridge to Express-style handling
   */
  private installRequestHandler(app: MinimalApplication): void {
    (app as any).handle = (req: IncomingMessage, res: ServerResponse) => {
      return this.handleRequest(req, res);
    };
  }

  /**
   * Convert NextRush handlers to Express-style handlers (Adapter Pattern)
   */
  private convertToExpressHandlers(handlers: (ExpressHandler | MiddlewareHandler | NextRushRouteHandler)[]): ExpressRouteHandler[] {
    return handlers.map(handler => this.convertHandlerToExpress(handler));
  }

  /**
   * Convert individual handler to Express-style (Adapter Pattern)
   */
  private convertHandlerToExpress(handler: ExpressHandler | MiddlewareHandler | NextRushRouteHandler): ExpressRouteHandler {
    return (req: IncomingMessage, res: ServerResponse, next: (error?: Error) => void): void | Promise<void> => {
      try {
        // Check if it's an ExpressHandler (2 params)
        if (handler.length === 2) {
          const result = (handler as ExpressHandler)(req as any, res as any);
          if (result && typeof result.then === 'function') {
            return result.then(() => next()).catch(next);
          }
          next();
          return;
        }
        
        // If it's an ExpressMiddleware (3 params)
        if (handler.length === 3) {
          return (handler as ExpressMiddleware)(req as any, res as any, next);
        }
        
        // If it's a NextRush handler, create a context and adapt
        const context: RequestContext = this.createRequestContext(req, res);
        
        // NextRushRouteHandler (1 param)
        const result = (handler as NextRushRouteHandler)(context);
        if (result && typeof result.then === 'function') {
          return result.then(() => next()).catch(next);
        }
        next();
      } catch (error) {
        next(error as Error);
      }
    };
  }

  /**
   * Create NextRush RequestContext from Express req/res (Adapter Pattern)
   */
  private createRequestContext(req: IncomingMessage, res: ServerResponse): RequestContext {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    
    return {
      request: req as any, // Cast to NextRushRequest
      response: res as any, // Cast to NextRushResponse  
      params: {},
      query: Object.fromEntries(url.searchParams),
      body: {},
      startTime: Date.now()
    };
  }

  /**
   * Add route to router
   */
  private addRoute(
    method: string,
    path: string,
    handlers: ExpressRouteHandler[]
  ): void {
    const middleware = handlers.slice(0, -1);
    const handler = handlers[handlers.length - 1];

    this.routes.push({
      method,
      path,
      handler,
      middleware,
    });
  }

  /**
   * Handle incoming request
   */
  async handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const method = req.method || 'GET';
    const url = req.url || '/';

    try {
      // Apply global middleware first
      for (const middleware of this.globalMiddleware) {
        await this.executeHandler(middleware, req, res);
      }

      // Find matching route
      const route = this.findRoute(method, url);
      if (!route) {
        this.send404(res);
        return;
      }

      // Apply route middleware
      for (const middleware of route.middleware) {
        await this.executeHandler(middleware, req, res);
      }

      // Execute route handler
      await this.executeHandler(route.handler, req, res);
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)), res);
    }
  }

  /**
   * Find matching route
   */
  private findRoute(method: string, url: string): ExpressRoute | null {
    return (
      this.routes.find((route) => {
        if (
          route.method !== '*' &&
          route.method !== method &&
          route.method !== 'ALL'
        ) {
          return false;
        }
        return this.matchPath(route.path, url);
      }) || null
    );
  }

  /**
   * Match path with simple pattern matching
   */
  private matchPath(pattern: string, url: string): boolean {
    if (pattern === url) return true;
    if (pattern === '*') return true;

    // Simple wildcard matching
    const regexPattern = pattern.replace(/\*/g, '.*').replace(/:\w+/g, '[^/]+');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(url.split('?')[0]); // Remove query string
  }

  /**
   * Execute handler with error handling
   */
  private async executeHandler(
    handler: ExpressRouteHandler,
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const result = handler(req, res, (error?: Error) => {
          if (error) reject(error);
          else resolve();
        });

        if (result && typeof result.then === 'function') {
          result.then(resolve).catch(reject);
        } else {
          resolve();
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send 404 response
   */
  private send404(res: ServerResponse): void {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Not Found');
  }

  /**
   * Handle errors with proper typing
   */
  private handleError(error: Error, res: ServerResponse): void {
    const routerError = ComponentErrorFactory.createRouterError(
      error.message || 'Unknown router error',
      'ROUTE_EXECUTION_ERROR',
      { statusCode: 500 }
    );
    
    this.log('error', `Router error: ${routerError.message}`, routerError);
    
    if (!res.headersSent) {
      res.statusCode = routerError.statusCode || 500;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Internal Server Error');
    }
  }

  /**
   * Start component
   */
  override async start(): Promise<void> {
    await super.start();
    this.log('info', 'Router ready for handling requests');
  }

  /**
   * Stop component
   */
  override async stop(): Promise<void> {
    this.routes.length = 0;
    this.globalMiddleware.length = 0;
    await super.stop();
    this.log('info', 'Router stopped and routes cleared');
  }
}

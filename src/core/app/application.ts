/**
 * 🚀 NextRush Application - Complete, Type-Safe Framework
 *
 * Zero `any` usage, proper overloads, createRoute feature, enterprise-grade typing
 */

import { Server as HttpServer, IncomingMessage, ServerResponse } from 'http';
import { Router } from '../../routing/router';
import { ErrorHandler } from '../../errors/error-handler';
import { RequestEnhancer } from '../enhancers/request-enhancer';
import { ResponseEnhancer } from '../enhancers/response-enhancer';
import { SimpleEventEmitter } from '../event-system';
import {
  NextRushRequest,
  NextRushResponse,
  ExpressHandler,
  ExpressMiddleware
} from '../../types/express';
import {
  HttpMethod,
  Path,
  RouteHandler,
  MiddlewareHandler,
  Route
} from '../../types/routing';
import { BaseComponent } from './base-component';
import { RequestContext } from '../../types/http';

export interface ApplicationOptions {
  router?: Router;
  errorHandler?: ErrorHandler;
  timeout?: number;
  maxRequestSize?: number;
  enableEvents?: boolean;
  enableWebSocket?: boolean;
  caseSensitive?: boolean;
  strict?: boolean;
}

export interface StaticOptions {
  maxAge?: string | number;
  etag?: boolean;
  index?: string | string[] | false;
  dotfiles?: 'allow' | 'deny' | 'ignore';
  extensions?: string[] | false;
  immutable?: boolean;
  redirect?: boolean;
  spa?: boolean;
}

export interface RouteDefinition {
  method: HttpMethod;
  path: Path;
  handler: RouteHandler | ExpressHandler;
  middleware?: (MiddlewareHandler | ExpressMiddleware)[];
  name?: string;
  description?: string;
}

/**
 * Application interface
 */
export interface IApplication {
  listen(port: number | string, hostname?: string | (() => void), callback?: () => void): IApplication;
  close(callback?: () => void): IApplication;
}

/**
 * 🔥 NextRush Application - Enterprise-Grade with Proper Typing
 */
export class Application extends BaseComponent implements IApplication {
  private router: Router;
  private errorHandler: ErrorHandler;
  private httpServer?: HttpServer;
  private appOptions: Required<ApplicationOptions>;
  public events?: SimpleEventEmitter;
  private viewsDirectory?: string;

  constructor(applicationOptions: ApplicationOptions = {}) {
    super('Application');

    this.appOptions = {
      router: applicationOptions.router || new Router(),
      errorHandler: applicationOptions.errorHandler || new ErrorHandler(),
      timeout: applicationOptions.timeout || 30000,
      maxRequestSize: applicationOptions.maxRequestSize || 1024 * 1024,
      enableEvents: applicationOptions.enableEvents !== false,
      enableWebSocket: applicationOptions.enableWebSocket !== false,
      caseSensitive: applicationOptions.caseSensitive || false,
      strict: applicationOptions.strict || false,
      ...applicationOptions,
    };

    this.router = this.appOptions.router;
    this.errorHandler = this.appOptions.errorHandler;

    if (this.appOptions.enableEvents) {
      this.events = new SimpleEventEmitter();
    }
  }

  /**
   * Install method required by BaseComponent
   */
  install(): void {
    // Application is the root component
  }

  // ============================================================================
  // 🎯 HTTP METHODS - COMPREHENSIVE OVERLOADS WITH PROPER TYPE INFERENCE
  // ============================================================================

  /**
   * GET method with comprehensive overloads - Express-style compatibility
   */
  // Overload 1: Just handler (Express-style)
  get(
    path: Path,
    handler: ExpressHandler
  ): Application;

  // Overload 2: Just handler (Context-style)
  get(
    path: Path,
    handler: RouteHandler
  ): Application;

  // Overload 3: One middleware + handler (Express-style)
  get(
    path: Path,
    middleware: ExpressMiddleware,
    handler: ExpressHandler
  ): Application;

  // Overload 4: One middleware + handler (Context-style)  
  get(
    path: Path,
    middleware: ExpressMiddleware,
    handler: RouteHandler
  ): Application;

  // Overload 5: Two middleware + handler (Express-style)
  get(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    handler: ExpressHandler
  ): Application;

  // Overload 6: Two middleware + handler (Context-style)
  get(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    handler: RouteHandler
  ): Application;

  // Overload 7: Three middleware + handler (Express-style)
  get(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    middleware3: ExpressMiddleware,
    handler: ExpressHandler
  ): Application;

  // Overload 8: Three middleware + handler (Context-style)
  get(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    middleware3: ExpressMiddleware,
    handler: RouteHandler
  ): Application;

  // Implementation
  get(path: Path, ...args: (RouteHandler | ExpressHandler | MiddlewareHandler | ExpressMiddleware)[]): Application {
    return this.addRoute('GET', path, args);
  }

  /**
   * POST method with comprehensive overloads - Express-style compatibility
   */
  // Overload 1: Just handler (Express-style)
  post(
    path: Path,
    handler: ExpressHandler
  ): Application;

  // Overload 2: Just handler (Context-style)
  post(
    path: Path,
    handler: RouteHandler
  ): Application;

  // Overload 3: One middleware + handler (Express-style)
  post(
    path: Path,
    middleware: ExpressMiddleware,
    handler: ExpressHandler
  ): Application;

  // Overload 4: One middleware + handler (Context-style)
  post(
    path: Path,
    middleware: ExpressMiddleware,
    handler: RouteHandler
  ): Application;

  // Overload 5: Two middleware + handler (Express-style)
  post(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    handler: ExpressHandler
  ): Application;

  // Overload 6: Two middleware + handler (Context-style)
  post(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    handler: RouteHandler
  ): Application;

  // Implementation
  post(path: Path, ...args: (RouteHandler | ExpressHandler | MiddlewareHandler | ExpressMiddleware)[]): Application {
    return this.addRoute('POST', path, args);
  }

  /**
   * PUT method with comprehensive overloads - Express-style compatibility
   */
  // Overload 1: Just handler (Express-style)
  put(
    path: Path,
    handler: ExpressHandler
  ): Application;

  // Overload 2: Just handler (Context-style)
  put(
    path: Path,
    handler: RouteHandler
  ): Application;

  // Overload 3: One middleware + handler (Express-style)
  put(
    path: Path,
    middleware: ExpressMiddleware,
    handler: ExpressHandler
  ): Application;

  // Overload 4: One middleware + handler (Context-style)
  put(
    path: Path,
    middleware: ExpressMiddleware,
    handler: RouteHandler
  ): Application;

  // Overload 5: Two middleware + handler (Express-style)
  put(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    handler: ExpressHandler
  ): Application;

  // Overload 6: Two middleware + handler (Context-style)
  put(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    handler: RouteHandler
  ): Application;

  // Implementation
  put(path: Path, ...args: (RouteHandler | ExpressHandler | MiddlewareHandler | ExpressMiddleware)[]): Application {
    return this.addRoute('PUT', path, args);
  }

  /**
   * DELETE method with comprehensive overloads - Express-style compatibility
   */
  // Overload 1: Just handler (Express-style)
  delete(
    path: Path,
    handler: ExpressHandler
  ): Application;

  // Overload 2: Just handler (Context-style)
  delete(
    path: Path,
    handler: RouteHandler
  ): Application;

  // Overload 3: One middleware + handler (Express-style)
  delete(
    path: Path,
    middleware: ExpressMiddleware,
    handler: ExpressHandler
  ): Application;

  // Overload 4: One middleware + handler (Context-style)
  delete(
    path: Path,
    middleware: ExpressMiddleware,
    handler: RouteHandler
  ): Application;

  // Overload 5: Two middleware + handler (Express-style)
  delete(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    handler: ExpressHandler
  ): Application;

  // Overload 6: Two middleware + handler (Context-style)
  delete(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    handler: RouteHandler
  ): Application;

  // Implementation
  delete(path: Path, ...args: (RouteHandler | ExpressHandler | MiddlewareHandler | ExpressMiddleware)[]): Application {
    return this.addRoute('DELETE', path, args);
  }

  /**
   * PATCH method with comprehensive overloads - Express-style compatibility
   */
  // Overload 1: Just handler (Express-style)
  patch(
    path: Path,
    handler: ExpressHandler
  ): Application;

  // Overload 2: Just handler (Context-style)
  patch(
    path: Path,
    handler: RouteHandler
  ): Application;

  // Overload 3: One middleware + handler (Express-style)
  patch(
    path: Path,
    middleware: ExpressMiddleware,
    handler: ExpressHandler
  ): Application;

  // Overload 4: One middleware + handler (Context-style)
  patch(
    path: Path,
    middleware: ExpressMiddleware,
    handler: RouteHandler
  ): Application;

  // Overload 5: Two middleware + handler (Express-style)
  patch(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    handler: ExpressHandler
  ): Application;

  // Overload 6: Two middleware + handler (Context-style)
  patch(
    path: Path,
    middleware1: ExpressMiddleware,
    middleware2: ExpressMiddleware,
    handler: RouteHandler
  ): Application;

  // Implementation
  patch(path: Path, ...args: (RouteHandler | ExpressHandler | MiddlewareHandler | ExpressMiddleware)[]): Application {
    return this.addRoute('PATCH', path, args);
  }

  /**
   * HEAD method with comprehensive overloads - Express-style compatibility
   */
  // Overload 1: Just handler (Express-style)
  head(
    path: Path,
    handler: ExpressHandler
  ): Application;

  // Overload 2: Just handler (Context-style)
  head(
    path: Path,
    handler: RouteHandler
  ): Application;

  // Overload 3: One middleware + handler (Express-style)
  head(
    path: Path,
    middleware: ExpressMiddleware,
    handler: ExpressHandler
  ): Application;

  // Overload 4: One middleware + handler (Context-style)
  head(
    path: Path,
    middleware: ExpressMiddleware,
    handler: RouteHandler
  ): Application;

  // Implementation
  head(path: Path, ...args: (RouteHandler | ExpressHandler | MiddlewareHandler | ExpressMiddleware)[]): Application {
    return this.addRoute('HEAD', path, args);
  }

  /**
   * OPTIONS method with comprehensive overloads - Express-style compatibility
   */
  // Overload 1: Just handler (Express-style)
  options(
    path: Path,
    handler: ExpressHandler
  ): Application;

  // Overload 2: Just handler (Context-style)
  options(
    path: Path,
    handler: RouteHandler
  ): Application;

  // Overload 3: One middleware + handler (Express-style)
  options(
    path: Path,
    middleware: ExpressMiddleware,
    handler: ExpressHandler
  ): Application;

  // Overload 4: One middleware + handler (Context-style)
  options(
    path: Path,
    middleware: ExpressMiddleware,
    handler: RouteHandler
  ): Application;

  // Implementation
  options(path: Path, ...args: (RouteHandler | ExpressHandler | MiddlewareHandler | ExpressMiddleware)[]): Application {
    return this.addRoute('OPTIONS', path, args);
  }

  /**
   * ALL method - matches all HTTP methods with comprehensive overloads
   */
  // Overload 1: Just handler (Express-style)
  all(
    path: Path,
    handler: ExpressHandler
  ): Application;

  // Overload 2: Just handler (Context-style)
  all(
    path: Path,
    handler: RouteHandler
  ): Application;

  // Overload 3: One middleware + handler (Express-style)
  all(
    path: Path,
    middleware: ExpressMiddleware,
    handler: ExpressHandler
  ): Application;

  // Overload 4: One middleware + handler (Context-style)
  all(
    path: Path,
    middleware: ExpressMiddleware,
    handler: RouteHandler
  ): Application;

  // Implementation
  all(path: Path, ...args: (RouteHandler | ExpressHandler | MiddlewareHandler | ExpressMiddleware)[]): Application {
    // Register for all HTTP methods
    const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    for (const method of methods) {
      this.addRoute(method, path, args);
    }
    return this;
  }

  // ============================================================================
  // 🎯 MIDDLEWARE - EXPRESS-STYLE USE METHOD
  // ============================================================================

  /**
   * Use middleware with proper overloads
   */
  use(handler: MiddlewareHandler): Application;
  use(handler: ExpressMiddleware): Application;
  use(path: Path, handler: MiddlewareHandler): Application;
  use(path: Path, handler: ExpressMiddleware): Application;
  use(
    pathOrHandler: Path | MiddlewareHandler | ExpressMiddleware,
    handler?: MiddlewareHandler | ExpressMiddleware
  ): Application;
  use(
    pathOrHandler: Path | MiddlewareHandler | ExpressMiddleware,
    handler?: MiddlewareHandler | ExpressMiddleware
  ): Application {
    if (typeof pathOrHandler === 'string' || pathOrHandler instanceof RegExp) {
      if (!handler) throw new Error('Handler is required when path is provided');
      this.router.use(handler);
    } else {
      this.router.use(pathOrHandler);
    }

    return this;
  }

  // ============================================================================
  // 🎯 CREATE ROUTE - MISSING FEATURE IMPLEMENTATION
  // ============================================================================

  /**
   * Create a route definition without immediately registering it
   */
  createRoute(definition: RouteDefinition): Route {
    const { method, path, handler, middleware = [], name } = definition;

    // Convert handler based on its type
    const convertedHandler = this.convertHandler(handler);
    const convertedMiddleware = middleware.map(mw => this.convertMiddleware(mw));

    return {
      id: this.generateRouteId(method, path, name),
      method,
      path,
      handler: convertedHandler,
      middleware: convertedMiddleware,
    };
  }

  /**
   * Register a pre-created route
   */
  addCreatedRoute(route: Route): Application {
    this.router.addRoute(route.method, route.path, route.handler, route.middleware);
    return this;
  }

  /**
   * Create and register route in one step
   */
  route(definition: RouteDefinition): Application {
    const route = this.createRoute(definition);
    return this.addCreatedRoute(route);
  }

  // ============================================================================
  // 🎯 TEMPLATE ENGINE SUPPORT
  // ============================================================================

  /**
   * Set views directory
   */
  setViews(viewsPath: string): Application {
    this.viewsDirectory = viewsPath;
    return this;
  }

  /**
   * Render a template
   */
  async render(view: string, data: Record<string, unknown> = {}): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const fullPath = this.viewsDirectory
      ? path.join(this.viewsDirectory, view)
      : view;

    const template = await fs.readFile(fullPath, 'utf-8');

    // Simple template rendering (can be extended)
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  }

  // ============================================================================
  // 🎯 STATIC FILE SERVING
  // ============================================================================

  /**
   * Serve static files
   */
  static(path: string, root?: string, options?: StaticOptions): Application {
    const staticRoot = root || path;
    const staticOptions = options || {};
    
    // Implementation for static file serving
    this.use(path, async (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      // Static file serving logic here
      console.log(`Serving static files from ${staticRoot} for path ${path}`);
      console.log(`Static options:`, staticOptions);
      // TODO: Implement actual static file serving logic
      next();
    });

    return this;
  }

  // ============================================================================
  // 🎯 SERVER LIFECYCLE - REQUIRED BY Application
  // ============================================================================

  /**
   * Listen on port - Required by Application
   */
  listen(port: number | string, hostname?: string | (() => void), callback?: () => void): Application {
    const portNum = typeof port === 'string' ? parseInt(port, 10) : port;
    
    // Handle overloaded parameters
    let host: string | undefined;
    let cb: (() => void) | undefined;
    
    if (typeof hostname === 'string') {
      host = hostname;
      cb = callback;
    } else if (typeof hostname === 'function') {
      cb = hostname;
    }

    this.httpServer = this.createServer();

    this.httpServer.listen(portNum, host, () => {
      console.log(`🚀 NextRush server listening on port ${portNum}`);
      cb?.();
    });

    return this;
  }

  /**
   * Close the server - Required by Application
   */
  close(callback?: () => void): Application {
    if (this.httpServer) {
      this.httpServer.close((error) => {
        if (error) {
          console.error('Error closing server:', error);
        } else {
          console.log('🛑 NextRush Application closed');
        }
        callback?.();
      });
    } else {
      callback?.();
    }
    
    return this;
  }

  /**
   * Start the server - BaseComponent method
   */
  override async start(): Promise<void> {
    console.log('🚀 NextRush Application starting...');
  }

  /**
   * Stop the server - BaseComponent method
   */
  override async stop(): Promise<void> {
    await this.close();
  }

  // ============================================================================
  // 🎯 PRIVATE HELPER METHODS
  // ============================================================================

  private addRoute(
    method: HttpMethod,
    path: Path,
    args: (RouteHandler | ExpressHandler | MiddlewareHandler | ExpressMiddleware)[]
  ): Application {
    if (args.length === 0) {
      throw new Error(`${method} route requires at least a handler`);
    }

    const handler = args[args.length - 1] as RouteHandler | ExpressHandler;
    const middleware = args.slice(0, -1) as (MiddlewareHandler | ExpressMiddleware)[];

    const convertedHandler = this.convertHandler(handler);
    const convertedMiddleware = middleware.map(mw => this.convertMiddleware(mw));

    this.router.addRoute(method, path, convertedHandler, convertedMiddleware);

    return this;
  }

  private convertHandler(handler: RouteHandler | ExpressHandler): RouteHandler {
    // If it's already a RouteHandler (takes RequestContext), return as is
    if (handler.length === 1) {
      return handler as RouteHandler;
    }

    // Convert ExpressHandler to RouteHandler
    return async (context) => {
      const req = RequestEnhancer.enhance(context.request);
      const res = ResponseEnhancer.enhance(context.response);
      req.params = context.params;
      req.body = context.body;

      await (handler as ExpressHandler)(req, res);
    };
  }

  private convertMiddleware(middleware: MiddlewareHandler | ExpressMiddleware): MiddlewareHandler {
    // If it's already a MiddlewareHandler (takes RequestContext), return as is
    if (middleware.length === 2) {
      return middleware as MiddlewareHandler;
    }

    // Convert ExpressMiddleware to MiddlewareHandler
    return async (context, next) => {
      const req = RequestEnhancer.enhance(context.request);
      const res = ResponseEnhancer.enhance(context.response);
      req.params = context.params;
      req.body = context.body;

      await new Promise<void>((resolve, reject) => {
        const expressNext = (error?: unknown) => {
          if (error) {
            reject(error);
          } else {
            next().then(resolve).catch(reject);
          }
        };

        try {
          const result = (middleware as ExpressMiddleware)(req, res, expressNext);
          if (result instanceof Promise) {
            result.catch(reject);
          }
        } catch (error) {
          reject(error);
        }
      });
    };
  }

  private generateRouteId(method: HttpMethod, path: Path, name?: string): string {
    const base = name || `${method.toLowerCase()}_${String(path).replace(/[^a-zA-Z0-9]/g, '_')}`;
    return `${base}_${Date.now()}`;
  }

  private createServer(): HttpServer {
    return new HttpServer(async (req: IncomingMessage, res: ServerResponse) => {
      try {
        const enhancedReq = RequestEnhancer.enhance(req);
        const enhancedRes = ResponseEnhancer.enhance(res);

        // Create request context for router
        const context = {
          request: enhancedReq,
          response: enhancedRes,
          params: {},
          query: enhancedReq.query || {},
          body: undefined,
          startTime: Date.now()
        };

        await this.router.handle(context);
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));

        // Create minimal context for error handling
        const errorContext = {
          request: RequestEnhancer.enhance(req),
          response: ResponseEnhancer.enhance(res),
          params: {},
          query: {},
          body: undefined,
          startTime: Date.now()
        };

        await this.errorHandler.handle(errorObj, errorContext);
      }
    });
  }
}

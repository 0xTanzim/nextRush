/**
 * Core Application class - main entry point for the framework
 */
import { Server as HttpServer, IncomingMessage, ServerResponse } from 'http';
import { InternalServerError } from '../errors/custom-errors';
import { ErrorHandler } from '../errors/error-handler';
import { RequestEnhancer } from '../http/request/request-enhancer';
import { RequestHandler } from '../http/request/request-handler';
import { ResponseEnhancer } from '../http/response/response-enhancer';
import { Router } from '../routing/router';
import { Disposable } from '../types/common';
import { ExpressHandler, ExpressMiddleware } from '../types/express';
import { ParsedRequest, ParsedResponse, RequestContext } from '../types/http';
import {
  HttpMethod,
  MiddlewareHandler,
  Path,
  RouteHandler,
} from '../types/routing';
import {
  WebSocketHandler,
  WebSocketMiddleware,
  WebSocketOptions,
  WebSocketStats,
} from '../types/websocket';
import { WebSocketIntegration } from '../websocket/integration';
import { SimpleEventEmitter, enableSimpleLogging } from './event-system';

export interface ApplicationOptions {
  router?: Router;
  requestHandler?: RequestHandler;
  errorHandler?: ErrorHandler;
  timeout?: number;
  maxRequestSize?: number;
  enableEvents?: boolean; // NEW: Optional event system
}

export class Application implements Disposable {
  private router: Router;
  private requestHandler: RequestHandler;
  private errorHandler: ErrorHandler;
  private httpServer?: HttpServer;
  private appOptions: Required<ApplicationOptions>;
  public events?: SimpleEventEmitter; // OPTIONAL: Event system

  // 🚀 WebSocket Integration
  private wsIntegration = new WebSocketIntegration();
  public server?: HttpServer; // Expose server for WebSocket integration

  constructor(options: ApplicationOptions = {}) {
    this.appOptions = {
      router: options.router || new Router(),
      requestHandler: options.requestHandler || new RequestHandler(),
      errorHandler: options.errorHandler || new ErrorHandler(),
      timeout: options.timeout || 30000,
      maxRequestSize: options.maxRequestSize || 1024 * 1024,
      enableEvents: options.enableEvents !== false, // Default: enabled
      ...options,
    };

    this.router = this.appOptions.router;
    this.requestHandler = this.appOptions.requestHandler;
    this.errorHandler = this.appOptions.errorHandler;

    // Initialize optional event system
    if (this.appOptions.enableEvents) {
      this.events = new SimpleEventEmitter(true);

      // Enable simple logging in development
      if (process.env.NODE_ENV !== 'production') {
        enableSimpleLogging(this.events);
      }
    }
  }

  /**
   * Add event listeners (only if events are enabled)
   */
  on(event: string, listener: (...args: any[]) => void): this {
    if (this.events) {
      this.events.on(event, listener);
    }
    return this;
  }

  /**
   * Remove event listeners (only if events are enabled)
   */
  off(event: string, listener: (...args: any[]) => void): this {
    if (this.events) {
      this.events.off(event, listener);
    }
    return this;
  }

  /**
   * Enable or disable event tracking
   */
  enableEvents(enabled: boolean): this {
    if (this.events) {
      this.events.setEnabled(enabled);
    }
    return this;
  }

  /**
   * Add middleware or mount router (Express-style) - supports global, path-specific, and router mounting
   */
  use(middleware: MiddlewareHandler | ExpressMiddleware): this;
  use(path: string, middleware: MiddlewareHandler | ExpressMiddleware): this;
  use(path: string, router: Router): this;
  use(router: Router): this;
  use(
    pathOrMiddlewareOrRouter:
      | string
      | MiddlewareHandler
      | ExpressMiddleware
      | Router,
    middlewareOrRouter?: MiddlewareHandler | ExpressMiddleware | Router
  ): this {
    // Case 1: app.use(router)
    if (pathOrMiddlewareOrRouter instanceof Router && !middlewareOrRouter) {
      return this.mountRouter('/', pathOrMiddlewareOrRouter);
    }

    // Case 2: app.use('/path', router)
    if (
      typeof pathOrMiddlewareOrRouter === 'string' &&
      middlewareOrRouter instanceof Router
    ) {
      return this.mountRouter(pathOrMiddlewareOrRouter, middlewareOrRouter);
    }

    // Case 3: app.use('/path', middleware)
    if (typeof pathOrMiddlewareOrRouter === 'string' && middlewareOrRouter) {
      const path = pathOrMiddlewareOrRouter;
      const mw = middlewareOrRouter as MiddlewareHandler | ExpressMiddleware;

      if (this.isExpressMiddleware(mw)) {
        const contextMiddleware: MiddlewareHandler = async (context, next) => {
          // Only apply middleware if path matches
          if (!context.request.url?.startsWith(path)) {
            return next();
          }

          const req = RequestEnhancer.enhance(context.request);
          const res = ResponseEnhancer.enhance(context.response);
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
              const result = mw(req, res, expressNext);
              if (result instanceof Promise) {
                result.catch(reject);
              }
            } catch (error) {
              reject(error);
            }
          });
        };

        this.router.use(contextMiddleware);
      } else {
        // NextRush-style middleware with path filter
        const pathFilteredMiddleware: MiddlewareHandler = async (
          context,
          next
        ) => {
          if (!context.request.url?.startsWith(path)) {
            return next();
          }
          await mw(context, next);
        };

        this.router.use(pathFilteredMiddleware);
      }
    } else {
      // Case 4: app.use(middleware) - Global middleware
      const mw = pathOrMiddlewareOrRouter as
        | MiddlewareHandler
        | ExpressMiddleware;

      if (this.isExpressMiddleware(mw)) {
        const contextMiddleware: MiddlewareHandler = async (context, next) => {
          const req = RequestEnhancer.enhance(context.request);
          const res = ResponseEnhancer.enhance(context.response);
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
              const result = mw(req, res, expressNext);
              if (result instanceof Promise) {
                result.catch(reject);
              }
            } catch (error) {
              reject(error);
            }
          });
        };

        this.router.use(contextMiddleware);
      } else {
        this.router.use(mw);
      }
    }

    return this;
  }

  /**
   * Register a GET route (supports both Express and context style)
   * Supports middleware as parameters: app.get('/path', middleware1, middleware2, handler)
   */
  get(path: Path, ...args: any[]): this {
    return this.addRoute('GET', path, ...args);
  }

  /**
   * Register a POST route (supports both Express and context style)
   * Supports middleware as parameters: app.post('/path', middleware1, middleware2, handler)
   */
  post(path: Path, ...args: any[]): this {
    return this.addRoute('POST', path, ...args);
  }

  /**
   * Register a PUT route (supports both Express and context style)
   * Supports middleware as parameters: app.put('/path', middleware1, middleware2, handler)
   */
  put(path: Path, ...args: any[]): this {
    return this.addRoute('PUT', path, ...args);
  }

  /**
   * Register a DELETE route (supports both Express and context style)
   * Supports middleware as parameters: app.delete('/path', middleware1, middleware2, handler)
   */
  delete(path: Path, ...args: any[]): this {
    return this.addRoute('DELETE', path, ...args);
  }

  /**
   * Register a PATCH route (supports both Express and context style)
   * Supports middleware as parameters: app.patch('/path', middleware1, middleware2, handler)
   */
  patch(path: Path, ...args: any[]): this {
    return this.addRoute('PATCH', path, ...args);
  }

  /**
   * Register a HEAD route (supports both Express and context style)
   * Supports middleware as parameters: app.head('/path', middleware1, middleware2, handler)
   */
  head(path: Path, ...args: any[]): this {
    return this.addRoute('HEAD', path, ...args);
  }

  /**
   * Register an OPTIONS route (supports both Express and context style)
   * Supports middleware as parameters: app.options('/path', middleware1, middleware2, handler)
   */
  options(path: Path, ...args: any[]): this {
    return this.addRoute('OPTIONS', path, ...args);
  }

  /**
   * Register a route for all HTTP methods
   * Supports middleware as parameters: app.all('/path', middleware1, middleware2, handler)
   */
  all(path: Path, ...args: any[]): this {
    const methods: HttpMethod[] = [
      'GET',
      'POST',
      'PUT',
      'DELETE',
      'PATCH',
      'HEAD',
      'OPTIONS',
    ];
    methods.forEach((method) => {
      this.addRoute(method, path, ...args);
    });
    return this;
  }

  /**
   * Start the HTTP server
   */
  listen(port: number, callback?: () => void): Promise<void>;
  listen(port: number, hostname: string, callback?: () => void): Promise<void>;
  listen(
    port: number,
    hostnameOrCallback?: string | (() => void),
    callback?: () => void
  ): Promise<void> {
    let hostname: string | undefined;
    let cb: (() => void) | undefined;

    // Handle overloads
    if (typeof hostnameOrCallback === 'string') {
      hostname = hostnameOrCallback;
      cb = callback;
    } else if (typeof hostnameOrCallback === 'function') {
      cb = hostnameOrCallback;
    }

    return new Promise((resolve, reject) => {
      try {
        this.httpServer = new HttpServer(this.handleRequest.bind(this));
        this.server = this.httpServer; // Expose server for WebSocket integration

        this.httpServer.timeout = this.appOptions.timeout;

        this.httpServer.listen(port, hostname, () => {
          console.log(`Server listening on ${hostname || 'localhost'}:${port}`);
          if (cb) cb();
          resolve();
        });

        this.httpServer.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the HTTP server
   */
  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.httpServer) {
        resolve();
        return;
      }

      this.httpServer.close((error) => {
        if (error) {
          reject(error);
        } else {
          console.log('Server closed');
          resolve();
        }
      });
    });
  }

  /**
   * Handle incoming HTTP requests with optional event tracking
   */
  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const startTime = Date.now();

    // Start request tracking (only if events enabled)
    const requestId = this.events?.emitRequestStart(req) || '';

    try {
      // Parse the request
      const parsedRequest = await this.requestHandler.handle(req);
      const parsedResponse = res as ParsedResponse;

      // Initialize response locals
      parsedResponse.locals = {};

      // Create request context
      const context: RequestContext = {
        request: parsedRequest,
        response: parsedResponse,
        params: {},
        query: parsedRequest.query,
        body: parsedRequest.body,
        startTime,
      };

      // Route the request
      await this.router.handle(context);

      // If no response was sent, send empty 200
      if (!res.headersSent) {
        res.statusCode = 200;
        res.end();
      }

      // End request tracking (only if events enabled)
      this.events?.emitRequestEnd(req, res, requestId, startTime);
    } catch (error) {
      // Handle errors
      const context: RequestContext = {
        request: req as ParsedRequest,
        response: res as ParsedResponse,
        params: {},
        query: {},
        body: null,
        startTime,
      };

      const normalizedError =
        error instanceof Error
          ? error
          : new InternalServerError('Unknown error occurred', {
              originalError: error,
            });

      // Emit error event (only if events enabled)
      this.events?.emitError(req, normalizedError, requestId);

      await this.errorHandler.handle(normalizedError, context);
    }
  }

  /**
   * Get application statistics
   */
  getStats() {
    return {
      routes: this.router.getStats(),
      server: {
        timeout: this.appOptions.timeout,
        maxRequestSize: this.appOptions.maxRequestSize,
        isListening: !!this.httpServer?.listening,
      },
    };
  }

  /**
   * Mount a sub-router at a path
   */
  mount(path: string, router: Router): this {
    this.router.mount(path, router);
    return this;
  }

  /**
   * Get the underlying router
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * Configure the application
   */
  configure(options: Partial<ApplicationOptions>): void {
    Object.assign(this.appOptions, options);

    if (options.router) {
      this.router = options.router;
    }

    if (options.requestHandler) {
      this.requestHandler = options.requestHandler;
    }

    if (options.errorHandler) {
      this.errorHandler = options.errorHandler;
    }
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    await this.close();
  }

  /**
   * Generic route registration that handles middleware and handlers flexibly
   */
  private addRoute(method: string, path: Path, ...args: any[]): this {
    if (args.length === 0) {
      throw new Error(`${method} route ${path} requires at least a handler`);
    }

    // Last argument is always the handler
    const handler = args[args.length - 1];

    // Everything before the handler is middleware
    const middlewares = args.slice(0, -1);

    // Convert handler
    const contextHandler = this.convertHandler(handler);

    // Convert middleware
    const contextMiddleware = middlewares.map((mw: any) =>
      this.convertMiddleware(mw)
    );

    // Register with router
    switch (method.toUpperCase()) {
      case 'GET':
        this.router.get(path, contextHandler, ...contextMiddleware);
        break;
      case 'POST':
        this.router.post(path, contextHandler, ...contextMiddleware);
        break;
      case 'PUT':
        this.router.put(path, contextHandler, ...contextMiddleware);
        break;
      case 'DELETE':
        this.router.delete(path, contextHandler, ...contextMiddleware);
        break;
      case 'PATCH':
        this.router.patch(path, contextHandler, ...contextMiddleware);
        break;
      case 'HEAD':
        this.router.head(path, contextHandler, ...contextMiddleware);
        break;
      case 'OPTIONS':
        this.router.options(path, contextHandler, ...contextMiddleware);
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }

    return this;
  }

  /**
   * Apply a middleware preset for common configurations
   * Usage: app.usePreset('security', { cors: { origin: 'https://example.com' } })
   */
  usePreset(presetName: string, options: any = {}): this {
    const { presets } = require('../middleware/presets');

    if (!presets[presetName]) {
      throw new Error(
        `Unknown preset: ${presetName}. Available presets: ${Object.keys(
          presets
        ).join(', ')}`
      );
    }

    const preset = presets[presetName](options);
    console.log(`🎯 Applying ${preset.name} preset: ${preset.description}`);

    preset.middlewares.forEach((middleware: any) => {
      this.use(middleware);
    });

    return this;
  }

  /**
   * Apply middleware to a group/array for easier management
   * Usage: app.useGroup([middleware1, middleware2, middleware3])
   */
  useGroup(middlewares: any[]): this {
    middlewares.forEach((middleware) => {
      this.use(middleware);
    });
    return this;
  }

  /**
   * Create a route group with shared middleware
   * Usage: app.group('/api', [auth, validation], (router) => { router.get('/users', handler) })
   */
  group(
    path: string,
    middlewares: any[],
    callback: (router: any) => void
  ): this {
    // Apply path-specific middleware
    middlewares.forEach((middleware) => {
      this.use(path, middleware);
    });

    // Create a router-like object for the callback
    const groupRouter = {
      get: (subPath: string, ...args: any[]) => {
        const fullPath = path + subPath;
        return this.get(fullPath, ...args);
      },
      post: (subPath: string, ...args: any[]) => {
        const fullPath = path + subPath;
        return this.post(fullPath, ...args);
      },
      put: (subPath: string, ...args: any[]) => {
        const fullPath = path + subPath;
        return this.put(fullPath, ...args);
      },
      delete: (subPath: string, ...args: any[]) => {
        const fullPath = path + subPath;
        return this.delete(fullPath, ...args);
      },
      patch: (subPath: string, ...args: any[]) => {
        const fullPath = path + subPath;
        return this.patch(fullPath, ...args);
      },
    };

    callback(groupRouter);
    return this;
  }

  /**
   * Internal method to mount router with proper context handling
   */
  private mountRouter(path: string, router: Router): this {
    // Use the existing mount method which delegates to the router
    return this.mount(path, router);
  }

  // Helper methods for converting Express-style handlers to context handlers
  private isExpressMiddleware(
    middleware: MiddlewareHandler | ExpressMiddleware
  ): middleware is ExpressMiddleware {
    return middleware.length === 3; // Express middleware has (req, res, next)
  }

  private isExpressHandler(
    handler: RouteHandler | ExpressHandler
  ): handler is ExpressHandler {
    return handler.length === 2; // Express handler has (req, res)
  }

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
          const nextFn = (error?: any) => {
            if (error) reject(error);
            else resolve();
          };

          try {
            const result = middleware(req, res, nextFn);
            if (result instanceof Promise) {
              result.catch(reject);
            }
          } catch (error) {
            reject(error);
          }
        });

        await next();
      };
    }
    return middleware;
  }

  // 🚀 WebSocket Methods

  /**
   * Enable WebSocket support with zero dependencies
   */
  enableWebSocket(options: WebSocketOptions = {}): this {
    if (!this.server) {
      // Create server if it doesn't exist
      this.server = this.httpServer = require('http').createServer();
    }
    this.wsIntegration.initWebSocket(this, options);
    return this;
  }

  /**
   * Add WebSocket route handler
   */
  ws(path: string, handler: WebSocketHandler): this {
    this.wsIntegration.ws(path, handler);
    return this;
  }

  /**
   * Add WebSocket middleware
   */
  wsUse(middleware: WebSocketMiddleware): this {
    this.wsIntegration.wsUse(middleware);
    return this;
  }

  /**
   * Get WebSocket statistics
   */
  getWebSocketStats(): WebSocketStats | null {
    return this.wsIntegration.getWebSocketStats();
  }

  /**
   * Broadcast to all WebSocket connections
   */
  wsBroadcast(data: any, room?: string): void {
    this.wsIntegration.broadcast(data, room);
  }
}

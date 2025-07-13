/**
 * Core application class - main entry point for the framework
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
import { MiddlewareHandler, Path, RouteHandler } from '../types/routing';

export interface ApplicationOptions {
  router?: Router;
  requestHandler?: RequestHandler;
  errorHandler?: ErrorHandler;
  timeout?: number;
  maxRequestSize?: number;
}

export class Application implements Disposable {
  private router: Router;
  private requestHandler: RequestHandler;
  private errorHandler: ErrorHandler;
  private httpServer?: HttpServer;
  private appOptions: Required<ApplicationOptions>;

  constructor(options: ApplicationOptions = {}) {
    this.appOptions = {
      router: options.router || new Router(),
      requestHandler: options.requestHandler || new RequestHandler(),
      errorHandler: options.errorHandler || new ErrorHandler(),
      timeout: options.timeout || 30000,
      maxRequestSize: options.maxRequestSize || 1024 * 1024,
      ...options,
    };

    this.router = this.appOptions.router;
    this.requestHandler = this.appOptions.requestHandler;
    this.errorHandler = this.appOptions.errorHandler;
  }

  /**
   * Add global middleware (Express-style)
   */
  use(middleware: MiddlewareHandler | ExpressMiddleware): this {
    if (this.isExpressMiddleware(middleware)) {
      // Convert Express middleware to context middleware
      const contextMiddleware: MiddlewareHandler = async (context, next) => {
        const req = RequestEnhancer.enhance(context.request);
        const res = ResponseEnhancer.enhance(context.response);

        // Set params from context
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
      this.router.use(contextMiddleware);
    } else {
      this.router.use(middleware);
    }
    return this;
  }

  /**
   * Register a GET route (supports both Express and context style)
   */
  get(
    path: Path,
    handler: RouteHandler | ExpressHandler,
    ...middleware: (MiddlewareHandler | ExpressMiddleware)[]
  ): this {
    const contextHandler = this.convertHandler(handler);
    const contextMiddleware = middleware.map((mw) =>
      this.convertMiddleware(mw)
    );
    this.router.get(path, contextHandler, ...contextMiddleware);
    return this;
  }

  /**
   * Register a POST route (supports both Express and context style)
   */
  post(
    path: Path,
    handler: RouteHandler | ExpressHandler,
    ...middleware: (MiddlewareHandler | ExpressMiddleware)[]
  ): this {
    const contextHandler = this.convertHandler(handler);
    const contextMiddleware = middleware.map((mw) =>
      this.convertMiddleware(mw)
    );
    this.router.post(path, contextHandler, ...contextMiddleware);
    return this;
  }

  /**
   * Register a PUT route (supports both Express and context style)
   */
  put(
    path: Path,
    handler: RouteHandler | ExpressHandler,
    ...middleware: (MiddlewareHandler | ExpressMiddleware)[]
  ): this {
    const contextHandler = this.convertHandler(handler);
    const contextMiddleware = middleware.map((mw) =>
      this.convertMiddleware(mw)
    );
    this.router.put(path, contextHandler, ...contextMiddleware);
    return this;
  }

  /**
   * Register a DELETE route (supports both Express and context style)
   */
  delete(
    path: Path,
    handler: RouteHandler | ExpressHandler,
    ...middleware: (MiddlewareHandler | ExpressMiddleware)[]
  ): this {
    const contextHandler = this.convertHandler(handler);
    const contextMiddleware = middleware.map((mw) =>
      this.convertMiddleware(mw)
    );
    this.router.delete(path, contextHandler, ...contextMiddleware);
    return this;
  }

  /**
   * Register a PATCH route (supports both Express and context style)
   */
  patch(
    path: Path,
    handler: RouteHandler | ExpressHandler,
    ...middleware: (MiddlewareHandler | ExpressMiddleware)[]
  ): this {
    const contextHandler = this.convertHandler(handler);
    const contextMiddleware = middleware.map((mw) =>
      this.convertMiddleware(mw)
    );
    this.router.patch(path, contextHandler, ...contextMiddleware);
    return this;
  }

  /**
   * Register a HEAD route (supports both Express and context style)
   */
  head(
    path: Path,
    handler: RouteHandler | ExpressHandler,
    ...middleware: (MiddlewareHandler | ExpressMiddleware)[]
  ): this {
    const contextHandler = this.convertHandler(handler);
    const contextMiddleware = middleware.map((mw) =>
      this.convertMiddleware(mw)
    );
    this.router.head(path, contextHandler, ...contextMiddleware);
    return this;
  }

  /**
   * Register an OPTIONS route (supports both Express and context style)
   */
  options(
    path: Path,
    handler: RouteHandler | ExpressHandler,
    ...middleware: (MiddlewareHandler | ExpressMiddleware)[]
  ): this {
    const contextHandler = this.convertHandler(handler);
    const contextMiddleware = middleware.map((mw) =>
      this.convertMiddleware(mw)
    );
    this.router.options(path, contextHandler, ...contextMiddleware);
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
   * Handle incoming HTTP requests
   */
  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const startTime = Date.now();

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
}

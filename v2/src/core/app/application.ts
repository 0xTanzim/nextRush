/**
 * Core Application class for NextRush v2
 *
 * @packageDocumentation
 */

import { createContext } from '@/core/app/context';
import { RequestEnhancer } from '@/core/enhancers/request-enhancer';
import { ResponseEnhancer } from '@/core/enhancers/response-enhancer';
import { Router as RouterClass } from '@/core/router';
import { NextRushError } from '@/errors/custom-errors';
import type {
  Application,
  Context,
  Middleware,
  RouteConfig,
  RouteHandler,
  Router,
} from '@/types/context';
import type { ApplicationOptions } from '@/types/http';
import { EventEmitter } from 'node:events';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';

// Import built-in middleware
import { json, urlencoded } from '@/core/middleware/body-parser';
import { compression } from '@/core/middleware/compression';
import { cors } from '@/core/middleware/cors';
import { helmet } from '@/core/middleware/helmet';
import { logger } from '@/core/middleware/logger';
import { rateLimit } from '@/core/middleware/rate-limiter';
import { requestId } from '@/core/middleware/request-id';
import { timer } from '@/core/middleware/timer';
import type {
  CompressionOptions,
  CorsOptions,
  HelmetOptions,
  JsonOptions,
  LoggerOptions,
  RateLimiterOptions,
  RequestIdOptions,
  TimerOptions,
  UrlencodedOptions,
} from '@/core/middleware/types';

/**
 * NextRush Application class with Koa-style middleware and Express-like design
 *
 * @example
 * ```typescript
 * import { createApp } from 'nextrush-v2';
 *
 * const app = createApp({ port: 3000 });
 *
 * app.use(async (ctx, next) => {
 *   console.log(`${ctx.method} ${ctx.path}`);
 *   await next();
 * });
 *
 * app.get('/hello', async (ctx) => {
 *   ctx.res.json({ message: 'Hello, World!' });
 * });
 *
 * app.listen(3000, () => {
 *   console.log('Server running on http://localhost:3000');
 * });
 * ```
 */
export class NextRushApplication extends EventEmitter implements Application {
  private server: Server;
  private middleware: Middleware[] = [];
  private routes: Map<string, RouteHandler> = new Map();
  private options: Required<ApplicationOptions>;
  private isShuttingDown = false;

  constructor(options: ApplicationOptions = {}) {
    super();

    this.options = {
      port: 3000,
      host: 'localhost',
      debug: false,
      trustProxy: false,
      maxBodySize: 1024 * 1024, // 1MB
      timeout: 30000, // 30 seconds
      cors: true,
      static: 'public',
      template: {
        engine: 'simple',
        directory: 'views',
      },
      ...options,
    };

    this.server = this.createServer();
    this.setupEventHandlers();
  }

  /**
   * Create the HTTP server
   */
  private createServer(): Server {
    return createServer(async (req: IncomingMessage, res: ServerResponse) => {
      // Handle the request stream manually to prevent it from being consumed
      await this.handleRequest(req, res);
    });
  }

  /**
   * Setup event handlers for graceful shutdown
   */
  private setupEventHandlers(): void {
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    try {
      // Create context with raw request for body parsing
      const ctx = createContext(req as any, res as any, this.options);

      // Execute middleware (body parser will work with raw request)
      await this.executeMiddleware(ctx);

      // Enhance request and response after body parsing
      const enhancedReq = RequestEnhancer.enhance(req);
      const enhancedRes = ResponseEnhancer.enhance(res);
      ctx.req = enhancedReq as any;
      ctx.res = enhancedRes as any;
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Execute middleware stack
   */
  private async executeMiddleware(ctx: Context): Promise<void> {
    let index = -1;

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) {
        throw new Error('next() called multiple times');
      }
      index = i;

      if (i >= this.middleware.length) {
        // Execute route handler when middleware is complete
        await this.executeRoute(ctx);

        return;
      }

      const middleware = this.middleware[i];
      if (middleware) {
        console.log(`Executing middleware ${i + 1}/${this.middleware.length}`);
        await middleware(ctx, () => dispatch(i + 1));
      } else {
        await dispatch(i + 1);
      }
    };

    console.log(`Total middleware count: ${this.middleware.length}`);
    await dispatch(0);
  }

  /**
   * Execute route handler
   */
  private async executeRoute(ctx: Context): Promise<void> {
    const routeKey = `${ctx.method}:${ctx.path}`;
    let handler = this.routes.get(routeKey);

    // If exact match not found, try parameterized route matching
    if (!handler) {
      for (const [registeredRouteKey, routeHandler] of this.routes) {
        const colonIndex = registeredRouteKey.indexOf(':');
        if (colonIndex === -1) continue;

        const registeredMethod = registeredRouteKey.substring(0, colonIndex);
        const registeredPath = registeredRouteKey.substring(colonIndex + 1);

        if (
          registeredMethod === ctx.method &&
          registeredPath &&
          this.matchRoute(registeredPath, ctx.path, ctx)
        ) {
          handler = routeHandler;
          break;
        }
      }
    }

    if (handler) {
      await handler(ctx);
    } else {
      ctx.status = 404;
      ctx.res.statusCode = 404;
      ctx.res.json({ error: 'Not Found' });
    }
  }

  /**
   * Match route with parameters
   */
  private matchRoute(pattern: string, path: string, ctx: Context): boolean {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) {
      return false;
    }

    const params: Record<string, string> = {};

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];

      if (patternPart && patternPart.startsWith(':')) {
        // This is a parameter
        const paramName = patternPart.slice(1);
        if (pathPart) {
          params[paramName] = pathPart;
        }
      } else if (patternPart !== pathPart) {
        // Static parts must match exactly
        return false;
      }
    }

    // Set the params in the context
    ctx.params = params;
    return true;
  }

  /**
   * Handle errors
   */
  private handleError(error: unknown, res: ServerResponse): void {
    const statusCode = error instanceof NextRushError ? error.statusCode : 500;
    const message =
      error instanceof Error ? error.message : 'Internal Server Error';

    // Check if headers have already been sent
    if (!res.headersSent) {
      res.statusCode = statusCode;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: message, statusCode }));
    }

    this.emit('error', error);
  }

  /**
   * Register GET route
   */
  public get(path: string, handler: RouteHandler | RouteConfig): this {
    this.registerRoute('GET', path, handler);
    return this;
  }

  /**
   * Register POST route
   */
  public post(path: string, handler: RouteHandler | RouteConfig): this {
    this.registerRoute('POST', path, handler);
    return this;
  }

  /**
   * Register PUT route
   */
  public put(path: string, handler: RouteHandler | RouteConfig): this {
    this.registerRoute('PUT', path, handler);
    return this;
  }

  /**
   * Register DELETE route
   */
  public delete(path: string, handler: RouteHandler | RouteConfig): this {
    this.registerRoute('DELETE', path, handler);
    return this;
  }

  /**
   * Register PATCH route
   */
  public patch(path: string, handler: RouteHandler | RouteConfig): this {
    this.registerRoute('PATCH', path, handler);
    return this;
  }

  /**
   * Register middleware or router
   */
  public use(middleware: Middleware): this;
  /**
   * Register router with prefix
   */
  public use(prefix: string, router: Router): this;
  public use(middlewareOrPrefix: Middleware | string, router?: Router): this {
    if (
      typeof middlewareOrPrefix === 'function' ||
      typeof middlewareOrPrefix === 'object'
    ) {
      // Register middleware
      console.log('Registering middleware:', typeof middlewareOrPrefix);
      this.middleware.push(middlewareOrPrefix as Middleware);
    } else if (router) {
      // Register router with prefix
      const routerRoutes = router.getRoutes();
      const routerMiddleware = router.getMiddleware();

      // Add router middleware
      this.middleware.push(...routerMiddleware);

      // Add router routes with prefix
      for (const [routeKey, handler] of routerRoutes) {
        const [method, path] = routeKey.split(':');
        const fullPath = `${middlewareOrPrefix}${path}`;
        this.routes.set(`${method}:${fullPath}`, handler);
      }
    }

    return this;
  }

  /**
   * Create a new router instance
   */
  public router(): Router {
    return new RouterClass();
  }

  /**
   * Register a route with the application
   */
  private registerRoute(
    method: string,
    path: string,
    handler: RouteHandler | RouteConfig
  ): void {
    const routeKey = `${method}:${path}`;

    if (typeof handler === 'object') {
      // Fastify-style route config
      this.routes.set(routeKey, handler.handler);

      // Add route-specific middleware
      if (handler.middleware) {
        this.middleware.push(...handler.middleware);
      }
    } else {
      // Simple handler function
      this.routes.set(routeKey, handler);
    }
  }

  /**
   * Start the server
   */
  public listen(port?: number, host?: string, callback?: () => void): Server {
    const listenPort = port ?? this.options.port;
    const listenHost = host ?? this.options.host;

    this.server.listen(listenPort, listenHost, () => {
      this.emit('listening', { port: listenPort, host: listenHost });
      callback?.();
    });

    return this.server;
  }

  /**
   * Get the underlying HTTP server
   */
  public getServer(): Server {
    return this.server;
  }

  /**
   * Gracefully shutdown the application
   */
  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;
    this.emit('shutdown');

    return new Promise(resolve => {
      this.server.close(() => {
        this.emit('closed');
        resolve();
      });
    });
  }

  // ==================== MIDDLEWARE FACTORY METHODS ====================

  /**
   * Create CORS middleware
   *
   * @param options - CORS configuration options
   * @returns CORS middleware function
   *
   * @example
   * ```typescript
   * const app = createApp();
   *
   * // Basic CORS
   * app.use(app.cors());
   *
   * // Advanced CORS
   * app.use(app.cors({
   *   origin: ['https://app.example.com'],
   *   credentials: true,
   *   methods: ['GET', 'POST', 'PUT', 'DELETE'],
   * }));
   * ```
   */
  public cors(options: CorsOptions = {}): Middleware {
    return cors(options);
  }

  /**
   * Create helmet middleware
   *
   * @param options - Helmet configuration options
   * @returns Helmet middleware function
   *
   * @example
   * ```typescript
   * const app = createApp();
   *
   * // Basic security headers
   * app.use(app.helmet());
   *
   * // Advanced security headers
   * app.use(app.helmet({
   *   contentSecurityPolicy: {
   *     directives: {
   *       defaultSrc: ["'self'"],
   *       scriptSrc: ["'self'"],
   *     },
   *   },
   * }));
   * ```
   */
  public helmet(options: HelmetOptions = {}): Middleware {
    return helmet(options);
  }

  /**
   * Create body parser middleware
   *
   * @param options - Body parser configuration options
   * @returns Body parser middleware function
   *
   * @example
   * ```typescript
   * const app = createApp();
   *
   * // JSON body parser
   * app.use(app.json({ limit: '10mb' }));
   *
   * // URL-encoded body parser
   * app.use(app.urlencoded({ extended: true }));
   * ```
   */
  public json(options: JsonOptions = {}): Middleware {
    return json(options);
  }

  /**
   * Create URL-encoded body parser middleware
   *
   * @param options - URL-encoded parser configuration options
   * @returns URL-encoded parser middleware function
   */
  public urlencoded(options: UrlencodedOptions = {}): Middleware {
    return urlencoded(options);
  }

  /**
   * Create rate limiter middleware
   *
   * @param options - Rate limiter configuration options
   * @returns Rate limiter middleware function
   *
   * @example
   * ```typescript
   * const app = createApp();
   *
   * // Basic rate limiting
   * app.use(app.rateLimit({
   *   windowMs: 15 * 60 * 1000, // 15 minutes
   *   max: 100, // limit each IP to 100 requests per windowMs
   * }));
   * ```
   */
  public rateLimit(options: RateLimiterOptions = {}): Middleware {
    return rateLimit(options);
  }

  /**
   * Create logger middleware
   *
   * @param options - Logger configuration options
   * @returns Logger middleware function
   *
   * @example
   * ```typescript
   * const app = createApp();
   *
   * // Basic logging
   * app.use(app.logger());
   *
   * // Detailed logging
   * app.use(app.logger({
   *   format: 'detailed',
   *   includeHeaders: true,
   * }));
   * ```
   */
  public logger(options: LoggerOptions = {}): Middleware {
    return logger(options);
  }

  /**
   * Create compression middleware
   *
   * @param options - Compression configuration options
   * @returns Compression middleware function
   */
  public compression(options: CompressionOptions = {}): Middleware {
    return compression(options);
  }

  /**
   * Create request ID middleware
   *
   * @param options - Request ID configuration options
   * @returns Request ID middleware function
   */
  public requestId(options: RequestIdOptions = {}): Middleware {
    return requestId(options);
  }

  /**
   * Create timer middleware
   *
   * @param options - Timer configuration options
   * @returns Timer middleware function
   */
  public timer(options: TimerOptions = {}): Middleware {
    return timer(options);
  }
}

/**
 * Create a new NextRush application instance
 *
 * @param options - Application configuration options
 * @returns Application instance
 *
 * @example
 * ```typescript
 * import { createApp } from 'nextrush-v2';
 *
 * const app = createApp({
 *   port: 3000,
 *   host: 'localhost',
 *   cors: true,
 * });
 *
 * app.use(app.cors());
 * app.use(app.helmet());
 *
 * app.get('/hello', (ctx) => {
 *   ctx.res.json({ message: 'Hello, World!' });
 * });
 *
 * app.listen(3000, () => {
 *   console.log('Server running on http://localhost:3000');
 * });
 * ```
 */
export function createApp(options?: ApplicationOptions): Application {
  return new NextRushApplication(options);
}

// Type exports
export type { Application, ApplicationOptions };

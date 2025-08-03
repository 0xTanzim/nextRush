/**
 * Core Application class for NextRush v2
 *
 * @packageDocumentation
 */

import { createContext } from '@/core/app/context';
import { RequestEnhancer } from '@/core/enhancers/request-enhancer';
import { ResponseEnhancer } from '@/core/enhancers/response-enhancer';
import { Router as RouterClass } from '@/core/router';
import { HighPerformanceRouter } from '@/core/router/high-performance-router';
import {
  GlobalExceptionFilter,
  NextRushError,
  type ExceptionFilter,
} from '@/errors/custom-errors';
import {
  LoggerPlugin,
  createDevLogger,
  createProdLogger,
} from '@/plugins/logger';
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
import { json, raw, text, urlencoded } from '@/core/middleware/body-parser';
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
  private highPerformanceRouter: HighPerformanceRouter =
    new HighPerformanceRouter();
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
      keepAlive: 10000, // 10 seconds
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
        // Only log in debug mode for performance
        if (this.options.debug) {
          console.log(
            `Executing middleware ${i + 1}/${this.middleware.length}`
          );
        }
        await middleware(ctx, () => dispatch(i + 1));
      } else {
        await dispatch(i + 1);
      }
    };

    // Only log in debug mode for performance
    if (this.options.debug) {
      console.log(`Total middleware count: ${this.middleware.length}`);
    }
    await dispatch(0);
  }

  /**
   * Execute route with high-performance router
   */
  private async executeRoute(ctx: Context): Promise<void> {
    const match = this.highPerformanceRouter.find(ctx.method, ctx.path);

    if (match) {
      // Set parameters from router match
      ctx.params = match.params;
      await match.handler(ctx);
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
    } else if (router && typeof middlewareOrPrefix === 'string') {
      // Register router with prefix
      const routerRoutes = router.getRoutes();
      const routerMiddleware = router.getMiddleware();

      // Add router middleware
      this.middleware.push(...routerMiddleware);

      // Add router routes with prefix
      for (const [routeKey, handler] of routerRoutes) {
        const [method, path] = routeKey.split(':');
        if (method && path) {
          const fullPath = `${middlewareOrPrefix}${path}`;
          this.highPerformanceRouter.register(method, fullPath, handler);
        }
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
   * Register a route with high-performance router
   */
  private registerRoute(
    method: string,
    path: string,
    handler: RouteHandler | RouteConfig
  ): void {
    const routeHandler =
      typeof handler === 'object' ? handler.handler : handler;
    this.highPerformanceRouter.register(method, path, routeHandler);
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

  public text(options: { limit?: string; type?: string } = {}): Middleware {
    return text(options);
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

  /**
   * Create automatic smart body parser middleware
   *
   * Automatically detects and parses request bodies based on content-type:
   * - application/json -> JSON parsing
   * - application/x-www-form-urlencoded -> URL-encoded parsing
   * - text/* -> Text parsing
   * - multipart/form-data -> Form data parsing (basic)
   *
   * @param options - Smart body parser configuration options
   * @returns Smart body parser middleware function
   *
   * @example
   * ```typescript
   * const app = createApp();
   *
   * // Automatic body parsing
   * app.use(app.smartBodyParser());
   *
   * // With custom options
   * app.use(app.smartBodyParser({
   *   json: { limit: '10mb' },
   *   urlencoded: { extended: true },
   *   text: { limit: '1mb' }
   * }));
   * ```
   */
  public smartBodyParser(
    options: {
      json?: JsonOptions;
      urlencoded?: UrlencodedOptions;
      text?: { limit?: string; type?: string };
      raw?: { limit?: string; type?: string };
    } = {}
  ): Middleware {
    return async (ctx, next) => {
      const contentType = ctx.headers['content-type'] || '';
      const method = ctx.method.toUpperCase();

      // Skip for GET, HEAD, OPTIONS requests
      if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        return next();
      }

      // Skip if body is already parsed
      if (ctx.body !== undefined) {
        return next();
      }

      try {
        // JSON parsing
        if (contentType.includes('application/json')) {
          const jsonMiddleware = json(options.json || {});
          await jsonMiddleware(ctx, next);
          return;
        }

        // URL-encoded parsing
        if (contentType.includes('application/x-www-form-urlencoded')) {
          const urlencodedMiddleware = urlencoded(options.urlencoded || {});
          await urlencodedMiddleware(ctx, next);
          return;
        }

        // Text parsing
        if (contentType.startsWith('text/')) {
          const textMiddleware = text(options.text || {});
          await textMiddleware(ctx, next);
          return;
        }

        // Raw parsing for other content types
        if (contentType && !contentType.includes('multipart/form-data')) {
          const rawMiddleware = raw(options.raw || {});
          await rawMiddleware(ctx, next);
          return;
        }

        // For multipart/form-data or no content-type, set empty body
        ctx.body = undefined;
        await next();
      } catch (error) {
        // Handle parsing errors gracefully
        ctx.status = 400;
        ctx.res.json({
          error: 'Invalid request body',
          message:
            error instanceof Error ? error.message : 'Body parsing failed',
          statusCode: 400,
        });
      }
    };
  }

  /**
   * Create exception filter middleware
   *
   * Provides NestJS-style exception handling with custom error classes
   * and automatic error response formatting.
   *
   * @param filters - Array of exception filters to use
   * @returns Exception filter middleware function
   *
   * @example
   * ```typescript
   * const app = createApp();
   *
   * // Global exception filter
   * app.use(app.exceptionFilter());
   *
   * // With custom filters
   * app.use(app.exceptionFilter([
   *   new ValidationExceptionFilter(),
   *   new AuthenticationExceptionFilter(),
   *   new GlobalExceptionFilter()
   * ]));
   * ```
   */
  public exceptionFilter(
    filters: ExceptionFilter[] = [new GlobalExceptionFilter()]
  ): Middleware {
    return async (ctx, next) => {
      try {
        await next();
      } catch (error) {
        // Find the appropriate filter for this error type
        const filter = filters.find(f => {
          if (f.constructor.name === 'GlobalExceptionFilter') {
            return true; // Global filter catches all
          }

          // Check if filter has exceptions property (from @Catch decorator)
          const filterClass = f.constructor as any;
          if (filterClass.exceptions) {
            return filterClass.exceptions.some(
              (ExceptionClass: any) => error instanceof ExceptionClass
            );
          }

          return false;
        });

        if (filter) {
          await filter.catch(error as Error, ctx);
        } else {
          // Fallback to global error handling
          const globalFilter = new GlobalExceptionFilter();
          await globalFilter.catch(error as Error, ctx);
        }
      }
    };
  }

  /**
   * Create advanced logger plugin
   *
   * Provides comprehensive logging capabilities similar to Winston/Pino
   * with multiple transports, structured logging, and performance optimization.
   *
   * @param config - Logger configuration options
   * @returns Logger plugin instance
   *
   * @example
   * ```typescript
   * const app = createApp();
   *
   * // Development logger
   * const logger = app.createLogger({
   *   level: 'debug',
   *   requestLogging: true,
   *   performance: true
   * });
   * logger.install(app);
   *
   * // Use logger in routes
   * app.get('/users', ctx => {
   *   app.logger.info('Fetching users', { userId: ctx.params.id });
   *   ctx.res.json({ users: [] });
   * });
   * ```
   */
  public createLogger(
    config: {
      level?:
        | 'error'
        | 'warn'
        | 'info'
        | 'http'
        | 'verbose'
        | 'debug'
        | 'silly';
      transports?: any[];
      format?: 'json' | 'text' | 'combined';
      colorize?: boolean;
      timestamp?: boolean;
      context?: string;
      requestLogging?: boolean;
      performance?: boolean;
      structured?: boolean;
    } = {}
  ): LoggerPlugin {
    // Convert string log levels to LogLevel enum
    const loggerConfig = {
      ...config,
      level: config.level ? this.convertLogLevel(config.level) : undefined,
    };
    return new LoggerPlugin(loggerConfig as any);
  }

  private convertLogLevel(level: string): number {
    const levelMap: Record<string, number> = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4,
      http: 2, // Same as info
      verbose: 3, // Same as debug
      silly: 4, // Same as trace
    };
    return levelMap[level] ?? 2; // Default to info
  }

  /**
   * Create development logger
   *
   * Optimized for development with debug level, colors, and detailed logging.
   *
   * @returns Development logger plugin
   */
  public createDevLogger(): LoggerPlugin {
    return createDevLogger();
  }

  /**
   * Create production logger
   *
   * Optimized for production with info level, JSON format, and file logging.
   *
   * @returns Production logger plugin
   */
  public createProdLogger(): LoggerPlugin {
    return createProdLogger();
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

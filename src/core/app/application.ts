/**
 * Core Application class for NextRush v2
 *
 * @packageDocumentation
 */

import { createContext, releaseContext } from '@/core/app/context';
import { Router as RouterClass } from '@/core/router';
import {
  GlobalExceptionFilter,
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

// Import DI system
import { createSafeConfiguration } from '@/core/config/validation';
import {
  createContainer,
  createMiddlewareFactory,
  registerDefaultMiddleware,
  type DIContainer,
  type MiddlewareFactory,
} from '@/core/di';

// Import SafeContext system
import {
  createSafeContext,
  createSafeMiddleware,
} from '@/core/context/immutable';

// Import Event System
import { NextRushEventSystem } from '@/core/events/event-system';
import {
  createSimpleEventsAPI,
  type SimpleEventsAPI,
} from '@/core/events/simple-events';

// Import built-in middleware types for backward compatibility
import type { EnhancedBodyParserOptions } from '@/core/middleware/body-parser/types';
import type {
  CompressionOptions,
  CorsOptions,
  HelmetOptions,
  LoggerOptions,
  RateLimiterOptions,
  RequestIdOptions,
  TimerOptions,
} from '@/core/middleware/types';
import type { NextRushRequest, NextRushResponse } from '@/types/http';

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
  private server!: Server;
  private middleware: Middleware[] = [];
  private internalRouter: RouterClass = new RouterClass();
  private options: Required<ApplicationOptions>;
  private isShuttingDown = false;
  private container: DIContainer;
  private middlewareFactory: MiddlewareFactory;
  // Cache for exception filter middleware to avoid per-request scanning
  private cachedExceptionFilter: Middleware | null = null;
  private static readonly EXCEPTION_FILTER_MARK = Symbol('ExceptionFilter');

  // Event System Integration
  private _eventSystem: NextRushEventSystem;
  private _simpleEvents: SimpleEventsAPI;

  constructor(options: ApplicationOptions = {}) {
    super();

    // Create safe configuration with validation
    this.options = createSafeConfiguration(options);

    // Initialize Event System
    this._eventSystem = new NextRushEventSystem();
    this._simpleEvents = createSimpleEventsAPI(this._eventSystem);

    // Initialize DI container and middleware factory
    this.container = createContainer();
    registerDefaultMiddleware(this.container);
    this.middlewareFactory = createMiddlewareFactory(this.container);

    this.server = this.createServer();
    this.setupEventHandlers();
  }

  /**
   * Create HTTP server
   */
  private createServer(): Server {
    const server = createServer((req, res) => {
      // Handle async request processing without blocking
      this.handleRequest(req, res).catch(error => {
        console.error('Request handling error:', error);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end('Internal Server Error');
        }
      });
    });

    // Connection tuning: leverage validated options
    // Keep-alive timeout controls how long to keep idle sockets open
    server.keepAliveTimeout = this.options.keepAlive;
    // Request timeout protects against hanging requests
    server.requestTimeout = this.options.timeout;
    // Ensure headers timeout exceeds keep-alive to avoid premature teardown
    const safetyBufferMs = 1000;
    server.headersTimeout = this.options.keepAlive + safetyBufferMs;

    return server;
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.on('error', error => {
      console.error('Application error:', error);
    });
  }

  /**
   * Get cached exception filter or scan once and cache it
   */
  private getOrFindExceptionFilter(): Middleware | null {
    if (this.cachedExceptionFilter !== null) {
      return this.cachedExceptionFilter;
    }
    const found = this.middleware.find(mw => {
      const marked =
        (mw as any)[NextRushApplication.EXCEPTION_FILTER_MARK] === true;
      if (marked) return true;
      const s = mw.toString();
      return s.includes('exceptionFilter') || s.includes('ExceptionFilter');
    });
    this.cachedExceptionFilter = found ?? null;
    return this.cachedExceptionFilter;
  }

  /**
   * Handle incoming requests
   */
  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    // Create context with proper type casting
    const ctx = createContext(
      req as NextRushRequest,
      res as NextRushResponse,
      this.options
    );

    // Find the exception filter middleware (cached once discovered)
    const exceptionFilter = this.getOrFindExceptionFilter();

    // Add async boundary to prevent event loop blocking
    const executeRequestWithBoundary = async (): Promise<void> => {
      if (exceptionFilter) {
        // Wrap the entire request handling in the exception filter
        await exceptionFilter(ctx, async () => {
          // Execute middleware with async boundary
          await this.executeMiddlewareWithBoundary(ctx);

          // Copy the parsed body from context to the already enhanced request
          ctx.req.body = ctx.body;

          // Execute route with async boundary
          await this.executeRouteWithBoundary(ctx);
        });
      } else {
        // No exception filter found, use basic error handling
        await this.executeMiddlewareWithBoundary(ctx);
        ctx.req.body = ctx.body;
        await this.executeRouteWithBoundary(ctx);
      }
    };

    // Execute with async boundary to prevent event loop blocking
    try {
      await executeRequestWithBoundary();
    } finally {
      // Release context back to pool for reuse
      releaseContext(ctx);
    }
  }

  /**
   * Execute middleware stack.
   * - Production: run directly on ctx for maximum performance.
   * - Debug mode: wrap with SafeContext for diagnostics.
   */
  private async executeMiddlewareWithBoundary(ctx: Context): Promise<void> {
    if (this.options.debug) {
      // Debug mode: keep SafeContext to detect misuse during development
      let safeCtx = createSafeContext(ctx);
      let index = 0;

      const dispatch = async (): Promise<void> => {
        if (index >= this.middleware.length) {
          return;
        }

        const middleware = this.middleware[index++];
        if (middleware) {
          const safeMiddleware = createSafeMiddleware(middleware);
          const result = await safeMiddleware(safeCtx, dispatch);

          if (result) {
            safeCtx = result;
          }
        }
      };

      await dispatch();
      safeCtx.commit();
      return;
    }

    // Production: direct execution without SafeContext wrapping
    let index = 0;
    const dispatch = async (): Promise<void> => {
      if (index >= this.middleware.length) {
        return;
      }
      const middleware = this.middleware[index++];
      if (!middleware) return;
      const result = middleware(ctx, dispatch);
      if (result instanceof Promise) {
        await result;
      }
    };

    await dispatch();
  }

  /**
   * Execute route handler with high-performance direct execution
   */
  private async executeRouteWithBoundary(ctx: Context): Promise<void> {
    const match = this.internalRouter.find(ctx.method, ctx.path);

    if (match) {
      // Set route parameters in context
      // Freeze params to make them read-only for the rest of the pipeline
      const frozenParams = Object.freeze({
        ...match.params,
      }) as unknown as typeof ctx.params;
      ctx.params = frozenParams;

      // Debug logging
      if (this.options.debug) {
        console.log(`🎯 Route match found: ${ctx.method} ${ctx.path}`);
        console.log(
          `📋 Route has ${match.middleware ? match.middleware.length : 0} middleware`
        );
        console.log(
          `🔧 Middleware:`,
          match.middleware?.map(m => m.name || 'anonymous')
        );
      }

      // Execute route-specific middleware first
      if (match.middleware && match.middleware.length > 0) {
        let index = 0;
        const dispatch = async (): Promise<void> => {
          if (index >= match.middleware.length) {
            // All middleware executed, now run the handler
            if (this.options.debug) {
              console.log(`🚀 All middleware complete, executing handler`);
            }
            await match.handler(ctx);
            return;
          }
          const middleware = match.middleware[index++];
          if (middleware) {
            if (this.options.debug) {
              console.log(
                `⚡ Executing middleware ${index}/${match.middleware.length}: ${middleware.name || 'anonymous'}`
              );
            }
            await middleware(ctx, dispatch);
          }
        };
        await dispatch();
      } else {
        // No route middleware, execute handler directly
        if (this.options.debug) {
          console.log(`🏃 No route middleware, executing handler directly`);
        }
        await match.handler(ctx);
      }
    } else {
      // No route found
      ctx.res.status(404).json({ error: 'Not Found' });
    }
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
   * Register middleware or sub-router
   */
  public use(middleware: Middleware): this;
  public use(prefix: string, router: Router): this;
  public use(middlewareOrPrefix: Middleware | string, router?: Router): this {
    if (typeof middlewareOrPrefix === 'function') {
      // Register middleware
      this.middleware.push(middlewareOrPrefix);
      // Invalidate cached exception filter when middleware changes
      this.cachedExceptionFilter = null;
    } else if (router) {
      // Register sub-router
      const subRouter = router as any;
      const subRoutes = subRouter.getRoutes();
      const subMiddleware = subRouter.getMiddleware();

      // Add sub-router middleware
      this.middleware.push(...subMiddleware);
      // Invalidate cached exception filter when middleware changes
      this.cachedExceptionFilter = null;

      // Add sub-router routes with prefix
      for (const [routeKey, routeData] of subRoutes) {
        const colonIndex = routeKey.indexOf(':');
        if (colonIndex !== -1) {
          const method = routeKey.substring(0, colonIndex);
          const path = routeKey.substring(colonIndex + 1);
          if (method && path) {
            const fullPath = `${middlewareOrPrefix}${path}`;
            // Convert RouteData back to RouteConfig for registration
            const routeConfig: RouteConfig = {
              handler: routeData.handler,
              middleware:
                routeData.middleware.length > 0
                  ? routeData.middleware
                  : undefined,
            };
            this.registerRoute(method, fullPath, routeConfig);
          }
        }
      }
    }

    return this;
  }

  /**
   * Create router instance
   */
  public router(): Router {
    return new RouterClass();
  }

  /**
   * Register a route with the router
   */
  private registerRoute(
    method: string,
    path: string,
    handler: RouteHandler | RouteConfig
  ): void {
    // Pass the entire handler (function or RouteConfig) to the router
    // The router will handle extracting the handler and middleware
    switch (method) {
      case 'GET':
        this.internalRouter.get(path, handler);
        break;
      case 'POST':
        this.internalRouter.post(path, handler);
        break;
      case 'PUT':
        this.internalRouter.put(path, handler);
        break;
      case 'DELETE':
        this.internalRouter.delete(path, handler);
        break;
      case 'PATCH':
        this.internalRouter.patch(path, handler);
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
  }

  /**
   * Start the server
   */
  public listen(port?: number, callback?: () => void): Server;
  public listen(port?: number, host?: string, callback?: () => void): Server;
  public listen(
    port?: number,
    hostOrCallback?: string | (() => void),
    callback?: () => void
  ): Server {
    let actualPort: number;
    let actualHost: string;
    let actualCallback: (() => void) | undefined;

    // Handle overloaded parameters
    if (typeof hostOrCallback === 'function') {
      // listen(port, callback)
      actualPort = port ?? this.options.port;
      actualHost = this.options.host;
      actualCallback = hostOrCallback;
    } else {
      // listen(port, host, callback)
      actualPort = port ?? this.options.port;
      actualHost = hostOrCallback ?? this.options.host;
      actualCallback = callback;
    }

    this.server.listen(actualPort, actualHost, () => {
      this.emit('listening', { port: actualPort, host: actualHost });
      actualCallback?.();
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
   * Get simple events API for Express-style event handling
   *
   * @example
   * ```typescript
   * app.events.emit('user.created', { userId: '123' });
   * app.events.on('user.created', (data) => console.log(data));
   * ```
   */
  public get events(): SimpleEventsAPI {
    return this._simpleEvents;
  }

  /**
   * Get advanced event system for CQRS and Event Sourcing
   *
   * @example
   * ```typescript
   * app.eventSystem.dispatch(new CreateUserCommand({ name: 'John' }));
   * app.eventSystem.subscribe(UserCreatedEvent, handler);
   * ```
   */
  public get eventSystem(): NextRushEventSystem {
    return this._eventSystem;
  }

  /**
   * Gracefully shutdown the application
   */
  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;
    this.emit('shutdown');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server shutdown timeout'));
      }, 5000);

      this.server.close(() => {
        clearTimeout(timeout);
        this.emit('closed');
        resolve();
      });

      // Force close if normal close doesn't work
      setTimeout(() => {
        try {
          this.server.unref();
          clearTimeout(timeout);
          resolve();
        } catch {
          clearTimeout(timeout);
          resolve();
        }
      }, 3000);
    });
  }

  // ==================== MIDDLEWARE FACTORY METHODS ====================

  /**
   * Create CORS middleware - now delegated to middleware factory
   */
  public cors(options: CorsOptions = {}): Middleware {
    return this.middlewareFactory.createCors(options);
  }

  /**
   * Create helmet middleware - now delegated to middleware factory
   */
  public helmet(options: HelmetOptions = {}): Middleware {
    return this.middlewareFactory.createHelmet(options);
  }

  /**
   * Create JSON body parser middleware - now delegated to middleware factory
   */
  public json(options: EnhancedBodyParserOptions = {}): Middleware {
    return this.middlewareFactory.createJson(options);
  }

  /**
   * Create URL-encoded body parser middleware - now delegated to middleware factory
   */
  public urlencoded(options: EnhancedBodyParserOptions = {}): Middleware {
    return this.middlewareFactory.createUrlencoded(options);
  }

  /**
   * Create text body parser middleware - now delegated to middleware factory
   */
  public text(options: EnhancedBodyParserOptions = {}): Middleware {
    return this.middlewareFactory.createText(options);
  }

  /**
   * Create rate limiter middleware - now delegated to middleware factory
   */
  public rateLimit(options: RateLimiterOptions = {}): Middleware {
    return this.middlewareFactory.createRateLimit(options);
  }

  /**
   * Create logger middleware - now delegated to middleware factory
   */
  public logger(options: LoggerOptions = {}): Middleware {
    return this.middlewareFactory.createLogger(options);
  }

  /**
   * Create compression middleware - now delegated to middleware factory
   */
  public compression(options: CompressionOptions = {}): Middleware {
    return this.middlewareFactory.createCompression(options);
  }

  /**
   * Create request ID middleware - now delegated to middleware factory
   */
  public requestId(options: RequestIdOptions = {}): Middleware {
    return this.middlewareFactory.createRequestId(options);
  }

  /**
   * Create timer middleware - now delegated to middleware factory
   */
  public timer(options: TimerOptions = {}): Middleware {
    return this.middlewareFactory.createTimer(options);
  }

  /**
   * Create smart body parser middleware - now delegated to middleware factory
   */
  public smartBodyParser(options: EnhancedBodyParserOptions = {}): Middleware {
    return this.middlewareFactory.createSmartBodyParser(options);
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
    const middleware: Middleware = async (ctx, next) => {
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
    // Mark this middleware as an exception filter for O(1) detection
    (middleware as any)[NextRushApplication.EXCEPTION_FILTER_MARK] = true;
    // Cache immediately to avoid first-request scan
    this.cachedExceptionFilter = middleware;
    return middleware;
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

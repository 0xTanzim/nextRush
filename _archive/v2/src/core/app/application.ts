/**
 * Core Application class for NextRush v2
 *
 * @packageDocumentation
 */

import { Router as RouterClass } from '@/core/router';
import {
  GlobalExceptionFilter,
  type ExceptionFilter,
} from '@/errors/custom-errors';
import type { LoggerPlugin } from '@/plugins/logger';
import type {
  Application,
  Middleware,
  RouteConfig,
  RouteHandler,
  Router
} from '@/types/context';
import type { ApplicationOptions } from '@/types/http';
import { EventEmitter } from 'node:events';
import type { Server } from 'node:http';

// Import DI system
import { createSafeConfiguration } from '@/core/config/validation';
import {
  createContainer,
  createMiddlewareFactory,
  registerDefaultMiddleware,
  type DIContainer,
  type MiddlewareFactory,
} from '@/core/di';

// Import Event System
import {
  createSimpleEventsAPI,
  NextRushEventSystem,
  type SimpleEventsAPI,
} from '@/core/events';

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

// Import Application Compiler
import {
  createApplicationCompiler,
  type ApplicationCompiler,
} from '@/core/compiler';

// Import Extracted Modules (Phase 4)
import {
  createExceptionFilterManager,
  type ExceptionFilterManager
} from '@/core/app/exception-filter-manager';
import { createRequestHandler } from '@/core/app/request-handler';
import {
  addMiddleware,
  mountSubRouter,
  registerRoute,
  type HttpMethod,
  type RouteRegistrationConfig,
} from '@/core/app/route-registry';
import { createHttpServer } from '@/core/app/server-lifecycle';

// Import Logger Helpers (Phase 5)
import {
  createDevLogger,
  createLoggerWithConfig,
  createProdLogger,
} from '@/core/app/logger-helpers';
import type { LoggerConfig } from '@/core/app/types';

// Import Listen Helpers (Phase 5)
import {
  parseListenParams,
  startServerWithCompilation,
  type ListenConfig,
} from '@/core/app/listen-helpers';

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
  private compiler: ApplicationCompiler;

  // Exception Filter Manager (extracted)
  private exceptionFilterMgr: ExceptionFilterManager;

  // Route Registration Config (extracted)
  private routeConfig: RouteRegistrationConfig;

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

    // Initialize compiler for pre-compilation
    this.compiler = createApplicationCompiler();

    // Initialize Exception Filter Manager (extracted module)
    this.exceptionFilterMgr = createExceptionFilterManager(
      () => this.middleware
    );

    // Initialize Route Registration Config (extracted module)
    this.routeConfig = {
      router: this.internalRouter,
      middleware: this.middleware,
      invalidateExceptionFilterCache: () => this.exceptionFilterMgr.invalidateCache(),
    };

    this.server = this.initializeServer();
    this.setupEventHandlers();
  }

  /**
   * Initialize HTTP server using extracted module
   */
  private initializeServer(): Server {
    // Create request handler using extracted module
    const requestHandler = createRequestHandler({
      options: this.options,
      getMiddleware: () => this.middleware,
      router: this.internalRouter,
      findExceptionFilter: () => this.exceptionFilterMgr.findExceptionFilter(),
    });

    // Create server using extracted module
    return createHttpServer({
      options: this.options,
      requestHandler,
      emitter: this,
    });
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.on('error', error => {
      console.error('Application error:', error);
    });
  }

  // ==================== HTTP METHOD ROUTING ====================

  /** Register GET route */
  public get(path: string, handler: RouteHandler | RouteConfig): this {
    this.internalRegisterRoute('GET', path, handler);
    return this;
  }

  /** Register POST route */
  public post(path: string, handler: RouteHandler | RouteConfig): this {
    this.internalRegisterRoute('POST', path, handler);
    return this;
  }

  /** Register PUT route */
  public put(path: string, handler: RouteHandler | RouteConfig): this {
    this.internalRegisterRoute('PUT', path, handler);
    return this;
  }

  /** Register DELETE route */
  public delete(path: string, handler: RouteHandler | RouteConfig): this {
    this.internalRegisterRoute('DELETE', path, handler);
    return this;
  }

  /** Register PATCH route */
  public patch(path: string, handler: RouteHandler | RouteConfig): this {
    this.internalRegisterRoute('PATCH', path, handler);
    return this;
  }

  /** Register middleware or mount sub-router */
  public use(middleware: Middleware): this;
  public use(prefix: string, router: Router): this;
  public use(middlewareOrPrefix: Middleware | string, router?: Router): this {
    if (typeof middlewareOrPrefix === 'function') {
      addMiddleware(
        this.middleware,
        middlewareOrPrefix,
        () => this.exceptionFilterMgr.invalidateCache()
      );
    } else if (router) {
      mountSubRouter(this.routeConfig, middlewareOrPrefix, router);
    }
    return this;
  }

  /** Create a new router instance */
  public router(): Router {
    return new RouterClass();
  }

  /**
   * Register a route with the router (uses extracted module)
   */
  private internalRegisterRoute(
    method: string,
    path: string,
    handler: RouteHandler | RouteConfig
  ): void {
    registerRoute(this.routeConfig, method as HttpMethod, path, handler);
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
    // Parse listen parameters using extracted helper
    const params = parseListenParams(this.options, port, hostOrCallback, callback);

    // Create listen config for extracted helper
    const listenConfig: ListenConfig = {
      options: this.options,
      server: this.server,
      emitter: this,
      compiler: this.compiler,
      router: this.internalRouter,
      container: this.container,
    };

    // Start server with compilation using extracted helper
    return startServerWithCompilation(listenConfig, params);
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
  // All methods delegate to middlewareFactory - see MiddlewareFactory for full docs

  /** Create CORS middleware */
  public cors(options: CorsOptions = {}): Middleware {
    return this.middlewareFactory.createCors(options);
  }

  /** Create helmet security middleware */
  public helmet(options: HelmetOptions = {}): Middleware {
    return this.middlewareFactory.createHelmet(options);
  }

  /** Create JSON body parser middleware */
  public json(options: EnhancedBodyParserOptions = {}): Middleware {
    return this.middlewareFactory.createJson(options);
  }

  /** Create URL-encoded body parser middleware */
  public urlencoded(options: EnhancedBodyParserOptions = {}): Middleware {
    return this.middlewareFactory.createUrlencoded(options);
  }

  /** Create text body parser middleware */
  public text(options: EnhancedBodyParserOptions = {}): Middleware {
    return this.middlewareFactory.createText(options);
  }

  /** Create rate limiter middleware */
  public rateLimit(options: RateLimiterOptions = {}): Middleware {
    return this.middlewareFactory.createRateLimit(options);
  }

  /** Create logger middleware */
  public logger(options: LoggerOptions = {}): Middleware {
    return this.middlewareFactory.createLogger(options);
  }

  /** Create compression middleware */
  public compression(options: CompressionOptions = {}): Middleware {
    return this.middlewareFactory.createCompression(options);
  }

  /** Create request ID middleware */
  public requestId(options: RequestIdOptions = {}): Middleware {
    return this.middlewareFactory.createRequestId(options);
  }

  /** Create timer middleware */
  public timer(options: TimerOptions = {}): Middleware {
    return this.middlewareFactory.createTimer(options);
  }

  /** Create smart body parser middleware */
  public smartBodyParser(options: EnhancedBodyParserOptions = {}): Middleware {
    return this.middlewareFactory.createSmartBodyParser(options);
  }

  // ==================== EXCEPTION FILTER ====================

  /**
   * Create exception filter middleware with NestJS-style exception handling
   * @param filters - Array of exception filters to use
   * @returns Exception filter middleware function
   */
  public exceptionFilter(
    filters: ExceptionFilter[] = [new GlobalExceptionFilter()]
  ): Middleware {
    return this.exceptionFilterMgr.createExceptionFilter(filters);
  }

  // ==================== LOGGER PLUGIN FACTORY ====================

  /**
   * Create advanced logger plugin with Winston/Pino-like capabilities
   * @param config - Logger configuration options
   * @returns Logger plugin instance
   */
  public createLogger(config: LoggerConfig = {}): LoggerPlugin {
    return createLoggerWithConfig(config);
  }

  /** Create development-optimized logger */
  public createDevLogger(): LoggerPlugin {
    return createDevLogger();
  }

  /** Create production-optimized logger */
  public createProdLogger(): LoggerPlugin {
    return createProdLogger();
  }
}

/**
 * Create a new NextRush application instance
 * @param options - Application configuration options
 * @returns Application instance
 */
export function createApp(options?: ApplicationOptions): Application {
  return new NextRushApplication(options);
}

// Type exports
export type { Application, ApplicationOptions };

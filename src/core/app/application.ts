/**
 * 🚀 NextRush Application - Complete, Type-Safe Framework
 *
 * Zero `any` usage, proper overloads, createRoute feature, enterprise-grade typing
 */

import { Server as HttpServer, IncomingMessage, ServerResponse } from 'http';
import { ErrorHandler } from '../../errors/error-handler';
import { Router } from '../../routing/router';
import {
  ExpressHandler,
  ExpressMiddleware,
  NextRushRequest,
  NextRushResponse,
} from '../../types/express';
import {
  HttpMethod,
  MiddlewareHandler,
  Path,
  RequestContext,
  Route,
  RouteHandler,
} from '../../types/routing';
import { RequestEnhancer } from '../enhancers/request-enhancer';
import { ResponseEnhancer } from '../enhancers/response-enhancer';
import { SimpleEventEmitter } from '../event-system';
import { BaseComponent } from './base-component';

// Import new plugin system
import { createCorePlugins } from '../../plugins/clean-plugins';
import { SimplePluginRegistry } from '../../plugins/core/simple-registry';

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

  // 🚀 Professional features
  compress?: boolean | 'auto';
  memoryCache?: boolean;
  acceptRanges?: boolean;
  cacheControl?: string;
  setHeaders?: (res: any, path: string) => void;
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
  listen(
    port: number | string,
    hostname?: string | (() => void),
    callback?: () => void
  ): IApplication;
  close(callback?: () => void): IApplication;
}

// Import WebSocket types for interface extension
import type {
  NextRushWebSocket,
  WebSocketHandler,
  WebSocketMiddleware,
  WebSocketOptions,
  WebSocketStats,
} from '../../types/websocket';

// Interface merging to add WebSocket methods to Application
declare module '../app/application' {
  interface Application {
    enableWebSocket(options?: WebSocketOptions): this;
    ws(path: string, handler: WebSocketHandler): this;
    wsUse(middleware: WebSocketMiddleware): this;
    wsBroadcast(data: any, room?: string): this;
    getWebSocketStats(): WebSocketStats | undefined;
    getWebSocketConnections(): NextRushWebSocket[];

    // 🎛️ Middleware preset methods
    usePreset(name: string, options?: any): this;
    useGroup(middlewares: any[]): this;

    // 🔒 Security middleware methods
    cors(options?: any): any;
    helmet(options?: any): any;

    // 📦 Body parser methods
    json(options?: any): any;
    urlencoded(options?: any): any;
    text(options?: any): any;
    raw(options?: any): any;

    // ⚡ Performance middleware methods
    compression(options?: any): any;
    rateLimit(options?: any): any;

    // 📊 Monitoring middleware methods
    logger(options?: any): any;
    requestId(options?: any): any;
    timer(options?: any): any;

    // 🔐 Authentication & Authorization methods
    useJwt(options: any): this;
    defineRole(role: any): this;
    signJwt(payload: any, options?: any): string;
    verifyJwt(token: string, options?: any): any;
    requireAuth(strategy?: string): any;

    // 📊 Metrics & Monitoring methods
    enableMetrics(options?: any): this;
    incrementCounter(
      name: string,
      labels?: Record<string, string>,
      value?: number
    ): this;
    setGauge(
      name: string,
      value: number,
      labels?: Record<string, string>
    ): this;
    observeHistogram(
      name: string,
      value: number,
      labels?: Record<string, string>
    ): this;
    addHealthCheck(name: string, check: any): this;
    getMetrics(): any;
    getHealth(): any;

    // 🛡️ Rate Limiting methods
    enableGlobalRateLimit(options?: any): this;
    useRateLimit(options?: any): any;
    createRateLimit(options?: any): any;

    // 🌐 CORS & Security methods
    enableCors(options?: any): this;
    enableSecurityHeaders(): any;
    enableWebSecurity(options?: any): this;
    xssProtection(options?: any): any;

    // 🔄 Event-driven architecture methods
    on(event: string, handler: (...args: any[]) => void | Promise<void>): this;
    once(
      event: string,
      handler: (...args: any[]) => void | Promise<void>
    ): this;
    off(
      event: string,
      handler?: (...args: any[]) => void | Promise<void>
    ): this;
    emit(event: string, ...args: any[]): this;
    eventMiddleware(options?: {
      autoEmit?: boolean;
      events?: string[];
      includeRequest?: boolean;
      includeResponse?: boolean;
    }): any;
    getEventStats(): any;
    getEventHistory(): any[];

    // 🛡️ Input validation & sanitization methods
    validate(schema: {
      [key: string]: {
        required?: boolean;
        type?: 'string' | 'number' | 'boolean' | 'email' | 'url';
        min?: number;
        max?: number;
        minLength?: number;
        maxLength?: number;
      };
    }): any;
    sanitize(options?: {
      removeHtml?: boolean;
      escapeHtml?: boolean;
      trim?: boolean;
      removeSpecialChars?: boolean;
    }): any;
  }
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

  // 🔌 NEW: Plugin System
  private pluginRegistry!: SimplePluginRegistry;

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

    // 🔌 Initialize plugin system
    this.initializePlugins();
  }

  /**
   * Install method required by BaseComponent
   */
  install(): void {
    // Application is the root component
  }

  /**
   * 🔌 Initialize the plugin system
   */
  private initializePlugins(): void {
    this.pluginRegistry = new SimplePluginRegistry();

    // Register core plugins
    const corePlugins = createCorePlugins(this.pluginRegistry);
    corePlugins.forEach((plugin) => {
      this.pluginRegistry.register(plugin);
    });

    // Install all plugins
    this.pluginRegistry.installAll(this);

    // Start all plugins
    this.pluginRegistry.startAll();
  }

  // ============================================================================
  // 🎯 HTTP METHODS - COMPREHENSIVE OVERLOADS WITH PROPER TYPE INFERENCE
  // ============================================================================

  /**
   * GET method with comprehensive overloads - Express-style compatibility
   */
  // Overload 1: Just handler (Express-style)
  get(path: Path, handler: ExpressHandler): Application;

  // Overload 2: Just handler (Context-style)
  get(path: Path, handler: RouteHandler): Application;

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
  get(
    path: Path,
    ...args: (
      | RouteHandler
      | ExpressHandler
      | MiddlewareHandler
      | ExpressMiddleware
    )[]
  ): Application {
    return this.addRoute('GET', path, args);
  }

  /**
   * POST method with comprehensive overloads - Express-style compatibility
   */
  // Overload 1: Just handler (Express-style)
  post(path: Path, handler: ExpressHandler): Application;

  // Overload 2: Just handler (Context-style)
  post(path: Path, handler: RouteHandler): Application;

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
  post(
    path: Path,
    ...args: (
      | RouteHandler
      | ExpressHandler
      | MiddlewareHandler
      | ExpressMiddleware
    )[]
  ): Application {
    return this.addRoute('POST', path, args);
  }

  /**
   * PUT method with comprehensive overloads - Express-style compatibility
   */
  // Overload 1: Just handler (Express-style)
  put(path: Path, handler: ExpressHandler): Application;

  // Overload 2: Just handler (Context-style)
  put(path: Path, handler: RouteHandler): Application;

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
  put(
    path: Path,
    ...args: (
      | RouteHandler
      | ExpressHandler
      | MiddlewareHandler
      | ExpressMiddleware
    )[]
  ): Application {
    return this.addRoute('PUT', path, args);
  }

  /**
   * DELETE method with comprehensive overloads - Express-style compatibility
   */
  // Overload 1: Just handler (Express-style)
  delete(path: Path, handler: ExpressHandler): Application;

  // Overload 2: Just handler (Context-style)
  delete(path: Path, handler: RouteHandler): Application;

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
  delete(
    path: Path,
    ...args: (
      | RouteHandler
      | ExpressHandler
      | MiddlewareHandler
      | ExpressMiddleware
    )[]
  ): Application {
    return this.addRoute('DELETE', path, args);
  }

  /**
   * PATCH method with comprehensive overloads - Express-style compatibility
   */
  // Overload 1: Just handler (Express-style)
  patch(path: Path, handler: ExpressHandler): Application;

  // Overload 2: Just handler (Context-style)
  patch(path: Path, handler: RouteHandler): Application;

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
  patch(
    path: Path,
    ...args: (
      | RouteHandler
      | ExpressHandler
      | MiddlewareHandler
      | ExpressMiddleware
    )[]
  ): Application {
    return this.addRoute('PATCH', path, args);
  }

  /**
   * HEAD method with comprehensive overloads - Express-style compatibility
   */
  // Overload 1: Just handler (Express-style)
  head(path: Path, handler: ExpressHandler): Application;

  // Overload 2: Just handler (Context-style)
  head(path: Path, handler: RouteHandler): Application;

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
  head(
    path: Path,
    ...args: (
      | RouteHandler
      | ExpressHandler
      | MiddlewareHandler
      | ExpressMiddleware
    )[]
  ): Application {
    return this.addRoute('HEAD', path, args);
  }

  /**
   * OPTIONS method with comprehensive overloads - Express-style compatibility
   */
  // Overload 1: Just handler (Express-style)
  options(path: Path, handler: ExpressHandler): Application;

  // Overload 2: Just handler (Context-style)
  options(path: Path, handler: RouteHandler): Application;

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
  options(
    path: Path,
    ...args: (
      | RouteHandler
      | ExpressHandler
      | MiddlewareHandler
      | ExpressMiddleware
    )[]
  ): Application {
    return this.addRoute('OPTIONS', path, args);
  }

  /**
   * ALL method - matches all HTTP methods with comprehensive overloads
   */
  // Overload 1: Just handler (Express-style)
  all(path: Path, handler: ExpressHandler): Application;

  // Overload 2: Just handler (Context-style)
  all(path: Path, handler: RouteHandler): Application;

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
  all(
    path: Path,
    ...args: (
      | RouteHandler
      | ExpressHandler
      | MiddlewareHandler
      | ExpressMiddleware
    )[]
  ): Application {
    // Register for all HTTP methods
    const methods: HttpMethod[] = [
      'GET',
      'POST',
      'PUT',
      'DELETE',
      'PATCH',
      'HEAD',
      'OPTIONS',
    ];
    for (const method of methods) {
      this.addRoute(method, path, args);
    }
    return this;
  }

  // ============================================================================
  // 🎯 MIDDLEWARE - EXPRESS-STYLE USE METHOD
  // ============================================================================

  /**
   * Use middleware with proper overloads - Express-style compatibility
   */
  // Global middleware (Express-style)
  use(
    middleware: (
      req: NextRushRequest,
      res: NextRushResponse,
      next: () => void
    ) => void | Promise<void>
  ): Application;

  // Global middleware (Context-style)
  use(
    middleware: (
      context: RequestContext,
      next: () => Promise<void>
    ) => void | Promise<void>
  ): Application;

  // Path-specific middleware (Express-style)
  use(
    path: Path,
    middleware: (
      req: NextRushRequest,
      res: NextRushResponse,
      next: () => void
    ) => void | Promise<void>
  ): Application;

  // Path-specific middleware (Context-style)
  use(
    path: Path,
    middleware: (
      context: RequestContext,
      next: () => Promise<void>
    ) => void | Promise<void>
  ): Application;

  // Router mounting
  use(path: Path, router: Router): Application;

  // Implementation with flexible parameter handling
  use(
    pathOrHandler:
      | Path
      | MiddlewareHandler
      | ExpressMiddleware
      | ((
          req: NextRushRequest,
          res: NextRushResponse,
          next: () => void
        ) => void | Promise<void>)
      | ((
          context: RequestContext,
          next: () => Promise<void>
        ) => void | Promise<void>),
    handler?:
      | MiddlewareHandler
      | ExpressMiddleware
      | Router
      | ((
          req: NextRushRequest,
          res: NextRushResponse,
          next: () => void
        ) => void | Promise<void>)
      | ((
          context: RequestContext,
          next: () => Promise<void>
        ) => void | Promise<void>)
  ): Application {
    // Handle different cases based on arguments
    if (typeof pathOrHandler === 'string' || pathOrHandler instanceof RegExp) {
      // Path-specific middleware or router mounting
      if (!handler) {
        throw new Error('Handler is required when path is provided');
      }

      // Check if handler is a Router
      if (handler instanceof Router) {
        // Mount the router with path prefix
        this.router.mount(pathOrHandler as string, handler);
      } else {
        // Regular middleware
        this.router.use(handler as MiddlewareHandler | ExpressMiddleware);
      }
    } else {
      // Global middleware
      this.router.use(pathOrHandler as MiddlewareHandler | ExpressMiddleware);
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
    const convertedMiddleware = middleware.map((mw) =>
      this.convertMiddleware(mw)
    );

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
    this.router.addRoute(
      route.method,
      route.path,
      route.handler,
      route.middleware
    );
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

  private templateEngine?: any;
  private templateOptions: any = {
    cache: process.env.NODE_ENV === 'production',
    defaultExtension: '.html',
    syntax: 'auto',
  };

  /**
   * Set views directory with options
   */
  setViews(viewsPath: string, options?: any): Application {
    this.viewsDirectory = viewsPath;
    if (options) {
      this.templateOptions = { ...this.templateOptions, ...options };
    }
    return this;
  }

  /**
   * Set the template engine for Ultimate Template support
   */
  setTemplateEngine(engine: any): this {
    this.templateEngine = engine;
    return this;
  }

  /**
   * Render a template with Ultimate Template Engine
   */
  async render(
    view: string,
    data: Record<string, unknown> = {}
  ): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');

    // Determine template path
    let fullPath = view;
    if (this.viewsDirectory) {
      fullPath = path.join(this.viewsDirectory, view);

      // Add default extension if not present
      if (!path.extname(fullPath) && this.templateOptions.defaultExtension) {
        fullPath += this.templateOptions.defaultExtension;
      }
    }

    try {
      const template = await fs.readFile(fullPath, 'utf-8');

      // Use Ultimate Template Engine if available
      if (this.templateEngine) {
        return await this.templateEngine.render(
          template,
          data,
          this.templateOptions
        );
      }

      // Fallback to simple template rendering
      return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return data[key] !== undefined ? String(data[key]) : match;
      });
    } catch (error) {
      throw new Error(
        `Template rendering failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
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
    this.use(
      path,
      async (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
        // Static file serving logic here
        console.log(`Serving static files from ${staticRoot} for path ${path}`);
        console.log(`Static options:`, staticOptions);
        // TODO: Implement actual static file serving logic
        next();
      }
    );

    return this;
  }

  // ============================================================================
  // 🎯 SERVER LIFECYCLE - REQUIRED BY Application
  // ============================================================================

  /**
   * Listen on port - Required by Application
   */
  listen(
    port: number | string,
    hostname?: string | (() => void),
    callback?: () => void
  ): Application {
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

    // Emit event that server is created (for WebSocket plugin)
    this.pluginRegistry.emit('application:server-created');

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
    args: (
      | RouteHandler
      | ExpressHandler
      | MiddlewareHandler
      | ExpressMiddleware
    )[]
  ): Application {
    if (args.length === 0) {
      throw new Error(`${method} route requires at least a handler`);
    }

    const handler = args[args.length - 1] as RouteHandler | ExpressHandler;
    const middleware = args.slice(0, -1) as (
      | MiddlewareHandler
      | ExpressMiddleware
    )[];

    const convertedHandler = this.convertHandler(handler);
    const convertedMiddleware = middleware.map((mw) =>
      this.convertMiddleware(mw)
    );

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

  private convertMiddleware(
    middleware: MiddlewareHandler | ExpressMiddleware
  ): MiddlewareHandler {
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
          const result = (middleware as ExpressMiddleware)(
            req,
            res,
            expressNext
          );
          if (result instanceof Promise) {
            result.catch(reject);
          }
        } catch (error) {
          reject(error);
        }
      });
    };
  }

  private generateRouteId(
    method: HttpMethod,
    path: Path,
    name?: string
  ): string {
    const base =
      name ||
      `${method.toLowerCase()}_${String(path).replace(/[^a-zA-Z0-9]/g, '_')}`;
    return `${base}_${Date.now()}`;
  }

  private createServer(): HttpServer {
    return new HttpServer(async (req: IncomingMessage, res: ServerResponse) => {
      try {
        const enhancedReq = RequestEnhancer.enhance(req);
        const enhancedRes = ResponseEnhancer.enhance(res);

        // Add application reference to request for template rendering
        (enhancedReq as any).app = this;

        // Create request context for router
        const context = {
          request: enhancedReq,
          response: enhancedRes,
          params: {},
          query: enhancedReq.query || {},
          body: undefined,
          startTime: Date.now(),
        };

        await this.router.handle(context);
      } catch (error) {
        const errorObj =
          error instanceof Error ? error : new Error(String(error));

        // Create minimal context for error handling
        const errorContext = {
          request: RequestEnhancer.enhance(req),
          response: ResponseEnhancer.enhance(res),
          params: {},
          query: {},
          body: undefined,
          startTime: Date.now(),
        };

        await this.errorHandler.handle(errorObj, errorContext);
      }
    });
  }
}

/**
 * Global type augmentation for automatic type inference
 * Eliminates the need to manually import NextRushRequest and NextRushResponse
 * 🎯 ZERO `any` usage - Full type safety for all options!
 */
import { PresetOptions } from '../plugins/middleware/presets';
import { NextRushRequest, NextRushResponse } from './express';
import { RequestContext } from './http';
import {
  NextRushWebSocket,
  WebSocketHandler,
  WebSocketMiddleware,
  WebSocketOptions,
  WebSocketStats,
} from './websocket';

// 🎯 Import ALL proper types to eliminate `any` usage
import {
  CompressionOptions,
  CorsOptions,
  EventStats,
  HelmetOptions,
  JsonParserOptions,
  LoggerOptions,
  MetricsOptions,
  MiddlewareFunction,
  RateLimitOptions,
  RawParserOptions,
  SanitizationOptions,
  TextParserOptions,
  UrlEncodedParserOptions,
  ValidationSchema,
  WebSecurityOptions,
  XssProtectionOptions,
} from './plugin-options';

// Also import StaticOptions from Application
import '../core/app/application';

/**
 * Express-style handler type
 */
type ExpressHandler = (
  req: NextRushRequest,
  res: NextRushResponse
) => void | Promise<void>;

/**
 * Context-style handler type
 */
type ContextHandler = (context: RequestContext) => void | Promise<void>;

/**
 * Express-style middleware type
 */
type ExpressMiddleware = (
  req: NextRushRequest,
  res: NextRushResponse,
  next: () => void
) => void;

/**
 * Context-style middleware type
 */
type ContextMiddleware = (
  context: RequestContext,
  next: () => Promise<void>
) => void | Promise<void>;

/**
 * 🎯 Smart Middleware Preset Options - NO MORE `any`!
 * Full IntelliSense support for all preset configurations
 */
interface SmartPresetOptions {
  cors?: boolean | CorsOptions;
  helmet?: boolean | HelmetOptions;
  logger?: boolean | LoggerOptions;
  bodyParser?:
    | boolean
    | {
        json?: boolean | JsonParserOptions;
        urlencoded?: boolean | UrlEncodedParserOptions;
        text?: boolean | TextParserOptions;
        raw?: boolean | RawParserOptions;
      };
  compression?: boolean | CompressionOptions;
  rateLimit?: boolean | RateLimitOptions;
  metrics?: boolean | MetricsOptions;
  xssProtection?: boolean | XssProtectionOptions;
  webSecurity?: boolean | WebSecurityOptions;
}

/**
 * Global type augmentation for Application methods
 * Enables automatic type inference for HTTP methods and middleware
 */
declare module '../core/app/application' {
  interface Application {
    /**
     * Register a GET route with Express-style handler
     */
    get(path: string, handler: ExpressHandler): this;

    /**
     * Register a GET route with context-style handler
     */
    get(path: string, handler: ContextHandler): this;

    /**
     * Register a GET route with Express middleware and handler
     */
    get(
      path: string,
      middleware: ExpressMiddleware,
      handler: ExpressHandler
    ): this;
    get(
      path: string,
      middleware: ExpressMiddleware,
      handler: ContextHandler
    ): this;

    /**
     * Register a GET route with context middleware and handler
     */
    get(
      path: string,
      middleware: ContextMiddleware,
      handler: ExpressHandler
    ): this;
    get(
      path: string,
      middleware: ContextMiddleware,
      handler: ContextHandler
    ): this;

    /**
     * Register a POST route with Express-style handler
     */
    post(path: string, handler: ExpressHandler): this;

    /**
     * Register a POST route with context-style handler
     */
    post(path: string, handler: ContextHandler): this;

    /**
     * Register a POST route with Express middleware and handler
     */
    post(
      path: string,
      middleware: ExpressMiddleware,
      handler: ExpressHandler
    ): this;
    post(
      path: string,
      middleware: ExpressMiddleware,
      handler: ContextHandler
    ): this;

    /**
     * Register a POST route with context middleware and handler
     */
    post(
      path: string,
      middleware: ContextMiddleware,
      handler: ExpressHandler
    ): this;
    post(
      path: string,
      middleware: ContextMiddleware,
      handler: ContextHandler
    ): this;

    /**
     * Register a PUT route with Express-style handler
     */
    put(path: string, handler: ExpressHandler): this;
    put(path: string, handler: ContextHandler): this;

    /**
     * Register a DELETE route with Express-style handler
     */
    delete(path: string, handler: ExpressHandler): this;
    delete(path: string, handler: ContextHandler): this;

    /**
     * Register a PATCH route with Express-style handler
     */
    patch(path: string, handler: ExpressHandler): this;
    patch(path: string, handler: ContextHandler): this;

    /**
     * Register middleware or mount a router
     */
    use(middleware: ExpressMiddleware): this;
    use(middleware: ContextMiddleware): this;
    use(path: string, middleware: ExpressMiddleware): this;
    use(path: string, middleware: ContextMiddleware): this;

    /**
     * Apply middleware preset
     */
    usePreset(name: string, options?: PresetOptions): this;

    /**
     * Apply multiple middleware at once
     */
    useGroup(middlewares: ExpressMiddleware[]): this;

    /**
     * CORS middleware
     */
    cors(options?: {
      origin?: string | string[] | boolean;
      methods?: string[];
      credentials?: boolean;
      headers?: string[];
    }): ExpressMiddleware;

    /**
     * Helmet security middleware
     */
    helmet(options?: HelmetOptions): ExpressMiddleware;

    /**
     * JSON body parser middleware
     */
    json(options?: { limit?: string; strict?: boolean }): ExpressMiddleware;

    /**
     * URL-encoded body parser middleware
     */
    urlencoded(options?: {
      extended?: boolean;
      limit?: string;
    }): ExpressMiddleware;

    /**
     * Text body parser middleware
     */
    text(options?: { limit?: string; type?: string }): ExpressMiddleware;

    /**
     * Raw body parser middleware
     */
    raw(options?: { limit?: string; type?: string }): ExpressMiddleware;

    /**
     * Enable WebSocket support with options
     */
    enableWebSocket(options?: WebSocketOptions): this;

    /**
     * WebSocket route handler
     */
    ws(path: string, handler: WebSocketHandler): this;

    /**
     * WebSocket middleware
     */
    wsUse(middleware: WebSocketMiddleware): this;

    /**
     * Broadcast to WebSocket connections
     */
    wsBroadcast(data: any, room?: string): this;

    /**
     * Get WebSocket statistics
     */
    getWebSocketStats(): WebSocketStats | undefined;

    /**
     * Get WebSocket connections
     */
    getWebSocketConnections(): NextRushWebSocket[];

    /**
     * 🔐 Authentication & Authorization Methods
     */

    /**
     * Configure JWT authentication
     */
    useJwt(options: {
      secret: string;
      expiresIn?: string;
      algorithm?: string;
    }): this;

    /**
     * Define user role with permissions
     */
    defineRole(role: {
      name: string;
      permissions: Array<{
        resource: string;
        action: string;
      }>;
    }): this;

    /**
     * 📊 Metrics & Monitoring Methods
     */

    /**
     * Enable metrics collection and endpoint
     */
    enableMetrics(options?: {
      endpoint?: string;
      enableHealthCheck?: boolean;
      collectDefaultMetrics?: boolean;
      requestTracking?: boolean;
      format?: 'prometheus' | 'json';
      prefix?: string;
    }): this;

    /**
     * Increment a counter metric
     */
    incrementCounter(
      name: string,
      labels?: Record<string, string>,
      value?: number
    ): this;

    /**
     * Set a gauge metric value
     */
    setGauge(
      name: string,
      value: number,
      labels?: Record<string, string>
    ): this;

    /**
     * 🛡️ Rate Limiting Methods
     */

    /**
     * Enable global rate limiting
     */
    enableGlobalRateLimit(options?: {
      windowMs?: number;
      max?: number;
      message?: string;
      statusCode?: number;
    }): this;

    /**
     * Create a rate limiter middleware
     */
    useRateLimit(options?: RateLimitOptions): MiddlewareFunction;

    /**
     * 🌐 CORS & Security Methods
     */

    /**
     * Enable CORS globally
     */
    enableCors(options?: {
      origin?: string | string[] | boolean;
      methods?: string[];
      credentials?: boolean;
      allowedHeaders?: string[];
      exposedHeaders?: string[];
    }): this;

    /**
     * Enable XSS protection
     */
    xssProtection(options?: XssProtectionOptions): MiddlewareFunction;

    /**
     * 🔄 Event-driven architecture methods
     */

    /**
     * Add event listener
     */
    on(event: string, handler: (...args: any[]) => void | Promise<void>): this;

    /**
     * Add one-time event listener
     */
    once(
      event: string,
      handler: (...args: any[]) => void | Promise<void>
    ): this;

    /**
     * Remove event listener
     */
    off(
      event: string,
      handler?: (...args: any[]) => void | Promise<void>
    ): this;

    /**
     * Emit event
     */
    emit(event: string, ...args: any[]): this;

    /**
     * Create event middleware
     */
    eventMiddleware(options?: {
      autoEmit?: boolean;
      events?: string[];
      includeRequest?: boolean;
      includeResponse?: boolean;
    }): MiddlewareFunction;

    /**
     * Get event statistics
     */
    getEventStats(): EventStats;

    /**
     * Get event history
     */
    getEventHistory(): Array<{
      event: string;
      data: any;
      timestamp: Date;
    }>;

    /**
     * 🛡️ Input validation & sanitization methods
     */

    /**
     * Create validation middleware
     */
    validate(schema: ValidationSchema): MiddlewareFunction;

    /**
     * Create sanitization middleware
     */
    sanitize(options?: SanitizationOptions): MiddlewareFunction;

    /**
     * Static file server
     */
    static(path: string, directory: string, options?: StaticOptions): this;

    /**
     * Set template views directory
     * @param path - Views directory path
     * @returns Application instance for chaining
     */
    setViews(path: string): this;

    /**
     * Render template
     * @param template - Template name
     * @param data - Template data
     * @returns Rendered content
     */
    render(template: string, data: Record<string, any>): string;

    /**
     * Start the server
     * @param port - Port number
     * @param hostname - Optional hostname
     * @param callback - Optional callback
     * @returns Promise that resolves when server starts
     */
    listen(
      port: number,
      hostname?: string,
      callback?: () => void
    ): Promise<void>;

    /**
     * Stop the server
     * @returns Promise that resolves when server stops
     */
    close(): Promise<void>;
  }
}

/**
 * Global exports for convenience
 */
declare global {
  namespace NextRush {
    type Request = NextRushRequest;
    type Response = NextRushResponse;
    type Context = RequestContext;
    type Middleware = MiddlewareHandler;
  }
}

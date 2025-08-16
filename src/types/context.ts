/**
 * Koa-style context types for NextRush v2
 *
 * @packageDocumentation
 */

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
import type { ExceptionFilter } from '@/errors/custom-errors';
import type { CookieOptions } from '@/utils/cookies';
import { IncomingMessage, ServerResponse } from 'node:http';
import { ParsedUrlQuery } from 'node:querystring';
import { NextRushRequest } from './http';

// ============================================================================
// WebSocket Types - Centralized here for better IntelliSense
// ============================================================================

/**
 * WebSocket connection interface
 */
export interface WSConnection {
  /** Unique connection ID */
  id: string;
  /** WebSocket request URL */
  url: string;
  /** Connection alive status */
  isAlive: boolean;
  /** Last pong timestamp */
  lastPong: number;
  /** Send message to client */
  send(data: string | Buffer): void;
  /** Close connection */
  close(code?: number, reason?: string): void;
  /** Join a room */
  join(room: string): void;
  /** Leave a room */
  leave(room: string): void;
  /** Listen for incoming messages */
  onMessage(listener: (data: string | Buffer) => void): void;
  /** Listen for connection close */
  onClose(listener: (code: number, reason: string) => void): void;
}

/**
 * WebSocket route handler type
 */
export type WSHandler = (
  socket: WSConnection,
  req: IncomingMessage
) => void | Promise<void>;

/**
 * WebSocket middleware type
 */
export type WSMiddleware = (
  socket: WSConnection,
  req: IncomingMessage,
  next: () => void
) => void | Promise<void>;

/**
 * WebSocket plugin options
 */
export interface WebSocketPluginOptions {
  /** Accepted paths (exact or wildcard *) */
  path?: string | string[];
  /** Ping interval in milliseconds */
  heartbeatMs?: number;
  /** Close if no pong within this timeout */
  pongTimeoutMs?: number;
  /** Maximum concurrent connections */
  maxConnections?: number;
  /** Maximum message size in bytes */
  maxMessageSize?: number;
  /** Allowed origins for CORS */
  allowOrigins?: (string | RegExp)[];
  /** Custom client verification */
  verifyClient?: (req: IncomingMessage) => Promise<boolean> | boolean;
  /** Debug mode */
  debug?: boolean;
}

/**
 * Default WebSocket plugin options
 */
export const DEFAULT_WS_OPTIONS: Required<WebSocketPluginOptions> = {
  path: '/ws',
  heartbeatMs: 30000,
  pongTimeoutMs: 45000,
  maxConnections: 10000,
  maxMessageSize: 1 << 20, // 1MB
  allowOrigins: [],
  verifyClient: () => true,
  debug: false,
};

/**
 * Enhanced response object with Express-like methods
 */
export interface NextRushResponse extends ServerResponse {
  /** Send JSON response */
  json(data: unknown): NextRushResponse;
  /** Send HTML response */
  html(data: string): NextRushResponse;
  /** Send text response */
  text(data: string): NextRushResponse;
  /** Send CSV response */
  csv(data: string): NextRushResponse;
  /** Send XML response */
  xml(data: string): NextRushResponse;
  /** Send any data type response */
  send(data: string | Buffer | object): void;
  /** Stream response */
  stream(stream: NodeJS.ReadableStream, contentType?: string): void;
  /** Render HTML from a template string or a template name under viewsDir */
  render(
    templateOrName: string,
    data?: Record<string, unknown>,
    options?: { layout?: string }
  ): Promise<void>;
  /** Send file response (alias) */
  file(
    path: string,
    options?: { root?: string; etag?: boolean }
  ): NextRushResponse;
  /** Send file response */
  sendFile(
    path: string,
    options?: { root?: string; etag?: boolean }
  ): NextRushResponse;
  /** Send download response */
  download(path: string, filename?: string): NextRushResponse;
  /** Redirect response */
  redirect(url: string, status?: number): NextRushResponse;
  /** Permanent redirect (301) */
  redirectPermanent(url: string): NextRushResponse;
  /** Temporary redirect (307) */
  redirectTemporary(url: string): NextRushResponse;
  /** Set response status */
  status(code: number): NextRushResponse;
  /** Set response header */
  set(name: string, value: string | number | string[]): NextRushResponse;
  /** Set response header (alias) */
  header(field: string, value: string): NextRushResponse;
  /** Get response header */
  get(name: string): string | number | string[] | undefined;
  /** Remove response header */
  remove(name: string): NextRushResponse;
  /** Remove response header (implementation method) */
  removeHeader(field: string): NextRushResponse;
  /** Set response type */
  type(type: string): NextRushResponse;
  /** Set response length */
  length(length: number): NextRushResponse;
  /** Set response etag */
  etag(etag: string): NextRushResponse;
  /** Set response last modified */
  lastModified(date: Date): NextRushResponse;
  /** Set cookie */
  cookie(
    name: string,
    value: string,
    options?: CookieOptions
  ): NextRushResponse;
  /** Clear cookie */
  clearCookie(name: string, options?: CookieOptions): NextRushResponse;
  /** Set cache headers */
  cache(seconds: number): NextRushResponse;
  /** Disable caching */
  noCache(): NextRushResponse;
  /** Set CORS headers */
  cors(origin?: string): NextRushResponse;
  /** Set security headers */
  security(): NextRushResponse;
  /** Enable compression hint */
  compress(): NextRushResponse;
  /** Send success response */
  success(data: unknown, message?: string): void;
  /** Send error response */
  error(message: string, code?: number, details?: unknown): void;
  /** Send paginated response */
  paginate(data: unknown[], page: number, limit: number, total: number): void;
  /** Get content type from file extension */
  getContentTypeFromExtension(ext: string): string;
  /** Get smart content type from file path */
  getSmartContentType(filePath: string): string;
  /** Generate ETag from stats */
  generateETag(stats: unknown): string;
  /** Convert data to CSV */
  convertToCSV(data: unknown[]): string;
  /** Add timing header */
  time(label?: string): NextRushResponse;
  /** Get nested value from object */
  getNestedValue(obj: unknown, path: string): unknown;
  /** Check if value is truthy */
  isTruthy(value: unknown): boolean;
}

/**
 * Koa-style context interface
 */
export interface Context {
  /** Request object (Express-like) */
  req: NextRushRequest;
  /** Response object (Express-like) */
  res: NextRushResponse;
  /** Request body (Express-like) */
  body: unknown;
  /** Request method */
  method: string;
  /** Request URL */
  url: string;
  /** Request path */
  path: string;
  /** Request headers */
  headers: IncomingMessage['headers'];
  /** Query parameters */
  query: ParsedUrlQuery;
  /** Route parameters */
  params: Record<string, string>;
  /** Request ID for tracing */
  id: string | undefined;
  /** Request ID for logging (alternative to id) */
  requestId?: string;
  /** Request-specific logger */
  logger?: {
    log: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
  };
  /** State object for middleware communication */
  state: Record<string, unknown>;
  /** Request start time */
  startTime: number;
  /** Get client IP */
  ip: string;
  /** Check if request is secure */
  secure: boolean;
  /** Request protocol */
  protocol: string;
  /** Request hostname */
  hostname: string;
  /** Request host */
  host: string;
  /** Request origin */
  origin: string;
  /** Request href */
  href: string;
  /** Request search */
  search: string;
  /** Request search params */
  searchParams: URLSearchParams;
  /** Response status */
  status: number;
  /** Response headers */
  responseHeaders: Record<string, string | number | string[]>;

  // Context methods (Koa-style)
  /** Throw an error */
  throw(status: number, message?: string): never;
  /** Assert a condition */
  assert(
    condition: unknown,
    status: number,
    message?: string
  ): asserts condition;
  /** Check if response is fresh */
  fresh(): boolean;
  /** Check if response is stale */
  stale(): boolean;
  /** Check if request is idempotent */
  idempotent(): boolean;
  /** Check if request is cacheable */
  cacheable(): boolean;
  /** Set response header (Koa-style) */
  set(name: string, value: string | number | string[]): void;
  /** Send a file using the enhanced response */
  sendFile(path: string, options?: { root?: string; etag?: boolean }): void;
  /** Render HTML from a template string or a template name under viewsDir */
  render(
    templateOrName: string,
    data?: Record<string, unknown>,
    options?: { layout?: string }
  ): Promise<void>;

  // Convenience methods for better DX (most popular response methods)
  /** Send JSON response (convenience for ctx.res.json) */
  json(data: unknown): void;
  /** Send response data (convenience for ctx.res.send) */
  send(data: string | Buffer | object): void;
  /** Redirect response (convenience for ctx.res.redirect) */
  redirect(url: string, statusCode?: number): void;
  /** Set cookie (convenience for ctx.res.cookie) */
  cookie(
    name: string,
    value: string,
    options?: CookieOptions
  ): NextRushResponse;
}

/**
 * Next function for middleware
 */
export type Next = () => Promise<void>;

/**
 * Middleware function type
 */
export type Middleware = (ctx: Context, next: Next) => Promise<void>;

/**
 * Route handler function type
 */
export type RouteHandler = (ctx: Context) => Promise<void> | void;

/**
 * Error handler function type
 */
export type ErrorHandler = (error: Error, ctx: Context) => Promise<void> | void;

// ============================================================================
// Plugin Types - Static Files
// ============================================================================

/** Dotfiles policy for static files */
export type DotfilesPolicy = 'ignore' | 'deny' | 'allow';

/** Options for StaticFilesPlugin */
export interface StaticFilesOptions {
  /** Absolute directory to serve files from */
  root: string;
  /** URL prefix to mount under, e.g., "/static"; default: '' (root) */
  prefix?: `/${string}` | '';
  /** Default index file to serve for directories; set false to disable */
  index?: string | false;
  /** If true, call next() on 404 instead of sending 404; default: false */
  fallthrough?: boolean;
  /** If true, redirect directory request without trailing slash to slash; default: true */
  redirect?: boolean;
  /** Send Cache-Control max-age seconds; default: 0 (no explicit caching) */
  maxAge?: number;
  /** Add immutable directive to Cache-Control when maxAge > 0; default: false */
  immutable?: boolean;
  /** Control dotfiles serving; default: 'ignore' (404) */
  dotfiles?: DotfilesPolicy;
  /** Additional extensions to try when file not found (e.g., ['.html']); default: [] */
  extensions?: string[];
  /** Hook to customize headers */
  setHeaders?: (ctx: Context, absolutePath: string, stat: StatsLike) => void;
}

/** Stats-like interface for static files */
export interface StatsLike {
  isFile(): boolean;
  isDirectory(): boolean;
  size: number;
  mtime: Date;
}

// ============================================================================
// Plugin Types - Template Engine
// ============================================================================

/** Options for TemplatePlugin */
export interface TemplatePluginOptions {
  /** Directory containing template files */
  viewsDir?: string;
  /** Enable template caching; default: true */
  cache?: boolean;
  /** Custom helper functions */
  helpers?: Record<string, (value: unknown, ...args: unknown[]) => unknown>;
  /** Preloaded partial templates */
  partials?: Record<string, string>;
  /** Enable loading partials from viewsDir; default: true */
  enableFilePartials?: boolean;
  /** File extension for partials; default: '.html' */
  partialExt?: string;
}

/** Template helper function type */
export type TemplateHelper = (value: unknown, ...args: unknown[]) => unknown;

/** Template render options */
export interface TemplateRenderOptions {
  /** Layout template to wrap content in */
  layout?: string;
}

// ============================================================================
// Plugin Types - END
// ============================================================================

/**
 * Route configuration object (Fastify-style)
 */
export interface RouteConfig {
  /** Route handler */
  handler: RouteHandler;
  /** Route middleware */
  middleware?: Middleware[];
  /** Route schema validation */
  schema?: {
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
    params?: Record<string, unknown>;
    response?: Record<string, unknown>;
  };
  /** Route options */
  options?: {
    /** Route name */
    name?: string;
    /** Route description */
    description?: string;
    /** Route tags */
    tags?: string[];
    /** Route version */
    version?: string;
    /** Route deprecated */
    deprecated?: boolean;
    /** Route summary */
    summary?: string;
    /** Route external docs */
    externalDocs?: {
      description: string;
      url: string;
    };
  };
}

/**
 * Route data with handler and middleware
 */
export interface RouteData {
  handler: RouteHandler;
  middleware: Middleware[];
}

/**
 * Router interface for modular routing
 */
export interface Router {
  /** Register GET route */
  get(path: string, handler: RouteHandler | RouteConfig): Router;
  /** Register POST route */
  post(path: string, handler: RouteHandler | RouteConfig): Router;
  /** Register PUT route */
  put(path: string, handler: RouteHandler | RouteConfig): Router;
  /** Register DELETE route */
  delete(path: string, handler: RouteHandler | RouteConfig): Router;
  /** Register PATCH route */
  patch(path: string, handler: RouteHandler | RouteConfig): Router;
  /** Register middleware */
  use(middleware: Middleware): Router;
  /** Register sub-router */
  use(prefix: string, router: Router): Router;
  /** Get router middleware */
  getMiddleware(): Middleware[];
  /** Get router routes */
  getRoutes(): Map<string, RouteData>;
}

/**
 * Application context interface
 */
export interface AppContext {
  /** Application instance */
  app: Application;
  /** Request context */
  ctx: Context;
  /** Error if any */
  error?: Error;
}

/**
 * Application interface (forward declaration)
 */
export interface Application {
  /** Register GET route */
  get(path: string, handler: RouteHandler | RouteConfig): Application;
  /** Register POST route */
  post(path: string, handler: RouteHandler | RouteConfig): Application;
  /** Register PUT route */
  put(path: string, handler: RouteHandler | RouteConfig): Application;
  /** Register DELETE route */
  delete(path: string, handler: RouteHandler | RouteConfig): Application;
  /** Register PATCH route */
  patch(path: string, handler: RouteHandler | RouteConfig): Application;
  /** Register middleware */
  use(middleware: Middleware): Application;
  /** Register router */
  use(prefix: string, router: Router): Application;
  /** Create router */
  router(): Router;
  /** Start the server */
  listen(port?: number, host?: string, callback?: () => void): unknown;
  /** Get the underlying HTTP server */
  getServer(): unknown;
  /** Gracefully shutdown the application */
  shutdown(): Promise<void>;

  // Middleware factory methods
  /** Create CORS middleware */
  cors(options?: CorsOptions): Middleware;
  /** Create helmet middleware */
  helmet(options?: HelmetOptions): Middleware;
  /** Create JSON body parser middleware */
  json(options?: EnhancedBodyParserOptions): Middleware;
  /** Create URL-encoded body parser middleware */
  urlencoded(options?: EnhancedBodyParserOptions): Middleware;
  /** Create text body parser middleware */
  text(options?: EnhancedBodyParserOptions): Middleware;
  /** Create rate limiter middleware */
  rateLimit(options?: RateLimiterOptions): Middleware;
  /** Create logger middleware */
  logger(options?: LoggerOptions): Middleware;
  /** Create compression middleware */
  compression(options?: CompressionOptions): Middleware;
  /** Create request ID middleware */
  requestId(options?: RequestIdOptions): Middleware;
  /** Create timer middleware */
  timer(options?: TimerOptions): Middleware;
  /** Create smart body parser middleware */
  smartBodyParser(options?: EnhancedBodyParserOptions): Middleware;
  /** Create exception filter middleware */
  exceptionFilter(filters?: ExceptionFilter[]): Middleware;

  /** Logger instance (set by LoggerPlugin) - overrides logger method when plugin is installed */
  loggerInstance?: {
    error: (message: string, context?: Record<string, unknown>) => void;
    warn: (message: string, context?: Record<string, unknown>) => void;
    info: (message: string, context?: Record<string, unknown>) => void;
    debug: (message: string, context?: Record<string, unknown>) => void;
    trace: (message: string, context?: Record<string, unknown>) => void;
    log: (message: string, context?: Record<string, unknown>) => void;
  };

  // ============================================================================
  // WebSocket Methods - Available when WebSocketPlugin is installed
  // ============================================================================

  /** Register a WebSocket route (exact path or with trailing * wildcard) */
  ws?: (path: string, handler: WSHandler) => Application;
  /** Register a WebSocket middleware executed before the handler */
  wsUse?: (middleware: WSMiddleware) => Application;
  /** Broadcast a message to all sockets or a specific room */
  wsBroadcast?: (message: string, room?: string) => Application;

  // ============================================================================
  // Static Files Methods - Available when StaticFilesPlugin is installed
  // ============================================================================

  /** Register a static files route */
  static?: (
    prefix: string,
    root: string,
    options?: StaticFilesOptions
  ) => Application;

  // ============================================================================
  // Template Methods - Available when TemplatePlugin is installed
  // ============================================================================

  /** Register template engine and view directory */
  setViewEngine?: (
    engine: string,
    viewsDir?: string,
    options?: TemplatePluginOptions
  ) => Application;
  /** Add template helper */
  helper?: (
    name: string,
    fn: (value: unknown, ...args: unknown[]) => unknown
  ) => Application;
  /** Add template partial */
  partial?: (name: string, template: string) => Application;
}

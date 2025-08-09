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
import { IncomingMessage, ServerResponse } from 'node:http';
import { ParsedUrlQuery } from 'node:querystring';
import { NextRushRequest } from './http';

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
  /** Set response status */
  status(code: number): NextRushResponse;
  /** Set response header */
  set(name: string, value: string | number | string[]): NextRushResponse;
  /** Get response header */
  get(name: string): string | number | string[] | undefined;
  /** Remove response header */
  remove(name: string): NextRushResponse;
  /** Set response type */
  type(type: string): NextRushResponse;
  /** Set response length */
  length(length: number): NextRushResponse;
  /** Set response etag */
  etag(etag: string): NextRushResponse;
  /** Set response last modified */
  lastModified(date: Date): NextRushResponse;
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
  getRoutes(): Map<string, RouteHandler>;
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
}

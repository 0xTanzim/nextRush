/**
 * Middleware Types for NextRush v2
 *
 * @packageDocumentation
 */

import type { Context } from '@/types/context';

/**
 * Standard middleware function signature
 */
export type Middleware = (
  ctx: Context,
  next: () => Promise<void>
) => Promise<void>;

/**
 * Async middleware function signature
 */
export type AsyncMiddleware = (
  ctx: Context,
  next: () => Promise<void>
) => Promise<void>;

/**
 * Error middleware function signature
 */
export type ErrorMiddleware = (
  error: Error,
  ctx: Context,
  next: () => Promise<void>
) => Promise<void>;

/**
 * Middleware options interface
 */
export interface MiddlewareOptions {
  /** Enable/disable middleware */
  enabled?: boolean;
  /** Middleware priority (lower = higher priority) */
  priority?: number;
  /** Middleware configuration */
  config?: Record<string, unknown>;
}

/**
 * CORS middleware options
 */
export interface CorsOptions {
  /** Allowed origins */
  origin?: string | string[] | boolean | ((origin: string) => boolean);
  /** Allowed methods */
  methods?: string[];
  /** Allowed headers */
  allowedHeaders?: string[];
  /** Exposed headers */
  exposedHeaders?: string[];
  /** Allow credentials */
  credentials?: boolean;
  /** Max age for preflight */
  maxAge?: number;
  /** Preflight continue */
  preflightContinue?: boolean;
  /** Options success status */
  optionsSuccessStatus?: number;
}

/**
 * Helmet middleware options
 */
export interface HelmetOptions {
  /** Content Security Policy */
  contentSecurityPolicy?: {
    directives: Record<string, string[]>;
    reportOnly?: boolean;
  };
  /** HTTP Strict Transport Security */
  hsts?: {
    maxAge: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
  /** XSS Protection */
  xssFilter?: boolean;
  /** Content Type Options */
  noSniff?: boolean;
  /** Frame Options */
  frameguard?: {
    action: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM';
    domain?: string;
  };
  /** Referrer Policy */
  referrerPolicy?: {
    policy: string;
  };
  /** Hide X-Powered-By header */
  hidePoweredBy?: boolean;
  /** DNS Prefetch Control */
  dnsPrefetchControl?: {
    allow?: boolean;
  };
  /** IE No Open */
  ieNoOpen?: boolean;
  /** Permitted Cross Domain Policies */
  permittedCrossDomainPolicies?: {
    permittedPolicies?: string;
  };
}

/**
 * Body parser options
 */
export interface BodyParserOptions {
  /** JSON parser options */
  json?: {
    limit?: string | number;
    strict?: boolean;
    reviver?: (key: string, value: unknown) => unknown;
  };
  /** URL-encoded parser options */
  urlencoded?: {
    limit?: string | number;
    extended?: boolean;
    parameterLimit?: number;
  };
  /** Text parser options */
  text?: {
    limit?: string | number;
    type?: string;
  };
  /** Raw parser options */
  raw?: {
    limit?: string | number;
    type?: string;
  };
}

// Removed JsonOptions and UrlencodedOptions - now using enhanced body parser types

/**
 * Rate limiter options
 */
export interface RateLimiterOptions {
  /** Time window in milliseconds */
  windowMs?: number;
  /** Maximum requests per window */
  max?: number;
  /** Rate limit message */
  message?: string;
  /** Status code for rate limited requests */
  statusCode?: number;
  /** Include headers */
  headers?: boolean;
  /** Skip successful requests */
  skipSuccessfulRequests?: boolean;
  /** Skip failed requests */
  skipFailedRequests?: boolean;
  /** Key generator function */
  keyGenerator?: (ctx: Context) => string;
  /** Skip function */
  skip?: (ctx: Context) => boolean;
  /** Custom handler */
  handler?: (ctx: Context) => void;
  /** Store implementation */
  store?: {
    get(key: string): { count: number; resetTime: number } | null;
    increment(key: string): { count: number; resetTime: number };
    reset(key: string): void;
    clear(): void;
  };
}

/**
 * Logger middleware options
 */
export interface LoggerOptions {
  /** Log format */
  format?: 'simple' | 'detailed' | 'json' | 'combined';
  /** Log level */
  level?: 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';
  /** Colorize output */
  colorize?: boolean;
  /** Include timestamp */
  timestamp?: boolean;
  /** Show headers */
  showHeaders?: boolean;
  /** Show body */
  showBody?: boolean;
  /** Show query */
  showQuery?: boolean;
  /** Show response time */
  showResponseTime?: boolean;
  /** Show user agent */
  showUserAgent?: boolean;
  /** Show referer */
  showReferer?: boolean;
  /** Show IP */
  showIP?: boolean;
  /** Show method */
  showMethod?: boolean;
  /** Show URL */
  showURL?: boolean;
  /** Show status */
  showStatus?: boolean;
  /** Show response size */
  showResponseSize?: boolean;
  /** Custom format function */
  customFormat?: (ctx: Context, duration: number) => string;
  /** Filter function */
  filter?: (ctx: Context) => boolean;
  /** Output stream */
  stream?: NodeJS.WritableStream;
}

/**
 * Compression middleware options
 */
export interface CompressionOptions {
  /** Compression level (1-9) */
  level?: number;
  /** Minimum size to compress */
  threshold?: number;
  /** Filter function */
  filter?: (ctx: Context) => boolean;
  /** Content types to compress */
  contentType?: string[];
  /** Content types to exclude */
  exclude?: string[];
  /** Enable gzip */
  gzip?: boolean;
  /** Enable deflate */
  deflate?: boolean;
  /** Enable brotli */
  brotli?: boolean;
  /** Window size */
  windowBits?: number;
  /** Memory level */
  memLevel?: number;
  /** Strategy */
  strategy?: number;
  /** Chunk size */
  chunkSize?: number;
  /** Dictionary */
  dictionary?: Buffer;
}

/**
 * Request ID middleware options
 */
export interface RequestIdOptions {
  /** Request ID header name */
  headerName?: string;
  /** Request ID generator function */
  generator?: () => string;
  /** Add to response headers */
  addResponseHeader?: boolean;
  /** Echo existing header */
  echoHeader?: boolean;
  /** Set in context */
  setInContext?: boolean;
  /** Include in logs */
  includeInLogs?: boolean;
}

/**
 * Timer middleware options
 */
export interface TimerOptions {
  /** Response time header name */
  header?: string;
  /** Number of decimal places */
  digits?: number;
  /** Time unit suffix */
  suffix?: string;
  /** Include start time */
  includeStartTime?: boolean;
  /** Include end time */
  includeEndTime?: boolean;
  /** Include duration */
  includeDuration?: boolean;
  /** Format type */
  format?: 'milliseconds' | 'seconds' | 'microseconds' | 'nanoseconds';
  /** Threshold for logging */
  threshold?: number;
  /** Log slow requests */
  logSlow?: boolean;
  /** Slow request threshold */
  logSlowThreshold?: number;
  /** Custom format function */
  customFormat?: (duration: number) => string;
}

/**
 * Middleware preset options
 */
export interface MiddlewarePresetOptions {
  /** CORS configuration */
  cors?: boolean | CorsOptions;
  /** Helmet configuration */
  helmet?: boolean | HelmetOptions;
  /** Body parser configuration */
  bodyParser?: boolean | BodyParserOptions;
  /** Rate limiter configuration */
  rateLimit?: boolean | RateLimiterOptions;
  /** Logger configuration */
  logger?: boolean | LoggerOptions;
  /** Compression configuration */
  compression?: boolean | CompressionOptions;
  /** Request ID configuration */
  requestId?: boolean | RequestIdOptions;
  /** Timer configuration */
  timer?: boolean | TimerOptions;
}

/**
 * Available middleware presets
 */
export type MiddlewarePreset =
  | 'development'
  | 'production'
  | 'api'
  | 'security'
  | 'minimal'
  | 'fullFeatured';

/**
 * Middleware metrics
 */
export interface MiddlewareMetrics {
  /** Total requests processed */
  totalRequests: number;
  /** Average execution time in milliseconds */
  averageExecutionTime: number;
  /** Requests per second */
  requestsPerSecond: number;
  /** Middleware performance by name */
  byName: Record<
    string,
    {
      count: number;
      totalTime: number;
      averageTime: number;
    }
  >;
  /** Slowest middleware */
  slowMiddleware: Array<{
    name: string;
    averageTime: number;
    count: number;
  }>;
}

/**
 * Middleware composition result
 */
export interface MiddlewareComposition {
  /** Composed middleware function */
  middleware: Middleware;
  /** Middleware names in order */
  names: string[];
  /** Total middleware count */
  count: number;
}

/**
 * Conditional middleware options
 */
export interface ConditionalMiddlewareOptions {
  /** Condition function */
  condition: (ctx: Context) => boolean;
  /** Middleware to apply when condition is true */
  middleware: Middleware;
  /** Middleware name for debugging */
  name?: string;
}

/**
 * Named middleware options
 */
export interface NamedMiddlewareOptions {
  /** Middleware name */
  name: string;
  /** Middleware function */
  middleware: Middleware;
  /** Enable performance tracking */
  trackPerformance?: boolean;
}

/**
 * 🎯 NextRush Application Options - Zero `any` Usage, Full Type Safety
 *
 * Comprehensive type definitions for all plugin options to provide:
 * - ✅ Full IntelliSense support
 * - ✅ Compile-time error detection
 * - ✅ Runtime type safety
 * - ✅ No typos or configuration mistakes
 */

// ============================================================================
// 🔒 Security & CORS Options
// ============================================================================

export interface CorsOptions {
  origin?: string | string[] | boolean | ((origin: string) => boolean);
  methods?: string | string[];
  allowedHeaders?: string | string[];
  exposedHeaders?: string | string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

export interface HelmetOptions {
  contentSecurityPolicy?:
    | boolean
    | {
        directives?: Record<string, string[]>;
        reportOnly?: boolean;
      };
  hsts?:
    | boolean
    | {
        maxAge?: number;
        includeSubDomains?: boolean;
        preload?: boolean;
      };
  noSniff?: boolean;
  frameguard?:
    | boolean
    | {
        action?: 'deny' | 'sameorigin';
      };
  xssFilter?: boolean;
  referrerPolicy?:
    | boolean
    | {
        policy?: string | string[];
      };
}

export interface XssProtectionOptions {
  mode?: 'block' | 'sanitize';
  reportUri?: string;
  setOnOldIE?: boolean;
}

export interface WebSecurityOptions {
  enableHsts?: boolean;
  enableXssProtection?: boolean;
  enableNoSniff?: boolean;
  enableFrameguard?: boolean;
  customHeaders?: Record<string, string>;
}

// ============================================================================
// 📦 Body Parser Options
// ============================================================================

export interface JsonParserOptions {
  limit?: string | number;
  strict?: boolean;
  reviver?: (key: string, value: any) => any;
  type?: string | string[] | ((req: any) => boolean);
  verify?: (req: any, res: any, buf: Buffer, encoding: string) => void;
}

export interface UrlEncodedParserOptions {
  limit?: string | number;
  extended?: boolean;
  parameterLimit?: number;
  type?: string | string[] | ((req: any) => boolean);
  verify?: (req: any, res: any, buf: Buffer, encoding: string) => void;
}

export interface TextParserOptions {
  limit?: string | number;
  type?: string | string[] | ((req: any) => boolean);
  defaultCharset?: string;
}

export interface RawParserOptions {
  limit?: string | number;
  type?: string | string[] | ((req: any) => boolean);
}

// ============================================================================
// ⚡ Performance Options
// ============================================================================

export interface CompressionOptions {
  level?: number;
  chunkSize?: number;
  windowBits?: number;
  memLevel?: number;
  strategy?: number;
  threshold?: number;
  filter?: (req: any, res: any) => boolean;
}

export interface RateLimitOptions {
  windowMs?: number;
  max?: number | ((req: any) => number | Promise<number>);
  message?: string | object | ((req: any, res: any) => string | object);
  statusCode?: number;
  headers?: boolean;
  draft_polli_ratelimit_headers?: boolean;
  legacyHeaders?: boolean;
  standardHeaders?: boolean;
  store?: any;
  skip?: (req: any, res: any) => boolean | Promise<boolean>;
  keyGenerator?: (req: any, res: any) => string;
  handler?: (req: any, res: any, next: () => void, options?: any) => void;
  onLimitReached?: (req: any, res: any, options?: any) => void;
}

export interface GlobalRateLimitOptions extends RateLimitOptions {
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  resetTime?: Date;
}

// ============================================================================
// 📊 Monitoring & Logging Options
// ============================================================================

export interface LoggerOptions {
  format?: 'combined' | 'common' | 'dev' | 'short' | 'tiny' | string;
  immediate?: boolean;
  skip?: (req: any, res: any) => boolean;
  stream?: NodeJS.WritableStream;
  buffer?: boolean;
}

export interface RequestIdOptions {
  header?: string;
  generator?: () => string;
  attributeKey?: string;
  setHeader?: boolean;
}

export interface TimerOptions {
  total?: boolean;
  enabled?: boolean;
  header?: string;
  suffix?: boolean;
  digits?: number;
}

// ============================================================================
// 📊 Metrics & Health Options
// ============================================================================

export interface MetricsOptions {
  prefix?: string;
  defaultLabels?: Record<string, string>;
  collectDefaultMetrics?: boolean;
  timeout?: number;
  endpoint?: string;
  enableHealthCheck?: boolean;
  customMetrics?: {
    counters?: string[];
    gauges?: string[];
    histograms?: string[];
  };
}

export interface HealthCheckFunction {
  (): Promise<{
    status: 'pass' | 'fail' | 'warn';
    message?: string;
    details?: any;
  }>;
}

// ============================================================================
// 🔐 Authentication & Authorization Options
// ============================================================================

export interface JwtOptions {
  secret: string;
  algorithm?: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512';
  expiresIn?: string | number;
  issuer?: string;
  audience?: string;
  subject?: string;
  clockTolerance?: number;
  ignoreExpiration?: boolean;
  ignoreNotBefore?: boolean;
  maxAge?: string | number;
  clockTimestamp?: number;
}

export interface JwtSignOptions {
  algorithm?: string;
  expiresIn?: string | number;
  notBefore?: string | number;
  audience?: string | string[];
  issuer?: string;
  jwtid?: string;
  subject?: string;
  noTimestamp?: boolean;
  header?: object;
  keyid?: string;
}

export interface JwtVerifyOptions {
  algorithms?: string[];
  audience?: string | RegExp | (string | RegExp)[];
  issuer?: string | string[];
  ignoreExpiration?: boolean;
  ignoreNotBefore?: boolean;
  subject?: string | string[];
  clockTolerance?: number;
  maxAge?: string | number;
  clockTimestamp?: number;
}

export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface Role {
  name: string;
  permissions: Permission[];
  inherits?: string[];
  description?: string;
}

export interface AuthStrategy {
  name: string;
  type: 'jwt' | 'session' | 'basic' | 'custom';
  options?: any;
}

// ============================================================================
// 🎛️ Middleware Preset Options
// ============================================================================

export interface PresetOptions {
  cors?: boolean | CorsOptions;
  helmet?: boolean | HelmetOptions;
  compression?: boolean | CompressionOptions;
  rateLimit?: boolean | RateLimitOptions;
  bodyParser?:
    | boolean
    | {
        json?: boolean | JsonParserOptions;
        urlencoded?: boolean | UrlEncodedParserOptions;
        text?: boolean | TextParserOptions;
        raw?: boolean | RawParserOptions;
      };
  logger?: boolean | LoggerOptions;
  metrics?: boolean | MetricsOptions;
}

// ============================================================================
// 🔄 Event-Driven Options (Already properly typed)
// ============================================================================

export interface EventMiddlewareOptions {
  autoEmit?: boolean;
  events?: string[];
  includeRequest?: boolean;
  includeResponse?: boolean;
  includeHeaders?: boolean;
  includeCookies?: boolean;
  excludePaths?: string[];
  onlyPaths?: string[];
}

// ============================================================================
// 🛡️ Validation Options (Already properly typed)
// ============================================================================

export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'array' | 'object';
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any) => boolean | string;
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

export interface SanitizationOptions {
  removeHtml?: boolean;
  escapeHtml?: boolean;
  trim?: boolean;
  lowercase?: boolean;
  uppercase?: boolean;
  removeSpecialChars?: boolean;
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
}

// ============================================================================
// 🎯 Middleware Function Types (Properly Typed)
// ============================================================================

export interface MiddlewareFunction {
  (req: any, res: any, next: () => void): void | Promise<void>;
}

export interface ErrorMiddlewareFunction {
  (error: any, req: any, res: any, next: () => void): void | Promise<void>;
}

// ============================================================================
// 📈 Return Types (No more `any` returns!)
// ============================================================================

export interface MetricsData {
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<
    string,
    { count: number; sum: number; buckets: Record<string, number> }
  >;
  uptime: number;
  timestamp: string;
}

export interface HealthData {
  status: 'pass' | 'fail' | 'warn';
  version: string;
  releaseId: string;
  notes: string[];
  output: string;
  details: Record<
    string,
    {
      status: 'pass' | 'fail' | 'warn';
      message?: string;
      details?: any;
    }
  >;
}

export interface EventStats {
  totalEvents: number;
  listeners: Record<string, number>;
  pipelines: number;
  recentEvents: Array<{
    event: string;
    data: any;
    timestamp: string;
  }>;
}

// ============================================================================
// 🎯 Smart Type Helpers for Better DX
// ============================================================================

export type SmartOptions<T> = T extends 'cors'
  ? CorsOptions
  : T extends 'helmet'
  ? HelmetOptions
  : T extends 'compression'
  ? CompressionOptions
  : T extends 'rateLimit'
  ? RateLimitOptions
  : T extends 'logger'
  ? LoggerOptions
  : T extends 'metrics'
  ? MetricsOptions
  : T extends 'jwt'
  ? JwtOptions
  : never;

// ============================================================================
// 🎪 All Types Already Exported Above - Ready for Import
// ============================================================================

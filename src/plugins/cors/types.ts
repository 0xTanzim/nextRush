/**
 * 🔥 CORS Types - High-Performance Type Definitions
 * Zero memory leaks, enterprise-grade CORS configuration
 */

// 🚀 Core CORS types
export type CorsOrigin = string | string[] | boolean | CorsOriginFunction;

export type CorsOriginFunction = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
) => void;

export type CorsMethod =
  | 'GET'
  | 'HEAD'
  | 'PUT'
  | 'PATCH'
  | 'POST'
  | 'DELETE'
  | 'OPTIONS';

// 🚀 Performance-optimized CORS options
export interface CorsOptions {
  /** Allowed origins for CORS requests */
  origin?: CorsOrigin;

  /** Allowed HTTP methods */
  methods?: string | string[] | CorsMethod[];

  /** Allowed request headers */
  allowedHeaders?: string | string[];

  /** Headers exposed to the client */
  exposedHeaders?: string | string[];

  /** Allow credentials in cross-origin requests */
  credentials?: boolean;

  /** Preflight cache duration in seconds */
  maxAge?: number;

  /** Continue to next middleware after preflight */
  preflightContinue?: boolean;

  /** Success status code for OPTIONS requests */
  optionsSuccessStatus?: number;

  /** Handle preflight requests automatically */
  preflight?: boolean;

  /** Enable origin caching for performance */
  cacheOrigins?: boolean;

  /** Cache TTL in milliseconds */
  cacheTtl?: number;

  /** Enable CORS metrics collection */
  enableMetrics?: boolean;
}

// 🚀 Internal optimized configuration
export interface CorsConfig {
  origin: CorsOrigin;
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge?: number;
  preflightContinue: boolean;
  optionsSuccessStatus: number;
  preflight: boolean;
  cacheOrigins: boolean;
  cacheTtl: number;
  enableMetrics: boolean;
}

// 🚀 CORS metrics for monitoring
export interface CorsMetrics {
  totalRequests: number;
  preflightRequests: number;
  allowedOrigins: number;
  blockedOrigins: number;
  cacheHits: number;
  cacheMisses: number;
  averageResponseTime: number;
  lastRequestTime: number;
}

// 🚀 Security configuration
export interface SecurityHeadersConfig {
  contentTypeOptions?: boolean;
  frameOptions?: 'DENY' | 'SAMEORIGIN' | string;
  xssProtection?: boolean;
  referrerPolicy?: string;
  permissionsPolicy?: string;
  strictTransportSecurity?: {
    enabled: boolean;
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };
}

// 🚀 CORS preset types
export enum CorsPresetType {
  ALLOW_ALL = 'allow_all',
  STRICT = 'strict',
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
  API_ONLY = 'api_only',
  MICROSERVICE = 'microservice',
}

// 🚀 Origin validation result (cached)
export interface OriginValidationResult {
  allowed: boolean;
  timestamp: number;
  ttl: number;
}

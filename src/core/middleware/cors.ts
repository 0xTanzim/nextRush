/**
 * CORS Middleware for NextRush v2
 *
 * High-performance CORS implementation with pre-computed headers
 * and optimized origin checking for enterprise applications.
 *
 * @packageDocumentation
 */

import type { Context } from '@/types/context';
import type { CorsOptions, Middleware } from './types';

/**
 * Default CORS options
 */
const DEFAULT_CORS_OPTIONS: Required<CorsOptions> = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: [],
  credentials: false,
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

/**
 * Pre-computed CORS headers for common configurations
 */
class CorsHeaderCache {
  private static cache = new Map<string, Record<string, string>>();

  /**
   * Get cached headers for a specific configuration
   */
  static getHeaders(options: CorsOptions): Record<string, string> {
    const key = this.generateCacheKey(options);

    if (!this.cache.has(key)) {
      this.cache.set(key, this.computeHeaders(options));
    }

    return this.cache.get(key)!;
  }

  /**
   * Generate cache key for options
   */
  private static generateCacheKey(options: CorsOptions): string {
    const origin = Array.isArray(options.origin)
      ? options.origin.sort().join(',')
      : String(options.origin);

    return `${origin}|${options.methods?.join(',') || ''}|${options.credentials}|${options.maxAge}`;
  }

  /**
   * Compute CORS headers
   */
  private static computeHeaders(options: CorsOptions): Record<string, string> {
    const headers: Record<string, string> = {};

    // Origin header
    if (options.origin !== false) {
      headers['Access-Control-Allow-Origin'] = Array.isArray(options.origin)
        ? options.origin[0] || '*' // Use first origin for pre-computed headers
        : String(options.origin || '*');
    }

    // Credentials
    if (options.credentials) {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    // Methods
    if (options.methods && options.methods.length > 0) {
      headers['Access-Control-Allow-Methods'] = options.methods.join(', ');
    }

    // Headers
    if (options.allowedHeaders && options.allowedHeaders.length > 0) {
      headers['Access-Control-Allow-Headers'] =
        options.allowedHeaders.join(', ');
    }

    // Exposed headers
    if (options.exposedHeaders && options.exposedHeaders.length > 0) {
      headers['Access-Control-Expose-Headers'] =
        options.exposedHeaders.join(', ');
    }

    // Max age
    if (options.maxAge) {
      headers['Access-Control-Max-Age'] = String(options.maxAge);
    }

    return headers;
  }

  /**
   * Clear cache
   */
  static clear(): void {
    this.cache.clear();
  }
}

/**
 * Origin validation function
 */
function createOriginValidator(
  options: CorsOptions
): (origin: string) => boolean {
  if (options.origin === false) {
    return () => false;
  }

  if (options.origin === true || options.origin === '*') {
    return () => true;
  }

  if (typeof options.origin === 'string') {
    return (origin: string) => origin === options.origin;
  }

  if (Array.isArray(options.origin)) {
    return (origin: string) => (options.origin as string[]).includes(origin);
  }

  if (typeof options.origin === 'function') {
    return options.origin;
  }

  return () => false;
}

/**
 * Create CORS middleware
 *
 * @param options - CORS configuration options
 * @returns CORS middleware function
 *
 * @example
 * ```typescript
 * import { createApp } from 'nextrush-v2';
 * import { cors } from '@/core/middleware';
 *
 * const app = createApp();
 *
 * // Basic CORS
 * app.use(cors());
 *
 * // Advanced CORS
 * app.use(cors({
 *   origin: ['https://app.example.com', 'https://admin.example.com'],
 *   credentials: true,
 *   methods: ['GET', 'POST', 'PUT', 'DELETE'],
 *   allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
 * }));
 * ```
 */
export function cors(options: CorsOptions = {}): Middleware {
  const config = { ...DEFAULT_CORS_OPTIONS, ...options };
  const validateOrigin = createOriginValidator(config);
  const preComputedHeaders = CorsHeaderCache.getHeaders(config);

  return async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    const origin = ctx.req.headers.origin;

    // Handle preflight requests
    if (ctx.method === 'OPTIONS') {
      // Set pre-computed headers
      Object.entries(preComputedHeaders).forEach(([key, value]) => {
        ctx.res.setHeader(key, value);
      });

      // Handle dynamic origin for preflight
      if (origin && validateOrigin(origin)) {
        ctx.res.setHeader('Access-Control-Allow-Origin', origin);
      }

      // End preflight request
      if (!config.preflightContinue) {
        ctx.status = config.optionsSuccessStatus;
        ctx.res.end();
        return;
      }
      // If preflightContinue is true, continue to next middleware
      // (next() will be called at the end)
    } else {
      // Handle actual requests
      if (origin && validateOrigin(origin)) {
        ctx.res.setHeader('Access-Control-Allow-Origin', origin);
      } else if (config.origin === '*' || config.origin === true) {
        // Set wildcard origin for all requests
        ctx.res.setHeader('Access-Control-Allow-Origin', '*');
      } else if (typeof config.origin === 'string' && config.origin !== '*') {
        // For string origins, set the configured origin
        ctx.res.setHeader('Access-Control-Allow-Origin', config.origin);
      }
      // Don't set origin header if no origin is provided and not using wildcard

      // Set other CORS headers
      Object.entries(preComputedHeaders).forEach(([key, value]) => {
        if (key !== 'Access-Control-Allow-Origin') {
          ctx.res.setHeader(key, value);
        }
      });
    }

    await next();
  };
}

/**
 * CORS middleware with performance tracking
 */
export function corsWithMetrics(options: CorsOptions = {}): Middleware {
  const corsMiddleware = cors(options);

  return async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    const start = process.hrtime.bigint();

    await corsMiddleware(ctx, async () => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to milliseconds

      // Store duration in context for external monitoring
      (ctx as any).corsDuration = duration;

      await next();
    });
  };
}

/**
 * CORS utilities
 */
export const corsUtils = {
  /**
   * Clear CORS header cache
   */
  clearCache: () => CorsHeaderCache.clear(),

  /**
   * Validate origin against allowed origins
   */
  validateOrigin: (origin: string, allowedOrigins: string[]): boolean => {
    return allowedOrigins.includes(origin);
  },

  /**
   * Generate CORS headers for a specific origin
   */
  generateHeaders: (
    origin: string,
    options: CorsOptions = {}
  ): Record<string, string> => {
    const config = { ...DEFAULT_CORS_OPTIONS, ...options };
    const headers = CorsHeaderCache.getHeaders(config);

    if (origin) {
      headers['Access-Control-Allow-Origin'] = origin;
    }

    return headers;
  },
};

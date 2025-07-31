/**
 * Rate Limiter Middleware for NextRush v2
 *
 * Provides rate limiting functionality to prevent abuse
 *
 * @packageDocumentation
 */

import type { Context } from '@/types/context';
import type { Middleware, RateLimiterOptions } from './types';

/**
 * Default rate limiter options
 */
const DEFAULT_RATE_LIMITER_OPTIONS: RateLimiterOptions = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.',
  statusCode: 429,
  headers: true,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  keyGenerator: (ctx: Context) => ctx.ip || 'unknown',
  skip: () => false,
  handler: (ctx: Context) => {
    ctx.status = 429;
    ctx.res.json({ error: 'Too many requests, please try again later.' });
  },
  // store will be created dynamically based on windowMs
};

/**
 * Memory-based rate limiter store
 */
export class MemoryStore {
  private store = new Map<string, { count: number; resetTime: number }>();

  constructor(private windowMs: number) {}

  /**
   * Get current count for a key
   */
  get(key: string): { count: number; resetTime: number } | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    // Check if window has expired
    if (Date.now() > entry.resetTime) {
      this.store.delete(key);
      return null;
    }

    return entry;
  }

  /**
   * Increment count for a key
   */
  increment(key: string): { count: number; resetTime: number } {
    const now = Date.now();
    const entry = this.get(key);

    if (!entry) {
      const newEntry = {
        count: 1,
        resetTime: now + this.windowMs,
      };
      this.store.set(key, newEntry);
      return newEntry;
    }

    entry.count++;
    this.store.set(key, entry);
    return entry;
  }

  /**
   * Reset count for a key
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.store.clear();
  }
}

/**
 * Create rate limiter middleware
 *
 * @param options - Rate limiter configuration options
 * @returns Rate limiter middleware function
 *
 * @example
 * ```typescript
 * import { rateLimit } from '@/core/middleware/rate-limiter';
 *
 * const app = createApp();
 *
 * // Basic rate limiting
 * app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
 *
 * // Advanced rate limiting
 * app.use(rateLimit({
 *   windowMs: 15 * 60 * 1000,
 *   max: 100,
 *   message: 'Too many requests from this IP',
 *   keyGenerator: (ctx) => ctx.ip,
 *   skip: (ctx) => ctx.path.startsWith('/public'),
 * }));
 * ```
 */
export function rateLimit(options: RateLimiterOptions = {}): Middleware {
  const config = { ...DEFAULT_RATE_LIMITER_OPTIONS, ...options };
  const store =
    config.store || new MemoryStore(config.windowMs || 15 * 60 * 1000);

  return async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    try {
      // Skip rate limiting if configured
      if (config.skip?.(ctx)) {
        await next();
        return;
      }

      // Generate key for rate limiting
      const key = config.keyGenerator?.(ctx) || ctx.ip || 'unknown';
      const entry = store.increment(key);

      // Set rate limit headers
      if (config.headers) {
        const maxRequests = config.max !== undefined ? config.max : 100;
        ctx.res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        ctx.res.setHeader(
          'X-RateLimit-Remaining',
          Math.max(0, maxRequests - entry.count).toString()
        );
        ctx.res.setHeader(
          'X-RateLimit-Reset',
          new Date(entry.resetTime).toISOString()
        );
      }

      // Check if rate limit exceeded
      const maxRequests = config.max !== undefined ? config.max : 100;
      if (entry.count > maxRequests) {
        // Call custom handler or use default
        if (config.handler) {
          config.handler(ctx);
        } else {
          ctx.status = config.statusCode || 429;
          ctx.res.json({
            error:
              config.message || 'Too many requests, please try again later.',
          });
        }
        return;
      }

      // Continue to next middleware
      await next();

      // Skip successful requests if configured (this is for tracking, not blocking)
      if (config.skipSuccessfulRequests && ctx.status < 400) {
        // Don't count successful requests in the rate limit
        store.reset(key);
      }
    } catch (error) {
      // Handle errors gracefully
      // eslint-disable-next-line no-console
      console.warn('Rate limiter error:', error);
      await next();
    }
  };
}

/**
 * Create rate limiter middleware with metrics
 *
 * @param options - Rate limiter configuration options
 * @returns Rate limiter middleware function with performance monitoring
 */
export function rateLimitWithMetrics(
  options: RateLimiterOptions = {}
): Middleware {
  const rateLimitMiddleware = rateLimit(options);

  return async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    const start = Date.now();

    await rateLimitMiddleware(ctx, async () => {
      const end = Date.now();
      const duration = end - start; // Duration in milliseconds

      if (duration > 1) {
        // eslint-disable-next-line no-console
        console.warn(`Slow rate limiting: ${duration.toFixed(3)}ms`);
      }

      await next();
    });
  };
}

/**
 * Create a rate limiter for specific routes
 *
 * @param options - Rate limiter configuration options
 * @returns Rate limiter middleware function
 */
export function createRouteRateLimit(
  options: RateLimiterOptions = {}
): Middleware {
  const baseOptions = { ...options };

  return rateLimit({
    ...baseOptions,
    keyGenerator: (ctx: Context) => {
      const baseKey = baseOptions.keyGenerator
        ? baseOptions.keyGenerator(ctx)
        : ctx.ip || 'unknown';
      return `${baseKey}:${ctx.path}`;
    },
  });
}

/**
 * Create a rate limiter for authentication endpoints
 *
 * @param options - Rate limiter configuration options
 * @returns Rate limiter middleware function
 */
export function createAuthRateLimit(
  options: RateLimiterOptions = {}
): Middleware {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per 15 minutes
    message: 'Too many authentication attempts, please try again later.',
    statusCode: 429,
    ...options,
    keyGenerator: (ctx: Context) => {
      const baseKey = options.keyGenerator
        ? options.keyGenerator(ctx)
        : ctx.ip || 'unknown';
      return `auth:${baseKey}`;
    },
  });
}

/**
 * Rate limiter utilities for testing and advanced usage
 */
export const rateLimitUtils = {
  /**
   * Memory store for testing
   */
  MemoryStore,

  /**
   * Default rate limiter options
   */
  DEFAULT_OPTIONS: DEFAULT_RATE_LIMITER_OPTIONS,

  /**
   * Create route-specific rate limiter
   */
  createRouteRateLimit,

  /**
   * Create authentication rate limiter
   */
  createAuthRateLimit,

  /**
   * Clear all stores (for testing)
   */
  clearStores: () => {
    // This is a no-op for now since we don't have global store management
    // In a real implementation, this would clear all active stores
  },

  /**
   * Generate default key for rate limiting
   */
  generateKey: (ctx: Context) => ctx.ip || 'unknown',

  /**
   * Validate rate limiter options
   */
  validateOptions: (options: RateLimiterOptions) => {
    if (options.windowMs && options.windowMs <= 0) {
      throw new Error('windowMs must be greater than 0');
    }
    if (options.max && options.max <= 0) {
      throw new Error('max must be greater than 0');
    }
    return true;
  },
};

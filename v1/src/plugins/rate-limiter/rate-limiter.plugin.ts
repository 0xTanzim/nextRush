/**
 * 🛡️ Rate Limiter Plugin - NextRush Framework
 *
 * Built-in rate limiting with memory and Redis backends.
 * Prevents abuse and controls traffic with configurable windows and limits.
 */

import { Application } from '../../core/app/application';
import { NextRushRequest, NextRushResponse } from '../../types/express';
import { BasePlugin, PluginRegistry } from '../core/base-plugin';

/**
 * Rate limiter options
 */
export interface RateLimiterOptions {
  windowMs?: number; // Time window in milliseconds (default: 15 minutes)
  max?: number; // Maximum requests per window (default: 100)
  message?: string; // Error message when limit exceeded
  statusCode?: number; // HTTP status code (default: 429)
  standardHeaders?: boolean; // Include standard rate limit headers
  legacyHeaders?: boolean; // Include legacy X-RateLimit headers
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  keyGenerator?: (req: NextRushRequest) => string; // Custom key generator
  skip?: (req: NextRushRequest) => boolean; // Skip rate limiting for certain requests
  handler?: (req: NextRushRequest, res: NextRushResponse) => void; // Custom handler when limit exceeded
  store?: RateLimiterStore; // Custom store (memory by default)
  onLimitReached?: (req: NextRushRequest, options: RateLimiterOptions) => void; // Callback when limit reached
}

/**
 * Rate limiter store interface
 */
export interface RateLimiterStore {
  get(key: string): Promise<RateLimiterData | undefined>;
  set(key: string, data: RateLimiterData, windowMs: number): Promise<void>;
  increment(key: string, windowMs: number): Promise<RateLimiterData>;
  reset(key: string): Promise<void>;
  resetAll(): Promise<void>;
}

/**
 * Rate limiter data structure
 */
export interface RateLimiterData {
  count: number;
  resetTime: number;
  firstHit?: number;
}

/**
 * Memory store for rate limiting
 */
export class MemoryStore implements RateLimiterStore {
  private store = new Map<string, RateLimiterData>();
  private timers = new Map<string, NodeJS.Timeout>();

  async get(key: string): Promise<RateLimiterData | undefined> {
    return this.store.get(key);
  }

  async set(
    key: string,
    data: RateLimiterData,
    windowMs: number
  ): Promise<void> {
    this.store.set(key, data);
    this.setExpiry(key, windowMs);
  }

  async increment(key: string, windowMs: number): Promise<RateLimiterData> {
    const now = Date.now();
    const existing = this.store.get(key);

    if (!existing || now >= existing.resetTime) {
      // Create new window
      const data: RateLimiterData = {
        count: 1,
        resetTime: now + windowMs,
        firstHit: now,
      };
      this.store.set(key, data);
      this.setExpiry(key, windowMs);
      return data;
    }

    // Increment existing window
    existing.count++;
    this.store.set(key, existing);
    return existing;
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  async resetAll(): Promise<void> {
    this.store.clear();
    for (const timer of Array.from(this.timers.values())) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  private setExpiry(key: string, windowMs: number): void {
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.store.delete(key);
      this.timers.delete(key);
    }, windowMs);

    this.timers.set(key, timer);
  }
}

/**
 * 🛡️ Rate Limiter Plugin
 */
export class RateLimiterPlugin extends BasePlugin {
  name = 'RateLimiter';
  private defaultStore: MemoryStore;

  constructor(registry: PluginRegistry) {
    super(registry);
    this.defaultStore = new MemoryStore();
  }

  /**
   * Install rate limiter capabilities
   */
  install(app: Application): void {
    // Add rate limiter method to application
    (app as any).useRateLimit = (options: RateLimiterOptions = {}) => {
      const config = this.mergeOptions(options);

      return async (
        req: NextRushRequest,
        res: NextRushResponse,
        next: () => void
      ) => {
        try {
          // Skip if skip function returns true
          if (config.skip && config.skip(req)) {
            return next();
          }

          // Generate key for this request
          const key = config.keyGenerator(req);

          // Get current data and increment
          const data = await config.store.increment(key, config.windowMs);

          // Set rate limit headers
          if (config.standardHeaders) {
            res.setHeader('RateLimit-Limit', config.max.toString());
            res.setHeader(
              'RateLimit-Remaining',
              Math.max(0, config.max - data.count).toString()
            );
            res.setHeader(
              'RateLimit-Reset',
              new Date(data.resetTime).toISOString()
            );
          }

          if (config.legacyHeaders) {
            res.setHeader('X-RateLimit-Limit', config.max.toString());
            res.setHeader(
              'X-RateLimit-Remaining',
              Math.max(0, config.max - data.count).toString()
            );
            res.setHeader(
              'X-RateLimit-Reset',
              Math.ceil(data.resetTime / 1000).toString()
            );
          }

          // Check if limit exceeded
          if (data.count > config.max) {
            // Call onLimitReached callback
            if (config.onLimitReached) {
              config.onLimitReached(req, config);
            }

            // Set retry-after header
            const retryAfter = Math.ceil((data.resetTime - Date.now()) / 1000);
            res.setHeader('Retry-After', retryAfter.toString());

            // Use custom handler or default response
            if (config.handler) {
              return config.handler(req, res);
            } else {
              return res.status(config.statusCode).json({
                error: 'Too Many Requests',
                message: config.message,
                retryAfter,
              });
            }
          }

          next();
        } catch (error) {
          console.error('Rate limiter error:', error);
          next(); // Continue on error to not break the application
        }
      };
    };

    // Add method to create custom rate limiters
    (app as any).createRateLimit = (options: RateLimiterOptions = {}) => {
      return (app as any).useRateLimit(options);
    };

    // Add global rate limiter setup
    (app as any).enableGlobalRateLimit = (options: RateLimiterOptions = {}) => {
      (app as any).use((app as any).useRateLimit(options));
      return app;
    };

    this.emit('rate-limiter:installed');
  }

  /**
   * Start the rate limiter plugin
   */
  start(): void {
    this.emit('rate-limiter:started');
  }

  /**
   * Stop the rate limiter plugin
   */
  stop(): void {
    this.defaultStore.resetAll();
    this.emit('rate-limiter:stopped');
  }

  /**
   * Merge options with defaults
   */
  private mergeOptions(
    options: RateLimiterOptions
  ): Required<RateLimiterOptions> {
    return {
      windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
      max: options.max || 100,
      message: options.message || 'Too many requests, please try again later.',
      statusCode: options.statusCode || 429,
      standardHeaders: options.standardHeaders !== false,
      legacyHeaders: options.legacyHeaders === true,
      skipSuccessfulRequests: options.skipSuccessfulRequests === true,
      skipFailedRequests: options.skipFailedRequests === true,
      keyGenerator: options.keyGenerator || this.defaultKeyGenerator,
      skip: options.skip || (() => false),
      handler: options.handler || this.defaultHandler,
      store: options.store || this.defaultStore,
      onLimitReached: options.onLimitReached || (() => {}),
    };
  }

  /**
   * Default key generator (IP-based)
   */
  private defaultKeyGenerator = (req: NextRushRequest): string => {
    const forwarded = req.headers['x-forwarded-for'] as string;
    const ip = forwarded
      ? forwarded.split(',')[0].trim()
      : req.socket.remoteAddress;
    return `rate_limit:${ip || 'unknown'}`;
  };

  /**
   * Default handler when limit exceeded
   */
  private defaultHandler = (
    req: NextRushRequest,
    res: NextRushResponse
  ): void => {
    // This will be overridden by the merged options
  };
}

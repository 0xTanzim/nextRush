/**
 * @nextrush/rate-limit - Type Definitions
 *
 * Production-grade rate limiting with multiple algorithms.
 *
 * @packageDocumentation
 */

import type { Context, Middleware } from '@nextrush/types';

/**
 * Supported rate limiting algorithms
 *
 * - `token-bucket`: Best for APIs, allows controlled bursts (DEFAULT)
 * - `sliding-window`: Most accurate, prevents boundary attacks
 * - `fixed-window`: Simplest, lowest overhead
 */
export type RateLimitAlgorithm = 'token-bucket' | 'sliding-window' | 'fixed-window';

/**
 * Rate limit check result
 */
export interface RateLimitInfo {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Maximum requests allowed in the window */
  limit: number;
  /** Remaining requests in current window */
  remaining: number;
  /** Unix timestamp (seconds) when the window resets */
  resetTime: number;
  /** Seconds until the window resets */
  resetIn: number;
  /** The key used for rate limiting */
  key: string;
  /** Number of requests made in current window */
  current: number;
}

/**
 * Rate limit store interface for custom storage implementations
 *
 * @example Redis implementation
 * ```typescript
 * const redisStore: RateLimitStore = {
 *   async get(key) {
 *     const data = await redis.get(key);
 *     return data ? JSON.parse(data) : null;
 *   },
 *   async set(key, entry, ttlMs) {
 *     await redis.set(key, JSON.stringify(entry), 'PX', ttlMs);
 *   },
 *   async increment(key, ttlMs) {
 *     // Use Redis INCR with EXPIRE
 *   },
 *   async decrement(key) {
 *     await redis.decr(key);
 *   },
 *   async reset(key) {
 *     await redis.del(key);
 *   }
 * };
 * ```
 */
export interface RateLimitStore {
  /** Get entry by key */
  get(key: string): Promise<StoreEntry | null>;
  /** Set entry with TTL in milliseconds */
  set(key: string, entry: StoreEntry, ttlMs: number): Promise<void>;
  /** Increment counter and return new value */
  increment(key: string, ttlMs: number): Promise<number>;
  /** Decrement counter (optional, for token bucket refill) */
  decrement?(key: string): Promise<void>;
  /** Reset/delete entry */
  reset(key: string): Promise<void>;
  /** Cleanup expired entries (called periodically) */
  cleanup?(): Promise<void>;
  /** Shutdown store (cleanup resources) */
  shutdown?(): Promise<void>;
}

/**
 * Store entry structure
 */
export interface StoreEntry {
  /** Request count or tokens */
  count: number;
  /** Window start timestamp (ms) */
  windowStart: number;
  /** Last update timestamp (ms) for token bucket */
  lastUpdate?: number;
  /** Tokens available (for token bucket) */
  tokens?: number;
  /** Previous window count (for sliding window) */
  prevCount?: number;
}

/**
 * Key generator function type
 */
export type KeyGenerator = (ctx: Context) => string | Promise<string>;

/**
 * Skip condition function type
 */
export type SkipFunction = (ctx: Context) => boolean | Promise<boolean>;

/**
 * Rate limit handler called when limit is exceeded
 */
export type RateLimitHandler = (ctx: Context, info: RateLimitInfo) => void | Promise<void>;

/**
 * Callback when rate limit is hit (for logging/monitoring)
 */
export type OnRateLimited = (ctx: Context, info: RateLimitInfo) => void | Promise<void>;

/**
 * Tier configuration for different user types
 */
export interface TierConfig {
  /** Maximum requests per window */
  max: number;
  /** Window duration (e.g., '1m', '15m', '1h') */
  window: string;
  /** Burst limit for token bucket (optional) */
  burstLimit?: number;
}

/**
 * Tier resolver function type
 */
export type TierResolver = (ctx: Context) => string | Promise<string>;

/**
 * The subset of `Application` needed to register deterministic teardown
 * (N10 / F-07 wiring, RFC-022 §7.3 `app.onClose`).
 *
 * Kept structural — not the concrete `Application` from `@nextrush/core` —
 * so `@nextrush/rate-limit` stays independent of `@nextrush/core` (mirrors
 * `ExtensionHost` in `@nextrush/types`, which exists for the same reason).
 * The real `Application` class satisfies this shape.
 */
export interface OnCloseHost {
  /**
   * Register a teardown hook run under the app's bounded, isolated shutdown
   * (see `Application.onClose` in `@nextrush/core`).
   */
  onClose(hook: () => void | Promise<void>): void;
}

/**
 * Rate limit middleware options
 */
export interface RateLimitOptions {
  /**
   * Rate limiting algorithm
   * @default 'token-bucket'
   */
  algorithm?: RateLimitAlgorithm;

  /**
   * Maximum requests allowed per window
   * @default 100
   */
  max?: number;

  /**
   * Time window duration
   * Supports: '1s', '30s', '1m', '5m', '15m', '1h', '1d'
   * Or number in milliseconds
   * @default '1m' (60000ms)
   */
  window?: string | number;

  /**
   * Burst limit for token bucket algorithm
   * Allows short bursts above the average rate
   * @default max (no extra burst)
   */
  burstLimit?: number;

  /**
   * Custom key generator
   * Default: Uses IP address with proxy header support
   *
   * @example API key based limiting
   * ```typescript
   * keyGenerator: (ctx) => ctx.get('X-API-Key') || ctx.ip
   * ```
   */
  keyGenerator?: KeyGenerator;

  /**
   * Skip rate limiting for certain requests
   *
   * @example Skip health checks
   * ```typescript
   * skip: (ctx) => ctx.path === '/health'
   * ```
   */
  skip?: SkipFunction;

  /**
   * Custom store implementation
   * @default In-memory store
   */
  store?: RateLimitStore;

  /**
   * The application instance, so the middleware's default `MemoryStore` can
   * register its cleanup interval via `app.onClose` and be torn down
   * deterministically by `app.close()` (N10 / F-07 wiring), instead of
   * relying solely on the interval being `unref()`'d.
   *
   * Optional and fully backward compatible: omitting it keeps today's
   * behavior unchanged (the interval still runs, still `unref()`'d). Ignored
   * when a custom `store` is supplied — a caller-owned store's lifecycle is
   * the caller's responsibility, not this middleware's.
   *
   * @example
   * ```typescript
   * const app = createApp();
   * app.use(rateLimit({ max: 100, window: '1m', app }));
   * // app.close() now also clears the rate-limit store's cleanup interval.
   * ```
   */
  app?: OnCloseHost;

  /**
   * Custom handler when rate limit is exceeded
   * @default Sends 429 with JSON error body
   */
  handler?: RateLimitHandler;

  /**
   * Callback when rate limit is triggered (for logging/metrics)
   */
  onRateLimited?: OnRateLimited;

  /**
   * Send standard rate limit headers (RateLimit-*)
   * IETF draft-compliant headers
   * @default true
   */
  standardHeaders?: boolean;

  /**
   * Send legacy rate limit headers (X-RateLimit-*)
   * @default true
   */
  legacyHeaders?: boolean;

  /**
   * Include Retry-After header on 429 responses
   * @default true
   */
  includeRetryAfter?: boolean;

  /**
   * Message for rate limit exceeded response
   * @default 'Too many requests, please try again later.'
   */
  message?: string;

  /**
   * HTTP status code for rate limit exceeded
   * @default 429
   */
  statusCode?: number;

  /**
   * List of IPs to skip rate limiting (whitelist)
   */
  whitelist?: string[];

  /**
   * List of IPs to always rate limit (blacklist gets lower limits)
   */
  blacklist?: string[];

  /**
   * Multiplier for blacklisted IPs (e.g., 0.5 = half the limit)
   * @default 0.5
   */
  blacklistMultiplier?: number;

  /**
   * Enable draft IETF RateLimit headers
   * @default false
   */
  draftIetfHeaders?: boolean;

  /**
   * Window for automatic cleanup of expired entries (ms)
   * @default 60000 (1 minute)
   */
  cleanupInterval?: number;

  /**
   * Disable automatic cleanup
   * @default false
   */
  disableCleanup?: boolean;
}

/**
 * Tiered rate limit options for different user types
 */
export interface TieredRateLimitOptions extends Omit<RateLimitOptions, 'max' | 'window'> {
  /**
   * Tier configurations
   *
   * @example
   * ```typescript
   * tiers: {
   *   anonymous: { max: 60, window: '1m' },
   *   authenticated: { max: 1000, window: '1m' },
   *   premium: { max: 10000, window: '1m' }
   * }
   * ```
   */
  tiers: Record<string, TierConfig>;

  /**
   * Function to resolve which tier applies to the request
   *
   * @example
   * ```typescript
   * tierResolver: (ctx) => ctx.state.user?.tier || 'anonymous'
   * ```
   */
  tierResolver: TierResolver;

  /**
   * Default tier if resolver returns unknown tier
   * @default First tier in the tiers object
   */
  defaultTier?: string;
}

/**
 * Algorithm implementation interface
 */
export interface Algorithm {
  /** Algorithm name */
  readonly name: RateLimitAlgorithm;

  /**
   * Check if request is allowed and consume a token/slot
   */
  consume(
    key: string,
    limit: number,
    windowMs: number,
    store: RateLimitStore,
    burstLimit?: number
  ): Promise<RateLimitInfo>;

  /**
   * Peek at current state without consuming
   */
  peek?(
    key: string,
    limit: number,
    windowMs: number,
    store: RateLimitStore
  ): Promise<RateLimitInfo>;
}

/**
 * Rate limit middleware factory return type
 */
export type RateLimitMiddleware = Middleware & {
  /** Reset rate limit for a specific key */
  reset(key: string): Promise<void>;
  /** Get current rate limit info for a key */
  getInfo(key: string): Promise<RateLimitInfo | null>;
  /** Shutdown and cleanup resources */
  shutdown(): Promise<void>;
};

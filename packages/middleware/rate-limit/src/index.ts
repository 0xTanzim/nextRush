/**
 * @nextrush/rate-limit
 *
 * Production-grade rate limiting middleware with multiple algorithms.
 *
 * Features:
 * - 3 algorithms: Token Bucket (default), Sliding Window, Fixed Window
 * - Tiered rate limits (anonymous, authenticated, premium)
 * - Shared IP handling (proxies, corporate NAT)
 * - IETF-compliant headers
 * - Zero dependencies
 *
 * @example Simple usage
 * ```typescript
 * import { rateLimit } from '@nextrush/rate-limit';
 *
 * // Zero-config (100 req/min per IP)
 * app.use(rateLimit());
 *
 * // Custom limits
 * app.use(rateLimit({ max: 1000, window: '15m' }));
 * ```
 *
 * @example Algorithm choice
 * ```typescript
 * // Token bucket (allows bursts)
 * app.use(rateLimit({ algorithm: 'token-bucket', max: 100, window: '1m' }));
 *
 * // Sliding window (strict, accurate)
 * app.use(rateLimit({ algorithm: 'sliding-window', max: 100, window: '1m' }));
 *
 * // Fixed window (simple, lightweight)
 * app.use(rateLimit({ algorithm: 'fixed-window', max: 100, window: '1m' }));
 * ```
 *
 * @example Tiered limits
 * ```typescript
 * app.use(tieredRateLimit({
 *   tiers: {
 *     anonymous: { max: 60, window: '1m' },
 *     authenticated: { max: 1000, window: '1m' },
 *     premium: { max: 10000, window: '1m' }
 *   },
 *   tierResolver: (ctx) => ctx.state.user?.tier || 'anonymous'
 * }));
 * ```
 *
 * @packageDocumentation
 */

import type { Context, Middleware } from '@nextrush/types';
import { getAlgorithm } from './algorithms';
import { createMemoryStore } from './stores';
import type {
    RateLimitInfo,
    RateLimitMiddleware,
    RateLimitOptions,
    RateLimitStore,
    TieredRateLimitOptions,
} from './types';
import { extractClientIp, isIpInList, parseWindow, setRateLimitHeaders } from './utils';

export type {
    Algorithm, KeyGenerator, OnRateLimited, RateLimitAlgorithm, RateLimitHandler, RateLimitInfo, RateLimitMiddleware, RateLimitOptions, RateLimitStore, SkipFunction, StoreEntry,
    TierConfig, TieredRateLimitOptions, TierResolver
} from './types';

export { algorithms, fixedWindow, getAlgorithm, slidingWindow, tokenBucket } from './algorithms';
export { createMemoryStore, MemoryStore } from './stores';
export { LEGACY_HEADERS, setRateLimitHeaders, STANDARD_HEADERS } from './utils/headers';
export { defaultKeyGenerator, extractClientIp, isIpInList, normalizeIp } from './utils/key-generator';
export { formatDuration, parseWindow } from './utils/parse-window';

const DEFAULT_OPTIONS: Required<
  Pick<
    RateLimitOptions,
    | 'algorithm'
    | 'max'
    | 'window'
    | 'trustProxy'
    | 'standardHeaders'
    | 'legacyHeaders'
    | 'includeRetryAfter'
    | 'message'
    | 'statusCode'
    | 'blacklistMultiplier'
    | 'draftIetfHeaders'
    | 'cleanupInterval'
    | 'disableCleanup'
  >
> = {
  algorithm: 'token-bucket',
  max: 100,
  window: '1m',
  trustProxy: false,
  standardHeaders: true,
  legacyHeaders: true,
  includeRetryAfter: true,
  message: 'Too many requests, please try again later.',
  statusCode: 429,
  blacklistMultiplier: 0.5,
  draftIetfHeaders: false,
  cleanupInterval: 60_000,
  disableCleanup: false,
};

/**
 * Create rate limit middleware
 *
 * @example Zero-config
 * ```typescript
 * app.use(rateLimit());
 * ```
 *
 * @example Custom config
 * ```typescript
 * app.use(rateLimit({
 *   algorithm: 'sliding-window',
 *   max: 1000,
 *   window: '15m',
 *   keyGenerator: (ctx) => ctx.get('X-API-Key') || ctx.ip
 * }));
 * ```
 */
export function rateLimit(options: RateLimitOptions = {}): RateLimitMiddleware {
  const config = { ...DEFAULT_OPTIONS, ...options };

  const windowMs = parseWindow(config.window);
  const algorithm = getAlgorithm(config.algorithm);
  const store = config.store ?? createMemoryStore({
    cleanupInterval: config.cleanupInterval,
    disableCleanup: config.disableCleanup,
  });

  const keyGenerator = config.keyGenerator ?? ((ctx: Context) => {
    const ip = extractClientIp(ctx, config.trustProxy);
    return `rl:${ip}`;
  });

  const defaultHandler = async (ctx: Context, info: RateLimitInfo): Promise<void> => {
    ctx.status = config.statusCode;
    ctx.json({
      error: config.message,
      retryAfter: info.resetIn,
    });
  };

  const handler = config.handler ?? defaultHandler;

  let infoCache = new Map<string, RateLimitInfo>();

  const middleware: Middleware = async (ctx: Context) => {
    if (config.skip && (await config.skip(ctx))) {
      return ctx.next();
    }

    const clientIp = extractClientIp(ctx, config.trustProxy);

    if (config.whitelist && isIpInList(clientIp, config.whitelist)) {
      return ctx.next();
    }

    const key = await keyGenerator(ctx);

    let effectiveLimit = config.max;
    if (config.blacklist && isIpInList(clientIp, config.blacklist)) {
      effectiveLimit = Math.floor(config.max * config.blacklistMultiplier);
    }

    const info = await algorithm.consume(key, effectiveLimit, windowMs, store, config.burstLimit);

    infoCache.set(key, info);

    setRateLimitHeaders(ctx, info, {
      standardHeaders: config.standardHeaders,
      legacyHeaders: config.legacyHeaders,
      includeRetryAfter: config.includeRetryAfter,
      draftIetfHeaders: config.draftIetfHeaders,
      windowMs,
    });

    if (!info.allowed) {
      if (config.onRateLimited) {
        await config.onRateLimited(ctx, info);
      }
      await handler(ctx, info);
      return;
    }

    return ctx.next();
  };

  const rateLimitMiddleware = middleware as RateLimitMiddleware;

  rateLimitMiddleware.reset = async (key: string): Promise<void> => {
    await store.reset(key);
    infoCache.delete(key);
  };

  rateLimitMiddleware.getInfo = async (key: string): Promise<RateLimitInfo | null> => {
    const cached = infoCache.get(key);
    if (cached) return cached;

    if (algorithm.peek) {
      return algorithm.peek(key, config.max, windowMs, store);
    }
    return null;
  };

  rateLimitMiddleware.shutdown = async (): Promise<void> => {
    if (store.shutdown) {
      await store.shutdown();
    }
    infoCache.clear();
  };

  return rateLimitMiddleware;
}

/**
 * Create tiered rate limit middleware
 *
 * Different rate limits for different user tiers.
 *
 * @example
 * ```typescript
 * app.use(tieredRateLimit({
 *   tiers: {
 *     anonymous: { max: 60, window: '1m' },
 *     authenticated: { max: 1000, window: '1m' },
 *     premium: { max: 10000, window: '1m' }
 *   },
 *   tierResolver: (ctx) => ctx.state.user?.tier || 'anonymous'
 * }));
 * ```
 */
export function tieredRateLimit(options: TieredRateLimitOptions): RateLimitMiddleware {
  const { tiers, tierResolver, defaultTier, ...baseOptions } = options;

  const tierNames = Object.keys(tiers);
  if (tierNames.length === 0) {
    throw new Error('At least one tier must be defined');
  }

  const firstTier = tierNames[0] as string;
  const fallbackTier: string = defaultTier ?? firstTier;

  const tierStores = new Map<string, RateLimitStore>();
  const tierAlgorithms = new Map<string, ReturnType<typeof getAlgorithm>>();
  const tierWindowMs = new Map<string, number>();

  for (const [name, config] of Object.entries(tiers)) {
    tierStores.set(
      name,
      baseOptions.store ?? createMemoryStore({
        cleanupInterval: baseOptions.cleanupInterval ?? 60_000,
        disableCleanup: baseOptions.disableCleanup ?? false,
      })
    );
    tierAlgorithms.set(name, getAlgorithm(baseOptions.algorithm ?? 'token-bucket'));
    tierWindowMs.set(name, parseWindow(config.window));
  }

  const keyGenerator = baseOptions.keyGenerator ?? ((ctx: Context) => {
    const ip = extractClientIp(ctx, baseOptions.trustProxy ?? false);
    return `rl:${ip}`;
  });

  const defaultHandler = async (ctx: Context, info: RateLimitInfo): Promise<void> => {
    ctx.status = baseOptions.statusCode ?? 429;
    ctx.json({
      error: baseOptions.message ?? 'Too many requests, please try again later.',
      retryAfter: info.resetIn,
    });
  };

  const handler = baseOptions.handler ?? defaultHandler;

  const middleware: Middleware = async (ctx: Context) => {
    if (baseOptions.skip && (await baseOptions.skip(ctx))) {
      return ctx.next();
    }

    const clientIp = extractClientIp(ctx, baseOptions.trustProxy ?? false);

    if (baseOptions.whitelist && isIpInList(clientIp, baseOptions.whitelist)) {
      return ctx.next();
    }

    let tierName: string = await tierResolver(ctx);
    if (!tiers[tierName]) {
      tierName = fallbackTier;
    }

    const tierConfig = tiers[tierName];
    if (!tierConfig) {
      return ctx.next();
    }

    const store = tierStores.get(tierName);
    const algorithm = tierAlgorithms.get(tierName);
    const windowMs = tierWindowMs.get(tierName);

    if (!store || !algorithm || !windowMs) {
      return ctx.next();
    }

    const key = `${await keyGenerator(ctx)}:${tierName}`;

    let effectiveLimit = tierConfig.max;
    if (baseOptions.blacklist && isIpInList(clientIp, baseOptions.blacklist)) {
      effectiveLimit = Math.floor(tierConfig.max * (baseOptions.blacklistMultiplier ?? 0.5));
    }

    const info = await algorithm.consume(key, effectiveLimit, windowMs, store, tierConfig.burstLimit);

    setRateLimitHeaders(ctx, info, {
      standardHeaders: baseOptions.standardHeaders ?? true,
      legacyHeaders: baseOptions.legacyHeaders ?? true,
      includeRetryAfter: baseOptions.includeRetryAfter ?? true,
      draftIetfHeaders: baseOptions.draftIetfHeaders ?? false,
      windowMs,
    });

    if (!info.allowed) {
      if (baseOptions.onRateLimited) {
        await baseOptions.onRateLimited(ctx, info);
      }
      await handler(ctx, info);
      return;
    }

    return ctx.next();
  };

  const rateLimitMiddleware = middleware as RateLimitMiddleware;

  rateLimitMiddleware.reset = async (key: string): Promise<void> => {
    for (const store of tierStores.values()) {
      await store.reset(key);
    }
  };

  rateLimitMiddleware.getInfo = async (): Promise<RateLimitInfo | null> => {
    return null;
  };

  rateLimitMiddleware.shutdown = async (): Promise<void> => {
    for (const store of tierStores.values()) {
      if (store.shutdown) {
        await store.shutdown();
      }
    }
  };

  return rateLimitMiddleware;
}

export default rateLimit;

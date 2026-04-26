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
 * - CIDR notation for whitelist/blacklist
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
 * @example CIDR whitelist
 * ```typescript
 * app.use(rateLimit({
 *   whitelist: ['192.168.0.0/16', '10.0.0.0/8', '127.0.0.1'],
 * }));
 * ```
 *
 * @packageDocumentation
 */

import type { Context, Middleware } from '@nextrush/types';
import { getAlgorithm } from './algorithms';
import {
  DEFAULT_ALGORITHM,
  DEFAULT_BLACKLIST_MULTIPLIER,
  DEFAULT_CLEANUP_INTERVAL,
  DEFAULT_KEY_PREFIX,
  DEFAULT_MAX,
  DEFAULT_MESSAGE,
  DEFAULT_STATUS_CODE,
  DEFAULT_WINDOW,
  INFO_CACHE_MAX,
} from './constants';
import { createMemoryStore } from './stores';
import type {
  RateLimitInfo,
  RateLimitMiddleware,
  RateLimitOptions,
  RateLimitStore,
  TieredRateLimitOptions,
} from './types';
import {
  extractClientIp,
  isIpInList,
  normalizeIp,
  parseCidr,
  parseWindow,
  setRateLimitHeaders,
} from './utils';
import { validateOptions, validateTieredOptions } from './validation';

export type {
  Algorithm,
  KeyGenerator,
  OnRateLimited,
  RateLimitAlgorithm,
  RateLimitHandler,
  RateLimitInfo,
  RateLimitMiddleware,
  RateLimitOptions,
  RateLimitStore,
  SkipFunction,
  StoreEntry,
  TierConfig,
  TieredRateLimitOptions,
  TierResolver,
} from './types';

export { algorithms, fixedWindow, getAlgorithm, slidingWindow, tokenBucket } from './algorithms';
export {
  CIDR_MAX_IPV4,
  CIDR_MAX_IPV6,
  CIDR_PATTERN,
  DEFAULT_ALGORITHM,
  DEFAULT_BLACKLIST_MULTIPLIER,
  DEFAULT_CLEANUP_INTERVAL,
  DEFAULT_KEY_PREFIX,
  DEFAULT_MAX,
  DEFAULT_MAX_ENTRIES,
  DEFAULT_MESSAGE,
  DEFAULT_STATUS_CODE,
  DEFAULT_WINDOW,
  DEFAULT_WINDOW_MS,
  INFO_CACHE_MAX,
  IPV4_MAPPED_PREFIX,
  IPV4_MAX_OCTET,
  IPV4_OCTET_COUNT,
  IPV6_PATTERN,
  LEGACY_HEADERS,
  PROXY_HEADERS,
  RETRY_AFTER_HEADER,
  STANDARD_HEADERS,
  TIME_UNITS,
  WINDOW_PATTERN,
} from './constants';
export { createMemoryStore, MemoryStore, type MemoryStoreOptions } from './stores';
export {
  LEGACY_HEADERS as LEGACY_RATE_LIMIT_HEADERS,
  setRateLimitHeaders,
  STANDARD_HEADERS as STANDARD_RATE_LIMIT_HEADERS,
} from './utils/headers';
export {
  defaultKeyGenerator,
  extractClientIp,
  isIpInList,
  isValidIpv4,
  isValidIpv6,
  normalizeIp,
  parseCidr,
} from './utils/key-generator';
export { formatDuration, parseWindow } from './utils/parse-window';
export {
  isValidIpFormat,
  RateLimitValidationError,
  SAFE_DEFAULTS,
  validateOptions,
  validateTieredOptions,
} from './validation';

type CompiledListEntry =
  | { type: 'cidr'; ip: string; prefix: number }
  | { type: 'exact'; ip: string };

/**
 * Check if IP is in a precompiled list (parsed once at construction time)
 */
function isIpInCompiledList(ip: string, list: CompiledListEntry[]): boolean {
  const normalized = normalizeIp(ip);

  return list.some((entry) => {
    if (entry.type === 'exact') {
      return entry.ip === normalized;
    }
    // CIDR match - use isIpInList for the actual CIDR comparison
    return isIpInList(normalized, [`${entry.ip}/${entry.prefix}`]);
  });
}

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
  algorithm: DEFAULT_ALGORITHM,
  max: DEFAULT_MAX,
  window: DEFAULT_WINDOW,
  trustProxy: false,
  standardHeaders: true,
  legacyHeaders: true,
  includeRetryAfter: true,
  message: DEFAULT_MESSAGE,
  statusCode: DEFAULT_STATUS_CODE,
  blacklistMultiplier: DEFAULT_BLACKLIST_MULTIPLIER,
  draftIetfHeaders: false,
  cleanupInterval: DEFAULT_CLEANUP_INTERVAL,
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
 *
 * @throws {RateLimitValidationError} If options are invalid
 */
export function rateLimit(options: RateLimitOptions = {}): RateLimitMiddleware {
  validateOptions(options);

  const config = { ...DEFAULT_OPTIONS, ...options };

  const windowMs = parseWindow(config.window);
  const algorithm = getAlgorithm(config.algorithm);
  const store =
    config.store ??
    createMemoryStore({
      cleanupInterval: config.cleanupInterval,
      disableCleanup: config.disableCleanup,
    });

  const keyGenerator =
    config.keyGenerator ??
    ((ctx: Context) => {
      const ip = extractClientIp(ctx, config.trustProxy);
      return `${DEFAULT_KEY_PREFIX}${ip}`;
    });

  const defaultHandler = async (ctx: Context, info: RateLimitInfo): Promise<void> => {
    ctx.status = config.statusCode;
    ctx.json({
      error: config.message,
      retryAfter: info.resetIn,
    });
  };

  const handler = config.handler ?? defaultHandler;

  // RL-P2-03: Precompile whitelist/blacklist at construction time
  const compiledWhitelist = config.whitelist?.map((entry) => {
    const cidr = parseCidr(entry);
    return cidr
      ? { type: 'cidr' as const, ...cidr }
      : { type: 'exact' as const, ip: normalizeIp(entry) };
  });
  const compiledBlacklist = config.blacklist?.map((entry) => {
    const cidr = parseCidr(entry);
    return cidr
      ? { type: 'cidr' as const, ...cidr }
      : { type: 'exact' as const, ip: normalizeIp(entry) };
  });

  let infoCache = new Map<string, RateLimitInfo>();

  const middleware: Middleware = async (ctx: Context) => {
    if (config.skip && (await config.skip(ctx))) {
      return ctx.next();
    }

    const clientIp = extractClientIp(ctx, config.trustProxy);

    if (compiledWhitelist && isIpInCompiledList(clientIp, compiledWhitelist)) {
      return ctx.next();
    }

    const key = await keyGenerator(ctx);

    let effectiveLimit = config.max;
    if (compiledBlacklist && isIpInCompiledList(clientIp, compiledBlacklist)) {
      effectiveLimit = Math.floor(config.max * config.blacklistMultiplier);
    }

    const info = await algorithm.consume(key, effectiveLimit, windowMs, store, config.burstLimit);

    // RL-P1-03: Cap infoCache to prevent unbounded memory growth
    if (infoCache.size >= INFO_CACHE_MAX) {
      const firstKey = infoCache.keys().next().value;
      if (firstKey !== undefined) infoCache.delete(firstKey);
    }
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

  rateLimitMiddleware.reset = async (targetKey: string): Promise<void> => {
    // RL-P1-04: Fixed-window stores entries under `${key}:${windowStart}`, not just `key`
    if (algorithm.name === 'fixed-window') {
      const now = Date.now();
      const windowStart = Math.floor(now / windowMs) * windowMs;
      await store.reset(`${targetKey}:${windowStart}`);
    }
    await store.reset(targetKey);
    infoCache.delete(targetKey);
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
 *
 * @throws {RateLimitValidationError} If options are invalid
 */
export function tieredRateLimit(options: TieredRateLimitOptions): RateLimitMiddleware {
  validateTieredOptions(options);

  const { tiers, tierResolver, defaultTier, ...baseOptions } = options;

  const tierNames = Object.keys(tiers);
  const firstTier = tierNames[0] as string;
  const fallbackTier: string = defaultTier ?? firstTier;

  const tierStores = new Map<string, RateLimitStore>();
  const tierAlgorithms = new Map<string, ReturnType<typeof getAlgorithm>>();
  const tierWindowMs = new Map<string, number>();

  for (const [name, config] of Object.entries(tiers)) {
    tierStores.set(
      name,
      baseOptions.store ??
        createMemoryStore({
          cleanupInterval: baseOptions.cleanupInterval ?? DEFAULT_CLEANUP_INTERVAL,
          disableCleanup: baseOptions.disableCleanup ?? false,
        })
    );
    tierAlgorithms.set(name, getAlgorithm(baseOptions.algorithm ?? DEFAULT_ALGORITHM));
    tierWindowMs.set(name, parseWindow(config.window));
  }

  const keyGenerator =
    baseOptions.keyGenerator ??
    ((ctx: Context) => {
      const ip = extractClientIp(ctx, baseOptions.trustProxy ?? false);
      return `${DEFAULT_KEY_PREFIX}${ip}`;
    });

  const defaultHandler = async (ctx: Context, info: RateLimitInfo): Promise<void> => {
    ctx.status = baseOptions.statusCode ?? DEFAULT_STATUS_CODE;
    ctx.json({
      error: baseOptions.message ?? DEFAULT_MESSAGE,
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

    const info = await algorithm.consume(
      key,
      effectiveLimit,
      windowMs,
      store,
      tierConfig.burstLimit
    );

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
    // RL-P1-05: Deduplicate stores - shared stores should only be called once
    const uniqueStores = new Set(tierStores.values());
    for (const store of uniqueStores) {
      await store.reset(key);
    }
  };

  rateLimitMiddleware.getInfo = async (): Promise<RateLimitInfo | null> => {
    return null;
  };

  rateLimitMiddleware.shutdown = async (): Promise<void> => {
    // RL-P1-05: Deduplicate stores - shared stores should only be shut down once
    const uniqueStores = new Set(tierStores.values());
    const shutdownPromises = [...uniqueStores]
      .filter((s) => typeof s.shutdown === 'function')
      .map((s) => s.shutdown!());
    await Promise.all(shutdownPromises);
  };

  return rateLimitMiddleware;
}

export default rateLimit;

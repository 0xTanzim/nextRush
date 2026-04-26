import type { Algorithm, RateLimitInfo, RateLimitStore } from '../types';

/**
 * Token Bucket Algorithm
 *
 * Best for: APIs where controlled bursts are acceptable
 *
 * How it works:
 * 1. Bucket has a maximum capacity (burstLimit)
 * 2. Tokens are added at a fixed rate (limit / window)
 * 3. Each request consumes one token
 * 4. If no tokens available, request is rejected
 *
 * Advantages:
 * - Allows short bursts of traffic
 * - Smooth rate limiting over time
 * - Industry standard (AWS, Google APIs)
 *
 * Example:
 * - limit: 100, window: 1min, burstLimit: 20
 * - Adds ~1.67 tokens/second
 * - Allows burst of 20 requests instantly
 * - Sustains 100 req/min average
 */
export class TokenBucketAlgorithm implements Algorithm {
  readonly name = 'token-bucket' as const;

  async consume(
    key: string,
    limit: number,
    windowMs: number,
    store: RateLimitStore,
    burstLimit?: number
  ): Promise<RateLimitInfo> {
    const now = Date.now();
    const maxTokens = burstLimit ?? limit;
    const refillRate = limit / windowMs;

    const entry = await store.get(key);

    let tokens: number;
    let windowStart: number;

    if (!entry) {
      tokens = maxTokens - 1;
      windowStart = now;
    } else {
      const elapsed = now - (entry.lastUpdate ?? entry.windowStart);
      const refilled = elapsed * refillRate;
      const currentTokens = entry.tokens ?? maxTokens;

      tokens = Math.min(maxTokens, currentTokens + refilled) - 1;
      windowStart = entry.windowStart;

      if (now - windowStart >= windowMs) {
        windowStart = now;
      }
    }

    const allowed = tokens >= 0;

    if (!allowed) {
      tokens = entry?.tokens ?? 0;
    }

    await store.set(
      key,
      {
        count: limit - Math.floor(Math.max(0, tokens)),
        windowStart,
        lastUpdate: now,
        tokens: Math.max(0, tokens),
      },
      windowMs * 2
    );

    const resetTime = Math.ceil((windowStart + windowMs) / 1000);
    const resetIn = Math.max(0, Math.ceil((windowStart + windowMs - now) / 1000));

    return {
      allowed,
      limit,
      remaining: Math.floor(Math.max(0, tokens)),
      resetTime,
      resetIn,
      key,
      current: limit - Math.floor(Math.max(0, tokens)),
    };
  }

  async peek(
    key: string,
    limit: number,
    windowMs: number,
    store: RateLimitStore
  ): Promise<RateLimitInfo> {
    const now = Date.now();
    const maxTokens = limit;
    const refillRate = limit / windowMs;

    const entry = await store.get(key);

    if (!entry) {
      return {
        allowed: true,
        limit,
        remaining: maxTokens,
        resetTime: Math.ceil((now + windowMs) / 1000),
        resetIn: Math.ceil(windowMs / 1000),
        key,
        current: 0,
      };
    }

    const elapsed = now - (entry.lastUpdate ?? entry.windowStart);
    const refilled = elapsed * refillRate;
    const tokens = Math.min(maxTokens, (entry.tokens ?? maxTokens) + refilled);
    const windowStart = entry.windowStart;

    return {
      allowed: tokens >= 1,
      limit,
      remaining: Math.floor(tokens),
      resetTime: Math.ceil((windowStart + windowMs) / 1000),
      resetIn: Math.max(0, Math.ceil((windowStart + windowMs - now) / 1000)),
      key,
      current: limit - Math.floor(tokens),
    };
  }
}

export const tokenBucket = new TokenBucketAlgorithm();

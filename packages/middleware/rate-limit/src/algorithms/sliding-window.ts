import type { Algorithm, RateLimitInfo, RateLimitStore } from '../types';

/**
 * Sliding Window Counter Algorithm
 *
 * Best for: Strict, accurate rate limiting
 *
 * How it works:
 * 1. Tracks request count in current and previous windows
 * 2. Uses weighted average based on position in current window
 * 3. Provides smoother limiting than fixed window
 *
 * Advantages:
 * - Prevents boundary burst attacks
 * - More accurate than fixed window
 * - Memory efficient (only stores counts)
 *
 * Formula:
 * effectiveCount = prevCount * (1 - elapsedRatio) + currentCount
 *
 * Example:
 * - Previous window: 80 requests
 * - Current window: 30 requests
 * - 70% through current window
 * - Effective: 80 * 0.3 + 30 = 54 requests
 */
export class SlidingWindowAlgorithm implements Algorithm {
  readonly name = 'sliding-window' as const;

  async consume(
    key: string,
    limit: number,
    windowMs: number,
    store: RateLimitStore
  ): Promise<RateLimitInfo> {
    const now = Date.now();
    const entry = await store.get(key);

    let windowStart: number;
    let currentCount: number;
    let prevCount: number;

    if (!entry) {
      windowStart = now;
      currentCount = 1;
      prevCount = 0;
    } else {
      const windowAge = now - entry.windowStart;

      if (windowAge >= windowMs * 2) {
        windowStart = now;
        currentCount = 1;
        prevCount = 0;
      } else if (windowAge >= windowMs) {
        windowStart = entry.windowStart + windowMs;
        prevCount = entry.count;
        currentCount = 1;
      } else {
        windowStart = entry.windowStart;
        currentCount = entry.count + 1;
        prevCount = entry.prevCount ?? 0;
      }
    }

    const elapsed = now - windowStart;
    const elapsedRatio = Math.min(1, elapsed / windowMs);
    const weightedPrev = prevCount * (1 - elapsedRatio);
    const effectiveCount = weightedPrev + currentCount;

    const allowed = effectiveCount <= limit;

    if (!allowed) {
      currentCount = entry?.count ?? 0;
    }

    await store.set(
      key,
      {
        count: currentCount,
        windowStart,
        prevCount,
      },
      windowMs * 2
    );

    const remaining = Math.max(0, Math.floor(limit - effectiveCount));
    const resetTime = Math.ceil((windowStart + windowMs) / 1000);
    const resetIn = Math.max(0, Math.ceil((windowStart + windowMs - now) / 1000));

    return {
      allowed,
      limit,
      remaining,
      resetTime,
      resetIn,
      key,
      current: Math.ceil(effectiveCount),
    };
  }

  async peek(
    key: string,
    limit: number,
    windowMs: number,
    store: RateLimitStore
  ): Promise<RateLimitInfo> {
    const now = Date.now();
    const entry = await store.get(key);

    if (!entry) {
      return {
        allowed: true,
        limit,
        remaining: limit,
        resetTime: Math.ceil((now + windowMs) / 1000),
        resetIn: Math.ceil(windowMs / 1000),
        key,
        current: 0,
      };
    }

    const windowAge = now - entry.windowStart;
    let windowStart = entry.windowStart;
    let currentCount = entry.count;
    let prevCount = entry.prevCount ?? 0;

    if (windowAge >= windowMs * 2) {
      return {
        allowed: true,
        limit,
        remaining: limit,
        resetTime: Math.ceil((now + windowMs) / 1000),
        resetIn: Math.ceil(windowMs / 1000),
        key,
        current: 0,
      };
    }

    if (windowAge >= windowMs) {
      windowStart = entry.windowStart + windowMs;
      prevCount = entry.count;
      currentCount = 0;
    }

    const elapsed = now - windowStart;
    const elapsedRatio = Math.min(1, elapsed / windowMs);
    const effectiveCount = prevCount * (1 - elapsedRatio) + currentCount;

    return {
      allowed: effectiveCount < limit,
      limit,
      remaining: Math.max(0, Math.floor(limit - effectiveCount)),
      resetTime: Math.ceil((windowStart + windowMs) / 1000),
      resetIn: Math.max(0, Math.ceil((windowStart + windowMs - now) / 1000)),
      key,
      current: Math.ceil(effectiveCount),
    };
  }
}

export const slidingWindow = new SlidingWindowAlgorithm();

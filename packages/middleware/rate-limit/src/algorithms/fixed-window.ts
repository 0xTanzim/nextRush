import type { Algorithm, RateLimitInfo, RateLimitStore } from '../types';

/**
 * Fixed Window Counter Algorithm
 *
 * Best for: Simple use cases, internal APIs
 *
 * How it works:
 * 1. Divides time into fixed windows (e.g., every minute)
 * 2. Counts requests in current window
 * 3. Resets count when window expires
 *
 * Advantages:
 * - Simplest to implement and understand
 * - Lowest memory and CPU overhead
 * - Predictable behavior
 *
 * Disadvantages:
 * - Boundary burst problem: 2x limit at window boundaries
 *   (e.g., 100 at 0:59, 100 at 1:00 = 200 in 2 seconds)
 *
 * Use sliding-window if you need to prevent boundary bursts.
 */
export class FixedWindowAlgorithm implements Algorithm {
  readonly name = 'fixed-window' as const;

  async consume(
    key: string,
    limit: number,
    windowMs: number,
    store: RateLimitStore
  ): Promise<RateLimitInfo> {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const windowKey = `${key}:${windowStart}`;

    const entry = await store.get(windowKey);
    let count: number;

    if (!entry || entry.windowStart !== windowStart) {
      count = 1;
    } else {
      count = entry.count + 1;
    }

    const allowed = count <= limit;

    if (!allowed) {
      count = entry?.count ?? limit;
    }

    await store.set(
      windowKey,
      {
        count,
        windowStart,
      },
      windowMs
    );

    const resetTime = Math.ceil((windowStart + windowMs) / 1000);
    const resetIn = Math.max(0, Math.ceil((windowStart + windowMs - now) / 1000));

    return {
      allowed,
      limit,
      remaining: Math.max(0, limit - count),
      resetTime,
      resetIn,
      key,
      current: count,
    };
  }

  async peek(
    key: string,
    limit: number,
    windowMs: number,
    store: RateLimitStore
  ): Promise<RateLimitInfo> {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const windowKey = `${key}:${windowStart}`;

    const entry = await store.get(windowKey);
    const count = entry?.count ?? 0;

    return {
      allowed: count < limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetTime: Math.ceil((windowStart + windowMs) / 1000),
      resetIn: Math.max(0, Math.ceil((windowStart + windowMs - now) / 1000)),
      key,
      current: count,
    };
  }
}

export const fixedWindow = new FixedWindowAlgorithm();

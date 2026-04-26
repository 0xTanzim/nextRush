import type { Context } from '@nextrush/types';
import type { RateLimitInfo } from '../types';

/**
 * Standard RateLimit header names (IETF draft)
 * @see https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/
 */
export const STANDARD_HEADERS = {
  LIMIT: 'RateLimit-Limit',
  REMAINING: 'RateLimit-Remaining',
  RESET: 'RateLimit-Reset',
  POLICY: 'RateLimit-Policy',
} as const;

/**
 * Legacy X-RateLimit header names (widely used)
 */
export const LEGACY_HEADERS = {
  LIMIT: 'X-RateLimit-Limit',
  REMAINING: 'X-RateLimit-Remaining',
  RESET: 'X-RateLimit-Reset',
} as const;

/**
 * Set rate limit headers on response
 */
export function setRateLimitHeaders(
  ctx: Context,
  info: RateLimitInfo,
  options: {
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
    includeRetryAfter?: boolean;
    draftIetfHeaders?: boolean;
    windowMs?: number;
  } = {}
): void {
  const {
    standardHeaders = true,
    legacyHeaders = true,
    includeRetryAfter = true,
    draftIetfHeaders = false,
    windowMs = 60_000,
  } = options;

  if (legacyHeaders) {
    ctx.set(LEGACY_HEADERS.LIMIT, info.limit);
    ctx.set(LEGACY_HEADERS.REMAINING, Math.max(0, info.remaining));
    ctx.set(LEGACY_HEADERS.RESET, info.resetTime);
  }

  if (standardHeaders) {
    ctx.set(STANDARD_HEADERS.LIMIT, info.limit);
    ctx.set(STANDARD_HEADERS.REMAINING, Math.max(0, info.remaining));
    ctx.set(STANDARD_HEADERS.RESET, info.resetIn);
  }

  if (draftIetfHeaders) {
    const windowSec = Math.ceil(windowMs / 1000);
    ctx.set(STANDARD_HEADERS.POLICY, `${info.limit};w=${windowSec}`);
  }

  if (includeRetryAfter && !info.allowed) {
    ctx.set('Retry-After', Math.ceil(info.resetIn));
  }
}

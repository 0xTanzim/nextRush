/**
 * Request Fingerprinting for NextRush v2
 *
 * Generates unique fingerprints for request tracking and security.
 *
 * @packageDocumentation
 */

import type { IncomingHttpHeaders } from 'node:http';

/**
 * Request timing information
 */
export interface RequestTiming {
  start: number;
  duration: number;
  timestamp: string;
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter: number;
}

/**
 * Generate a unique fingerprint for a request
 *
 * @param headers - Request headers
 * @param ip - Client IP address
 * @returns Base64-encoded fingerprint string (16 chars)
 *
 * @example
 * ```typescript
 * const fp = generateFingerprint(req.headers, req.ip);
 * // Can be used for rate limiting, tracking, etc.
 * ```
 */
export function generateFingerprint(
  headers: IncomingHttpHeaders,
  ip: string
): string {
  const userAgent = headers['user-agent'] || '';
  const accept = headers.accept || '';
  const acceptLanguage = headers['accept-language'] || '';

  const fingerprint = `${ip}-${userAgent}-${accept}-${acceptLanguage}`;
  return Buffer.from(fingerprint).toString('base64').substring(0, 16);
}

/**
 * Get request timing information
 *
 * @param startTime - Request start timestamp
 * @returns Timing info with duration
 */
export function getRequestTiming(startTime: number): RequestTiming {
  return {
    start: startTime,
    duration: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get default rate limit info (placeholder for actual rate limiter)
 *
 * @returns Default rate limit info
 */
export function getDefaultRateLimitInfo(): RateLimitInfo {
  return {
    limit: 100,
    remaining: 99,
    reset: Date.now() + 3600000,
    retryAfter: 0,
  };
}

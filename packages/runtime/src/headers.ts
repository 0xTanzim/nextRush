/**
 * @nextrush/runtime - Headers Utilities
 *
 * Shared header conversion for web-platform adapters (Bun, Deno, Edge).
 *
 * @packageDocumentation
 */

import type { IncomingHeaders } from '@nextrush/types';

/**
 * Convert a Web API Headers object to a plain record.
 *
 * Uses `Object.create(null)` to prevent prototype pollution.
 * Multi-value headers are stored as `string[]`.
 *
 * @param headers - Web API Headers instance
 * @returns Null-prototype record matching IncomingHeaders
 */
export function headersToRecord(headers: Headers): IncomingHeaders {
  const record: Record<string, string | string[]> = Object.create(null) as Record<
    string,
    string | string[]
  >;

  headers.forEach((value, key) => {
    const existing = record[key];
    if (existing !== undefined) {
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        record[key] = [existing, value];
      }
    } else {
      record[key] = value;
    }
  });

  return record;
}

/**
 * Extract the client IP from a Web API Request, respecting trustProxy.
 *
 * When `trustProxy` is false (default), returns the `directIp` only.
 * When `trustProxy` is true, reads from standard proxy headers in order:
 *   1. `x-forwarded-for` (first entry)
 *   2. `x-real-ip`
 *
 * @param request - Web API Request
 * @param directIp - The direct socket/connection IP (runtime-specific)
 * @param trustProxy - Whether to trust proxy headers
 * @returns Client IP string (may be empty if unavailable)
 */
export function getClientIp(request: Request, directIp: string, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      const firstIp = forwarded.split(',')[0];
      if (firstIp) return firstIp.trim();
    }

    const realIp = request.headers.get('x-real-ip');
    if (realIp) return realIp.trim();
  }

  return directIp;
}

/**
 * Extract the client IP for Cloudflare-style edge runtimes, respecting trustProxy.
 *
 * Cloudflare sets `cf-connecting-ip` which can be trusted on Cloudflare deployments.
 * For non-Cloudflare edge runtimes, falls back to standard proxy headers.
 *
 * @param request - Web API Request
 * @param trustProxy - Whether to trust proxy headers
 * @returns Client IP string (may be empty if unavailable)
 */
export function getEdgeClientIp(request: Request, trustProxy: boolean): string {
  if (trustProxy) {
    // Cloudflare-specific header
    const cfIp = request.headers.get('cf-connecting-ip');
    if (cfIp) return cfIp.trim();
  }

  return getClientIp(request, '', trustProxy);
}

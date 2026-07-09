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
 * Basic client-IP format validation.
 *
 * @remarks
 * Accepts only characters valid in IPv4/IPv6 literals (hex digits, `.`, `:`).
 * Rejects clearly-malformed / injected values (e.g. a spoofed
 * `X-Forwarded-For` carrying `<script>`), matching the Node adapter's original
 * guard. Empty / whitespace-only values are rejected.
 *
 * @param value - Candidate IP (may be undefined).
 * @returns The trimmed IP if well-formed, otherwise `undefined`.
 */
export function isValidClientIp(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  return /^[\da-fA-F.:]+$/.test(trimmed) ? trimmed : undefined;
}

/**
 * A minimal case-insensitive header lookup, abstracting over Web `Headers`
 * and a Node `IncomingHeaders` record so one IP policy serves all adapters.
 */
export type HeaderLookup = (name: string) => string | undefined;

/**
 * Options for {@link resolveClientIp}.
 */
export interface ClientIpOptions {
  /** Whether proxy-supplied headers may be trusted. */
  trustProxy: boolean;
  /** The direct socket/connection IP (runtime-specific; used when not trusting proxies). */
  directIp: string;
  /**
   * When true, consult Cloudflare's `cf-connecting-ip` before the standard
   * proxy headers. Set by the edge adapter.
   */
  cloudflare?: boolean;
}

/**
 * The single, shared client-IP resolution policy for every adapter (audit F-11).
 *
 * @remarks
 * Precedence when `trustProxy` is enabled:
 *   1. `cf-connecting-ip` (only when `cloudflare` is set)
 *   2. `x-forwarded-for` (first entry)
 *   3. `x-real-ip`
 * Each candidate is format-validated ({@link isValidClientIp}); a malformed
 * value is skipped rather than trusted. When `trustProxy` is false, or no
 * valid proxy header is present, the `directIp` is returned.
 *
 * Centralizing this here means Node, Bun, Deno, and Edge resolve `ctx.ip`
 * identically for a given header set — previously each adapter forked its own
 * precedence and validation and they had drifted.
 *
 * @param get - Case-insensitive header lookup.
 * @param options - Trust + direct-IP + platform options.
 * @returns The resolved client IP (may be empty if unavailable).
 */
export function resolveClientIp(get: HeaderLookup, options: ClientIpOptions): string {
  const { trustProxy, directIp, cloudflare = false } = options;

  if (trustProxy) {
    if (cloudflare) {
      const cf = isValidClientIp(get('cf-connecting-ip'));
      if (cf) return cf;
    }

    const forwarded = get('x-forwarded-for');
    if (forwarded) {
      const first = isValidClientIp(forwarded.split(',')[0]);
      if (first) return first;
    }

    const realIp = isValidClientIp(get('x-real-ip'));
    if (realIp) return realIp;
  }

  return directIp;
}

/** Build a {@link HeaderLookup} over a Web `Headers` instance. */
function webHeaderLookup(request: Request): HeaderLookup {
  return (name) => request.headers.get(name) ?? undefined;
}

/**
 * Extract the client IP from a Web API Request, respecting trustProxy.
 *
 * @remarks
 * Delegates to the shared {@link resolveClientIp} policy so Bun/Deno behave
 * identically to Node and Edge (precedence + format validation).
 *
 * @param request - Web API Request
 * @param directIp - The direct socket/connection IP (runtime-specific)
 * @param trustProxy - Whether to trust proxy headers
 * @returns Client IP string (may be empty if unavailable)
 */
export function getClientIp(request: Request, directIp: string, trustProxy: boolean): string {
  return resolveClientIp(webHeaderLookup(request), { trustProxy, directIp });
}

/**
 * Extract the client IP for Cloudflare-style edge runtimes, respecting trustProxy.
 *
 * @remarks
 * Adds Cloudflare's `cf-connecting-ip` to the front of the shared
 * {@link resolveClientIp} precedence.
 *
 * @param request - Web API Request
 * @param trustProxy - Whether to trust proxy headers
 * @returns Client IP string (may be empty if unavailable)
 */
export function getEdgeClientIp(request: Request, trustProxy: boolean): string {
  return resolveClientIp(webHeaderLookup(request), {
    trustProxy,
    directIp: '',
    cloudflare: true,
  });
}

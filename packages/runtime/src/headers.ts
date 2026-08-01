/**
 * @nextrush/runtime - Headers Utilities
 *
 * Shared header conversion for web-platform adapters (Bun, Deno, Edge).
 *
 * @packageDocumentation
 */

import type { IncomingHeaders, ProxyTrust } from '@nextrush/types';
import { NULL_PROTO } from './null-proto';
import { isTrustedPeer, resolveByHopCount, resolveByPeerList } from './proxy-trust';

/**
 * Convert a Web API Headers object to a plain record.
 *
 * The result exposes no inherited `Object.prototype` members, so a malicious
 * header name cannot resolve to one. Multi-value headers are stored as
 * `string[]`.
 *
 * @param headers - Web API Headers instance
 * @returns Record matching IncomingHeaders, exposing no inherited members
 */
export function headersToRecord(headers: Headers): IncomingHeaders {
  const record: Record<string, string | string[]> = Object.create(NULL_PROTO) as Record<
    string,
    string | string[]
  >;

  // `Headers.getSetCookie()` returns each Set-Cookie header separately; the
  // spec folds every other multi-valued header into a single comma-joined
  // string. Handle set-cookie out of band so multiple cookies survive as an
  // array instead of being collapsed (audit R-10).
  const getSetCookie = (headers as { getSetCookie?: () => string[] }).getSetCookie;
  const hasSetCookieApi = typeof getSetCookie === 'function';

  headers.forEach((value, key) => {
    if (hasSetCookieApi && key === 'set-cookie') return; // handled below

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

  if (hasSetCookieApi) {
    const cookies = getSetCookie.call(headers);
    if (cookies.length > 1) {
      record['set-cookie'] = cookies;
    } else {
      const only = cookies[0];
      if (only !== undefined) record['set-cookie'] = only;
    }
  }

  return record;
}

/** Validate a dotted-decimal IPv4 literal (four octets, each 0–255). */
function isIPv4(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return false;
    if (Number(part) > 255) return false;
  }
  return true;
}

/**
 * Validate an IPv6 literal, including `::` compression and a trailing
 * IPv4-mapped group (e.g. `::ffff:192.0.2.1`).
 */
function isIPv6(value: string): boolean {
  const halves = value.split('::');
  if (halves.length > 2) return false; // at most one '::'

  const isHextet = (h: string): boolean => /^[\da-fA-F]{1,4}$/.test(h);
  const groupsValid = (groups: string[], allowV4Tail: boolean): boolean =>
    groups.every((g, i) => {
      if (allowV4Tail && i === groups.length - 1 && g.includes('.')) return isIPv4(g);
      return isHextet(g);
    });

  if (halves.length === 2) {
    // Compressed form: '::' stands in for one or more zero groups.
    const head = halves[0] ? halves[0].split(':') : [];
    const tail = halves[1] ? halves[1].split(':') : [];
    if (head.length + tail.length > 7) return false;
    return groupsValid(head, false) && groupsValid(tail, true);
  }

  // Uncompressed: exactly 8 groups (or 6 + IPv4 tail).
  const groups = value.split(':');
  if (groups.length !== 8 && !(groups.length === 7 && value.includes('.'))) return false;
  return groupsValid(groups, true);
}

/**
 * Structural client-IP validation.
 *
 * @remarks
 * Validates that the value is a well-formed IPv4 or IPv6 literal (audit R-7),
 * not merely a permitted character set — so injected or malformed values such
 * as `999.999.999.999`, `...`, or `::::` are rejected while real addresses pass.
 * Empty / whitespace-only values are rejected. Runtime-agnostic: no `node:net`.
 *
 * @param value - Candidate IP (may be undefined).
 * @returns The trimmed IP if well-formed, otherwise `undefined`.
 */
export function isValidClientIp(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  return isIPv4(trimmed) || isIPv6(trimmed) ? trimmed : undefined;
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
  /**
   * Proxy trust specification (RFC-030): `false` trusts nothing (the socket
   * peer is always `ctx.ip`); a `number` trusts exactly that many proxy
   * hops, selecting the corresponding `X-Forwarded-For` entry from the
   * right; a `string[]` of CIDR ranges/IPs trusts only requests whose
   * immediate peer (and every hop it names) falls inside the set.
   */
  trust: ProxyTrust;
  /** The direct socket/connection IP (runtime-specific; the fallback for every trust form). */
  directIp: string;
  /**
   * The immediate connecting peer's address, used to validate a `string[]`
   * trust list. Defaults to `directIp` when omitted — the two are the same
   * value on every adapter that doesn't sit behind its own internal proxy.
   */
  peerIp?: string;
  /**
   * When true, consult Cloudflare's `cf-connecting-ip` before the standard
   * proxy headers. Set by the edge adapter.
   */
  cloudflare?: boolean;
}

/**
 * The single, shared client-IP resolution policy for every adapter (audit F-11, RFC-030).
 *
 * @remarks
 * `trust: false` (default) always returns `directIp` — no header lookup, no
 * allocation, byte-identical to today. Otherwise the chain is walked from
 * the right under the configured trust (hop count or CIDR peer list), never
 * trusting the leftmost (client-authored) entry outright — the vulnerability
 * this policy exists to close (SEC-01). `cf-connecting-ip` is still
 * consulted first when `cloudflare` is set, but only once the peer/hop trust
 * above has already been satisfied for the rest of the chain.
 *
 * Centralizing this here means Node, Bun, Deno, and Edge resolve `ctx.ip`
 * identically for a given header set and trust configuration.
 *
 * @param get - Case-insensitive header lookup.
 * @param options - Trust + direct-IP + platform options.
 * @returns The resolved client IP (may be empty if unavailable).
 */
export function resolveClientIp(get: HeaderLookup, options: ClientIpOptions): string {
  const { trust, directIp, cloudflare = false, peerIp = directIp } = options;

  if (trust === false) return directIp;

  const peerTrusted = typeof trust === 'number' || isTrustedPeer(peerIp, trust);

  if (cloudflare && peerTrusted) {
    const cf = isValidClientIp(get('cf-connecting-ip'));
    if (cf) return cf;
  }

  if (!peerTrusted) return directIp;

  const forwarded = get('x-forwarded-for');
  if (forwarded) {
    const resolved =
      typeof trust === 'number'
        ? resolveByHopCount(forwarded, trust)
        : resolveByPeerList(forwarded, trust, peerIp);
    if (resolved) return resolved;
  }

  const realIp = isValidClientIp(get('x-real-ip'));
  if (realIp) return realIp;

  return directIp;
}

/** Build a {@link HeaderLookup} over a Web `Headers` instance. */
function webHeaderLookup(request: Request): HeaderLookup {
  return (name) => request.headers.get(name) ?? undefined;
}

/**
 * Extract the client IP from a Web API Request under the given proxy trust.
 *
 * @remarks
 * Delegates to the shared {@link resolveClientIp} policy so Bun/Deno behave
 * identically to Node and Edge (precedence + format validation).
 *
 * @param request - Web API Request
 * @param directIp - The direct socket/connection IP (runtime-specific)
 * @param trust - Proxy trust specification (RFC-030); `directIp` also serves as the peer address
 * @returns Client IP string (may be empty if unavailable)
 */
export function getClientIp(request: Request, directIp: string, trust: ProxyTrust): string {
  return resolveClientIp(webHeaderLookup(request), { trust, directIp });
}

/**
 * Extract the client IP for Cloudflare-style edge runtimes under the given proxy trust.
 *
 * @remarks
 * Adds Cloudflare's `cf-connecting-ip` to the front of the shared
 * {@link resolveClientIp} precedence. Edge has no socket peer address, so a
 * `string[]` (CIDR peer list) trust cannot be validated here — callers reject
 * that combination at boot (RFC-030 §8.6).
 *
 * @param request - Web API Request
 * @param trust - Proxy trust specification (RFC-030)
 * @returns Client IP string (may be empty if unavailable)
 */
export function getEdgeClientIp(request: Request, trust: ProxyTrust): string {
  return resolveClientIp(webHeaderLookup(request), {
    trust,
    directIp: '',
    cloudflare: true,
  });
}

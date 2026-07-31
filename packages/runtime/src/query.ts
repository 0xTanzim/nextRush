/**
 * @nextrush/runtime - Secure Query String Parser
 *
 * Hardened query string parser safe for all runtimes.
 * Protects against prototype pollution, parameter flooding, and malformed URIs.
 *
 * @packageDocumentation
 */

import type { QueryParams } from '@nextrush/types';
import { NULL_PROTO } from './null-proto';

/** Maximum number of query parameters to parse */
const MAX_QUERY_PARAMS = 256;

/** Maximum raw query string length in characters */
const MAX_QUERY_LENGTH = 2048;

/** Keys that must never appear as query parameter names */
const DENIED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Prototype for every per-request query bag.
 *
 * `Object.create(null)` satisfies the same security requirement but puts the
 * object into V8 dictionary mode, so every `ctx.query.q` read in application
 * code becomes an un-inline-cacheable lookup.
 *
 * @see docs/adr/ADR-0021-fast-property-request-containers.md
 */

/**
 * Shared frozen empty query returned for the empty and over-limit early-return
 * branches (HP-2-web). The only callers are the four adapter context
 * constructors, each assigning the result to `readonly ctx.query`; none mutate
 * it, so a single shared instance avoids a per-request throwaway allocation on
 * every query-less Web request. Frozen so any future mutating caller fails
 * loudly rather than corrupting shared state.
 */
const EMPTY_QUERY: QueryParams = Object.freeze(Object.create(NULL_PROTO) as QueryParams);

/**
 * Safely decode a URI component, returning the original string on failure.
 * Replaces '+' with space before decoding (form-encoded convention).
 *
 * Returns the input untouched when it contains neither `%` nor `+`, which is
 * the common case — `decodeURIComponent` plus an unconditional `replaceAll`
 * measured ~4.6-4.9x the cost of the guarded path on non-encoded input. The
 * router's `decodeParam` has guarded this since HP-11; this is the same guard,
 * widened to `+` because form-encoding is only relevant here.
 */
function safeDecodeURIComponent(str: string): string {
  if (!str.includes('%') && !str.includes('+')) return str;
  try {
    return decodeURIComponent(str.replaceAll('+', ' '));
  } catch {
    return str;
  }
}

/**
 * Parse a query string into a record of key-value pairs.
 *
 * The result's prototype chain excludes `Object.prototype`, so a query key can
 * never resolve to an inherited member; dangerous keys (`__proto__`,
 * `constructor`, `prototype`) are additionally rejected outright.
 * Enforces parameter count and length limits for DoS protection.
 *
 * @param qs - Query string without leading '?'
 * @returns Parsed query parameters, exposing no inherited members
 */
export function parseQueryString(qs: string): QueryParams {
  // Empty or over-limit → the shared frozen empty query (no per-request alloc).
  if (!qs || qs.length > MAX_QUERY_LENGTH) return EMPTY_QUERY;

  const result: QueryParams = Object.create(NULL_PROTO) as QueryParams;

  // Single-pass scanner — avoids split('&') intermediate array allocation.
  // Walks the string with indexOf('&') to locate pair boundaries.
  let count = 0;
  let start = 0;
  const len = qs.length;

  while (start < len && count < MAX_QUERY_PARAMS) {
    let end = qs.indexOf('&', start);
    if (end === -1) end = len;

    if (end > start) {
      // Locate '=' within the current pair span
      const eqIndex = qs.indexOf('=', start);
      const hasEq = eqIndex !== -1 && eqIndex < end;

      const key = safeDecodeURIComponent(hasEq ? qs.slice(start, eqIndex) : qs.slice(start, end));

      if (key && !DENIED_KEYS.has(key)) {
        const value = hasEq ? safeDecodeURIComponent(qs.slice(eqIndex + 1, end)) : '';

        const existing = result[key];
        if (existing === undefined) {
          result[key] = value;
          count++;
        } else if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          result[key] = [existing, value];
        }
      }
    }

    start = end + 1;
  }

  return result;
}

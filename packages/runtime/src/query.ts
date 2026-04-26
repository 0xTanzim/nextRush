/**
 * @nextrush/runtime - Secure Query String Parser
 *
 * Hardened query string parser safe for all runtimes.
 * Protects against prototype pollution, parameter flooding, and malformed URIs.
 *
 * @packageDocumentation
 */

import type { QueryParams } from '@nextrush/types';

/** Maximum number of query parameters to parse */
const MAX_QUERY_PARAMS = 256;

/** Maximum raw query string length in characters */
const MAX_QUERY_LENGTH = 2048;

/** Keys that must never appear as query parameter names */
const DENIED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Safely decode a URI component, returning the original string on failure.
 * Replaces '+' with space before decoding (form-encoded convention).
 */
function safeDecodeURIComponent(str: string): string {
  try {
    return decodeURIComponent(str.replaceAll('+', ' '));
  } catch {
    return str;
  }
}

/**
 * Parse a query string into a record of key-value pairs.
 *
 * Uses `Object.create(null)` to prevent prototype pollution.
 * Enforces parameter count and length limits for DoS protection.
 * Rejects dangerous keys (__proto__, constructor, prototype).
 *
 * @param qs - Query string without leading '?'
 * @returns Parsed query parameters (null-prototype object)
 */
export function parseQueryString(qs: string): QueryParams {
  const result: QueryParams = Object.create(null) as QueryParams;

  if (!qs || qs.length > MAX_QUERY_LENGTH) return result;

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

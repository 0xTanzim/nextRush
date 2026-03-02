/**
 * @nextrush/adapter-node - Utility Functions
 *
 * @packageDocumentation
 */

import type { QueryParams } from '@nextrush/types';

/**
 * Safely decode URI component, returning original on failure
 */
function safeDecodeURIComponent(str: string): string {
  try {
    return decodeURIComponent(str.replaceAll('+', ' '));
  } catch {
    return str;
  }
}

/**
 * Maximum number of query parameters to parse.
 * Prevents parameter flooding DoS attacks.
 */
const MAX_QUERY_PARAMS = 256;

/**
 * Maximum query string length in characters.
 */
const MAX_QUERY_LENGTH = 2048;

/**
 * Keys that must never be set on the result object.
 * Prevents prototype pollution via __proto__, constructor, or prototype injection.
 */
const DENIED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Parse query string into object
 * Simple implementation without external dependencies
 * Safe against malformed URI components, prototype pollution, and parameter flooding
 */
export function parseQueryString(qs: string): QueryParams {
  const result: QueryParams = Object.create(null) as QueryParams;

  if (!qs || qs.length > MAX_QUERY_LENGTH) return result;

  const pairs = qs.split('&');
  let count = 0;

  for (const pair of pairs) {
    if (!pair) continue;
    if (count >= MAX_QUERY_PARAMS) break;

    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) {
      const key = safeDecodeURIComponent(pair);
      if (key && !DENIED_KEYS.has(key)) {
        result[key] = '';
        count++;
      }
      continue;
    }

    const key = safeDecodeURIComponent(pair.slice(0, eqIndex));
    const value = safeDecodeURIComponent(pair.slice(eqIndex + 1));

    if (!key || DENIED_KEYS.has(key)) continue;

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

  return result;
}

/**
 * Get content length from headers
 */
export function getContentLength(headers: Record<string, unknown>): number {
  const length = headers['content-length'];
  if (typeof length === 'string') {
    const parsed = parseInt(length, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Get content type from headers
 */
export function getContentType(headers: Record<string, unknown>): string {
  const type = headers['content-type'];
  if (typeof type === 'string') {
    // Remove charset and other params
    const semiIndex = type.indexOf(';');
    return semiIndex !== -1 ? type.slice(0, semiIndex).trim() : type.trim();
  }
  return '';
}

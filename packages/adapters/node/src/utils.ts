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
    return decodeURIComponent(str.replace(/\+/g, ' '));
  } catch {
    return str;
  }
}

/**
 * Parse query string into object
 * Simple implementation without external dependencies
 * Safe against malformed URI components
 */
export function parseQueryString(qs: string): QueryParams {
  const result: QueryParams = {};

  if (!qs) return result;

  const pairs = qs.split('&');

  for (const pair of pairs) {
    if (!pair) continue;

    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) {
      const key = safeDecodeURIComponent(pair);
      if (key) result[key] = '';
      continue;
    }

    const key = safeDecodeURIComponent(pair.slice(0, eqIndex));
    const value = safeDecodeURIComponent(pair.slice(eqIndex + 1));

    if (!key) continue;

    const existing = result[key];
    if (existing === undefined) {
      result[key] = value;
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

/**
 * @nextrush/adapter-deno - Utility Functions
 *
 * @packageDocumentation
 */

import type { QueryParams } from '@nextrush/types';

/**
 * Parse query string into object
 *
 * @param queryString - Query string without leading '?'
 * @returns Parsed query parameters
 */
export function parseQueryString(queryString: string): QueryParams {
  if (!queryString) {
    return {};
  }

  const params: QueryParams = {};
  const pairs = queryString.split('&');

  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (!key) continue;

    const decodedKey = decodeURIComponent(key);
    const decodedValue = value !== undefined ? decodeURIComponent(value) : '';

    const existing = params[decodedKey];
    if (existing !== undefined) {
      // Convert to array if multiple values
      if (Array.isArray(existing)) {
        existing.push(decodedValue);
      } else {
        params[decodedKey] = [existing, decodedValue];
      }
    } else {
      params[decodedKey] = decodedValue;
    }
  }

  return params;
}

/**
 * Get Content-Type header value
 */
export function getContentType(headers: Headers): string | undefined {
  return headers.get('content-type') ?? undefined;
}

/**
 * Get Content-Length header as number
 */
export function getContentLength(headers: Headers): number | undefined {
  const value = headers.get('content-length');
  if (value === null) return undefined;
  const num = parseInt(value, 10);
  return Number.isNaN(num) ? undefined : num;
}

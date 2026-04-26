/**
 * @nextrush/adapter-deno - Utility Functions
 *
 * @packageDocumentation
 */

export { parseQueryString } from '@nextrush/runtime';

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

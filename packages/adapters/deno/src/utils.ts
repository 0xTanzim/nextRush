/**
 * @nextrush/adapter-deno - Utility Functions
 *
 * @packageDocumentation
 */

export { parseQueryString } from '@nextrush/runtime';

/**
 * Get Content-Type header value
 *
 * @deprecated F-09: unused internally (superseded by `@nextrush/body-parser`'s
 * own content-type parsing). Kept for backward compatibility per the public-API
 * contract (deprecate-before-remove); will be removed in a future major.
 */
export function getContentType(headers: Headers): string | undefined {
  return headers.get('content-type') ?? undefined;
}

/**
 * Get Content-Length header as number
 *
 * @deprecated F-09: unused internally (superseded by `@nextrush/body-parser`'s
 * own content-length handling). Kept for backward compatibility per the
 * public-API contract (deprecate-before-remove); will be removed in a future
 * major.
 */
export function getContentLength(headers: Headers): number | undefined {
  const value = headers.get('content-length');
  if (value === null) return undefined;
  const num = parseInt(value, 10);
  return Number.isNaN(num) ? undefined : num;
}

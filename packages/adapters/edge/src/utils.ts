/**
 * @nextrush/adapter-edge - Utility Functions
 *
 * @packageDocumentation
 */

export { detectEdgeRuntime, parseQueryString } from '@nextrush/runtime';
export type { EdgeRuntimeInfo } from '@nextrush/runtime';

/**
 * Get Content-Type header value
 *
 * @deprecated Unused internally (superseded by `@nextrush/body-parser`'s own
 * content-type parsing). Will be removed in `2.0.0`.
 */
export function getContentType(headers: Headers): string | undefined {
  return headers.get('content-type') ?? undefined;
}

/**
 * Get Content-Length header as number
 *
 * @deprecated Unused internally (superseded by `@nextrush/body-parser`'s own
 * content-length handling). Will be removed in `2.0.0`.
 */
export function getContentLength(headers: Headers): number | undefined {
  const value = headers.get('content-length');
  if (value === null) return undefined;
  const num = parseInt(value, 10);
  return Number.isNaN(num) ? undefined : num;
}

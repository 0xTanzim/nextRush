/**
 * @nextrush/adapter-edge - Utility Functions
 *
 * @packageDocumentation
 */

export { detectEdgeRuntime, parseQueryString } from '@nextrush/runtime';
export type { EdgeRuntimeInfo } from '@nextrush/runtime';

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

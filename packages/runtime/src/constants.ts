/**
 * @nextrush/runtime - Shared Constants
 *
 * @packageDocumentation
 */

/**
 * HTTP methods that typically don't carry a request body.
 *
 * @remarks
 * DELETE is intentionally excluded — RFC 7231 §4.3.5 permits a body
 * on DELETE requests. TRACE is included per RFC 7231 §4.3.8 which
 * forbids a body on TRACE.
 */
export const METHODS_WITHOUT_BODY: ReadonlySet<string> = new Set([
  'GET',
  'HEAD',
  'OPTIONS',
  'TRACE',
]);

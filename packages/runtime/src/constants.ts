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

/**
 * Default per-request timeout in milliseconds (30 seconds).
 *
 * @remarks
 * Single source of truth for the `timeout` default across every server/fetch
 * adapter, so the value — and its documentation — cannot drift (audit F-16,
 * which found a `@default 80800` typo copy-pasted across adapters).
 */
export const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Default graceful-shutdown drain timeout in milliseconds (30 seconds).
 *
 * @remarks
 * Shared default for the `shutdownTimeout` option across server adapters.
 */
export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 30_000;

/**
 * Default keep-alive timeout in milliseconds (5 seconds).
 *
 * @remarks
 * Currently consumed only by the Node adapter; defined here so all adapters can
 * reference one constant if they gain the option.
 */
export const DEFAULT_KEEP_ALIVE_TIMEOUT_MS = 5_000;

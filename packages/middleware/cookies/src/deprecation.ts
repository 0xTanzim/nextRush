/**
 * @nextrush/cookies - Once-Per-Process Warnings (RFC-034)
 *
 * The `ctx.state.cookies` deprecation warning and the custom-decode-failure
 * warning: each emitted at most once per process, matching the
 * legacy-signature warning pattern, so a request that runs through the
 * middleware many times does not flood the log. Uses only the Web-standard
 * `console` — no `process`/`node:*` — so the package stays edge-portable.
 *
 * @packageDocumentation
 */

let warned = false;
let decodeWarned = false;

/**
 * Warn once per process that `ctx.state.cookies` is deprecated in favor of
 * `ctx.cookies` (RFC-034).
 *
 * @internal
 */
export function warnStateCookiesDeprecatedOnce(): void {
  if (warned) return;
  warned = true;
  console.warn(
    '[@nextrush/cookies] ctx.state.cookies is deprecated. Use ctx.cookies instead — ' +
      'see https://nextrush.dev/docs/reference/cookies'
  );
}

/**
 * Warn once per process that a custom `decode` function threw for a cookie
 * name. The parser-sanitized value is retained and the request continues; the
 * warning makes the silently-degraded decode observable.
 *
 * @internal
 */
export function warnCookieDecodeFailedOnce(cookieName: string): void {
  if (decodeWarned) return;
  decodeWarned = true;
  console.warn(
    `[@nextrush/cookies] custom decode threw for cookie "${cookieName}". ` +
      'Falling back to the parser-sanitized value. Fix the decode function to avoid ' +
      'silently degraded cookie values.'
  );
}

/** Reset the once-per-process flags. Exposed for testing. @internal */
export function resetStateCookiesDeprecationWarning(): void {
  warned = false;
  decodeWarned = false;
}

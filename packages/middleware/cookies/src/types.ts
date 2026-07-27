/**
 * @nextrush/cookies - Cookie Types
 *
 * Wire-facing cookie types: `SameSiteValue`, `CookiePriority`,
 * `CookieOptions`, `ParsedCookies`. Middleware option types and context
 * extension interfaces live in `middleware-types.ts`.
 *
 * @packageDocumentation
 */

// ============================================================================
// SameSite Types
// ============================================================================

/**
 * SameSite attribute values.
 *
 * - `'strict'`: Only sent with same-site requests
 * - `'lax'`: Sent with same-site and top-level navigations (recommended default)
 * - `'none'`: Sent with all requests (requires Secure=true)
 * - `true`: Alias for 'strict'
 * - `false`: Alias for 'none'
 */
export type SameSiteValue = 'strict' | 'lax' | 'none' | boolean;

/**
 * Cookie priority values (Chrome extension).
 * @see https://datatracker.ietf.org/doc/html/draft-west-cookie-priority
 */
export type CookiePriority = 'low' | 'medium' | 'high';

// ============================================================================
// Cookie Options
// ============================================================================

/**
 * Cookie serialization options.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies
 * @see https://datatracker.ietf.org/doc/html/rfc6265
 */
export interface CookieOptions {
  /**
   * Domain for the cookie.
   *
   * If omitted, defaults to the host of the current document URL.
   * Leading dots are ignored (`.example.com` = `example.com`).
   *
   * @example '.example.com'
   */
  domain?: string;

  /**
   * Expiration date for the cookie.
   *
   * If not set, cookie becomes a session cookie (deleted when browser closes).
   * Can be a Date object or a timestamp number.
   */
  expires?: Date | number;

  /**
   * HttpOnly flag - prevents JavaScript access.
   *
   * When true, the cookie is inaccessible to `document.cookie`.
   * **Strongly recommended for session cookies.**
   *
   * @default true (secure default)
   */
  httpOnly?: boolean;

  /**
   * Max age in seconds.
   *
   * Alternative to `expires`. If both are set, `maxAge` takes precedence.
   * Use 0 to expire the cookie immediately.
   *
   * @example 3600 // 1 hour
   */
  maxAge?: number;

  /**
   * Path for the cookie.
   *
   * Cookie will only be sent for requests to this path and its children.
   *
   * @default '/'
   */
  path?: string;

  /**
   * SameSite attribute for CSRF protection.
   *
   * - `'strict'`: Only sent with same-site requests
   * - `'lax'`: Sent with same-site and top-level navigations (recommended)
   * - `'none'`: Sent with all requests (requires `secure: true`)
   *
   * @default 'lax' (secure default)
   */
  sameSite?: SameSiteValue;

  /**
   * Secure flag - only sent over HTTPS.
   *
   * When `true`, the cookie is only sent with encrypted requests. When
   * `false`, the flag is never set (explicit opt-out, always honored). When
   * `'auto'` (the default), `Secure` is emitted unless the request is
   * demonstrably plaintext loopback — see `cookies({ trustProxy })` for how
   * a trusted-forwarded HTTPS request is recognized (SEC-08). An untrusted
   * `X-Forwarded-Proto: https` claim never suppresses `Secure` (fails
   * closed).
   *
   * **Required for `SameSite=None` and `__Secure-` / `__Host-` prefixes.**
   *
   * @default 'auto'
   */
  secure?: boolean | 'auto';

  /**
   * Priority hint for the browser.
   *
   * When cookies exceed limits, lower priority cookies are evicted first.
   *
   * @see https://datatracker.ietf.org/doc/html/draft-west-cookie-priority
   */
  priority?: CookiePriority;

  /**
   * Partitioned flag for third-party cookies (CHIPS).
   *
   * When true, the cookie is partitioned by top-level site.
   * Helps preserve privacy while allowing cross-site functionality.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/Privacy/Partitioned_cookies
   */
  partitioned?: boolean;
}

// ============================================================================
// Parsed Cookies
// ============================================================================

/**
 * Parsed cookies as key-value pairs.
 */
export type ParsedCookies = Record<string, string>;

// ============================================================================
// See middleware-types.ts for CookieMiddlewareOptions,
// SignedCookieMiddlewareOptions, CookieContext, SignedCookieContext,
// CookieState, and SignedCookieState — split out to keep this file under
// the file-size ceiling. Import from './middleware-types.js' directly.
// ============================================================================

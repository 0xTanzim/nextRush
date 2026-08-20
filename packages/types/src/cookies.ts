/**
 * @nextrush/types - Cookie Capability Contracts (RFC-034)
 *
 * The first-class `ctx.cookies` capability contract and its data types.
 * `@nextrush/cookies` implements this contract and re-exports these types;
 * the middleware package remains the only runtime implementation, so no
 * package in the core/runtime/adapter layers ever imports middleware code.
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
   * `'lax'` limits cross-site cookie transmission and provides baseline CSRF
   * mitigation; it does not eliminate CSRF.
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
   * demonstrably plaintext loopback (SEC-08). An untrusted
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
   */
  priority?: CookiePriority;

  /**
   * Partitioned flag for third-party cookies (CHIPS).
   *
   * When true, the cookie is partitioned by top-level site.
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
// Capability Contracts
// ============================================================================

/**
 * The first-class cookie capability exposed as `ctx.cookies` (RFC-034).
 *
 * The property always exists on a `Context`; before the `cookies()`
 * middleware runs, every operation throws `CapabilityNotInitializedError`
 * (from `@nextrush/errors`). The middleware activates the capability by
 * replacing the uninitialized slot with a per-request cookie store.
 */
export interface CookieCapability {
  /** Get a cookie value by name, or `undefined` if not present. */
  get(name: string): string | undefined;

  /** Set a cookie, emitting the `Set-Cookie` header immediately. */
  set(name: string, value: string, options?: CookieOptions): void;

  /** Delete a cookie by expiring it; path/domain must match the original. */
  delete(name: string, options?: Pick<CookieOptions, 'domain' | 'path'>): void;

  /** Get all parsed cookies as a fresh key-value object. */
  all(): ParsedCookies;

  /** Whether a cookie with this name is present. */
  has(name: string): boolean;

  /**
   * The signed-cookie sub-capability. Uninitialized until the
   * `signedCookies()` middleware runs; operations on it throw
   * `CapabilityNotInitializedError` before that.
   *
   * @remarks Mutable by contract: the `signedCookies()` middleware activates
   * the sub-capability by assigning a signed store to this member. Handlers
   * treat it as read-only; nothing else writes it.
   */
  signed: SignedCookieCapability;
}

/**
 * The signed-cookie sub-capability exposed as `ctx.cookies.signed`
 * (RFC-034). Activated by the `signedCookies()` middleware; requires
 * `cookies()` to have run first.
 */
export interface SignedCookieCapability {
  /**
   * Get and verify a signed cookie value.
   *
   * Returns `undefined` indistinguishably for a missing cookie, a malformed
   * signature, tampering, name mismatch, or expiry.
   */
  get(name: string): Promise<string | undefined>;

  /** Set a cookie whose value is signed before serialization. */
  set(name: string, value: string, options?: CookieOptions): Promise<void>;

  /** Delete a signed cookie; path/domain must match the original. */
  delete(name: string, options?: Pick<CookieOptions, 'domain' | 'path'>): void;
}

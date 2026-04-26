/**
 * @nextrush/cookies - Cookie Types
 *
 * Type definitions for cookie middleware and helpers.
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
   * When true, the cookie is only sent with encrypted requests.
   * **Required for `SameSite=None` and `__Secure-` / `__Host-` prefixes.**
   *
   * @default false (set to true in production)
   */
  secure?: boolean;

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
// Middleware Options
// ============================================================================

/**
 * Cookie middleware options.
 *
 * For signed cookies, use `signedCookies()` with `SignedCookieMiddlewareOptions` instead.
 */
export interface CookieMiddlewareOptions {
  /**
   * Custom decode function for cookie values.
   *
   * @default decodeURIComponent
   */
  decode?: (value: string) => string;
}

/**
 * Signed cookie middleware options.
 */
export interface SignedCookieMiddlewareOptions {
  /**
   * Secret key for signing (required).
   */
  secret: string;

  /**
   * Previous secrets for key rotation.
   */
  previousSecrets?: string[];
}

// ============================================================================
// Context Extensions
// ============================================================================

/**
 * Cookie context extension added to `ctx.state.cookies`.
 */
export interface CookieContext {
  /**
   * Get a cookie value by name.
   *
   * @param name - Cookie name
   * @returns Cookie value or undefined if not found
   */
  get(name: string): string | undefined;

  /**
   * Set a cookie.
   *
   * @param name - Cookie name
   * @param value - Cookie value
   * @param options - Cookie options
   */
  set(name: string, value: string, options?: CookieOptions): void;

  /**
   * Delete a cookie.
   *
   * @param name - Cookie name
   * @param options - Path and domain must match the original cookie
   */
  delete(name: string, options?: Pick<CookieOptions, 'domain' | 'path'>): void;

  /**
   * Get all parsed cookies.
   *
   * @returns Object with all cookie name-value pairs
   */
  all(): ParsedCookies;

  /**
   * Check if a cookie exists.
   *
   * @param name - Cookie name
   * @returns True if cookie exists
   */
  has(name: string): boolean;
}

/**
 * Signed cookie context extension.
 */
export interface SignedCookieContext {
  /**
   * Get a signed cookie value (verified).
   *
   * @param name - Cookie name
   * @returns Cookie value if valid, undefined if invalid/not found
   */
  get(name: string): Promise<string | undefined>;

  /**
   * Set a signed cookie.
   *
   * @param name - Cookie name
   * @param value - Cookie value (will be signed)
   * @param options - Cookie options
   */
  set(name: string, value: string, options?: CookieOptions): Promise<void>;

  /**
   * Delete a signed cookie.
   *
   * @param name - Cookie name
   * @param options - Path and domain must match the original cookie
   */
  delete(name: string, options?: Pick<CookieOptions, 'domain' | 'path'>): void;
}

/**
 * Extended state with cookies.
 */
export interface CookieState {
  /** Regular cookies */
  cookies: CookieContext;
}

/**
 * Extended state with signed cookies.
 */
export interface SignedCookieState {
  /** Signed cookies */
  signedCookies: SignedCookieContext;
}

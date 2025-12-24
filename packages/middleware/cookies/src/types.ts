/**
 * @nextrush/cookies - Cookie Types
 *
 * Type definitions for cookie middleware and helpers.
 *
 * @packageDocumentation
 */

/**
 * Cookie serialization options
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies
 */
export interface CookieOptions {
  /**
   * Domain for the cookie
   * @example '.example.com'
   */
  domain?: string;

  /**
   * Expiration date for the cookie
   * If not set, cookie becomes a session cookie
   */
  expires?: Date;

  /**
   * HttpOnly flag - prevents JavaScript access
   * @default true for security
   */
  httpOnly?: boolean;

  /**
   * Max age in seconds
   * Alternative to `expires`
   */
  maxAge?: number;

  /**
   * Path for the cookie
   * @default '/'
   */
  path?: string;

  /**
   * SameSite attribute for CSRF protection
   * - 'strict': Only sent with same-site requests
   * - 'lax': Sent with same-site and top-level navigations
   * - 'none': Sent with all requests (requires Secure)
   * @default 'lax'
   */
  sameSite?: 'strict' | 'lax' | 'none' | boolean;

  /**
   * Secure flag - only sent over HTTPS
   * @default false (should be true in production)
   */
  secure?: boolean;

  /**
   * Priority hint for the browser
   * @see https://datatracker.ietf.org/doc/html/draft-west-cookie-priority
   */
  priority?: 'low' | 'medium' | 'high';

  /**
   * Partitioned flag for third-party cookies
   * @see https://developer.mozilla.org/en-US/docs/Web/Privacy/Partitioned_cookies
   */
  partitioned?: boolean;
}

/**
 * Parsed cookies object
 */
export type ParsedCookies = Record<string, string>;

/**
 * Cookie middleware options
 */
export interface CookieMiddlewareOptions {
  /**
   * Secret key for signed cookies
   * If provided, enables cookie signing
   */
  secret?: string;

  /**
   * Parse signed cookies
   * @default true when secret is provided
   */
  signed?: boolean;

  /**
   * Decode function for cookie values
   * @default decodeURIComponent
   */
  decode?: (value: string) => string;
}

/**
 * Cookie context extension
 * Added to ctx.state by the middleware
 */
export interface CookieContext {
  /**
   * Get a cookie value
   */
  get(name: string): string | undefined;

  /**
   * Set a cookie
   */
  set(name: string, value: string, options?: CookieOptions): void;

  /**
   * Delete a cookie
   */
  delete(name: string, options?: Pick<CookieOptions, 'domain' | 'path'>): void;

  /**
   * Get all cookies
   */
  all(): ParsedCookies;
}

/**
 * Extended state with cookies
 */
export interface CookieState {
  cookies: CookieContext;
}

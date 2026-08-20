/**
 * @nextrush/cookies - Middleware Option and Context Types
 *
 * `CookieMiddlewareOptions`, `SignedCookieMiddlewareOptions`, and the
 * capability context interfaces backing `ctx.cookies` /
 * `ctx.cookies.signed` (RFC-034), plus the deprecated `ctx.state.*` alias
 * shapes. Split out of `types.ts` to keep that file under the file-size
 * ceiling.
 *
 * @packageDocumentation
 */

import type { CookieOptions, ParsedCookies } from './types.js';

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

  /**
   * Trusts a forwarded-protocol claim (`X-Forwarded-Proto: https`) for
   * resolving `secure: 'auto'` when the request itself is plaintext at the
   * transport level (e.g. TLS terminated upstream by a reverse proxy).
   *
   * Off by default — an untrusted claim never suppresses `Secure`, and
   * never widens it either; it is simply ignored (fail closed, SEC-08).
   *
   * @default false
   */
  trustProxy?: boolean;

  /**
   * Injection point for a public suffix list used by domain validation
   * (SEC-18). Supplied entries are consulted in addition to the framework's
   * curated `COMMON_PUBLIC_SUFFIXES` set; an unrecognized multi-label
   * `Domain` suffix warns instead of throwing, since no partial list can be
   * exhaustive.
   */
  publicSuffixList?: Iterable<string>;
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

  /**
   * Trusts a forwarded-protocol claim for `secure: 'auto'` resolution — see
   * {@link CookieMiddlewareOptions.trustProxy}.
   *
   * @default false
   */
  trustProxy?: boolean;

  /**
   * Enforces the embedded issue time against this lifetime in seconds when
   * verifying a signed cookie (SEC-07). Omit to skip expiry enforcement.
   */
  maxAge?: number;

  /**
   * Accepts the pre-RFC-031 value-only signature format as a rotation
   * fallback. Off by default; logs once per process when exercised. See the
   * README's signed-cookie format migration section.
   *
   * @default false
   */
  acceptLegacySignatures?: boolean;
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

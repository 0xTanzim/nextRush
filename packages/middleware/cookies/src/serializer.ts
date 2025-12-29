/**
 * @nextrush/cookies - Cookie Serialization
 *
 * RFC 6265 compliant cookie serialization with security hardening.
 *
 * @packageDocumentation
 */

import {
    COOKIE_PREFIXES,
    DEFAULT_COOKIE_OPTIONS,
    MAX_COOKIE_SIZE
} from './constants.js';
import type { CookieOptions, SameSiteValue } from './types.js';
import {
    isValidCookieName,
    sanitizeCookieValue,
    SecurityError,
    validateCookieOptions,
    validateCookiePrefix
} from './validation.js';

// ============================================================================
// Cookie Serialization
// ============================================================================

/**
 * Serialize a cookie to Set-Cookie header format.
 *
 * Implements RFC 6265 with security hardening:
 * - CRLF injection prevention
 * - Cookie prefix validation (__Secure-, __Host-)
 * - Size limit enforcement
 * - Secure defaults
 *
 * @param name - Cookie name
 * @param value - Cookie value
 * @param options - Cookie options
 * @returns Set-Cookie header value
 *
 * @throws {SecurityError} If cookie name/value contains dangerous characters
 * @throws {SecurityError} If cookie prefix requirements not met
 * @throws {RangeError} If cookie exceeds size limit
 *
 * @example
 * ```typescript
 * // Basic cookie
 * serializeCookie('session', 'abc123', { httpOnly: true });
 * // 'session=abc123; HttpOnly'
 *
 * // Secure cookie with prefix
 * serializeCookie('__Secure-token', 'xyz', { secure: true });
 * // '__Secure-token=xyz; Secure'
 * ```
 */
export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
): string {
  // Merge with secure defaults
  const opts = { ...DEFAULT_COOKIE_OPTIONS, ...options };

  // Validate cookie name
  if (!isValidCookieName(name)) {
    throw new SecurityError(
      `Invalid cookie name: "${name}". Cookie names must be RFC 6265 tokens.`,
      'INVALID_COOKIE_NAME'
    );
  }

  // Validate prefix requirements
  validateCookiePrefix(name, opts);

  // Validate options (domain, path)
  validateCookieOptions(opts);

  // Sanitize value (remove CRLF, control characters)
  const sanitizedValue = sanitizeCookieValue(value);

  // Build cookie string
  const parts: string[] = [];

  // Name=Value (URL encode value for safety)
  const encodedValue = encodeURIComponent(sanitizedValue);
  parts.push(`${name}=${encodedValue}`);

  // Domain
  if (opts.domain) {
    parts.push(`Domain=${opts.domain}`);
  }

  // Path
  if (opts.path) {
    parts.push(`Path=${opts.path}`);
  }

  // Expires
  if (opts.expires) {
    const expiresDate = opts.expires instanceof Date
      ? opts.expires
      : new Date(opts.expires);
    parts.push(`Expires=${expiresDate.toUTCString()}`);
  }

  // Max-Age
  if (opts.maxAge !== undefined) {
    const maxAge = Math.floor(opts.maxAge);
    if (maxAge < 0) {
      throw new RangeError('maxAge must be a non-negative number');
    }
    parts.push(`Max-Age=${maxAge}`);
  }

  // HttpOnly
  if (opts.httpOnly) {
    parts.push('HttpOnly');
  }

  // Secure
  if (opts.secure) {
    parts.push('Secure');
  }

  // SameSite
  if (opts.sameSite) {
    const sameSiteValue = normalizeSameSite(opts.sameSite);
    parts.push(`SameSite=${sameSiteValue}`);
  }

  // Priority (Chrome extension)
  if (opts.priority) {
    const priority = opts.priority.charAt(0).toUpperCase() + opts.priority.slice(1).toLowerCase();
    parts.push(`Priority=${priority}`);
  }

  // Partitioned (CHIPS)
  if (opts.partitioned) {
    parts.push('Partitioned');
  }

  const cookie = parts.join('; ');

  // Enforce size limit
  if (cookie.length > MAX_COOKIE_SIZE) {
    throw new RangeError(
      `Cookie "${name}" exceeds maximum size of ${MAX_COOKIE_SIZE} bytes (got ${cookie.length})`
    );
  }

  return cookie;
}

/**
 * Normalize SameSite value to proper casing.
 */
function normalizeSameSite(sameSite: SameSiteValue): string {
  if (sameSite === true) {
    return 'Strict';
  }
  if (sameSite === false) {
    return 'None';
  }
  const lower = sameSite.toLowerCase();
  switch (lower) {
    case 'strict':
      return 'Strict';
    case 'lax':
      return 'Lax';
    case 'none':
      return 'None';
    default:
      return 'Lax'; // Safe default
  }
}

// ============================================================================
// Cookie Deletion
// ============================================================================

/**
 * Create a Set-Cookie header to delete a cookie.
 *
 * @param name - Cookie name to delete
 * @param options - Path and domain must match the original cookie
 * @returns Set-Cookie header value that deletes the cookie
 *
 * @example
 * ```typescript
 * const header = createDeleteCookie('session', { path: '/' });
 * // 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0'
 * ```
 */
export function createDeleteCookie(
  name: string,
  options: Pick<CookieOptions, 'domain' | 'path'> = {}
): string {
  return serializeCookie(name, '', {
    ...options,
    expires: new Date(0),
    maxAge: 0,
    httpOnly: false, // Let original settings determine this
    secure: false,
    sameSite: undefined
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create secure cookie options (Secure + SameSite=Strict + HttpOnly).
 *
 * @param options - Additional options to merge
 * @returns Secure cookie options
 *
 * @example
 * ```typescript
 * serializeCookie('token', value, secureOptions({ maxAge: 3600 }));
 * ```
 */
export function secureOptions(options: CookieOptions = {}): CookieOptions {
  return {
    ...options,
    secure: true,
    httpOnly: true,
    sameSite: 'strict',
    path: options.path ?? '/'
  };
}

/**
 * Create session cookie options (no expiry, secure defaults).
 *
 * @param options - Additional options to merge
 * @returns Session cookie options
 *
 * @example
 * ```typescript
 * serializeCookie('session', value, sessionOptions());
 * ```
 */
export function sessionOptions(options: CookieOptions = {}): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    sameSite: 'lax',
    path: options.path ?? '/',
    // No maxAge or expires = session cookie
    maxAge: undefined,
    expires: undefined
  };
}

/**
 * Create a __Secure- prefixed cookie.
 *
 * @param name - Cookie name (without prefix)
 * @param value - Cookie value
 * @param options - Cookie options (secure will be forced true)
 * @returns Set-Cookie header value
 *
 * @example
 * ```typescript
 * createSecurePrefixCookie('token', 'abc123', { httpOnly: true });
 * // '__Secure-token=abc123; Secure; HttpOnly'
 * ```
 */
export function createSecurePrefixCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
): string {
  const prefixedName = name.startsWith(COOKIE_PREFIXES.SECURE)
    ? name
    : `${COOKIE_PREFIXES.SECURE}${name}`;

  return serializeCookie(prefixedName, value, {
    ...options,
    secure: true
  });
}

/**
 * Create a __Host- prefixed cookie.
 *
 * Requirements: Secure=true, Path=/, no Domain attribute.
 *
 * @param name - Cookie name (without prefix)
 * @param value - Cookie value
 * @param options - Cookie options
 * @returns Set-Cookie header value
 *
 * @example
 * ```typescript
 * createHostPrefixCookie('session', 'abc123', { httpOnly: true });
 * // '__Host-session=abc123; Secure; Path=/; HttpOnly'
 * ```
 */
export function createHostPrefixCookie(
  name: string,
  value: string,
  options: Omit<CookieOptions, 'domain' | 'path' | 'secure'> = {}
): string {
  const prefixedName = name.startsWith(COOKIE_PREFIXES.HOST)
    ? name
    : `${COOKIE_PREFIXES.HOST}${name}`;

  return serializeCookie(prefixedName, value, {
    ...options,
    secure: true,
    path: '/',
    domain: undefined
  });
}

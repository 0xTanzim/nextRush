/**
 * @nextrush/cookies - Cookie Parsing
 *
 * RFC 6265 compliant cookie parsing with security hardening.
 *
 * @packageDocumentation
 */

import { sanitizeCookieValue } from './validation.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Parsed cookies as key-value pairs.
 */
export type ParsedCookies = Record<string, string>;

/**
 * Cookie parsing options.
 */
export interface ParseOptions {
  /**
   * Decode cookie values.
   * @default true
   */
  decode?: boolean;

  /**
   * Sanitize cookie values (remove control characters).
   * @default true
   */
  sanitize?: boolean;
}

// ============================================================================
// Cookie Parsing
// ============================================================================

/**
 * Parse a Cookie header string into key-value pairs.
 *
 * @param cookieHeader - Cookie header string (e.g., "name=value; name2=value2")
 * @param options - Parsing options
 * @returns Parsed cookies object
 *
 * @example
 * ```typescript
 * const cookies = parseCookies('session=abc123; theme=dark');
 * // { session: 'abc123', theme: 'dark' }
 * ```
 */
export function parseCookies(
  cookieHeader: string | undefined | null,
  options: ParseOptions = {}
): ParsedCookies {
  const { decode = true, sanitize = true } = options;
  const cookies: ParsedCookies = {};

  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return cookies;
  }

  // Split by semicolon and optional whitespace
  const pairs = cookieHeader.split(/;\s*/);

  for (const pair of pairs) {
    if (!pair) continue;

    // Find first = sign (value can contain =)
    const equalIndex = pair.indexOf('=');
    if (equalIndex === -1) continue;

    const name = pair.slice(0, equalIndex).trim();
    let value = pair.slice(equalIndex + 1).trim();

    if (!name) continue;

    // Remove surrounding quotes if present
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    // Decode URL-encoded value
    if (decode) {
      try {
        value = decodeURIComponent(value);
      } catch {
        // Keep original value if decoding fails
      }
    }

    // Sanitize value (remove control characters)
    if (sanitize) {
      value = sanitizeCookieValue(value);
    }

    // First occurrence wins (per RFC 6265)
    if (!(name in cookies)) {
      cookies[name] = value;
    }
  }

  return cookies;
}

/**
 * Get a single cookie value from a Cookie header.
 *
 * @param cookieHeader - Cookie header string
 * @param name - Cookie name to get
 * @param options - Parsing options
 * @returns Cookie value or undefined if not found
 *
 * @example
 * ```typescript
 * const session = getCookie('session=abc123; theme=dark', 'session');
 * // 'abc123'
 * ```
 */
export function getCookie(
  cookieHeader: string | undefined | null,
  name: string,
  options: ParseOptions = {}
): string | undefined {
  const cookies = parseCookies(cookieHeader, options);
  return cookies[name];
}

/**
 * Check if a cookie exists in the Cookie header.
 *
 * @param cookieHeader - Cookie header string
 * @param name - Cookie name to check
 * @returns True if cookie exists
 *
 * @example
 * ```typescript
 * hasCookie('session=abc123', 'session'); // true
 * hasCookie('session=abc123', 'token');   // false
 * ```
 */
export function hasCookie(
  cookieHeader: string | undefined | null,
  name: string
): boolean {
  const cookies = parseCookies(cookieHeader, { decode: false, sanitize: false });
  return name in cookies;
}

/**
 * Get all cookie names from a Cookie header.
 *
 * @param cookieHeader - Cookie header string
 * @returns Array of cookie names
 *
 * @example
 * ```typescript
 * getCookieNames('session=abc; theme=dark');
 * // ['session', 'theme']
 * ```
 */
export function getCookieNames(
  cookieHeader: string | undefined | null
): string[] {
  const cookies = parseCookies(cookieHeader, { decode: false, sanitize: false });
  return Object.keys(cookies);
}

/**
 * @nextrush/cookies - Cookie Utilities
 *
 * Pure functions for parsing and serializing cookies.
 * Based on RFC 6265.
 *
 * @packageDocumentation
 */

import type { CookieOptions, ParsedCookies } from './types';

/**
 * Parse cookie header string into object
 *
 * @param cookieHeader - Cookie header string
 * @param decode - Decode function for values
 * @returns Parsed cookies object
 *
 * @example
 * ```typescript
 * parseCookies('name=value; session=abc123')
 * // { name: 'value', session: 'abc123' }
 * ```
 */
export function parseCookies(
  cookieHeader: string | undefined | null,
  decode: (value: string) => string = decodeURIComponent,
): ParsedCookies {
  const cookies: ParsedCookies = {};

  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return cookies;
  }

  const pairs = cookieHeader.split(';');

  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (!trimmed) continue;

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) continue;

    const name = trimmed.slice(0, equalsIndex).trim();
    if (!name) continue;

    let value = trimmed.slice(equalsIndex + 1).trim();

    // Remove surrounding quotes if present
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    try {
      cookies[name] = decode(value);
    } catch {
      // If decoding fails, use raw value
      cookies[name] = value;
    }
  }

  return cookies;
}

/**
 * Serialize a cookie name-value pair with options
 *
 * @param name - Cookie name
 * @param value - Cookie value
 * @param options - Cookie options
 * @returns Serialized Set-Cookie header value
 *
 * @example
 * ```typescript
 * serializeCookie('session', 'abc123', { httpOnly: true, secure: true })
 * // 'session=abc123; HttpOnly; Secure'
 * ```
 */
export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {},
): string {
  // Validate cookie name (RFC 6265)
  if (!isValidCookieName(name)) {
    throw new TypeError(`Invalid cookie name: "${name}"`);
  }

  // Encode the value
  const encodedValue = encodeURIComponent(value);

  // Start with name=value
  let cookie = `${name}=${encodedValue}`;

  // Domain
  if (options.domain) {
    cookie += `; Domain=${options.domain}`;
  }

  // Expires
  if (options.expires) {
    if (!(options.expires instanceof Date)) {
      throw new TypeError('expires must be a Date object');
    }
    cookie += `; Expires=${options.expires.toUTCString()}`;
  }

  // Max-Age (takes precedence over Expires in modern browsers)
  if (options.maxAge !== undefined) {
    if (!Number.isFinite(options.maxAge) || options.maxAge < 0) {
      throw new TypeError('maxAge must be a non-negative finite number');
    }
    cookie += `; Max-Age=${Math.floor(options.maxAge)}`;
  }

  // Path
  if (options.path) {
    cookie += `; Path=${options.path}`;
  }

  // HttpOnly
  if (options.httpOnly) {
    cookie += '; HttpOnly';
  }

  // Secure
  if (options.secure) {
    cookie += '; Secure';
  }

  // SameSite
  if (options.sameSite !== undefined) {
    const sameSiteValue = normalizeSameSite(options.sameSite);
    if (sameSiteValue) {
      cookie += `; SameSite=${sameSiteValue}`;

      // SameSite=None requires Secure
      if (sameSiteValue === 'None' && !options.secure) {
        throw new TypeError('SameSite=None requires Secure attribute');
      }
    }
  }

  // Priority
  if (options.priority) {
    const priority = options.priority.charAt(0).toUpperCase() + options.priority.slice(1).toLowerCase();
    cookie += `; Priority=${priority}`;
  }

  // Partitioned
  if (options.partitioned) {
    cookie += '; Partitioned';
  }

  return cookie;
}

/**
 * Create a cookie deletion string
 * Sets the cookie to expire in the past
 *
 * @param name - Cookie name to delete
 * @param options - Domain and path options
 * @returns Serialized Set-Cookie header value that deletes the cookie
 */
export function createDeleteCookie(
  name: string,
  options: Pick<CookieOptions, 'domain' | 'path'> = {},
): string {
  return serializeCookie(name, '', {
    ...options,
    expires: new Date(0),
    maxAge: 0,
  });
}

/**
 * Validate cookie name according to RFC 6265
 */
function isValidCookieName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false;
  }

  // RFC 6265: cookie-name is a token
  // token = 1*<any CHAR except CTLs or separators>
  // separators = "(" | ")" | "<" | ">" | "@" | "," | ";" | ":" | "\" | <">
  //            | "/" | "[" | "]" | "?" | "=" | "{" | "}" | SP | HT
  const invalidChars = /[\x00-\x1F\x7F\s"(),/:;<=>?@[\\\]{}]/;
  return !invalidChars.test(name);
}

/**
 * Normalize SameSite value
 */
function normalizeSameSite(sameSite: 'strict' | 'lax' | 'none' | boolean): string | null {
  if (sameSite === true) {
    return 'Strict';
  }

  if (sameSite === false) {
    return null;
  }

  switch (sameSite) {
    case 'strict':
      return 'Strict';
    case 'lax':
      return 'Lax';
    case 'none':
      return 'None';
    default:
      return null;
  }
}

/**
 * Sign a cookie value with HMAC-SHA256
 *
 * @param value - Value to sign
 * @param secret - Secret key
 * @returns Signed value in format: value.signature
 */
export async function signCookie(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const valueData = encoder.encode(value);

  // Import key for HMAC-SHA256
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

  // Sign the value
  const signature = await crypto.subtle.sign('HMAC', key, valueData);

  // Encode signature as base64url
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${value}.${signatureBase64}`;
}

/**
 * Verify and extract a signed cookie value
 *
 * @param signedValue - Signed value in format: value.signature
 * @param secret - Secret key
 * @returns Original value if valid, undefined if invalid
 */
export async function unsignCookie(signedValue: string, secret: string): Promise<string | undefined> {
  const lastDotIndex = signedValue.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return undefined;
  }

  const value = signedValue.slice(0, lastDotIndex);
  const expectedSigned = await signCookie(value, secret);

  // Constant-time comparison to prevent timing attacks
  if (timingSafeEqual(signedValue, expectedSigned)) {
    return value;
  }

  return undefined;
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

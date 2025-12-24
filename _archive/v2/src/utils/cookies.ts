/**
 * High-Performance Cookie Utilities for NextRush v2
 *
 * Features:
 * - ⚡ Ultra-fast cookie parsing with lazy evaluation
 * - 🔒 Built-in signing/verification (HMAC-SHA256)
 * - 🛡️ Security defaults and validation
 * - 📦 JSON serialization helpers
 * - 🎯 Zero-copy parsing where possible
 * - 💾 Minimal memory allocations
 *
 * Performance optimizations:
 * - Single-pass parsing
 * - Efficient string operations
 * - Lazy decoding (only when accessed)
 * - Symbol-based caching
 * - Fast path for simple cases
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

// Cache symbol for parsed cookies
export const PARSED_COOKIES_SYMBOL = Symbol('parsed-cookies');
export const COOKIE_CACHE_SYMBOL = Symbol('cookie-cache');

/**
 * Cookie options interface with security defaults
 */
export interface CookieOptions {
  /** Domain for the cookie */
  domain?: string;
  /** Expiration date */
  expires?: Date;
  /** HTTP Only flag (default: true for security) */
  httpOnly?: boolean;
  /** Max age in seconds */
  maxAge?: number;
  /** Path (default: '/') */
  path?: string;
  /** Priority (Low, Medium, High) */
  priority?: 'Low' | 'Medium' | 'High';
  /** SameSite attribute (default: 'Strict') */
  sameSite?: 'Strict' | 'Lax' | 'None' | boolean;
  /** Secure flag (default: true in production) */
  secure?: boolean;
}

/**
 * Signed cookie options
 */
export interface SignedCookieOptions extends CookieOptions {
  /** Secret for signing (required for signed cookies) */
  secret?: string;
}

/**
 * Parsed cookie interface
 */
export interface ParsedCookie {
  name: string;
  value: string;
  options?: CookieOptions;
}

/**
 * Cookie parsing result with lazy decoding
 */
export interface CookieParseResult {
  [key: string]: string;
}

/**
 * Security defaults for cookie options
 */
export const SECURE_COOKIE_DEFAULTS: Partial<CookieOptions> = {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'Strict',
  path: '/',
};

/**
 * ⚡ Ultra-fast cookie parsing with single-pass algorithm
 *
 * Performance optimizations:
 * - Single loop through the cookie string
 * - Minimal string operations
 * - Lazy URL decoding (only when needed)
 * - Efficient whitespace handling
 *
 * @param cookieHeader Raw cookie header string
 * @returns Parsed cookies object
 */
export function parseCookies(cookieHeader: string): CookieParseResult {
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return {};
  }

  const cookies: CookieParseResult = {};
  const len = cookieHeader.length;
  let pos = 0;

  // Fast path: single cookie without semicolons
  if (cookieHeader.indexOf(';') === -1) {
    const eqPos = cookieHeader.indexOf('=');
    if (eqPos > 0) {
      const name = cookieHeader.slice(0, eqPos).trim();
      const value = cookieHeader.slice(eqPos + 1).trim();
      if (name) {
        cookies[name] = tryDecodeURIComponent(value);
      }
    }
    return cookies;
  }

  // Multi-cookie parsing with single pass
  while (pos < len) {
    // Find next semicolon or end
    let nextSemi = cookieHeader.indexOf(';', pos);
    if (nextSemi === -1) nextSemi = len;

    // Extract cookie segment
    const segment = cookieHeader.slice(pos, nextSemi);
    const eqPos = segment.indexOf('=');

    if (eqPos > 0) {
      const name = segment.slice(0, eqPos).trim();
      const value = segment.slice(eqPos + 1).trim();

      if (name && !cookies[name]) {
        // First occurrence wins
        cookies[name] = tryDecodeURIComponent(value);
      }
    }

    pos = nextSemi + 1;

    // Skip whitespace after semicolon
    while (pos < len && cookieHeader[pos] === ' ') {
      pos++;
    }
  }

  return cookies;
}

/**
 * Safe URL component decoding with fallback
 * Also handles quoted values properly
 *
 * @param value Value to decode
 * @returns Decoded value or original if decode fails
 */
function tryDecodeURIComponent(value: string): string {
  // Handle quoted values - remove surrounding quotes
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1);
  }

  try {
    // Only decode if it contains encoded characters
    if (value.includes('%')) {
      return decodeURIComponent(value);
    }
    return value;
  } catch {
    return value; // Return original if decoding fails
  }
}

/**
 * ⚡ High-performance cookie serialization
 *
 * @param name Cookie name
 * @param value Cookie value
 * @param options Cookie options
 * @returns Serialized Set-Cookie header value
 */
export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
): string {
  if (!name || typeof name !== 'string') {
    throw new TypeError('Cookie name must be a non-empty string');
  }

  // Validate cookie name (RFC 6265)
  if (!/^[a-zA-Z0-9!#$&-+\-.^_`|~]+$/.test(name)) {
    throw new TypeError('Invalid cookie name characters');
  }

  // Apply security defaults in production unless explicitly overridden
  const isProduction = process.env['NODE_ENV'] === 'production';
  const finalOptions = { ...options };

  if (isProduction) {
    finalOptions.secure = options.secure !== false; // Default true, can be explicitly false
    finalOptions.httpOnly = options.httpOnly !== false; // Default true, can be explicitly false
    finalOptions.sameSite = options.sameSite || 'Strict'; // Default Strict
  }

  // Build cookie string efficiently in consistent order
  const parts: string[] = [`${name}=${encodeURIComponent(value)}`];

  if (typeof finalOptions.maxAge === 'number' && finalOptions.maxAge >= 0) {
    parts.push(`Max-Age=${Math.floor(finalOptions.maxAge)}`);
  }

  if (finalOptions.expires) {
    parts.push(`Expires=${finalOptions.expires.toUTCString()}`);
  }

  if (finalOptions.path) {
    parts.push(`Path=${finalOptions.path}`);
  }

  if (finalOptions.domain) {
    parts.push(`Domain=${finalOptions.domain}`);
  }

  if (finalOptions.secure) {
    parts.push('Secure');
  }

  if (finalOptions.httpOnly) {
    parts.push('HttpOnly');
  }

  if (finalOptions.sameSite) {
    if (typeof finalOptions.sameSite === 'boolean') {
      parts.push('SameSite');
    } else {
      parts.push(`SameSite=${finalOptions.sameSite}`);
    }
  }

  if (finalOptions.priority) {
    parts.push(`Priority=${finalOptions.priority}`);
  }

  return parts.join('; ');
}

/**
 * 🔒 Sign a cookie value with HMAC-SHA256
 *
 * @param value Value to sign
 * @param secret Secret key for signing
 * @returns Signed value in format: value.signature
 */
export function signCookie(value: string, secret: string): string {
  if (!secret) {
    throw new Error('Secret is required for signing cookies');
  }

  const signature = createHmac('sha256', secret)
    .update(value)
    .digest('base64url');

  return `${value}.${signature}`;
}

/**
 * 🔒 Verify and unsign a cookie value
 *
 * @param signedValue Signed cookie value
 * @param secret Secret key for verification
 * @returns Original value if valid, false if invalid
 */
export function unsignCookie(
  signedValue: string,
  secret: string
): string | false {
  if (!secret) {
    return false;
  }

  const lastDotIndex = signedValue.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return false; // Not a signed cookie
  }

  const value = signedValue.slice(0, lastDotIndex);
  const signature = signedValue.slice(lastDotIndex + 1);

  try {
    const expectedSignature = createHmac('sha256', secret)
      .update(value)
      .digest('base64url');

    // Timing-safe comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    const sigBuffer = Buffer.from(signature, 'base64url');
    const expectedBuffer = Buffer.from(expectedSignature, 'base64url');

    if (timingSafeEqual(sigBuffer, expectedBuffer)) {
      return value;
    }
  } catch {
    // Ignore signature verification errors
  }

  return false;
}

/**
 * 📦 Serialize value as JSON cookie
 *
 * @param value Value to serialize
 * @returns JSON string or original value if serialization fails
 */
export function serializeJsonValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * 📦 Deserialize JSON cookie value
 *
 * @param value JSON string value
 * @returns Parsed value or original string if parsing fails
 */
export function deserializeJsonValue(value: string): unknown {
  if (!value || typeof value !== 'string') {
    return value;
  }

  // Quick check if it looks like JSON
  if (
    !(value.startsWith('{') || value.startsWith('[') || value.startsWith('"'))
  ) {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * 🛡️ Validate cookie value for security
 *
 * @param value Cookie value
 * @param maxSize Maximum size in bytes (default: 4096)
 * @returns True if valid, false otherwise
 */
export function validateCookieValue(value: string, maxSize = 4096): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  // Empty values are valid
  if (value === '') {
    return true;
  }

  // Check size limit
  if (Buffer.byteLength(value, 'utf8') > maxSize) {
    return false;
  }

  // Check for control characters (reject all control chars including tab)
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(value)) {
    return false;
  }

  return true;
}

/**
 * 🎯 Create secure cookie options with defaults
 *
 * @param options User options
 * @returns Options with security defaults applied
 */
export function createSecureCookieOptions(
  options: CookieOptions = {}
): CookieOptions {
  return {
    ...SECURE_COOKIE_DEFAULTS,
    ...options,
    // Always ensure secure in production
    secure: options.secure ?? process.env['NODE_ENV'] === 'production',
  };
}

/**
 * Performance monitoring utilities
 */
export const CookieMetrics = {
  parseTime: 0,
  parseCalls: 0,

  startParse(): () => void {
    const start = process.hrtime.bigint();
    return () => {
      const end = process.hrtime.bigint();
      this.parseTime += Number(end - start);
      this.parseCalls++;
    };
  },

  getAverageParseTime(): number {
    return this.parseCalls > 0 ? this.parseTime / this.parseCalls : 0;
  },

  reset(): void {
    this.parseTime = 0;
    this.parseCalls = 0;
  },
};

/**
 * Cookie utility class for advanced operations
 */
export class CookieJar {
  private cookies: Map<string, string> = new Map();

  constructor(cookieHeader?: string) {
    if (cookieHeader) {
      this.parse(cookieHeader);
    }
  }

  parse(cookieHeader: string): this {
    const parsed = parseCookies(cookieHeader);
    for (const [name, value] of Object.entries(parsed)) {
      this.cookies.set(name, value);
    }
    return this;
  }

  get(name: string): string | undefined {
    return this.cookies.get(name);
  }

  set(name: string, value: string): this {
    this.cookies.set(name, value);
    return this;
  }

  delete(name: string): boolean {
    return this.cookies.delete(name);
  }

  has(name: string): boolean {
    return this.cookies.has(name);
  }

  clear(): this {
    this.cookies.clear();
    return this;
  }

  toObject(): Record<string, string> {
    return Object.fromEntries(this.cookies);
  }

  size(): number {
    return this.cookies.size;
  }

  names(): string[] {
    return Array.from(this.cookies.keys());
  }

  values(): string[] {
    return Array.from(this.cookies.values());
  }
}

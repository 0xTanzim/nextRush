/**
 * @nextrush/cookies - Constants
 *
 * Default values and configuration constants.
 *
 * @packageDocumentation
 */

import type { CookieOptions } from './types.js';

// ============================================================================
// Cookie Name Validation
// ============================================================================

/**
 * Invalid characters for cookie names per RFC 6265.
 * token = 1*<any CHAR except CTLs or separators>
 * separators = "(" | ")" | "<" | ">" | "@" | "," | ";" | ":" | "\" | <"> | "/" | "[" | "]" | "?" | "=" | "{" | "}" | SP | HT
 */
export const INVALID_NAME_CHARS = /[\x00-\x1F\x7F\s"(),/:;<=>?@[\\\]{}]/;

/**
 * Control characters and CRLF for header injection prevention.
 */
export const CRLF_CHARS = /[\r\n]/;

/**
 * Characters that need encoding in cookie values.
 */
export const CHARS_TO_ENCODE = /[,;\s"\\]/;

/**
 * Dangerous patterns for security validation.
 */
export const DANGEROUS_PATTERNS = {
  CRLF: /\r\n|\r|\n/,
  CRLF_ENCODED: /%0[dD]%0[aA]|%0[dD]|%0[aA]/,
  CONTROL_CHARS: /[\x00-\x1F\x7F]/,
  NULL_BYTE: /\x00/,
} as const;

// ============================================================================
// Cookie Prefixes (Security)
// ============================================================================

/**
 * __Secure- prefix requirements:
 * - Must be set with Secure flag
 * - Must be set over HTTPS
 */
export const SECURE_PREFIX = '__Secure-';

/**
 * __Host- prefix requirements:
 * - Must be set with Secure flag
 * - Must not have Domain attribute
 * - Path must be "/"
 */
export const HOST_PREFIX = '__Host-';

/**
 * Cookie prefix constants.
 */
export const COOKIE_PREFIXES = {
  SECURE: SECURE_PREFIX,
  HOST: HOST_PREFIX,
} as const;

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default path for cookies.
 */
export const DEFAULT_PATH = '/';

/**
 * Default SameSite value.
 */
export const DEFAULT_SAME_SITE = 'lax';

/**
 * Maximum cookie name length.
 */
export const MAX_NAME_LENGTH = 256;

/**
 * Maximum cookie value length.
 */
export const MAX_VALUE_LENGTH = 4096;

/**
 * Maximum total cookie size (name + value + attributes).
 */
export const MAX_COOKIE_SIZE = 4096;

/**
 * Maximum number of cookies per domain.
 */
export const MAX_COOKIES_PER_DOMAIN = 50;

// ============================================================================
// Security Defaults
// ============================================================================

/**
 * Default options for secure session cookies.
 */
export const SECURE_DEFAULTS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/',
} as const;

/**
 * Default options for session cookies (browser session).
 */
export const SESSION_DEFAULTS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
} as const;

/**
 * Default cookie options (secure by default).
 */
export const DEFAULT_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
} as const;

// ============================================================================
// Common Public Suffixes
// ============================================================================

/**
 * Common public suffixes for domain validation.
 * @see https://publicsuffix.org/
 */
export const COMMON_PUBLIC_SUFFIXES = new Set([
  'com', 'org', 'net', 'edu', 'gov', 'mil',
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk',
  'com.au', 'net.au', 'org.au',
  'co.nz', 'net.nz', 'org.nz',
  'co.jp', 'ne.jp', 'or.jp',
  'com.cn', 'net.cn', 'org.cn',
  'com.br', 'net.br', 'org.br',
  'de', 'fr', 'it', 'es', 'ru', 'cn', 'jp', 'kr', 'uk', 'au', 'ca',
]);

// ============================================================================
// HMAC Configuration
// ============================================================================

/**
 * HMAC algorithm for cookie signing.
 */
export const HMAC_ALGORITHM = 'HMAC';

/**
 * Hash algorithm for HMAC.
 */
export const HASH_ALGORITHM = 'SHA-256';

/**
 * Signature separator in signed cookies.
 */
export const SIGNATURE_SEPARATOR = '.';

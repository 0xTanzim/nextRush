/**
 * @nextrush/cookies - Validation Utilities
 *
 * Security-focused validation for cookie names and values, plus the
 * whole-cookie aggregator and sanitization helpers. Domain validation
 * (`domain-validation.ts`), prefix validation (`prefix-validation.ts`), and
 * the throwing options validator (`options-validation.ts`) are split out to
 * keep this file under the file-size ceiling.
 *
 * @packageDocumentation
 */

import {
  CRLF_CHARS,
  INVALID_NAME_CHARS,
  MAX_COOKIE_SIZE,
  MAX_NAME_LENGTH,
  MAX_VALUE_LENGTH,
} from './constants.js';
import { validateDomain } from './domain-validation.js';
import { validatePath } from './path-validation.js';
import { validatePrefixes } from './prefix-validation.js';
import type { CookieOptions } from './types.js';

export { isPublicSuffix, isValidDomain, resetUnrecognizedSuffixWarning, validateDomain } from './domain-validation.js';
export type { PublicSuffixOptions } from './domain-validation.js';
export { isValidPath, validatePath } from './path-validation.js';
export {
  validateCookiePrefix,
  validateHostPrefix,
  validatePrefixes,
  validateSecurePrefix,
} from './prefix-validation.js';
export { validateCookieOptions } from './options-validation.js';

// ============================================================================
// Types
// ============================================================================

/** Validation result with optional errors. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ============================================================================
// Security Error
// ============================================================================

/** Error thrown for security-related cookie issues. */
export class SecurityError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
  }
}

// ============================================================================
// Cookie Name Validation
// ============================================================================

/**
 * Validate cookie name according to RFC 6265.
 *
 * @security Prevents CRLF header injection, invalid token characters, empty
 * names, and excessive length.
 */
export function validateCookieName(name: string): ValidationResult {
  const errors: string[] = [];

  if (!name || typeof name !== 'string') {
    errors.push('Cookie name must be a non-empty string');
    return { valid: false, errors };
  }

  if (name.length > MAX_NAME_LENGTH) {
    errors.push(`Cookie name exceeds maximum length of ${String(MAX_NAME_LENGTH)}`);
  }

  if (INVALID_NAME_CHARS.test(name)) {
    errors.push('Cookie name contains invalid characters (CTLs or separators)');
  }

  if (CRLF_CHARS.test(name)) {
    errors.push('Cookie name contains CRLF characters (potential header injection)');
  }

  return { valid: errors.length === 0, errors };
}

/** Check if cookie name is valid (simple boolean check). */
export function isValidCookieName(name: string): boolean {
  return validateCookieName(name).valid;
}

// ============================================================================
// Cookie Value Validation
// ============================================================================

/**
 * Validate cookie value.
 *
 * @security Prevents CRLF header injection and excessive length (DoS).
 */
export function validateCookieValue(value: string): ValidationResult {
  const errors: string[] = [];

  if (typeof value !== 'string') {
    errors.push('Cookie value must be a string');
    return { valid: false, errors };
  }

  if (value.length > MAX_VALUE_LENGTH) {
    errors.push(`Cookie value exceeds maximum length of ${String(MAX_VALUE_LENGTH)}`);
  }

  if (CRLF_CHARS.test(value)) {
    errors.push('Cookie value contains CRLF characters (potential header injection)');
  }

  return { valid: errors.length === 0, errors };
}

/** Check if cookie value is valid (simple boolean check). */
export function isValidCookieValue(value: string): boolean {
  return validateCookieValue(value).valid;
}

// ============================================================================
// Options Validation
// ============================================================================

/**
 * Validate SameSite and Secure combination.
 *
 * @security SameSite=None requires the Secure attribute to be genuinely
 * resolved to `true` — an unresolved `secure: 'auto'` does not satisfy
 * this, since it may still resolve to `false` for the actual request
 * (SEC-08). See {@link resolveSecureOption} in `secure-resolution.ts`.
 */
export function validateSameSiteSecure(options: CookieOptions): ValidationResult {
  const errors: string[] = [];

  if (options.sameSite === 'none' && options.secure !== true) {
    errors.push('SameSite=None requires the Secure attribute');
  }

  return { valid: errors.length === 0, errors };
}

/** Validate maxAge value. */
export function validateMaxAge(maxAge: number | undefined): ValidationResult {
  const errors: string[] = [];

  if (maxAge === undefined) {
    return { valid: true, errors: [] };
  }

  if (!Number.isFinite(maxAge)) {
    errors.push('maxAge must be a finite number');
  }

  if (maxAge < 0) {
    errors.push('maxAge must be non-negative');
  }

  return { valid: errors.length === 0, errors };
}

/** Validate expires date. */
export function validateExpires(expires: Date | number | undefined): ValidationResult {
  const errors: string[] = [];

  if (expires === undefined) {
    return { valid: true, errors: [] };
  }

  if (typeof expires === 'number') {
    if (!Number.isFinite(expires)) {
      errors.push('expires must be a valid timestamp');
    }
  } else if (!(expires instanceof Date)) {
    errors.push('expires must be a Date object or timestamp');
  } else if (isNaN(expires.getTime())) {
    errors.push('expires must be a valid Date');
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Complete Cookie Validation
// ============================================================================

/** Validate a complete cookie (name, value, options). */
export function validateCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
): ValidationResult {
  const allErrors: string[] = [];

  allErrors.push(...validateCookieName(name).errors);
  allErrors.push(...validateCookieValue(value).errors);
  allErrors.push(...validatePrefixes(name, options).errors);

  if (options.domain) {
    allErrors.push(...validateDomain(options.domain).errors);
  }

  if (options.path) {
    allErrors.push(...validatePath(options.path).errors);
  }

  allErrors.push(...validateSameSiteSecure(options).errors);
  allErrors.push(...validateMaxAge(options.maxAge).errors);
  allErrors.push(...validateExpires(options.expires).errors);

  const estimatedSize = name.length + value.length + 100; // ~100 for attributes
  if (estimatedSize > MAX_COOKIE_SIZE) {
    allErrors.push(`Cookie exceeds maximum size of ${String(MAX_COOKIE_SIZE)} bytes`);
  }

  return { valid: allErrors.length === 0, errors: allErrors };
}

// ============================================================================
// Sanitization
// ============================================================================

/**
 * Sanitize a string by removing CRLF characters.
 * Use for logging/error messages, NOT for cookie values.
 */
export function sanitizeForLogging(value: string): string {
  return value.replace(CRLF_CHARS, '');
}

/**
 * Sanitize a cookie value by removing dangerous characters: CRLF sequences,
 * URL-encoded CRLF, and control characters (0x00-0x1F, 0x7F).
 */
export function sanitizeCookieValue(value: string): string {
  if (!value || typeof value !== 'string') {
    return '';
  }

  return value
    .replace(/\r\n|\r|\n/g, '')
    .replace(/%0[dD]%0[aA]|%0[dD]|%0[aA]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, '');
}

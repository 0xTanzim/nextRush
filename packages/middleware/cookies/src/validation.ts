/**
 * @nextrush/cookies - Validation Utilities
 *
 * Security-focused validation for cookie names, values, and attributes.
 * Implements OWASP recommendations and RFC 6265 compliance.
 *
 * @packageDocumentation
 */

import {
  COMMON_PUBLIC_SUFFIXES,
  CRLF_CHARS,
  HOST_PREFIX,
  INVALID_NAME_CHARS,
  MAX_COOKIE_SIZE,
  MAX_NAME_LENGTH,
  MAX_VALUE_LENGTH,
  SECURE_PREFIX,
} from './constants.js';
import type { CookieOptions } from './types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Validation result with optional errors.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ============================================================================
// Security Error
// ============================================================================

/**
 * Error thrown for security-related cookie issues.
 */
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
 * @param name - Cookie name to validate
 * @returns Validation result with errors if invalid
 *
 * @security Prevents:
 * - HTTP header injection via CRLF
 * - Invalid token characters
 * - Empty names
 * - Excessive length
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

/**
 * Check if cookie name is valid (simple boolean check).
 */
export function isValidCookieName(name: string): boolean {
  return validateCookieName(name).valid;
}

// ============================================================================
// Cookie Value Validation
// ============================================================================

/**
 * Validate cookie value.
 *
 * @param value - Cookie value to validate
 * @returns Validation result with errors if invalid
 *
 * @security Prevents:
 * - HTTP header injection via CRLF
 * - Excessive length (DoS)
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

/**
 * Check if cookie value is valid (simple boolean check).
 */
export function isValidCookieValue(value: string): boolean {
  return validateCookieValue(value).valid;
}

// ============================================================================
// Cookie Prefix Validation
// ============================================================================

/**
 * Validate __Secure- prefix requirements.
 *
 * @param name - Cookie name
 * @param options - Cookie options
 * @returns Validation result
 *
 * @security __Secure- cookies must:
 * - Be set with Secure flag
 */
export function validateSecurePrefix(name: string, options: CookieOptions): ValidationResult {
  const errors: string[] = [];

  if (name.startsWith(SECURE_PREFIX)) {
    if (!options.secure) {
      errors.push(`Cookie with ${SECURE_PREFIX} prefix must have Secure attribute`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate __Host- prefix requirements.
 *
 * @param name - Cookie name
 * @param options - Cookie options
 * @returns Validation result
 *
 * @security __Host- cookies must:
 * - Be set with Secure flag
 * - NOT have Domain attribute
 * - Have Path set to "/"
 */
export function validateHostPrefix(name: string, options: CookieOptions): ValidationResult {
  const errors: string[] = [];

  if (name.startsWith(HOST_PREFIX)) {
    if (!options.secure) {
      errors.push(`Cookie with ${HOST_PREFIX} prefix must have Secure attribute`);
    }
    if (options.domain) {
      errors.push(`Cookie with ${HOST_PREFIX} prefix must not have Domain attribute`);
    }
    if (options.path && options.path !== '/') {
      errors.push(`Cookie with ${HOST_PREFIX} prefix must have Path set to "/"`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate all cookie prefix requirements.
 */
export function validatePrefixes(name: string, options: CookieOptions): ValidationResult {
  const secureResult = validateSecurePrefix(name, options);
  const hostResult = validateHostPrefix(name, options);

  return {
    valid: secureResult.valid && hostResult.valid,
    errors: [...secureResult.errors, ...hostResult.errors],
  };
}

// ============================================================================
// Domain Validation
// ============================================================================

/**
 * Validate domain attribute.
 *
 * @param domain - Domain value to validate
 * @returns Validation result
 *
 * @security Prevents:
 * - Public suffix domain attacks (setting cookies on .com)
 * - CRLF injection
 * - Invalid domain formats
 */
export function validateDomain(domain: string): ValidationResult {
  const errors: string[] = [];

  if (!domain) {
    return { valid: true, errors: [] };
  }

  if (CRLF_CHARS.test(domain)) {
    errors.push('Domain contains CRLF characters (potential header injection)');
    return { valid: false, errors };
  }

  // Remove leading dot if present (RFC 6265)
  const normalizedDomain = domain.startsWith('.') ? domain.slice(1) : domain;

  // Check for public suffix
  const parts = normalizedDomain.toLowerCase().split('.');
  const suffix = parts.slice(-2).join('.');
  const tld = parts[parts.length - 1];

  if (tld && COMMON_PUBLIC_SUFFIXES.has(tld) && parts.length <= 1) {
    errors.push(`Domain "${domain}" appears to be a public suffix`);
  }

  if (suffix && COMMON_PUBLIC_SUFFIXES.has(suffix) && parts.length <= 2) {
    errors.push(`Domain "${domain}" appears to be a public suffix`);
  }

  // Basic domain format validation
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/.test(normalizedDomain) &&
    normalizedDomain.length > 1
  ) {
    errors.push('Domain has invalid format');
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Path Validation
// ============================================================================

/**
 * Validate path attribute.
 *
 * @param path - Path value to validate
 * @returns Validation result
 *
 * @security Prevents:
 * - CRLF injection
 * - Path traversal patterns
 */
export function validatePath(path: string): ValidationResult {
  const errors: string[] = [];

  if (!path) {
    return { valid: true, errors: [] };
  }

  if (CRLF_CHARS.test(path)) {
    errors.push('Path contains CRLF characters (potential header injection)');
  }

  // Path must start with /
  if (!path.startsWith('/')) {
    errors.push('Path must start with "/"');
  }

  // Check for dangerous patterns
  if (path.includes('\0')) {
    errors.push('Path contains null byte');
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Options Validation
// ============================================================================

/**
 * Validate SameSite and Secure combination.
 *
 * @param options - Cookie options
 * @returns Validation result
 *
 * @security SameSite=None requires Secure flag.
 */
export function validateSameSiteSecure(options: CookieOptions): ValidationResult {
  const errors: string[] = [];

  if (options.sameSite === 'none' && !options.secure) {
    errors.push('SameSite=None requires the Secure attribute');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate maxAge value.
 */
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

/**
 * Validate expires date.
 */
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

/**
 * Validate a complete cookie (name, value, options).
 *
 * @param name - Cookie name
 * @param value - Cookie value
 * @param options - Cookie options
 * @returns Validation result with all errors
 */
export function validateCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
): ValidationResult {
  const allErrors: string[] = [];

  // Validate name
  const nameResult = validateCookieName(name);
  allErrors.push(...nameResult.errors);

  // Validate value
  const valueResult = validateCookieValue(value);
  allErrors.push(...valueResult.errors);

  // Validate prefixes
  const prefixResult = validatePrefixes(name, options);
  allErrors.push(...prefixResult.errors);

  // Validate domain
  if (options.domain) {
    const domainResult = validateDomain(options.domain);
    allErrors.push(...domainResult.errors);
  }

  // Validate path
  if (options.path) {
    const pathResult = validatePath(options.path);
    allErrors.push(...pathResult.errors);
  }

  // Validate SameSite/Secure
  const sameSiteResult = validateSameSiteSecure(options);
  allErrors.push(...sameSiteResult.errors);

  // Validate maxAge
  const maxAgeResult = validateMaxAge(options.maxAge);
  allErrors.push(...maxAgeResult.errors);

  // Validate expires
  const expiresResult = validateExpires(options.expires);
  allErrors.push(...expiresResult.errors);

  // Check total size
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
 * Sanitize a cookie value by removing dangerous characters.
 *
 * Removes:
 * - CRLF sequences (\r\n, \r, \n)
 * - URL-encoded CRLF (%0d, %0a, %0D, %0A)
 * - Control characters (0x00-0x1F, 0x7F)
 *
 * @param value - Value to sanitize
 * @returns Sanitized value
 */
export function sanitizeCookieValue(value: string): string {
  if (!value || typeof value !== 'string') {
    return '';
  }

  return (
    value
      // Remove CRLF sequences
      .replace(/\r\n|\r|\n/g, '')
      // Remove URL-encoded CRLF (case insensitive)
      .replace(/%0[dD]%0[aA]|%0[dD]|%0[aA]/g, '')
      // Remove control characters (0x00-0x1F and 0x7F)
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F\x7F]/g, '')
  );
}

// ============================================================================
// Domain Validation Helpers
// ============================================================================

/**
 * Check if a domain is a public suffix.
 *
 * @param domain - Domain to check (with or without leading dot)
 * @returns True if domain is a known public suffix
 */
export function isPublicSuffix(domain: string): boolean {
  if (!domain) return false;

  const normalized = domain.startsWith('.') ? domain.slice(1) : domain;
  const lower = normalized.toLowerCase();

  // Check exact match
  if (COMMON_PUBLIC_SUFFIXES.has(lower)) {
    return true;
  }

  // Check if it's just a TLD
  const parts = lower.split('.');
  if (parts.length === 1 && COMMON_PUBLIC_SUFFIXES.has(parts[0] ?? '')) {
    return true;
  }

  // Check compound suffixes (co.uk, com.au)
  if (parts.length === 2) {
    const suffix = parts.join('.');
    if (COMMON_PUBLIC_SUFFIXES.has(suffix)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a domain is valid.
 *
 * @param domain - Domain to validate
 * @returns True if domain format is valid
 */
export function isValidDomain(domain: string): boolean {
  if (!domain || typeof domain !== 'string') {
    return false;
  }

  // Check for CRLF
  if (CRLF_CHARS.test(domain)) {
    return false;
  }

  // Check for dangerous characters
  if (/[;\s,<>]/.test(domain)) {
    return false;
  }

  // Remove leading dot
  const normalized = domain.startsWith('.') ? domain.slice(1) : domain;

  // Empty after normalization
  if (!normalized || normalized === '.') {
    return false;
  }

  // Basic domain format validation
  // Allow single-label domains (localhost)
  if (normalized.length === 1) {
    return /^[a-zA-Z0-9]$/.test(normalized);
  }

  // Multi-character domains
  return (
    /^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/.test(normalized) &&
    !normalized.includes('..') &&
    !/-\.|\.-/.test(normalized)
  );
}

// ============================================================================
// Path Validation Helpers
// ============================================================================

/**
 * Check if a path is valid.
 *
 * @param path - Path to validate
 * @returns True if path is valid
 */
export function isValidPath(path: string): boolean {
  if (!path || typeof path !== 'string') {
    return false;
  }

  // Must start with /
  if (!path.startsWith('/')) {
    return false;
  }

  // Check for CRLF
  if (CRLF_CHARS.test(path)) {
    return false;
  }

  // Check for path traversal
  if (path.includes('..') || /%2e%2e|%2e\.|\.%2e/i.test(path)) {
    return false;
  }

  // Check for dangerous characters
  if (/[;\s<>]/.test(path)) {
    return false;
  }

  // Check for encoded traversal
  if (/%5c/i.test(path)) {
    return false;
  }

  return true;
}

// ============================================================================
// Cookie Prefix Validation (Throwing Version)
// ============================================================================

/**
 * Validate cookie prefix requirements and throw on failure.
 *
 * @param name - Cookie name
 * @param options - Cookie options
 * @throws {SecurityError} If prefix requirements not met
 */
export function validateCookiePrefix(name: string, options: CookieOptions): void {
  if (name.startsWith(SECURE_PREFIX)) {
    if (!options.secure) {
      throw new SecurityError(
        `Cookie with ${SECURE_PREFIX} prefix must have Secure attribute`,
        'PREFIX_REQUIRES_SECURE'
      );
    }
  }

  if (name.startsWith(HOST_PREFIX)) {
    if (!options.secure) {
      throw new SecurityError(
        `Cookie with ${HOST_PREFIX} prefix must have Secure attribute`,
        'PREFIX_REQUIRES_SECURE'
      );
    }
    if (options.domain) {
      throw new SecurityError(
        `Cookie with ${HOST_PREFIX} prefix must not have Domain attribute`,
        'PREFIX_NO_DOMAIN'
      );
    }
    if (options.path !== '/') {
      throw new SecurityError(
        `Cookie with ${HOST_PREFIX} prefix must have Path set to "/"`,
        'PREFIX_REQUIRES_ROOT_PATH'
      );
    }
  }
}

// ============================================================================
// Cookie Options Validation (Throwing Version)
// ============================================================================

/**
 * Validate cookie options and throw on failure.
 *
 * @param options - Cookie options
 * @throws {SecurityError} If options are invalid
 */
export function validateCookieOptions(options: CookieOptions): void {
  // Validate domain
  if (options.domain) {
    if (isPublicSuffix(options.domain)) {
      throw new SecurityError(
        `Domain "${options.domain}" is a public suffix`,
        'PUBLIC_SUFFIX_DOMAIN'
      );
    }
    if (!isValidDomain(options.domain)) {
      throw new SecurityError(`Invalid domain format: "${options.domain}"`, 'INVALID_DOMAIN');
    }
  }

  // Validate path
  if (options.path && !isValidPath(options.path)) {
    throw new SecurityError(`Invalid path: "${options.path}"`, 'INVALID_PATH');
  }

  // SameSite=None requires Secure
  if (options.sameSite === 'none' && !options.secure) {
    throw new SecurityError(
      'SameSite=None requires the Secure attribute',
      'SAMESITE_NONE_REQUIRES_SECURE'
    );
  }
}

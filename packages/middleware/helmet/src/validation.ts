/**
 * @nextrush/helmet - Input validation
 *
 * Security-focused validation utilities to prevent header injection
 * and other security vulnerabilities.
 *
 * @packageDocumentation
 */

import {
    BOOLEAN_CSP_DIRECTIVES,
    CSP_FORBIDDEN_CHARS,
    HASH_PATTERN,
    MIN_HSTS_PRELOAD_MAX_AGE,
    NONCE_PATTERN,
    UNSAFE_CSP_VALUES,
    VALID_CSP_DIRECTIVES,
} from './constants.js';
import type { CspDirectiveName, StrictTransportSecurityOptions } from './types.js';

// ============================================================================
// Header Injection Prevention
// ============================================================================

/**
 * Sanitize a header value to prevent header injection attacks.
 *
 * @param value - Value to sanitize
 * @returns Sanitized value
 * @throws Error if value contains newlines
 *
 * @security Prevents HTTP response splitting attacks by rejecting
 * values containing CR, LF, or other control characters.
 */
export function sanitizeHeaderValue(value: string): string {
  // Reject any value with newlines or carriage returns (header injection)
  if (/[\r\n]/.test(value)) {
    throw new Error(
      `[@nextrush/helmet] Security Error: Header value contains newline characters. ` +
        `This could allow HTTP response splitting attacks.`
    );
  }

  // Trim whitespace
  return value.trim();
}

/**
 * Check if a string contains forbidden CSP characters.
 *
 * @param value - Value to check
 * @returns True if value is safe
 */
export function isCspValueSafe(value: string): boolean {
  return !CSP_FORBIDDEN_CHARS.test(value);
}

/**
 * Sanitize a CSP directive value.
 *
 * @param value - Value to sanitize
 * @returns Sanitized value
 * @throws Error if value contains forbidden characters
 */
export function sanitizeCspValue(value: string): string {
  const trimmed = value.trim();

  if (!isCspValueSafe(trimmed)) {
    throw new Error(
      `[@nextrush/helmet] Security Error: CSP value "${trimmed}" contains ` +
        `forbidden characters (semicolons or newlines).`
    );
  }

  return trimmed;
}

// ============================================================================
// CSP Validation
// ============================================================================

/**
 * Check if a directive name is valid.
 *
 * @param directive - Directive name to validate
 * @returns True if valid
 */
export function isValidCspDirective(directive: string): directive is CspDirectiveName {
  return VALID_CSP_DIRECTIVES.includes(directive as CspDirectiveName);
}

/**
 * Check if a directive is a boolean directive (no value list).
 *
 * @param directive - Directive name
 * @returns True if boolean directive
 */
export function isBooleanCspDirective(directive: string): boolean {
  return (BOOLEAN_CSP_DIRECTIVES as readonly string[]).includes(directive);
}

/**
 * Check if a CSP value is potentially unsafe.
 *
 * @param value - CSP source value
 * @returns True if unsafe
 */
export function isUnsafeCspValue(value: string): boolean {
  return UNSAFE_CSP_VALUES.includes(value as (typeof UNSAFE_CSP_VALUES)[number]);
}

/**
 * Validate a nonce value format.
 *
 * @param nonce - Nonce to validate
 * @returns True if valid nonce format
 */
export function isValidNonce(nonce: string): boolean {
  // Nonce should be at least 16 bytes (128 bits) when decoded
  // Base64 encoded 16 bytes = 22-24 characters
  if (nonce.length < 16) {
    return false;
  }
  return NONCE_PATTERN.test(nonce);
}

/**
 * Validate a hash value format.
 *
 * @param hash - Hash to validate (e.g., 'sha256-abc123...')
 * @returns True if valid hash format
 */
export function isValidHash(hash: string): boolean {
  return HASH_PATTERN.test(hash);
}

// ============================================================================
// HSTS Validation
// ============================================================================

/**
 * Validation result for HSTS options.
 */
export interface HstsValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Validate HSTS options.
 *
 * @param options - HSTS options to validate
 * @returns Validation result with warnings and errors
 */
export function validateHstsOptions(options: StrictTransportSecurityOptions): HstsValidationResult {
  const result: HstsValidationResult = {
    valid: true,
    warnings: [],
    errors: [],
  };

  const { maxAge = 0, includeSubDomains, preload } = options;

  // Check max-age
  if (maxAge < 0) {
    result.valid = false;
    result.errors.push('max-age must be a positive number');
  }

  if (maxAge > 0 && maxAge < 86400) {
    result.warnings.push(
      'HSTS max-age is less than 1 day. Consider using at least 180 days (15552000 seconds).'
    );
  }

  // Preload requirements
  if (preload) {
    if (maxAge < MIN_HSTS_PRELOAD_MAX_AGE) {
      result.warnings.push(
        `HSTS preload requires max-age of at least ${MIN_HSTS_PRELOAD_MAX_AGE} seconds (1 year). ` +
          `Current: ${maxAge} seconds.`
      );
    }

    if (!includeSubDomains) {
      result.warnings.push('HSTS preload requires includeSubDomains to be enabled.');
    }
  }

  return result;
}

// ============================================================================
// Security Warnings
// ============================================================================

/**
 * Log a security warning in development.
 *
 * @param message - Warning message
 * @param details - Additional details
 */
export function securityWarning(message: string, details?: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[@nextrush/helmet] SECURITY WARNING: ${message}`, details ?? '');
  }
}

/**
 * Analyze CSP directives for potential security issues.
 *
 * @param directives - CSP directives to analyze
 * @returns Array of warning messages
 */
export function analyzeCspSecurity(
  directives: Record<string, unknown>
): string[] {
  const warnings: string[] = [];

  for (const [directive, value] of Object.entries(directives)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && isUnsafeCspValue(item)) {
          warnings.push(
            `CSP directive '${directive}' contains potentially unsafe value '${item}'.`
          );
        }
      }

      // Check for overly permissive wildcards
      if (directive.endsWith('-src') && value.includes('*')) {
        warnings.push(
          `CSP directive '${directive}' uses wildcard '*' which allows any source.`
        );
      }
    }
  }

  // Check for missing important directives
  if (!('default-src' in directives)) {
    warnings.push("CSP is missing 'default-src' directive.");
  }

  if (!('object-src' in directives)) {
    warnings.push(
      "CSP is missing 'object-src' directive. Consider adding \"'none'\" to block plugins."
    );
  }

  if (!('base-uri' in directives)) {
    warnings.push(
      "CSP is missing 'base-uri' directive. Consider adding \"'self'\" or \"'none'\"."
    );
  }

  return warnings;
}

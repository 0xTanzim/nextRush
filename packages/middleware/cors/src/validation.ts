/**
 * @nextrush/cors - Origin validation
 *
 * Core origin validation logic implementing spec-compliant CORS checks.
 * All validation paths are explicit and defensive.
 *
 * @packageDocumentation
 */

import { isOriginSecure, isRegexSafe, isValidOriginFormat, securityWarning } from './security.js';
import type { CorsContext, CorsOptions } from './types.js';

/**
 * Check if the request origin is allowed based on configuration.
 *
 * @param origin - Origin header from request
 * @param allowed - CORS origin configuration
 * @param ctx - Request context
 * @param blockNullOrigin - Whether to block null origins
 * @returns Allowed origin string or false
 *
 * @security This is the core security function. All validation paths must
 * be explicit and defensive. Never trust user input without validation.
 *
 * @example
 * ```typescript
 * // Check if origin is allowed
 * const result = await isOriginAllowed(
 *   'https://example.com',
 *   ['https://example.com', 'https://app.example.com'],
 *   corsContext,
 *   true
 * );
 * // result: 'https://example.com'
 * ```
 */
export async function isOriginAllowed(
  origin: string,
  allowed: CorsOptions['origin'],
  ctx: CorsContext,
  blockNullOrigin: boolean
): Promise<string | false> {
  // Basic security checks
  if (!isOriginSecure(origin)) {
    securityWarning('Origin failed security checks', { origin });
    return false;
  }

  // Handle null origin (security-sensitive)
  if (origin === 'null') {
    if (blockNullOrigin) {
      return false;
    }
    // If explicitly allowed and null blocking is disabled
    // Still requires explicit configuration to allow
  }

  // Validate origin format
  if (!isValidOriginFormat(origin)) {
    securityWarning('Malformed origin rejected', { origin });
    return false;
  }

  // Disabled CORS (no headers added)
  if (allowed === false || allowed === undefined) {
    return false;
  }

  // Reflect origin (DANGEROUS - use with caution)
  if (allowed === true) {
    securityWarning(
      'Reflecting all origins. Ensure credentials=false or use explicit whitelist.'
    );
    return origin;
  }

  // Wildcard (incompatible with credentials)
  if (allowed === '*') {
    return '*';
  }

  // Exact string match
  if (typeof allowed === 'string') {
    // Case-sensitive exact match
    return allowed === origin ? origin : false;
  }

  // Array of allowed origins
  if (Array.isArray(allowed)) {
    return allowed.includes(origin) ? origin : false;
  }

  // Regular expression
  if (allowed instanceof RegExp) {
    if (!isRegexSafe(allowed)) {
      securityWarning('Potentially unsafe regex pattern for origin validation', {
        pattern: allowed.source,
      });
    }
    return allowed.test(origin) ? origin : false;
  }

  // Custom validator function
  if (typeof allowed === 'function') {
    try {
      const result = await allowed(origin, ctx);
      if (typeof result === 'string') {
        return result;
      }
      return result ? origin : false;
    } catch (error) {
      securityWarning('Origin validator threw an error', { error, origin });
      return false;
    }
  }

  return false;
}

/**
 * Validate origin against a static list (sync version for simple cases).
 *
 * @param origin - Origin to validate
 * @param allowedOrigins - List of allowed origins
 * @returns True if origin is in the allowed list
 *
 * @example
 * ```typescript
 * isOriginInList('https://example.com', ['https://example.com']) // true
 * isOriginInList('https://evil.com', ['https://example.com']) // false
 * ```
 */
export function isOriginInList(origin: string, allowedOrigins: string[]): boolean {
  return allowedOrigins.includes(origin);
}

/**
 * Validate origin against a regex pattern.
 *
 * @param origin - Origin to validate
 * @param pattern - Regex pattern to test
 * @returns True if origin matches the pattern
 *
 * @security Always use isRegexSafe() before using user-provided patterns.
 *
 * @example
 * ```typescript
 * isOriginMatchingPattern('https://app.example.com', /^https:\/\/.*\.example\.com$/) // true
 * ```
 */
export function isOriginMatchingPattern(origin: string, pattern: RegExp): boolean {
  return pattern.test(origin);
}

/**
 * Create a cached origin validator for performance.
 *
 * @param allowedOrigins - Static list of allowed origins
 * @returns Fast lookup function using Set
 *
 * @example
 * ```typescript
 * const isAllowed = createOriginCache(['https://a.com', 'https://b.com']);
 * isAllowed('https://a.com') // true
 * isAllowed('https://c.com') // false
 * ```
 */
export function createOriginCache(allowedOrigins: string[]): (origin: string) => boolean {
  const originSet = new Set(allowedOrigins);
  return (origin: string) => originSet.has(origin);
}

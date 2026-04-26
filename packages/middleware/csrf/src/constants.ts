/**
 * @nextrush/csrf - Constants
 *
 * @packageDocumentation
 */

// ============================================================================
// Defaults
// ============================================================================

/** Default cookie name. Uses __Host- prefix for origin-locked security. */
export const DEFAULT_COOKIE_NAME = '__Host-csrf';

/** Default random value size in bytes (256 bits of entropy). */
export const DEFAULT_TOKEN_SIZE = 32;

/** Default HTTP methods exempt from CSRF protection. */
export const DEFAULT_IGNORED_METHODS = ['GET', 'HEAD', 'OPTIONS', 'TRACE'] as const;

/** Separator between HMAC hash and random value in the token string. */
export const TOKEN_SEPARATOR = '.';

// ============================================================================
// Headers
// ============================================================================

/** Default header name for CSRF token submission. */
export const CSRF_HEADER = 'x-csrf-token';

/** Alternative header name (Angular convention). */
export const XSRF_HEADER = 'x-xsrf-token';

/** Default body/query field name for CSRF token. */
export const CSRF_FIELD = '_csrf';

// ============================================================================
// HMAC Configuration
// ============================================================================

/** HMAC algorithm for token signing. */
export const HMAC_ALGORITHM = 'HMAC';

/** Hash function for HMAC. */
export const HASH_ALGORITHM = 'SHA-256';

// ============================================================================
// Error Messages
// ============================================================================

export const ERRORS = {
  MISSING_SECRET:
    'CSRF secret is required. Provide a cryptographically random string of at least 32 characters.',
  MISSING_TOKEN: 'CSRF token missing from request.',
  MISSING_COOKIE: 'CSRF cookie not found.',
  INVALID_TOKEN: 'CSRF token validation failed.',
  TOKEN_MISMATCH: 'CSRF token does not match cookie.',
  ORIGIN_MISMATCH: 'Request origin does not match allowed origins.',
  CROSS_SITE: 'Cross-site request blocked by CSRF protection.',
  SECRET_TOO_SHORT: 'CSRF secret must be at least 32 characters.',
} as const;

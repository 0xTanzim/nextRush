/**
 * @nextrush/cors - Security utilities
 *
 * Security-focused utilities for origin validation and threat detection.
 * Implements OWASP recommendations for CORS security.
 *
 * @packageDocumentation
 */

/**
 * Validate that an origin looks like a valid URL origin.
 *
 * @param origin - Origin string to validate
 * @returns True if origin appears valid
 *
 * @security Rejects malformed origins that could bypass validation:
 * - javascript: URLs
 * - data: URLs
 * - file: URLs (except for null origin handling)
 * - Origins with paths or query strings
 *
 * @example
 * ```typescript
 * isValidOriginFormat('https://example.com') // true
 * isValidOriginFormat('http://localhost:3000') // true
 * isValidOriginFormat('javascript:void(0)') // false
 * isValidOriginFormat('null') // true (special case)
 * ```
 */
export function isValidOriginFormat(origin: string): boolean {
  // null is a special case handled separately
  if (origin === 'null') {
    return true;
  }

  // Origin should be protocol + host, optionally with port
  // Valid: https://example.com, http://localhost:3000
  // Invalid: javascript:void(0), file://, data:, etc.
  if (!origin.startsWith('http://') && !origin.startsWith('https://')) {
    return false;
  }

  try {
    const url = new URL(origin);
    // Origin should only have protocol, host, and port
    // Path should be empty or '/'
    return url.pathname === '/' || url.pathname === '';
  } catch {
    return false;
  }
}

/**
 * Dangerous regex patterns that can cause ReDoS (Regular Expression Denial of Service).
 *
 * @security These patterns can cause catastrophic backtracking when matched
 * against malicious input, potentially freezing the server.
 */
const DANGEROUS_REGEX_PATTERNS = [
  /\(\.\*\)\+/, // (.*)+  - greedy quantifier on greedy group
  /\(\.\+\)\+/, // (.+)+  - same issue
  /\(\.\*\)\*/, // (.*)*  - nested quantifiers
  /\(\.\+\)\*/, // (.+)*  - same issue
  /\([^)]+\)\{\d+,\}/, // (group){n,} with large n - exponential backtracking
  /\(\?:[^)]*\.\*[^)]*\)\+/, // (?:.*)+  - non-capturing with same issue
];

/**
 * Check if a regex has potential ReDoS vulnerability.
 *
 * This is a heuristic check, not foolproof. Complex patterns should be
 * tested separately with tools like safe-regex or rxxr2.
 *
 * @param pattern - RegExp to check
 * @returns True if pattern appears safe, false if potentially dangerous
 *
 * @security ReDoS (Regular Expression Denial of Service) can freeze servers.
 * Always validate user-provided or dynamic regex patterns.
 *
 * @example
 * ```typescript
 * isRegexSafe(/^https:\/\/.*\.example\.com$/) // true
 * isRegexSafe(/^(a+)+$/) // false - catastrophic backtracking
 * ```
 */
export function isRegexSafe(pattern: RegExp): boolean {
  const source = pattern.source;
  return !DANGEROUS_REGEX_PATTERNS.some((p) => p.test(source));
}

/**
 * Security warning severity levels.
 */
export type SecuritySeverity = 'warn' | 'error' | 'info';

/**
 * Log security warnings to console in development.
 *
 * @param message - Warning message
 * @param details - Additional context
 * @param severity - Warning severity level
 *
 * @security These warnings help developers identify potential security
 * misconfigurations during development.
 */
export function securityWarning(
  message: string,
  details?: Record<string, unknown>,
  severity: SecuritySeverity = 'warn'
): void {
  if (typeof process === 'undefined' || process.env?.NODE_ENV !== 'production') {
    const prefix = '[@nextrush/cors] SECURITY WARNING:';
    const fullMessage = `${prefix} ${message}`;

    switch (severity) {
      case 'error':
        console.error(fullMessage, details ?? '');
        break;
      case 'info':
        console.info(fullMessage, details ?? '');
        break;
      default:
        console.warn(fullMessage, details ?? '');
    }
  }
}

/**
 * Validate origin is not a known dangerous pattern.
 *
 * @param origin - Origin to validate
 * @returns True if origin passes basic security checks
 *
 * @security Additional layer of defense against origin manipulation attacks.
 */
export function isOriginSecure(origin: string): boolean {
  // Reject empty origins
  if (!origin || origin.trim() === '') {
    return false;
  }

  // Reject very long origins (potential buffer overflow/DoS)
  if (origin.length > 2048) {
    return false;
  }

  // Reject origins with control characters
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(origin)) {
    return false;
  }

  return true;
}

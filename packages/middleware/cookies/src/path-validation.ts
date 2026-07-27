/**
 * @nextrush/cookies - Path Attribute Validation
 *
 * Split out of `validation.ts` to keep that file under the file-size
 * ceiling.
 *
 * @packageDocumentation
 */

import { CRLF_CHARS } from './constants.js';
import type { ValidationResult } from './validation.js';

/**
 * Validate path attribute.
 *
 * @security Prevents CRLF injection and path traversal patterns.
 */
export function validatePath(path: string): ValidationResult {
  const errors: string[] = [];

  if (!path) {
    return { valid: true, errors: [] };
  }

  if (CRLF_CHARS.test(path)) {
    errors.push('Path contains CRLF characters (potential header injection)');
  }

  if (!path.startsWith('/')) {
    errors.push('Path must start with "/"');
  }

  if (path.includes('\0')) {
    errors.push('Path contains null byte');
  }

  return { valid: errors.length === 0, errors };
}

/** Check if a path is valid. */
export function isValidPath(path: string): boolean {
  if (!path || typeof path !== 'string') {
    return false;
  }

  if (!path.startsWith('/')) {
    return false;
  }

  if (CRLF_CHARS.test(path)) {
    return false;
  }

  if (path.includes('..') || /%2e%2e|%2e\.|\.%2e/i.test(path)) {
    return false;
  }

  if (/[;\s<>]/.test(path)) {
    return false;
  }

  if (/%5c/i.test(path)) {
    return false;
  }

  return true;
}

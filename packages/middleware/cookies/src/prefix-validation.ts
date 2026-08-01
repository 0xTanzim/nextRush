/**
 * @nextrush/cookies - Cookie Prefix Validation (__Secure-, __Host-)
 *
 * Both the ValidationResult-returning and throwing forms live here, split
 * out of `validation.ts` to keep that file under the file-size ceiling.
 *
 * @packageDocumentation
 */

import { HOST_PREFIX, SECURE_PREFIX } from './constants.js';
import type { CookieOptions } from './types.js';
import { SecurityError } from './validation.js';
import type { ValidationResult } from './validation.js';

/**
 * Validate __Secure- prefix requirements.
 *
 * @security __Secure- cookies must be set with the Secure flag. An
 * unresolved `secure: 'auto'` does not satisfy this — the prefix
 * requirement demands a genuinely-resolved `true`, since `'auto'` may still
 * resolve to `false` for the actual request (SEC-08).
 */
export function validateSecurePrefix(name: string, options: CookieOptions): ValidationResult {
  const errors: string[] = [];

  if (name.startsWith(SECURE_PREFIX) && options.secure !== true) {
    errors.push(`Cookie with ${SECURE_PREFIX} prefix must have Secure attribute`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate __Host- prefix requirements.
 *
 * @security __Host- cookies must have Secure, no Domain, and Path=/. See
 * {@link validateSecurePrefix} for why `secure` is checked for exact
 * `true`, not truthiness.
 */
export function validateHostPrefix(name: string, options: CookieOptions): ValidationResult {
  const errors: string[] = [];

  if (name.startsWith(HOST_PREFIX)) {
    if (options.secure !== true) {
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

/** Validate all cookie prefix requirements. */
export function validatePrefixes(name: string, options: CookieOptions): ValidationResult {
  const secureResult = validateSecurePrefix(name, options);
  const hostResult = validateHostPrefix(name, options);

  return {
    valid: secureResult.valid && hostResult.valid,
    errors: [...secureResult.errors, ...hostResult.errors],
  };
}

/**
 * Validate cookie prefix requirements and throw on failure.
 *
 * @throws {SecurityError} If prefix requirements not met
 * @security An unresolved `secure: 'auto'` does not satisfy a prefix's
 * Secure requirement — see {@link validateSecurePrefix}.
 */
export function validateCookiePrefix(name: string, options: CookieOptions): void {
  if (name.startsWith(SECURE_PREFIX) && options.secure !== true) {
    throw new SecurityError(
      `Cookie with ${SECURE_PREFIX} prefix must have Secure attribute`,
      'PREFIX_REQUIRES_SECURE'
    );
  }

  if (name.startsWith(HOST_PREFIX)) {
    if (options.secure !== true) {
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

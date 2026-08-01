/**
 * @nextrush/cookies - Cookie Options Validation (Throwing Version)
 *
 * Split out of `validation.ts` to keep that file under the file-size
 * ceiling. Aggregates domain, path, and SameSite/Secure checks that
 * `serializeCookie()` runs before emitting a `Set-Cookie` header.
 *
 * @packageDocumentation
 */

import type { PublicSuffixOptions } from './domain-validation.js';
import { isPublicSuffix, isValidDomain } from './domain-validation.js';
import { isValidPath } from './path-validation.js';
import type { CookieOptions } from './types.js';
import { SecurityError } from './validation.js';

/**
 * Validate cookie options and throw on failure.
 *
 * @param options - Cookie options
 * @param suffixOptions - See {@link PublicSuffixOptions} (SEC-18)
 * @throws {SecurityError} If options are invalid
 */
export function validateCookieOptions(
  options: CookieOptions,
  suffixOptions: PublicSuffixOptions = {}
): void {
  if (options.domain) {
    if (isPublicSuffix(options.domain, suffixOptions)) {
      throw new SecurityError(
        `Domain "${options.domain}" is a public suffix`,
        'PUBLIC_SUFFIX_DOMAIN'
      );
    }
    if (!isValidDomain(options.domain)) {
      throw new SecurityError(`Invalid domain format: "${options.domain}"`, 'INVALID_DOMAIN');
    }
  }

  if (options.path && !isValidPath(options.path)) {
    throw new SecurityError(`Invalid path: "${options.path}"`, 'INVALID_PATH');
  }

  if (options.sameSite === 'none' && options.secure !== true) {
    throw new SecurityError(
      'SameSite=None requires the Secure attribute',
      'SAMESITE_NONE_REQUIRES_SECURE'
    );
  }
}

/**
 * @nextrush/cookies - Domain Validation
 *
 * Domain-attribute validation, including the public-suffix check and its
 * injection point (SEC-18). Split out of `validation.ts` to keep that file
 * under the file-size ceiling — see `code-structure.md`.
 *
 * @packageDocumentation
 */

import { COMMON_PUBLIC_SUFFIXES, CRLF_CHARS } from './constants.js';
import type { ValidationResult } from './validation.js';

// ============================================================================
// Public Suffix Injection Point (SEC-18)
// ============================================================================

/**
 * Options accepted by domain-validation helpers that consult a public
 * suffix list (SEC-18).
 */
export interface PublicSuffixOptions {
  /**
   * Additional suffixes consulted alongside the framework's curated
   * `COMMON_PUBLIC_SUFFIXES` set. Injected, not merged into the global
   * default, so callers control exactly what's trusted.
   */
  publicSuffixList?: Iterable<string>;
}

let unrecognizedSuffixWarned = false;

/**
 * Warns (does not throw) that a multi-label domain's suffix is not
 * recognized by either the curated list or an injected `publicSuffixList`
 * — the framework cannot assert it is safe to scope a cookie's `Domain` to,
 * but a partial suffix list can never be exhaustive, so this is advisory.
 * Logs once per process to avoid flooding logs on repeated requests.
 */
function warnUnrecognizedSuffixOnce(domain: string): void {
  if (unrecognizedSuffixWarned) return;
  unrecognizedSuffixWarned = true;
  console.warn(
    `[@nextrush/cookies] Domain "${domain}" has an unrecognized public suffix. ` +
      'Supply a publicSuffixList entry if this is a shared-hosting domain, or ' +
      'ignore if this is expected. See the README for the publicSuffixList option.'
  );
}

/**
 * Resets the once-per-process unrecognized-suffix warning flag. Exposed for
 * testing only.
 * @internal
 */
export function resetUnrecognizedSuffixWarning(): void {
  unrecognizedSuffixWarned = false;
}

/**
 * Check if a domain is a public suffix.
 *
 * @param domain - Domain to check (with or without leading dot)
 * @param options - See {@link PublicSuffixOptions}
 * @returns True if domain is a known public suffix
 */
export function isPublicSuffix(domain: string, options: PublicSuffixOptions = {}): boolean {
  if (!domain) return false;

  const normalized = domain.startsWith('.') ? domain.slice(1) : domain;
  const lower = normalized.toLowerCase();
  const injected = new Set(options.publicSuffixList ?? []);

  if (COMMON_PUBLIC_SUFFIXES.has(lower) || injected.has(lower)) {
    return true;
  }

  const parts = lower.split('.');
  if (parts.length === 1) {
    return COMMON_PUBLIC_SUFFIXES.has(parts[0] ?? '') || injected.has(parts[0] ?? '');
  }

  if (parts.length === 2) {
    const suffix = parts.join('.');
    if (COMMON_PUBLIC_SUFFIXES.has(suffix) || injected.has(suffix)) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Domain Validation
// ============================================================================

/**
 * Validate domain attribute.
 *
 * @param domain - Domain value to validate
 * @param options - See {@link PublicSuffixOptions}
 * @returns Validation result
 *
 * @security Prevents:
 * - Public suffix domain attacks (setting cookies on .com)
 * - CRLF injection
 * - Invalid domain formats
 */
export function validateDomain(
  domain: string,
  options: PublicSuffixOptions = {}
): ValidationResult {
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

  if (isPublicSuffix(normalizedDomain, options)) {
    errors.push(`Domain "${domain}" appears to be a public suffix`);
  } else {
    const parts = normalizedDomain.toLowerCase().split('.');
    if (parts.length > 1) {
      warnUnrecognizedSuffixOnce(domain);
    }
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

  if (CRLF_CHARS.test(domain)) {
    return false;
  }

  if (/[;\s,<>]/.test(domain)) {
    return false;
  }

  const normalized = domain.startsWith('.') ? domain.slice(1) : domain;

  if (!normalized || normalized === '.') {
    return false;
  }

  if (normalized.length === 1) {
    return /^[a-zA-Z0-9]$/.test(normalized);
  }

  return (
    /^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/.test(normalized) &&
    !normalized.includes('..') &&
    !/-\.|\.-/.test(normalized)
  );
}

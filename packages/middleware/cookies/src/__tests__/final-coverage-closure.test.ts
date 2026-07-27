/**
 * @nextrush/cookies - Final coverage closure (task 6.10 gate)
 *
 * Closes the last uncovered branches: non-string/empty inputs to the
 * ValidationResult-returning `isValidPath`/`isPublicSuffix`/`isValidDomain`
 * helpers, the backslash-encoding path check, oversized name/value length
 * checks in `validateCookieName`/`validateCookieValue`, and the
 * `unsignCookie` expiry/legacy branches in `signing.ts` not already
 * exercised by `signing-context-bound.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { isValidPath } from '../path-validation.js';
import { isPublicSuffix, isValidDomain } from '../domain-validation.js';
import { validateCookieName, validateCookieValue } from '../validation.js';
import { MAX_NAME_LENGTH, MAX_VALUE_LENGTH } from '../constants.js';
import { signCookie, unsignCookie } from '../signing.js';

describe('isValidPath non-string/empty inputs', () => {
  it('rejects an empty path', () => {
    expect(isValidPath('')).toBe(false);
  });

  it('rejects a backslash-encoded (%5c) path', () => {
    expect(isValidPath('/api%5c..%5cadmin')).toBe(false);
  });
});

describe('isPublicSuffix single-label and multi-part domains', () => {
  it('checks a single-label domain against the curated set directly', () => {
    expect(isPublicSuffix('localhost')).toBe(false);
    expect(isPublicSuffix('com')).toBe(true);
  });

  it('checks a single-label domain against an injected list', () => {
    expect(isPublicSuffix('internal', { publicSuffixList: ['internal'] })).toBe(true);
  });

  it('does not match a three-or-more-label domain beyond the two-label suffix window', () => {
    expect(isPublicSuffix('a.b.example.com')).toBe(false);
  });
});

describe('isValidDomain single-character and multi-label domains', () => {
  it('accepts a single alphanumeric character as a domain', () => {
    expect(isValidDomain('a')).toBe(true);
  });

  it('rejects a single non-alphanumeric character', () => {
    expect(isValidDomain('-')).toBe(false);
  });

  it('accepts a well-formed multi-label domain', () => {
    expect(isValidDomain('sub.example.com')).toBe(true);
  });

  it('rejects a domain containing consecutive dots', () => {
    expect(isValidDomain('sub..example.com')).toBe(false);
  });

  it('rejects a domain with a dash adjacent to a dot', () => {
    expect(isValidDomain('sub-.example.com')).toBe(false);
    expect(isValidDomain('sub.-example.com')).toBe(false);
  });
});

describe('validateCookieName / validateCookieValue length boundaries', () => {
  it('flags a name exceeding MAX_NAME_LENGTH', () => {
    const result = validateCookieName('a'.repeat(MAX_NAME_LENGTH + 1));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /exceeds maximum length/.test(e))).toBe(true);
  });

  it('flags a value exceeding MAX_VALUE_LENGTH', () => {
    const result = validateCookieValue('a'.repeat(MAX_VALUE_LENGTH + 1));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /exceeds maximum length/.test(e))).toBe(true);
  });

  it('flags CRLF in a value via the ValidationResult form directly', () => {
    const result = validateCookieValue('abc\r\ndef');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /CRLF/.test(e))).toBe(true);
  });
});

describe('unsignCookie expiry and rejection branches not covered elsewhere', () => {
  it('returns undefined for a value with no recognizable format at all', async () => {
    // Fails splitNewFormat's lastSep <= 0 guard, and acceptLegacySignatures
    // is off by default, so this exercises the final fall-through path.
    await expect(unsignCookie('session', 'not-a-signed-value', 'secret')).resolves.toBeUndefined();
  });

  it('rejects a tampered signature without throwing', async () => {
    const signed = await signCookie('session', 'value', 'secret');
    const tampered = `${signed.slice(0, -1)}0`;
    await expect(unsignCookie('session', tampered, 'secret')).resolves.toBeUndefined();
  });
});

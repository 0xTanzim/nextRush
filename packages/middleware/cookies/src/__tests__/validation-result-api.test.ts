/**
 * @nextrush/cookies - ValidationResult-returning API surface tests
 *
 * `validatePath`, `validateDomain`, `validatePrefixes`, `validateSecurePrefix`,
 * `validateHostPrefix`, `validateSameSiteSecure`, `validateMaxAge`,
 * `validateExpires`, `validateCookie`, and `sanitizeForLogging` are exported
 * from the barrel but were previously exercised only indirectly (or not at
 * all) — this file gives each its own direct RED->GREEN coverage per task
 * 6.10's coverage gate. Pre-existing gap found during WS-D, not introduced
 * by this workstream; see the WS-D decisions log in the remediation index.
 */

import { describe, expect, it } from 'vitest';
import { validatePath } from '../path-validation.js';
import { validateDomain } from '../domain-validation.js';
import {
  validateHostPrefix,
  validatePrefixes,
  validateSecurePrefix,
} from '../prefix-validation.js';
import {
  sanitizeForLogging,
  validateCookie,
  validateExpires,
  validateMaxAge,
  validateSameSiteSecure,
} from '../validation.js';

describe('validatePath (ValidationResult form)', () => {
  it('returns valid for an empty path', () => {
    expect(validatePath('')).toEqual({ valid: true, errors: [] });
  });

  it('returns valid for a normal path', () => {
    expect(validatePath('/api/v1')).toEqual({ valid: true, errors: [] });
  });

  it('flags CRLF in the path', () => {
    const result = validatePath('/api\r\n');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/CRLF/);
  });

  it('flags a path missing the leading slash', () => {
    const result = validatePath('api');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/must start with/);
  });

  it('flags a null byte in the path', () => {
    const result = validatePath('/api\0hidden');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/null byte/);
  });

  it('accumulates multiple errors for a path with several problems', () => {
    const result = validatePath('bad\0path');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('validateDomain (ValidationResult form)', () => {
  it('returns valid for an empty domain', () => {
    expect(validateDomain('')).toEqual({ valid: true, errors: [] });
  });

  it('returns valid for a private domain', () => {
    expect(validateDomain('example.com')).toEqual({ valid: true, errors: [] });
  });

  it('flags CRLF and stops before format checks', () => {
    const result = validateDomain('exa\r\nmple.com');
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/CRLF/);
  });

  it('flags a curated public suffix', () => {
    const result = validateDomain('com');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/public suffix/);
  });

  it('flags an invalid domain format', () => {
    const result = validateDomain('-bad-.com');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /invalid format/.test(e))).toBe(true);
  });

  it('flags the domain itself when it equals an injected publicSuffixList entry', () => {
    const result = validateDomain('internal-hosting', {
      publicSuffixList: ['internal-hosting'],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/public suffix/);
  });

  it('still accepts a sub-domain under an injected publicSuffixList entry', () => {
    const result = validateDomain('tenant.internal-hosting', {
      publicSuffixList: ['internal-hosting'],
    });
    expect(result.valid).toBe(true);
  });
});

describe('validateSecurePrefix / validateHostPrefix / validatePrefixes', () => {
  it('validateSecurePrefix flags __Secure- without secure', () => {
    const result = validateSecurePrefix('__Secure-token', {});
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/Secure attribute/);
  });

  it('validateSecurePrefix accepts __Secure- with secure', () => {
    expect(validateSecurePrefix('__Secure-token', { secure: true })).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('validateHostPrefix flags every unmet __Host- requirement at once', () => {
    const result = validateHostPrefix('__Host-session', {
      domain: 'example.com',
      path: '/api',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(3);
  });

  it('validateHostPrefix accepts a fully-compliant __Host- cookie', () => {
    expect(validateHostPrefix('__Host-session', { secure: true, path: '/' })).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('validatePrefixes merges errors from both prefix checks', () => {
    const result = validatePrefixes('__Host-session', { domain: 'example.com' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('validatePrefixes is valid for a non-prefixed name', () => {
    expect(validatePrefixes('session', {})).toEqual({ valid: true, errors: [] });
  });
});

describe('validateSameSiteSecure', () => {
  it('flags SameSite=None without Secure', () => {
    const result = validateSameSiteSecure({ sameSite: 'none' });
    expect(result.valid).toBe(false);
  });

  it('accepts SameSite=None with Secure', () => {
    expect(validateSameSiteSecure({ sameSite: 'none', secure: true })).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('accepts any other SameSite value regardless of Secure', () => {
    expect(validateSameSiteSecure({ sameSite: 'lax' })).toEqual({ valid: true, errors: [] });
  });
});

describe('validateMaxAge', () => {
  it('accepts an omitted maxAge', () => {
    expect(validateMaxAge(undefined)).toEqual({ valid: true, errors: [] });
  });

  it('accepts a positive finite maxAge', () => {
    expect(validateMaxAge(3600)).toEqual({ valid: true, errors: [] });
  });

  it('flags a negative maxAge', () => {
    const result = validateMaxAge(-1);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/non-negative/);
  });

  it('flags a non-finite maxAge', () => {
    expect(validateMaxAge(Number.POSITIVE_INFINITY).valid).toBe(false);
    expect(validateMaxAge(Number.NaN).valid).toBe(false);
  });
});

describe('validateExpires', () => {
  it('accepts an omitted expires', () => {
    expect(validateExpires(undefined)).toEqual({ valid: true, errors: [] });
  });

  it('accepts a valid Date', () => {
    expect(validateExpires(new Date())).toEqual({ valid: true, errors: [] });
  });

  it('accepts a valid numeric timestamp', () => {
    expect(validateExpires(Date.now())).toEqual({ valid: true, errors: [] });
  });

  it('flags a non-finite numeric timestamp', () => {
    expect(validateExpires(Number.NaN).valid).toBe(false);
  });

  it('flags an invalid Date object', () => {
    expect(validateExpires(new Date('not-a-date')).valid).toBe(false);
  });

  it('flags a non-Date, non-number value', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(validateExpires('tomorrow' as any).valid).toBe(false);
  });
});

describe('validateCookie (whole-cookie aggregator)', () => {
  it('accepts a fully valid cookie', () => {
    const result = validateCookie('session', 'abc123', { path: '/', secure: true });
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('aggregates errors from name, value, prefix, domain, path, and attribute checks', () => {
    const result = validateCookie('__Host-bad name', 'value\r\n', {
      domain: 'com',
      path: 'no-slash',
      sameSite: 'none',
      secure: false,
      maxAge: -1,
      expires: Number.NaN,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(4);
  });

  it('flags a cookie whose serialized size would exceed the size limit', () => {
    const result = validateCookie('name', 'x'.repeat(4090));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /exceeds maximum size/.test(e))).toBe(true);
  });
});

describe('sanitizeForLogging', () => {
  it('strips the first CRLF-class character for safe logging', () => {
    // CRLF_CHARS is a non-global regex, so replace() removes only the first
    // \r or \n match — documenting the current single-pass behavior rather
    // than asserting a global strip this function does not perform.
    expect(sanitizeForLogging('line1\rline2')).toBe('line1line2');
    expect(sanitizeForLogging('line1\nline2')).toBe('line1line2');
  });

  it('leaves clean strings unchanged', () => {
    expect(sanitizeForLogging('clean value')).toBe('clean value');
  });
});

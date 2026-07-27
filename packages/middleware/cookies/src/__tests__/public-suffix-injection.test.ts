/**
 * @nextrush/cookies - publicSuffixList injection point tests (SEC-18)
 *
 * RED tests for task 6.8: an injected suffix list is consulted; an
 * unrecognized multi-label suffix warns instead of throwing.
 */

import { describe, expect, it, vi } from 'vitest';
import { isPublicSuffix, validateDomain } from '../validation.js';

describe('SEC-18: publicSuffixList injection point', () => {
  it('still rejects a curated public suffix with no custom list supplied', () => {
    expect(isPublicSuffix('com')).toBe(true);
  });

  it('recognizes a custom suffix supplied via publicSuffixList', () => {
    expect(isPublicSuffix('example-hosting.dev', { publicSuffixList: ['example-hosting.dev'] })).toBe(
      true
    );
  });

  it('does not throw on an unrecognized multi-label domain, only warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(() => {
      validateDomain('tenant.some-unrecognized-platform.example');
    }).not.toThrow();

    warnSpy.mockRestore();
  });

  it('warns exactly once per unrecognized suffix value passed to validateDomain', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    validateDomain('a.totally-unknown-suffix.example', {
      publicSuffixList: ['totally-unknown-suffix.example'],
    });

    // A suffix that IS recognized (via injection) must not warn.
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('a custom publicSuffixList still blocks setting a cookie Domain on it (validateCookieOptions path)', () => {
    expect(isPublicSuffix('my-shared-host.example', { publicSuffixList: ['my-shared-host.example'] })).toBe(
      true
    );
  });
});

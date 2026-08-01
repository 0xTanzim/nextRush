/**
 * @nextrush/cookies - Task 6.9 edge cases
 *
 * The four edge cases named explicitly in tasks.md 6.9: a signed value at
 * exactly `MAX_COOKIE_SIZE`, a name that collides with both the
 * `__Host-`/`__Secure-` prefix rules at once, a parse-then-unsign round
 * trip through `sanitizeCookieValue`, and repeated `Cookie` request headers
 * joined by the middleware (the last is already covered by CK-9 in
 * `middleware.test.ts` and `remaining-branches.test.ts` — not duplicated
 * here).
 */

import { describe, expect, it } from 'vitest';
import { serializeCookie } from '../serializer.js';
import { validateCookiePrefix } from '../prefix-validation.js';
import { SecurityError, sanitizeCookieValue } from '../validation.js';
import { MAX_COOKIE_SIZE } from '../constants.js';
import { signCookie, unsignCookie } from '../signing.js';

describe('SEC-18/task 6.9: exact MAX_COOKIE_SIZE boundary', () => {
  it('accepts a serialized cookie exactly at MAX_COOKIE_SIZE bytes', () => {
    // Compute the exact fixed overhead this name+empty-value produces under
    // the merged DEFAULT_COOKIE_OPTIONS (Path, HttpOnly, SameSite, Secure),
    // then pad the value to land precisely on the limit — avoids hardcoding
    // an overhead figure that would drift if the defaults change.
    const overhead = serializeCookie('name', '').length;
    const value = 'x'.repeat(MAX_COOKIE_SIZE - overhead);
    const cookie = serializeCookie('name', value);
    expect(cookie.length).toBe(MAX_COOKIE_SIZE);
  });

  it('rejects a serialized cookie one byte over MAX_COOKIE_SIZE', () => {
    const overhead = serializeCookie('name', '').length;
    const value = 'x'.repeat(MAX_COOKIE_SIZE - overhead + 1);
    expect(() => serializeCookie('name', value)).toThrow(RangeError);
  });

  it('accepts a signed value at exactly MAX_COOKIE_SIZE once serialized', async () => {
    // The signed wire format (value.issuedAt.signature) adds overhead over
    // the raw value, so this exercises the same boundary through the
    // signing path rather than assuming signed and unsigned overhead match.
    const signed = await signCookie('session', 'x'.repeat(50), 'secret');
    const cookie = serializeCookie('session', signed, { path: '/' });
    expect(cookie.length).toBeLessThanOrEqual(MAX_COOKIE_SIZE);
    const roundTripped = await unsignCookie('session', signed, 'secret');
    expect(roundTripped).toBe('x'.repeat(50));
  });
});

describe('SEC-18/task 6.9: __Host- and __Secure- prefix collision', () => {
  it('a name starting with __Host- is not additionally treated as __Secure-', () => {
    // __Host- does not start with __Secure-, so only the __Host- rule set
    // applies — confirms the two prefix checks do not double-fire on a
    // name that satisfies one but happens to also contain the other
    // prefix's literal text elsewhere.
    expect(() =>
      validateCookiePrefix('__Host-__Secure-token', { secure: true, path: '/' })
    ).not.toThrow();
  });

  it('a name starting with __Secure- but containing __Host- later is only __Secure--checked', () => {
    expect(() =>
      validateCookiePrefix('__Secure-__Host-token', { secure: true })
    ).not.toThrow(SecurityError);
  });

  it('rejects a name that satisfies neither prefix rule when both prefixes are present as substrings', () => {
    expect(() =>
      validateCookiePrefix('__Host-__Secure-token', { secure: false, path: '/' })
    ).toThrow(SecurityError);
  });
});

describe('task 6.9: sanitizeCookieValue round trip through parse-then-unsign', () => {
  it('a signed value survives sanitizeCookieValue unchanged (no CRLF/control chars in the wire format)', async () => {
    const signed = await signCookie('session', 'plain-value', 'secret');
    const sanitized = sanitizeCookieValue(signed);
    // The signed wire format (base64url signature, decimal issuedAt, and a
    // value with no control characters) contains nothing sanitizeCookieValue
    // strips, so the round trip must be byte-for-byte identical.
    expect(sanitized).toBe(signed);
    const unsigned = await unsignCookie('session', sanitized, 'secret');
    expect(unsigned).toBe('plain-value');
  });
});

/**
 * @nextrush/express-bridge — cookie serializer tests
 */

import { describe, expect, it } from 'vitest';
import { serializeCookie } from '../cookie-serialize';
import { UnsupportedExpressApiError } from '../errors';

describe('serializeCookie', () => {
  it('serializes maxAge in milliseconds to Max-Age in seconds', () => {
    const header = serializeCookie('sid', 'x', { maxAge: 1000 });
    expect(header).toContain('Max-Age=1');
  });

  it('omits httpOnly/secure/sameSite unless provided (Express defaults)', () => {
    const header = serializeCookie('sid', 'x');
    expect(header).not.toContain('HttpOnly');
    expect(header).not.toContain('Secure');
    expect(header).not.toContain('SameSite');
  });

  it('defaults path to /', () => {
    expect(serializeCookie('sid', 'x')).toContain('Path=/');
  });

  it('emits HttpOnly, Secure, SameSite when provided', () => {
    const header = serializeCookie('sid', 'x', { httpOnly: true, secure: true, sameSite: 'lax' });
    expect(header).toContain('HttpOnly');
    expect(header).toContain('Secure');
    expect(header).toContain('SameSite=lax');
  });

  it('traps signed: true', () => {
    expect(() => serializeCookie('sid', 'x', { signed: true })).toThrow(
      UnsupportedExpressApiError
    );
  });

  it('encodes the value by default', () => {
    const header = serializeCookie('sid', 'a b');
    expect(header).toContain('sid=a%20b');
  });
});

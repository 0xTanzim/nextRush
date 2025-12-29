/**
 * @nextrush/cookies - Signing Tests
 *
 * Tests for cookie signing and verification.
 */

import { describe, expect, it } from 'vitest';
import {
    signCookie,
    timingSafeEqual,
    unsignCookie,
    unsignCookieWithRotation
} from '../signing.js';

describe('signCookie', () => {
  it('should sign a cookie value', async () => {
    const signed = await signCookie('hello', 'secret');
    expect(signed).toContain('hello.');
    expect(signed.length).toBeGreaterThan('hello.'.length);
  });

  it('should produce different signatures for different values', async () => {
    const signed1 = await signCookie('value1', 'secret');
    const signed2 = await signCookie('value2', 'secret');
    expect(signed1).not.toBe(signed2);
  });

  it('should produce different signatures for different secrets', async () => {
    const signed1 = await signCookie('value', 'secret1');
    const signed2 = await signCookie('value', 'secret2');
    expect(signed1).not.toBe(signed2);
  });

  it('should produce consistent signatures', async () => {
    const signed1 = await signCookie('value', 'secret');
    const signed2 = await signCookie('value', 'secret');
    expect(signed1).toBe(signed2);
  });

  it('should throw on empty value', async () => {
    await expect(signCookie('', 'secret')).rejects.toThrow(TypeError);
  });

  it('should throw on empty secret', async () => {
    await expect(signCookie('value', '')).rejects.toThrow(TypeError);
  });

  it('should throw on non-string value', async () => {
    await expect(signCookie(null as unknown as string, 'secret')).rejects.toThrow();
    await expect(signCookie(123 as unknown as string, 'secret')).rejects.toThrow();
  });

  it('should throw on non-string secret', async () => {
    await expect(signCookie('value', null as unknown as string)).rejects.toThrow();
    await expect(signCookie('value', 123 as unknown as string)).rejects.toThrow();
  });
});

describe('unsignCookie', () => {
  it('should verify and return valid signed cookie', async () => {
    const signed = await signCookie('hello', 'secret');
    const value = await unsignCookie(signed, 'secret');
    expect(value).toBe('hello');
  });

  it('should return undefined for invalid signature', async () => {
    const signed = await signCookie('hello', 'secret');
    const tampered = signed.slice(0, -5) + 'xxxxx';
    const value = await unsignCookie(tampered, 'secret');
    expect(value).toBeUndefined();
  });

  it('should return undefined for wrong secret', async () => {
    const signed = await signCookie('hello', 'secret1');
    const value = await unsignCookie(signed, 'secret2');
    expect(value).toBeUndefined();
  });

  it('should return undefined for unsigned value', async () => {
    const value = await unsignCookie('just-a-value', 'secret');
    expect(value).toBeUndefined();
  });

  it('should return undefined for empty value', async () => {
    const value = await unsignCookie('', 'secret');
    expect(value).toBeUndefined();
  });

  it('should return undefined for non-string', async () => {
    const value = await unsignCookie(null as unknown as string, 'secret');
    expect(value).toBeUndefined();
  });

  it('should handle values containing dots', async () => {
    const original = 'user.data.here';
    const signed = await signCookie(original, 'secret');
    const value = await unsignCookie(signed, 'secret');
    expect(value).toBe(original);
  });

  it('should handle special characters in value', async () => {
    const original = 'value+with=special%20chars';
    const signed = await signCookie(original, 'secret');
    const value = await unsignCookie(signed, 'secret');
    expect(value).toBe(original);
  });

  it('should handle unicode values', async () => {
    const original = 'héllo wörld 你好';
    const signed = await signCookie(original, 'secret');
    const value = await unsignCookie(signed, 'secret');
    expect(value).toBe(original);
  });
});

describe('unsignCookieWithRotation', () => {
  it('should verify with current key', async () => {
    const signed = await signCookie('hello', 'current-secret');
    const value = await unsignCookieWithRotation(signed, {
      current: 'current-secret'
    });
    expect(value).toBe('hello');
  });

  it('should verify with previous key during rotation', async () => {
    const signed = await signCookie('hello', 'old-secret');
    const value = await unsignCookieWithRotation(signed, {
      current: 'new-secret',
      previous: ['old-secret']
    });
    expect(value).toBe('hello');
  });

  it('should try multiple previous keys', async () => {
    const signed = await signCookie('hello', 'very-old-secret');
    const value = await unsignCookieWithRotation(signed, {
      current: 'new-secret',
      previous: ['old-secret', 'very-old-secret']
    });
    expect(value).toBe('hello');
  });

  it('should prefer current key over previous', async () => {
    // Both keys work, but current should be tried first
    const signed = await signCookie('hello', 'shared-secret');
    const value = await unsignCookieWithRotation(signed, {
      current: 'shared-secret',
      previous: ['shared-secret']
    });
    expect(value).toBe('hello');
  });

  it('should return undefined if no key matches', async () => {
    const signed = await signCookie('hello', 'unknown-secret');
    const value = await unsignCookieWithRotation(signed, {
      current: 'current',
      previous: ['old1', 'old2']
    });
    expect(value).toBeUndefined();
  });

  it('should handle empty previous keys', async () => {
    const signed = await signCookie('hello', 'current');
    const value = await unsignCookieWithRotation(signed, {
      current: 'current',
      previous: []
    });
    expect(value).toBe('hello');
  });

  it('should handle undefined previous keys', async () => {
    const signed = await signCookie('hello', 'current');
    const value = await unsignCookieWithRotation(signed, {
      current: 'current'
    });
    expect(value).toBe('hello');
  });
});

describe('timingSafeEqual', () => {
  it('should return true for equal strings', () => {
    expect(timingSafeEqual('hello', 'hello')).toBe(true);
    expect(timingSafeEqual('', '')).toBe(true);
    expect(timingSafeEqual('abc123', 'abc123')).toBe(true);
  });

  it('should return false for different strings', () => {
    expect(timingSafeEqual('hello', 'world')).toBe(false);
    expect(timingSafeEqual('hello', 'hellO')).toBe(false);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
  });

  it('should return false for different length strings', () => {
    expect(timingSafeEqual('hello', 'hello!')).toBe(false);
    expect(timingSafeEqual('short', 'longer string')).toBe(false);
    expect(timingSafeEqual('', 'a')).toBe(false);
  });

  it('should handle special characters', () => {
    expect(timingSafeEqual('héllo', 'héllo')).toBe(true);
    expect(timingSafeEqual('héllo', 'hello')).toBe(false);
  });
});

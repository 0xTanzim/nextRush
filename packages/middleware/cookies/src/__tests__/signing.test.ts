/**
 * @nextrush/cookies - Signing Tests
 *
 * Tests for cookie signing and verification with the context-bound
 * (name + value + issuedAt) construction (RFC-031, SEC-07). Cross-name
 * replay, expiry, and legacy-rotation coverage lives in
 * `signing-context-bound.test.ts`.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
    clearKeyCache,
    signCookie,
    timingSafeEqual,
    unsignCookie,
    unsignCookieWithRotation
} from '../signing.js';

afterEach(() => {
  clearKeyCache();
});

describe('signCookie', () => {
  it('should sign a cookie value', async () => {
    const signed = await signCookie('name', 'hello', 'secret');
    expect(signed).toContain('hello.');
    expect(signed.length).toBeGreaterThan('hello.'.length);
  });

  it('should produce different signatures for different values', async () => {
    const signed1 = await signCookie('name', 'value1', 'secret');
    const signed2 = await signCookie('name', 'value2', 'secret');
    expect(signed1).not.toBe(signed2);
  });

  it('should produce different signatures for different secrets', async () => {
    const signed1 = await signCookie('name', 'value', 'secret1');
    const signed2 = await signCookie('name', 'value', 'secret2');
    expect(signed1).not.toBe(signed2);
  });

  it('should throw on empty name', async () => {
    await expect(signCookie('', 'value', 'secret')).rejects.toThrow(TypeError);
  });

  it('should throw on empty value', async () => {
    await expect(signCookie('name', '', 'secret')).rejects.toThrow(TypeError);
  });

  it('should throw on empty secret', async () => {
    await expect(signCookie('name', 'value', '')).rejects.toThrow(TypeError);
  });

  it('should throw on non-string value', async () => {
    await expect(signCookie('name', null as unknown as string, 'secret')).rejects.toThrow();
    await expect(signCookie('name', 123 as unknown as string, 'secret')).rejects.toThrow();
  });

  it('should throw on non-string secret', async () => {
    await expect(signCookie('name', 'value', null as unknown as string)).rejects.toThrow();
    await expect(signCookie('name', 'value', 123 as unknown as string)).rejects.toThrow();
  });
});

describe('unsignCookie', () => {
  it('should verify and return valid signed cookie', async () => {
    const signed = await signCookie('name', 'hello', 'secret');
    const value = await unsignCookie('name', signed, 'secret');
    expect(value).toBe('hello');
  });

  it('should return undefined for invalid signature', async () => {
    const signed = await signCookie('name', 'hello', 'secret');
    const tampered = signed.slice(0, -5) + 'xxxxx';
    const value = await unsignCookie('name', tampered, 'secret');
    expect(value).toBeUndefined();
  });

  it('should return undefined for wrong secret', async () => {
    const signed = await signCookie('name', 'hello', 'secret1');
    const value = await unsignCookie('name', signed, 'secret2');
    expect(value).toBeUndefined();
  });

  it('should return undefined for unsigned value', async () => {
    const value = await unsignCookie('name', 'just-a-value', 'secret');
    expect(value).toBeUndefined();
  });

  it('should return undefined for empty value', async () => {
    const value = await unsignCookie('name', '', 'secret');
    expect(value).toBeUndefined();
  });

  it('should return undefined for non-string', async () => {
    const value = await unsignCookie('name', null as unknown as string, 'secret');
    expect(value).toBeUndefined();
  });

  it('should handle values containing dots', async () => {
    const original = 'user.data.here';
    const signed = await signCookie('name', original, 'secret');
    const value = await unsignCookie('name', signed, 'secret');
    expect(value).toBe(original);
  });

  it('should handle special characters in value', async () => {
    const original = 'value+with=special%20chars';
    const signed = await signCookie('name', original, 'secret');
    const value = await unsignCookie('name', signed, 'secret');
    expect(value).toBe(original);
  });

  it('should handle unicode values', async () => {
    const original = 'héllo wörld 你好';
    const signed = await signCookie('name', original, 'secret');
    const value = await unsignCookie('name', signed, 'secret');
    expect(value).toBe(original);
  });
});

describe('unsignCookieWithRotation', () => {
  it('should verify with current key', async () => {
    const signed = await signCookie('name', 'hello', 'current-secret');
    const value = await unsignCookieWithRotation('name', signed, {
      current: 'current-secret'
    });
    expect(value).toBe('hello');
  });

  it('should verify with previous key during rotation', async () => {
    const signed = await signCookie('name', 'hello', 'old-secret');
    const value = await unsignCookieWithRotation('name', signed, {
      current: 'new-secret',
      previous: ['old-secret']
    });
    expect(value).toBe('hello');
  });

  it('should try multiple previous keys', async () => {
    const signed = await signCookie('name', 'hello', 'very-old-secret');
    const value = await unsignCookieWithRotation('name', signed, {
      current: 'new-secret',
      previous: ['old-secret', 'very-old-secret']
    });
    expect(value).toBe('hello');
  });

  it('should prefer current key over previous', async () => {
    const signed = await signCookie('name', 'hello', 'shared-secret');
    const value = await unsignCookieWithRotation('name', signed, {
      current: 'shared-secret',
      previous: ['shared-secret']
    });
    expect(value).toBe('hello');
  });

  it('should return undefined if no key matches', async () => {
    const signed = await signCookie('name', 'hello', 'unknown-secret');
    const value = await unsignCookieWithRotation('name', signed, {
      current: 'current',
      previous: ['old1', 'old2']
    });
    expect(value).toBeUndefined();
  });

  it('should handle empty previous keys', async () => {
    const signed = await signCookie('name', 'hello', 'current');
    const value = await unsignCookieWithRotation('name', signed, {
      current: 'current',
      previous: []
    });
    expect(value).toBe('hello');
  });

  it('should handle undefined previous keys', async () => {
    const signed = await signCookie('name', 'hello', 'current');
    const value = await unsignCookieWithRotation('name', signed, {
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

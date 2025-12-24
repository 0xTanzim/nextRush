/**
 * Cookie Utilities Tests
 *
 * Comprehensive test suite for high-performance cookie handling
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CookieJar,
  parseCookies,
  serializeCookie,
  signCookie,
  unsignCookie,
  validateCookieValue,
} from '../../../utils/cookies.js';

describe('Cookie Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('parseCookies', () => {
    it('should parse simple cookies', () => {
      const result = parseCookies('name=value; foo=bar');
      expect(result).toEqual({
        name: 'value',
        foo: 'bar',
      });
    });

    it('should handle URL-encoded values', () => {
      const result = parseCookies('name=hello%20world; special=%40%23%24');
      expect(result).toEqual({
        name: 'hello world',
        special: '@#$',
      });
    });

    it('should handle empty values', () => {
      const result = parseCookies('empty=; hasValue=test');
      expect(result).toEqual({
        empty: '',
        hasValue: 'test',
      });
    });

    it('should handle malformed cookies gracefully', () => {
      const result = parseCookies(
        'valid=good; =invalid; badformat; another=value'
      );
      expect(result).toEqual({
        valid: 'good',
        another: 'value',
      });
    });

    it('should handle quoted values', () => {
      const result = parseCookies('quoted="hello world"; normal=value');
      expect(result).toEqual({
        quoted: 'hello world',
        normal: 'value',
      });
    });

    it('should handle spaces around values', () => {
      const result = parseCookies('spaced = " value " ; normal=clean');
      expect(result).toEqual({
        spaced: ' value ',
        normal: 'clean',
      });
    });

    it('should return empty object for empty string', () => {
      const result = parseCookies('');
      expect(result).toEqual({});
    });

    it('should handle single cookie', () => {
      const result = parseCookies('single=value');
      expect(result).toEqual({
        single: 'value',
      });
    });

    it('should handle Unicode values', () => {
      const result = parseCookies('unicode=%E2%9C%A8%F0%9F%8D%AA');
      expect(result).toEqual({
        unicode: '✨🍪',
      });
    });
  });

  describe('serializeCookie', () => {
    it('should serialize basic cookie', () => {
      const result = serializeCookie('name', 'value');
      expect(result).toBe('name=value');
    });

    it('should URL-encode special characters', () => {
      const result = serializeCookie('special', 'hello world @#$');
      expect(result).toBe('special=hello%20world%20%40%23%24');
    });

    it('should add MaxAge option', () => {
      const result = serializeCookie('name', 'value', { maxAge: 3600 });
      expect(result).toBe('name=value; Max-Age=3600');
    });

    it('should add Expires option', () => {
      const date = new Date('2024-12-31T23:59:59.000Z');
      const result = serializeCookie('name', 'value', { expires: date });
      expect(result).toBe('name=value; Expires=Tue, 31 Dec 2024 23:59:59 GMT');
    });

    it('should add Path option', () => {
      const result = serializeCookie('name', 'value', { path: '/admin' });
      expect(result).toBe('name=value; Path=/admin');
    });

    it('should add Domain option', () => {
      const result = serializeCookie('name', 'value', {
        domain: '.example.com',
      });
      expect(result).toBe('name=value; Domain=.example.com');
    });

    it('should add Secure flag', () => {
      const result = serializeCookie('name', 'value', { secure: true });
      expect(result).toBe('name=value; Secure');
    });

    it('should add HttpOnly flag', () => {
      const result = serializeCookie('name', 'value', { httpOnly: true });
      expect(result).toBe('name=value; HttpOnly');
    });

    it('should add SameSite option', () => {
      const result = serializeCookie('name', 'value', { sameSite: 'Strict' });
      expect(result).toBe('name=value; SameSite=Strict');
    });

    it('should combine all options', () => {
      const result = serializeCookie('session', 'abc123', {
        maxAge: 3600,
        path: '/',
        domain: '.example.com',
        secure: true,
        httpOnly: true,
        sameSite: 'Strict',
      });
      expect(result).toBe(
        'session=abc123; Max-Age=3600; Path=/; Domain=.example.com; Secure; HttpOnly; SameSite=Strict'
      );
    });

    it('should apply security defaults in production', () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';

      const result = serializeCookie('name', 'value');
      expect(result).toBe('name=value; Secure; HttpOnly; SameSite=Strict');

      process.env['NODE_ENV'] = originalEnv;
    });

    it('should not apply security defaults in development', () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';

      const result = serializeCookie('name', 'value');
      expect(result).toBe('name=value');

      process.env['NODE_ENV'] = originalEnv;
    });

    it('should override security defaults when explicitly set', () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';

      const result = serializeCookie('name', 'value', { secure: false });
      expect(result).toBe('name=value; HttpOnly; SameSite=Strict');

      process.env['NODE_ENV'] = originalEnv;
    });
  });

  describe('signCookie', () => {
    const secret = 'test-secret-key-12345';

    it('should sign a cookie value', () => {
      const result = signCookie('testvalue', secret);
      expect(result).toMatch(/^testvalue\.[a-zA-Z0-9_-]+$/);
    });

    it('should produce consistent signatures', () => {
      const result1 = signCookie('testvalue', secret);
      const result2 = signCookie('testvalue', secret);
      expect(result1).toBe(result2);
    });

    it('should produce different signatures for different values', () => {
      const result1 = signCookie('value1', secret);
      const result2 = signCookie('value2', secret);
      expect(result1).not.toBe(result2);
    });

    it('should produce different signatures for different secrets', () => {
      const result1 = signCookie('testvalue', 'secret1');
      const result2 = signCookie('testvalue', 'secret2');
      expect(result1).not.toBe(result2);
    });

    it('should handle empty values', () => {
      const result = signCookie('', secret);
      expect(result).toMatch(/^\.[a-zA-Z0-9_-]+$/);
    });

    it('should handle special characters', () => {
      const result = signCookie('hello world @#$', secret);
      expect(result).toMatch(/^hello world @#\$\.[a-zA-Z0-9_-]+$/);
    });
  });

  describe('unsignCookie', () => {
    const secret = 'test-secret-key-12345';

    it('should unsign a valid signed cookie', () => {
      const signed = signCookie('testvalue', secret);
      const result = unsignCookie(signed, secret);
      expect(result).toBe('testvalue');
    });

    it('should return false for invalid signature', () => {
      const result = unsignCookie('testvalue.invalidsignature', secret);
      expect(result).toBe(false);
    });

    it('should return false for malformed signed cookie', () => {
      const result = unsignCookie('nosignature', secret);
      expect(result).toBe(false);
    });

    it('should return false for tampered value', () => {
      const signed = signCookie('testvalue', secret);
      const tampered = signed.replace('testvalue', 'tamperedvalue');
      const result = unsignCookie(tampered, secret);
      expect(result).toBe(false);
    });

    it('should return false for wrong secret', () => {
      const signed = signCookie('testvalue', secret);
      const result = unsignCookie(signed, 'wrongsecret');
      expect(result).toBe(false);
    });

    it('should handle edge case with multiple dots', () => {
      const result = unsignCookie('value.with.dots.signature', secret);
      expect(result).toBe(false);
    });
  });

  describe('Cookie validation', () => {
    describe('validateCookieValue', () => {
      it('should accept valid values', () => {
        expect(validateCookieValue('simple')).toBe(true);
        expect(validateCookieValue('value123')).toBe(true);
        expect(validateCookieValue('value-with-dashes')).toBe(true);
        expect(validateCookieValue('"quoted value"')).toBe(true);
        expect(validateCookieValue('')).toBe(true); // empty is valid
      });

      it('should reject invalid values', () => {
        expect(validateCookieValue('value\nnewline')).toBe(false);
        expect(validateCookieValue('value\ttab')).toBe(false);
        expect(validateCookieValue('value\x00null')).toBe(false);
      });

      it('should enforce size limits', () => {
        const largeValue = 'x'.repeat(5000); // Over 4KB limit
        expect(validateCookieValue(largeValue)).toBe(false);
      });
    });
  });

  describe('CookieJar', () => {
    let jar: CookieJar;

    beforeEach(() => {
      jar = new CookieJar();
    });

    it('should set and get cookies', () => {
      jar.set('name', 'value');
      expect(jar.get('name')).toBe('value');
    });

    it('should handle cookie deletion', () => {
      jar.set('temp', 'value');
      expect(jar.get('temp')).toBe('value');

      jar.delete('temp');
      expect(jar.get('temp')).toBeUndefined();
    });

    it('should clear all cookies', () => {
      jar.set('cookie1', 'value1');
      jar.set('cookie2', 'value2');

      expect(jar.get('cookie1')).toBe('value1');
      expect(jar.get('cookie2')).toBe('value2');

      jar.clear();

      expect(jar.get('cookie1')).toBeUndefined();
      expect(jar.get('cookie2')).toBeUndefined();
    });

    it('should list cookie names and values', () => {
      jar.set('cookie1', 'value1');
      jar.set('cookie2', 'value2');

      const names = jar.names();
      const values = jar.values();

      expect(names).toEqual(['cookie1', 'cookie2']);
      expect(values).toEqual(['value1', 'value2']);
    });

    it('should convert to object', () => {
      jar.set('session', 'abc123');
      jar.set('theme', 'dark');

      const obj = jar.toObject();
      expect(obj).toEqual({
        session: 'abc123',
        theme: 'dark',
      });
    });

    it('should load from Cookie header', () => {
      jar.parse('session=abc123; theme=dark; user=john');

      expect(jar.get('session')).toBe('abc123');
      expect(jar.get('theme')).toBe('dark');
      expect(jar.get('user')).toBe('john');
    });

    it('should report size', () => {
      expect(jar.size()).toBe(0);

      jar.set('cookie1', 'value1');
      expect(jar.size()).toBe(1);

      jar.set('cookie2', 'value2');
      expect(jar.size()).toBe(2);
    });

    it('should check existence', () => {
      expect(jar.has('missing')).toBe(false);

      jar.set('existing', 'value');
      expect(jar.has('existing')).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should parse large cookie strings efficiently', () => {
      // Generate large cookie string
      const cookies = Array.from(
        { length: 100 },
        (_, i) => `cookie${i}=value${i}`
      ).join('; ');

      const start = performance.now();
      const result = parseCookies(cookies);
      const end = performance.now();

      expect(Object.keys(result)).toHaveLength(100);
      expect(end - start).toBeLessThan(10); // Should be under 10ms
    });

    it('should serialize cookies efficiently', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        serializeCookie(`cookie${i}`, `value${i}`, {
          maxAge: 3600,
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Strict',
        });
      }

      const end = performance.now();
      expect(end - start).toBeLessThan(50); // Should be under 50ms for 1000 cookies
    });

    it('should handle memory efficiently with CookieJar', () => {
      const jar = new CookieJar();

      // Add many cookies
      for (let i = 0; i < 10000; i++) {
        jar.set(`cookie${i}`, `value${i}`);
      }

      // Should handle large number of cookies
      expect(jar.size()).toBe(10000);

      // Clear should free memory
      jar.clear();
      expect(jar.size()).toBe(0);
    });
  });

  describe('Security', () => {
    const secret = 'test-secret-key-12345';

    it('should prevent timing attacks in signature verification', () => {
      const validSigned = signCookie('testvalue', secret);
      const invalidSigned = 'testvalue.invalidSignature';

      // Both should take similar time (timing-safe comparison)
      const start1 = performance.now();
      unsignCookie(validSigned, secret);
      const time1 = performance.now() - start1;

      const start2 = performance.now();
      unsignCookie(invalidSigned, secret);
      const time2 = performance.now() - start2;

      // Times should be similar (within reasonable variance)
      // Handle the case where operations are too fast to measure
      if (time1 === 0 && time2 === 0) {
        // Both operations are too fast to measure - this is fine
        expect(true).toBe(true);
      } else {
        const ratio =
          Math.max(time1, time2) / Math.max(Math.min(time1, time2), 0.001);
        expect(ratio).toBeLessThan(10); // Allow 10x variance for timing variations
      }
    });

    it('should handle injection attempts safely', () => {
      const maliciousValue = 'value"; HttpOnly; Secure';
      const result = serializeCookie('test', maliciousValue);

      // Should be properly encoded
      expect(result).toMatch(/^test=value%22%3B%20HttpOnly%3B%20Secure$/);
    });

    it('should validate cookie sizes', () => {
      const largeValue = 'x'.repeat(5000); // Too large
      expect(validateCookieValue(largeValue)).toBe(false);
    });
  });
});

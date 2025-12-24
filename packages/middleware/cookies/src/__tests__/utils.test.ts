/**
 * @nextrush/cookies - Cookie Utilities Tests
 */

import { describe, expect, it } from 'vitest';
import { createDeleteCookie, parseCookies, serializeCookie, signCookie, unsignCookie } from '../utils';

describe('parseCookies', () => {
  it('should parse simple cookie header', () => {
    const result = parseCookies('name=value');
    expect(result).toEqual({ name: 'value' });
  });

  it('should parse multiple cookies', () => {
    const result = parseCookies('name=value; session=abc123; token=xyz');
    expect(result).toEqual({
      name: 'value',
      session: 'abc123',
      token: 'xyz',
    });
  });

  it('should handle empty string', () => {
    expect(parseCookies('')).toEqual({});
  });

  it('should handle null', () => {
    expect(parseCookies(null)).toEqual({});
  });

  it('should handle undefined', () => {
    expect(parseCookies(undefined)).toEqual({});
  });

  it('should decode URL-encoded values', () => {
    const result = parseCookies('name=hello%20world');
    expect(result).toEqual({ name: 'hello world' });
  });

  it('should use raw value when decoding fails', () => {
    const result = parseCookies('name=%invalid%', () => {
      throw new Error('decode error');
    });
    expect(result).toEqual({ name: '%invalid%' });
  });

  it('should handle cookies with spaces around equals', () => {
    const result = parseCookies('name = value');
    expect(result).toEqual({ name: 'value' });
  });

  it('should handle empty cookies in list', () => {
    const result = parseCookies('name=value;;; session=abc');
    expect(result).toEqual({ name: 'value', session: 'abc' });
  });

  it('should handle cookie without value', () => {
    const result = parseCookies('name');
    expect(result).toEqual({});
  });

  it('should handle quoted values', () => {
    const result = parseCookies('name="quoted value"');
    expect(result).toEqual({ name: 'quoted value' });
  });

  it('should handle cookies with equals in value', () => {
    const result = parseCookies('data=base64==');
    expect(result).toEqual({ data: 'base64==' });
  });

  it('should handle many cookies', () => {
    const cookies = Array.from({ length: 10 }, (_, i) => `cookie${i}=value${i}`).join('; ');
    const result = parseCookies(cookies);
    expect(Object.keys(result)).toHaveLength(10);
    expect(result.cookie0).toBe('value0');
    expect(result.cookie9).toBe('value9');
  });

  it('should use custom decode function', () => {
    const decode = (v: string) => v.toUpperCase();
    const result = parseCookies('name=value', decode);
    expect(result).toEqual({ name: 'VALUE' });
  });
});

describe('serializeCookie', () => {
  it('should serialize simple cookie', () => {
    const result = serializeCookie('name', 'value');
    expect(result).toBe('name=value');
  });

  it('should encode special characters in value', () => {
    const result = serializeCookie('name', 'hello world');
    expect(result).toBe('name=hello%20world');
  });

  it('should add domain option', () => {
    const result = serializeCookie('name', 'value', { domain: '.example.com' });
    expect(result).toBe('name=value; Domain=.example.com');
  });

  it('should add expires option', () => {
    const expires = new Date('2024-12-31T23:59:59Z');
    const result = serializeCookie('name', 'value', { expires });
    expect(result).toContain('Expires=');
    expect(result).toContain('Tue, 31 Dec 2024');
  });

  it('should throw for invalid expires', () => {
    expect(() => serializeCookie('name', 'value', { expires: 'invalid' as unknown as Date })).toThrow(
      'expires must be a Date object',
    );
  });

  it('should add maxAge option', () => {
    const result = serializeCookie('name', 'value', { maxAge: 3600 });
    expect(result).toBe('name=value; Max-Age=3600');
  });

  it('should floor maxAge', () => {
    const result = serializeCookie('name', 'value', { maxAge: 3600.5 });
    expect(result).toBe('name=value; Max-Age=3600');
  });

  it('should throw for negative maxAge', () => {
    expect(() => serializeCookie('name', 'value', { maxAge: -1 })).toThrow(
      'maxAge must be a non-negative finite number',
    );
  });

  it('should throw for infinite maxAge', () => {
    expect(() => serializeCookie('name', 'value', { maxAge: Infinity })).toThrow(
      'maxAge must be a non-negative finite number',
    );
  });

  it('should add path option', () => {
    const result = serializeCookie('name', 'value', { path: '/api' });
    expect(result).toBe('name=value; Path=/api');
  });

  it('should add httpOnly option', () => {
    const result = serializeCookie('name', 'value', { httpOnly: true });
    expect(result).toBe('name=value; HttpOnly');
  });

  it('should not add httpOnly when false', () => {
    const result = serializeCookie('name', 'value', { httpOnly: false });
    expect(result).toBe('name=value');
  });

  it('should add secure option', () => {
    const result = serializeCookie('name', 'value', { secure: true });
    expect(result).toBe('name=value; Secure');
  });

  it('should add sameSite strict', () => {
    const result = serializeCookie('name', 'value', { sameSite: 'strict' });
    expect(result).toBe('name=value; SameSite=Strict');
  });

  it('should add sameSite lax', () => {
    const result = serializeCookie('name', 'value', { sameSite: 'lax' });
    expect(result).toBe('name=value; SameSite=Lax');
  });

  it('should add sameSite none with secure', () => {
    const result = serializeCookie('name', 'value', { sameSite: 'none', secure: true });
    expect(result).toBe('name=value; Secure; SameSite=None');
  });

  it('should throw for sameSite none without secure', () => {
    expect(() => serializeCookie('name', 'value', { sameSite: 'none' })).toThrow(
      'SameSite=None requires Secure attribute',
    );
  });

  it('should handle sameSite boolean true', () => {
    const result = serializeCookie('name', 'value', { sameSite: true });
    expect(result).toBe('name=value; SameSite=Strict');
  });

  it('should handle sameSite boolean false', () => {
    const result = serializeCookie('name', 'value', { sameSite: false });
    expect(result).toBe('name=value');
  });

  it('should add priority low', () => {
    const result = serializeCookie('name', 'value', { priority: 'low' });
    expect(result).toBe('name=value; Priority=Low');
  });

  it('should add priority medium', () => {
    const result = serializeCookie('name', 'value', { priority: 'medium' });
    expect(result).toBe('name=value; Priority=Medium');
  });

  it('should add priority high', () => {
    const result = serializeCookie('name', 'value', { priority: 'high' });
    expect(result).toBe('name=value; Priority=High');
  });

  it('should add partitioned option', () => {
    const result = serializeCookie('name', 'value', { partitioned: true });
    expect(result).toBe('name=value; Partitioned');
  });

  it('should combine all options', () => {
    const result = serializeCookie('session', 'abc123', {
      domain: '.example.com',
      path: '/',
      maxAge: 86400,
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });

    expect(result).toContain('session=abc123');
    expect(result).toContain('Domain=.example.com');
    expect(result).toContain('Path=/');
    expect(result).toContain('Max-Age=86400');
    expect(result).toContain('HttpOnly');
    expect(result).toContain('Secure');
    expect(result).toContain('SameSite=Strict');
  });

  it('should throw for invalid cookie name with spaces', () => {
    expect(() => serializeCookie('invalid name', 'value')).toThrow('Invalid cookie name');
  });

  it('should throw for invalid cookie name with special chars', () => {
    expect(() => serializeCookie('invalid;name', 'value')).toThrow('Invalid cookie name');
    expect(() => serializeCookie('invalid=name', 'value')).toThrow('Invalid cookie name');
    expect(() => serializeCookie('invalid,name', 'value')).toThrow('Invalid cookie name');
  });

  it('should throw for empty cookie name', () => {
    expect(() => serializeCookie('', 'value')).toThrow('Invalid cookie name');
  });
});

describe('createDeleteCookie', () => {
  it('should create delete cookie string', () => {
    const result = createDeleteCookie('session');
    expect(result).toContain('session=');
    expect(result).toContain('Expires=');
    expect(result).toContain('Max-Age=0');
  });

  it('should include domain option', () => {
    const result = createDeleteCookie('session', { domain: '.example.com' });
    expect(result).toContain('Domain=.example.com');
  });

  it('should include path option', () => {
    const result = createDeleteCookie('session', { path: '/api' });
    expect(result).toContain('Path=/api');
  });
});

describe('signCookie', () => {
  it('should sign a cookie value', async () => {
    const signed = await signCookie('value', 'secret');
    expect(signed).toMatch(/^value\..+$/);
  });

  it('should produce different signatures for different secrets', async () => {
    const signed1 = await signCookie('value', 'secret1');
    const signed2 = await signCookie('value', 'secret2');
    expect(signed1).not.toBe(signed2);
  });

  it('should produce different signatures for different values', async () => {
    const signed1 = await signCookie('value1', 'secret');
    const signed2 = await signCookie('value2', 'secret');
    expect(signed1).not.toBe(signed2);
  });

  it('should produce consistent signatures', async () => {
    const signed1 = await signCookie('value', 'secret');
    const signed2 = await signCookie('value', 'secret');
    expect(signed1).toBe(signed2);
  });

  it('should use URL-safe base64', async () => {
    const signed = await signCookie('value', 'secret');
    const signature = signed.split('.')[1];
    expect(signature).not.toMatch(/[+/=]/);
  });
});

describe('unsignCookie', () => {
  it('should verify and return valid signed value', async () => {
    const signed = await signCookie('hello', 'secret');
    const result = await unsignCookie(signed, 'secret');
    expect(result).toBe('hello');
  });

  it('should return undefined for tampered value', async () => {
    const signed = await signCookie('hello', 'secret');
    const tampered = 'tampered.' + signed.split('.')[1];
    const result = await unsignCookie(tampered, 'secret');
    expect(result).toBeUndefined();
  });

  it('should return undefined for tampered signature', async () => {
    const signed = await signCookie('hello', 'secret');
    const tampered = signed.slice(0, -1) + 'x';
    const result = await unsignCookie(tampered, 'secret');
    expect(result).toBeUndefined();
  });

  it('should return undefined for wrong secret', async () => {
    const signed = await signCookie('hello', 'secret');
    const result = await unsignCookie(signed, 'wrong-secret');
    expect(result).toBeUndefined();
  });

  it('should return undefined for unsigned value', async () => {
    const result = await unsignCookie('unsigned', 'secret');
    expect(result).toBeUndefined();
  });

  it('should handle value containing dots', async () => {
    const signed = await signCookie('hello.world', 'secret');
    const result = await unsignCookie(signed, 'secret');
    expect(result).toBe('hello.world');
  });
});

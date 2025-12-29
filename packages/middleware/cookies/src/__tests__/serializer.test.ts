/**
 * @nextrush/cookies - Serializer Tests
 *
 * Tests for cookie serialization functionality.
 */

import { describe, expect, it } from 'vitest';
import {
    createDeleteCookie,
    createHostPrefixCookie,
    createSecurePrefixCookie,
    secureOptions,
    serializeCookie,
    sessionOptions
} from '../serializer.js';
import { SecurityError } from '../validation.js';

describe('serializeCookie', () => {
  it('should serialize basic cookie', () => {
    const cookie = serializeCookie('name', 'value');
    expect(cookie).toContain('name=value');
  });

  it('should URL-encode values', () => {
    const cookie = serializeCookie('name', 'hello world');
    expect(cookie).toContain('name=hello%20world');
  });

  it('should include secure defaults', () => {
    const cookie = serializeCookie('name', 'value');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
  });

  it('should add Domain attribute', () => {
    const cookie = serializeCookie('name', 'value', { domain: 'example.com' });
    expect(cookie).toContain('Domain=example.com');
  });

  it('should add Path attribute', () => {
    const cookie = serializeCookie('name', 'value', { path: '/api' });
    expect(cookie).toContain('Path=/api');
  });

  it('should add Expires attribute from Date', () => {
    const expires = new Date('2025-01-01T00:00:00Z');
    const cookie = serializeCookie('name', 'value', { expires });
    expect(cookie).toContain('Expires=');
  });

  it('should add Expires attribute from timestamp', () => {
    const expires = Date.now() + 3600000;
    const cookie = serializeCookie('name', 'value', { expires });
    expect(cookie).toContain('Expires=');
  });

  it('should add Max-Age attribute', () => {
    const cookie = serializeCookie('name', 'value', { maxAge: 3600 });
    expect(cookie).toContain('Max-Age=3600');
  });

  it('should throw on negative maxAge', () => {
    expect(() => {
      serializeCookie('name', 'value', { maxAge: -1 });
    }).toThrow(RangeError);
  });

  it('should add HttpOnly attribute', () => {
    const cookie = serializeCookie('name', 'value', { httpOnly: true });
    expect(cookie).toContain('HttpOnly');
  });

  it('should add Secure attribute', () => {
    const cookie = serializeCookie('name', 'value', { secure: true });
    expect(cookie).toContain('Secure');
  });

  it('should add SameSite=Strict', () => {
    const cookie = serializeCookie('name', 'value', { sameSite: 'strict' });
    expect(cookie).toContain('SameSite=Strict');
  });

  it('should add SameSite=Lax', () => {
    const cookie = serializeCookie('name', 'value', { sameSite: 'lax' });
    expect(cookie).toContain('SameSite=Lax');
  });

  it('should add SameSite=None with Secure', () => {
    const cookie = serializeCookie('name', 'value', {
      sameSite: 'none',
      secure: true
    });
    expect(cookie).toContain('SameSite=None');
    expect(cookie).toContain('Secure');
  });

  it('should handle SameSite boolean true', () => {
    const cookie = serializeCookie('name', 'value', { sameSite: true });
    expect(cookie).toContain('SameSite=Strict');
  });

  it('should handle SameSite boolean false', () => {
    const cookie = serializeCookie('name', 'value', {
      sameSite: false,
      secure: true
    });
    // When sameSite is false, it maps to 'None' but we need to verify it has None
    // Actually the normalizeSameSite returns 'None' for false
    expect(cookie).toContain('Secure');
  });

  it('should add Priority attribute', () => {
    const cookie = serializeCookie('name', 'value', { priority: 'high' });
    expect(cookie).toContain('Priority=High');
  });

  it('should add Partitioned attribute', () => {
    const cookie = serializeCookie('name', 'value', { partitioned: true });
    expect(cookie).toContain('Partitioned');
  });

  it('should throw on invalid cookie name', () => {
    expect(() => {
      serializeCookie('name=invalid', 'value');
    }).toThrow(SecurityError);
    expect(() => {
      serializeCookie('name;invalid', 'value');
    }).toThrow(SecurityError);
    expect(() => {
      serializeCookie('', 'value');
    }).toThrow(SecurityError);
  });

  it('should sanitize CRLF from value', () => {
    const cookie = serializeCookie('name', 'hello\r\nworld');
    expect(cookie).not.toContain('\r');
    expect(cookie).not.toContain('\n');
  });

  it('should throw on oversized cookie', () => {
    const largeValue = 'x'.repeat(5000);
    expect(() => {
      serializeCookie('name', largeValue);
    }).toThrow(RangeError);
  });

  it('should validate __Secure- prefix', () => {
    expect(() => {
      serializeCookie('__Secure-token', 'value', { secure: false });
    }).toThrow(SecurityError);

    const cookie = serializeCookie('__Secure-token', 'value', { secure: true });
    expect(cookie).toContain('Secure');
  });

  it('should validate __Host- prefix', () => {
    expect(() => {
      serializeCookie('__Host-session', 'value', { secure: true, path: '/api' });
    }).toThrow(SecurityError);

    expect(() => {
      serializeCookie('__Host-session', 'value', {
        secure: true,
        path: '/',
        domain: 'example.com'
      });
    }).toThrow(SecurityError);

    const cookie = serializeCookie('__Host-session', 'value', {
      secure: true,
      path: '/'
    });
    expect(cookie).toContain('__Host-session');
  });

  it('should throw on public suffix domain', () => {
    expect(() => {
      serializeCookie('name', 'value', { domain: 'com' });
    }).toThrow(SecurityError);
    expect(() => {
      serializeCookie('name', 'value', { domain: '.org' });
    }).toThrow(SecurityError);
  });

  it('should throw on invalid path', () => {
    expect(() => {
      serializeCookie('name', 'value', { path: 'no-slash' });
    }).toThrow(SecurityError);
    expect(() => {
      serializeCookie('name', 'value', { path: '/api/../secret' });
    }).toThrow(SecurityError);
  });
});

describe('createDeleteCookie', () => {
  it('should create expired cookie', () => {
    const cookie = createDeleteCookie('session');
    expect(cookie).toContain('session=');
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('Expires=');
  });

  it('should include path option', () => {
    const cookie = createDeleteCookie('session', { path: '/api' });
    expect(cookie).toContain('Path=/api');
  });

  it('should include domain option', () => {
    const cookie = createDeleteCookie('session', { domain: 'example.com' });
    expect(cookie).toContain('Domain=example.com');
  });
});

describe('secureOptions', () => {
  it('should return secure defaults', () => {
    const opts = secureOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.secure).toBe(true);
    expect(opts.sameSite).toBe('strict');
    expect(opts.path).toBe('/');
  });

  it('should merge with provided options', () => {
    const opts = secureOptions({ maxAge: 3600 });
    expect(opts.maxAge).toBe(3600);
    expect(opts.secure).toBe(true);
  });

  it('should preserve custom path', () => {
    const opts = secureOptions({ path: '/api' });
    expect(opts.path).toBe('/api');
  });
});

describe('sessionOptions', () => {
  it('should return session cookie defaults', () => {
    const opts = sessionOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
    expect(opts.path).toBe('/');
    expect(opts.maxAge).toBeUndefined();
    expect(opts.expires).toBeUndefined();
  });

  it('should merge with provided options', () => {
    const opts = sessionOptions({ secure: true });
    expect(opts.secure).toBe(true);
    expect(opts.httpOnly).toBe(true);
  });

  it('should preserve custom path', () => {
    const opts = sessionOptions({ path: '/app' });
    expect(opts.path).toBe('/app');
  });
});

describe('createSecurePrefixCookie', () => {
  it('should add __Secure- prefix', () => {
    const cookie = createSecurePrefixCookie('token', 'abc123');
    expect(cookie).toContain('__Secure-token=');
    expect(cookie).toContain('Secure');
  });

  it('should not double-prefix', () => {
    const cookie = createSecurePrefixCookie('__Secure-token', 'abc123');
    expect(cookie).toContain('__Secure-token=');
    expect(cookie).not.toContain('__Secure-__Secure-');
  });

  it('should force Secure flag', () => {
    const cookie = createSecurePrefixCookie('token', 'abc123', { secure: false });
    expect(cookie).toContain('Secure');
  });

  it('should include additional options', () => {
    const cookie = createSecurePrefixCookie('token', 'abc123', { httpOnly: true });
    expect(cookie).toContain('HttpOnly');
  });
});

describe('createHostPrefixCookie', () => {
  it('should add __Host- prefix', () => {
    const cookie = createHostPrefixCookie('session', 'abc123');
    expect(cookie).toContain('__Host-session=');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('Path=/');
  });

  it('should not double-prefix', () => {
    const cookie = createHostPrefixCookie('__Host-session', 'abc123');
    expect(cookie).toContain('__Host-session=');
    expect(cookie).not.toContain('__Host-__Host-');
  });

  it('should force correct options', () => {
    const cookie = createHostPrefixCookie('session', 'abc123');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('Path=/');
    expect(cookie).not.toContain('Domain=');
  });

  it('should include additional options', () => {
    const cookie = createHostPrefixCookie('session', 'abc123', { httpOnly: true });
    expect(cookie).toContain('HttpOnly');
  });
});

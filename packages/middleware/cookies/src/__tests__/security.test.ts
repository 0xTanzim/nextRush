/**
 * @nextrush/cookies - Security Tests
 *
 * Tests for security edge cases and attack prevention.
 */

import { describe, expect, it } from 'vitest';
import {
    parseCookies,
    sanitizeCookieValue,
    SecurityError,
    serializeCookie,
    signCookie,
    unsignCookie
} from '../index.js';

describe('HTTP Response Splitting Prevention', () => {
  it('should prevent CRLF injection in cookie values', () => {
    // Attempt to inject headers via CRLF in value
    const maliciousValue = 'hello\r\nSet-Cookie: evil=injected';
    const cookie = serializeCookie('safe', maliciousValue);

    expect(cookie).not.toContain('\r\n');
    expect(cookie).not.toContain('evil=injected');
  });

  it('should prevent URL-encoded CRLF injection', () => {
    const maliciousValue = 'hello%0d%0aSet-Cookie: evil=injected';
    const sanitized = sanitizeCookieValue(maliciousValue);

    expect(sanitized).not.toContain('%0d');
    expect(sanitized).not.toContain('%0a');
  });

  it('should sanitize CRLF in parsed cookies', () => {
    // Simulate a malicious Cookie header
    const parsed = parseCookies('name=value%0d%0aevil');

    // Sanitization should remove the CRLF sequences
    expect(parsed.name).not.toContain('\r');
    expect(parsed.name).not.toContain('\n');
  });

  it('should handle mixed CRLF variants', () => {
    const variants = [
      'a\rb',
      'a\nb',
      'a\r\nb',
      'a%0db',
      'a%0ab',
      'a%0d%0ab',
      'a%0D%0Ab'
    ];

    for (const variant of variants) {
      const sanitized = sanitizeCookieValue(variant);
      expect(sanitized).toBe('ab');
    }
  });
});

describe('Cookie Tampering Prevention', () => {
  it('should detect tampered signatures', async () => {
    const secret = 'super-secret-key-123';
    const signed = await signCookie('user:admin', secret);

    // Tamper with the signature
    const tampered = signed.slice(0, -1) + 'X';
    const result = await unsignCookie(tampered, secret);

    expect(result).toBeUndefined();
  });

  it('should detect modified values', async () => {
    const secret = 'super-secret-key-123';
    const signed = await signCookie('user:admin', secret);

    // Modify the value but keep signature
    const parts = signed.split('.');
    parts[0] = 'user:hacker';
    const tampered = parts.join('.');
    const result = await unsignCookie(tampered, secret);

    expect(result).toBeUndefined();
  });

  it('should reject unsigned cookies as signed', async () => {
    const secret = 'super-secret-key-123';
    const result = await unsignCookie('just-a-value', secret);

    expect(result).toBeUndefined();
  });

  it('should reject cookies signed with different secret', async () => {
    const signed = await signCookie('data', 'secret-1');
    const result = await unsignCookie(signed, 'secret-2');

    expect(result).toBeUndefined();
  });
});

describe('Cookie Prefix Enforcement', () => {
  it('should enforce __Secure- requirements', () => {
    // Without Secure flag should throw
    expect(() => {
      serializeCookie('__Secure-token', 'value', { secure: false });
    }).toThrow(SecurityError);

    // With Secure flag should work
    const cookie = serializeCookie('__Secure-token', 'value', { secure: true });
    expect(cookie).toContain('Secure');
  });

  it('should enforce __Host- requirements', () => {
    // Without Secure should throw
    expect(() => {
      serializeCookie('__Host-session', 'value', { path: '/' });
    }).toThrow(SecurityError);

    // With Domain should throw
    expect(() => {
      serializeCookie('__Host-session', 'value', {
        secure: true,
        path: '/',
        domain: 'example.com'
      });
    }).toThrow(SecurityError);

    // Without Path=/ should throw
    expect(() => {
      serializeCookie('__Host-session', 'value', {
        secure: true,
        path: '/api'
      });
    }).toThrow(SecurityError);

    // Correct options should work
    const cookie = serializeCookie('__Host-session', 'value', {
      secure: true,
      path: '/'
    });
    expect(cookie).toContain('__Host-session');
  });
});

describe('Domain Validation', () => {
  it('should reject public suffix domains', () => {
    const publicSuffixes = ['com', 'org', 'net', 'co.uk', 'com.au', '.com', '.org'];

    for (const suffix of publicSuffixes) {
      expect(() => {
        serializeCookie('name', 'value', { domain: suffix });
      }).toThrow(SecurityError);
    }
  });

  it('should accept valid private domains', () => {
    const validDomains = ['example.com', '.example.com', 'sub.example.com'];

    for (const domain of validDomains) {
      const cookie = serializeCookie('name', 'value', { domain });
      expect(cookie).toContain(`Domain=${domain}`);
    }
  });

  it('should reject domains with special characters', () => {
    const invalidDomains = [
      'example;.com',
      'example,.com',
      'example\r\n.com',
      'example .com'
    ];

    for (const domain of invalidDomains) {
      expect(() => {
        serializeCookie('name', 'value', { domain });
      }).toThrow(SecurityError);
    }
  });
});

describe('Path Validation', () => {
  it('should reject path traversal attempts', () => {
    const maliciousPaths = [
      '/api/../secret',
      '/api/..%2f',
      '/..%5c',
      '/../../../etc/passwd'
    ];

    for (const path of maliciousPaths) {
      expect(() => {
        serializeCookie('name', 'value', { path });
      }).toThrow(SecurityError);
    }
  });

  it('should accept valid paths', () => {
    const validPaths = ['/', '/api', '/api/v1', '/users/profile'];

    for (const path of validPaths) {
      const cookie = serializeCookie('name', 'value', { path });
      expect(cookie).toContain(`Path=${path}`);
    }
  });

  it('should reject paths without leading slash', () => {
    expect(() => {
      serializeCookie('name', 'value', { path: 'api' });
    }).toThrow(SecurityError);
  });
});

describe('Size Limit Enforcement', () => {
  it('should enforce maximum cookie size', () => {
    const largeValue = 'x'.repeat(5000);

    expect(() => {
      serializeCookie('name', largeValue);
    }).toThrow(RangeError);
  });

  it('should accept cookies under size limit', () => {
    const value = 'x'.repeat(3000);
    const cookie = serializeCookie('name', value);
    expect(cookie).toContain('name=');
  });
});

describe('SameSite None Security', () => {
  it('should require Secure with SameSite=None', () => {
    expect(() => {
      serializeCookie('name', 'value', { sameSite: 'none', secure: false });
    }).toThrow(SecurityError);

    expect(() => {
      serializeCookie('name', 'value', { sameSite: 'none' });
    }).toThrow(SecurityError);
  });

  it('should allow SameSite=None with Secure', () => {
    const cookie = serializeCookie('name', 'value', {
      sameSite: 'none',
      secure: true
    });
    expect(cookie).toContain('SameSite=None');
    expect(cookie).toContain('Secure');
  });
});

describe('Control Character Removal', () => {
  it('should remove null bytes', () => {
    const sanitized = sanitizeCookieValue('hello\x00world');
    expect(sanitized).toBe('helloworld');
  });

  it('should remove other control characters', () => {
    const sanitized = sanitizeCookieValue('hello\x01\x02\x03world');
    expect(sanitized).toBe('helloworld');
  });

  it('should remove DEL character', () => {
    const sanitized = sanitizeCookieValue('hello\x7fworld');
    expect(sanitized).toBe('helloworld');
  });

  it('should preserve printable characters', () => {
    const value = 'Hello World! @#$%^&*()';
    const sanitized = sanitizeCookieValue(value);
    expect(sanitized).toBe(value);
  });
});

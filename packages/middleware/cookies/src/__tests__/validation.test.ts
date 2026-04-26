/**
 * @nextrush/cookies - Validation Tests
 *
 * Tests for security validation functions.
 */

import { describe, expect, it } from 'vitest';
import {
    SecurityError,
    isPublicSuffix,
    isValidCookieName,
    isValidCookieValue,
    isValidDomain,
    isValidPath,
    sanitizeCookieValue,
    validateCookieOptions,
    validateCookiePrefix
} from '../validation.js';

describe('SecurityError', () => {
  it('should create error with code', () => {
    const error = new SecurityError('Test error', 'TEST_CODE');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('SecurityError');
  });

  it('should be instanceof Error', () => {
    const error = new SecurityError('Test', 'CODE');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SecurityError);
  });
});

describe('isValidCookieName', () => {
  it('should accept valid cookie names', () => {
    expect(isValidCookieName('session')).toBe(true);
    expect(isValidCookieName('user_id')).toBe(true);
    expect(isValidCookieName('token123')).toBe(true);
    expect(isValidCookieName('my-cookie')).toBe(true);
    expect(isValidCookieName('X-Custom')).toBe(true);
    expect(isValidCookieName('a')).toBe(true);
  });

  it('should accept cookie prefixes', () => {
    expect(isValidCookieName('__Secure-token')).toBe(true);
    expect(isValidCookieName('__Host-session')).toBe(true);
  });

  it('should reject empty names', () => {
    expect(isValidCookieName('')).toBe(false);
  });

  it('should reject names with separators', () => {
    expect(isValidCookieName('name=value')).toBe(false);
    expect(isValidCookieName('name;value')).toBe(false);
    expect(isValidCookieName('name,value')).toBe(false);
    expect(isValidCookieName('name value')).toBe(false);
  });

  it('should reject names with control characters', () => {
    expect(isValidCookieName('name\x00')).toBe(false);
    expect(isValidCookieName('name\t')).toBe(false);
    expect(isValidCookieName('name\r')).toBe(false);
    expect(isValidCookieName('name\n')).toBe(false);
  });

  it('should reject names with special characters', () => {
    expect(isValidCookieName('name()')).toBe(false);
    expect(isValidCookieName('name[]')).toBe(false);
    expect(isValidCookieName('name{}')).toBe(false);
    expect(isValidCookieName('name"')).toBe(false);
    expect(isValidCookieName('name/')).toBe(false);
    expect(isValidCookieName('name@')).toBe(false);
  });
});

describe('isValidCookieValue', () => {
  it('should accept valid values', () => {
    expect(isValidCookieValue('abc123')).toBe(true);
    expect(isValidCookieValue('hello-world')).toBe(true);
    expect(isValidCookieValue('data_value')).toBe(true);
    expect(isValidCookieValue('')).toBe(true); // Empty is valid
  });

  it('should accept URL-safe characters', () => {
    expect(isValidCookieValue('value%20encoded')).toBe(true);
    expect(isValidCookieValue('a+b=c')).toBe(true);
  });

  // The implementation allows semicolons in values (they get URL encoded)
  it('should accept values with semicolons (will be encoded)', () => {
    expect(isValidCookieValue('value;test')).toBe(true);
  });

  it('should reject values with CRLF', () => {
    expect(isValidCookieValue('value\r\n')).toBe(false);
    expect(isValidCookieValue('value\r')).toBe(false);
    expect(isValidCookieValue('value\n')).toBe(false);
  });

  // Note: The implementation allows control chars but sanitizeCookieValue removes them
  it('should handle values with control characters', () => {
    // validateCookieValue checks for CRLF, not all control chars
    // Control chars are handled by sanitizeCookieValue
    expect(isValidCookieValue('value\x00')).toBe(true); // Will be sanitized
  });
});

describe('sanitizeCookieValue', () => {
  it('should return clean values unchanged', () => {
    expect(sanitizeCookieValue('hello')).toBe('hello');
    expect(sanitizeCookieValue('abc123')).toBe('abc123');
    expect(sanitizeCookieValue('')).toBe('');
  });

  it('should remove CRLF sequences', () => {
    expect(sanitizeCookieValue('hello\r\nworld')).toBe('helloworld');
    expect(sanitizeCookieValue('hello\rworld')).toBe('helloworld');
    expect(sanitizeCookieValue('hello\nworld')).toBe('helloworld');
  });

  it('should remove URL-encoded CRLF', () => {
    expect(sanitizeCookieValue('hello%0d%0aworld')).toBe('helloworld');
    expect(sanitizeCookieValue('hello%0D%0Aworld')).toBe('helloworld');
    expect(sanitizeCookieValue('hello%0dworld')).toBe('helloworld');
    expect(sanitizeCookieValue('hello%0aworld')).toBe('helloworld');
  });

  it('should remove control characters', () => {
    expect(sanitizeCookieValue('hello\x00world')).toBe('helloworld');
    expect(sanitizeCookieValue('hello\x1fworld')).toBe('helloworld');
    expect(sanitizeCookieValue('hello\x7fworld')).toBe('helloworld');
  });

  it('should handle multiple dangerous sequences', () => {
    expect(sanitizeCookieValue('a\rb\nc\r\nd%0d%0ae')).toBe('abcde');
  });
});

describe('isValidDomain', () => {
  it('should accept valid domains', () => {
    expect(isValidDomain('example.com')).toBe(true);
    expect(isValidDomain('.example.com')).toBe(true);
    expect(isValidDomain('sub.example.com')).toBe(true);
    expect(isValidDomain('my-site.example.com')).toBe(true);
    expect(isValidDomain('localhost')).toBe(true);
  });

  it('should reject invalid domains', () => {
    expect(isValidDomain('')).toBe(false);
    expect(isValidDomain('.')).toBe(false);
    expect(isValidDomain('..')).toBe(false);
    expect(isValidDomain('-example.com')).toBe(false);
    expect(isValidDomain('example-.com')).toBe(false);
  });

  it('should reject domains with CRLF', () => {
    expect(isValidDomain('example\r\n.com')).toBe(false);
    expect(isValidDomain('example.com\n')).toBe(false);
  });

  it('should reject domains with special characters', () => {
    expect(isValidDomain('example;.com')).toBe(false);
    expect(isValidDomain('example,.com')).toBe(false);
    expect(isValidDomain('example .com')).toBe(false);
  });
});

describe('isPublicSuffix', () => {
  it('should identify common public suffixes', () => {
    expect(isPublicSuffix('com')).toBe(true);
    expect(isPublicSuffix('org')).toBe(true);
    expect(isPublicSuffix('net')).toBe(true);
    expect(isPublicSuffix('co.uk')).toBe(true);
    expect(isPublicSuffix('com.au')).toBe(true);
  });

  it('should handle leading dots', () => {
    expect(isPublicSuffix('.com')).toBe(true);
    expect(isPublicSuffix('.co.uk')).toBe(true);
  });

  it('should not match private domains', () => {
    expect(isPublicSuffix('example.com')).toBe(false);
    expect(isPublicSuffix('my-site.org')).toBe(false);
  });
});

describe('isValidPath', () => {
  it('should accept valid paths', () => {
    expect(isValidPath('/')).toBe(true);
    expect(isValidPath('/api')).toBe(true);
    expect(isValidPath('/api/v1')).toBe(true);
    expect(isValidPath('/users/123')).toBe(true);
    expect(isValidPath('/path-with-dash')).toBe(true);
    expect(isValidPath('/path_with_underscore')).toBe(true);
  });

  it('should reject paths without leading slash', () => {
    expect(isValidPath('api')).toBe(false);
    expect(isValidPath('api/v1')).toBe(false);
  });

  it('should reject paths with CRLF', () => {
    expect(isValidPath('/api\r\n')).toBe(false);
    expect(isValidPath('/api\n')).toBe(false);
    expect(isValidPath('/api\r')).toBe(false);
  });

  it('should reject path traversal attempts', () => {
    expect(isValidPath('/api/../secret')).toBe(false);
    expect(isValidPath('/api/..%2f')).toBe(false);
    expect(isValidPath('/..%5c')).toBe(false);
  });

  it('should reject paths with dangerous characters', () => {
    expect(isValidPath('/api;evil')).toBe(false);
    expect(isValidPath('/api<script>')).toBe(false);
  });
});

describe('validateCookiePrefix', () => {
  it('should accept __Secure- prefix with secure flag', () => {
    expect(() => {
      validateCookiePrefix('__Secure-token', { secure: true });
    }).not.toThrow();
  });

  it('should reject __Secure- prefix without secure flag', () => {
    expect(() => {
      validateCookiePrefix('__Secure-token', { secure: false });
    }).toThrow(SecurityError);
    expect(() => {
      validateCookiePrefix('__Secure-token', {});
    }).toThrow(SecurityError);
  });

  it('should accept __Host- prefix with correct options', () => {
    expect(() => {
      validateCookiePrefix('__Host-session', { secure: true, path: '/' });
    }).not.toThrow();
  });

  it('should reject __Host- prefix without secure', () => {
    expect(() => {
      validateCookiePrefix('__Host-session', { path: '/' });
    }).toThrow(SecurityError);
  });

  it('should reject __Host- prefix without path=/', () => {
    expect(() => {
      validateCookiePrefix('__Host-session', { secure: true, path: '/api' });
    }).toThrow(SecurityError);
    expect(() => {
      validateCookiePrefix('__Host-session', { secure: true });
    }).toThrow(SecurityError);
  });

  it('should reject __Host- prefix with domain', () => {
    expect(() => {
      validateCookiePrefix('__Host-session', {
        secure: true,
        path: '/',
        domain: 'example.com'
      });
    }).toThrow(SecurityError);
  });

  it('should not validate non-prefixed cookies', () => {
    expect(() => {
      validateCookiePrefix('session', {});
    }).not.toThrow();
    expect(() => {
      validateCookiePrefix('my_cookie', { secure: false });
    }).not.toThrow();
  });
});

describe('validateCookieOptions', () => {
  it('should accept valid options', () => {
    expect(() => {
      validateCookieOptions({
        domain: 'example.com',
        path: '/',
        secure: true
      });
    }).not.toThrow();
  });

  it('should reject public suffix domains', () => {
    expect(() => {
      validateCookieOptions({ domain: 'com' });
    }).toThrow(SecurityError);
    expect(() => {
      validateCookieOptions({ domain: '.org' });
    }).toThrow(SecurityError);
    expect(() => {
      validateCookieOptions({ domain: 'co.uk' });
    }).toThrow(SecurityError);
  });

  it('should reject invalid domains', () => {
    expect(() => {
      validateCookieOptions({ domain: 'example;.com' });
    }).toThrow(SecurityError);
  });

  it('should reject invalid paths', () => {
    expect(() => {
      validateCookieOptions({ path: 'no-leading-slash' });
    }).toThrow(SecurityError);
    expect(() => {
      validateCookieOptions({ path: '/api/../secret' });
    }).toThrow(SecurityError);
  });

  it('should accept options without domain or path', () => {
    expect(() => {
      validateCookieOptions({});
    }).not.toThrow();
    expect(() => {
      validateCookieOptions({ secure: true, httpOnly: true });
    }).not.toThrow();
  });

  it('should reject SameSite=None without Secure', () => {
    expect(() => {
      validateCookieOptions({ sameSite: 'none', secure: false });
    }).toThrow(SecurityError);
    expect(() => {
      validateCookieOptions({ sameSite: 'none' });
    }).toThrow(SecurityError);
  });

  it('should accept SameSite=None with Secure', () => {
    expect(() => {
      validateCookieOptions({ sameSite: 'none', secure: true });
    }).not.toThrow();
  });
});

/**
 * @nextrush/cookies - Comprehensive Edge Case Tests
 *
 * Tests all RFC-0009 fixes and production edge cases:
 * - COOKIES-001: Documented catch blocks
 * - COOKIES-002: Set-Cookie header accumulation (no overwrite)
 * - COOKIES-003: No unsafe type assertions
 * - COOKIES-004: Prototype-safe cookie parsing
 * - COOKIES-005: Dead option fields removed
 * - COOKIES-006: Post-decode CRLF re-sanitization
 * - COOKIES-008/010: Cookie count limits (DoS prevention)
 * - COOKIES-009: CryptoKey cache with bounded eviction
 * - COOKIES-011: Deduped helper functions
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_COOKIES_PER_DOMAIN } from '../constants.js';
import { cookies, secureOptions, sessionOptions, signedCookies } from '../middleware.js';
import { parseCookies } from '../parser.js';
import { createDeleteCookie, serializeCookie } from '../serializer.js';
import {
  clearKeyCache,
  signCookie,
  timingSafeEqual,
  unsignCookie,
  unsignCookieWithRotation,
} from '../signing.js';
import type { CookieContext, SignedCookieContext } from '../types.js';
import { isValidCookieName, isValidCookieValue, sanitizeCookieValue } from '../validation.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockContext(cookieHeader?: string) {
  const responseHeaders: Record<string, string | string[]> = {};
  const state: Record<string, unknown> = {};

  return {
    method: 'GET',
    url: '/',
    path: '/',
    query: {},
    headers: cookieHeader ? { cookie: cookieHeader } : {},
    ip: '127.0.0.1',
    body: undefined,
    params: {},
    status: 200,
    state,
    raw: {
      req: {},
      res: {
        getHeader: (name: string) => responseHeaders[name.toLowerCase()],
        setHeader: (name: string, value: string | string[]) => {
          responseHeaders[name.toLowerCase()] = value;
        },
      },
    },
    json: vi.fn(),
    send: vi.fn(),
    html: vi.fn(),
    redirect: vi.fn(),
    throw: vi.fn(),
    assert: vi.fn(),
    set: vi.fn((field: string, value: string | number) => {
      responseHeaders[field.toLowerCase()] = String(value);
    }),
    get: vi.fn((field: string) => {
      if (field.toLowerCase() === 'cookie') return cookieHeader;
      return undefined;
    }),
    _responseHeaders: responseHeaders,
  };
}

/** Create a mock context without raw.res (for ctx.set fallback path) */
function createMockContextWithoutRaw(cookieHeader?: string) {
  const responseHeaders: Record<string, string | string[]> = {};
  const state: Record<string, unknown> = {};

  return {
    method: 'GET',
    url: '/',
    path: '/',
    query: {},
    headers: cookieHeader ? { cookie: cookieHeader } : {},
    ip: '127.0.0.1',
    body: undefined,
    params: {},
    status: 200,
    state,
    raw: { req: {} },
    json: vi.fn(),
    send: vi.fn(),
    html: vi.fn(),
    redirect: vi.fn(),
    throw: vi.fn(),
    assert: vi.fn(),
    set: vi.fn((field: string, value: string | number) => {
      responseHeaders[field.toLowerCase()] = String(value);
    }),
    get: vi.fn((field: string) => {
      if (field.toLowerCase() === 'cookie') return cookieHeader;
      return undefined;
    }),
    _responseHeaders: responseHeaders,
  };
}

const createNext = () => vi.fn(async () => {});

// ============================================================================
// COOKIES-004: Prototype-Safe Cookie Parsing
// ============================================================================

describe('prototype-safe parsing (COOKIES-004)', () => {
  it('should not inherit Object.prototype properties', () => {
    const result = parseCookies('name=value');
    expect(Object.getPrototypeOf(result)).toBeNull();
  });

  it('should safely handle __proto__ cookie name', () => {
    const result = parseCookies('__proto__=malicious');
    expect(result.__proto__).toBe('malicious');
    // Must not pollute Object.prototype
    expect(({} as Record<string, unknown>).__proto__).not.toBe('malicious');
  });

  it('should safely handle toString cookie name', () => {
    const result = parseCookies('toString=evil');
    expect(result.toString).toBe('evil');
  });

  it('should safely handle constructor cookie name', () => {
    const result = parseCookies('constructor=bad');
    expect(result.constructor).toBe('bad');
  });

  it('should safely handle hasOwnProperty cookie name', () => {
    const result = parseCookies('hasOwnProperty=trick');
    expect(result.hasOwnProperty).toBe('trick');
  });

  it('should safely handle valueOf cookie name', () => {
    const result = parseCookies('valueOf=sneaky');
    expect(result.valueOf).toBe('sneaky');
  });

  it('should not confuse prototype method names with existing cookies', () => {
    const result = parseCookies('toString=1; valueOf=2; constructor=3');
    expect(result.toString).toBe('1');
    expect(result.valueOf).toBe('2');
    expect(result.constructor).toBe('3');
  });

  it('should use Object.hasOwn for duplicate detection', () => {
    // First occurrence wins
    const result = parseCookies('name=first; name=second');
    expect(result.name).toBe('first');
  });
});

// ============================================================================
// COOKIES-008/010: Cookie Count Limit (DoS Prevention)
// ============================================================================

describe('cookie count limit (COOKIES-008/010)', () => {
  it('should enforce default MAX_COOKIES_PER_DOMAIN', () => {
    const pairs = Array.from({ length: 100 }, (_, i) => `c${i}=v${i}`);
    const header = pairs.join('; ');
    const result = parseCookies(header);
    expect(Object.keys(result).length).toBe(MAX_COOKIES_PER_DOMAIN);
  });

  it('should accept custom maxCookies option', () => {
    const pairs = Array.from({ length: 20 }, (_, i) => `c${i}=v${i}`);
    const header = pairs.join('; ');
    const result = parseCookies(header, { maxCookies: 5 });
    expect(Object.keys(result).length).toBe(5);
  });

  it('should work when cookie count is exactly at limit', () => {
    const pairs = Array.from({ length: 50 }, (_, i) => `c${i}=v${i}`);
    const header = pairs.join('; ');
    const result = parseCookies(header);
    expect(Object.keys(result).length).toBe(50);
  });

  it('should work when cookie count is under limit', () => {
    const pairs = Array.from({ length: 3 }, (_, i) => `c${i}=v${i}`);
    const header = pairs.join('; ');
    const result = parseCookies(header);
    expect(Object.keys(result).length).toBe(3);
  });

  it('should preserve first N cookies and discard the rest', () => {
    const pairs = Array.from({ length: 10 }, (_, i) => `c${i}=v${i}`);
    const header = pairs.join('; ');
    const result = parseCookies(header, { maxCookies: 3 });
    expect(result.c0).toBe('v0');
    expect(result.c1).toBe('v1');
    expect(result.c2).toBe('v2');
    expect(result.c3).toBeUndefined();
  });
});

// ============================================================================
// COOKIES-001: Documented Catch Blocks (Parser)
// ============================================================================

describe('parser error handling (COOKIES-001)', () => {
  it('should handle malformed percent-encoding gracefully', () => {
    const result = parseCookies('name=%E0%A4%A'); // truncated sequence
    expect(result.name).toBeDefined();
    // Value should be the raw string since decodeURIComponent fails
    expect(result.name).toBe('%E0%A4%A');
  });

  it('should handle double-encoded percent values', () => {
    const result = parseCookies('name=%2520test');
    // decodeURIComponent('%2520test') → '%20test'
    expect(result.name).toBe('%20test');
  });

  it('should handle completely invalid percent encoding', () => {
    const result = parseCookies('name=%ZZ');
    expect(result.name).toBe('%ZZ');
  });

  it('should skip decoding when decode=false', () => {
    const result = parseCookies('name=hello%20world', { decode: false });
    expect(result.name).toBe('hello%20world');
  });

  it('should handle null and undefined headers', () => {
    expect(parseCookies(null)).toEqual({});
    expect(parseCookies(undefined)).toEqual({});
  });

  it('should handle empty string header', () => {
    expect(Object.keys(parseCookies('')).length).toBe(0);
  });

  it('should handle header with only semicolons', () => {
    expect(Object.keys(parseCookies(';;;')).length).toBe(0);
  });

  it('should handle header with no equals sign', () => {
    const result = parseCookies('nameonly');
    expect(Object.keys(result).length).toBe(0);
  });

  it('should handle cookie value with equals sign', () => {
    const result = parseCookies('base64=abc=def==');
    expect(result.base64).toBe('abc=def==');
  });

  it('should handle empty cookie name', () => {
    const result = parseCookies('=value');
    expect(Object.keys(result).length).toBe(0);
  });

  it('should handle quoted values', () => {
    const result = parseCookies('name="hello world"');
    expect(result.name).toBe('hello world');
  });
});

// ============================================================================
// COOKIES-006: Post-Decode CRLF Re-Sanitization
// ============================================================================

describe('post-decode CRLF sanitization (COOKIES-006)', () => {
  it('should sanitize CRLF injected by custom decode', async () => {
    const maliciousDecode = () => 'value\r\nSet-Cookie: evil=injected';

    const middleware = cookies({ decode: maliciousDecode });
    const ctx = createMockContext('target=anything');

    await middleware(ctx as never, createNext());

    const cookieApi = ctx.state.cookies as CookieContext;
    const value = cookieApi.get('target');
    // CRLF characters must be stripped — the header injection vector is neutralized
    expect(value).not.toContain('\r');
    expect(value).not.toContain('\n');
  });

  it('should sanitize \\n injected by custom decode', async () => {
    const maliciousDecode = () => 'line1\nline2';

    const middleware = cookies({ decode: maliciousDecode });
    const ctx = createMockContext('name=value');

    await middleware(ctx as never, createNext());

    const cookieApi = ctx.state.cookies as CookieContext;
    const value = cookieApi.get('name');
    expect(value).not.toContain('\n');
  });

  it('should sanitize \\r injected by custom decode', async () => {
    const maliciousDecode = () => 'before\rafter';

    const middleware = cookies({ decode: maliciousDecode });
    const ctx = createMockContext('name=value');

    await middleware(ctx as never, createNext());

    const cookieApi = ctx.state.cookies as CookieContext;
    const value = cookieApi.get('name');
    expect(value).not.toContain('\r');
  });

  it('should handle custom decode that throws', async () => {
    const brokenDecode = () => {
      throw new Error('decode failed');
    };

    const middleware = cookies({ decode: brokenDecode });
    const ctx = createMockContext('name=value');

    // Should not throw — fallback to parser-sanitized value
    await middleware(ctx as never, createNext());

    const cookieApi = ctx.state.cookies as CookieContext;
    // Value comes from parser (already sanitized)
    expect(cookieApi.get('name')).toBeDefined();
  });
});

// ============================================================================
// COOKIES-002: Set-Cookie Header Accumulation
// ============================================================================

describe('Set-Cookie header accumulation (COOKIES-002)', () => {
  it('should set multiple cookies without overwriting', async () => {
    const middleware = cookies();
    const ctx = createMockContext();

    const next = vi.fn(async () => {
      const api = ctx.state.cookies as CookieContext;
      api.set('a', '1');
      api.set('b', '2');
      api.set('c', '3');
    });

    await middleware(ctx as never, next);

    const setCookie = ctx._responseHeaders['set-cookie'] as string[];
    expect(setCookie).toHaveLength(3);
    expect(setCookie[0]).toContain('a=1');
    expect(setCookie[1]).toContain('b=2');
    expect(setCookie[2]).toContain('c=3');
  });

  it('should append to existing Set-Cookie headers', async () => {
    const middleware = cookies();
    const ctx = createMockContext();
    // Simulate pre-existing Set-Cookie from another middleware
    ctx._responseHeaders['set-cookie'] = ['existing=cookie'];

    const next = vi.fn(async () => {
      const api = ctx.state.cookies as CookieContext;
      api.set('new', 'value');
    });

    await middleware(ctx as never, next);

    const setCookie = ctx._responseHeaders['set-cookie'] as string[];
    expect(setCookie).toHaveLength(2);
    expect(setCookie[0]).toBe('existing=cookie');
    expect(setCookie[1]).toContain('new=value');
  });

  it('should append when existing Set-Cookie is a single string', async () => {
    const middleware = cookies();
    const ctx = createMockContext();
    // Simulate single string header
    ctx._responseHeaders['set-cookie'] = 'legacy=single';

    const next = vi.fn(async () => {
      const api = ctx.state.cookies as CookieContext;
      api.set('added', 'value');
    });

    await middleware(ctx as never, next);

    const setCookie = ctx._responseHeaders['set-cookie'] as string[];
    expect(setCookie).toHaveLength(2);
    expect(setCookie[0]).toBe('legacy=single');
    expect(setCookie[1]).toContain('added=value');
  });

  it('should fall back to ctx.set when raw.res is unavailable', async () => {
    const middleware = cookies();
    const ctx = createMockContextWithoutRaw();

    const next = vi.fn(async () => {
      const api = ctx.state.cookies as CookieContext;
      api.set('session', 'abc');
    });

    await middleware(ctx as never, next);

    expect(ctx.set).toHaveBeenCalledWith('Set-Cookie', expect.stringContaining('session=abc'));
  });

  it('should not set any cookies when none were added', async () => {
    const middleware = cookies();
    const ctx = createMockContext('existing=value');

    await middleware(ctx as never, createNext());

    expect(ctx._responseHeaders['set-cookie']).toBeUndefined();
  });
});

// ============================================================================
// COOKIES-009: CryptoKey Cache (Bounded Eviction)
// ============================================================================

describe('CryptoKey cache (COOKIES-009)', () => {
  afterEach(() => {
    clearKeyCache();
  });

  it('should produce consistent signatures (cache hit)', async () => {
    const signed1 = await signCookie('value', 'secret1');
    const signed2 = await signCookie('value', 'secret1');
    expect(signed1).toBe(signed2);
  });

  it('should produce different signatures for different secrets', async () => {
    const signed1 = await signCookie('value', 'secret1');
    const signed2 = await signCookie('value', 'secret2');
    expect(signed1).not.toBe(signed2);
  });

  it('should verify after cache clear', async () => {
    const signed = await signCookie('hello', 'my-secret');
    clearKeyCache();
    const result = await unsignCookie(signed, 'my-secret');
    expect(result).toBe('hello');
  });

  it('should handle many different secrets without error', async () => {
    // Exceed the cache capacity
    for (let i = 0; i < 15; i++) {
      const signed = await signCookie('value', `secret-${i}`);
      const result = await unsignCookie(signed, `secret-${i}`);
      expect(result).toBe('value');
    }
  });
});

// ============================================================================
// Signing Edge Cases
// ============================================================================

describe('signing edge cases', () => {
  afterEach(() => {
    clearKeyCache();
  });

  it('should handle values containing the separator dot', async () => {
    const signed = await signCookie('1.2.3.4', 'secret');
    const result = await unsignCookie(signed, 'secret');
    expect(result).toBe('1.2.3.4');
  });

  it('should return undefined for empty signed value', async () => {
    const result = await unsignCookie('', 'secret');
    expect(result).toBeUndefined();
  });

  it('should return undefined for value with no separator', async () => {
    const result = await unsignCookie('noseparator', 'secret');
    expect(result).toBeUndefined();
  });

  it('should return undefined for malformed base64 signature', async () => {
    const result = await unsignCookie('value.!!!invalid!!!base64', 'secret');
    expect(result).toBeUndefined();
  });

  it('should return undefined for wrong secret', async () => {
    const signed = await signCookie('data', 'correct-secret');
    const result = await unsignCookie(signed, 'wrong-secret');
    expect(result).toBeUndefined();
  });

  it('should return undefined for truncated signature', async () => {
    const signed = await signCookie('data', 'secret');
    const truncated = signed.slice(0, -5);
    const result = await unsignCookie(truncated, 'secret');
    expect(result).toBeUndefined();
  });

  it('should handle unicode values', async () => {
    const signed = await signCookie('日本語テスト', 'secret');
    const result = await unsignCookie(signed, 'secret');
    expect(result).toBe('日本語テスト');
  });

  it('should handle very long values', async () => {
    const longValue = 'x'.repeat(4000);
    const signed = await signCookie(longValue, 'secret');
    const result = await unsignCookie(signed, 'secret');
    expect(result).toBe(longValue);
  });

  it('should handle key rotation with multiple previous secrets', async () => {
    const signed = await signCookie('data', 'old-secret-2');
    const result = await unsignCookieWithRotation(signed, {
      current: 'new-secret',
      previous: ['old-secret-1', 'old-secret-2', 'old-secret-3'],
    });
    expect(result).toBe('data');
  });

  it('should return undefined when no key matches', async () => {
    const signed = await signCookie('data', 'original');
    const result = await unsignCookieWithRotation(signed, {
      current: 'not-original',
      previous: ['also-not', 'nope'],
    });
    expect(result).toBeUndefined();
  });
});

// ============================================================================
// Timing-Safe Comparison
// ============================================================================

describe('timingSafeEqual', () => {
  it('should return true for equal strings', () => {
    expect(timingSafeEqual('hello', 'hello')).toBe(true);
  });

  it('should return false for different strings', () => {
    expect(timingSafeEqual('hello', 'world')).toBe(false);
  });

  it('should return false for different length strings', () => {
    expect(timingSafeEqual('short', 'longerstring')).toBe(false);
  });

  it('should return true for empty strings', () => {
    expect(timingSafeEqual('', '')).toBe(true);
  });

  it('should detect single character difference', () => {
    expect(timingSafeEqual('aaaa', 'aaab')).toBe(false);
  });
});

// ============================================================================
// Middleware has() with prototype names
// ============================================================================

describe('middleware has() prototype safety', () => {
  it('should correctly report prototype-named cookies', async () => {
    const middleware = cookies();
    const ctx = createMockContext('toString=x; constructor=y');

    await middleware(ctx as never, createNext());

    const api = ctx.state.cookies as CookieContext;
    expect(api.has('toString')).toBe(true);
    expect(api.has('constructor')).toBe(true);
    expect(api.has('nonexistent')).toBe(false);
  });

  it('should correctly report absence of prototype methods as cookies', async () => {
    const middleware = cookies();
    const ctx = createMockContext('real=value');

    await middleware(ctx as never, createNext());

    const api = ctx.state.cookies as CookieContext;
    expect(api.has('real')).toBe(true);
    // These should NOT show up as cookies even though they exist on Object.prototype
    expect(api.has('toString')).toBe(false);
    expect(api.has('valueOf')).toBe(false);
    expect(api.has('hasOwnProperty')).toBe(false);
  });
});

// ============================================================================
// Middleware set + delete interaction
// ============================================================================

describe('middleware set/delete interaction', () => {
  it('should handle set followed by delete of same cookie', async () => {
    const middleware = cookies();
    const ctx = createMockContext();

    const next = vi.fn(async () => {
      const api = ctx.state.cookies as CookieContext;
      api.set('session', 'value');
      api.delete('session');
    });

    await middleware(ctx as never, next);

    const setCookie = ctx._responseHeaders['set-cookie'] as string[];
    // Both the set and delete should be present (delete wins for browser)
    expect(setCookie).toHaveLength(2);
    expect(setCookie[1]).toContain('Max-Age=0');
  });

  it('should update parsed cookies after set', async () => {
    const middleware = cookies();
    const ctx = createMockContext();

    const next = vi.fn(async () => {
      const api = ctx.state.cookies as CookieContext;
      api.set('session', 'abc');
      expect(api.get('session')).toBe('abc');
      expect(api.has('session')).toBe(true);
    });

    await middleware(ctx as never, next);
  });

  it('should remove from parsed cookies after delete', async () => {
    const middleware = cookies();
    const ctx = createMockContext('session=abc');

    const next = vi.fn(async () => {
      const api = ctx.state.cookies as CookieContext;
      expect(api.has('session')).toBe(true);
      api.delete('session');
      expect(api.has('session')).toBe(false);
      expect(api.get('session')).toBeUndefined();
    });

    await middleware(ctx as never, next);
  });
});

// ============================================================================
// secureOptions / sessionOptions helpers (COOKIES-011)
// ============================================================================

describe('secureOptions helper', () => {
  it('should set httpOnly, secure, sameSite=strict, path=/', () => {
    const opts = secureOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.secure).toBe(true);
    expect(opts.sameSite).toBe('strict');
    expect(opts.path).toBe('/');
  });

  it('should allow overriding maxAge', () => {
    const opts = secureOptions({ maxAge: 3600 });
    expect(opts.maxAge).toBe(3600);
    expect(opts.secure).toBe(true);
  });

  it('should preserve custom path', () => {
    const opts = secureOptions({ path: '/admin' });
    expect(opts.path).toBe('/admin');
  });

  it('should override sameSite from options', () => {
    // The spread order is { ...options, httpOnly, secure, sameSite, path }
    // So sameSite='strict' always wins
    const opts = secureOptions({ sameSite: 'lax' });
    expect(opts.sameSite).toBe('strict');
  });
});

describe('sessionOptions helper', () => {
  it('should set httpOnly, sameSite=lax, path=/, no maxAge', () => {
    const opts = sessionOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
    expect(opts.path).toBe('/');
    expect(opts.maxAge).toBeUndefined();
    expect(opts.expires).toBeUndefined();
  });

  it('should force remove maxAge even if provided', () => {
    const opts = sessionOptions({ maxAge: 3600 });
    expect(opts.maxAge).toBeUndefined();
  });

  it('should force remove expires even if provided', () => {
    const opts = sessionOptions({ expires: new Date() });
    expect(opts.expires).toBeUndefined();
  });

  it('should preserve custom path', () => {
    const opts = sessionOptions({ path: '/app' });
    expect(opts.path).toBe('/app');
  });
});

// ============================================================================
// Validation Edge Cases (sanitizeCookieValue)
// ============================================================================

describe('sanitizeCookieValue edge cases', () => {
  it('should remove \\r\\n sequences', () => {
    expect(sanitizeCookieValue('before\r\nafter')).not.toContain('\r');
    expect(sanitizeCookieValue('before\r\nafter')).not.toContain('\n');
  });

  it('should remove encoded \\r\\n (%0d%0a)', () => {
    const result = sanitizeCookieValue('before%0d%0aafter');
    expect(result).not.toMatch(/%0[dD]%0[aA]/);
  });

  it('should remove null bytes', () => {
    const result = sanitizeCookieValue('before\x00after');
    expect(result).not.toContain('\x00');
  });

  it('should remove control characters', () => {
    const result = sanitizeCookieValue('a\x01b\x02c\x1Fd');
    expect(result).not.toMatch(/[\x00-\x1F]/);
  });

  it('should leave normal values untouched', () => {
    expect(sanitizeCookieValue('hello world')).toBe('hello world');
  });

  it('should handle empty string', () => {
    expect(sanitizeCookieValue('')).toBe('');
  });

  it('should handle string of only control characters', () => {
    const result = sanitizeCookieValue('\r\n\x00\x01');
    expect(result.length).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// Cookie Name Validation Edge Cases
// ============================================================================

describe('cookie name validation edge cases', () => {
  it('should accept alphanumeric names', () => {
    expect(isValidCookieName('session')).toBe(true);
    expect(isValidCookieName('user123')).toBe(true);
  });

  it('should accept underscores and dashes', () => {
    expect(isValidCookieName('my-cookie')).toBe(true);
    expect(isValidCookieName('my_cookie')).toBe(true);
  });

  it('should accept __Secure- prefix', () => {
    expect(isValidCookieName('__Secure-session')).toBe(true);
  });

  it('should accept __Host- prefix', () => {
    expect(isValidCookieName('__Host-session')).toBe(true);
  });

  it('should reject empty name', () => {
    expect(isValidCookieName('')).toBe(false);
  });

  it('should reject name with space', () => {
    expect(isValidCookieName('my cookie')).toBe(false);
  });

  it('should reject name with semicolon', () => {
    expect(isValidCookieName('name;evil')).toBe(false);
  });

  it('should reject name with equals', () => {
    expect(isValidCookieName('name=evil')).toBe(false);
  });
});

// ============================================================================
// Cookie Value Validation Edge Cases
// ============================================================================

describe('cookie value validation edge cases', () => {
  it('should accept normal values', () => {
    expect(isValidCookieValue('hello')).toBe(true);
  });

  it('should accept empty value', () => {
    expect(isValidCookieValue('')).toBe(true);
  });

  it('should reject CRLF in value', () => {
    expect(isValidCookieValue('a\r\nb')).toBe(false);
  });

  it('should reject lone \\r', () => {
    expect(isValidCookieValue('a\rb')).toBe(false);
  });

  it('should reject lone \\n', () => {
    expect(isValidCookieValue('a\nb')).toBe(false);
  });
});

// ============================================================================
// Serializer Edge Cases
// ============================================================================

describe('serializer edge cases', () => {
  it('should serialize cookie with all options', () => {
    const result = serializeCookie('name', 'value', {
      domain: 'example.com',
      path: '/',
      maxAge: 3600,
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });
    expect(result).toContain('name=value');
    expect(result).toContain('Domain=example.com');
    expect(result).toContain('Path=/');
    expect(result).toContain('Max-Age=3600');
    expect(result).toContain('HttpOnly');
    expect(result).toContain('Secure');
    expect(result).toContain('SameSite=Strict');
  });

  it('should create delete cookie with Max-Age=0 and past expiry', () => {
    const result = createDeleteCookie('session');
    expect(result).toContain('session=');
    expect(result).toContain('Max-Age=0');
    expect(result).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('should serialize cookie with expires date', () => {
    const expires = new Date('2025-12-31T23:59:59Z');
    const result = serializeCookie('name', 'value', { expires });
    expect(result).toContain('Expires=');
    expect(result).toContain('2025');
  });
});

// ============================================================================
// Signed Cookie Middleware Full Flow
// ============================================================================

describe('signed cookie middleware full flow', () => {
  afterEach(() => {
    clearKeyCache();
  });

  it('should sign, set, and verify a cookie', async () => {
    const secret = 'test-secret-key';

    // 1. Set signed cookie
    const setCtx = createMockContext();
    const setMiddleware = signedCookies({ secret });

    const setNext = vi.fn(async () => {
      const signedApi = setCtx.state.signedCookies as SignedCookieContext;
      await signedApi.set('auth', 'user123');
    });

    await setMiddleware(setCtx as never, setNext);

    const setCookieHeader = setCtx._responseHeaders['set-cookie'] as string[];
    expect(setCookieHeader).toHaveLength(1);

    // Extract the cookie value
    const cookieValue = setCookieHeader[0].split(';')[0].split('=').slice(1).join('=');

    // 2. Verify signed cookie on next request
    const getCtx = createMockContext(`auth=${cookieValue}`);
    const getMiddleware = signedCookies({ secret });

    await getMiddleware(getCtx as never, createNext());

    const signedApi = getCtx.state.signedCookies as SignedCookieContext;
    const result = await signedApi.get('auth');
    expect(result).toBe('user123');
  });

  it('should reject tampered signed cookie', async () => {
    const secret = 'test-secret';

    // Set
    const setCtx = createMockContext();
    const middleware = signedCookies({ secret });

    const setNext = vi.fn(async () => {
      const api = setCtx.state.signedCookies as SignedCookieContext;
      await api.set('token', 'valid');
    });

    await middleware(setCtx as never, setNext);

    // Tamper
    const setCookieHeader = setCtx._responseHeaders['set-cookie'] as string[];
    const original = setCookieHeader[0].split(';')[0].split('=').slice(1).join('=');
    const tampered = 'tampered' + original.slice(7);

    // Verify
    const getCtx = createMockContext(`token=${tampered}`);
    await middleware(getCtx as never, createNext());

    const api = getCtx.state.signedCookies as SignedCookieContext;
    const result = await api.get('token');
    expect(result).toBeUndefined();
  });

  it('should handle missing signed cookie', async () => {
    const middleware = signedCookies({ secret: 'secret' });
    const ctx = createMockContext();

    await middleware(ctx as never, createNext());

    const api = ctx.state.signedCookies as SignedCookieContext;
    const result = await api.get('nonexistent');
    expect(result).toBeUndefined();
  });

  it('should delete signed cookie with Max-Age=0', async () => {
    const middleware = signedCookies({ secret: 'secret' });
    const ctx = createMockContext('session=value.sig');

    const next = vi.fn(async () => {
      const api = ctx.state.signedCookies as SignedCookieContext;
      api.delete('session');
    });

    await middleware(ctx as never, next);

    const setCookie = ctx._responseHeaders['set-cookie'] as string[];
    expect(setCookie).toHaveLength(1);
    expect(setCookie[0]).toContain('Max-Age=0');
  });
});

// ============================================================================
// Middleware Isolation
// ============================================================================

describe('middleware isolation', () => {
  it('should not leak state between requests', async () => {
    const middleware = cookies();

    // Request 1: set a cookie
    const ctx1 = createMockContext();
    const next1 = vi.fn(async () => {
      const api = ctx1.state.cookies as CookieContext;
      api.set('session', 'user1');
    });
    await middleware(ctx1 as never, next1);

    // Request 2: should not see the cookie
    const ctx2 = createMockContext();
    await middleware(ctx2 as never, createNext());

    const api2 = ctx2.state.cookies as CookieContext;
    expect(api2.get('session')).toBeUndefined();
    expect(api2.has('session')).toBe(false);
  });

  it('should not share setCookies array between requests', async () => {
    const middleware = cookies();

    const ctx1 = createMockContext();
    const next1 = vi.fn(async () => {
      const api = ctx1.state.cookies as CookieContext;
      api.set('a', '1');
    });
    await middleware(ctx1 as never, next1);

    const ctx2 = createMockContext();
    const next2 = vi.fn(async () => {
      const api = ctx2.state.cookies as CookieContext;
      api.set('b', '2');
    });
    await middleware(ctx2 as never, next2);

    const set1 = ctx1._responseHeaders['set-cookie'] as string[];
    const set2 = ctx2._responseHeaders['set-cookie'] as string[];
    expect(set1).toHaveLength(1);
    expect(set2).toHaveLength(1);
    expect(set1[0]).toContain('a=1');
    expect(set2[0]).toContain('b=2');
  });
});

// ============================================================================
// Middleware all() returns a copy
// ============================================================================

describe('middleware all() returns a copy', () => {
  it('should return a shallow copy that is not mutable from outside', async () => {
    const middleware = cookies();
    const ctx = createMockContext('a=1; b=2');

    await middleware(ctx as never, createNext());

    const api = ctx.state.cookies as CookieContext;
    const all = api.all();
    all.a = 'mutated';

    expect(api.get('a')).toBe('1');
  });
});

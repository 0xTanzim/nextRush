/**
 * @nextrush/cookies - Middleware Tests
 */

import { describe, expect, it, vi } from 'vitest';
import { cookies, secureOptions, sessionOptions, signedCookies } from '../middleware';
import type { CookieContext } from '../types';

/**
 * Create a mock context for testing
 */
function createMockContext(cookieHeader?: string) {
  const responseHeaders: Record<string, string | string[]> = {};
  const state: Record<string, unknown> = {};

  const ctx = {
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
    set: vi.fn((field: string, value: string | number | string[]) => {
      const key = field.toLowerCase();
      // Mirror the real ctx.set Set-Cookie contract: strings append, arrays replace.
      if (key === 'set-cookie' && !Array.isArray(value)) {
        const existing = responseHeaders[key];
        if (Array.isArray(existing)) {
          existing.push(String(value));
        } else {
          responseHeaders[key] = [String(value)];
        }
        return;
      }
      responseHeaders[key] = Array.isArray(value) ? value : String(value);
    }),
    get: vi.fn((field: string) => {
      if (field.toLowerCase() === 'cookie') return cookieHeader;
      return undefined;
    }),
    /** Exposed for test assertions */
    _responseHeaders: responseHeaders,
  };

  return ctx;
}

/**
 * Create mock next function
 */
function createNext() {
  return vi.fn().mockResolvedValue(undefined);
}

describe('cookies middleware', () => {
  describe('basic functionality', () => {
    it('should create middleware function', () => {
      const middleware = cookies();
      expect(typeof middleware).toBe('function');
    });

    it('should add cookies to context state', async () => {
      const middleware = cookies();
      const ctx = createMockContext();
      const next = createNext();

      await middleware(ctx as never, next);

      expect(ctx.state.cookies).toBeDefined();
      const cookieApi = ctx.state.cookies as CookieContext;
      expect(typeof cookieApi.get).toBe('function');
      expect(typeof cookieApi.set).toBe('function');
      expect(typeof cookieApi.delete).toBe('function');
      expect(typeof cookieApi.all).toBe('function');
    });

    it('should call next middleware', async () => {
      const middleware = cookies();
      const ctx = createMockContext();
      const next = createNext();

      await middleware(ctx as never, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('get()', () => {
    it('should get a cookie value', async () => {
      const middleware = cookies();
      const ctx = createMockContext('session=abc123');
      const next = createNext();

      await middleware(ctx as never, next);

      const cookieApi = ctx.state.cookies as CookieContext;
      expect(cookieApi.get('session')).toBe('abc123');
    });

    it('should return undefined for missing cookie', async () => {
      const middleware = cookies();
      const ctx = createMockContext('session=abc123');
      const next = createNext();

      await middleware(ctx as never, next);

      const cookieApi = ctx.state.cookies as CookieContext;
      expect(cookieApi.get('missing')).toBeUndefined();
    });

    it('should handle multiple cookies', async () => {
      const middleware = cookies();
      const ctx = createMockContext('name=value; session=abc123; token=xyz');
      const next = createNext();

      await middleware(ctx as never, next);

      const cookieApi = ctx.state.cookies as CookieContext;
      expect(cookieApi.get('name')).toBe('value');
      expect(cookieApi.get('session')).toBe('abc123');
      expect(cookieApi.get('token')).toBe('xyz');
    });
  });

  describe('set()', () => {
    it('should set a cookie', async () => {
      const middleware = cookies();
      const ctx = createMockContext();

      const next = vi.fn(async () => {
        const cookieApi = ctx.state.cookies as CookieContext;
        cookieApi.set('session', 'abc123');
      });

      await middleware(ctx as never, next);

      const setCookie = ctx._responseHeaders['set-cookie'] as string[];
      expect(setCookie).toBeDefined();
      expect(setCookie.some((c: string) => c.includes('session=abc123'))).toBe(true);
    });

    it('should set cookie with options', async () => {
      const middleware = cookies();
      const ctx = createMockContext();

      const next = vi.fn(async () => {
        const cookieApi = ctx.state.cookies as CookieContext;
        cookieApi.set('session', 'abc123', {
          httpOnly: true,
          secure: true,
          maxAge: 3600,
        });
      });

      await middleware(ctx as never, next);

      const setCookie = ctx._responseHeaders['set-cookie'] as string[];
      expect(setCookie).toBeDefined();
      const sessionCookie = setCookie.find((c: string) => c.includes('session=abc123'));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toMatch(/Path=\//);
      expect(sessionCookie).toMatch(/Max-Age=3600/);
      expect(sessionCookie).toMatch(/HttpOnly/);
      expect(sessionCookie).toMatch(/Secure/);
    });
  });

  describe('delete()', () => {
    it('should delete a cookie', async () => {
      const middleware = cookies();
      const ctx = createMockContext('session=abc123');

      const next = vi.fn(async () => {
        const cookieApi = ctx.state.cookies as CookieContext;
        cookieApi.delete('session');
      });

      await middleware(ctx as never, next);

      const setCookie = ctx._responseHeaders['set-cookie'] as string[];
      expect(setCookie).toBeDefined();
      const deleteCookie = setCookie.find((c: string) => c.includes('session='));
      expect(deleteCookie).toBeDefined();
      expect(deleteCookie).toContain('Max-Age=0');
    });
  });

  describe('all()', () => {
    it('should return all cookies', async () => {
      const middleware = cookies();
      const ctx = createMockContext('name=value; session=abc123');
      const next = createNext();

      await middleware(ctx as never, next);

      const cookieApi = ctx.state.cookies as CookieContext;
      expect(cookieApi.all()).toEqual({
        name: 'value',
        session: 'abc123',
      });
    });

    it('should return empty object when no cookies', async () => {
      const middleware = cookies();
      const ctx = createMockContext();
      const next = createNext();

      await middleware(ctx as never, next);

      const cookieApi = ctx.state.cookies as CookieContext;
      expect(cookieApi.all()).toEqual({});
    });
  });
});

describe('signedCookies middleware', () => {
  it('should create middleware function', () => {
    const middleware = signedCookies({ secret: 'secret' });
    expect(typeof middleware).toBe('function');
  });

  it('should throw for missing secret', () => {
    expect(() => signedCookies({ secret: '' })).toThrow('signedCookies requires a secret string');
  });

  it('should add signedCookies to context state', async () => {
    const middleware = signedCookies({ secret: 'secret' });
    const ctx = createMockContext();
    const next = createNext();

    await middleware(ctx as never, next);

    expect(ctx.state.signedCookies).toBeDefined();
  });

  it('should set signed cookies', async () => {
    const middleware = signedCookies({ secret: 'secret' });
    const ctx = createMockContext();

    const next = vi.fn(async () => {
      const signedApi = ctx.state.signedCookies as { set: (n: string, v: string) => Promise<void> };
      await signedApi.set('session', 'abc123');
    });

    await middleware(ctx as never, next);

    const setCookie = ctx._responseHeaders['set-cookie'] as string[];
    expect(setCookie).toBeDefined();
    expect(setCookie.some((c: string) => /session=abc123\..+/.test(c))).toBe(true);
  });

  it('should return undefined for tampered cookie', async () => {
    const middleware = signedCookies({ secret: 'secret' });
    const ctx = createMockContext('session=tampered.invalidsignature');
    const next = createNext();

    await middleware(ctx as never, next);

    const signedApi = ctx.state.signedCookies as {
      get: (n: string) => Promise<string | undefined>;
    };
    const result = await signedApi.get('session');
    expect(result).toBeUndefined();
  });

  it('should delete signed cookies', async () => {
    const middleware = signedCookies({ secret: 'secret' });
    const ctx = createMockContext('session=abc123.signature');

    const next = vi.fn(async () => {
      const signedApi = ctx.state.signedCookies as { delete: (n: string) => void };
      signedApi.delete('session');
    });

    await middleware(ctx as never, next);

    const setCookie = ctx._responseHeaders['set-cookie'] as string[];
    expect(setCookie).toBeDefined();
    const deleteCookie = setCookie.find((c: string) => c.includes('session='));
    expect(deleteCookie).toBeDefined();
    expect(deleteCookie).toContain('Max-Age=0');
  });
});

describe('helper functions', () => {
  describe('secureOptions', () => {
    it('should return secure cookie options', () => {
      const options = secureOptions();

      expect(options.httpOnly).toBe(true);
      expect(options.secure).toBe(true);
      expect(options.sameSite).toBe('strict');
      expect(options.path).toBe('/');
    });

    it('should accept custom options', () => {
      const options = secureOptions({ maxAge: 604800 });
      expect(options.maxAge).toBe(604800);
      expect(options.secure).toBe(true);
    });
  });

  describe('sessionOptions', () => {
    it('should return session cookie options', () => {
      const options = sessionOptions();

      expect(options.httpOnly).toBe(true);
      expect(options.sameSite).toBe('lax');
      expect(options.path).toBe('/');
      expect(options.maxAge).toBeUndefined();
    });
  });
});

describe('CK-1: eager Set-Cookie write (Node immediate-commit safety)', () => {
  it('writes Set-Cookie at set() time, before the response commits', async () => {
    const middleware = cookies();
    const ctx = createMockContext();

    const next = vi.fn(async () => {
      const api = ctx.state.cookies as CookieContext;
      api.set('session', 'abc123');
      // Before next() resolves (i.e. before any deferred/after-next flush and
      // before the handler would commit the response) the header must already
      // be present. Under the old deferred model this array is still undefined.
      const setCookie = ctx._responseHeaders['set-cookie'] as string[] | undefined;
      expect(setCookie).toBeDefined();
      expect(setCookie?.some((c) => c.includes('session=abc123'))).toBe(true);
    });

    await middleware(ctx as never, next);
  });

  it('accumulates multiple cookies set in the same request', async () => {
    const middleware = cookies();
    const ctx = createMockContext();

    const next = vi.fn(async () => {
      const api = ctx.state.cookies as CookieContext;
      api.set('a', '1');
      api.set('b', '2');
    });

    await middleware(ctx as never, next);

    const setCookie = ctx._responseHeaders['set-cookie'] as string[];
    expect(setCookie.some((c) => c.includes('a=1'))).toBe(true);
    expect(setCookie.some((c) => c.includes('b=2'))).toBe(true);
  });
});

describe('CK-4: signed cookie read-after-write', () => {
  it('get() returns the value just set() within the same request', async () => {
    const middleware = signedCookies({ secret: 'secret' });
    const ctx = createMockContext();
    let readBack: string | undefined;

    const next = vi.fn(async () => {
      const api = ctx.state.signedCookies as {
        set: (n: string, v: string) => Promise<void>;
        get: (n: string) => Promise<string | undefined>;
      };
      await api.set('user', 'john');
      readBack = await api.get('user');
    });

    await middleware(ctx as never, next);
    expect(readBack).toBe('john');
  });
});

describe('CK-9: multiple Cookie request headers', () => {
  it('parses cookies when the Cookie header arrives as an array', async () => {
    const middleware = cookies();
    const state: Record<string, unknown> = {};
    // Some proxies / HTTP/2 stacks surface repeated Cookie headers as an array.
    const ctx = {
      method: 'GET',
      headers: { cookie: ['a=1', 'b=2'] },
      state,
      get: (field: string) => (field.toLowerCase() === 'cookie' ? undefined : undefined),
      set: vi.fn(),
    };

    await middleware(ctx as never, vi.fn().mockResolvedValue(undefined));

    const api = ctx.state.cookies as CookieContext;
    expect(api.get('a')).toBe('1');
    expect(api.get('b')).toBe('2');
  });
});

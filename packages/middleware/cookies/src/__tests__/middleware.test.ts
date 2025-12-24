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
    next: vi.fn().mockResolvedValue(undefined),
  };
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

      await middleware(ctx as never);

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

      await middleware(ctx as never);

      expect(ctx.next).toHaveBeenCalled();
    });
  });

  describe('get()', () => {
    it('should get a cookie value', async () => {
      const middleware = cookies();
      const ctx = createMockContext('session=abc123');

      await middleware(ctx as never);

      const cookieApi = ctx.state.cookies as CookieContext;
      expect(cookieApi.get('session')).toBe('abc123');
    });

    it('should return undefined for missing cookie', async () => {
      const middleware = cookies();
      const ctx = createMockContext('session=abc123');

      await middleware(ctx as never);

      const cookieApi = ctx.state.cookies as CookieContext;
      expect(cookieApi.get('missing')).toBeUndefined();
    });

    it('should handle multiple cookies', async () => {
      const middleware = cookies();
      const ctx = createMockContext('name=value; session=abc123; token=xyz');

      await middleware(ctx as never);

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

      ctx.next = vi.fn(async () => {
        const cookieApi = ctx.state.cookies as CookieContext;
        cookieApi.set('session', 'abc123');
      });

      await middleware(ctx as never);

      expect(ctx.set).toHaveBeenCalledWith('Set-Cookie', expect.stringContaining('session=abc123'));
    });

    it('should set cookie with options', async () => {
      const middleware = cookies();
      const ctx = createMockContext();

      ctx.next = vi.fn(async () => {
        const cookieApi = ctx.state.cookies as CookieContext;
        cookieApi.set('session', 'abc123', {
          httpOnly: true,
          secure: true,
          maxAge: 3600,
        });
      });

      await middleware(ctx as never);

      expect(ctx.set).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.stringMatching(/session=abc123.*Max-Age=3600.*Path=\/.*HttpOnly.*Secure/),
      );
    });
  });

  describe('delete()', () => {
    it('should delete a cookie', async () => {
      const middleware = cookies();
      const ctx = createMockContext('session=abc123');

      ctx.next = vi.fn(async () => {
        const cookieApi = ctx.state.cookies as CookieContext;
        cookieApi.delete('session');
      });

      await middleware(ctx as never);

      expect(ctx.set).toHaveBeenCalledWith('Set-Cookie', expect.stringContaining('session='));
      expect(ctx.set).toHaveBeenCalledWith('Set-Cookie', expect.stringContaining('Max-Age=0'));
    });
  });

  describe('all()', () => {
    it('should return all cookies', async () => {
      const middleware = cookies();
      const ctx = createMockContext('name=value; session=abc123');

      await middleware(ctx as never);

      const cookieApi = ctx.state.cookies as CookieContext;
      expect(cookieApi.all()).toEqual({
        name: 'value',
        session: 'abc123',
      });
    });

    it('should return empty object when no cookies', async () => {
      const middleware = cookies();
      const ctx = createMockContext();

      await middleware(ctx as never);

      const cookieApi = ctx.state.cookies as CookieContext;
      expect(cookieApi.all()).toEqual({});
    });
  });
});

describe('signedCookies middleware', () => {
  it('should create middleware function', () => {
    const middleware = signedCookies('secret');
    expect(typeof middleware).toBe('function');
  });

  it('should throw for missing secret', () => {
    expect(() => signedCookies('')).toThrow('Secret key is required');
  });

  it('should add signedCookies to context state', async () => {
    const middleware = signedCookies('secret');
    const ctx = createMockContext();

    await middleware(ctx as never);

    expect(ctx.state.signedCookies).toBeDefined();
  });

  it('should set signed cookies', async () => {
    const middleware = signedCookies('secret');
    const ctx = createMockContext();

    ctx.next = vi.fn(async () => {
      const signedApi = ctx.state.signedCookies as { set: (n: string, v: string) => Promise<void> };
      await signedApi.set('session', 'abc123');
    });

    await middleware(ctx as never);

    expect(ctx.set).toHaveBeenCalledWith('Set-Cookie', expect.stringMatching(/session=abc123\..+/));
  });

  it('should return undefined for tampered cookie', async () => {
    const middleware = signedCookies('secret');
    const ctx = createMockContext('session=tampered.invalidsignature');

    await middleware(ctx as never);

    const signedApi = ctx.state.signedCookies as { get: (n: string) => Promise<string | undefined> };
    const result = await signedApi.get('session');
    expect(result).toBeUndefined();
  });

  it('should delete signed cookies', async () => {
    const middleware = signedCookies('secret');
    const ctx = createMockContext('session=abc123.signature');

    ctx.next = vi.fn(async () => {
      const signedApi = ctx.state.signedCookies as { delete: (n: string) => void };
      signedApi.delete('session');
    });

    await middleware(ctx as never);

    expect(ctx.set).toHaveBeenCalledWith('Set-Cookie', expect.stringContaining('session='));
    expect(ctx.set).toHaveBeenCalledWith('Set-Cookie', expect.stringContaining('Max-Age=0'));
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
      expect(options.maxAge).toBe(86400);
    });

    it('should accept custom maxAge', () => {
      const options = secureOptions(7 * 24 * 60 * 60);
      expect(options.maxAge).toBe(604800);
    });
  });

  describe('sessionOptions', () => {
    it('should return session cookie options', () => {
      const options = sessionOptions();

      expect(options.httpOnly).toBe(true);
      expect(options.secure).toBe(true);
      expect(options.sameSite).toBe('lax');
      expect(options.path).toBe('/');
      expect(options.maxAge).toBeUndefined();
    });
  });
});

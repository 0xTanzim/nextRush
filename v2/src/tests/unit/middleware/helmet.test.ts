/**
 * Helmet Middleware Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  helmet,
  helmetUtils,
  helmetWithMetrics,
} from '../../../core/middleware/helmet';
import type { HelmetOptions } from '../../../core/middleware/types';
import type { Context } from '../../../types/context';

function createMockContext(overrides: Partial<Context> = {}): Context {
  const headers: Record<string, string> = {};
  return {
    req: {
      method: 'GET',
      url: '/test',
      headers: {},
      ...overrides.req,
    } as any,
    res: {
      statusCode: 200,
      headers,
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
      getHeader: (name: string) => headers[name],
      removeHeader: (name: string) => {
        delete headers[name];
      },
      json: (data: unknown) => ({ data }),
      end: () => ({ statusCode: 200 }),
    } as any,
    method: 'GET',
    path: '/test',
    url: '/test',
    headers: {},
    query: {},
    params: {},
    body: undefined,
    id: 'test-id',
    state: {},
    startTime: Date.now(),
    ip: '127.0.0.1',
    secure: false,
    protocol: 'http',
    hostname: 'localhost',
    host: 'localhost:3000',
    origin: 'http://localhost:3000',
    href: 'http://localhost:3000/test',
    search: '',
    searchParams: new URLSearchParams(),
    status: 200,
    responseHeaders: {},
    ...overrides,
  } as Context;
}

describe('Helmet Middleware', () => {
  let ctx: Context;
  let next: () => Promise<void>;

  beforeEach(() => {
    ctx = createMockContext();
    next = async () => {};
  });

  describe('helmet()', () => {
    it('should set basic security headers by default', async () => {
      const middleware = helmet();
      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('X-Content-Type-Options')).toBe('nosniff');
      expect(ctx.res.getHeader('X-Frame-Options')).toBe('SAMEORIGIN');
      expect(ctx.res.getHeader('X-XSS-Protection')).toBe('1; mode=block');
    });

    it('should set Content Security Policy headers', async () => {
      const options: HelmetOptions = {
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
          },
        },
      };

      const middleware = helmet(options);
      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('Content-Security-Policy')).toBeDefined();
    });

    it('should set HSTS headers', async () => {
      const options: HelmetOptions = {
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
      };

      const middleware = helmet(options);
      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('Strict-Transport-Security')).toBe(
        'max-age=31536000; includeSubDomains; preload'
      );
    });

    it('should set Referrer Policy header', async () => {
      const options: HelmetOptions = {
        referrerPolicy: {
          policy: 'strict-origin-when-cross-origin',
        },
      };

      const middleware = helmet(options);
      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('Referrer-Policy')).toBe(
        'strict-origin-when-cross-origin'
      );
    });

    it('should disable specific headers when options are false', async () => {
      const options: HelmetOptions = {
        noSniff: false,
        xssFilter: false,
        frameguard: false,
      };

      const middleware = helmet(options);
      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('X-Content-Type-Options')).toBeUndefined();
      expect(ctx.res.getHeader('X-XSS-Protection')).toBeUndefined();
      expect(ctx.res.getHeader('X-Frame-Options')).toBeUndefined();
    });
  });

  describe('helmetWithMetrics()', () => {
    it('should add performance monitoring', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const middleware = helmetWithMetrics();
      await middleware(ctx, () => Promise.resolve());

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('helmetUtils', () => {
    it('should generate CSP header correctly', () => {
      const directives = {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'"],
      };

      const result = helmetUtils.generateCSPHeader(directives);
      expect(result).toBe(
        "defaultSrc 'self'; scriptSrc 'self' 'unsafe-inline'; styleSrc 'self'"
      );
    });

    it('should have default options', () => {
      expect(helmetUtils.DEFAULT_OPTIONS).toBeDefined();
      expect(helmetUtils.DEFAULT_OPTIONS.hidePoweredBy).toBe(true);
      expect(helmetUtils.DEFAULT_OPTIONS.noSniff).toBe(true);
      expect(helmetUtils.DEFAULT_OPTIONS.xssFilter).toBe(true);
    });
  });
});

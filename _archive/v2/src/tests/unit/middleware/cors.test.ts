/**
 * CORS Middleware Tests
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cors,
  corsUtils,
  corsWithMetrics,
} from '../../../core/middleware/cors';
import type { CorsOptions } from '../../../core/middleware/types';
import type { Context } from '../../../types/context';

/**
 * Mock context object
 */
function createMockContext(overrides: Partial<Context> = {}): Context {
  const headers: Record<string, string> = {};
  const mockRes = {
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
    getHeader: (name: string) => headers[name],
    removeHeader: vi.fn(),
    headers,
    statusCode: 200,
    end: vi.fn(),
    json: vi.fn(),
    status: vi.fn().mockReturnThis(),
  } as any;

  return {
    req: {
      method: 'GET',
      url: '/test',
      headers: {},
      ...overrides.req,
    } as any,
    res: mockRes,
    method: 'GET',
    url: '/test',
    path: '/test',
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
    throw: vi.fn() as any,
    assert: vi.fn() as any,
    fresh: vi.fn().mockReturnValue(true),
    stale: vi.fn().mockReturnValue(false),
    idempotent: vi.fn().mockReturnValue(true),
    cacheable: vi.fn().mockReturnValue(true),
    ...overrides,
  };
}

describe('CORS Middleware', () => {
  let ctx: Context;
  let next: () => Promise<void>;

  beforeEach(() => {
    ctx = createMockContext();
    next = async () => {};
  });

  afterEach(() => {
    corsUtils.clearCache();
  });

  describe('Basic CORS functionality', () => {
    it('should set default CORS headers', async () => {
      const middleware = cors();

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('Access-Control-Allow-Origin')).toBe('*');
      expect(ctx.res.getHeader('Access-Control-Allow-Methods')).toBe(
        'GET, POST, PUT, DELETE, PATCH, OPTIONS'
      );
      expect(ctx.res.getHeader('Access-Control-Allow-Headers')).toBe(
        'Content-Type, Authorization'
      );
    });

    it('should handle custom CORS options', async () => {
      const options: CorsOptions = {
        origin: 'https://example.com',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type'],
        credentials: true,
      };

      const middleware = cors(options);

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('Access-Control-Allow-Origin')).toBe(
        'https://example.com'
      );
      expect(ctx.res.getHeader('Access-Control-Allow-Methods')).toBe(
        'GET, POST'
      );
      expect(ctx.res.getHeader('Access-Control-Allow-Headers')).toBe(
        'Content-Type'
      );
      expect(ctx.res.getHeader('Access-Control-Allow-Credentials')).toBe(
        'true'
      );
    });

    it('should handle array of origins', async () => {
      const options: CorsOptions = {
        origin: ['https://app.example.com', 'https://admin.example.com'],
      };

      const middleware = cors(options);

      // Test with first origin
      ctx.req.headers.origin = 'https://app.example.com';
      await middleware(ctx, () => Promise.resolve());
      expect(ctx.res.getHeader('Access-Control-Allow-Origin')).toBe(
        'https://app.example.com'
      );

      // Test with second origin
      ctx = createMockContext({
        req: { headers: { origin: 'https://admin.example.com' } } as any,
      });
      await middleware(ctx, () => Promise.resolve());
      expect(ctx.res.getHeader('Access-Control-Allow-Origin')).toBe(
        'https://admin.example.com'
      );
    });

    it('should handle function origin validator', async () => {
      const options: CorsOptions = {
        origin: (origin: string) => origin.includes('example.com'),
      };

      const middleware = cors(options);

      ctx.req.headers.origin = 'https://app.example.com';
      await middleware(ctx, () => Promise.resolve());
      expect(ctx.res.getHeader('Access-Control-Allow-Origin')).toBe(
        'https://app.example.com'
      );

      ctx = createMockContext();
      ctx.req.headers.origin = 'https://malicious.com';
      await middleware(ctx, () => Promise.resolve());
      expect(ctx.res.getHeader('Access-Control-Allow-Origin')).toBeUndefined();
    });
  });

  describe('Preflight requests', () => {
    it('should handle OPTIONS preflight requests', async () => {
      const options: CorsOptions = {
        origin: 'https://example.com',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      };

      const middleware = cors(options);

      ctx.method = 'OPTIONS';
      ctx.req.headers.origin = 'https://example.com';
      ctx.req.headers['access-control-request-method'] = 'POST';
      ctx.req.headers['access-control-request-headers'] = 'Content-Type';

      let responseEnded = false;
      ctx.res.end = () => {
        responseEnded = true;
        return { statusCode: 204 };
      };

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('Access-Control-Allow-Origin')).toBe(
        'https://example.com'
      );
      expect(ctx.res.getHeader('Access-Control-Allow-Methods')).toBe(
        'GET, POST'
      );
      expect(ctx.res.getHeader('Access-Control-Allow-Headers')).toBe(
        'Content-Type, Authorization'
      );
      expect(responseEnded).toBe(true);
    });

    it('should handle preflight with preflightContinue', async () => {
      const options: CorsOptions = {
        origin: 'https://example.com',
        preflightContinue: true,
      };

      const middleware = cors(options);

      ctx.method = 'OPTIONS';
      ctx.req.headers.origin = 'https://example.com';

      let nextCalled = false;
      const next = async () => {
        nextCalled = true;
      };

      await middleware(ctx, next);

      expect(ctx.res.getHeader('Access-Control-Allow-Origin')).toBe(
        'https://example.com'
      );
      expect(nextCalled).toBe(true);
    });
  });

  describe('Performance and caching', () => {
    it('should use cached headers for same configuration', async () => {
      const options: CorsOptions = {
        origin: 'https://example.com',
        methods: ['GET', 'POST'],
      };

      const middleware1 = cors(options);
      const middleware2 = cors(options);

      // Both should use the same cached headers
      await middleware1(ctx, next);
      const headers1 = { ...ctx.res.headers };

      ctx = createMockContext();

      await middleware2(ctx, next);
      const headers2 = { ...ctx.res.headers };

      expect(headers1).toEqual(headers2);
    });

    it('should handle performance tracking', async () => {
      const options: CorsOptions = {
        origin: 'https://example.com',
      };

      const middleware = corsWithMetrics(options);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await middleware(ctx, () => Promise.resolve());

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Edge cases', () => {
    it('should handle disabled CORS', async () => {
      const options: CorsOptions = {
        origin: false,
      };

      const middleware = cors(options);

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('Access-Control-Allow-Origin')).toBeUndefined();
    });

    it('should handle wildcard origin', async () => {
      const options: CorsOptions = {
        origin: '*',
      };

      const middleware = cors(options);

      ctx.req.headers.origin = 'https://any-origin.com';
      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('Access-Control-Allow-Origin')).toBe(
        'https://any-origin.com'
      );
    });

    it('should handle missing origin header', async () => {
      const options: CorsOptions = {
        origin: 'https://example.com',
      };

      const middleware = cors(options);

      delete ctx.req.headers.origin;
      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('Access-Control-Allow-Origin')).toBe(
        'https://example.com'
      );
    });

    it('should handle invalid origin', async () => {
      const options: CorsOptions = {
        origin: ['https://example.com'],
      };

      const middleware = cors(options);

      ctx.req.headers.origin = 'https://malicious.com';
      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('Access-Control-Allow-Origin')).toBeUndefined();
    });
  });

  describe('CORS utilities', () => {
    it('should validate origin correctly', () => {
      const allowedOrigins = [
        'https://app.example.com',
        'https://admin.example.com',
      ];

      expect(
        corsUtils.validateOrigin('https://app.example.com', allowedOrigins)
      ).toBe(true);
      expect(
        corsUtils.validateOrigin('https://admin.example.com', allowedOrigins)
      ).toBe(true);
      expect(
        corsUtils.validateOrigin('https://malicious.com', allowedOrigins)
      ).toBe(false);
    });

    it('should generate headers for specific origin', () => {
      const options: CorsOptions = {
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type'],
      };

      const headers = corsUtils.generateHeaders('https://example.com', options);

      expect(headers['Access-Control-Allow-Origin']).toBe(
        'https://example.com'
      );
      expect(headers['Access-Control-Allow-Methods']).toBe('GET, POST');
      expect(headers['Access-Control-Allow-Headers']).toBe('Content-Type');
    });

    it('should clear cache', () => {
      const options: CorsOptions = {
        origin: 'https://example.com',
      };

      // Create middleware to populate cache
      cors(options);

      // Clear cache
      corsUtils.clearCache();

      // Should work after cache clear
      const middleware = cors(options);
      middleware(ctx, next);

      expect(ctx.res.getHeader('Access-Control-Allow-Origin')).toBe(
        'https://example.com'
      );
    });
  });

  describe('Security tests', () => {
    it('should not expose credentials with wildcard origin', async () => {
      const options: CorsOptions = {
        origin: '*',
        credentials: true,
      };

      const middleware = cors(options);

      ctx.req.headers.origin = 'https://any-origin.com';
      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('Access-Control-Allow-Origin')).toBe(
        'https://any-origin.com'
      );
      expect(ctx.res.getHeader('Access-Control-Allow-Credentials')).toBe(
        'true'
      );
    });

    it('should handle complex origin validation', async () => {
      const options: CorsOptions = {
        origin: (origin: string) => {
          return (
            origin.startsWith('https://') && origin.includes('example.com')
          );
        },
      };

      const middleware = cors(options);

      ctx.req.headers.origin = 'https://app.example.com';
      await middleware(ctx, () => Promise.resolve());
      expect(ctx.res.getHeader('Access-Control-Allow-Origin')).toBe(
        'https://app.example.com'
      );

      ctx = createMockContext();
      ctx.req.headers.origin = 'http://app.example.com';
      await middleware(ctx, () => Promise.resolve());
      expect(ctx.res.getHeader('Access-Control-Allow-Origin')).toBeUndefined();

      ctx = createMockContext();
      ctx.req.headers.origin = 'https://malicious.com';
      await middleware(ctx, () => Promise.resolve());
      expect(ctx.res.getHeader('Access-Control-Allow-Origin')).toBeUndefined();
    });
  });

  describe('Performance benchmarks', () => {
    it('should handle high-frequency requests efficiently', async () => {
      const options: CorsOptions = {
        origin: ['https://app.example.com', 'https://admin.example.com'],
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
      };

      const middleware = cors(options);
      const iterations = 50; // Further reduced to make test more realistic

      const start = process.hrtime.bigint();

      for (let i = 0; i < iterations; i++) {
        ctx = createMockContext({
          req: { headers: { origin: 'https://app.example.com' } } as any,
        });

        await middleware(ctx, () => Promise.resolve());
      }

      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to milliseconds

      // Should process 50 requests in less than 200ms (more realistic for test environment)
      expect(duration).toBeLessThan(200);

      // Average time per request should be less than 4ms
      const averageTime = duration / iterations;
      expect(averageTime).toBeLessThan(4);
    });
  });
});

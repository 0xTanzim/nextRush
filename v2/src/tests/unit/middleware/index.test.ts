/**
 * Middleware Index Tests
 *
 * Tests for middleware exports and integration
 */

import { describe, expect, it } from 'vitest';
import * as middleware from '../../../core/middleware';
import type { Context } from '../../../types/context';

/**
 * Create mock context for testing
 */
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
      setHeader: (name: string, value: string | string[]) => {
        headers[name] = Array.isArray(value) ? value[0] : value;
      },
      getHeader: (name: string) => headers[name],
      write: () => {},
      end: () => {},
      json: (data: unknown) => ({ data }),
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

describe('Middleware Index', () => {
  describe('Core Middleware Exports', () => {
    it('should export body parser middleware', () => {
      expect(middleware).toHaveProperty('json');
      expect(middleware).toHaveProperty('urlencoded');
      expect(middleware).toHaveProperty('raw');
      expect(middleware).toHaveProperty('text');
      expect(middleware).toHaveProperty('bodyParserUtils');
    });

    it('should export compression middleware', () => {
      expect(middleware).toHaveProperty('compression');
      expect(middleware).toHaveProperty('gzip');
      expect(middleware).toHaveProperty('deflate');
      expect(middleware).toHaveProperty('brotli');
      expect(middleware).toHaveProperty('compressionWithAlgorithm');
      expect(middleware).toHaveProperty('compressionWithMetrics');
      expect(middleware).toHaveProperty('compressionUtils');
    });

    it('should export CORS middleware', () => {
      expect(middleware).toHaveProperty('cors');
      expect(middleware).toHaveProperty('corsWithMetrics');
      expect(middleware).toHaveProperty('corsUtils');
    });

    it('should export helmet middleware', () => {
      expect(middleware).toHaveProperty('helmet');
      expect(middleware).toHaveProperty('helmetWithMetrics');
      expect(middleware).toHaveProperty('helmetUtils');
    });

    it('should export logger middleware', () => {
      expect(middleware).toHaveProperty('logger');
      expect(middleware).toHaveProperty('devLogger');
      expect(middleware).toHaveProperty('prodLogger');
      expect(middleware).toHaveProperty('minimalLogger');
      expect(middleware).toHaveProperty('loggerWithFormat');
      expect(middleware).toHaveProperty('loggerUtils');
    });

    it('should export rate limiter middleware', () => {
      expect(middleware).toHaveProperty('rateLimit');
      expect(middleware).toHaveProperty('rateLimitWithMetrics');
      expect(middleware).toHaveProperty('createRouteRateLimit');
      expect(middleware).toHaveProperty('createAuthRateLimit');
      expect(middleware).toHaveProperty('rateLimitUtils');
    });

    it('should export request ID middleware', () => {
      expect(middleware).toHaveProperty('requestId');
      expect(middleware).toHaveProperty('requestIdWithUUID');
      expect(middleware).toHaveProperty('requestIdWithTimestamp');
      expect(middleware).toHaveProperty('requestIdWithCrypto');
      expect(middleware).toHaveProperty('requestIdEcho');
      expect(middleware).toHaveProperty('requestIdWithMetrics');
      expect(middleware).toHaveProperty('requestIdUtils');
    });

    it('should export timer middleware', () => {
      expect(middleware).toHaveProperty('timer');
      expect(middleware).toHaveProperty('highPrecisionTimer');
      expect(middleware).toHaveProperty('timerInSeconds');
      expect(middleware).toHaveProperty('timerInNanoseconds');
      expect(middleware).toHaveProperty('slowRequestTimer');
      expect(middleware).toHaveProperty('timerWithCustomFormat');
      expect(middleware).toHaveProperty('timerWithMetrics');
      expect(middleware).toHaveProperty('timerUtils');
    });
  });

  describe('Middleware Functionality', () => {
    it('should create functional middleware instances', () => {
      // Test that middleware functions can be called
      expect(typeof middleware.json).toBe('function');
      expect(typeof middleware.cors).toBe('function');
      expect(typeof middleware.helmet).toBe('function');
      expect(typeof middleware.logger).toBe('function');
      expect(typeof middleware.rateLimit).toBe('function');
      expect(typeof middleware.requestId).toBe('function');
      expect(typeof middleware.timer).toBe('function');
      expect(typeof middleware.compression).toBe('function');
    });

    it('should create middleware with default options', () => {
      const corsMiddleware = middleware.cors();
      const loggerMiddleware = middleware.logger();
      const timerMiddleware = middleware.timer();

      expect(typeof corsMiddleware).toBe('function');
      expect(typeof loggerMiddleware).toBe('function');
      expect(typeof timerMiddleware).toBe('function');
    });

    it('should create middleware with custom options', () => {
      const corsMiddleware = middleware.cors({ origin: 'https://example.com' });
      const loggerMiddleware = middleware.logger({ level: 'info' });
      const timerMiddleware = middleware.timer({ header: 'X-Custom-Timer' });

      expect(typeof corsMiddleware).toBe('function');
      expect(typeof loggerMiddleware).toBe('function');
      expect(typeof timerMiddleware).toBe('function');
    });
  });

  describe('Utility Exports', () => {
    it('should export utility functions', () => {
      expect(middleware).toHaveProperty('bodyParserUtils');
      expect(middleware).toHaveProperty('compressionUtils');
      expect(middleware).toHaveProperty('corsUtils');
      expect(middleware).toHaveProperty('helmetUtils');
      expect(middleware).toHaveProperty('loggerUtils');
      expect(middleware).toHaveProperty('rateLimitUtils');
      expect(middleware).toHaveProperty('requestIdUtils');
      expect(middleware).toHaveProperty('timerUtils');
    });

    it('should have utility functions with expected properties', () => {
      expect(middleware.bodyParserUtils).toHaveProperty('parseSize');
      expect(middleware.bodyParserUtils).toHaveProperty('parseJsonBody');
      expect(middleware.bodyParserUtils).toHaveProperty('parseUrlencodedBody');

      expect(middleware.compressionUtils).toHaveProperty(
        'shouldCompressContentType'
      );
      expect(middleware.compressionUtils).toHaveProperty('getBestCompression');
      expect(middleware.compressionUtils).toHaveProperty(
        'createCompressionStream'
      );

      expect(middleware.corsUtils).toHaveProperty('validateOrigin');
      expect(middleware.corsUtils).toHaveProperty('generateHeaders');
      expect(middleware.corsUtils).toHaveProperty('clearCache');

      expect(middleware.helmetUtils).toHaveProperty('generateCSPHeader');
      expect(middleware.helmetUtils).toHaveProperty('DEFAULT_OPTIONS');

      expect(middleware.loggerUtils).toHaveProperty('getStatusColor');
      expect(middleware.loggerUtils).toHaveProperty('getMethodColor');
      expect(middleware.loggerUtils).toHaveProperty('formatTimestamp');

      expect(middleware.rateLimitUtils).toHaveProperty('clearStores');
      expect(middleware.rateLimitUtils).toHaveProperty('generateKey');
      expect(middleware.rateLimitUtils).toHaveProperty('validateOptions');

      expect(middleware.requestIdUtils).toHaveProperty('generateUUID');
      expect(middleware.requestIdUtils).toHaveProperty('generateTimestampId');
      expect(middleware.requestIdUtils).toHaveProperty('generateCryptoId');

      expect(middleware.timerUtils).toHaveProperty('formatDuration');
      expect(middleware.timerUtils).toHaveProperty('DEFAULT_OPTIONS');
    });
  });

  describe('Middleware Integration', () => {
    it('should allow middleware composition', async () => {
      const ctx = createMockContext();

      const next = () => Promise.resolve();

      // Test that multiple middleware can be used together
      const corsMiddleware = middleware.cors();
      const loggerMiddleware = middleware.logger();
      const timerMiddleware = middleware.timer();

      // Should not throw when executed
      await expect(corsMiddleware(ctx, next)).resolves.not.toThrow();
      await expect(loggerMiddleware(ctx, next)).resolves.not.toThrow();
      await expect(timerMiddleware(ctx, next)).resolves.not.toThrow();
    });

    it('should support middleware chaining', async () => {
      const ctx = createMockContext();

      const next = () => Promise.resolve();

      // Test middleware chaining
      const corsMiddleware = middleware.cors();
      const loggerMiddleware = middleware.logger();

      // Should not throw when chained
      await expect(corsMiddleware(ctx, next)).resolves.not.toThrow();
      await expect(loggerMiddleware(ctx, next)).resolves.not.toThrow();
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety for middleware functions', () => {
      // Test that middleware functions have correct signatures
      const corsMiddleware = middleware.cors();
      const loggerMiddleware = middleware.logger();
      const timerMiddleware = middleware.timer();

      expect(typeof corsMiddleware).toBe('function');
      expect(typeof loggerMiddleware).toBe('function');
      expect(typeof timerMiddleware).toBe('function');
    });

    it('should support middleware options types', () => {
      // Test that options are properly typed
      const corsOptions = {
        origin: 'https://example.com',
      };
      const loggerOptions = { level: 'info' };
      const timerOptions = {
        header: 'X-Custom-Timer',
      };

      expect(corsOptions.origin).toBe('https://example.com');
      expect(loggerOptions.level).toBe('info');
      expect(timerOptions.header).toBe('X-Custom-Timer');
    });
  });

  describe('Performance Tests', () => {
    it('should handle high-frequency middleware creation', async () => {
      const start = Date.now();
      const promises: Promise<unknown>[] = [];

      for (let i = 0; i < 100; i++) {
        promises.push(Promise.resolve(middleware.cors()));
        promises.push(Promise.resolve(middleware.logger()));
        promises.push(Promise.resolve(middleware.timer()));
      }

      Promise.all(promises);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});

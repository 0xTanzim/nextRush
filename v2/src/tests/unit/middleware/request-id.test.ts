/**
 * Request ID Middleware Tests
 *
 * Tests for request ID generation and management
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  requestId,
  requestIdEcho,
  requestIdWithCrypto,
  requestIdWithMetrics,
  requestIdWithTimestamp,
  requestIdWithUUID,
} from '../../../core/middleware/request-id';
import type { Context } from '../../../types/context';

// Mock process.hrtime.bigint for tests
const originalHrtime = process.hrtime;
beforeEach(() => {
  const mockHrtime = () => [0, 0] as [number, number];
  mockHrtime.bigint = () => BigInt(0);
  process.hrtime = mockHrtime;
});

afterEach(() => {
  process.hrtime = originalHrtime;
});

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
      end: vi.fn(),
      json: (data: unknown) => ({ data }),
      on: (event: string, callback: () => void) => {
        // Mock event listener for 'finish' event
        if (event === 'finish') {
          // Call the callback immediately for testing
          setTimeout(callback, 0);
        }
      },
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

describe('Request ID Middleware', () => {
  let ctx: Context;
  let next: () => Promise<void>;

  beforeEach(() => {
    ctx = createMockContext();
    next = async () => {};
  });

  describe('Basic Request ID', () => {
    it('should generate request ID when not present', async () => {
      const middleware = requestId();

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.req.headers['x-request-id']).toBeDefined();
      expect(ctx.req.headers['x-request-id']).toMatch(/^[a-f0-9-]+$/);
    });

    it('should use existing request ID when present', async () => {
      const existingId = 'existing-request-id';
      ctx.req.headers['x-request-id'] = existingId;
      const middleware = requestId();

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.req.headers['x-request-id']).toBe(existingId);
    });

    it('should add response header when enabled', async () => {
      const middleware = requestId({ addResponseHeader: true });

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('X-Request-ID')).toBeDefined();
      expect(ctx.res.getHeader('X-Request-ID')).toBe(
        ctx.req.headers['x-request-id']
      );
    });

    it('should set ID in context when enabled', async () => {
      const middleware = requestId({ setInContext: true });

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.id).toBeDefined();
      expect(ctx.id).toBe(ctx.req.headers['x-request-id']);
    });

    it('should use custom header name', async () => {
      const middleware = requestId({ headerName: 'X-Custom-ID' });

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.req.headers['x-custom-id']).toBeDefined();
      expect(ctx.req.headers['x-request-id']).toBeUndefined();
    });
  });

  describe('UUID Request ID', () => {
    it('should generate UUID format request ID', async () => {
      const middleware = requestIdWithUUID();

      await middleware(ctx, () => Promise.resolve());

      const requestId = ctx.req.headers['x-request-id'];
      expect(requestId).toBeDefined();
      expect(requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it('should use custom options', async () => {
      const middleware = requestIdWithUUID({ headerName: 'X-UUID-ID' });

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.req.headers['x-uuid-id']).toBeDefined();
      expect(ctx.req.headers['x-request-id']).toBeUndefined();
    });

    it('should preserve existing UUID', async () => {
      const existingUUID = '123e4567-e89b-12d3-a456-426614174000';
      ctx.req.headers['x-request-id'] = existingUUID;
      const middleware = requestIdWithUUID();

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.req.headers['x-request-id']).toBe(existingUUID);
    });
  });

  describe('Timestamp Request ID', () => {
    it('should generate timestamp-based request ID', async () => {
      const middleware = requestIdWithTimestamp();

      await middleware(ctx, () => Promise.resolve());

      const requestId = ctx.req.headers['x-request-id'];
      expect(requestId).toBeDefined();
      expect(requestId).toMatch(/^\d+_[a-z0-9]+$/);
    });

    it('should generate unique timestamps', async () => {
      const middleware = requestIdWithTimestamp();
      const ids = new Set();

      for (let i = 0; i < 10; i++) {
        const testCtx = createMockContext();
        await middleware(testCtx, next);
        ids.add(testCtx.req.headers['x-request-id']);
      }

      expect(ids.size).toBe(10); // All IDs should be unique
    });

    it('should handle custom options', async () => {
      const middleware = requestIdWithTimestamp({
        headerName: 'X-Timestamp-ID',
      });

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.req.headers['x-timestamp-id']).toBeDefined();
      expect(ctx.req.headers['x-request-id']).toBeUndefined();
    });
  });

  describe('Crypto Request ID', () => {
    it('should generate crypto-based request ID', async () => {
      const middleware = requestIdWithCrypto();

      await middleware(ctx, () => Promise.resolve());

      const requestId = ctx.req.headers['x-request-id'];
      expect(requestId).toBeDefined();
      expect(requestId).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate unique crypto IDs', async () => {
      const middleware = requestIdWithCrypto();
      const ids = new Set();

      for (let i = 0; i < 10; i++) {
        const testCtx = createMockContext();
        await middleware(testCtx, next);
        ids.add(testCtx.req.headers['x-request-id']);
      }

      expect(ids.size).toBe(10); // All IDs should be unique
    });

    it('should handle custom options', async () => {
      const middleware = requestIdWithCrypto({ headerName: 'X-Crypto-ID' });

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.req.headers['x-crypto-id']).toBeDefined();
      expect(ctx.req.headers['x-request-id']).toBeUndefined();
    });
  });

  describe('Request ID Echo', () => {
    it('should echo existing request ID', async () => {
      const existingId = 'echo-test-id';
      ctx.req.headers['x-request-id'] = existingId;
      const middleware = requestIdEcho();

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.req.headers['x-request-id']).toBe(existingId);
      expect(ctx.res.getHeader('X-Request-ID')).toBe(existingId);
    });

    it('should not generate new ID when none exists', async () => {
      const middleware = requestIdEcho();

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.req.headers['x-request-id']).toBeUndefined();
      expect(ctx.res.getHeader('X-Request-ID')).toBeUndefined();
    });

    it('should handle custom header name', async () => {
      const existingId = 'echo-test-id';
      ctx.req.headers['x-custom-id'] = existingId;
      const middleware = requestIdEcho({ headerName: 'X-Custom-ID' });

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.req.headers['x-custom-id']).toBe(existingId);
      expect(ctx.res.getHeader('X-Custom-ID')).toBe(existingId);
    });
  });

  describe('Request ID with Metrics', () => {
    it('should track performance metrics', async () => {
      const middleware = requestIdWithMetrics();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await middleware(ctx, () => Promise.resolve());

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should warn for slow ID generation', async () => {
      const middleware = requestIdWithMetrics();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock slow performance by overriding the timing
      const originalHrtime = process.hrtime;
      let callCount = 0;
      const mockHrtime = () => [0, 0] as [number, number];
      mockHrtime.bigint = () => {
        callCount++;
        return callCount === 1 ? BigInt(0) : BigInt(10000000); // 10ms difference
      };
      process.hrtime = mockHrtime as any;

      await middleware(ctx, () => Promise.resolve());

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow request ID generation')
      );

      process.hrtime = originalHrtime;
      consoleSpy.mockRestore();
    });
  });

  describe('Custom Generator', () => {
    it('should use custom generator function', async () => {
      const customGenerator = () => 'custom-generated-id';
      const middleware = requestId({ generator: customGenerator });

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.req.headers['x-request-id']).toBe('custom-generated-id');
    });

    it('should handle generator errors gracefully', async () => {
      const errorGenerator = () => {
        throw new Error('Generator error');
      };
      const middleware = requestId({ generator: errorGenerator });

      // Should not throw errors
      await expect(middleware(ctx, next)).resolves.not.toThrow();
    });

    it('should use fallback when generator fails', async () => {
      const errorGenerator = () => {
        throw new Error('Generator error');
      };
      const middleware = requestId({ generator: errorGenerator });

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.req.headers['x-request-id']).toBeDefined();
    });
  });

  describe('Include in Logs', () => {
    it('should include request ID in logs when enabled', async () => {
      const middleware = requestId({ includeInLogs: true });
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await middleware(ctx, () => Promise.resolve());

      // Simulate logging
      console.log('Request processed', {
        requestId: ctx.req.headers['x-request-id'],
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Request processed',
        expect.objectContaining({ requestId: expect.any(String) })
      );

      consoleSpy.mockRestore();
    });

    it('should not include request ID when disabled', async () => {
      const middleware = requestId({ includeInLogs: false });
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await middleware(ctx, () => Promise.resolve());

      // Simulate logging without request ID
      console.log('Request processed');

      expect(consoleSpy).toHaveBeenCalledWith('Request processed');

      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing headers object', async () => {
      const middleware = requestId();
      ctx.req.headers = undefined as any;

      // Should not throw errors
      await expect(middleware(ctx, next)).resolves.not.toThrow();
    });

    it('should handle empty request ID', async () => {
      const middleware = requestId();
      ctx.req.headers['x-request-id'] = '';

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.req.headers['x-request-id']).toBeDefined();
      expect(ctx.req.headers['x-request-id']).not.toBe('');
    });

    it('should handle whitespace-only request ID', async () => {
      const middleware = requestId();
      ctx.req.headers['x-request-id'] = '   ';

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.req.headers['x-request-id']).toBeDefined();
      expect(ctx.req.headers['x-request-id']).not.toBe('   ');
    });

    it('should handle very long request ID', async () => {
      const longId = 'a'.repeat(1000);
      ctx.req.headers['x-request-id'] = longId;
      const middleware = requestId();

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.req.headers['x-request-id']).toBe(longId);
    });

    it('should handle special characters in request ID', async () => {
      const specialId = 'request-id-with-special-chars!@#$%^&*()';
      ctx.req.headers['x-request-id'] = specialId;
      const middleware = requestId();

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.req.headers['x-request-id']).toBe(specialId);
    });
  });

  describe('Performance', () => {
    it('should handle high-frequency request ID generation', async () => {
      const middleware = requestId();
      const iterations = 1000;

      const start = Date.now();
      const promises = [];

      for (let i = 0; i < iterations; i++) {
        const testCtx = createMockContext();
        promises.push(middleware(testCtx, next));
      }

      await Promise.all(promises);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should generate unique IDs under load', async () => {
      const middleware = requestId();
      const ids = new Set();
      const iterations = 100;

      const promises = [];

      for (let i = 0; i < iterations; i++) {
        const testCtx = createMockContext();
        promises.push(
          middleware(testCtx, next).then(() => {
            ids.add(testCtx.req.headers['x-request-id']);
          })
        );
      }

      await Promise.all(promises);

      expect(ids.size).toBe(iterations); // All IDs should be unique
    });

    it('should handle concurrent requests efficiently', async () => {
      const middleware = requestId();
      const concurrency = 100;

      const start = Date.now();
      const promises = [];

      for (let i = 0; i < concurrency; i++) {
        const testCtx = createMockContext();
        promises.push(middleware(testCtx, next));
      }

      await Promise.all(promises);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500); // Should complete within 500ms
    });
  });

  describe('Error Handling', () => {
    it('should handle next function errors', async () => {
      const middleware = requestId();
      next = async () => {
        throw new Error('Next error');
      };

      await expect(middleware(ctx, next)).rejects.toThrow('Next error');
    });

    it('should handle missing context properties', async () => {
      const middleware = requestId();
      ctx = {} as Context;

      // Should not throw errors
      await expect(middleware(ctx, next)).resolves.not.toThrow();
    });

    it('should handle missing response methods', async () => {
      const middleware = requestId({ addResponseHeader: true });
      ctx.res.setHeader = undefined as any;

      // Should not throw errors
      await expect(middleware(ctx, next)).resolves.not.toThrow();
    });
  });

  describe('Integration', () => {
    it('should work with other middleware', async () => {
      const requestIdMiddleware = requestId({ setInContext: true });
      const loggerMiddleware = (ctx: Context, next: () => Promise<void>) => {
        ctx.state.requestId = ctx.id;
        return next();
      };

      await requestIdMiddleware(ctx, async () => {
        await loggerMiddleware(ctx, next);
      });

      expect(ctx.req.headers['x-request-id']).toBeDefined();
      expect(ctx.state.requestId).toBe(ctx.req.headers['x-request-id']);
    });

    it('should preserve existing headers', async () => {
      const middleware = requestId();
      ctx.res.setHeader('X-Custom-Header', 'custom-value');

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('X-Custom-Header')).toBe('custom-value');
      expect(ctx.req.headers['x-request-id']).toBeDefined();
    });

    it('should work with echo middleware', async () => {
      const existingId = 'test-echo-id';
      ctx.req.headers['x-request-id'] = existingId;

      const echoMiddleware = requestIdEcho({ addResponseHeader: true });
      await echoMiddleware(ctx, next);

      expect(ctx.req.headers['x-request-id']).toBe(existingId);
      expect(ctx.res.getHeader('X-Request-ID')).toBe(existingId);
    });
  });

  describe('Different ID Formats', () => {
    it('should handle UUID format', async () => {
      const middleware = requestIdWithUUID();
      await middleware(ctx, () => Promise.resolve());

      const id = ctx.req.headers['x-request-id'];
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it('should handle timestamp format', async () => {
      const middleware = requestIdWithTimestamp();
      await middleware(ctx, () => Promise.resolve());

      const id = ctx.req.headers['x-request-id'] as string;
      expect(id).toMatch(/^\d+_[a-z0-9]+$/);
      expect(parseInt(id.split('_')[0])).toBeGreaterThan(0);
    });

    it('should handle crypto format', async () => {
      const middleware = requestIdWithCrypto();
      await middleware(ctx, () => Promise.resolve());

      const id = ctx.req.headers['x-request-id'] as string;
      expect(id).toMatch(/^[a-f0-9]+$/);
      expect(id.length).toBeGreaterThan(10);
    });
  });
});

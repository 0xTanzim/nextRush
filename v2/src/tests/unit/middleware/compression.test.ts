/**
 * Compression Middleware Tests
 *
 * Tests for compression middleware functionality
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brotli,
  compression,
  compressionUtils,
  compressionWithAlgorithm,
  compressionWithMetrics,
  deflate,
  gzip,
} from '../../../core/middleware/compression';
import type { CompressionOptions } from '../../../core/middleware/types';
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
      write: vi.fn(),
      end: vi.fn(),
      json: (data: unknown) => ({ data }),
    } as any,
    method: 'GET',
    path: '/test',
    status: 200,
    responseHeaders: {},
    ...overrides,
  } as Context;
}

describe('Compression Middleware', () => {
  let ctx: Context;

  beforeEach(() => {
    ctx = createMockContext();
  });

  describe('Basic Compression', () => {
    it('should apply compression when Accept-Encoding includes gzip', async () => {
      const middleware = compression();
      ctx.req.headers['accept-encoding'] = 'gzip, deflate';

      await middleware(ctx, () => Promise.resolve());
      ctx.res.setHeader('Content-Type', 'text/html');

      expect(ctx.res.getHeader('Content-Encoding')).toBe('gzip');
      expect(ctx.res.getHeader('Vary')).toBe('Accept-Encoding');
    });

    it('should not compress when Accept-Encoding is not present', async () => {
      const middleware = compression();

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('Content-Encoding')).toBeUndefined();
      expect(ctx.res.getHeader('Vary')).toBeUndefined();
    });

    it('should not compress when filter returns false', async () => {
      const middleware = compression({
        filter: () => false,
      });
      ctx.req.headers['accept-encoding'] = 'gzip';

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('Content-Encoding')).toBeUndefined();
    });

    it('should handle custom content type filtering', async () => {
      const middleware = compression({
        contentType: ['text/plain'],
        exclude: ['application/json'],
      });
      ctx.req.headers['accept-encoding'] = 'gzip';

      await middleware(ctx, () => Promise.resolve());
      ctx.res.setHeader('Content-Type', 'text/plain');

      expect(ctx.res.getHeader('Content-Encoding')).toBe('gzip');
    });
  });

  describe('Algorithm Selection', () => {
    it('should prefer brotli over gzip when supported', async () => {
      const middleware = compression({
        brotli: true,
        gzip: true,
      });
      ctx.req.headers['accept-encoding'] = 'br, gzip, deflate';

      await middleware(ctx, () => Promise.resolve());
      ctx.res.setHeader('Content-Type', 'text/html');

      expect(ctx.res.getHeader('Content-Encoding')).toBe('br');
    });

    it('should fall back to gzip when brotli not supported', async () => {
      const middleware = compression({
        brotli: true,
        gzip: true,
      });
      ctx.req.headers['accept-encoding'] = 'gzip, deflate';

      await middleware(ctx, () => Promise.resolve());
      ctx.res.setHeader('Content-Type', 'text/html');

      expect(ctx.res.getHeader('Content-Encoding')).toBe('gzip');
    });

    it('should use deflate when only deflate is supported', async () => {
      const middleware = compression({
        deflate: true,
        gzip: false,
        brotli: false,
      });
      ctx.req.headers['accept-encoding'] = 'deflate';

      await middleware(ctx, () => Promise.resolve());
      ctx.res.setHeader('Content-Type', 'text/html');

      expect(ctx.res.getHeader('Content-Encoding')).toBe('deflate');
    });

    it('should not compress when no supported algorithm is accepted', async () => {
      const middleware = compression();
      ctx.req.headers['accept-encoding'] = 'identity';

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('Content-Encoding')).toBeUndefined();
    });
  });

  describe('Content Type Filtering', () => {
    it('should compress text content types', async () => {
      const middleware = compression();
      ctx.req.headers['accept-encoding'] = 'gzip';

      await middleware(ctx, () => Promise.resolve());
      ctx.res.setHeader('Content-Type', 'text/html');

      expect(ctx.res.getHeader('Content-Encoding')).toBe('gzip');
    });

    it('should compress application content types', async () => {
      const middleware = compression();
      ctx.req.headers['accept-encoding'] = 'gzip';

      await middleware(ctx, () => Promise.resolve());
      ctx.res.setHeader('Content-Type', 'application/json');

      expect(ctx.res.getHeader('Content-Encoding')).toBe('gzip');
    });

    it('should not compress excluded content types', async () => {
      const middleware = compression({
        exclude: ['image/*', 'video/*'],
      });
      ctx.req.headers['accept-encoding'] = 'gzip';

      ctx.res.setHeader('Content-Type', 'image/png');
      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('Content-Encoding')).toBeUndefined();
    });

    it('should handle custom content type patterns', async () => {
      const middleware = compression({
        contentType: ['text/*', 'application/json'],
      });
      ctx.req.headers['accept-encoding'] = 'gzip';

      await middleware(ctx, () => Promise.resolve());
      ctx.res.setHeader('Content-Type', 'text/css');

      expect(ctx.res.getHeader('Content-Encoding')).toBe('gzip');
    });
  });

  describe('Algorithm-Specific Middleware', () => {
    it('should create gzip-only middleware', async () => {
      const middleware = gzip();
      ctx.req.headers['accept-encoding'] = 'gzip, deflate';

      await middleware(ctx, () => Promise.resolve());
      ctx.res.setHeader('Content-Type', 'text/html');

      expect(ctx.res.getHeader('Content-Encoding')).toBe('gzip');
    });

    it('should create deflate-only middleware', async () => {
      const middleware = deflate();
      ctx.req.headers['accept-encoding'] = 'deflate, gzip';

      await middleware(ctx, () => Promise.resolve());
      ctx.res.setHeader('Content-Type', 'text/html');

      expect(ctx.res.getHeader('Content-Encoding')).toBe('deflate');
    });

    it('should create brotli-only middleware', async () => {
      const middleware = brotli();
      ctx.req.headers['accept-encoding'] = 'br, gzip';

      await middleware(ctx, () => Promise.resolve());
      ctx.res.setHeader('Content-Type', 'text/html');

      expect(ctx.res.getHeader('Content-Encoding')).toBe('br');
    });

    it('should not compress when algorithm not supported', async () => {
      const middleware = gzip();
      ctx.req.headers['accept-encoding'] = 'deflate';

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('Content-Encoding')).toBeUndefined();
    });
  });

  describe('Compression with Algorithm', () => {
    it('should create middleware with specific algorithm', async () => {
      const middleware = compressionWithAlgorithm('gzip');
      ctx.req.headers['accept-encoding'] = 'gzip, deflate';

      await middleware(ctx, () => Promise.resolve());
      ctx.res.setHeader('Content-Type', 'text/html');

      expect(ctx.res.getHeader('Content-Encoding')).toBe('gzip');
    });

    it('should handle unsupported algorithm gracefully', async () => {
      const middleware = compressionWithAlgorithm('gzip');
      ctx.req.headers['accept-encoding'] = 'deflate';

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('Content-Encoding')).toBeUndefined();
    });
  });

  describe('Compression with Metrics', () => {
    it('should track performance metrics', async () => {
      const middleware = compressionWithMetrics();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      ctx.req.headers['accept-encoding'] = 'gzip';
      await middleware(ctx, () => Promise.resolve());

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should warn for slow compression', async () => {
      const middleware = compressionWithMetrics();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock slow performance
      const originalHrtime = process.hrtime;
      let callCount = 0;
      const mockHrtime = () => [0, 0] as [number, number];
      mockHrtime.bigint = () => {
        callCount++;
        return callCount === 1 ? BigInt(0) : BigInt(5000000); // 5ms difference
      };
      process.hrtime = mockHrtime as any;

      ctx.req.headers['accept-encoding'] = 'gzip';
      // Set content type to trigger compression
      ctx.res.setHeader('Content-Type', 'text/html');
      // Add some content to compress
      ctx.res.write = vi.fn();
      ctx.res.end = vi.fn();
      await middleware(ctx, async () => {
        // Simulate writing content to trigger compression within middleware execution
        ctx.res.write('Hello, World!');
        ctx.res.end();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow compression')
      );

      process.hrtime = originalHrtime;
      consoleSpy.mockRestore();
    });
  });

  describe('Compression Utilities', () => {
    it('should check if content type should be compressed', () => {
      const options = {
        contentType: ['text/*', 'application/*'],
        exclude: ['image/*'],
      } as Required<CompressionOptions>;

      expect(
        compressionUtils.shouldCompressContentType('text/html', options)
      ).toBe(true);
      expect(
        compressionUtils.shouldCompressContentType('application/json', options)
      ).toBe(true);
      expect(
        compressionUtils.shouldCompressContentType('image/png', options)
      ).toBe(false);
      expect(
        compressionUtils.shouldCompressContentType('video/mp4', options)
      ).toBe(false);
    });

    it('should get best compression algorithm', () => {
      const options = {
        gzip: true,
        deflate: true,
        brotli: true,
      } as Required<CompressionOptions>;

      expect(compressionUtils.getBestCompression('br, gzip', options)).toBe(
        'br'
      );
      expect(
        compressionUtils.getBestCompression('gzip, deflate', options)
      ).toBe('gzip');
      expect(compressionUtils.getBestCompression('deflate', options)).toBe(
        'deflate'
      );
      expect(
        compressionUtils.getBestCompression('identity', options)
      ).toBeNull();
    });

    it('should create compression streams', () => {
      const options = {
        level: 6,
        windowBits: 15,
        memLevel: 8,
        strategy: 0,
        chunkSize: 16 * 1024,
      } as Required<CompressionOptions>;

      expect(() =>
        compressionUtils.createCompressionStream('gzip', options)
      ).not.toThrow();
      expect(() =>
        compressionUtils.createCompressionStream('deflate', options)
      ).not.toThrow();
      expect(() =>
        compressionUtils.createCompressionStream('br', options)
      ).not.toThrow();
    });

    it('should throw error for unsupported algorithm', () => {
      const options = {} as Required<CompressionOptions>;

      expect(() =>
        compressionUtils.createCompressionStream('unsupported' as any, options)
      ).toThrow('Unsupported compression algorithm: unsupported');
    });

    it('should have default options', () => {
      expect(compressionUtils.DEFAULT_OPTIONS).toBeDefined();
      expect(compressionUtils.DEFAULT_OPTIONS.level).toBe(6);
      expect(compressionUtils.DEFAULT_OPTIONS.threshold).toBe(1024);
      expect(compressionUtils.DEFAULT_OPTIONS.gzip).toBe(true);
      expect(compressionUtils.DEFAULT_OPTIONS.deflate).toBe(true);
      expect(compressionUtils.DEFAULT_OPTIONS.brotli).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing Accept-Encoding header', async () => {
      const middleware = compression();

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('Content-Encoding')).toBeUndefined();
    });

    it('should handle empty Accept-Encoding header', async () => {
      const middleware = compression();
      ctx.req.headers['accept-encoding'] = '';

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('Content-Encoding')).toBeUndefined();
    });

    it('should handle malformed Accept-Encoding header', async () => {
      const middleware = compression();
      ctx.req.headers['accept-encoding'] = 'invalid-encoding';

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('Content-Encoding')).toBeUndefined();
    });

    it('should handle case-insensitive Accept-Encoding', async () => {
      const middleware = compression();
      ctx.req.headers['accept-encoding'] = 'GZIP, DEFLATE';

      await middleware(ctx, () => Promise.resolve());
      ctx.res.setHeader('Content-Type', 'text/html');

      expect(ctx.res.getHeader('Content-Encoding')).toBe('gzip');
    });

    it('should handle quality values in Accept-Encoding', async () => {
      const middleware = compression();
      ctx.req.headers['accept-encoding'] = 'gzip;q=0.8, deflate;q=0.6';

      await middleware(ctx, () => Promise.resolve());
      ctx.res.setHeader('Content-Type', 'text/html');

      expect(ctx.res.getHeader('Content-Encoding')).toBe('gzip');
    });
  });

  describe('Performance', () => {
    it('should handle high-frequency compression requests', async () => {
      const middleware = compression();
      const iterations = 100;

      const start = Date.now();
      const promises: Promise<void>[] = [];

      for (let i = 0; i < iterations; i++) {
        const testCtx = createMockContext({
          req: { headers: { 'accept-encoding': 'gzip' } } as any,
        });
        promises.push(middleware(testCtx, () => Promise.resolve()));
      }

      await Promise.all(promises);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle different content types efficiently', async () => {
      const middleware = compression();
      const contentTypes = [
        'text/html',
        'application/json',
        'text/css',
        'application/xml',
      ];

      const start = Date.now();

      for (const contentType of contentTypes) {
        const testCtx = createMockContext({
          req: { headers: { 'accept-encoding': 'gzip' } } as any,
        });
        testCtx.res.setHeader('Content-Type', contentType);
        await middleware(testCtx, () => Promise.resolve());
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should complete within 100ms
    });
  });

  describe('Error Handling', () => {
    it('should handle compression stream errors gracefully', async () => {
      const middleware = compression();
      ctx.req.headers['accept-encoding'] = 'gzip';

      // Mock setHeader to trigger compression
      ctx.res.setHeader('Content-Type', 'text/plain');

      // Should not throw errors
      await expect(
        middleware(ctx, () => Promise.resolve())
      ).resolves.not.toThrow();
    });

    it('should handle missing response methods', async () => {
      const middleware = compression();
      ctx.req.headers['accept-encoding'] = 'gzip';
      ctx.res.setHeader = undefined as any;

      // Should not throw errors
      await expect(
        middleware(ctx, () => Promise.resolve())
      ).resolves.not.toThrow();
    });
  });
});

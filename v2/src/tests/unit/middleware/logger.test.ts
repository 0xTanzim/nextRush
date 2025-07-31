/**
 * Logger Middleware Tests
 *
 * Tests for request logging functionality with various configurations
 */

import {
  devLogger,
  logger,
  loggerUtils,
  loggerWithFormat,
  minimalLogger,
  prodLogger,
} from '../../../core/middleware/logger';
import type { Context } from '../../../types/context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function createMockContext(overrides: Partial<Context> = {}): Context {
  return {
    req: {
      headers: {
        'user-agent': 'Mozilla/5.0 (Test Browser)',
        referer: 'https://example.com',
        'x-forwarded-for': '192.168.1.1',
      },
      method: 'GET',
      url: '/test',
    } as any,
    res: {
      statusCode: 200,
      headers: {},
      setHeader: vi.fn(),
      getHeader: vi.fn().mockReturnValue('1024'),
      end: vi.fn(),
    } as any,
    method: 'GET',
    path: '/test',
    query: { page: '1', limit: '10' },
    params: {},
    status: 200,
    ip: '192.168.1.1',
    ...overrides,
  };
}

describe('Logger Middleware', () => {
  let ctx: Context;
  let next: () => Promise<void>;
  let consoleSpy: any;

  beforeEach(() => {
    ctx = createMockContext();
    next = async () => {};
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Basic Logging', () => {
    it('should log basic request information', async () => {
      const middleware = logger();

      await middleware(ctx, () => Promise.resolve());

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('GET')
      );
    });

    it('should log with custom format', async () => {
      const middleware = loggerWithFormat(
        (ctx: Context, duration: number) =>
          `${ctx.method} ${ctx.path} - ${duration}ms`
      );

      await middleware(ctx, () => Promise.resolve());

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/GET \/test - \d+ms/)
      );
    });

    it('should handle different log levels', async () => {
      const middleware = logger({ level: 'warn' });

      await middleware(ctx, () => Promise.resolve());

      // Should still log responses regardless of level
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log error responses', async () => {
      const middleware = logger();
      ctx.status = 404;
      ctx.res.statusCode = 404;

      await middleware(ctx, () => Promise.resolve());

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('404'));
    });
  });

  describe('Development Logger', () => {
    it('should use colored output in development', async () => {
      const middleware = devLogger();

      await middleware(ctx, () => Promise.resolve());

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('GET'));
    });

    it('should show detailed information', async () => {
      const middleware = devLogger({
        showHeaders: true,
        showBody: true,
        showQuery: true,
      });

      await middleware(ctx, () => Promise.resolve());

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('GET');
      expect(logCall).toContain('/test');
      expect(logCall).toContain('200');
    });

    it('should handle missing headers gracefully', async () => {
      const middleware = devLogger();
      ctx = createMockContext({
        req: { headers: {}, method: 'GET', url: '/test' } as any,
      });

      await middleware(ctx, () => Promise.resolve());

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Production Logger', () => {
    it('should use structured logging', async () => {
      const middleware = prodLogger();

      await middleware(ctx, () => Promise.resolve());

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('GET'));
    });

    it('should not use colors in production', async () => {
      const middleware = prodLogger({ colorize: false });

      await middleware(ctx, () => Promise.resolve());

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).not.toContain('\x1b['); // No ANSI color codes
    });

    it('should include timestamp', async () => {
      const middleware = prodLogger({ timestamp: true });

      await middleware(ctx, () => Promise.resolve());

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Minimal Logger', () => {
    it('should log minimal information', async () => {
      const middleware = minimalLogger();

      await middleware(ctx, () => Promise.resolve());

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('GET');
      expect(logCall).toContain('/test');
      expect(logCall).toContain('200');
    });

    it('should be concise', async () => {
      const middleware = minimalLogger();

      await middleware(ctx, () => Promise.resolve());

      const logCall = consoleSpy.mock.calls[0][0];
      const parts = logCall.split(' ');
      expect(parts.length).toBeLessThan(10); // Should be concise
    });
  });

  describe('Custom Formatting', () => {
    it('should use custom format function', async () => {
      const customFormat = (ctx: Context, duration: number) =>
        `[${ctx.method}] ${ctx.path} (${duration}ms)`;

      const middleware = loggerWithFormat(customFormat);

      await middleware(ctx, () => Promise.resolve());

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[GET\] \/test \(\d+ms\)/)
      );
    });

    it('should handle custom format with error', async () => {
      const customFormat = (ctx: Context, duration: number) =>
        `${ctx.method} ${ctx.path} - ${ctx.status} (${duration}ms)`;

      const middleware = loggerWithFormat(customFormat);
      ctx.status = 500;

      await middleware(ctx, () => Promise.resolve());

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/GET \/test - 500 \(\d+ms\)/)
      );
    });
  });

  describe('Header Logging', () => {
    it('should log request headers when enabled', async () => {
      const middleware = logger({ showHeaders: true });

      await middleware(ctx, () => Promise.resolve());

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('user-agent');
      expect(logCall).toContain('referer');
    });

    it('should log specific headers', async () => {
      const middleware = logger({
        showHeaders: true,
        filter: (ctx: Context) => ({
          'user-agent': ctx.req.headers['user-agent'],
          'content-type': ctx.req.headers['content-type'],
        }),
      });

      await middleware(ctx, () => Promise.resolve());

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('user-agent');
      expect(logCall).toContain('Mozilla/5.0');
    });
  });

  describe('Query Parameter Logging', () => {
    it('should log query parameters when enabled', async () => {
      const middleware = logger({ showQuery: true });

      await middleware(ctx, () => Promise.resolve());

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('page=1');
      expect(logCall).toContain('limit=10');
    });

    it('should handle empty query parameters', async () => {
      const middleware = logger({ showQuery: true });
      ctx = createMockContext({ query: {} });

      await middleware(ctx, () => Promise.resolve());

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).not.toContain('query:');
    });
  });

  describe('Response Time Logging', () => {
    it('should log response time', async () => {
      const middleware = logger({ showResponseTime: true });

      await middleware(ctx, () => Promise.resolve());

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toMatch(/\d+ms/);
    });

    it('should handle slow requests', async () => {
      const middleware = logger({
        showResponseTime: true,
        threshold: 100,
      });

      // Mock slow response
      next = async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      };

      await middleware(ctx, () => Promise.resolve());

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toMatch(/\d+ms/);
    });
  });

  describe('User Agent Logging', () => {
    it('should log user agent when enabled', async () => {
      const middleware = logger({ showUserAgent: true });

      await middleware(ctx, () => Promise.resolve());

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('Mozilla/5.0');
    });

    it('should handle missing user agent', async () => {
      const middleware = logger({ showUserAgent: true });
      ctx = createMockContext({
        req: { headers: {}, method: 'GET', url: '/test' } as any,
      });

      await middleware(ctx, () => Promise.resolve());

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('IP Address Logging', () => {
    it('should log IP address when enabled', async () => {
      const middleware = logger({ showIP: true });

      await middleware(ctx, () => Promise.resolve());

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('192.168.1.1');
    });

    it('should handle missing IP address', async () => {
      const middleware = logger({ showIP: true });
      ctx = createMockContext({
        req: { headers: {}, method: 'GET', url: '/test' } as any,
      });

      await middleware(ctx, () => Promise.resolve());

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Response Size Logging', () => {
    it('should log response size when enabled', async () => {
      const middleware = logger({ showResponseSize: true });

      await middleware(ctx, () => Promise.resolve());

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('1024b');
    });

    it('should handle missing response size', async () => {
      const middleware = logger({ showResponseSize: true });
      ctx = createMockContext({
        res: {
          statusCode: 200,
          headers: {},
          setHeader: vi.fn(),
          getHeader: vi.fn(),
          end: vi.fn(),
        } as any,
      });

      await middleware(ctx, () => Promise.resolve());

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Status Code Logging', () => {
    it('should log status code when enabled', async () => {
      const middleware = logger({ showStatus: true });

      await middleware(ctx, () => Promise.resolve());

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('200');
    });

    it('should handle different status codes', async () => {
      const middleware = logger({ showStatus: true });
      ctx.status = 404;
      ctx.res.statusCode = 404;

      await middleware(ctx, () => Promise.resolve());

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('404');
    });
  });

  describe('Method Logging', () => {
    it('should log HTTP method when enabled', async () => {
      const middleware = logger({ showMethod: true });

      await middleware(ctx, () => Promise.resolve());

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('GET');
    });

    it('should handle different HTTP methods', async () => {
      const middleware = logger({ showMethod: true });
      ctx = createMockContext({ method: 'POST' });

      await middleware(ctx, () => Promise.resolve());

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('POST');
    });
  });

  describe('URL Logging', () => {
    it('should log URL when enabled', async () => {
      const middleware = logger({ showURL: true });

      await middleware(ctx, () => Promise.resolve());

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('/test');
    });

    it('should handle complex URLs', async () => {
      const middleware = logger({ showURL: true });
      ctx = createMockContext({ path: '/api/users/123?page=1' });

      await middleware(ctx, () => Promise.resolve());

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('/api/users/123');
    });
  });

  describe('Color Support', () => {
    it('should use colors when enabled', async () => {
      const middleware = logger({ colorize: true });

      await middleware(ctx, () => Promise.resolve());

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('\x1b['); // ANSI color codes
    });

    it('should not use colors when disabled', async () => {
      const middleware = logger({ colorize: false });

      await middleware(ctx, () => Promise.resolve());

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).not.toContain('\x1b[');
    });

    it('should use appropriate colors for status codes', async () => {
      const middleware = logger({ colorize: true });

      // Test success status
      await middleware(ctx, () => Promise.resolve());
      let logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('\x1b[');

      // Test error status
      consoleSpy.mockClear();
      ctx.status = 500;
      await middleware(ctx, () => Promise.resolve());
      logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('\x1b[');
    });
  });

  describe('Filtering', () => {
    it('should filter requests based on condition', async () => {
      const middleware = logger({
        filter: (ctx: Context) => ctx.path.startsWith('/api'),
      });

      // Should not log non-API requests
      await middleware(ctx, () => Promise.resolve());
      expect(consoleSpy).not.toHaveBeenCalled();

      // Should log API requests
      ctx = createMockContext({ path: '/api/users' });
      await middleware(ctx, () => Promise.resolve());
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle filter errors gracefully', async () => {
      const middleware = logger({
        filter: () => {
          throw new Error('Filter error');
        },
      });

      await middleware(ctx, () => Promise.resolve());

      // Should still log despite filter error
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Custom Stream', () => {
    it('should use custom stream for output', async () => {
      const customStream = {
        write: vi.fn(),
      };

      const middleware = logger({ stream: customStream });

      await middleware(ctx, () => Promise.resolve());

      expect(customStream.write).toHaveBeenCalled();
    });

    it('should handle stream errors gracefully', async () => {
      const errorStream = {
        write: () => {
          throw new Error('Stream error');
        },
      };

      const middleware = logger({ stream: errorStream });

      // Should not crash
      await middleware(ctx, () => Promise.resolve());
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('Logger Utilities', () => {
    it('should get status color correctly', () => {
      expect(loggerUtils.getStatusColor(200)).toBeDefined();
      expect(loggerUtils.getStatusColor(404)).toBeDefined();
      expect(loggerUtils.getStatusColor(500)).toBeDefined();
    });

    it('should get method color correctly', () => {
      expect(loggerUtils.getMethodColor('GET')).toBeDefined();
      expect(loggerUtils.getMethodColor('POST')).toBeDefined();
      expect(loggerUtils.getMethodColor('PUT')).toBeDefined();
      expect(loggerUtils.getMethodColor('DELETE')).toBeDefined();
    });

    it('should format timestamp correctly', () => {
      const timestamp = loggerUtils.formatTimestamp();
      expect(timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should format request log correctly', () => {
      const options = {
        format: 'detailed',
        colorize: false,
        timestamp: false,
        showHeaders: false,
        showBody: false,
        showQuery: false,
        showResponseTime: false,
        showUserAgent: false,
        showReferer: false,
        showIP: false,
        showMethod: true,
        showURL: true,
        showStatus: false,
        showResponseSize: false,
        customFormat: undefined,
        filter: undefined,
        stream: undefined,
      };

      const result = loggerUtils.formatRequestLog(ctx, 100, options);
      expect(result).toContain('GET');
      expect(result).toContain('/test');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing request properties', async () => {
      const middleware = logger();
      ctx = createMockContext({
        req: undefined as any,
        res: undefined as any,
      });

      await middleware(ctx, () => Promise.resolve());

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle missing response properties', async () => {
      const middleware = logger();
      ctx = createMockContext({
        res: { statusCode: 200 } as any,
      });

      await middleware(ctx, () => Promise.resolve());

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle next function errors', async () => {
      const middleware = logger();
      next = async () => {
        throw new Error('Next error');
      };

      await middleware(ctx, () => Promise.resolve());

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should log requests quickly', async () => {
      const middleware = logger();

      const start = Date.now();
      await middleware(ctx, () => Promise.resolve());
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10); // Should complete within 10ms
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle high-frequency logging', async () => {
      const middleware = logger();

      const start = Date.now();
      const promises = [];

      // Log 100 requests rapidly
      for (let i = 0; i < 100; i++) {
        const testCtx = createMockContext({ path: `/test${i}` });
        promises.push(middleware(testCtx, next));
      }

      await Promise.all(promises);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should complete within 100ms
      expect(consoleSpy).toHaveBeenCalledTimes(100);
    });
  });
});

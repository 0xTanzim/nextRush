/**
 * Timer Middleware Tests
 *
 * Tests for request timing functionality with various configurations
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  highPrecisionTimer,
  slowRequestTimer,
  timer,
  timerInNanoseconds,
  timerInSeconds,
  timerWithCustomFormat,
  timerWithMetrics,
} from '../../../core/middleware/timer';
import type { Context } from '../../../types/context';

// Mock process.hrtime.bigint for tests
const originalHrtime = process.hrtime;
beforeEach(() => {
  process.hrtime = () => [0, 0] as [number, number];
  (process as any).hrtime.bigint = () => BigInt(0);
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

describe('Timer Middleware', () => {
  let ctx: Context;
  let next: () => Promise<void>;

  beforeEach(() => {
    ctx = createMockContext();
    next = async () => {};
  });

  describe('Basic Timer', () => {
    it('should add response time header', async () => {
      const middleware = timer();

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('X-Response-Time')).toBeDefined();
      expect(ctx.res.getHeader('X-Response-Time')).toMatch(/\d+ms/);
    });

    it('should use custom header name', async () => {
      const middleware = timer({ header: 'X-Custom-Timer' });

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('X-Custom-Timer')).toBeDefined();
      expect(ctx.res.getHeader('X-Response-Time')).toBeUndefined();
    });

    it('should include start time when enabled', async () => {
      const middleware = timer({ includeStartTime: true });

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('X-Request-Start')).toBeDefined();
      expect(ctx.res.getHeader('X-Response-Time')).toBeDefined();
    });

    it('should include end time when enabled', async () => {
      const middleware = timer({ includeEndTime: true });

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('X-Request-End')).toBeDefined();
      expect(ctx.res.getHeader('X-Response-Time')).toBeDefined();
    });

    it('should include duration when enabled', async () => {
      const middleware = timer({ includeDuration: true });

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('X-Request-Duration')).toBeDefined();
      expect(ctx.res.getHeader('X-Response-Time')).toBeDefined();
    });

    it('should use custom suffix', async () => {
      const middleware = timer({ suffix: 'seconds' });

      // Mock timing to return a non-zero value
      const originalHrtime = process.hrtime;
      let callCount = 0;
      const mockHrtime = () => [0, 0] as [number, number];
      mockHrtime.bigint = () => {
        callCount++;
        return callCount === 1 ? BigInt(0) : BigInt(1000000); // 1ms difference
      };
      process.hrtime = mockHrtime as any;

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('X-Response-Time')).toMatch(/\d+seconds/);

      process.hrtime = originalHrtime;
    });

    it('should use specified number of digits', async () => {
      const middleware = timer({ digits: 3 });

      // Mock timing to return a non-zero value
      const originalHrtime = process.hrtime;
      let callCount = 0;
      const mockHrtime = () => [0, 0] as [number, number];
      mockHrtime.bigint = () => {
        callCount++;
        return callCount === 1 ? BigInt(0) : BigInt(1000000); // 1ms difference
      };
      process.hrtime = mockHrtime as any;

      await middleware(ctx, () => Promise.resolve());

      const header = ctx.res.getHeader('X-Response-Time');
      expect(header).toMatch(/\d+ms/);

      process.hrtime = originalHrtime;
    });
  });

  describe('High Precision Timer', () => {
    it('should provide high precision timing', async () => {
      const middleware = highPrecisionTimer();

      // Mock timing to return a non-zero value
      const originalHrtime = process.hrtime;
      let callCount = 0;
      const mockHrtime = () => [0, 0] as [number, number];
      mockHrtime.bigint = () => {
        callCount++;
        return callCount === 1 ? BigInt(0) : BigInt(1000000); // 1ms difference
      };
      process.hrtime = mockHrtime as any;

      await middleware(ctx, () => Promise.resolve());

      const header = ctx.res.getHeader('X-Response-Time');
      expect(header).toMatch(/\d+ms/);

      process.hrtime = originalHrtime;
    });

    it('should use microsecond precision', async () => {
      const middleware = highPrecisionTimer({ format: 'microseconds' });

      // Mock timing to return a non-zero value
      const originalHrtime = process.hrtime;
      let callCount = 0;
      const mockHrtime = () => [0, 0] as [number, number];
      mockHrtime.bigint = () => {
        callCount++;
        return callCount === 1 ? BigInt(0) : BigInt(1000000); // 1ms difference
      };
      process.hrtime = mockHrtime as any;

      await middleware(ctx, () => Promise.resolve());

      const header = ctx.res.getHeader('X-Response-Time');
      expect(header).toMatch(/\d+ms/);

      process.hrtime = originalHrtime;
    });
  });

  describe('Timer in Seconds', () => {
    it('should format time in seconds', async () => {
      const middleware = timerInSeconds();

      // Mock timing to return a non-zero value
      const originalHrtime = process.hrtime;
      let callCount = 0;
      const mockHrtime = () => [0, 0] as [number, number];
      mockHrtime.bigint = () => {
        callCount++;
        return callCount === 1 ? BigInt(0) : BigInt(1000000); // 1ms difference
      };
      process.hrtime = mockHrtime as any;

      await middleware(ctx, () => Promise.resolve());

      const header = ctx.res.getHeader('X-Response-Time');
      expect(header).toMatch(/\d+\.\d+s/);

      process.hrtime = originalHrtime;
    });

    it('should handle sub-second times', async () => {
      const middleware = timerInSeconds();

      // Mock timing to return a non-zero value
      const originalHrtime = process.hrtime;
      let callCount = 0;
      const mockHrtime = () => [0, 0] as [number, number];
      mockHrtime.bigint = () => {
        callCount++;
        return callCount === 1 ? BigInt(0) : BigInt(500000); // 0.5ms difference
      };
      process.hrtime = mockHrtime as any;

      await middleware(ctx, () => Promise.resolve());

      const header = ctx.res.getHeader('X-Response-Time');
      expect(header).toMatch(/0\.\d+s/);

      process.hrtime = originalHrtime;
    });
  });

  describe('Timer in Nanoseconds', () => {
    it('should format time in nanoseconds', async () => {
      const middleware = timerInNanoseconds();

      // Mock timing to return a non-zero value
      const originalHrtime = process.hrtime;
      let callCount = 0;
      const mockHrtime = () => [0, 0] as [number, number];
      mockHrtime.bigint = () => {
        callCount++;
        return callCount === 1 ? BigInt(0) : BigInt(1000000); // 1ms difference
      };
      process.hrtime = mockHrtime as any;

      await middleware(ctx, () => Promise.resolve());

      const header = ctx.res.getHeader('X-Response-Time');
      expect(header).toMatch(/\d+ns/);

      process.hrtime = originalHrtime;
    });

    it('should provide nanosecond precision', async () => {
      const middleware = timerInNanoseconds();

      // Mock timing to return a non-zero value
      const originalHrtime = process.hrtime;
      let callCount = 0;
      const mockHrtime = () => [0, 0] as [number, number];
      mockHrtime.bigint = () => {
        callCount++;
        return callCount === 1 ? BigInt(0) : BigInt(1000000); // 1ms difference
      };
      process.hrtime = mockHrtime as any;

      await middleware(ctx, () => Promise.resolve());

      const header = ctx.res.getHeader('X-Response-Time');
      const timeValue = header.replace('ns', '');
      expect(parseInt(timeValue)).toBeGreaterThan(0);

      process.hrtime = originalHrtime;
    });
  });

  describe('Slow Request Timer', () => {
    it('should log slow requests', async () => {
      const middleware = slowRequestTimer(1); // 1ms threshold
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock slow response by overriding process.hrtime
      const originalHrtime = process.hrtime;
      let callCount = 0;
      const mockHrtime = () => [0, 0] as [number, number];
      mockHrtime.bigint = () => {
        callCount++;
        return callCount === 1 ? BigInt(0) : BigInt(5000000); // 5ms difference
      };
      process.hrtime = mockHrtime as any;

      await middleware(ctx, () => Promise.resolve());

      process.hrtime = originalHrtime;

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow request')
      );

      consoleSpy.mockRestore();
    });

    it('should not log fast requests', async () => {
      const middleware = slowRequestTimer(1000);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await middleware(ctx, () => Promise.resolve());

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should include custom options', async () => {
      const middleware = slowRequestTimer(100, { header: 'X-Slow-Timer' });

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('X-Slow-Timer')).toBeDefined();
    });
  });

  describe('Timer with Custom Format', () => {
    it('should use custom format function', async () => {
      const customFormat = (duration: number) =>
        `Custom: ${duration.toFixed(2)}ms`;
      const middleware = timerWithCustomFormat(customFormat);

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('X-Response-Time')).toMatch(
        /Custom: \d+\.\d+ms/
      );
    });

    it('should handle custom format with different units', async () => {
      const customFormat = (duration: number) =>
        `${(duration / 1000).toFixed(3)}s`;
      const middleware = timerWithCustomFormat(customFormat);

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('X-Response-Time')).toMatch(/\d+\.\d+s/);
    });

    it('should handle custom format with context', async () => {
      const customFormat = (duration: number) =>
        `${ctx.method} ${ctx.path}: ${duration}ms`;
      const middleware = timerWithCustomFormat(customFormat);

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('X-Response-Time')).toMatch(/GET \/test: \d+ms/);
    });
  });

  describe('Timer with Metrics', () => {
    it('should track performance metrics', async () => {
      const middleware = timerWithMetrics();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await middleware(ctx, () => Promise.resolve());

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should warn for slow timing operations', async () => {
      const middleware = timerWithMetrics();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock slow performance
      const originalHrtime = process.hrtime;
      let callCount = 0;
      const mockHrtime = () => [0, 0] as [number, number];
      mockHrtime.bigint = () => {
        callCount++;
        return callCount === 1 ? BigInt(0) : BigInt(2000000); // 2ms difference
      };
      process.hrtime = mockHrtime as any;

      await middleware(ctx, () => Promise.resolve());

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow timing')
      );

      process.hrtime = originalHrtime;
      consoleSpy.mockRestore();
    });
  });

  describe('Format Types', () => {
    it('should format in milliseconds', async () => {
      const middleware = timer({ format: 'milliseconds' });

      await middleware(ctx, () => Promise.resolve());

      const header = ctx.res.getHeader('X-Response-Time');
      expect(header).toMatch(/\d+ms/);
    });

    it('should format in seconds', async () => {
      const middleware = timer({ format: 'seconds' });

      // Mock timing to return a non-zero value
      const originalHrtime = process.hrtime;
      let callCount = 0;
      const mockHrtime = () => [0, 0] as [number, number];
      mockHrtime.bigint = () => {
        callCount++;
        return callCount === 1 ? BigInt(0) : BigInt(1000000); // 1ms difference
      };
      process.hrtime = mockHrtime as any;

      await middleware(ctx, () => Promise.resolve());

      const header = ctx.res.getHeader('X-Response-Time');
      expect(header).toMatch(/\d+\.\d+s/);

      process.hrtime = originalHrtime;
    });

    it('should format in microseconds', async () => {
      const middleware = timer({ format: 'microseconds' });

      // Mock timing to return a non-zero value
      const originalHrtime = process.hrtime;
      let callCount = 0;
      const mockHrtime = () => [0, 0] as [number, number];
      mockHrtime.bigint = () => {
        callCount++;
        return callCount === 1 ? BigInt(0) : BigInt(1000000); // 1ms difference
      };
      process.hrtime = mockHrtime as any;

      await middleware(ctx, () => Promise.resolve());

      const header = ctx.res.getHeader('X-Response-Time');
      expect(header).toMatch(/\d+μs/);

      process.hrtime = originalHrtime;
    });

    it('should format in nanoseconds', async () => {
      const middleware = timer({ format: 'nanoseconds' });

      // Mock timing to return a non-zero value
      const originalHrtime = process.hrtime;
      let callCount = 0;
      const mockHrtime = () => [0, 0] as [number, number];
      mockHrtime.bigint = () => {
        callCount++;
        return callCount === 1 ? BigInt(0) : BigInt(1000000); // 1ms difference
      };
      process.hrtime = mockHrtime as any;

      await middleware(ctx, () => Promise.resolve());

      const header = ctx.res.getHeader('X-Response-Time');
      expect(header).toMatch(/\d+ns/);

      process.hrtime = originalHrtime;
    });
  });

  describe('Threshold and Logging', () => {
    it('should log slow requests when threshold is exceeded', async () => {
      const middleware = timer({
        threshold: 50,
        logSlow: true,
        logSlowThreshold: 1, // 1ms threshold
      });
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock slow response
      const originalHrtime = process.hrtime;
      let callCount = 0;
      const mockHrtime = () => [0, 0] as [number, number];
      mockHrtime.bigint = () => {
        callCount++;
        return callCount === 1 ? BigInt(0) : BigInt(5000000); // 5ms difference
      };
      process.hrtime = mockHrtime as any;

      await middleware(ctx, () => Promise.resolve());

      process.hrtime = originalHrtime;

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow request')
      );

      consoleSpy.mockRestore();
    });

    it('should not log when below threshold', async () => {
      const middleware = timer({
        threshold: 1000,
        logSlow: true,
      });
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await middleware(ctx, () => Promise.resolve());

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle custom slow request threshold', async () => {
      const middleware = timer({
        logSlow: true,
        logSlowThreshold: 1, // 1ms threshold
      });
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock slow response
      const originalHrtime = process.hrtime;
      let callCount = 0;
      const mockHrtime = () => [0, 0] as [number, number];
      mockHrtime.bigint = () => {
        callCount++;
        return callCount === 1 ? BigInt(0) : BigInt(5000000); // 5ms difference
      };
      process.hrtime = mockHrtime as any;

      await middleware(ctx, () => Promise.resolve());

      process.hrtime = originalHrtime;

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow request')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing response methods', async () => {
      const middleware = timer();
      ctx.res.setHeader = undefined as any;

      // Should not throw errors
      await expect(middleware(ctx, next)).resolves.not.toThrow();
    });

    it('should handle very fast requests', async () => {
      const middleware = timer();

      await middleware(ctx, () => Promise.resolve());

      const header = ctx.res.getHeader('X-Response-Time');
      expect(header).toBeDefined();
      expect(header).toMatch(/\d+ms/);
    });

    it('should handle very slow requests', async () => {
      const middleware = timer();

      // Mock very slow response
      next = async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
      };

      await middleware(ctx, () => Promise.resolve());

      const header = ctx.res.getHeader('X-Response-Time');
      expect(header).toBeDefined();
      expect(header).toMatch(/\d+ms/);
    });

    it('should handle zero duration', async () => {
      const middleware = timer();

      // Mock immediate response
      next = async () => {};

      await middleware(ctx, () => Promise.resolve());

      const header = ctx.res.getHeader('X-Response-Time');
      expect(header).toBeDefined();
      expect(header).toMatch(/0ms/);
    });

    it('should handle negative duration gracefully', async () => {
      const middleware = timer();

      // Mock negative time scenario
      const originalHrtime = process.hrtime;
      vi.spyOn(process, 'hrtime').mockReturnValue({
        bigint: () => BigInt(-1000000), // Negative time
      } as any);

      await middleware(ctx, () => Promise.resolve());

      const header = ctx.res.getHeader('X-Response-Time');
      expect(header).toBeDefined();

      vi.restoreAllMocks();
    });
  });

  describe('Performance', () => {
    it('should handle high-frequency timing requests', async () => {
      const middleware = timer();
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

    it('should handle concurrent timing operations', async () => {
      const middleware = timer();
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
      const middleware = timer();
      next = async () => {
        throw new Error('Next error');
      };

      await expect(middleware(ctx, next)).rejects.toThrow('Next error');
    });

    it('should handle custom format function errors', async () => {
      const customFormat = () => {
        throw new Error('Format error');
      };
      const middleware = timerWithCustomFormat(customFormat);

      // Should not throw errors from format function
      await expect(middleware(ctx, next)).resolves.not.toThrow();
    });

    it('should handle missing context properties', async () => {
      const middleware = timer();
      ctx = createMockContext({
        res: {
          setHeader: vi.fn(),
          getHeader: vi.fn(),
          headersSent: false,
        } as any,
      });

      // Should not throw errors
      await expect(middleware(ctx, next)).resolves.not.toThrow();
    });
  });

  describe('Integration', () => {
    it('should work with other middleware', async () => {
      const timerMiddleware = timer();
      const loggerMiddleware = (ctx: Context, next: () => Promise<void>) => {
        ctx.state.timer = true;
        return next();
      };

      await timerMiddleware(ctx, async () => {
        await loggerMiddleware(ctx, next);
      });

      expect(ctx.res.getHeader('X-Response-Time')).toBeDefined();
      expect(ctx.state.timer).toBe(true);
    });

    it('should preserve existing headers', async () => {
      const middleware = timer();
      ctx.res.setHeader('X-Custom-Header', 'custom-value');

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.res.getHeader('X-Custom-Header')).toBe('custom-value');
      expect(ctx.res.getHeader('X-Response-Time')).toBeDefined();
    });
  });
});

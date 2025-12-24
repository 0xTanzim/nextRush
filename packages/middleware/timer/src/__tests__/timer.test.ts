import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Context } from '@nextrush/types';

import { responseTime, serverTiming, timer } from '../index';

function createMockContext(): Context & {
  _responseHeaders: Map<string, string>;
  _nextCalled: () => boolean;
  _nextDelay: number;
} {
  const responseHeaders = new Map<string, string>();
  const state: Record<string, unknown> = {};
  let nextCalled = false;
  let nextDelay = 0;

  return {
    state,
    get: () => undefined,
    set: (name: string, value: string) => {
      responseHeaders.set(name.toLowerCase(), value);
    },
    next: async () => {
      nextCalled = true;
      if (nextDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, nextDelay));
      }
    },
    _responseHeaders: responseHeaders,
    _nextCalled: () => nextCalled,
    _nextDelay: nextDelay,
  } as unknown as Context & {
    _responseHeaders: Map<string, string>;
    _nextCalled: () => boolean;
    _nextDelay: number;
  };
}

describe('@nextrush/timer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('timer()', () => {
    it('should measure response time and store in state', async () => {
      const middleware = timer();
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.state.responseTime).toBeDefined();
      expect(typeof ctx.state.responseTime).toBe('number');
      expect(ctx.state.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should set X-Response-Time header by default', async () => {
      const middleware = timer();
      const ctx = createMockContext();

      await middleware(ctx);

      const header = ctx._responseHeaders.get('x-response-time');
      expect(header).toBeDefined();
      expect(header).toMatch(/^\d+\.\d{2}ms$/);
    });

    it('should call next()', async () => {
      const middleware = timer();
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx._nextCalled()).toBe(true);
    });

    it('should use custom header name', async () => {
      const middleware = timer({ header: 'X-Duration' });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx._responseHeaders.get('x-duration')).toBeDefined();
      expect(ctx._responseHeaders.get('x-response-time')).toBeUndefined();
    });

    it('should use custom suffix', async () => {
      const middleware = timer({ suffix: 's' });
      const ctx = createMockContext();

      await middleware(ctx);

      const header = ctx._responseHeaders.get('x-response-time');
      expect(header).toMatch(/s$/);
    });

    it('should use custom precision', async () => {
      const middleware = timer({ precision: 0 });
      const ctx = createMockContext();

      await middleware(ctx);

      const header = ctx._responseHeaders.get('x-response-time');
      expect(header).toMatch(/^\d+ms$/);
    });

    it('should use custom state key', async () => {
      const middleware = timer({ stateKey: 'duration' });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.state.duration).toBeDefined();
      expect(ctx.state.responseTime).toBeUndefined();
    });

    it('should not expose header when exposeHeader is false', async () => {
      const middleware = timer({ exposeHeader: false });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.state.responseTime).toBeDefined();
      expect(ctx._responseHeaders.size).toBe(0);
    });

    it('should use custom now function for testing', async () => {
      let time = 0;
      const mockNow = vi.fn(() => {
        time += 50;
        return time;
      });

      const middleware = timer({ now: mockNow });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(mockNow).toHaveBeenCalledTimes(2);
      expect(ctx.state.responseTime).toBe(50);
    });

    it('should measure actual elapsed time', async () => {
      const middleware = timer({ precision: 0 });
      const ctx = createMockContext();

      const delayedNext = ctx.next;
      ctx.next = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        await delayedNext();
      };

      await middleware(ctx);

      expect(ctx.state.responseTime).toBeGreaterThanOrEqual(10);
    });
  });

  describe('responseTime()', () => {
    it('should be an alias for timer', async () => {
      const middleware = responseTime();
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.state.responseTime).toBeDefined();
      expect(ctx._responseHeaders.get('x-response-time')).toBeDefined();
    });

    it('should accept all timer options', async () => {
      const middleware = responseTime({
        header: 'X-Custom',
        precision: 1,
        suffix: 'milliseconds',
      });
      const ctx = createMockContext();

      await middleware(ctx);

      const header = ctx._responseHeaders.get('x-custom');
      expect(header).toMatch(/^\d+\.\d{1}milliseconds$/);
    });
  });

  describe('serverTiming()', () => {
    it('should set Server-Timing header', async () => {
      const middleware = serverTiming();
      const ctx = createMockContext();

      await middleware(ctx);

      const header = ctx._responseHeaders.get('server-timing');
      expect(header).toBeDefined();
      expect(header).toMatch(/^total;dur=\d+\.\d{2}$/);
    });

    it('should use custom metric name', async () => {
      const middleware = serverTiming({ metric: 'app' });
      const ctx = createMockContext();

      await middleware(ctx);

      const header = ctx._responseHeaders.get('server-timing');
      expect(header).toMatch(/^app;dur=\d+\.\d{2}$/);
    });

    it('should include description when provided', async () => {
      const middleware = serverTiming({
        metric: 'db',
        description: 'Database query time',
      });
      const ctx = createMockContext();

      await middleware(ctx);

      const header = ctx._responseHeaders.get('server-timing');
      expect(header).toMatch(/^db;dur=\d+\.\d{2};desc="Database query time"$/);
    });

    it('should store timing in state', async () => {
      const middleware = serverTiming();
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.state.responseTime).toBeDefined();
      expect(typeof ctx.state.responseTime).toBe('number');
    });

    it('should use custom state key', async () => {
      const middleware = serverTiming({ stateKey: 'serverTime' });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.state.serverTime).toBeDefined();
      expect(ctx.state.responseTime).toBeUndefined();
    });

    it('should not expose header when exposeHeader is false', async () => {
      const middleware = serverTiming({ exposeHeader: false });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.state.responseTime).toBeDefined();
      expect(ctx._responseHeaders.size).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle zero duration', async () => {
      const mockNow = vi.fn(() => 100);
      const middleware = timer({ now: mockNow });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.state.responseTime).toBe(0);
    });

    it('should handle very large durations', async () => {
      let callCount = 0;
      const mockNow = vi.fn(() => {
        callCount++;
        return callCount === 1 ? 0 : 999999.999;
      });
      const middleware = timer({ now: mockNow, precision: 3 });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.state.responseTime).toBe(999999.999);
    });

    it('should work with all options combined', async () => {
      let time = 0;
      const middleware = timer({
        header: 'X-Time',
        suffix: ' milliseconds',
        precision: 1,
        stateKey: 'time',
        exposeHeader: true,
        now: () => {
          time += 123.456;
          return time;
        },
      });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.state.time).toBe(123.5);
      expect(ctx._responseHeaders.get('x-time')).toBe('123.5 milliseconds');
    });
  });
});

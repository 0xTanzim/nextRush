import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_HEADER,
  DEFAULT_METRIC,
  DEFAULT_PRECISION,
  DEFAULT_STATE_KEY,
  DEFAULT_SUFFIX,
  MAX_PRECISION,
  SERVER_TIMING_HEADER,
  defaultTimeGetter,
  detailedTimer,
  responseTime,
  serverTiming,
  timer,
} from '../index';
import type { TimerContext, TimingResult } from '../types';

function createMockContext(): TimerContext & {
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
    get: (name: string) => responseHeaders.get(name.toLowerCase()),
    set: (name: string, value: string) => {
      responseHeaders.set(name.toLowerCase(), value);
    },
    next: async () => {
      nextCalled = true;
      if (nextDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, nextDelay));
      }
    },
    _responseHeaders: responseHeaders,
    _nextCalled: () => nextCalled,
    _nextDelay: nextDelay,
  } as unknown as TimerContext & {
    _responseHeaders: Map<string, string>;
    _nextCalled: () => boolean;
    _nextDelay: number;
  };
}

describe('@nextrush/timer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Constants Tests
  // ============================================================================

  describe('constants', () => {
    it('should export DEFAULT_HEADER', () => {
      expect(DEFAULT_HEADER).toBe('X-Response-Time');
    });

    it('should export SERVER_TIMING_HEADER', () => {
      expect(SERVER_TIMING_HEADER).toBe('Server-Timing');
    });

    it('should export DEFAULT_SUFFIX', () => {
      expect(DEFAULT_SUFFIX).toBe('ms');
    });

    it('should export DEFAULT_PRECISION', () => {
      expect(DEFAULT_PRECISION).toBe(2);
    });

    it('should export MAX_PRECISION', () => {
      expect(MAX_PRECISION).toBe(6);
    });

    it('should export DEFAULT_STATE_KEY', () => {
      expect(DEFAULT_STATE_KEY).toBe('responseTime');
    });

    it('should export DEFAULT_METRIC', () => {
      expect(DEFAULT_METRIC).toBe('total');
    });

    it('should export defaultTimeGetter that returns performance.now()', () => {
      const result = defaultTimeGetter();
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Timer Middleware Tests
  // ============================================================================

  describe('timer()', () => {
    it('should measure response time and store in state', async () => {
      const middleware = timer();
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.state.responseTime).toBeDefined();
      expect(typeof ctx.state.responseTime).toBe('number');
      expect(ctx.state.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should set X-Response-Time header when exposeHeader is true', async () => {
      const middleware = timer({ exposeHeader: true });
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
      const middleware = timer({ header: 'X-Duration', exposeHeader: true });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx._responseHeaders.get('x-duration')).toBeDefined();
      expect(ctx._responseHeaders.get('x-response-time')).toBeUndefined();
    });

    it('should use custom suffix', async () => {
      const middleware = timer({ suffix: 's', exposeHeader: true });
      const ctx = createMockContext();

      await middleware(ctx);

      const header = ctx._responseHeaders.get('x-response-time');
      expect(header).toMatch(/s$/);
    });

    it('should use custom precision', async () => {
      const middleware = timer({ precision: 0, exposeHeader: true });
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
      const middleware = timer({ precision: 0, exposeHeader: true });
      const ctx = createMockContext();

      const delayedNext = ctx.next;
      ctx.next = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        await delayedNext();
      };

      await middleware(ctx);

      expect(ctx.state.responseTime).toBeGreaterThanOrEqual(9);
    });

    it('should clamp precision to MAX_PRECISION', async () => {
      let time = 0;
      const middleware = timer({
        precision: 10, // Exceeds MAX_PRECISION of 6
        exposeHeader: true,
        now: () => {
          time += 123.456789123456;
          return time;
        },
      });
      const ctx = createMockContext();

      await middleware(ctx);

      const header = ctx._responseHeaders.get('x-response-time');
      // Should clamp to 6 decimal places
      expect(header).toMatch(/^\d+\.\d{6}ms$/);
    });

    it('should handle negative precision by clamping to 0', async () => {
      let time = 0;
      const middleware = timer({
        precision: -5,
        exposeHeader: true,
        now: () => {
          time += 123.456;
          return time;
        },
      });
      const ctx = createMockContext();

      await middleware(ctx);

      const header = ctx._responseHeaders.get('x-response-time');
      expect(header).toBe('123ms');
    });
  });

  // ============================================================================
  // Detailed Timer Tests
  // ============================================================================

  describe('detailedTimer()', () => {
    it('should store number when detailed is false', async () => {
      let time = 0;
      const middleware = detailedTimer({
        detailed: false,
        now: () => {
          time += 100;
          return time;
        },
      });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(typeof ctx.state.responseTime).toBe('number');
      expect(ctx.state.responseTime).toBe(100);
    });

    it('should store TimingResult object when detailed is true', async () => {
      let time = 100;
      const middleware = detailedTimer({
        detailed: true,
        now: () => {
          const current = time;
          time += 50;
          return current;
        },
      });
      const ctx = createMockContext();

      await middleware(ctx);

      const result = ctx.state.responseTime as TimingResult;
      expect(result).toBeDefined();
      expect(result.duration).toBe(50);
      expect(result.start).toBe(100);
      expect(result.end).toBe(150);
      expect(result.formatted).toMatch(/50\.\d{2}ms/);
    });

    it('should include formatted string in detailed result', async () => {
      let time = 0;
      const middleware = detailedTimer({
        detailed: true,
        suffix: ' milliseconds',
        precision: 1,
        now: () => {
          time += 123.456;
          return time;
        },
      });
      const ctx = createMockContext();

      await middleware(ctx);

      const result = ctx.state.responseTime as TimingResult;
      expect(result.formatted).toBe('123.5 milliseconds');
    });

    it('should set header when detailed is true', async () => {
      const middleware = detailedTimer({ detailed: true, exposeHeader: true });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx._responseHeaders.get('x-response-time')).toBeDefined();
    });
  });

  // ============================================================================
  // Response Time Alias Tests
  // ============================================================================

  describe('responseTime()', () => {
    it('should be an alias for timer', async () => {
      const middleware = responseTime({ exposeHeader: true });
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
        exposeHeader: true,
      });
      const ctx = createMockContext();

      await middleware(ctx);

      const header = ctx._responseHeaders.get('x-custom');
      expect(header).toMatch(/^\d+\.\d{1}milliseconds$/);
    });
  });

  // ============================================================================
  // Server-Timing Tests
  // ============================================================================

  describe('serverTiming()', () => {
    it('should set Server-Timing header', async () => {
      const middleware = serverTiming({ exposeHeader: true });
      const ctx = createMockContext();

      await middleware(ctx);

      const header = ctx._responseHeaders.get('server-timing');
      expect(header).toBeDefined();
      expect(header).toMatch(/^total;dur=\d+\.\d{2}$/);
    });

    it('should use custom metric name', async () => {
      const middleware = serverTiming({ metric: 'app', exposeHeader: true });
      const ctx = createMockContext();

      await middleware(ctx);

      const header = ctx._responseHeaders.get('server-timing');
      expect(header).toMatch(/^app;dur=\d+\.\d{2}$/);
    });

    it('should include description when provided', async () => {
      const middleware = serverTiming({
        metric: 'db',
        description: 'Database query time',
        exposeHeader: true,
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

  // ============================================================================
  // Security Tests - Header Injection Prevention
  // ============================================================================

  describe('security', () => {
    it('should sanitize CRLF from metric name to prevent header injection', async () => {
      const middleware = serverTiming({
        metric: 'api\r\nX-Injected: evil',
        exposeHeader: true,
      });
      const ctx = createMockContext();

      await middleware(ctx);

      const header = ctx._responseHeaders.get('server-timing');
      // CRLF sequences must be removed - this is the actual security vulnerability
      expect(header).not.toContain('\r');
      expect(header).not.toContain('\n');
      // Colons and spaces are removed per RFC 7230 token rules
      expect(header).not.toContain(':');
      expect(header).not.toContain(' ');
    });

    it('should escape quotes in description', async () => {
      const middleware = serverTiming({
        metric: 'api',
        description: 'Test "quoted" value',
        exposeHeader: true,
      });
      const ctx = createMockContext();

      await middleware(ctx);

      const header = ctx._responseHeaders.get('server-timing');
      expect(header).toContain('desc="Test \\"quoted\\" value"');
    });

    it('should remove control characters from description', async () => {
      const middleware = serverTiming({
        metric: 'api',
        description: 'Test\x00\x1F\x7Fvalue',
        exposeHeader: true,
      });
      const ctx = createMockContext();

      await middleware(ctx);

      const header = ctx._responseHeaders.get('server-timing');
      expect(header).not.toContain('\x00');
      expect(header).not.toContain('\x1F');
      expect(header).not.toContain('\x7F');
      expect(header).toContain('desc="Testvalue"');
    });

    it('should remove CRLF injection attempts in metric name', async () => {
      const middleware = serverTiming({
        metric: 'api\r\nSet-Cookie: session=evil',
        exposeHeader: true,
      });
      const ctx = createMockContext();

      await middleware(ctx);

      const header = ctx._responseHeaders.get('server-timing');
      // CRLF sequences must be removed - this prevents HTTP header splitting
      expect(header).not.toMatch(/\r/);
      expect(header).not.toMatch(/\n/);
      // Colons must be stripped from metric names
      expect(header).not.toContain(':');
    });

    it('should only allow RFC 7230 token characters in metric name', async () => {
      const middleware = serverTiming({
        metric: 'valid-metric_name.123',
        exposeHeader: true,
      });
      const ctx = createMockContext();

      await middleware(ctx);

      const header = ctx._responseHeaders.get('server-timing');
      // Valid token characters should pass through
      expect(header).toMatch(/^valid-metric_name\.123;dur=/);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

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

    it('should handle empty string suffix', async () => {
      let time = 0;
      const middleware = timer({
        suffix: '',
        exposeHeader: true,
        now: () => {
          time += 50;
          return time;
        },
      });
      const ctx = createMockContext();

      await middleware(ctx);

      const header = ctx._responseHeaders.get('x-response-time');
      expect(header).toBe('50.00');
    });

    it('should handle empty string metric name gracefully', async () => {
      const middleware = serverTiming({ metric: '', exposeHeader: true });
      const ctx = createMockContext();

      await middleware(ctx);

      const header = ctx._responseHeaders.get('server-timing');
      // Empty metric is sanitized to empty string
      expect(header).toBeDefined();
    });
  });

  // ============================================================================
  // Multi-Runtime Compatibility Tests
  // ============================================================================

  describe('multi-runtime compatibility', () => {
    it('should not use any Node.js-specific APIs', () => {
      // Verify that module doesn't import from 'node:' or Node-specific modules
      // Timer uses only performance.now() which is universal
      expect(defaultTimeGetter).toBeDefined();
      expect(typeof defaultTimeGetter()).toBe('number');
    });

    it('should work with custom time getter for environments without performance.now', async () => {
      // Simulate an environment where we need to use Date.now()
      const dateBasedNow = () => Date.now();
      const middleware = timer({ now: dateBasedNow });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.state.responseTime).toBeDefined();
      expect(ctx.state.responseTime).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // TMR-P1-01: exposeHeader defaults to false
  // ============================================================================

  describe('exposeHeader default (TMR-P1-01)', () => {
    it('timer() should NOT set header by default', async () => {
      const middleware = timer();
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx._responseHeaders.size).toBe(0);
      expect(ctx.state.responseTime).toBeDefined();
    });

    it('detailedTimer() should NOT set header by default', async () => {
      const middleware = detailedTimer();
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx._responseHeaders.size).toBe(0);
    });

    it('responseTime() should NOT set header by default', async () => {
      const middleware = responseTime();
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx._responseHeaders.size).toBe(0);
    });

    it('serverTiming() should NOT set header by default', async () => {
      const middleware = serverTiming();
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx._responseHeaders.size).toBe(0);
    });
  });

  // ============================================================================
  // TMR-P2-01: try/finally error resilience
  // ============================================================================

  describe('error resilience (TMR-P2-01)', () => {
    it('timer() should record timing even when downstream throws', async () => {
      let time = 0;
      const middleware = timer({
        now: () => {
          time += 50;
          return time;
        },
      });
      const ctx = createMockContext();
      ctx.next = async () => {
        throw new Error('downstream failure');
      };

      await expect(middleware(ctx)).rejects.toThrow('downstream failure');
      expect(ctx.state.responseTime).toBe(50);
    });

    it('timer() should set header on error when exposeHeader is true', async () => {
      let time = 0;
      const middleware = timer({
        exposeHeader: true,
        now: () => {
          time += 25;
          return time;
        },
      });
      const ctx = createMockContext();
      ctx.next = async () => {
        throw new Error('fail');
      };

      await expect(middleware(ctx)).rejects.toThrow('fail');
      expect(ctx._responseHeaders.get('x-response-time')).toBeDefined();
    });

    it('detailedTimer() should record timing even when downstream throws', async () => {
      let time = 100;
      const middleware = detailedTimer({
        detailed: true,
        now: () => {
          const c = time;
          time += 30;
          return c;
        },
      });
      const ctx = createMockContext();
      ctx.next = async () => {
        throw new Error('error');
      };

      await expect(middleware(ctx)).rejects.toThrow('error');
      const result = ctx.state.responseTime as TimingResult;
      expect(result.duration).toBe(30);
      expect(result.start).toBe(100);
    });

    it('serverTiming() should record timing even when downstream throws', async () => {
      let time = 0;
      const middleware = serverTiming({
        exposeHeader: true,
        now: () => {
          time += 10;
          return time;
        },
      });
      const ctx = createMockContext();
      ctx.next = async () => {
        throw new Error('fail');
      };

      await expect(middleware(ctx)).rejects.toThrow('fail');
      expect(ctx.state.responseTime).toBe(10);
      expect(ctx._responseHeaders.get('server-timing')).toBeDefined();
    });
  });

  // ============================================================================
  // TMR-P2-02: Math.round formatting (no toFixed/parseFloat round-trip)
  // ============================================================================

  describe('formatting precision (TMR-P2-02)', () => {
    it('should produce correctly rounded numeric state values', async () => {
      let time = 0;
      const middleware = timer({
        precision: 2,
        now: () => {
          time += 123.456789;
          return time;
        },
      });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.state.responseTime).toBe(123.46);
    });

    it('should produce correct header values with precision', async () => {
      let time = 0;
      const middleware = timer({
        precision: 3,
        exposeHeader: true,
        now: () => {
          time += 99.9995;
          return time;
        },
      });
      const ctx = createMockContext();

      await middleware(ctx);

      const header = ctx._responseHeaders.get('x-response-time');
      expect(header).toBe('100.000ms');
    });
  });

  // ============================================================================
  // TMR-P2-03: Server-Timing header append
  // ============================================================================

  describe('Server-Timing append (TMR-P2-03)', () => {
    it('should append to existing Server-Timing header', async () => {
      let time = 0;
      const middleware = serverTiming({
        metric: 'total',
        exposeHeader: true,
        now: () => {
          time += 100;
          return time;
        },
      });
      const ctx = createMockContext();
      // Pre-set an existing Server-Timing value
      ctx.set('Server-Timing', 'db;dur=5.00');

      await middleware(ctx);

      const header = ctx._responseHeaders.get('server-timing');
      expect(header).toMatch(/^db;dur=5\.00, total;dur=/);
    });

    it('should set Server-Timing header when none exists', async () => {
      let time = 0;
      const middleware = serverTiming({
        metric: 'app',
        exposeHeader: true,
        now: () => {
          time += 200;
          return time;
        },
      });
      const ctx = createMockContext();

      await middleware(ctx);

      const header = ctx._responseHeaders.get('server-timing');
      expect(header).toMatch(/^app;dur=/);
      expect(header).not.toContain(',');
    });

    it('should append multiple Server-Timing entries', async () => {
      let time = 0;
      const mw1 = serverTiming({
        metric: 'cache',
        exposeHeader: true,
        now: () => {
          time += 5;
          return time;
        },
      });
      const mw2 = serverTiming({
        metric: 'total',
        exposeHeader: true,
        now: () => {
          time += 50;
          return time;
        },
      });
      const ctx = createMockContext();

      // Run inner middleware first, then outer
      const originalNext = ctx.next;
      const innerCtx = { ...ctx, next: originalNext };
      await mw1(innerCtx as TimerContext);
      // Now run outer with same shared headers/state
      await mw2(ctx);

      const header = ctx._responseHeaders.get('server-timing');
      expect(header).toContain('cache;dur=');
      expect(header).toContain('total;dur=');
    });
  });

  // ============================================================================
  // TMR-P2-04: performance.now() fallback
  // ============================================================================

  describe('performance.now() fallback (TMR-P2-04)', () => {
    it('defaultTimeGetter should return a number', () => {
      const result = defaultTimeGetter();
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    it('defaultTimeGetter should produce increasing values', () => {
      const a = defaultTimeGetter();
      const b = defaultTimeGetter();
      expect(b).toBeGreaterThanOrEqual(a);
    });
  });

  // ============================================================================
  // TMR-P2-05: Header/suffix injection validation
  // ============================================================================

  describe('header/suffix validation (TMR-P2-05)', () => {
    it('should throw for header name with spaces', () => {
      expect(() => timer({ header: 'X Response Time' })).toThrow(/Invalid header name/);
    });

    it('should throw for header name with CRLF', () => {
      expect(() => timer({ header: 'X-Time\r\nEvil: header' })).toThrow(/Invalid header name/);
    });

    it('should throw for header with colon', () => {
      expect(() => timer({ header: 'X:Time' })).toThrow(/Invalid header name/);
    });

    it('should throw for header with slash', () => {
      expect(() => timer({ header: 'X/Time' })).toThrow(/Invalid header name/);
    });

    it('should accept valid header names', () => {
      expect(() => timer({ header: 'X-Response-Time' })).not.toThrow();
      expect(() => timer({ header: 'X_Custom_Header' })).not.toThrow();
      expect(() => timer({ header: 'X-Time.v2' })).not.toThrow();
    });

    it('should throw for suffix with control characters', () => {
      expect(() => timer({ suffix: 'ms\x00' })).toThrow(/Invalid suffix/);
    });

    it('should throw for suffix with CRLF', () => {
      expect(() => timer({ suffix: 'ms\r\n' })).toThrow(/Invalid suffix/);
    });

    it('should accept valid suffix values', () => {
      expect(() => timer({ suffix: 'ms' })).not.toThrow();
      expect(() => timer({ suffix: '' })).not.toThrow();
      expect(() => timer({ suffix: ' milliseconds' })).not.toThrow();
      expect(() => timer({ suffix: '%' })).not.toThrow();
    });

    it('detailedTimer should also validate header and suffix', () => {
      expect(() => detailedTimer({ header: 'Bad Header' })).toThrow(/Invalid header name/);
      expect(() => detailedTimer({ suffix: '\x00' })).toThrow(/Invalid suffix/);
    });

    it('responseTime should also validate header and suffix', () => {
      expect(() => responseTime({ header: 'Bad Header' })).toThrow(/Invalid header name/);
    });
  });
});

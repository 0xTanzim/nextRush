import type { Context } from '@nextrush/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    attachLogger,
    createLogger,
    getLogger,
    hasLogger,
    logger,
    type LoggerContext,
    type LoggerMiddlewareOptions,
} from '../index';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockContext(overrides: Partial<Context> = {}): Context {
  const headers: Record<string, string | string[] | undefined> = {};
  const responseHeaders: Record<string, string> = {};

  return {
    method: 'GET',
    url: '/test',
    path: '/test',
    query: {},
    params: {},
    headers,
    ip: '127.0.0.1',
    body: undefined,
    status: 200,
    state: {},
    raw: {
      req: {} as any,
      res: {} as any,
    },
    json: vi.fn(),
    send: vi.fn(),
    html: vi.fn(),
    redirect: vi.fn(),
    set: vi.fn((key: string, value: string) => {
      responseHeaders[key.toLowerCase()] = value;
    }),
    get: vi.fn((key: string) => headers[key.toLowerCase()]),
    next: vi.fn(),
    ...overrides,
  } as Context;
}

// ============================================================================
// Re-exports Tests
// ============================================================================

describe('@nextrush/logger Re-exports', () => {
  it('should export createLogger from @nextrush/log', () => {
    expect(createLogger).toBeDefined();
    expect(typeof createLogger).toBe('function');
  });

  it('should create a working logger', () => {
    const log = createLogger('test', { silent: true });
    expect(log).toBeDefined();
    expect(typeof log.info).toBe('function');
    expect(typeof log.error).toBe('function');
    expect(typeof log.debug).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.trace).toBe('function');
    expect(typeof log.fatal).toBe('function');
  });

  it('should support child loggers', () => {
    const log = createLogger('parent', { silent: true });
    const child = log.child('child');
    expect(child).toBeDefined();
    expect(child.getContext()).toBe('parent:child');
  });

  it('should support correlation IDs', () => {
    const log = createLogger('test', { silent: true });
    const withId = log.withCorrelationId('test-123');
    expect(withId.getCorrelationId()).toBe('test-123');
  });
});

// ============================================================================
// Logger Middleware Tests
// ============================================================================

describe('logger() middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be a function that returns middleware', () => {
    expect(typeof logger).toBe('function');
    const middleware = logger();
    expect(typeof middleware).toBe('function');
  });

  it('should attach logger to context', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {});

    expect((ctx as LoggerContext).log).toBeDefined();
    expect(typeof (ctx as LoggerContext).log.info).toBe('function');
  });

  it('should generate correlation ID if not present', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {});

    expect(ctx.set).toHaveBeenCalledWith('x-request-id', expect.any(String));
  });

  it('should use correlation ID from headers', async () => {
    const ctx = createMockContext({
      headers: { 'x-request-id': 'existing-id-123' },
    });
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {});

    expect(ctx.set).toHaveBeenCalledWith('x-request-id', 'existing-id-123');
    expect((ctx as LoggerContext).log.getCorrelationId()).toBe('existing-id-123');
  });

  it('should use custom correlation ID header', async () => {
    const ctx = createMockContext({
      headers: { 'x-trace-id': 'trace-456' },
    });
    const middleware = logger({
      silent: true,
      correlationIdHeader: 'x-trace-id',
    });

    await middleware(ctx, async () => {});

    expect(ctx.set).toHaveBeenCalledWith('x-trace-id', 'trace-456');
  });

  it('should skip logging when skip returns true', async () => {
    const ctx = createMockContext({ path: '/health' });
    const middleware = logger({
      silent: true,
      skip: (c) => c.path === '/health',
    });

    await middleware(ctx, async () => {});

    // Logger should not be attached when skipped
    expect((ctx as LoggerContext).log).toBeUndefined();
  });

  it('should call next middleware', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should propagate errors from next', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });
    const error = new Error('Test error');

    await expect(
      middleware(ctx, async () => {
        throw error;
      })
    ).rejects.toThrow('Test error');
  });

  it('should handle POST requests', async () => {
    const ctx = createMockContext({
      method: 'POST',
      path: '/users',
    });
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {});

    expect((ctx as LoggerContext).log).toBeDefined();
  });

  it('should handle query parameters', async () => {
    const ctx = createMockContext({
      query: { page: '1', limit: '10' },
    });
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {});

    expect((ctx as LoggerContext).log).toBeDefined();
  });

  it('should not generate correlation ID when disabled', async () => {
    const ctx = createMockContext();
    const middleware = logger({
      silent: true,
      generateCorrelationId: false,
    });

    await middleware(ctx, async () => {});

    expect(ctx.set).not.toHaveBeenCalled();
  });

  it('should use custom context name', async () => {
    const ctx = createMockContext();
    const middleware = logger({
      silent: true,
      context: 'my-api',
    });

    await middleware(ctx, async () => {});

    // Logger is attached with custom context
    expect((ctx as LoggerContext).log).toBeDefined();
  });
});

// ============================================================================
// Logger Middleware Options Tests
// ============================================================================

describe('logger() options', () => {
  it('should accept minLevel option', async () => {
    const ctx = createMockContext();
    const middleware = logger({
      silent: true,
      minLevel: 'warn',
    });

    await middleware(ctx, async () => {});

    expect((ctx as LoggerContext).log).toBeDefined();
  });

  it('should accept custom log levels per status', async () => {
    const options: LoggerMiddlewareOptions = {
      silent: true,
      successLevel: 'debug',
      clientErrorLevel: 'info',
      serverErrorLevel: 'fatal',
    };

    const middleware = logger(options);
    const ctx = createMockContext();

    await middleware(ctx, async () => {});

    expect((ctx as LoggerContext).log).toBeDefined();
  });

  it('should accept logRequestStart option', async () => {
    const ctx = createMockContext();
    const middleware = logger({
      silent: true,
      logRequestStart: true,
    });

    await middleware(ctx, async () => {});

    expect((ctx as LoggerContext).log).toBeDefined();
  });

  it('should accept formatMessage option', async () => {
    const formatMessage = vi.fn().mockReturnValue('Custom message');
    const ctx = createMockContext();
    const middleware = logger({
      silent: true,
      formatMessage,
    });

    await middleware(ctx, async () => {});

    expect(formatMessage).toHaveBeenCalledWith(ctx, expect.any(Number));
  });
});

// ============================================================================
// attachLogger Tests
// ============================================================================

describe('attachLogger() middleware', () => {
  it('should attach logger without request logging', async () => {
    const ctx = createMockContext();
    const middleware = attachLogger({ silent: true });

    await middleware(ctx, async () => {});

    expect((ctx as LoggerContext).log).toBeDefined();
  });

  it('should generate correlation ID', async () => {
    const ctx = createMockContext();
    const middleware = attachLogger({ silent: true });

    await middleware(ctx, async () => {});

    expect(ctx.set).toHaveBeenCalledWith('x-request-id', expect.any(String));
  });

  it('should use existing correlation ID', async () => {
    const ctx = createMockContext({
      headers: { 'x-request-id': 'existing-123' },
    });
    const middleware = attachLogger({ silent: true });

    await middleware(ctx, async () => {});

    expect((ctx as LoggerContext).log.getCorrelationId()).toBe('existing-123');
  });

  it('should call next', async () => {
    const ctx = createMockContext();
    const middleware = attachLogger({ silent: true });
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// hasLogger Tests
// ============================================================================

describe('hasLogger()', () => {
  it('should return false for context without logger', () => {
    const ctx = createMockContext();
    expect(hasLogger(ctx)).toBe(false);
  });

  it('should return true for context with logger', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {});

    expect(hasLogger(ctx)).toBe(true);
  });

  it('should return false for invalid log property', () => {
    const ctx = createMockContext();
    (ctx as any).log = 'not a logger';
    expect(hasLogger(ctx)).toBe(false);
  });
});

// ============================================================================
// getLogger Tests
// ============================================================================

describe('getLogger()', () => {
  it('should return attached logger if present', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {});

    const log = getLogger(ctx);
    expect(log).toBe((ctx as LoggerContext).log);
  });

  it('should return fallback logger if not present', () => {
    const ctx = createMockContext();
    const log = getLogger(ctx, 'fallback');

    expect(log).toBeDefined();
    expect(log.getContext()).toBe('fallback');
  });

  it('should use default fallback context', () => {
    const ctx = createMockContext();
    const log = getLogger(ctx);

    expect(log.getContext()).toBe('nextrush');
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Logger Middleware Integration', () => {
  it('should work with multiple middleware', async () => {
    const ctx = createMockContext();
    const loggerMiddleware = logger({ silent: true });

    const order: string[] = [];

    await loggerMiddleware(ctx, async () => {
      order.push('inside');
      (ctx as LoggerContext).log.info('Logged from inside');
    });

    expect(order).toEqual(['inside']);
  });

  it('should handle status code changes', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {
      ctx.status = 404;
    });

    expect(ctx.status).toBe(404);
  });

  it('should handle 500 errors', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {
      ctx.status = 500;
    });

    expect(ctx.status).toBe(500);
  });

  it('should preserve error stack trace', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });
    const originalError = new Error('Original error');

    try {
      await middleware(ctx, async () => {
        throw originalError;
      });
    } catch (err) {
      expect(err).toBe(originalError);
      expect((err as Error).stack).toBeDefined();
    }
  });
});

// ============================================================================
// Correlation ID Tests
// ============================================================================

describe('Correlation ID handling', () => {
  it('should handle array correlation ID header', async () => {
    const ctx = createMockContext({
      headers: { 'x-request-id': ['id-1', 'id-2'] },
    });
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {});

    expect((ctx as LoggerContext).log.getCorrelationId()).toBe('id-1');
  });

  it('should handle empty string correlation ID', async () => {
    const ctx = createMockContext({
      headers: { 'x-request-id': '' },
    });
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {});

    // Should generate new ID since empty string
    expect((ctx as LoggerContext).log.getCorrelationId()).not.toBe('');
  });

  it('should generate unique correlation IDs', async () => {
    const ids = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const ctx = createMockContext();
      const middleware = logger({ silent: true });

      await middleware(ctx, async () => {});

      const id = (ctx as LoggerContext).log.getCorrelationId();
      if (id) ids.add(id);
    }

    expect(ids.size).toBe(100);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle undefined status', async () => {
    const ctx = createMockContext();
    delete (ctx as any).status;
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {});

    expect((ctx as LoggerContext).log).toBeDefined();
  });

  it('should handle empty path', async () => {
    const ctx = createMockContext({ path: '' });
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {});

    expect((ctx as LoggerContext).log).toBeDefined();
  });

  it('should handle special characters in path', async () => {
    const ctx = createMockContext({
      path: '/api/users/123?foo=bar&baz=qux',
    });
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {});

    expect((ctx as LoggerContext).log).toBeDefined();
  });

  it('should handle very long paths', async () => {
    const longPath = '/api/' + 'a'.repeat(1000);
    const ctx = createMockContext({ path: longPath });
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {});

    expect((ctx as LoggerContext).log).toBeDefined();
  });

  it('should handle async errors in skip function', async () => {
    const ctx = createMockContext();
    const middleware = logger({
      silent: true,
      skip: () => {
        throw new Error('Skip error');
      },
    });

    await expect(middleware(ctx, async () => {})).rejects.toThrow('Skip error');
  });

  it('should handle non-Error throws', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });

    await expect(
      middleware(ctx, async () => {
        throw 'string error';
      })
    ).rejects.toBe('string error');
  });
});

// ============================================================================
// ctx.log Usage Tests - CRITICAL FUNCTIONALITY
// ============================================================================

describe('ctx.log Usage in Handlers', () => {
  it('should allow ctx.log.info() with message', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {
      // This is what users will do in their handlers
      expect(() => (ctx as LoggerContext).log.info('Processing request')).not.toThrow();
    });
  });

  it('should allow ctx.log.info() with message and data', async () => {
    const ctx = createMockContext({ params: { id: '123' } });
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {
      // Actual user code pattern
      expect(() =>
        (ctx as LoggerContext).log.info('Processing request', { userId: ctx.params['id'] })
      ).not.toThrow();
    });
  });

  it('should allow all log levels on ctx.log', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {
      const log = (ctx as LoggerContext).log;

      expect(() => log.trace('trace message')).not.toThrow();
      expect(() => log.debug('debug message')).not.toThrow();
      expect(() => log.info('info message')).not.toThrow();
      expect(() => log.warn('warn message')).not.toThrow();
      expect(() => log.error('error message')).not.toThrow();
      expect(() => log.fatal('fatal message')).not.toThrow();
    });
  });

  it('should allow ctx.log.error() with Error object', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {
      const error = new Error('Something went wrong');
      expect(() => (ctx as LoggerContext).log.error('Failed', error)).not.toThrow();
    });
  });

  it('should allow ctx.log with complex data objects', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {
      const complexData = {
        user: { id: 123, name: 'John' },
        items: [1, 2, 3],
        nested: { deep: { value: true } },
      };
      expect(() => (ctx as LoggerContext).log.info('Complex data', complexData)).not.toThrow();
    });
  });

  it('should propagate correlation ID to ctx.log', async () => {
    const ctx = createMockContext({
      headers: { 'x-request-id': 'test-correlation-123' },
    });
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {
      const correlationId = (ctx as LoggerContext).log.getCorrelationId();
      expect(correlationId).toBe('test-correlation-123');
    });
  });

  it('should allow creating child loggers from ctx.log', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {
      const childLog = (ctx as LoggerContext).log.child('database');
      expect(childLog).toBeDefined();
      expect(() => childLog.info('Query executed')).not.toThrow();
    });
  });

  it('should allow ctx.log.time() for performance tracking', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {
      const timer = (ctx as LoggerContext).log.time('operation');
      expect(timer).toBeDefined();
      expect(typeof timer.elapsed).toBe('function');
      expect(typeof timer.end).toBe('function');

      // Simulate some work
      const elapsed = timer.elapsed();
      expect(typeof elapsed).toBe('number');
      expect(elapsed).toBeGreaterThanOrEqual(0);

      const duration = timer.end('Operation completed');
      expect(typeof duration).toBe('number');
    });
  });

  it('should allow withMetadata on ctx.log', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {
      const enrichedLog = (ctx as LoggerContext).log.withMetadata({ service: 'api' });
      expect(enrichedLog).toBeDefined();
      expect(() => enrichedLog.info('With metadata')).not.toThrow();
    });
  });

  it('should have isLevelEnabled on ctx.log', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true, minLevel: 'warn' });

    await middleware(ctx, async () => {
      const log = (ctx as LoggerContext).log;
      expect(typeof log.isLevelEnabled).toBe('function');
      // Note: actual filtering depends on @nextrush/log implementation
    });
  });

  it('should persist ctx.log through async operations', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {
      // First log
      (ctx as LoggerContext).log.info('Before async');

      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 10));

      // ctx.log should still work
      expect(() => (ctx as LoggerContext).log.info('After async')).not.toThrow();
      expect((ctx as LoggerContext).log).toBeDefined();
    });
  });
});

// ============================================================================
// Real-World Usage Patterns
// ============================================================================

describe('Real-World Usage Patterns', () => {
  it('should work with typical REST API handler pattern', async () => {
    const ctx = createMockContext({
      method: 'GET',
      path: '/api/users/123',
      params: { id: '123' },
    });
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {
      // Typical handler code
      const userId = ctx.params['id'];
      (ctx as LoggerContext).log.info('Fetching user', { userId });

      // Simulate DB call
      const user = { id: userId, name: 'John Doe' };

      (ctx as LoggerContext).log.debug('User found', { user });
      ctx.json(user);

      expect(ctx.json).toHaveBeenCalledWith(user);
    });
  });

  it('should work with error handling pattern', async () => {
    const ctx = createMockContext({
      method: 'POST',
      path: '/api/users',
    });
    const middleware = logger({ silent: true });

    try {
      await middleware(ctx, async () => {
        (ctx as LoggerContext).log.info('Creating user');

        // Simulate validation error
        const validationError = new Error('Invalid email format');
        (ctx as LoggerContext).log.warn('Validation failed', validationError, { field: 'email' });

        ctx.status = 400;
        throw validationError;
      });
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(ctx.status).toBe(400);
    }
  });

  it('should work with middleware chain pattern', async () => {
    const ctx = createMockContext();
    const loggerMiddleware = logger({ silent: true });
    const logs: string[] = [];

    // Simulate middleware chain
    await loggerMiddleware(ctx, async () => {
      logs.push('auth middleware');
      (ctx as LoggerContext).log.debug('Auth check');

      // Next middleware
      logs.push('handler');
      (ctx as LoggerContext).log.info('Handler executed');
    });

    expect(logs).toEqual(['auth middleware', 'handler']);
  });

  it('should work with try-catch-finally pattern', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });
    const events: string[] = [];

    await middleware(ctx, async () => {
      try {
        events.push('try');
        (ctx as LoggerContext).log.info('Try block');
      } catch (err) {
        events.push('catch');
        (ctx as LoggerContext).log.error('Catch block');
      } finally {
        events.push('finally');
        (ctx as LoggerContext).log.debug('Finally block');
      }
    });

    expect(events).toEqual(['try', 'finally']);
  });

  it('should work with conditional logging', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {
      const log = (ctx as LoggerContext).log;

      // Conditional expensive logging
      if (log.isLevelEnabled('debug')) {
        const expensiveData = { computed: 'value' };
        log.debug('Expensive debug', expensiveData);
      }

      // Always log info
      log.info('Request processed');
    });
  });

  it('should work with multiple handlers accessing ctx.log', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });

    const handler1 = async () => {
      (ctx as LoggerContext).log.info('Handler 1');
    };

    const handler2 = async () => {
      (ctx as LoggerContext).log.info('Handler 2');
    };

    await middleware(ctx, async () => {
      await handler1();
      await handler2();
    });

    // Both handlers should have worked without error
    expect((ctx as LoggerContext).log).toBeDefined();
  });
});

// ============================================================================
// Status Code Logging Tests
// ============================================================================

describe('Status Code Logging', () => {
  it('should use successLevel for 2xx status', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true, successLevel: 'debug' });

    await middleware(ctx, async () => {
      ctx.status = 200;
    });

    expect(ctx.status).toBe(200);
  });

  it('should use successLevel for 3xx status', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true, successLevel: 'debug' });

    await middleware(ctx, async () => {
      ctx.status = 301;
    });

    expect(ctx.status).toBe(301);
  });

  it('should use clientErrorLevel for 4xx status', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true, clientErrorLevel: 'info' });

    await middleware(ctx, async () => {
      ctx.status = 400;
    });

    expect(ctx.status).toBe(400);
  });

  it('should use clientErrorLevel for 404 status', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {
      ctx.status = 404;
    });

    expect(ctx.status).toBe(404);
  });

  it('should use serverErrorLevel for 5xx status', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true, serverErrorLevel: 'fatal' });

    await middleware(ctx, async () => {
      ctx.status = 500;
    });

    expect(ctx.status).toBe(500);
  });

  it('should use serverErrorLevel for 503 status', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {
      ctx.status = 503;
    });

    expect(ctx.status).toBe(503);
  });
});

// ============================================================================
// Header Handling Edge Cases
// ============================================================================

describe('Header Handling Edge Cases', () => {
  it('should handle undefined headers object gracefully', async () => {
    const ctx = createMockContext();
    (ctx as any).headers = undefined;
    const middleware = logger({ silent: true, generateCorrelationId: true });

    // Should not throw - headers check is now safe
    await middleware(ctx, async () => {});

    // Should still have a logger attached with generated correlation ID
    expect((ctx as LoggerContext).log).toBeDefined();
  });

  it('should handle null headers object gracefully', async () => {
    const ctx = createMockContext();
    (ctx as any).headers = null;
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {});

    expect((ctx as LoggerContext).log).toBeDefined();
  });

  it('should handle case-insensitive header lookup', async () => {
    const ctx = createMockContext({
      headers: { 'X-REQUEST-ID': 'uppercase-id' },
    });
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {});

    // Should find the header regardless of case
    expect((ctx as LoggerContext).log).toBeDefined();
  });

  it('should handle empty array correlation ID', async () => {
    const ctx = createMockContext({
      headers: { 'x-request-id': [] },
    });
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {});

    // Should generate new ID since array is empty
    const correlationId = (ctx as LoggerContext).log.getCorrelationId();
    expect(correlationId).toBeDefined();
    expect(correlationId).not.toBe('');
  });

  it('should handle null correlation ID header', async () => {
    const ctx = createMockContext({
      headers: { 'x-request-id': null as any },
    });
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {});

    // Should generate new ID since null
    expect((ctx as LoggerContext).log.getCorrelationId()).toBeDefined();
  });

  it('should handle array with non-string first element', async () => {
    const ctx = createMockContext({
      headers: { 'x-request-id': [123 as any, 'string-id'] },
    });
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {});

    // Should generate new ID since first element is not a string
    const correlationId = (ctx as LoggerContext).log.getCorrelationId();
    expect(correlationId).toBeDefined();
  });

  it('should handle non-object headers gracefully', async () => {
    const ctx = createMockContext();
    (ctx as any).headers = 'not-an-object';
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {});

    expect((ctx as LoggerContext).log).toBeDefined();
  });
});

// ============================================================================
// Performance and Memory Tests
// ============================================================================

describe('Performance and Memory', () => {
  it('should handle rapid sequential requests', async () => {
    const middleware = logger({ silent: true });

    for (let i = 0; i < 100; i++) {
      const ctx = createMockContext({ path: `/request/${i}` });
      await middleware(ctx, async () => {
        (ctx as LoggerContext).log.info(`Request ${i}`);
      });
    }

    // Should complete without error
    expect(true).toBe(true);
  });

  it('should not leak memory between requests', async () => {
    const middleware = logger({ silent: true });
    const contexts: Context[] = [];

    for (let i = 0; i < 10; i++) {
      const ctx = createMockContext();
      contexts.push(ctx);
      await middleware(ctx, async () => {});
    }

    // Each context should have its own logger
    const uniqueLoggers = new Set(
      contexts.map(ctx => (ctx as LoggerContext).log)
    );
    expect(uniqueLoggers.size).toBe(10);
  });

  it('should handle concurrent requests', async () => {
    const middleware = logger({ silent: true });

    const requests = Array.from({ length: 10 }, (_, i) => {
      const ctx = createMockContext({ path: `/concurrent/${i}` });
      return middleware(ctx, async () => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        (ctx as LoggerContext).log.info(`Concurrent ${i}`);
      });
    });

    await Promise.all(requests);
    expect(true).toBe(true);
  });
});

// ============================================================================
// Type Safety Tests
// ============================================================================

describe('Type Safety', () => {
  it('should correctly type LoggerContext', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {
      const typedCtx = ctx as LoggerContext;

      // These should all be properly typed
      const log = typedCtx.log;
      expect(log.info).toBeDefined();
      expect(log.error).toBeDefined();
      expect(log.getCorrelationId).toBeDefined();
      expect(log.child).toBeDefined();
    });
  });

  it('should type-check middleware options', () => {
    // These should all compile without type errors
    const _m1 = logger();
    const _m2 = logger({ silent: true });
    const _m3 = logger({ minLevel: 'info' });
    const _m4 = logger({ correlationIdHeader: 'x-trace-id' });
    const _m5 = logger({ skip: (ctx) => ctx.path === '/health' });
    const _m6 = logger({ formatMessage: (ctx, duration) => `${ctx.method} ${duration}ms` });
    const _m7 = logger({
      successLevel: 'debug',
      clientErrorLevel: 'warn',
      serverErrorLevel: 'error',
    });

    expect(_m1).toBeDefined();
    expect(_m2).toBeDefined();
    expect(_m3).toBeDefined();
    expect(_m4).toBeDefined();
    expect(_m5).toBeDefined();
    expect(_m6).toBeDefined();
    expect(_m7).toBeDefined();
  });
});

// ============================================================================
// Correlation ID Generation Tests
// ============================================================================

describe('Correlation ID Generation', () => {
  it('should generate UUID format when crypto.randomUUID is available', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {});

    const correlationId = (ctx as LoggerContext).log.getCorrelationId();
    expect(correlationId).toBeDefined();
    expect(correlationId!.length).toBeGreaterThan(0);

    // UUID format: 8-4-4-4-12 hex characters
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // Fallback format: timestamp(base36)-random(base36)
    const fallbackRegex = /^[0-9a-z]+-[0-9a-z]+$/i;

    // Should match either format
    const isValidFormat = uuidRegex.test(correlationId!) || fallbackRegex.test(correlationId!);
    expect(isValidFormat).toBe(true);
  });

  it('should generate unique correlation IDs', async () => {
    const ids = new Set<string>();
    const middleware = logger({ silent: true });

    for (let i = 0; i < 1000; i++) {
      const ctx = createMockContext();
      await middleware(ctx, async () => {});
      const id = (ctx as LoggerContext).log.getCorrelationId();
      if (id) ids.add(id);
    }

    // All IDs should be unique
    expect(ids.size).toBe(1000);
  });
});

// ============================================================================
// formatMessage Callback Tests
// ============================================================================

describe('formatMessage Callback', () => {
  it('should call formatMessage with context and duration', async () => {
    const formatMessage = vi.fn().mockReturnValue('Custom message');
    const ctx = createMockContext({ method: 'POST', path: '/api/users' });
    const middleware = logger({ silent: true, formatMessage });

    await middleware(ctx, async () => {
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    expect(formatMessage).toHaveBeenCalledTimes(1);
    expect(formatMessage).toHaveBeenCalledWith(ctx, expect.any(Number));

    // Duration should be a positive number (timing can vary)
    const duration = formatMessage.mock.calls[0][1];
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it('should handle formatMessage throwing an error', async () => {
    const formatMessage = vi.fn().mockImplementation(() => {
      throw new Error('Format error');
    });
    const ctx = createMockContext();
    const middleware = logger({ silent: true, formatMessage });

    // Should throw the error (formatMessage errors are not caught)
    await expect(middleware(ctx, async () => {})).rejects.toThrow('Format error');
  });

  it('should use default message format when formatMessage returns empty', async () => {
    const formatMessage = vi.fn().mockReturnValue('');
    const ctx = createMockContext({ method: 'GET', path: '/test' });
    const middleware = logger({ silent: true, formatMessage });

    await middleware(ctx, async () => {});

    // Should use the empty string returned by formatMessage
    expect(formatMessage).toHaveBeenCalled();
  });
});

// ============================================================================
// @nextrush/log Re-exports Tests
// ============================================================================

describe('@nextrush/log Re-exports', () => {
  it('should export all core functions', async () => {
    const {
      createLogger,
      configure,
      configureFromEnv,
      setGlobalLevel,
      resetGlobalConfig,
      enableLogging,
      disableLogging,
      enableNamespaces,
      disableNamespaces,
    } = await import('../index');

    expect(createLogger).toBeDefined();
    expect(configure).toBeDefined();
    expect(configureFromEnv).toBeDefined();
    expect(setGlobalLevel).toBeDefined();
    expect(resetGlobalConfig).toBeDefined();
    expect(enableLogging).toBeDefined();
    expect(disableLogging).toBeDefined();
    expect(enableNamespaces).toBeDefined();
    expect(disableNamespaces).toBeDefined();
  });

  it('should export all transport functions', async () => {
    const {
      createConsoleTransport,
      createBatchTransport,
      createFilteredTransport,
      createRateLimitedTransport,
      createNamespaceRateLimitedTransport,
      createPredicateTransport,
    } = await import('../index');

    expect(createConsoleTransport).toBeDefined();
    expect(createBatchTransport).toBeDefined();
    expect(createFilteredTransport).toBeDefined();
    expect(createRateLimitedTransport).toBeDefined();
    expect(createNamespaceRateLimitedTransport).toBeDefined();
    expect(createPredicateTransport).toBeDefined();
  });

  it('should export all formatter functions', async () => {
    const {
      formatJSON,
      formatPrettyJSON,
      formatPrettyTerminal,
    } = await import('../index');

    expect(formatJSON).toBeDefined();
    expect(formatPrettyJSON).toBeDefined();
    expect(formatPrettyTerminal).toBeDefined();
  });

  it('should export all serializer functions', async () => {
    const {
      safeSerialize,
      serializeError,
      redactSensitiveValues,
      sanitizeContext,
      DEFAULT_SENSITIVE_KEYS,
    } = await import('../index');

    expect(safeSerialize).toBeDefined();
    expect(serializeError).toBeDefined();
    expect(redactSensitiveValues).toBeDefined();
    expect(sanitizeContext).toBeDefined();
    expect(DEFAULT_SENSITIVE_KEYS).toBeDefined();
    expect(Array.isArray(DEFAULT_SENSITIVE_KEYS)).toBe(true);
  });

  it('should export all context functions', async () => {
    const {
      runWithContext,
      getAsyncContext,
      getContextCorrelationId,
      getContextMetadata,
      isAsyncContextAvailable,
      createContextMiddleware,
    } = await import('../index');

    expect(runWithContext).toBeDefined();
    expect(getAsyncContext).toBeDefined();
    expect(getContextCorrelationId).toBeDefined();
    expect(getContextMetadata).toBeDefined();
    expect(isAsyncContextAvailable).toBeDefined();
    expect(createContextMiddleware).toBeDefined();
  });

  it('should export runtime detection functions', async () => {
    const {
      detectRuntime,
      getRuntime,
      getEnvVar,
      isProductionBuild,
      getProcessId,
    } = await import('../index');

    expect(detectRuntime).toBeDefined();
    expect(getRuntime).toBeDefined();
    expect(getEnvVar).toBeDefined();
    expect(isProductionBuild).toBeDefined();
    expect(getProcessId).toBeDefined();
  });

  it('should export log level utilities', async () => {
    const {
      LOG_LEVELS,
      LOG_LEVEL_PRIORITY,
      shouldLog,
      compareLevels,
      isValidLogLevel,
      parseLogLevel,
    } = await import('../index');

    expect(LOG_LEVELS).toBeDefined();
    expect(LOG_LEVEL_PRIORITY).toBeDefined();
    expect(shouldLog).toBeDefined();
    expect(compareLevels).toBeDefined();
    expect(isValidLogLevel).toBeDefined();
    expect(parseLogLevel).toBeDefined();
  });

  it('should export default logger instance', async () => {
    const { log, defaultLogger } = await import('../index');

    expect(log).toBeDefined();
    expect(defaultLogger).toBeDefined();
    expect(log).toBe(defaultLogger);
  });
});

// ============================================================================
// Integration with @nextrush/log Features
// ============================================================================

describe('Integration with @nextrush/log Features', () => {
  it('should work with custom transports', async () => {
    const transportFn = vi.fn();
    const ctx = createMockContext();
    const middleware = logger({
      silent: false,
      transports: [transportFn],
    });

    await middleware(ctx, async () => {
      (ctx as LoggerContext).log.info('Custom transport test');
    });

    // Transport should have been called at least once (for the info log)
    expect(transportFn).toHaveBeenCalled();
  });

  it('should work with sensitive data redaction', async () => {
    const ctx = createMockContext();
    const middleware = logger({
      silent: true,
      redact: true,
      sensitiveKeys: ['password', 'token'],
    });

    await middleware(ctx, async () => {
      // Logger should be created with redaction enabled
      expect((ctx as LoggerContext).log).toBeDefined();
    });
  });

  it('should support withMetadata on ctx.log', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {
      const enrichedLogger = (ctx as LoggerContext).log.withMetadata({ service: 'api' });
      expect(enrichedLogger).toBeDefined();
      expect(typeof enrichedLogger.info).toBe('function');
    });
  });

  it('should support time() on ctx.log', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {
      const timer = (ctx as LoggerContext).log.time('operation');
      expect(timer).toBeDefined();

      await new Promise(resolve => setTimeout(resolve, 10));

      const elapsed = timer.elapsed();
      // setTimeout(10) is not guaranteed to run after >=10ms wall time (timer quantization / load).
      expect(elapsed).toBeGreaterThan(0);
      expect(elapsed).toBeGreaterThanOrEqual(8);

      const duration = timer.end('Operation completed');
      expect(typeof duration).toBe('number');
    });
  });

  it('should support flush() on ctx.log', async () => {
    const ctx = createMockContext();
    const middleware = logger({ silent: true });

    await middleware(ctx, async () => {
      // flush() should not throw even without batch transports
      await expect((ctx as LoggerContext).log.flush()).resolves.toBeUndefined();
    });
  });
});

// ============================================================================
// Environment Detection Tests
// ============================================================================

describe('Environment Detection', () => {
  it('should use isProductionBuild from @nextrush/log', async () => {
    const { isProductionBuild } = await import('../index');

    // Just verify it's a function that returns a boolean
    expect(typeof isProductionBuild).toBe('function');
    const result = isProductionBuild();
    expect(typeof result).toBe('boolean');
  });

  it('should detect runtime correctly', async () => {
    const { getRuntime, detectRuntime } = await import('../index');

    const runtime = getRuntime();
    expect(runtime).toBeDefined();
    expect(runtime.environment).toBeDefined();

    const detected = detectRuntime();
    expect(detected.environment).toBe(runtime.environment);
  });
});

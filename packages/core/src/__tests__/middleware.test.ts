/**
 * @nextrush/core - Middleware Composition Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { compose, isMiddleware, flattenMiddleware } from '../middleware';
import type { Context, Middleware } from '@nextrush/types';

// Mock context for testing
function createMockContext(): Context {
  return {
    method: 'GET',
    url: '/test',
    path: '/test',
    query: {},
    headers: {},
    ip: '127.0.0.1',
    body: undefined,
    params: {},
    status: 200,
    json: vi.fn(),
    send: vi.fn(),
    html: vi.fn(),
    redirect: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    next: vi.fn().mockResolvedValue(undefined),
    state: {},
    raw: {
      req: {} as never,
      res: {} as never,
    },
  } as Context;
}

describe('compose', () => {
  describe('basic composition', () => {
    it('should compose middleware functions', async () => {
      const middleware: Middleware[] = [
        async (_ctx, next) => {
          await next();
        },
      ];

      const composed = compose(middleware);
      expect(typeof composed).toBe('function');
    });

    it('should return a function that can be awaited', async () => {
      const middleware: Middleware[] = [];
      const composed = compose(middleware);
      const ctx = createMockContext();

      await expect(composed(ctx)).resolves.toBeUndefined();
    });
  });

  describe('execution order', () => {
    it('should execute middleware in correct order (onion model)', async () => {
      const order: string[] = [];

      const middleware: Middleware[] = [
        async (_ctx, next) => {
          order.push('1-before');
          await next();
          order.push('1-after');
        },
        async (_ctx, next) => {
          order.push('2-before');
          await next();
          order.push('2-after');
        },
        async (_ctx, next) => {
          order.push('3-before');
          await next();
          order.push('3-after');
        },
      ];

      const composed = compose(middleware);
      await composed(createMockContext());

      expect(order).toEqual([
        '1-before',
        '2-before',
        '3-before',
        '3-after',
        '2-after',
        '1-after',
      ]);
    });

    it('should work with single middleware', async () => {
      const order: string[] = [];

      const middleware: Middleware[] = [
        async (_ctx, next) => {
          order.push('before');
          await next();
          order.push('after');
        },
      ];

      const composed = compose(middleware);
      await composed(createMockContext());

      expect(order).toEqual(['before', 'after']);
    });

    it('should handle empty middleware array', async () => {
      const composed = compose([]);
      const ctx = createMockContext();

      await expect(composed(ctx)).resolves.toBeUndefined();
    });
  });

  describe('context passing', () => {
    it('should pass context to all middleware', async () => {
      const ctx = createMockContext();
      const receivedContexts: Context[] = [];

      const middleware: Middleware[] = [
        async (c, next) => {
          receivedContexts.push(c);
          await next();
        },
        async (c, next) => {
          receivedContexts.push(c);
          await next();
        },
      ];

      const composed = compose(middleware);
      await composed(ctx);

      expect(receivedContexts).toHaveLength(2);
      expect(receivedContexts[0]).toBe(ctx);
      expect(receivedContexts[1]).toBe(ctx);
    });

    it('should allow middleware to modify context state', async () => {
      const ctx = createMockContext();

      const middleware: Middleware[] = [
        async (c, next) => {
          c.state['user'] = { id: 1 };
          await next();
        },
        async (c, next) => {
          c.state['role'] = 'admin';
          await next();
        },
      ];

      const composed = compose(middleware);
      await composed(ctx);

      expect(ctx.state).toEqual({ user: { id: 1 }, role: 'admin' });
    });
  });

  describe('error handling', () => {
    it('should throw if middleware is not an array', () => {
      expect(() => compose('not an array' as unknown as Middleware[])).toThrow(TypeError);
      expect(() => compose('not an array' as unknown as Middleware[])).toThrow(
        'Middleware stack must be an array'
      );
    });

    it('should throw if middleware contains non-function', () => {
      expect(() => compose(['string'] as unknown as Middleware[])).toThrow(TypeError);
      expect(() => compose(['string'] as unknown as Middleware[])).toThrow(
        'Middleware must be a function'
      );
    });

    it('should throw if next() is called multiple times', async () => {
      const middleware: Middleware[] = [
        async (_ctx, next) => {
          await next();
          await next(); // Second call should throw
        },
      ];

      const composed = compose(middleware);

      await expect(composed(createMockContext())).rejects.toThrow('next() called multiple times');
    });

    it('should propagate errors from middleware', async () => {
      const middleware: Middleware[] = [
        async () => {
          throw new Error('Test error');
        },
      ];

      const composed = compose(middleware);

      await expect(composed(createMockContext())).rejects.toThrow('Test error');
    });

    it('should propagate errors from nested middleware', async () => {
      const middleware: Middleware[] = [
        async (_ctx, next) => {
          await next();
        },
        async () => {
          throw new Error('Nested error');
        },
      ];

      const composed = compose(middleware);

      await expect(composed(createMockContext())).rejects.toThrow('Nested error');
    });
  });

  describe('early termination', () => {
    it('should allow middleware to skip remaining middleware', async () => {
      const order: string[] = [];

      const middleware: Middleware[] = [
        async (_ctx, _next) => {
          order.push('first');
          // Not calling next()
        },
        async (_ctx, next) => {
          order.push('second');
          await next();
        },
      ];

      const composed = compose(middleware);
      await composed(createMockContext());

      expect(order).toEqual(['first']);
    });
  });

  describe('with final next', () => {
    it('should call provided next function at the end', async () => {
      const finalNext = vi.fn().mockResolvedValue(undefined);

      const middleware: Middleware[] = [
        async (_ctx, next) => {
          await next();
        },
      ];

      const composed = compose(middleware);
      await composed(createMockContext(), finalNext);

      expect(finalNext).toHaveBeenCalledTimes(1);
    });
  });
});

describe('isMiddleware', () => {
  it('should return true for functions', () => {
    expect(isMiddleware(() => {})).toBe(true);
    expect(isMiddleware(async () => {})).toBe(true);
  });

  it('should return false for non-functions', () => {
    expect(isMiddleware('string')).toBe(false);
    expect(isMiddleware(123)).toBe(false);
    expect(isMiddleware(null)).toBe(false);
    expect(isMiddleware(undefined)).toBe(false);
    expect(isMiddleware({})).toBe(false);
  });
});

describe('flattenMiddleware', () => {
  it('should flatten nested middleware arrays', () => {
    const mw1: Middleware = vi.fn();
    const mw2: Middleware = vi.fn();
    const mw3: Middleware = vi.fn();

    const result = flattenMiddleware([mw1, [mw2, mw3]]);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe(mw1);
    expect(result[1]).toBe(mw2);
    expect(result[2]).toBe(mw3);
  });

  it('should handle deeply nested arrays', () => {
    const mw: Middleware = vi.fn();

    const result = flattenMiddleware([[mw]]);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(mw);
  });

  it('should return empty array for empty input', () => {
    expect(flattenMiddleware([])).toEqual([]);
  });
});

/**
 * Tests for Middleware Chain
 *
 * @packageDocumentation
 */

import { MiddlewareChain } from '@/core/orchestration/middleware-chain';
import type { Context, Middleware } from '@/types/context';
import { beforeEach, describe, expect, it } from 'vitest';

describe('MiddlewareChain', () => {
  let middlewareChain: MiddlewareChain;
  let mockContext: Context;

  beforeEach(() => {
    middlewareChain = new MiddlewareChain();
    mockContext = {
      method: 'GET',
      path: '/test',
      body: undefined,
      params: {},
      state: {},
    } as Context;
  });

  describe('constructor', () => {
    it('should initialize empty middleware chain', () => {
      expect(middlewareChain.isEmpty()).toBe(true);
      expect(middlewareChain.getStats().count).toBe(0);
    });
  });

  describe('use', () => {
    it('should add middleware to chain', () => {
      const middleware: Middleware = async (_ctx, next) => {
        await next();
      };

      middlewareChain.use(middleware);

      expect(middlewareChain.isEmpty()).toBe(false);
      expect(middlewareChain.getStats().count).toBe(1);
    });

    it('should add multiple middleware in order', () => {
      const middleware1: Middleware = async (ctx, next) => {
        ctx.state['order'] = ctx.state['order'] || [];
        (ctx.state['order'] as number[]).push(1);
        await next();
      };

      const middleware2: Middleware = async (ctx, next) => {
        ctx.state['order'] = ctx.state['order'] || [];
        (ctx.state['order'] as number[]).push(2);
        await next();
      };

      middlewareChain.use(middleware1);
      middlewareChain.use(middleware2);

      expect(middlewareChain.getStats().count).toBe(2);
    });

    it('should invalidate composition cache when middleware is added', () => {
      const middleware: Middleware = async (_ctx, next) => {
        await next();
      };

      // Execute once to create composition
      middlewareChain.use(middleware);

      // Add another middleware to invalidate cache
      middlewareChain.use(middleware);

      expect(middlewareChain.getStats().count).toBe(2);
    });
  });

  describe('execute', () => {
    it('should execute empty middleware chain', async () => {
      await expect(
        middlewareChain.execute(mockContext)
      ).resolves.toBeUndefined();
    });

    it('should execute single middleware', async () => {
      let executed = false;
      const middleware: Middleware = async (_ctx, next) => {
        executed = true;
        await next();
      };

      middlewareChain.use(middleware);
      await middlewareChain.execute(mockContext);

      expect(executed).toBe(true);
    });

    it('should execute middleware in correct order', async () => {
      const executionOrder: number[] = [];

      const middleware1: Middleware = async (_ctx, next) => {
        executionOrder.push(1);
        await next();
        executionOrder.push(4);
      };

      const middleware2: Middleware = async (_ctx, next) => {
        executionOrder.push(2);
        await next();
        executionOrder.push(3);
      };

      middlewareChain.use(middleware1);
      middlewareChain.use(middleware2);
      await middlewareChain.execute(mockContext);

      expect(executionOrder).toEqual([1, 2, 3, 4]);
    });

    it('should handle middleware that modifies context', async () => {
      const middleware1: Middleware = async (ctx, next) => {
        ctx.state['middleware1'] = 'executed';
        await next();
      };

      const middleware2: Middleware = async (ctx, next) => {
        ctx.state['middleware2'] = 'executed';
        await next();
      };

      middlewareChain.use(middleware1);
      middlewareChain.use(middleware2);
      await middlewareChain.execute(mockContext);

      expect(mockContext.state['middleware1']).toBe('executed');
      expect(mockContext.state['middleware2']).toBe('executed');
    });

    it('should stop execution when next() is not called', async () => {
      let middleware2Executed = false;

      const middleware1: Middleware = async (ctx, _next) => {
        // Don't call next()
        ctx.state['stopped'] = true;
      };

      const middleware2: Middleware = async (_ctx, next) => {
        middleware2Executed = true;
        await next();
      };

      middlewareChain.use(middleware1);
      middlewareChain.use(middleware2);
      await middlewareChain.execute(mockContext);

      expect(mockContext.state['stopped']).toBe(true);
      expect(middleware2Executed).toBe(false);
    });

    it('should handle middleware errors', async () => {
      const testError = new Error('Middleware error');
      const middleware: Middleware = async (_ctx, _next) => {
        throw testError;
      };

      middlewareChain.use(middleware);

      await expect(middlewareChain.execute(mockContext)).rejects.toThrow(
        testError
      );
    });

    it('should handle async middleware properly', async () => {
      let asyncResult = '';

      const middleware1: Middleware = async (_ctx, next) => {
        asyncResult += 'start1-';
        await next();
        asyncResult += 'end1';
      };

      const middleware2: Middleware = async (_ctx, next) => {
        asyncResult += 'start2-';
        await new Promise(resolve => setTimeout(resolve, 10));
        asyncResult += 'middle2-';
        await next();
        asyncResult += 'end2-';
      };

      middlewareChain.use(middleware1);
      middlewareChain.use(middleware2);
      await middlewareChain.execute(mockContext);

      expect(asyncResult).toBe('start1-start2-middle2-end2-end1');
    });

    it('should reuse composed function for performance', async () => {
      const middleware: Middleware = async (ctx, next) => {
        ctx.state['executions'] =
          ((ctx.state['executions'] as number) || 0) + 1;
        await next();
      };

      middlewareChain.use(middleware);

      // Execute multiple times
      await middlewareChain.execute(mockContext);
      await middlewareChain.execute(mockContext);
      await middlewareChain.execute(mockContext);

      expect(mockContext.state['executions']).toBe(3);
    });

    it('should handle non-async middleware that returns promise', async () => {
      const middleware: Middleware = (ctx, next) => {
        return Promise.resolve().then(async () => {
          ctx.state['promiseMiddleware'] = true;
          await next();
        });
      };

      middlewareChain.use(middleware);
      await middlewareChain.execute(mockContext);

      expect(mockContext.state['promiseMiddleware']).toBe(true);
    });

    it('should throw error when next() is called multiple times', async () => {
      const middleware: Middleware = async (_ctx, next) => {
        await next();
        await next(); // This should throw
      };

      middlewareChain.use(middleware);

      await expect(middlewareChain.execute(mockContext)).rejects.toThrow(
        'next() called multiple times'
      );
    });
  });

  describe('getStats', () => {
    it('should return correct middleware count', () => {
      const middleware1: Middleware = async (_ctx, next) => await next();
      const middleware2: Middleware = async (_ctx, next) => await next();

      middlewareChain.use(middleware1);
      middlewareChain.use(middleware2);

      const stats = middlewareChain.getStats();

      expect(stats.count).toBe(2);
      expect(stats.middleware).toHaveLength(2);
    });

    it('should return middleware names when available', () => {
      const namedMiddleware: Middleware = async function corsMiddleware(
        _ctx,
        next
      ) {
        await next();
      };

      const anonymousMiddleware: Middleware = async (_ctx, next) => {
        await next();
      };

      middlewareChain.use(namedMiddleware);
      middlewareChain.use(anonymousMiddleware);

      const stats = middlewareChain.getStats();

      expect(stats.middleware).toEqual([
        'corsMiddleware',
        'anonymousMiddleware',
      ]);
    });

    it('should handle middleware without names', () => {
      const middleware: Middleware = async (_ctx, next) => await next();

      middlewareChain.use(middleware);

      const stats = middlewareChain.getStats();

      expect(stats.middleware).toEqual(['middleware']);
    });
  });

  describe('clear', () => {
    it('should remove all middleware', () => {
      const middleware1: Middleware = async (_ctx, next) => await next();
      const middleware2: Middleware = async (_ctx, next) => await next();

      middlewareChain.use(middleware1);
      middlewareChain.use(middleware2);

      expect(middlewareChain.getStats().count).toBe(2);

      middlewareChain.clear();

      expect(middlewareChain.isEmpty()).toBe(true);
      expect(middlewareChain.getStats().count).toBe(0);
    });

    it('should invalidate composition cache', async () => {
      const middleware: Middleware = async (ctx, next) => {
        ctx.state['executed'] = true;
        await next();
      };

      middlewareChain.use(middleware);
      await middlewareChain.execute(mockContext);

      expect(mockContext.state['executed']).toBe(true);

      middlewareChain.clear();

      // Reset context
      mockContext.state = {};
      await middlewareChain.execute(mockContext);

      expect(mockContext.state['executed']).toBeUndefined();
    });
  });

  describe('getMiddleware', () => {
    it('should return middleware at specific index', () => {
      const middleware1: Middleware = async (_ctx, next) => await next();
      const middleware2: Middleware = async (_ctx, next) => await next();

      middlewareChain.use(middleware1);
      middlewareChain.use(middleware2);

      expect(middlewareChain.getMiddleware(0)).toBe(middleware1);
      expect(middlewareChain.getMiddleware(1)).toBe(middleware2);
    });

    it('should return undefined for invalid index', () => {
      const middleware: Middleware = async (_ctx, next) => await next();

      middlewareChain.use(middleware);

      expect(middlewareChain.getMiddleware(-1)).toBeUndefined();
      expect(middlewareChain.getMiddleware(1)).toBeUndefined();
      expect(middlewareChain.getMiddleware(10)).toBeUndefined();
    });
  });

  describe('removeMiddleware', () => {
    it('should remove middleware at specific index', () => {
      const middleware1: Middleware = async (_ctx, next) => await next();
      const middleware2: Middleware = async (_ctx, next) => await next();
      const middleware3: Middleware = async (_ctx, next) => await next();

      middlewareChain.use(middleware1);
      middlewareChain.use(middleware2);
      middlewareChain.use(middleware3);

      expect(middlewareChain.getStats().count).toBe(3);

      const removed = middlewareChain.removeMiddleware(1);

      expect(removed).toBe(true);
      expect(middlewareChain.getStats().count).toBe(2);
      expect(middlewareChain.getMiddleware(0)).toBe(middleware1);
      expect(middlewareChain.getMiddleware(1)).toBe(middleware3);
    });

    it('should return false for invalid index', () => {
      const middleware: Middleware = async (_ctx, next) => await next();

      middlewareChain.use(middleware);

      expect(middlewareChain.removeMiddleware(-1)).toBe(false);
      expect(middlewareChain.removeMiddleware(1)).toBe(false);
      expect(middlewareChain.removeMiddleware(10)).toBe(false);
      expect(middlewareChain.getStats().count).toBe(1);
    });

    it('should invalidate composition cache', async () => {
      const middleware1: Middleware = async (ctx, next) => {
        ctx.state['middleware1'] = true;
        await next();
      };

      const middleware2: Middleware = async (ctx, next) => {
        ctx.state['middleware2'] = true;
        await next();
      };

      middlewareChain.use(middleware1);
      middlewareChain.use(middleware2);

      // Execute to create composition
      await middlewareChain.execute(mockContext);
      expect(mockContext.state['middleware1']).toBe(true);
      expect(mockContext.state['middleware2']).toBe(true);

      // Remove middleware and reset context
      middlewareChain.removeMiddleware(1);
      mockContext.state = {};

      // Execute again
      await middlewareChain.execute(mockContext);
      expect(mockContext.state['middleware1']).toBe(true);
      expect(mockContext.state['middleware2']).toBeUndefined();
    });
  });

  describe('isEmpty', () => {
    it('should return true when no middleware', () => {
      expect(middlewareChain.isEmpty()).toBe(true);
    });

    it('should return false when middleware exists', () => {
      const middleware: Middleware = async (_ctx, next) => await next();

      middlewareChain.use(middleware);

      expect(middlewareChain.isEmpty()).toBe(false);
    });

    it('should return true after clearing', () => {
      const middleware: Middleware = async (_ctx, next) => await next();

      middlewareChain.use(middleware);
      expect(middlewareChain.isEmpty()).toBe(false);

      middlewareChain.clear();
      expect(middlewareChain.isEmpty()).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle middleware with no parameters', async () => {
      const middleware = async () => {
        // No parameters
      };

      middlewareChain.use(middleware as any);
      await middlewareChain.execute(mockContext);

      // Should not throw
    });

    it('should handle middleware that throws synchronously', async () => {
      const middleware: Middleware = (_ctx, _next) => {
        throw new Error('Sync error');
      };

      middlewareChain.use(middleware);

      await expect(middlewareChain.execute(mockContext)).rejects.toThrow(
        'Sync error'
      );
    });

    it('should handle complex async middleware chains', async () => {
      const results: string[] = [];

      const middleware1: Middleware = async (_ctx, next) => {
        results.push('1-start');
        await new Promise(resolve => setTimeout(resolve, 5));
        await next();
        results.push('1-end');
      };

      const middleware2: Middleware = async (_ctx, next) => {
        results.push('2-start');
        await next();
        await new Promise(resolve => setTimeout(resolve, 5));
        results.push('2-end');
      };

      const middleware3: Middleware = async (_ctx, next) => {
        results.push('3-start');
        await next();
        results.push('3-end');
      };

      middlewareChain.use(middleware1);
      middlewareChain.use(middleware2);
      middlewareChain.use(middleware3);

      await middlewareChain.execute(mockContext);

      expect(results).toEqual([
        '1-start',
        '2-start',
        '3-start',
        '3-end',
        '2-end',
        '1-end',
      ]);
    });

    it('should handle middleware composition defensive copy', async () => {
      const middleware1: Middleware = async (ctx, next) => {
        ctx.state['step1'] = true;
        await next();
      };

      middlewareChain.use(middleware1);

      // Execute once
      await middlewareChain.execute(mockContext);
      expect(mockContext.state['step1']).toBe(true);

      // Add more middleware after composition
      const middleware2: Middleware = async (ctx, next) => {
        ctx.state['step2'] = true;
        await next();
      };

      middlewareChain.use(middleware2);

      // Reset context and execute again
      mockContext.state = {};
      await middlewareChain.execute(mockContext);

      expect(mockContext.state['step1']).toBe(true);
      expect(mockContext.state['step2']).toBe(true);
    });
  });
});

/**
 * Request Handler Unit Tests
 */

import {
  createRequestHandler,
  executeMiddleware,
  executeRoute,
} from '@/core/app/request-handler';
import type { Context, Middleware } from '@/types/context';
import { describe, expect, it, vi } from 'vitest';

// Mock the context functions
vi.mock('@/core/app/context', () => ({
  createContext: vi.fn(() => ({
    method: 'GET',
    path: '/test',
    params: {},
    body: undefined,
    req: { body: undefined },
    res: {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    },
  })),
  releaseContext: vi.fn(),
}));

vi.mock('@/core/context/immutable', () => ({
  createSafeContext: vi.fn((ctx) => ({
    ...ctx,
    commit: vi.fn(),
  })),
  createSafeMiddleware: vi.fn((mw) => mw),
}));

describe('Request Handler', () => {
  describe('executeMiddleware', () => {
    it('should execute middleware in production mode', async () => {
      const executionOrder: number[] = [];

      const middleware: Middleware[] = [
        async (_ctx, next) => {
          executionOrder.push(1);
          await next();
        },
        async (_ctx, next) => {
          executionOrder.push(2);
          await next();
        },
        async (_ctx, next) => {
          executionOrder.push(3);
          await next();
        },
      ];

      const ctx = { method: 'GET', path: '/test' } as Context;
      await executeMiddleware(ctx, middleware, false);

      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it('should handle empty middleware array', async () => {
      const ctx = { method: 'GET', path: '/test' } as Context;
      await executeMiddleware(ctx, [], false);
      // Should complete without error
    });

    it('should handle sync middleware', async () => {
      const executed: boolean[] = [];

      const middleware: Middleware[] = [
        (_ctx, next) => {
          executed.push(true);
          next();
          return undefined as any;
        },
      ];

      const ctx = { method: 'GET', path: '/test' } as Context;
      await executeMiddleware(ctx, middleware, false);

      expect(executed).toEqual([true]);
    });

    it('should stop execution when middleware does not call next', async () => {
      const executionOrder: number[] = [];

      const middleware: Middleware[] = [
        async (_ctx, _next) => {
          executionOrder.push(1);
          // Not calling next()
        },
        async (_ctx, next) => {
          executionOrder.push(2);
          await next();
        },
      ];

      const ctx = { method: 'GET', path: '/test' } as Context;
      await executeMiddleware(ctx, middleware, false);

      expect(executionOrder).toEqual([1]);
    });
  });

  describe('executeRoute', () => {
    it('should return 404 when no route matches', async () => {
      const mockStatus = vi.fn().mockReturnThis();
      const mockJson = vi.fn();

      const ctx = {
        method: 'GET',
        path: '/nonexistent',
        res: {
          status: mockStatus,
          json: mockJson,
        },
      } as unknown as Context;

      const mockRouter = {
        find: vi.fn().mockReturnValue(null),
      };

      await executeRoute(ctx, mockRouter as any, false);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Not Found' });
    });

    it('should execute handler when route matches', async () => {
      const handlerExecuted = vi.fn();

      const ctx = {
        method: 'GET',
        path: '/test',
        params: {},
        res: {
          status: vi.fn().mockReturnThis(),
          json: vi.fn(),
        },
      } as unknown as Context;

      const mockRouter = {
        find: vi.fn().mockReturnValue({
          handler: handlerExecuted,
          params: { id: '123' },
        }),
      };

      await executeRoute(ctx, mockRouter as any, false);

      expect(handlerExecuted).toHaveBeenCalled();
      expect(Object.isFrozen(ctx.params)).toBe(true);
    });

    it('should use compiled handler when available', async () => {
      const compiledHandler = vi.fn().mockResolvedValue(undefined);

      const ctx = {
        method: 'GET',
        path: '/test',
        params: {},
      } as unknown as Context;

      const mockRouter = {
        find: vi.fn().mockReturnValue({
          handler: vi.fn(),
          compiled: compiledHandler,
          params: {},
        }),
      };

      await executeRoute(ctx, mockRouter as any, false);

      expect(compiledHandler).toHaveBeenCalled();
    });

    it('should execute route middleware in order', async () => {
      const executionOrder: string[] = [];

      const ctx = {
        method: 'GET',
        path: '/test',
        params: {},
      } as unknown as Context;

      const mockRouter = {
        find: vi.fn().mockReturnValue({
          handler: async () => {
            executionOrder.push('handler');
          },
          params: {},
          middleware: [
            async (_ctx: Context, next: () => Promise<void>) => {
              executionOrder.push('mw1');
              await next();
            },
            async (_ctx: Context, next: () => Promise<void>) => {
              executionOrder.push('mw2');
              await next();
            },
          ],
        }),
      };

      await executeRoute(ctx, mockRouter as any, false);

      expect(executionOrder).toEqual(['mw1', 'mw2', 'handler']);
    });
  });

  describe('createRequestHandler', () => {
    it('should create a request handler function', () => {
      const config = {
        options: { debug: false, port: 3000, host: 'localhost' } as any,
        middleware: [],
        router: { find: vi.fn() } as any,
        findExceptionFilter: () => null,
      };

      const handler = createRequestHandler(config);

      expect(typeof handler).toBe('function');
    });
  });
});

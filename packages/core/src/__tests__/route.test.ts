/**
 * @nextrush/core - app.route() Tests
 *
 * Tests for the Hono-style router mounting API
 */

import type { Context, Middleware } from '@nextrush/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Application, createApp, Routable } from '../application';

// Mock context factory
function createMockContext(overrides: Partial<Context> = {}): Context {
  const ctx = {
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
    throw: vi.fn(),
    assert: vi.fn(),
    runtime: 'node' as const,
    bodySource: {} as never,
    ...overrides,
  } as Context;

  return ctx;
}

// Mock router that implements Routable
function createMockRouter(): Routable & {
  handlers: Map<string, Middleware>;
  addRoute: (path: string, handler: Middleware) => void;
} {
  const handlers = new Map<string, Middleware>();

  return {
    handlers,
    addRoute(path: string, handler: Middleware) {
      handlers.set(path, handler);
    },
    routes(): Middleware {
      return async (ctx, next) => {
        const handler = handlers.get(ctx.path);
        if (handler) {
          await handler(ctx, next);
        } else if (next) {
          await next();
        }
      };
    },
  };
}

describe('app.route()', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp();
  });

  describe('basic mounting', () => {
    it('should mount router at path prefix', async () => {
      const router = createMockRouter();
      router.addRoute('/', async (ctx) => {
        ctx.json({ message: 'users list' });
      });

      app.route('/api/users', router);

      const handler = app.callback();
      const ctx = createMockContext({ path: '/api/users' });

      await handler(ctx);

      expect(ctx.json).toHaveBeenCalledWith({ message: 'users list' });
    });

    it('should match routes with path parameters after prefix', async () => {
      const router = createMockRouter();
      router.addRoute('/123', async (ctx) => {
        ctx.json({ id: '123' });
      });

      app.route('/users', router);

      const handler = app.callback();
      const ctx = createMockContext({ path: '/users/123' });

      await handler(ctx);

      expect(ctx.json).toHaveBeenCalledWith({ id: '123' });
    });

    it('should not match paths that do not start with prefix', async () => {
      const router = createMockRouter();
      router.addRoute('/', async (ctx) => {
        ctx.json({ matched: true });
      });

      let nextCalled = false;
      app.route('/api', router);
      app.use(async () => {
        nextCalled = true;
      });

      const handler = app.callback();
      const ctx = createMockContext({ path: '/other' });

      await handler(ctx);

      expect(ctx.json).not.toHaveBeenCalled();
      expect(nextCalled).toBe(true);
    });

    it('should not match partial prefix (e.g., /apiextra when prefix is /api)', async () => {
      const router = createMockRouter();
      router.addRoute('/', async (ctx) => {
        ctx.json({ matched: true });
      });

      let nextCalled = false;
      app.route('/api', router);
      app.use(async () => {
        nextCalled = true;
      });

      const handler = app.callback();
      const ctx = createMockContext({ path: '/apiextra' });

      await handler(ctx);

      expect(ctx.json).not.toHaveBeenCalled();
      expect(nextCalled).toBe(true);
    });
  });

  describe('path stripping', () => {
    it('should strip prefix from path when passing to router', async () => {
      let receivedPath: string | undefined;

      const router = createMockRouter();
      router.handlers.set('/', async (ctx) => {
        receivedPath = ctx.path;
        ctx.json({ path: ctx.path });
      });

      app.route('/api/v1', router);

      const handler = app.callback();
      const ctx = createMockContext({ path: '/api/v1' });

      await handler(ctx);

      expect(receivedPath).toBe('/');
    });

    it('should handle nested paths correctly', async () => {
      let receivedPath: string | undefined;

      const router: Routable = {
        routes() {
          return async (ctx) => {
            receivedPath = ctx.path;
            ctx.json({ path: ctx.path });
          };
        },
      };

      app.route('/api', router);

      const handler = app.callback();
      const ctx = createMockContext({ path: '/api/users/123' });

      await handler(ctx);

      expect(receivedPath).toBe('/users/123');
    });
  });

  describe('chaining', () => {
    it('should return this for chaining', () => {
      const router = createMockRouter();
      const result = app.route('/api', router);

      expect(result).toBe(app);
    });

    it('should support chaining multiple routes', async () => {
      const usersRouter = createMockRouter();
      usersRouter.addRoute('/', async (ctx) => ctx.json({ type: 'users' }));

      const postsRouter = createMockRouter();
      postsRouter.addRoute('/', async (ctx) => ctx.json({ type: 'posts' }));

      app.route('/users', usersRouter).route('/posts', postsRouter);

      const handler = app.callback();

      const usersCtx = createMockContext({ path: '/users' });
      await handler(usersCtx);
      expect(usersCtx.json).toHaveBeenCalledWith({ type: 'users' });

      const postsCtx = createMockContext({ path: '/posts' });
      await handler(postsCtx);
      expect(postsCtx.json).toHaveBeenCalledWith({ type: 'posts' });
    });
  });

  describe('middleware integration', () => {
    it('should work with other middleware', async () => {
      const order: string[] = [];

      app.use(async (_ctx, next) => {
        order.push('before');
        await next();
        order.push('after');
      });

      const router = createMockRouter();
      router.addRoute('/', async (ctx) => {
        order.push('handler');
        ctx.json({ done: true });
      });

      app.route('/api', router);

      const handler = app.callback();
      const ctx = createMockContext({ path: '/api' });

      await handler(ctx);

      expect(order).toEqual(['before', 'handler', 'after']);
    });

    it('should call next() when router does not match', async () => {
      const router = createMockRouter();
      router.addRoute('/specific', async (ctx) => ctx.json({ matched: true }));

      let fallbackCalled = false;
      app.route('/api', router);
      app.use(async (ctx) => {
        fallbackCalled = true;
        ctx.status = 404;
        ctx.json({ error: 'Not found' });
      });

      const handler = app.callback();
      const ctx = createMockContext({ path: '/api/other' });

      await handler(ctx);

      expect(fallbackCalled).toBe(true);
    });
  });

  describe('state preservation', () => {
    it('should preserve state._originalPath and state._routePrefix', async () => {
      let capturedState: Record<string, unknown> = {};

      const router: Routable = {
        routes() {
          return async (ctx) => {
            capturedState = { ...ctx.state };
            ctx.json({ done: true });
          };
        },
      };

      app.route('/api/v1', router);

      const handler = app.callback();
      const ctx = createMockContext({ path: '/api/v1/users' });

      await handler(ctx);

      expect(capturedState._originalPath).toBe('/api/v1/users');
      expect(capturedState._routePrefix).toBe('/api/v1');
    });
  });

  describe('trailing slash handling', () => {
    it('should handle prefix with trailing slash', async () => {
      const router = createMockRouter();
      router.addRoute('/', async (ctx) => ctx.json({ matched: true }));

      app.route('/api/', router);

      const handler = app.callback();
      const ctx = createMockContext({ path: '/api' });

      await handler(ctx);

      expect(ctx.json).toHaveBeenCalledWith({ matched: true });
    });

    it('should handle prefix without trailing slash', async () => {
      const router = createMockRouter();
      router.addRoute('/', async (ctx) => ctx.json({ matched: true }));

      app.route('/api', router);

      const handler = app.callback();
      const ctx = createMockContext({ path: '/api' });

      await handler(ctx);

      expect(ctx.json).toHaveBeenCalledWith({ matched: true });
    });
  });
});

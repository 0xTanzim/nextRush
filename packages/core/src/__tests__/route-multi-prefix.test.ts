/**
 * @nextrush/core - Multi-Prefix Router Mounting Tests
 *
 * Tests for mounting routers across multiple path prefixes simultaneously
 * (app.route(['/api', '/v1'], router)), validating array inputs, prefix
 * normalization, root mounts, state recovery, and segment boundary isolation.
 */

import type { Middleware } from '@nextrush/types';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Application, Routable } from '../application';
import { createApp } from '../application';
import { createMockContext } from './_shared/create-mock-context';

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

describe('Multi-Prefix Router Mounting (app.route)', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp();
  });

  describe('Feature 1: Multi-prefix signature and dispatch', () => {
    it('mounts a router across multiple prefixes simultaneously', async () => {
      const router = createMockRouter();
      router.addRoute('/users', async (ctx) => {
        ctx.json({ ok: true, matchedPath: ctx.path });
      });

      app.route(['/api', '/v1'], router);

      const handler = app.callback();

      const ctxApi = createMockContext({ path: '/api/users' });
      await handler(ctxApi);
      expect(ctxApi.json).toHaveBeenCalledWith({ ok: true, matchedPath: '/users' });

      const ctxV1 = createMockContext({ path: '/v1/users' });
      await handler(ctxV1);
      expect(ctxV1.json).toHaveBeenCalledWith({ ok: true, matchedPath: '/users' });
    });

    it('mounts across three or more prefixes', async () => {
      const router = createMockRouter();
      router.addRoute('/items', async (ctx) => {
        ctx.json({ items: [1, 2, 3] });
      });

      app.route(['/api/v1', '/api/v2', '/internal/api'], router);

      const handler = app.callback();

      for (const prefix of ['/api/v1', '/api/v2', '/internal/api']) {
        const ctx = createMockContext({ path: `${prefix}/items` });
        await handler(ctx);
        expect(ctx.json).toHaveBeenCalledWith({ items: [1, 2, 3] });
      }
    });

    it('supports chaining multi-prefix mounts', async () => {
      const publicRouter = createMockRouter();
      publicRouter.addRoute('/status', async (ctx) => ctx.json({ status: 'public' }));

      const adminRouter = createMockRouter();
      adminRouter.addRoute('/status', async (ctx) => ctx.json({ status: 'admin' }));

      app
        .route(['/api', '/v1'], publicRouter)
        .route(['/admin', '/superadmin'], adminRouter);

      const handler = app.callback();

      const ctxPub = createMockContext({ path: '/v1/status' });
      await handler(ctxPub);
      expect(ctxPub.json).toHaveBeenCalledWith({ status: 'public' });

      const ctxAdm = createMockContext({ path: '/superadmin/status' });
      await handler(ctxAdm);
      expect(ctxAdm.json).toHaveBeenCalledWith({ status: 'admin' });
    });

    it('supports readonly string arrays', async () => {
      const prefixes: readonly string[] = Object.freeze(['/v1', '/v2'] as const);
      const router = createMockRouter();
      router.addRoute('/health', async (ctx) => ctx.json({ status: 'ok' }));

      app.route(prefixes, router);

      const handler = app.callback();
      const ctx = createMockContext({ path: '/v2/health' });
      await handler(ctx);
      expect(ctx.json).toHaveBeenCalledWith({ status: 'ok' });
    });
  });

  describe('Feature 2: Empty prefix array guard', () => {
    it('throws descriptive Error when an empty prefix array is passed', () => {
      const router = createMockRouter();

      expect(() => {
        app.route([], router);
      }).toThrowError('app.route() requires at least one path prefix when an array is provided');
    });

    it('does not mutate middleware stack when empty array throws', () => {
      const router = createMockRouter();
      expect(app.middlewareCount).toBe(0);

      expect(() => app.route([], router)).toThrow();
      expect(app.middlewareCount).toBe(0);
    });
  });

  describe('Feature 3: Type validation', () => {
    it('throws TypeError when path element is null', () => {
      const router = createMockRouter();
      expect(() => {
        app.route(['/api', null as unknown as string], router);
      }).toThrow(new TypeError('Route path prefix must be a string, received null'));
    });

    it('throws TypeError when path element is undefined', () => {
      const router = createMockRouter();
      expect(() => {
        app.route(['/api', undefined as unknown as string], router);
      }).toThrow(new TypeError('Route path prefix must be a string, received undefined'));
    });

    it('throws TypeError when path element is a number', () => {
      const router = createMockRouter();
      expect(() => {
        app.route(['/api', 123 as unknown as string], router);
      }).toThrow(new TypeError('Route path prefix must be a string, received number'));
    });

    it('throws TypeError when path element is an empty string', () => {
      const router = createMockRouter();
      expect(() => {
        app.route(['/api', ''], router);
      }).toThrow(new TypeError('Route path prefix must be a non-empty string'));
    });

    it('throws TypeError when path is neither a string nor array', () => {
      const router = createMockRouter();
      expect(() => {
        app.route(123 as unknown as string, router);
      }).toThrow(
        new TypeError('Route path prefix must be a string or array of strings, received number')
      );

      expect(() => {
        app.route(null as unknown as string, router);
      }).toThrow(
        new TypeError('Route path prefix must be a string or array of strings, received null')
      );
    });

    it('throws TypeError when router is invalid or missing routes method', () => {
      expect(() => {
        app.route('/api', null as unknown as Routable);
      }).toThrow(new TypeError('app.route() requires a router with a routes() method'));

      expect(() => {
        app.route(['/api', '/v1'], {} as unknown as Routable);
      }).toThrow(new TypeError('app.route() requires a router with a routes() method'));
    });
  });

  describe('Feature 4: Prefix normalization & root mount in array', () => {
    it('normalizes prefixes lacking leading slashes and with trailing slashes', async () => {
      const router = createMockRouter();
      router.addRoute('/status', async (ctx) => ctx.json({ ok: true }));

      app.route(['api/', 'v1/'], router);

      const handler = app.callback();

      const ctxApi = createMockContext({ path: '/api/status' });
      await handler(ctxApi);
      expect(ctxApi.json).toHaveBeenCalledWith({ ok: true });

      const ctxV1 = createMockContext({ path: '/v1/status' });
      await handler(ctxV1);
      expect(ctxV1.json).toHaveBeenCalledWith({ ok: true });
    });

    it('collapses multiple trailing slashes during normalization', async () => {
      const router = createMockRouter();
      router.addRoute('/users', async (ctx) => ctx.json({ ok: true }));

      app.route(['/api///', '/v1//'], router);

      const handler = app.callback();

      const ctxApi = createMockContext({ path: '/api/users' });
      await handler(ctxApi);
      expect(ctxApi.json).toHaveBeenCalledWith({ ok: true });
    });

    it('supports root mount within prefix array (e.g. ["/api", "/"])', async () => {
      const router = createMockRouter();
      router.addRoute('/health', async (ctx) => {
        ctx.json({ health: 'ok' });
      });

      app.route(['/api', '/'], router);

      const handler = app.callback();

      // Request under /api prefix
      const ctxApi = createMockContext({ path: '/api/health' });
      await handler(ctxApi);
      expect(ctxApi.json).toHaveBeenCalledWith({ health: 'ok' });

      // Request under root mount
      const ctxRoot = createMockContext({ path: '/health' });
      await handler(ctxRoot);
      expect(ctxRoot.json).toHaveBeenCalledWith({ health: 'ok' });
    });

    it('supports root prefix as first element (e.g. ["/", "/v1"])', async () => {
      const router = createMockRouter();
      router.addRoute('/ping', async (ctx) => ctx.json({ pong: true }));

      app.route(['/', '/v1'], router);

      const handler = app.callback();

      const ctxRoot = createMockContext({ path: '/ping' });
      await handler(ctxRoot);
      expect(ctxRoot.json).toHaveBeenCalledWith({ pong: true });

      const ctxV1 = createMockContext({ path: '/v1/ping' });
      await handler(ctxV1);
      expect(ctxV1.json).toHaveBeenCalledWith({ pong: true });
    });
  });

  describe('Feature 5: State isolation and path recovery', () => {
    it('strips prefix during sub-router execution and restores in finally', async () => {
      let subRouterPath: string | undefined;
      let afterMiddlewarePath: string | undefined;

      app.use(async (ctx, next) => {
        await next();
        afterMiddlewarePath = ctx.path;
      });

      const router: Routable = {
        routes() {
          return async (ctx) => {
            subRouterPath = ctx.path;
            ctx.json({ path: ctx.path });
          };
        },
      };

      app.route(['/api', '/v1'], router);

      const handler = app.callback();
      const ctx = createMockContext({ path: '/api/resource/123' });

      await handler(ctx);

      expect(subRouterPath).toBe('/resource/123');
      expect(ctx.path).toBe('/api/resource/123');
      expect(afterMiddlewarePath).toBe('/api/resource/123');
    });

    it('restores original path even if sub-router throws an error', async () => {
      const router: Routable = {
        routes() {
          return async () => {
            throw new Error('Handler crash');
          };
        },
      };

      app.route(['/api', '/v1'], router);

      const handler = app.callback();
      const ctx = createMockContext({ path: '/v1/crash' });

      await handler(ctx);
      expect(ctx.status).toBe(500);
      expect(ctx.path).toBe('/v1/crash');
    });

    it('temporarily restores path across downstream next() invocation', async () => {
      const order: string[] = [];

      const router: Routable = {
        routes() {
          return async (ctx, next) => {
            order.push(`sub-before:${ctx.path}`);
            if (next) await next();
            order.push(`sub-after:${ctx.path}`);
          };
        },
      };

      app.route(['/api'], router);

      app.use(async (ctx) => {
        order.push(`downstream:${ctx.path}`);
        ctx.json({ ok: true });
      });

      const handler = app.callback();
      const ctx = createMockContext({ path: '/api/downstream' });

      await handler(ctx);

      expect(order).toEqual([
        'sub-before:/downstream',
        'downstream:/api/downstream',
        'sub-after:/downstream',
      ]);
      expect(ctx.path).toBe('/api/downstream');
    });

    it('cleans up Symbol keys from ctx.state in finally', async () => {
      const ORIGINAL_PATH = Symbol.for('nextrush.originalPath');
      const ROUTE_PREFIX = Symbol.for('nextrush.routePrefix');
      let capturedOriginal: unknown;
      let capturedPrefix: unknown;

      const router: Routable = {
        routes() {
          return async (ctx) => {
            capturedOriginal = (ctx.state as Record<symbol, unknown>)[ORIGINAL_PATH];
            capturedPrefix = (ctx.state as Record<symbol, unknown>)[ROUTE_PREFIX];
            ctx.json({ done: true });
          };
        },
      };

      app.route(['/api', '/v1'], router);

      const handler = app.callback();
      const ctx = createMockContext({ path: '/v1/test' });

      await handler(ctx);

      expect(capturedOriginal).toBe('/v1/test');
      expect(capturedPrefix).toBe('/v1');

      expect((ctx.state as Record<symbol, unknown>)[ORIGINAL_PATH]).toBeUndefined();
      expect((ctx.state as Record<symbol, unknown>)[ROUTE_PREFIX]).toBeUndefined();
    });
  });

  describe('Feature 6: Segment boundary isolation', () => {
    it('does not match prefix substring on segment boundary collision (/api vs /apigateway)', async () => {
      const router = createMockRouter();
      router.addRoute('/', async (ctx) => {
        ctx.json({ matched: true });
      });

      let fallbackReached = false;
      app.route(['/api', '/v1'], router);
      app.use(async (ctx) => {
        fallbackReached = true;
        ctx.status = 404;
      });

      const handler = app.callback();

      const ctxCollision = createMockContext({ path: '/apigateway' });
      await handler(ctxCollision);

      expect(ctxCollision.json).not.toHaveBeenCalled();
      expect(fallbackReached).toBe(true);
      expect(ctxCollision.status).toBe(404);
    });

    it('does not match /api-docs when prefix is /api', async () => {
      const router = createMockRouter();
      router.addRoute('/docs', async (ctx) => ctx.json({ ok: true }));

      let fallbackReached = false;
      app.route(['/api'], router);
      app.use(async (ctx) => {
        fallbackReached = true;
        ctx.status = 404;
      });

      const handler = app.callback();
      const ctx = createMockContext({ path: '/api-docs' });
      await handler(ctx);

      expect(ctx.json).not.toHaveBeenCalled();
      expect(fallbackReached).toBe(true);
    });
  });

  describe('Feature 7: Freeze assertions', () => {
    it('throws error if route() is called after app is ready', async () => {
      const router = createMockRouter();
      await app.ready();

      expect(() => {
        app.route(['/api', '/v1'], router);
      }).toThrow(/Cannot call route\(\) after the app has booted/);
    });
  });
});

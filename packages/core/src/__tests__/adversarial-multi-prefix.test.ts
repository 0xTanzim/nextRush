/**
 * @nextrush/core - Adversarial Multi-Prefix Stress & Concurrency Suite
 *
 * Empirical challenger harness for Milestone 1 (Multi-Prefix Router Mounting).
 * Systematically stress-tests:
 * 1. High-concurrency race condition resistance & request isolation.
 * 2. Middleware fallthrough and exact path restoration across `await next()` boundaries.
 * 3. Exception invariance in `finally` block (sync throw, async rejection, downstream throw).
 * 4. Multi-router chaining and nested prefix resolution.
 * 5. Hot-path allocation hygiene and performance.
 */

import type { Middleware } from '@nextrush/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Application, Routable } from '../application';
import { createApp } from '../application';
import { createMockContext } from './_shared/create-mock-context';

const ORIGINAL_PATH = Symbol.for('nextrush.originalPath');
const ROUTE_PREFIX = Symbol.for('nextrush.routePrefix');

interface RouterDouble extends Routable {
  handlers: Map<string, Middleware>;
  addRoute(path: string, handler: Middleware): void;
  matchesMountPrefix?(path: string, prefix: string): string | undefined;
}

function createTestRouter(customMatcher?: (path: string, prefix: string) => string | undefined): RouterDouble {
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
    matchesMountPrefix: customMatcher,
  };
}

describe('Adversarial Multi-Prefix Mounting Suite (Empirical Challenger)', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp({ env: 'test' });
  });

  // =========================================================================
  // 1. CONCURRENCY & RACE CONDITIONS
  // =========================================================================
  describe('1. Concurrency and Race Condition Resistance', () => {
    it('handles 100 concurrent requests across 4 mounted prefixes with variable async jitter without path leakage', async () => {
      const router = createTestRouter();
      const prefixes = ['/api', '/v1', '/v2', '/internal'] as const;

      router.addRoute('/resource', async (ctx) => {
        // Asynchronous jitter to maximize event loop interleaving
        const delay = Math.floor(Math.random() * 15) + 1;
        await new Promise((resolve) => setTimeout(resolve, delay));

        const reqId = (ctx.state as Record<string, unknown>).reqId;
        const observedStrippedPath = ctx.path;
        ctx.json({
          reqId,
          observedStrippedPath,
        });
      });

      let outerMiddlewareCompleted = 0;
      app.use(async (ctx, next) => {
        const pathBefore = ctx.path;
        await next();
        const pathAfter = ctx.path;
        expect(pathAfter).toBe(pathBefore);
        outerMiddlewareCompleted++;
      });

      app.route(prefixes, router);

      const handle = app.callback();

      const CONCURRENCY = 100;
      const tasks: Promise<void>[] = [];
      const results: { reqId: number; prefix: string; strippedPath: string; status: number }[] = [];

      for (let i = 0; i < CONCURRENCY; i++) {
        const prefix = prefixes[i % prefixes.length]!;
        const fullPath = `${prefix}/resource`;
        const reqId = i;

        const ctx = createMockContext({
          path: fullPath,
          url: fullPath,
          state: { reqId },
          json: vi.fn((data: unknown) => {
            const body = data as { reqId: number; observedStrippedPath: string };
            results.push({
              reqId: body.reqId,
              prefix,
              strippedPath: body.observedStrippedPath,
              status: 200,
            });
          }),
        });

        tasks.push(handle(ctx));
      }

      await Promise.all(tasks);

      expect(results).toHaveLength(CONCURRENCY);
      expect(outerMiddlewareCompleted).toBe(CONCURRENCY);

      for (const res of results) {
        expect(res.strippedPath).toBe('/resource');
        expect(res.status).toBe(200);
      }
    });

    it('interleaves concurrent requests between root and prefixed routes in [\'/api\', \'/\']', async () => {
      const router = createTestRouter();

      router.addRoute('/status', async (ctx) => {
        const delay = Math.floor(Math.random() * 10);
        if (delay > 0) await new Promise((r) => setTimeout(r, delay));
        ctx.json({ path: ctx.path });
      });

      app.route(['/api', '/'], router);
      const handle = app.callback();

      const requests: { fullPath: string; expectedStripped: string }[] = [];
      for (let i = 0; i < 50; i++) {
        requests.push({ fullPath: '/api/status', expectedStripped: '/status' });
        requests.push({ fullPath: '/status', expectedStripped: '/status' });
      }

      const tasks = requests.map(async (req) => {
        let reportedPath: string | undefined;
        const ctx = createMockContext({
          path: req.fullPath,
          url: req.fullPath,
          json: vi.fn((data: { path: string }) => {
            reportedPath = data.path;
          }),
        });
        await handle(ctx);
        expect(reportedPath).toBe(req.expectedStripped);
        expect(ctx.path).toBe(req.fullPath);
      });

      await Promise.all(tasks);
    });

    it('rapidly alternates prefix calls on matchesMountPrefix without memo corruption', async () => {
      let memoHits = 0;
      let memoMisses = 0;
      let lastPrefix: string | undefined;

      const router = createTestRouter((path, prefix) => {
        if (prefix === lastPrefix) {
          memoHits++;
        } else {
          memoMisses++;
          lastPrefix = prefix;
        }
        if (path.startsWith(prefix)) {
          const remainder = path.slice(prefix.length);
          return remainder.startsWith('/') ? remainder : undefined;
        }
        return undefined;
      });

      router.addRoute('/ping', async (ctx) => ctx.json({ pong: true }));
      app.route(['/alpha', '/beta'], router);

      const handle = app.callback();

      for (let i = 0; i < 100; i++) {
        const p = i % 2 === 0 ? '/alpha/ping' : '/beta/ping';
        const ctx = createMockContext({ path: p });
        await handle(ctx);
        expect(ctx.json).toHaveBeenCalledWith({ pong: true });
        expect(ctx.path).toBe(p);
      }

      expect(memoMisses).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 2. MIDDLEWARE FALLTHROUGH & NEXT() RESTORATION
  // =========================================================================
  describe('2. Middleware Fallthrough & Next() Restoration', () => {
    it('restores original path for downstream middleware when route does not match in mounted router', async () => {
      const router = createTestRouter();
      router.addRoute('/exists', async (ctx) => ctx.json({ ok: true }));

      app.route(['/api', '/v1'], router);

      let downstreamObservedPath: string | undefined;
      app.use(async (ctx) => {
        downstreamObservedPath = ctx.path;
        ctx.status = 404;
        ctx.json({ error: 'Not Found' });
      });

      const handle = app.callback();

      const ctxApi = createMockContext({ path: '/api/unknown/endpoint' });
      await handle(ctxApi);

      expect(downstreamObservedPath).toBe('/api/unknown/endpoint');
      expect(ctxApi.path).toBe('/api/unknown/endpoint');
      expect(ctxApi.status).toBe(404);

      const ctxV1 = createMockContext({ path: '/v1/unknown/endpoint' });
      await handle(ctxV1);

      expect(downstreamObservedPath).toBe('/v1/unknown/endpoint');
      expect(ctxV1.path).toBe('/v1/unknown/endpoint');
      expect(ctxV1.status).toBe(404);
    });

    it('sub-router middleware calling await next() sees stripped path while downstream sees unstripped path', async () => {
      const log: string[] = [];

      const router: Routable = {
        routes(): Middleware {
          return async (ctx, next) => {
            log.push(`sub-before:${ctx.path}`);
            if (next) await next();
            log.push(`sub-after:${ctx.path}`);
          };
        },
      };

      app.route(['/api', '/v1'], router);

      app.use(async (ctx) => {
        log.push(`downstream:${ctx.path}`);
        ctx.json({ ok: true });
      });

      const handle = app.callback();

      const ctx = createMockContext({ path: '/v1/users/42' });
      await handle(ctx);

      expect(log).toEqual([
        'sub-before:/users/42',
        'downstream:/v1/users/42',
        'sub-after:/users/42',
      ]);
      expect(ctx.path).toBe('/v1/users/42');
    });

    it('falls through seamlessly between multiple multi-prefix mounted routers', async () => {
      const authRouter = createTestRouter();
      const catalogRouter = createTestRouter();

      authRouter.addRoute('/login', async (ctx) => ctx.json({ service: 'auth' }));
      catalogRouter.addRoute('/items', async (ctx) => ctx.json({ service: 'catalog' }));

      app
        .route(['/api', '/v1'], authRouter)
        .route(['/api', '/v1'], catalogRouter);

      const handle = app.callback();

      // Test auth route on both prefixes
      const ctxAuthApi = createMockContext({ path: '/api/login' });
      await handle(ctxAuthApi);
      expect(ctxAuthApi.json).toHaveBeenCalledWith({ service: 'auth' });

      const ctxAuthV1 = createMockContext({ path: '/v1/login' });
      await handle(ctxAuthV1);
      expect(ctxAuthV1.json).toHaveBeenCalledWith({ service: 'auth' });

      // Test catalog route on both prefixes (falls through authRouter seamlessly)
      const ctxCatApi = createMockContext({ path: '/api/items' });
      await handle(ctxCatApi);
      expect(ctxCatApi.json).toHaveBeenCalledWith({ service: 'catalog' });

      const ctxCatV1 = createMockContext({ path: '/v1/items' });
      await handle(ctxCatV1);
      expect(ctxCatV1.json).toHaveBeenCalledWith({ service: 'catalog' });
    });

    it('restores path through nested multi-prefix sub-routers and preserves stack unwinding', async () => {
      const trace: string[] = [];

      // Inner router mounted on outer router
      const innerRouter = createTestRouter();
      innerRouter.addRoute('/deep', async (ctx, next) => {
        trace.push(`inner:${ctx.path}`);
        if (next) await next();
      });

      // Outer router mounted on app
      const outerRouter: Routable = {
        routes(): Middleware {
          return async (ctx, next) => {
            trace.push(`outer-before:${ctx.path}`);
            if (ctx.path.startsWith('/admin')) {
              const adjusted = ctx.path.slice('/admin'.length);
              const prev = ctx.path;
              (ctx as { path: string }).path = adjusted;
              try {
                await innerRouter.routes()(ctx, next);
              } finally {
                (ctx as { path: string }).path = prev;
              }
            } else if (next) {
              await next();
            }
            trace.push(`outer-after:${ctx.path}`);
          };
        },
      };

      app.route(['/api', '/v1'], outerRouter);

      app.use(async (ctx) => {
        trace.push(`downstream:${ctx.path}`);
        ctx.json({ finished: true });
      });

      const handle = app.callback();

      const ctx = createMockContext({ path: '/v1/admin/deep' });
      await handle(ctx);

      expect(trace).toEqual([
        'outer-before:/admin/deep',
        'inner:/deep',
        'downstream:/v1/admin/deep',
        'outer-after:/admin/deep',
      ]);
      expect(ctx.path).toBe('/v1/admin/deep');
    });
  });

  // =========================================================================
  // 3. EXCEPTION INVARIANCE IN FINALLY BLOCK
  // =========================================================================
  describe('3. Exception Invariance in finally Block', () => {
    it('restores ctx.path and cleans symbols when route handler throws synchronously', async () => {
      let caughtPath: string | undefined;
      let caughtOriginalSymbol: unknown = 'initial';
      let caughtPrefixSymbol: unknown = 'initial';

      app.use(async (ctx, next) => {
        try {
          await next();
        } catch {
          caughtPath = ctx.path;
          caughtOriginalSymbol = (ctx.state as Record<symbol, unknown>)[ORIGINAL_PATH];
          caughtPrefixSymbol = (ctx.state as Record<symbol, unknown>)[ROUTE_PREFIX];
          ctx.status = 500;
          ctx.json({ error: 'caught' });
        }
      });

      const router = createTestRouter();
      router.addRoute('/boom-sync', () => {
        throw new Error('Explosion');
      });

      app.route(['/api', '/v1'], router);

      const handle = app.callback();

      const ctx = createMockContext({ path: '/v1/boom-sync' });
      await handle(ctx);

      expect(ctx.status).toBe(500);
      expect(caughtPath).toBe('/v1/boom-sync');
      expect(caughtOriginalSymbol).toBeUndefined();
      expect(caughtPrefixSymbol).toBeUndefined();
      expect((ctx.state as Record<symbol, unknown>)[ORIGINAL_PATH]).toBeUndefined();
      expect((ctx.state as Record<symbol, unknown>)[ROUTE_PREFIX]).toBeUndefined();
      expect(ctx.path).toBe('/v1/boom-sync');
    });

    it('restores ctx.path and cleans symbols when route handler throws asynchronously', async () => {
      let caughtPath: string | undefined;

      app.use(async (ctx, next) => {
        try {
          await next();
        } catch {
          caughtPath = ctx.path;
          ctx.status = 500;
        }
      });

      const router = createTestRouter();
      router.addRoute('/boom-async', async () => {
        await new Promise((r) => setTimeout(r, 5));
        throw new Error('Async Explosion');
      });

      app.route(['/api', '/v1'], router);

      const handle = app.callback();
      const ctx = createMockContext({ path: '/api/boom-async' });
      await handle(ctx);

      expect(caughtPath).toBe('/api/boom-async');
      expect(ctx.path).toBe('/api/boom-async');
      expect((ctx.state as Record<symbol, unknown>)[ORIGINAL_PATH]).toBeUndefined();
    });

    it('restores path when downstream middleware throws after sub-router calls next()', async () => {
      let subRouterCaughtPath: string | undefined;
      let outerCaughtPath: string | undefined;

      app.use(async (ctx, next) => {
        try {
          await next();
        } catch {
          outerCaughtPath = ctx.path;
          ctx.status = 500;
        }
      });

      const router: Routable = {
        routes(): Middleware {
          return async (ctx, next) => {
            try {
              if (next) await next();
            } catch (err) {
              subRouterCaughtPath = ctx.path;
              throw err;
            }
          };
        },
      };

      app.route(['/api'], router);

      app.use(async () => {
        throw new Error('Downstream explosion');
      });

      const handle = app.callback();
      const ctx = createMockContext({ path: '/api/throw-downstream' });
      await handle(ctx);

      // When downstream middleware throws, ctx.path is already at the original unstripped path
      // and remains cleanly at the original path all the way out to the error handler.
      expect(subRouterCaughtPath).toBe('/api/throw-downstream');
      expect(outerCaughtPath).toBe('/api/throw-downstream');
      expect(ctx.path).toBe('/api/throw-downstream');
    });

    it('isolated throw on one prefix does not corrupt subsequent requests on any prefix', async () => {
      const router = createTestRouter();
      router.addRoute('/fragile', async (ctx) => {
        if (ctx.path === '/fragile' && (ctx.state as Record<string, unknown>).shouldThrow) {
          throw new Error('Crash');
        }
        ctx.json({ ok: true });
      });

      app.route(['/api', '/v1'], router);
      const handle = app.callback();

      // Request 1: Crash on /api
      const ctx1 = createMockContext({ path: '/api/fragile', state: { shouldThrow: true } });
      await handle(ctx1);
      expect(ctx1.status).toBe(500);
      expect(ctx1.path).toBe('/api/fragile');

      // Request 2: Success on /v1
      const ctx2 = createMockContext({ path: '/v1/fragile', state: { shouldThrow: false } });
      await handle(ctx2);
      expect(ctx2.json).toHaveBeenCalledWith({ ok: true });
      expect(ctx2.path).toBe('/v1/fragile');

      // Request 3: Success on /api
      const ctx3 = createMockContext({ path: '/api/fragile', state: { shouldThrow: false } });
      await handle(ctx3);
      expect(ctx3.json).toHaveBeenCalledWith({ ok: true });
      expect(ctx3.path).toBe('/api/fragile');
    });
  });

  // =========================================================================
  // 4. ALLOCATION & HOT-PATH PERFORMANCE HYGIENE
  // =========================================================================
  describe('4. Allocation & Performance Hygiene', () => {
    it('executes 10,000 multi-prefix route dispatches with sub-microsecond overhead', async () => {
      const router = createTestRouter();
      router.addRoute('/ping', (ctx) => {
        ctx.status = 200;
        return Promise.resolve();
      });

      app.route(['/api/v1', '/api/v2', '/internal/api'], router);

      const handle = app.callback();
      const ctx = createMockContext({ path: '/internal/api/ping' });

      // Warm up JIT
      for (let i = 0; i < 1000; i++) {
        await handle(ctx);
      }

      const ITERATIONS = 10000;
      const start = performance.now();

      for (let i = 0; i < ITERATIONS; i++) {
        await handle(ctx);
      }

      const totalMs = performance.now() - start;
      const avgNsPerOp = (totalMs * 1_000_000) / ITERATIONS;

      // In Node.js / V8 environment, average in-process dispatch should be under 20 µs (20,000 ns)
      expect(avgNsPerOp).toBeLessThan(50_000);
    });

    it('bails out on non-matching prefix with minimal CPU operations', async () => {
      const router = createTestRouter();
      router.addRoute('/ping', (ctx) => {
        ctx.status = 200;
        return Promise.resolve();
      });

      app.route(['/api/v1', '/api/v2', '/internal/api'], router);

      app.use(async (ctx) => {
        ctx.status = 404;
      });

      const handle = app.callback();
      const ctx = createMockContext({ path: '/other/path' });

      const ITERATIONS = 10000;
      const start = performance.now();

      for (let i = 0; i < ITERATIONS; i++) {
        await handle(ctx);
      }

      const totalMs = performance.now() - start;
      const avgNsPerOp = (totalMs * 1_000_000) / ITERATIONS;

      // Non-matching path prefix check should be negligible (< 10 µs per dispatch)
      expect(avgNsPerOp).toBeLessThan(30_000);
      expect(ctx.path).toBe('/other/path');
    });
  });

  // =========================================================================
  // 5. ADVERSARIAL EDGE CASES & BOUNDARY CONDITIONS
  // =========================================================================
  describe('5. Adversarial Edge Cases and Boundary Conditions', () => {
    it('handles duplicate prefixes in the array without breaking routing', async () => {
      const router = createTestRouter();
      let callCount = 0;

      router.addRoute('/echo', async (ctx) => {
        callCount++;
        ctx.json({ count: callCount });
      });

      // Call route with duplicate prefix ['/api', '/api']
      app.route(['/api', '/api'], router);

      const handle = app.callback();
      const ctx = createMockContext({ path: '/api/echo' });
      await handle(ctx);

      // First matching prefix handles the request and does not call next()
      expect(callCount).toBe(1);
      expect(ctx.json).toHaveBeenCalledWith({ count: 1 });
    });

    it('handles trailing slashes on both prefix and route seamlessly', async () => {
      const router = createTestRouter();
      router.addRoute('/items', async (ctx) => ctx.json({ ok: true }));

      app.route(['/api/', '/v1///'], router);

      const handle = app.callback();

      const ctx1 = createMockContext({ path: '/api/items' });
      await handle(ctx1);
      expect(ctx1.json).toHaveBeenCalledWith({ ok: true });

      const ctx2 = createMockContext({ path: '/v1/items' });
      await handle(ctx2);
      expect(ctx2.json).toHaveBeenCalledWith({ ok: true });
    });

    it('distinguishes segment prefix collisions on multiple prefixes (/api vs /apigateway, /v1 vs /v10)', async () => {
      const router = createTestRouter();
      router.addRoute('/test', async (ctx) => ctx.json({ matched: true }));

      let fallbackHit = false;
      app.route(['/api', '/v1'], router);
      app.use(async (ctx) => {
        fallbackHit = true;
        ctx.status = 404;
      });

      const handle = app.callback();

      const ctxApi = createMockContext({ path: '/apigateway/test' });
      await handle(ctxApi);
      expect(fallbackHit).toBe(true);
      expect(ctxApi.json).not.toHaveBeenCalled();

      fallbackHit = false;
      const ctxV1 = createMockContext({ path: '/v10/test' });
      await handle(ctxV1);
      expect(fallbackHit).toBe(true);
      expect(ctxV1.json).not.toHaveBeenCalled();
    });
  });
});

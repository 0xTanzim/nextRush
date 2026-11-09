/**
 * @nextrush/core - Adversarial Multi-Prefix Router Mounting Stress Tests
 *
 * Empirical challenger tests verifying:
 * 1. Combinatorial Prefix Fuzzing (10, 50, 100 prefixes mounted simultaneously)
 * 2. Deep Path & Sibling Prefix Collisions (['/api/v1', '/api/v2', '/api'])
 * 3. Prefix Normalization Edge Cases (['api//', '//api///', '///', '/api//v1/'])
 * 4. Error Injection & Mutation Atomicity ([], [null], [123], [''])
 * 5. High-Concurrency & Asynchronous State Isolation
 */

import type { Middleware } from '@nextrush/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Application, Routable } from '../application';
import { createApp } from '../application';
import { createMockContext } from './_shared/create-mock-context';

function createMockRouter(hasMatchesMountPrefix = false): Routable & {
  handlers: Map<string, Middleware>;
  addRoute: (path: string, handler: Middleware) => void;
  matchesMountPrefix?: (path: string, prefix: string) => string | undefined;
} {
  const handlers = new Map<string, Middleware>();

  const router: Routable & {
    handlers: Map<string, Middleware>;
    addRoute: (path: string, handler: Middleware) => void;
    matchesMountPrefix?: (path: string, prefix: string) => string | undefined;
  } = {
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

  if (hasMatchesMountPrefix) {
    router.matchesMountPrefix = (path: string, prefix: string) => {
      // Basic normalizer matching the router specification
      const normPrefix = prefix.replace(/\/+/g, '/').replace(/\/+$/, '') || '/';
      const normPath = path.replace(/\/+/g, '/');
      if (normPrefix === '/') return normPath;
      if (!normPath.startsWith(normPrefix)) return undefined;
      const len = normPrefix.length;
      if (len < normPath.length && normPath.charCodeAt(len) !== 0x2f) return undefined;
      return normPath.slice(len) || '/';
    };
  }

  return router;
}

describe('Empirical Challenger: Multi-Prefix Stress & Boundary Verification', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp();
  });

  describe('Dimension 1: Combinatorial Prefix Fuzzing (10, 50, 100 prefixes)', () => {
    it('mounts and dispatches across 10 distinct prefixes simultaneously', async () => {
      const router = createMockRouter();
      router.addRoute('/ping', async (ctx) => {
        ctx.json({ ok: true, path: ctx.path });
      });

      const prefixes = Array.from({ length: 10 }, (_, i) => `/prefix-ten-${i}`);
      app.route(prefixes, router);

      const handler = app.callback();

      for (let i = 0; i < 10; i++) {
        const ctx = createMockContext({ path: `/prefix-ten-${i}/ping` });
        await handler(ctx);
        expect(ctx.json).toHaveBeenCalledWith({ ok: true, path: '/ping' });
      }

      // Negative check: unmounted prefix
      const unmountedCtx = createMockContext({ path: '/prefix-ten-10/ping' });
      await handler(unmountedCtx);
      expect(unmountedCtx.json).not.toHaveBeenCalled();
    });

    it('mounts and dispatches across 50 distinct prefixes simultaneously', async () => {
      const router = createMockRouter();
      router.addRoute('/resource', async (ctx) => {
        ctx.json({ status: 'healthy', path: ctx.path });
      });

      const prefixes = Array.from({ length: 50 }, (_, i) => `/service-fifty-${i}/v1`);
      app.route(prefixes, router);

      const handler = app.callback();

      for (let i = 0; i < 50; i++) {
        const ctx = createMockContext({ path: `/service-fifty-${i}/v1/resource` });
        await handler(ctx);
        expect(ctx.json).toHaveBeenCalledWith({ status: 'healthy', path: '/resource' });
      }

      // Negative check
      const unmountedCtx = createMockContext({ path: '/service-fifty-50/v1/resource' });
      await handler(unmountedCtx);
      expect(unmountedCtx.json).not.toHaveBeenCalled();
    });

    it('mounts and dispatches across 100 distinct prefixes simultaneously with state isolation', async () => {
      const router = createMockRouter();
      router.addRoute('/data', async (ctx) => {
        ctx.json({ index: ctx.path, stateOriginal: ctx.state[Symbol.for('nextrush.originalPath')] });
      });

      const prefixes = Array.from({ length: 100 }, (_, i) => `/cluster-${i}/api`);
      app.route(prefixes, router);

      const handler = app.callback();

      // Test all 100 prefixes
      for (let i = 0; i < 100; i++) {
        const fullPath = `/cluster-${i}/api/data`;
        const ctx = createMockContext({ path: fullPath });
        await handler(ctx);
        expect(ctx.json).toHaveBeenCalledWith({
          index: '/data',
          stateOriginal: fullPath,
        });
        // Original path must be restored in ctx after handler completes
        expect(ctx.path).toBe(fullPath);
      }

      // Downstream execution check when none of the 100 prefixes match
      let downstreamHit = false;
      app.use(async (ctx) => {
        downstreamHit = true;
        ctx.json({ downstream: true });
      });

      const callback = app.callback();
      const nonMatchingCtx = createMockContext({ path: '/unmatched/route' });
      await callback(nonMatchingCtx);
      expect(downstreamHit).toBe(true);
      expect(nonMatchingCtx.path).toBe('/unmatched/route');
    });
  });

  describe('Dimension 2: Deep Path & Sibling Prefix Collisions', () => {
    it('correctly dispatches with sibling and nested prefixes: ["/api/v1", "/api/v2", "/api"]', async () => {
      const subRouter = createMockRouter();
      subRouter.addRoute('/users', async (ctx) => {
        ctx.json({ scope: 'users', path: ctx.path });
      });

      app.route(['/api/v1', '/api/v2', '/api'], subRouter);

      const handler = app.callback();

      // Test /api/v1/users
      const ctxV1 = createMockContext({ path: '/api/v1/users' });
      await handler(ctxV1);
      expect(ctxV1.json).toHaveBeenCalledWith({ scope: 'users', path: '/users' });
      expect(ctxV1.path).toBe('/api/v1/users');

      // Test /api/v2/users
      const ctxV2 = createMockContext({ path: '/api/v2/users' });
      await handler(ctxV2);
      expect(ctxV2.json).toHaveBeenCalledWith({ scope: 'users', path: '/users' });
      expect(ctxV2.path).toBe('/api/v2/users');

      // Test /api/users
      const ctxApi = createMockContext({ path: '/api/users' });
      await handler(ctxApi);
      expect(ctxApi.json).toHaveBeenCalledWith({ scope: 'users', path: '/users' });
      expect(ctxApi.path).toBe('/api/users');
    });

    it('handles inverted prefix order ["/api", "/api/v1", "/api/v2"] correctly when subrouter only has /users', async () => {
      const subRouter = createMockRouter();
      subRouter.addRoute('/users', async (ctx) => {
        ctx.json({ matched: true, path: ctx.path });
      });

      // Shorter prefix first
      app.route(['/api', '/api/v1', '/api/v2'], subRouter);

      const handler = app.callback();

      // /api/v1/users: Mount 1 (/api) strips to /v1/users. Subrouter doesn't have /v1/users, calls next().
      // Mount 1 restores path to /api/v1/users. Mount 2 (/api/v1) matches, strips to /users, succeeds!
      const ctxV1 = createMockContext({ path: '/api/v1/users' });
      await handler(ctxV1);
      expect(ctxV1.json).toHaveBeenCalledWith({ matched: true, path: '/users' });
      expect(ctxV1.path).toBe('/api/v1/users');
    });

    it('isolates different routers mounted at colliding prefixes', async () => {
      const routerA = createMockRouter();
      routerA.addRoute('/endpoint', async (ctx) => ctx.json({ router: 'A' }));

      const routerB = createMockRouter();
      routerB.addRoute('/endpoint', async (ctx) => ctx.json({ router: 'B' }));

      app
        .route(['/api', '/v1'], routerA)
        .route(['/api/v1', '/v2'], routerB);

      const handler = app.callback();

      // /api/endpoint -> Router A
      const ctxA = createMockContext({ path: '/api/endpoint' });
      await handler(ctxA);
      expect(ctxA.json).toHaveBeenCalledWith({ router: 'A' });

      // /api/v1/endpoint -> Router B (Router A gets /v1/endpoint which doesn't match, calls next())
      const ctxB = createMockContext({ path: '/api/v1/endpoint' });
      await handler(ctxB);
      expect(ctxB.json).toHaveBeenCalledWith({ router: 'B' });
    });
  });

  describe('Dimension 3: Prefix Normalization Edge Cases', () => {
    it('normalizes "api//" correctly', async () => {
      const router = createMockRouter();
      router.addRoute('/test', async (ctx) => ctx.json({ ok: true }));

      app.route(['api//'], router);

      const handler = app.callback();
      const ctx = createMockContext({ path: '/api/test' });
      await handler(ctx);
      expect(ctx.json).toHaveBeenCalledWith({ ok: true });
    });

    it('normalizes "///" correctly as root mount', async () => {
      const router = createMockRouter();
      router.addRoute('/health', async (ctx) => ctx.json({ health: 'ok' }));

      app.route(['///'], router);

      const handler = app.callback();
      const ctx = createMockContext({ path: '/health' });
      await handler(ctx);
      expect(ctx.json).toHaveBeenCalledWith({ health: 'ok' });
    });

    it('investigates behavior of "//api///"', async () => {
      // Test with router implementing matchesMountPrefix
      const routerWithPrefix = createMockRouter(true);
      routerWithPrefix.addRoute('/ping', async (ctx) => ctx.json({ pong: true }));

      const testApp = createApp();
      testApp.route(['//api///'], routerWithPrefix);

      const handler = testApp.callback();
      const ctx = createMockContext({ path: '/api/ping' });
      await handler(ctx);
      expect(ctx.json).toHaveBeenCalledWith({ pong: true });
    });

    it('normalizes "//api///" on default fallback Routable', async () => {
      // Test with plain Routable without matchesMountPrefix
      const plainRouter = createMockRouter(false);
      plainRouter.addRoute('/ping', async (ctx) => ctx.json({ pong: true }));

      const testApp = createApp();
      testApp.route(['//api///'], plainRouter);

      const handler = testApp.callback();
      const ctx = createMockContext({ path: '/api/ping' });
      await handler(ctx);
      expect(ctx.json).toHaveBeenCalledWith({ pong: true });
    });

    it('normalizes internal double slashes "/api//v1" on default fallback Routable', async () => {
      const plainRouter = createMockRouter(false);
      plainRouter.addRoute('/ping', async (ctx) => ctx.json({ pong: true }));

      const testApp = createApp();
      testApp.route(['/api//v1'], plainRouter);

      const handler = testApp.callback();
      const ctx = createMockContext({ path: '/api/v1/ping' });
      await handler(ctx);
      expect(ctx.json).toHaveBeenCalledWith({ pong: true });
    });
  });

  describe('Dimension 4: Error Injection & Atomicity', () => {
    it('throws synchronous Error on empty array []', () => {
      const router = createMockRouter();
      expect(() => {
        app.route([], router);
      }).toThrow('app.route() requires at least one path prefix when an array is provided');
    });

    it('throws synchronous TypeError on [null]', () => {
      const router = createMockRouter();
      expect(() => {
        app.route([null as unknown as string], router);
      }).toThrow(new TypeError('Route path prefix must be a string, received null'));
    });

    it('throws synchronous TypeError on [123]', () => {
      const router = createMockRouter();
      expect(() => {
        app.route([123 as unknown as string], router);
      }).toThrow(new TypeError('Route path prefix must be a string, received number'));
    });

    it('throws synchronous TypeError on [""]', () => {
      const router = createMockRouter();
      expect(() => {
        app.route([''], router);
      }).toThrow(new TypeError('Route path prefix must be a non-empty string'));
    });

    it('atomicity check: does not mount earlier valid prefixes if a later prefix is invalid', async () => {
      const router = createMockRouter();
      router.addRoute('/users', async (ctx) => ctx.json({ ok: true }));

      expect(() => {
        app.route(['/valid1', '/valid2', null as unknown as string], router);
      }).toThrow();

      const handler = app.callback();

      // /valid1/users must NOT have been mounted!
      const ctx1 = createMockContext({ path: '/valid1/users' });
      await handler(ctx1);
      expect(ctx1.json).not.toHaveBeenCalled();

      // /valid2/users must NOT have been mounted!
      const ctx2 = createMockContext({ path: '/valid2/users' });
      await handler(ctx2);
      expect(ctx2.json).not.toHaveBeenCalled();
    });

    it('atomicity check: does not mount earlier valid prefixes if router is invalid', () => {
      expect(() => {
        app.route(['/valid1', '/valid2'], null as unknown as Routable);
      }).toThrow(new TypeError('app.route() requires a router with a routes() method'));
    });
  });

  describe('Dimension 5: Concurrency & Asynchronous State Isolation', () => {
    it('maintains strict state isolation under 50 concurrent requests across different prefixes', async () => {
      const router = createMockRouter();
      router.addRoute('/delay', async (ctx) => {
        const initialPath = ctx.path;
        // Simulate async I/O
        await new Promise((resolve) => setTimeout(resolve, 5));
        ctx.json({ path: initialPath, finalPath: ctx.path });
      });

      const prefixes = Array.from({ length: 10 }, (_, i) => `/tenant-${i}`);
      app.route(prefixes, router);

      const handler = app.callback();

      // Launch 50 concurrent requests across different prefixes
      const requests = Array.from({ length: 50 }, async (_, reqId) => {
        const tenantId = reqId % 10;
        const fullPath = `/tenant-${tenantId}/delay`;
        const ctx = createMockContext({ path: fullPath });
        await handler(ctx);
        expect(ctx.json).toHaveBeenCalledWith({
          path: '/delay',
          finalPath: '/delay',
        });
        expect(ctx.path).toBe(fullPath);
      });

      await Promise.all(requests);
    });
  });

  describe('Dimension 6: Challenger Adversarial Matrix (Iteration 2)', () => {
    describe('6.1 Extreme Slash Variations', () => {
      it('mounts and dispatches ["///", "////api////", "/api//v1///v2/"] with router implementing matchesMountPrefix', async () => {
        const router = createMockRouter(true);
        router.addRoute('/ping', async (ctx) => ctx.json({ matched: true, path: ctx.path }));

        app.route(['///', '////api////', '/api//v1///v2/'], router);
        const handler = app.callback();

        // 1. Root mount via '///'
        const ctxRoot = createMockContext({ path: '/ping' });
        await handler(ctxRoot);
        expect(ctxRoot.json).toHaveBeenCalledWith({ matched: true, path: '/ping' });

        // 2. '/api' mount via '////api////'
        const ctxApi = createMockContext({ path: '/api/ping' });
        await handler(ctxApi);
        expect(ctxApi.json).toHaveBeenCalledWith({ matched: true, path: '/ping' });

        // 3. '/api/v1/v2' mount via '/api//v1///v2/'
        const ctxDeep = createMockContext({ path: '/api/v1/v2/ping' });
        await handler(ctxDeep);
        expect(ctxDeep.json).toHaveBeenCalledWith({ matched: true, path: '/ping' });

        // Negative segment boundary checks
        const ctxNeg1 = createMockContext({ path: '/apigateway/ping' });
        await handler(ctxNeg1);
        expect(ctxNeg1.json).not.toHaveBeenCalled();

        const ctxNeg2 = createMockContext({ path: '/api/v1/ping' });
        await handler(ctxNeg2);
        expect(ctxNeg2.json).not.toHaveBeenCalled();
      });

      it('mounts and dispatches ["///", "////api////", "/api//v1///v2/"] with fallback Routable (no matchesMountPrefix)', async () => {
        const fallbackRouter = createMockRouter(false);
        fallbackRouter.addRoute('/ping', async (ctx) => ctx.json({ fallback: true, path: ctx.path }));

        app.route(['///', '////api////', '/api//v1///v2/'], fallbackRouter);
        const handler = app.callback();

        // Root mount
        const ctxRoot = createMockContext({ path: '/ping' });
        await handler(ctxRoot);
        expect(ctxRoot.json).toHaveBeenCalledWith({ fallback: true, path: '/ping' });

        // /api mount
        const ctxApi = createMockContext({ path: '/api/ping' });
        await handler(ctxApi);
        expect(ctxApi.json).toHaveBeenCalledWith({ fallback: true, path: '/ping' });

        // /api/v1/v2 mount
        const ctxDeep = createMockContext({ path: '/api/v1/v2/ping' });
        await handler(ctxDeep);
        expect(ctxDeep.json).toHaveBeenCalledWith({ fallback: true, path: '/ping' });

        // Segment isolation check on fallback router
        const ctxNeg = createMockContext({ path: '/apigateway/ping' });
        await handler(ctxNeg);
        expect(ctxNeg.json).not.toHaveBeenCalled();
      });
    });

    describe('6.2 Duplicate Prefixes in Array', () => {
      it('deduplicates ["/api", "/api", "api", "//api/"] and invokes handler exactly once', async () => {
        const callCount = vi.fn();
        const router = createMockRouter(false);
        router.addRoute('/ping', async (ctx) => {
          callCount();
          ctx.json({ ok: true });
        });

        // Record initial middleware stack length before mounting
        const initialCount = (app as unknown as { middlewareStack: unknown[] }).middlewareStack.length;

        app.route(['/api', '/api', 'api', '//api/'], router);

        // Deduplication must register exactly 1 prefix mount middleware, not 4
        const newCount = (app as unknown as { middlewareStack: unknown[] }).middlewareStack.length;
        expect(newCount - initialCount).toBe(1);

        const handler = app.callback();
        const ctx = createMockContext({ path: '/api/ping' });
        await handler(ctx);

        expect(callCount).toHaveBeenCalledTimes(1);
        expect(ctx.json).toHaveBeenCalledWith({ ok: true });
      });

      it('deduplicates multi-level duplicates ["/api/v1", "/api/v1/", "//api//v1", "api/v1//"] to single registration', async () => {
        const router = createMockRouter(false);
        router.addRoute('/test', async (ctx) => ctx.json({ ok: true }));

        const initialCount = (app as unknown as { middlewareStack: unknown[] }).middlewareStack.length;
        app.route(['/api/v1', '/api/v1/', '//api//v1', 'api/v1//'], router);
        const newCount = (app as unknown as { middlewareStack: unknown[] }).middlewareStack.length;

        expect(newCount - initialCount).toBe(1);

        const handler = app.callback();
        const ctx = createMockContext({ path: '/api/v1/test' });
        await handler(ctx);
        expect(ctx.json).toHaveBeenCalledWith({ ok: true });
      });

      it('deduplicates mixed root variations ["///", "/", "//"] to single root middleware', async () => {
        const router = createMockRouter(false);
        router.addRoute('/health', async (ctx) => ctx.json({ status: 'pass' }));

        const initialCount = (app as unknown as { middlewareStack: unknown[] }).middlewareStack.length;
        app.route(['///', '/', '//'], router);
        const newCount = (app as unknown as { middlewareStack: unknown[] }).middlewareStack.length;

        expect(newCount - initialCount).toBe(1);

        const handler = app.callback();
        const ctx = createMockContext({ path: '/health' });
        await handler(ctx);
        expect(ctx.json).toHaveBeenCalledWith({ status: 'pass' });
      });
    });

    describe('6.3 Empty Prefix Strings & Root Prefixes', () => {
      it('throws synchronous TypeError on [""] with atomic rollback', () => {
        const router = createMockRouter();
        expect(() => {
          app.route([''], router);
        }).toThrow(new TypeError('Route path prefix must be a non-empty string'));
      });

      it('throws synchronous TypeError on ["/api", ""] and mounts nothing', async () => {
        const router = createMockRouter();
        router.addRoute('/test', async (ctx) => ctx.json({ mounted: true }));

        expect(() => {
          app.route(['/api', ''], router);
        }).toThrow(new TypeError('Route path prefix must be a non-empty string'));

        // Verify /api/test was NOT mounted
        const handler = app.callback();
        const ctx = createMockContext({ path: '/api/test' });
        await handler(ctx);
        expect(ctx.json).not.toHaveBeenCalled();
      });

      it('mounts root prefix alongside sub-prefix: ["/api", "/"]', async () => {
        const router = createMockRouter(false);
        router.addRoute('/status', async (ctx) => ctx.json({ ok: true, path: ctx.path }));

        app.route(['/api', '/'], router);
        const handler = app.callback();

        // 1. Under /api
        const ctxApi = createMockContext({ path: '/api/status' });
        await handler(ctxApi);
        expect(ctxApi.json).toHaveBeenCalledWith({ ok: true, path: '/status' });

        // 2. Under root
        const ctxRoot = createMockContext({ path: '/status' });
        await handler(ctxRoot);
        expect(ctxRoot.json).toHaveBeenCalledWith({ ok: true, path: '/status' });
      });

      it('mounts root prefix alongside sub-prefix in reverse order: ["/", "/api"]', async () => {
        const router = createMockRouter(false);
        router.addRoute('/status', async (ctx) => ctx.json({ ok: true, path: ctx.path }));

        app.route(['/', '/api'], router);
        const handler = app.callback();

        // 1. Under root
        const ctxRoot = createMockContext({ path: '/status' });
        await handler(ctxRoot);
        expect(ctxRoot.json).toHaveBeenCalledWith({ ok: true, path: '/status' });

        // 2. Under /api
        const ctxApi = createMockContext({ path: '/api/status' });
        await handler(ctxApi);
        expect(ctxApi.json).toHaveBeenCalledWith({ ok: true, path: '/status' });
      });
    });

    describe('6.4 Mixed Routable Types', () => {
      it('mounts custom fallback Routable lacking matchesMountPrefix across multi-prefix', async () => {
        let seenPathInHandler = '';
        const fallbackRoutable: Routable = {
          routes() {
            return async (ctx, next) => {
              if (ctx.path === '/action') {
                seenPathInHandler = ctx.path;
                ctx.json({ handled: true });
              } else if (next) {
                await next();
              }
            };
          },
        };

        app.route(['/svc-1', '/svc-2', '///svc-3///'], fallbackRoutable);
        const handler = app.callback();

        for (const prefix of ['/svc-1', '/svc-2', '/svc-3']) {
          const reqPath = `${prefix}/action`;
          const ctx = createMockContext({ path: reqPath });
          await handler(ctx);
          expect(ctx.json).toHaveBeenCalledWith({ handled: true });
          expect(seenPathInHandler).toBe('/action');
          // Path restored after handler completes
          expect(ctx.path).toBe(reqPath);
        }

        // Boundary check: /svc-1beta/action must NOT match
        const negCtx = createMockContext({ path: '/svc-1beta/action' });
        await handler(negCtx);
        expect(negCtx.json).not.toHaveBeenCalled();
      });

      it('mounts Routable with custom matchesMountPrefix and respects custom prefix logic', async () => {
        const customPrefixSpy = vi.fn((path: string, prefix: string) => {
          if (path.startsWith(prefix)) {
            return path.slice(prefix.length) || '/';
          }
          return undefined;
        });

        const customRoutable: Routable = {
          matchesMountPrefix: customPrefixSpy,
          routes() {
            return async (ctx, next) => {
              if (ctx.path === '/inspect') {
                ctx.json({ custom: true });
              } else if (next) {
                await next();
              }
            };
          },
        };

        app.route(['/custom-a', '/custom-b'], customRoutable);
        const handler = app.callback();

        const ctx = createMockContext({ path: '/custom-a/inspect' });
        await handler(ctx);

        expect(customPrefixSpy).toHaveBeenCalledWith('/custom-a/inspect', '/custom-a');
        expect(ctx.json).toHaveBeenCalledWith({ custom: true });
      });

      it('rejects invalid Routable objects missing routes() method', () => {
        expect(() => {
          app.route(['/api'], {} as unknown as Routable);
        }).toThrow(new TypeError('app.route() requires a router with a routes() method'));

        expect(() => {
          app.route(['/api'], { routes: 'not-a-func' } as unknown as Routable);
        }).toThrow(new TypeError('app.route() requires a router with a routes() method'));
      });
    });

    describe('6.5 Order of Prefix Evaluation and Middleware Composition', () => {
      it('executes global upstream and downstream middleware in strict onion order', async () => {
        const order: string[] = [];

        app.use(async (_ctx, next) => {
          order.push('upstream:before');
          await next();
          order.push('upstream:after');
        });

        const router = createMockRouter();
        router.addRoute('/item', async (ctx) => {
          order.push('router:handler');
          ctx.json({ ok: true });
        });

        app.route(['/tier1', '/tier2'], router);

        app.use(async (_ctx, next) => {
          order.push('downstream');
          if (next) await next();
        });

        const handler = app.callback();

        // 1. Matched route: does NOT hit downstream middleware because handler does not call next()
        order.length = 0;
        const ctxMatch = createMockContext({ path: '/tier1/item' });
        await handler(ctxMatch);
        expect(order).toEqual(['upstream:before', 'router:handler', 'upstream:after']);

        // 2. Unmatched route: passes through upstream and reaches downstream
        order.length = 0;
        const ctxUnmatch = createMockContext({ path: '/tier1/unmatched' });
        await handler(ctxUnmatch);
        expect(order).toEqual(['upstream:before', 'downstream', 'upstream:after']);
      });

      it('restores ctx.path when sub-router calls next() and re-adjusts when downstream returns', async () => {
        let downstreamObservedPath = '';
        let postNextObservedPath = '';

        const router = createMockRouter();
        router.addRoute('/delegate', async (ctx, next) => {
          if (next) {
            await next();
          }
          postNextObservedPath = ctx.path;
        });

        app.route(['/v1', '/v2'], router);

        app.use(async (ctx, next) => {
          downstreamObservedPath = ctx.path;
          ctx.json({ forwarded: true });
          if (next) await next();
        });

        const handler = app.callback();
        const ctx = createMockContext({ path: '/v1/delegate' });
        await handler(ctx);

        // When delegating downstream, ctx.path must be the full original path:
        expect(downstreamObservedPath).toBe('/v1/delegate');
        // When unwinding back inside sub-router handler, ctx.path is re-adjusted:
        expect(postNextObservedPath).toBe('/delegate');
        // Final ctx.path after full app dispatch is restored:
        expect(ctx.path).toBe('/v1/delegate');
      });

      it('correctly resolves overlapping prefix mounts to distinct routers', async () => {
        const routerV1 = createMockRouter();
        routerV1.addRoute('/users', async (ctx) => ctx.json({ source: 'routerV1' }));

        const routerRoot = createMockRouter();
        routerRoot.addRoute('/health', async (ctx) => ctx.json({ source: 'routerRoot' }));
        routerRoot.addRoute('/v1/legacy', async (ctx) => ctx.json({ source: 'routerRootLegacy' }));

        app.route(['/api/v1', '/api/v2'], routerV1);
        app.route(['/api'], routerRoot);

        const handler = app.callback();

        // RouterV1 matched
        const ctx1 = createMockContext({ path: '/api/v1/users' });
        await handler(ctx1);
        expect(ctx1.json).toHaveBeenCalledWith({ source: 'routerV1' });

        // RouterRoot matched
        const ctx2 = createMockContext({ path: '/api/health' });
        await handler(ctx2);
        expect(ctx2.json).toHaveBeenCalledWith({ source: 'routerRoot' });

        // Route not in routerV1, falls through to routerRoot
        const ctx3 = createMockContext({ path: '/api/v1/legacy' });
        await handler(ctx3);
        expect(ctx3.json).toHaveBeenCalledWith({ source: 'routerRootLegacy' });
      });
    });
  });
});

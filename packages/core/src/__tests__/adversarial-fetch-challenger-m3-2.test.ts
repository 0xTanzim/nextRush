/**
 * @nextrush/core - Empirical Adversarial Challenge Suite: Milestone 3
 *
 * Focus Areas:
 * 1. Zero-Cost Invariant on Traditional Node.js Server Lifecycle
 * 2. Synchronous Fast-Path & Zero Microtask Queue Hop Verification
 * 3. Timeout & AbortSignal Adversarial Stress (Hanging handlers, slow streams, client abort, response commitment protection)
 * 4. Teardown & Re-boot Stress (Resource cleanup, leak detection, decoration rollback)
 * 5. Error Boundary & options.fetch.onError Edge Cases
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Context, Extension, Middleware, RouteEntry, RouteHandler } from '@nextrush/types';
import { DISPATCH_SETTLED_SYNC, RESOLVED_PROMISE } from '@nextrush/types';
import { Application, createApp } from '../application';

/** Minimal in-memory router double for core adversarial testing */
function createTestRouter() {
  const routes: Array<{ method: string; path: string; handler: RouteHandler }> = [];

  const router = {
    get(path: string, ...entries: RouteEntry[]) {
      routes.push({ method: 'GET', path, handler: entries[entries.length - 1] as RouteHandler });
      return router;
    },
    post(path: string, ...entries: RouteEntry[]) {
      routes.push({ method: 'POST', path, handler: entries[entries.length - 1] as RouteHandler });
      return router;
    },
    put(path: string, ...entries: RouteEntry[]) {
      routes.push({ method: 'PUT', path, handler: entries[entries.length - 1] as RouteHandler });
      return router;
    },
    delete(path: string, ...entries: RouteEntry[]) {
      routes.push({ method: 'DELETE', path, handler: entries[entries.length - 1] as RouteHandler });
      return router;
    },
    routes(): Middleware {
      return (ctx, next) => {
        const matched = routes.find((r) => r.method === ctx.method && r.path === ctx.path);
        if (matched) {
          const res = (matched.handler as (ctx: Context) => unknown)(ctx);
          if (res instanceof Promise || typeof (res as { then?: unknown })?.then === 'function') {
            return res as Promise<void>;
          }
          (ctx as unknown as Record<symbol, unknown>)[DISPATCH_SETTLED_SYNC] = true;
          return RESOLVED_PROMISE;
        } else if (next) {
          return next();
        }
        ctx.status = 404;
        return RESOLVED_PROMISE;
      };
    },
  };

  return router;
}

function req(urlOrPath: string, init?: RequestInit): Request {
  const url = urlOrPath.startsWith('http')
    ? urlOrPath
    : `http://localhost${urlOrPath.startsWith('/') ? '' : '/'}${urlOrPath}`;
  return new Request(url, init);
}

describe('Empirical Adversarial Challenge Suite: Milestone 3 (Universal Fetch)', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp({ router: createTestRouter() as never });
  });

  afterEach(async () => {
    vi.clearAllMocks();
    if (app) {
      await app.close();
    }
  });

  // =========================================================================
  // 1. ZERO-COST INVARIANT ON TRADITIONAL NODE.JS SERVER LIFECYCLE
  // =========================================================================
  describe('1. Zero-Cost Invariant on Traditional Node.js Server Lifecycle', () => {
    it('EMP-ZERO-01: traditional Node server lifecycle leaves _fetchRunner strictly undefined', async () => {
      const serverApp = createApp();
      const internal = serverApp as unknown as { _fetchRunner?: unknown };

      expect(internal._fetchRunner).toBeUndefined();

      serverApp.use((ctx) => {
        ctx.send('node-pipeline');
      });

      // Step 1: ready()
      await serverApp.ready();
      expect(internal._fetchRunner).toBeUndefined();

      // Step 2: callback()
      const handler = serverApp.callback();
      expect(typeof handler).toBe('function');
      expect(internal._fetchRunner).toBeUndefined();

      // Step 3: Simulate 50 Node.js HTTP request dispatches through callback handler
      for (let i = 0; i < 50; i++) {
        let responded = false;
        let body: unknown;
        const fakeCtx = {
          method: 'GET',
          path: '/test',
          status: 200,
          responded: false,
          send(data: unknown) {
            body = data;
            responded = true;
            (this as unknown as { responded: boolean }).responded = true;
          },
        } as unknown as Context;

        await handler(fakeCtx);
        expect(responded).toBe(true);
        expect(body).toBe('node-pipeline');
        // Invariant holds per request
        expect(internal._fetchRunner).toBeUndefined();
      }

      await serverApp.close();
      expect(internal._fetchRunner).toBeUndefined();
    });

    it('EMP-ZERO-02: traditional server execution creates zero timers and zero deadline schedulers', async () => {
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
      const serverApp = createApp();

      serverApp.use((ctx) => {
        ctx.send('timer-check');
      });

      await serverApp.ready();
      const handler = serverApp.callback();

      const initialTimerCount = setTimeoutSpy.mock.calls.length;

      for (let i = 0; i < 30; i++) {
        const fakeCtx = {
          method: 'GET',
          path: '/no-timer',
          status: 200,
          responded: false,
          send() {
            (this as unknown as { responded: boolean }).responded = true;
          },
        } as unknown as Context;

        await handler(fakeCtx);
      }

      // No timers must have been scheduled by the fetch subsystem
      expect(setTimeoutSpy.mock.calls.length).toBe(initialTimerCount);

      setTimeoutSpy.mockRestore();
      await serverApp.close();
    });
  });

  // =========================================================================
  // 2. SYNCHRONOUS FAST-PATH & ZERO MICROTASK QUEUE HOPS
  // =========================================================================
  describe('2. Synchronous Fast-Path & Zero Microtask Queue Hop Verification', () => {
    it('EMP-SYNC-01: synchronous route returns bare Response synchronously with 0 microtask hops', () => {
      app.get('/instant-sync', (ctx) => {
        ctx.json({ fast: true, status: 'instant' });
      });

      let microtaskRan = false;
      queueMicrotask(() => {
        microtaskRan = true;
      });

      // Synchronous execution on cold app (deferred sync boot)
      const res = app.fetch(req('/instant-sync'));

      // 1. res must be an instance of Response immediately
      expect(res).toBeInstanceOf(Response);

      // 2. res must NOT be a Promise (typeof res.then === 'undefined')
      expect(typeof (res as { then?: unknown }).then).toBe('undefined');

      // 3. Execution did NOT wait for any microtask turn
      expect(microtaskRan).toBe(false);

      expect((res as Response).status).toBe(200);
    });

    it('EMP-SYNC-02: steady-state sync dispatches remain synchronous across 100 consecutive calls', () => {
      app.get('/bench-sync', (ctx) => {
        ctx.send('ping');
      });

      for (let i = 0; i < 100; i++) {
        const res = app.fetch(req('/bench-sync'));
        expect(res).toBeInstanceOf(Response);
        expect(typeof (res as { then?: unknown }).then).toBe('undefined');
        expect((res as Response).status).toBe(200);
      }
    });

    it('EMP-SYNC-03: async route handler correctly falls back to Promise<Response>', async () => {
      app.get('/async-route', async (ctx) => {
        await Promise.resolve();
        ctx.json({ async: true });
      });

      const res = app.fetch(req('/async-route'));

      // Must be a Promise
      expect(res).toBeInstanceOf(Promise);
      expect(typeof (res as { then?: unknown }).then).toBe('function');

      const resolved = await res;
      expect(resolved).toBeInstanceOf(Response);
      expect(resolved.status).toBe(200);
      expect(await resolved.json()).toEqual({ async: true });
    });
  });

  // =========================================================================
  // 3. TIMEOUT & ABORTSIGNAL ADVERSARIAL STRESS
  // =========================================================================
  describe('3. Timeout & AbortSignal Adversarial Stress', () => {
    it('EMP-TIMEOUT-01: hanging route triggers 504 Gateway Timeout and aborts ctx.signal', async () => {
      let aborted = false;
      let abortReason: unknown;

      const timeoutApp = createApp({
        router: createTestRouter() as never,
        fetch: { timeout: 40 },
      });

      timeoutApp.get('/hanging', async (ctx) => {
        ctx.signal.addEventListener('abort', () => {
          aborted = true;
          abortReason = ctx.signal.reason;
        });
        // Hang indefinitely
        await new Promise(() => {});
      });

      const res = await timeoutApp.fetch(req('/hanging'));
      expect(res.status).toBe(504);
      expect(await res.json()).toEqual({ error: 'Gateway Timeout' });
      expect(aborted).toBe(true);
      expect(abortReason).toBeDefined();

      await timeoutApp.close();
    });

    it('EMP-TIMEOUT-02: response commitment protection preserves 200 when background work exceeds timeout', async () => {
      const timeoutApp = createApp({
        router: createTestRouter() as never,
        fetch: { timeout: 35 },
      });

      timeoutApp.get('/committed-slow', async (ctx) => {
        ctx.json({ acknowledged: true, task: 'background' });
        // Handler already committed response; now slow task exceeds timeout
        await new Promise((resolve) => setTimeout(resolve, 80));
      });

      const res = await timeoutApp.fetch(req('/committed-slow'));
      // Must deliver the committed 200 response, NOT a 504
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ acknowledged: true, task: 'background' });

      await timeoutApp.close();
    });

    it('EMP-TIMEOUT-03: client-side request abort propagates to ctx.signal', async () => {
      let serverSignalAborted = false;

      app.get('/client-abort', async (ctx) => {
        ctx.signal.addEventListener('abort', () => {
          serverSignalAborted = true;
        });
        await new Promise((resolve) => setTimeout(resolve, 100));
        ctx.send('should-not-reach');
      });

      const controller = new AbortController();
      const request = req('/client-abort', { signal: controller.signal });

      const promise = app.fetch(request);
      // Abort immediately from client
      controller.abort();

      await promise;
      expect(serverSignalAborted).toBe(true);
    });

    it('EMP-TIMEOUT-04: options.fetch.timeout = 0 completely disables framework timeout', async () => {
      const unboundedApp = createApp({
        router: createTestRouter() as never,
        fetch: { timeout: 0 },
      });

      unboundedApp.get('/slow-worker', async (ctx) => {
        await new Promise((resolve) => setTimeout(resolve, 60));
        ctx.send('worker-finished');
      });

      const res = await unboundedApp.fetch(req('/slow-worker'));
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('worker-finished');

      await unboundedApp.close();
    });
  });

  // =========================================================================
  // 4. TEARDOWN & RE-BOOT STRESS
  // =========================================================================
  describe('4. Teardown & Re-boot Stress Cycles', () => {
    it('EMP-REBOOT-01: 25 consecutive cycles of fetch -> close -> fetch maintain clean isolation', async () => {
      for (let cycle = 0; cycle < 25; cycle++) {
        const testApp = createApp({ router: createTestRouter() as never });
        testApp.get('/cycle', (ctx) => ctx.json({ cycle }));

        const res1 = await testApp.fetch(req('/cycle'));
        expect(res1.status).toBe(200);
        expect(await res1.json()).toEqual({ cycle });

        await testApp.close();

        // After close, verify internal state is reset
        const internal = testApp as unknown as { _fetchRunner?: unknown };
        expect(internal._fetchRunner).toBeUndefined();
        expect(testApp.isReady).toBe(false);
      }
    });

    it('EMP-REBOOT-02: extension teardown and clean re-registration across multiple app.close() calls', async () => {
      let setupCalls = 0;
      let destroyCalls = 0;

      const dynamicExt: Extension<{ decoratedValue: string }> = {
        name: 'dynamic-test-ext',
        setup(ctx) {
          setupCalls += 1;
          ctx.decorate('decoratedValue', `decor-${String(setupCalls)}`);
        },
        destroy() {
          destroyCalls += 1;
        },
      };

      // Cycle 1
      app.extend(dynamicExt);
      app.get('/decor', (ctx) => {
        ctx.send((app as unknown as { decoratedValue: string }).decoratedValue);
      });

      const res1 = await app.fetch(req('/decor'));
      expect(await res1.text()).toBe('decor-1');
      expect(setupCalls).toBe(1);
      expect(destroyCalls).toBe(0);

      await app.close();
      expect(destroyCalls).toBe(1);
      // Decoration must be cleanly deleted from app instance
      expect((app as unknown as Record<string, unknown>).decoratedValue).toBeUndefined();

      // Cycle 2: Re-register extension on un-frozen app
      app.extend(dynamicExt);
      const res2 = await app.fetch(req('/decor'));
      expect(await res2.text()).toBe('decor-2');
      expect(setupCalls).toBe(2);
      expect(destroyCalls).toBe(1);

      await app.close();
      expect(destroyCalls).toBe(2);
    });
  });

  // =========================================================================
  // 5. ERROR BOUNDARIES & CUSTOM ONERROR HOOKS
  // =========================================================================
  describe('5. Error Boundaries & Custom onError Hook Routing', () => {
    it('EMP-ERR-01: custom options.fetch.onError transforms uncaught sync exception into custom status', async () => {
      const errorApp = createApp({
        router: createTestRouter() as never,
        fetch: {
          onError: (err: Error, ctx: Context) => {
            return new Response(JSON.stringify({ custom: true, error: err.message, path: ctx.path }), {
              status: 422,
              headers: { 'content-type': 'application/json', 'x-custom-boundary': 'active' },
            });
          },
        },
      });

      errorApp.get('/fail-sync', () => {
        throw new Error('Sync operation failed validation');
      });

      const res = await errorApp.fetch(req('/fail-sync'));
      expect(res.status).toBe(422);
      expect(res.headers.get('x-custom-boundary')).toBe('active');
      expect(await res.json()).toEqual({
        custom: true,
        error: 'Sync operation failed validation',
        path: '/fail-sync',
      });

      await errorApp.close();
    });

    it('EMP-ERR-02: custom options.fetch.onError transforms uncaught async rejection', async () => {
      const errorApp = createApp({
        router: createTestRouter() as never,
        fetch: {
          onError: (err: Error) => {
            return new Response(JSON.stringify({ asyncCustom: true, reason: err.message }), {
              status: 418,
              headers: { 'content-type': 'application/json' },
            });
          },
        },
      });

      errorApp.get('/fail-async', async () => {
        await Promise.resolve();
        throw new Error('Async network failure');
      });

      const res = await errorApp.fetch(req('/fail-async'));
      expect(res.status).toBe(418);
      expect(await res.json()).toEqual({
        asyncCustom: true,
        reason: 'Async network failure',
      });

      await errorApp.close();
    });

    it('EMP-ERR-03: crashing custom onError hook falls back safely to 500 without crashing process', async () => {
      const brokenHookApp = createApp({
        router: createTestRouter() as never,
        fetch: {
          onError: () => {
            throw new Error('Crash inside the custom error boundary itself');
          },
        },
      });

      brokenHookApp.get('/crash-both', () => {
        throw new Error('Initial route failure');
      });

      const res = await brokenHookApp.fetch(req('/crash-both'));
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Internal Server Error' });

      await brokenHookApp.close();
    });
  });
});

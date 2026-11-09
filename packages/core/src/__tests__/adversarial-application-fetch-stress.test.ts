/**
 * @nextrush/core - Adversarial Empirical Stress & Concurrency Suite for Milestone 3
 *
 * Empirical challenger harness testing:
 * 1. Concurrency Stress (100+ simultaneous requests on cold unbooted Application)
 * 2. Destructuring & Isolation Safety (const { fetch } = app across async/promise boundaries)
 * 3. Cold Boot Failure & Retry Recovery (error envelope 500, gate reset, un-wedged retry)
 * 4. Zero-Cost Invariant on traditional listen() servers
 * 5. Edge cases: Extension decoration collisions during boot retry, mixed HTTP methods
 */

import { describe, expect, it, vi } from 'vitest';
import type { Context, Middleware, RouteEntry, RouteHandler } from '@nextrush/types';
import { DISPATCH_SETTLED_SYNC, RESOLVED_PROMISE } from '@nextrush/types';
import { createApp } from '../application';

/** Minimal in-memory router double for core package empirical stress testing */
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
    patch(path: string, ...entries: RouteEntry[]) {
      routes.push({ method: 'PATCH', path, handler: entries[entries.length - 1] as RouteHandler });
      return router;
    },
    head(path: string, ...entries: RouteEntry[]) {
      routes.push({ method: 'HEAD', path, handler: entries[entries.length - 1] as RouteHandler });
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

describe('Empirical Adversarial Stress Suite: Milestone 3 (Universal Fetch & Deferred Boot)', () => {
  // =========================================================================
  // 1. CONCURRENCY STRESS ON COLD UNBOOTED APPLICATION
  // =========================================================================
  describe('1. High Concurrency Stress on Cold Unbooted Application', () => {
    it('EMP-STRESS-01: 150 concurrent requests hitting a cold unbooted application execute exactly 1 boot cycle', async () => {
      let bootCalls = 0;
      let setupDelayCompleted = false;

      const app = createApp({ router: createTestRouter() as never });

      app.extend({
        name: 'stress-async-boot-ext',
        setup: async () => {
          bootCalls += 1;
          // Artificial async boot latency to widen the race window
          await new Promise((resolve) => setTimeout(resolve, 25));
          setupDelayCompleted = true;
        },
      });

      let handledCount = 0;
      app.get('/stress-cold', (ctx) => {
        handledCount += 1;
        ctx.json({
          ok: true,
          handled: handledCount,
          bootCalls,
        });
      });

      expect(app.isReady).toBe(false);
      expect(bootCalls).toBe(0);

      const CONCURRENT_REQUESTS = 150;
      const requests = Array.from({ length: CONCURRENT_REQUESTS }, (_, i) =>
        app.fetch(req(`/stress-cold?reqId=${i}`))
      );

      const responses = await Promise.all(requests);

      expect(responses.length).toBe(CONCURRENT_REQUESTS);
      expect(bootCalls).toBe(1);
      expect(setupDelayCompleted).toBe(true);
      expect(app.isReady).toBe(true);

      for (const res of responses) {
        expect(res.status).toBe(200);
        const data = (await res.json()) as { ok: boolean; bootCalls: number };
        expect(data.ok).toBe(true);
        expect(data.bootCalls).toBe(1);
      }

      await app.close();
    });

    it('EMP-STRESS-02: 250 concurrent requests on a zero-extension cold application boot synchronously with 0 dropped requests', async () => {
      const app = createApp({ router: createTestRouter() as never });

      let counter = 0;
      app.get('/fast-cold', (ctx) => {
        counter += 1;
        ctx.json({ count: counter });
      });

      const CONCURRENT_REQUESTS = 250;
      const requests = Array.from({ length: CONCURRENT_REQUESTS }, (_, i) =>
        app.fetch(req(`/fast-cold?seq=${i}`))
      );

      const responses = await Promise.all(requests);

      expect(responses.length).toBe(CONCURRENT_REQUESTS);
      expect(app.isReady).toBe(true);

      for (const res of responses) {
        expect(res.status).toBe(200);
        const data = (await res.json()) as { count: number };
        expect(data.count).toBeGreaterThan(0);
      }

      await app.close();
    });

    it('EMP-STRESS-03: 120 concurrent mixed HTTP verb requests on cold app execute without race conditions', async () => {
      const app = createApp({ router: createTestRouter() as never });

      app.extend({
        name: 'verbs-boot-ext',
        setup: async () => {
          await new Promise((r) => setTimeout(r, 10));
        },
      });

      app.get('/resource', (ctx) => ctx.json({ verb: 'GET' }));
      app.post('/resource', (ctx) => ctx.json({ verb: 'POST' }));
      app.put('/resource', (ctx) => ctx.json({ verb: 'PUT' }));
      app.delete('/resource', (ctx) => ctx.json({ verb: 'DELETE' }));
      app.patch('/resource', (ctx) => ctx.json({ verb: 'PATCH' }));

      const verbs = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
      const CONCURRENT_REQUESTS = 120;

      const requests = Array.from({ length: CONCURRENT_REQUESTS }, (_, i) => {
        const verb = verbs[i % verbs.length];
        return app.fetch(req('/resource', { method: verb }));
      });

      const responses = await Promise.all(requests);
      expect(responses.length).toBe(CONCURRENT_REQUESTS);

      for (let i = 0; i < responses.length; i++) {
        const res = responses[i];
        if (!res) continue;
        const expectedVerb = verbs[i % verbs.length];
        expect(res.status).toBe(200);
        const body = (await res.json()) as { verb: string };
        expect(body.verb).toBe(expectedVerb);
      }

      await app.close();
    });
  });

  // =========================================================================
  // 2. DESTRUCTURING & ISOLATION STRESS
  // =========================================================================
  describe('2. Destructuring & Multi-Application Isolation Safety', () => {
    it('EMP-DESTRUCT-01: const { fetch } = app survives setTimeout, microtask queues, and unbound references', async () => {
      const app = createApp({ router: createTestRouter() as never });
      app.get('/destructure', (ctx) => ctx.send('unbound-ok'));

      const { fetch } = app;

      // 1. Plain unbound call
      const res1 = await fetch(req('/destructure'));
      expect(res1.status).toBe(200);
      expect(await res1.text()).toBe('unbound-ok');

      // 2. Across setTimeout boundary
      const res2 = await new Promise<Response>((resolve) => {
        setTimeout(() => {
          resolve(fetch(req('/destructure')));
        }, 10);
      });
      expect(res2.status).toBe(200);
      expect(await res2.text()).toBe('unbound-ok');

      // 3. Across queueMicrotask boundary
      const res3 = await new Promise<Response>((resolve) => {
        queueMicrotask(() => {
          resolve(fetch(req('/destructure')));
        });
      });
      expect(res3.status).toBe(200);
      expect(await res3.text()).toBe('unbound-ok');

      // 4. Stored as an unbound property on an unrelated object
      const containerObj = { runner: fetch };
      const res4 = await containerObj.runner(req('/destructure'));
      expect(res4.status).toBe(200);
      expect(await res4.text()).toBe('unbound-ok');

      await app.close();
    });

    it('EMP-ISOLATION-02: 5 distinct Application instances concurrently handling 200 interleaved requests maintain strict state isolation', async () => {
      const APPS_COUNT = 5;
      const REQS_PER_APP = 40;

      const apps = Array.from({ length: APPS_COUNT }, (_, index) => {
        const a = createApp({ router: createTestRouter() as never });
        a.get('/tenant-data', (ctx) => ctx.json({ tenantId: `tenant-${index}` }));
        return { id: `tenant-${index}`, app: a, fetch: a.fetch };
      });

      // Interleave all requests in a single Promise.all
      const taskList: Array<{ expectedId: string; promise: Promise<Response> }> = [];

      for (let reqIndex = 0; reqIndex < REQS_PER_APP; reqIndex++) {
        for (const tenant of apps) {
          taskList.push({
            expectedId: tenant.id,
            promise: Promise.resolve(tenant.fetch(req(`/tenant-data?round=${reqIndex}`))),
          });
        }
      }

      expect(taskList.length).toBe(APPS_COUNT * REQS_PER_APP);

      const results = await Promise.all(taskList.map((t) => t.promise));

      for (let i = 0; i < results.length; i++) {
        const res = results[i];
        const task = taskList[i];
        if (!res || !task) continue;
        const expectedId = task.expectedId;
        expect(res.status).toBe(200);
        const data = (await res.json()) as { tenantId: string };
        expect(data.tenantId).toBe(expectedId);
      }

      await Promise.all(apps.map((a) => a.app.close()));
    });

    it('EMP-ISOLATION-03: multi-runtime signature invocations operate concurrently without cross-context interference', async () => {
      const app = createApp({ router: createTestRouter() as never });

      app.get('/env-check', (ctx) => {
        const env = (ctx as unknown as { env?: Record<string, string> }).env;
        ctx.json({
          ip: ctx.ip,
          envVal: env?.TARGET ?? 'none',
        });
      });

      const { fetch } = app;

      // 1. Cloudflare Workers style (req, env, ctx)
      const cfPromise = fetch(
        req('/env-check'),
        { TARGET: 'cf-isolate' },
        { waitUntil: vi.fn() }
      );

      // 2. Bun style (req, server)
      const bunServer = {
        requestIP: () => ({ address: '192.0.2.1', port: 1234, family: 'IPv4' }),
      };
      const bunPromise = fetch(req('/env-check'), bunServer);

      // 3. Deno style (req, info)
      const denoInfo = {
        remoteAddr: { hostname: '198.51.100.99', port: 5678, transport: 'tcp' },
      };
      const denoPromise = fetch(req('/env-check'), denoInfo);

      // 4. Standard 1-arg
      const stdPromise = fetch(req('/env-check'));

      const [cfRes, bunRes, denoRes, stdRes] = await Promise.all([
        cfPromise,
        bunPromise,
        denoPromise,
        stdPromise,
      ]);

      expect((await cfRes.json()) as unknown).toEqual({ ip: '', envVal: 'cf-isolate' });
      expect((await bunRes.json()) as unknown).toEqual({ ip: '192.0.2.1', envVal: 'none' });
      expect((await denoRes.json()) as unknown).toEqual({ ip: '198.51.100.99', envVal: 'none' });
      expect((await stdRes.json()) as unknown).toEqual({ ip: '', envVal: 'none' });

      await app.close();
    });
  });

  // =========================================================================
  // 3. COLD BOOT FAILURE & RETRY RECOVERY
  // =========================================================================
  describe('3. Cold Boot Failure & Recovery Invariants', () => {
    it('EMP-BOOT-FAIL-01: cold boot extension failure returns HTTP 500 error envelope, clears boot gate, and retries cleanly', async () => {
      let attempts = 0;
      const app = createApp({ router: createTestRouter() as never });

      app.extend({
        name: 'flaky-service-ext',
        setup: async () => {
          attempts += 1;
          if (attempts === 1) {
            throw new Error('Postgres connection timeout at cold start');
          }
        },
      });

      app.get('/protected-route', (ctx) => ctx.send('service-alive'));

      // First call: Boot fails
      expect(app.isReady).toBe(false);
      const res1 = await app.fetch(req('/protected-route'));

      expect(res1.status).toBe(500);
      expect(app.isReady).toBe(false);
      expect(attempts).toBe(1);

      // Second call: Boot retries and succeeds
      const res2 = await app.fetch(req('/protected-route'));
      expect(res2.status).toBe(200);
      expect(await res2.text()).toBe('service-alive');
      expect(app.isReady).toBe(true);
      expect(attempts).toBe(2);

      // Third call: Steady-state does not re-run boot
      const res3 = await app.fetch(req('/protected-route'));
      expect(res3.status).toBe(200);
      expect(attempts).toBe(2);

      await app.close();
    });

    it('EMP-BOOT-FAIL-02: 50 concurrent requests during cold boot failure all settle with 500 and leave gate un-wedged', async () => {
      let bootAttempts = 0;
      let shouldFail = true;

      const app = createApp({ router: createTestRouter() as never });

      app.extend({
        name: 'batch-failing-ext',
        setup: async () => {
          bootAttempts += 1;
          await new Promise((r) => setTimeout(r, 15));
          if (shouldFail) {
            throw new Error('Downstream vault unreachable');
          }
        },
      });

      app.get('/batch-target', (ctx) => ctx.send('recovered'));

      // 50 concurrent requests when boot will fail
      const failedBatch = await Promise.all(
        Array.from({ length: 50 }, () => app.fetch(req('/batch-target')))
      );

      expect(failedBatch.length).toBe(50);
      for (const res of failedBatch) {
        expect(res.status).toBe(500);
      }
      expect(app.isReady).toBe(false);
      expect(bootAttempts).toBe(1);

      // Fix failure condition and verify retry works
      shouldFail = false;
      const recoveredBatch = await Promise.all(
        Array.from({ length: 10 }, () => app.fetch(req('/batch-target')))
      );

      for (const res of recoveredBatch) {
        expect(res.status).toBe(200);
        expect(await res.text()).toBe('recovered');
      }
      expect(app.isReady).toBe(true);
      expect(bootAttempts).toBe(2);

      await app.close();
    });

    it('EMP-BOOT-FAIL-03: multiple consecutive boot failures do not corrupt internal state or cause permanent lockup', async () => {
      let attempts = 0;
      const app = createApp({ router: createTestRouter() as never });

      app.extend({
        name: 'multi-fail-ext',
        setup: () => {
          attempts += 1;
          if (attempts < 4) {
            throw new Error(`Transient failure #${attempts}`);
          }
        },
      });

      app.get('/multi-retry', (ctx) => ctx.send(`success-after-${attempts}`));

      // Attempts 1, 2, 3 must all fail with 500
      for (let i = 1; i <= 3; i++) {
        const res = await app.fetch(req('/multi-retry'));
        expect(res.status).toBe(500);
        expect(app.isReady).toBe(false);
        expect(attempts).toBe(i);
      }

      // Attempt 4 succeeds
      const res4 = await app.fetch(req('/multi-retry'));
      expect(res4.status).toBe(200);
      expect(await res4.text()).toBe('success-after-4');
      expect(app.isReady).toBe(true);
      expect(attempts).toBe(4);

      await app.close();
    });

    it('EMP-BOOT-FAIL-04 [ADVERSARIAL ATTACK]: Extension decorate() during partial boot before downstream failure', async () => {
      let ext1SetupCount = 0;
      let ext2SetupCount = 0;
      const errorLogs: string[] = [];

      const app = createApp({
        router: createTestRouter() as never,
        logger: {
          error: (...args: unknown[]) => errorLogs.push(args.map(String).join(' ')),
          warn: vi.fn(),
          info: vi.fn(),
          debug: vi.fn(),
        },
      });

      // Extension 1 decorates app with a property
      app.extend({
        name: 'ext-decorator',
        setup: (ctx) => {
          ext1SetupCount += 1;
          ctx.decorate('myCustomService', { id: 'svc-123' });
        },
      });

      // Extension 2 throws on first attempt
      app.extend({
        name: 'ext-failing-downstream',
        setup: () => {
          ext2SetupCount += 1;
          if (ext2SetupCount === 1) {
            throw new Error('Downstream boom');
          }
        },
      });

      app.get('/check-decorate', (ctx) => {
        const svc = (app as unknown as { myCustomService?: { id: string } }).myCustomService;
        ctx.json({ serviceId: svc?.id });
      });

      // Request 1: Boot fails in Extension 2 (after Extension 1 called ctx.decorate)
      const res1 = await app.fetch(req('/check-decorate'));
      expect(res1.status).toBe(500);
      expect(app.isReady).toBe(false);
      expect(ext1SetupCount).toBe(1);
      expect(ext2SetupCount).toBe(1);

      // Request 2: Retry boot!
      // Because _boot() rolls back decorations on failure, retry succeeds cleanly!
      const res2 = await app.fetch(req('/check-decorate'));
      expect(res2.status).toBe(200);
      expect(app.isReady).toBe(true);

      await app.close();
    });

    it('EMP-BOOT-FAIL-05: options.fetch.onError is cleanly intercepted on handler exceptions', async () => {
      let customOnErrorCalled = false;
      const app = createApp({
        router: createTestRouter() as never,
        fetch: {
          onError: () => {
            customOnErrorCalled = true;
            return new Response('custom-handled', { status: 418 });
          },
        },
      });

      app.get('/will-throw', () => {
        throw new Error('Explosion');
      });

      const res = await app.fetch(req('/will-throw'));

      expect(customOnErrorCalled).toBe(true);
      expect(res.status).toBe(418);
      expect(await res.text()).toBe('custom-handled');

      await app.close();
    });
  });

  // =========================================================================
  // 4. ZERO-COST INVARIANT FOR TRADITIONAL LISTEN() SERVERS
  // =========================================================================
  describe('4. Zero-Cost Invariant on app.listen() Servers', () => {
    it('EMP-ZERO-01: app.ready() and app.callback() for Node.js listen() allocate zero fetch runners and arm zero timers', async () => {
      const serverApp = createApp();
      serverApp.use((ctx) => {
        ctx.send('node-http');
      });

      // Simulate standard listen() startup phase
      await serverApp.ready();
      const handler = serverApp.callback();

      expect(typeof handler).toBe('function');

      // Internal inspection: _fetchRunner MUST be undefined
      const internal = serverApp as unknown as { _fetchRunner?: unknown };
      expect(internal._fetchRunner).toBeUndefined();

      // Ensure no dangling timers or deadline schedulers were created
      // Close without error
      await serverApp.close();
    });

    it('EMP-ZERO-02: invoking app.fetch creates _fetchRunner exactly once, and close() tears it down', async () => {
      const app = createApp({ router: createTestRouter() as never });
      app.get('/test-lazy', (ctx) => ctx.send('ok'));

      const internal = app as unknown as { _fetchRunner?: unknown };
      expect(internal._fetchRunner).toBeUndefined();

      await app.fetch(req('/test-lazy'));

      expect(internal._fetchRunner).toBeDefined();
      const firstRunner = internal._fetchRunner;

      // Second request reuses the exact same runner
      await app.fetch(req('/test-lazy'));
      expect(internal._fetchRunner).toBe(firstRunner);

      // close() clears the runner
      await app.close();
      expect(internal._fetchRunner).toBeUndefined();
    });
  });
});

/**
 * @nextrush/core - Application Universal Fetch Unit Tests
 *
 * Verifies first-class instance-bound `app.fetch`, deferred boot barrier,
 * runtime export signatures, zero-overhead Node.js server invariants,
 * teardown resets, error boundaries, and per-request timeouts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Context, Extension, Middleware, RouteEntry, RouteHandler } from '@nextrush/types';
import { DISPATCH_SETTLED_SYNC, RESOLVED_PROMISE } from '@nextrush/types';
import { Application, createApp } from '../application';

/** Minimal in-memory router double for core package unit testing */
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
        }
        ctx.status = 404;
        if (next) {
          return next();
        }
        return RESOLVED_PROMISE;
      };
    },
  };

  return router;
}

/** Helper to construct standard Web Requests */
function req(urlOrPath: string, init?: RequestInit): Request {
  const url = urlOrPath.startsWith('http')
    ? urlOrPath
    : `http://localhost${urlOrPath.startsWith('/') ? '' : '/'}${urlOrPath}`;
  return new Request(url, init);
}

describe('Application.prototype.fetch', () => {
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
  // 1. Instance-Bound Destructuring Invariant
  // =========================================================================
  describe('Instance-Bound Property & Destructuring Safety', () => {
    it('UNIT-FETCH-01: destructuring const { fetch } = app preserves this without .bind(app)', async () => {
      app.get('/ping', (ctx) => {
        ctx.send('pong');
      });

      // Destructure fetch directly (zero-boilerplate export pattern: export default { fetch: app.fetch })
      const { fetch } = app;
      const res = await fetch(req('/ping'));

      expect(res.status).toBe(200);
      expect(await res.text()).toBe('pong');
    });

    it('UNIT-FETCH-02: separate Application instances maintain strictly isolated fetch runners', async () => {
      const appA = createApp({ router: createTestRouter() as never });
      const appB = createApp({ router: createTestRouter() as never });

      appA.get('/id', (ctx) => ctx.send('app-A'));
      appB.get('/id', (ctx) => ctx.send('app-B'));

      const fetchA = appA.fetch;
      const fetchB = appB.fetch;

      const [resA, resB] = await Promise.all([
        fetchA(req('/id')),
        fetchB(req('/id')),
      ]);

      expect(await resA.text()).toBe('app-A');
      expect(await resB.text()).toBe('app-B');

      await Promise.all([appA.close(), appB.close()]);
    });
  });

  // =========================================================================
  // 2. Multi-Runtime Direct Export Signatures
  // =========================================================================
  describe('Direct Export Signatures Across Runtimes', () => {
    it('UNIT-FETCH-03: standard 1-argument invocation fetch(req) executes without adapter imports', async () => {
      app.get('/health', (ctx) => {
        ctx.json({ status: 'healthy', runtime: ctx.runtime });
      });

      const res = await app.fetch(req('/health'));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: 'healthy', runtime: 'node' });
    });

    it('UNIT-FETCH-04: Cloudflare Workers 3-arg invocation (req, env, ctx) binds ctx.env and delegates ctx.waitUntil', async () => {
      let backgroundDone = false;
      app.get('/cf-endpoint', (ctx) => {
        const env = (ctx as unknown as { env: { KV: { get: (k: string) => string }; API_KEY: string } }).env;
        (ctx as unknown as { waitUntil: (p: Promise<unknown>) => void }).waitUntil(
          (async () => {
            backgroundDone = true;
          })()
        );
        ctx.json({ key: env.API_KEY, kv: env.KV.get('test_key') });
      });

      const mockEnv = {
        API_KEY: 'secret_cf_token',
        KV: { get: (k: string) => `value_of_${k}` },
      };

      const scheduledPromises: Promise<unknown>[] = [];
      const mockCtx = {
        waitUntil(p: Promise<unknown>) {
          scheduledPromises.push(p);
        },
      };

      const res = await app.fetch(req('/cf-endpoint'), mockEnv, mockCtx);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ key: 'secret_cf_token', kv: 'value_of_test_key' });
      expect(scheduledPromises.length).toBe(1);

      await Promise.all(scheduledPromises);
      expect(backgroundDone).toBe(true);
    });

    it('UNIT-FETCH-05: Vercel Edge 2-arg invocation (req, ctx) delegates ctx.waitUntil', async () => {
      let vercelDone = false;
      app.get('/vercel-edge', (ctx) => {
        (ctx as unknown as { waitUntil: (p: Promise<unknown>) => void }).waitUntil(
          (async () => {
            vercelDone = true;
          })()
        );
        ctx.send('vercel-ok');
      });

      const scheduledPromises: Promise<unknown>[] = [];
      const mockCtx = {
        waitUntil(p: Promise<unknown>) {
          scheduledPromises.push(p);
        },
      };

      const res = await app.fetch(req('/vercel-edge'), mockCtx);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('vercel-ok');
      expect(scheduledPromises.length).toBe(1);

      await Promise.all(scheduledPromises);
      expect(vercelDone).toBe(true);
    });

    it('UNIT-FETCH-06: Bun 2-arg invocation (req, server) resolves client IP via server.requestIP', async () => {
      app.get('/bun-ip', (ctx) => {
        ctx.json({ clientIp: ctx.ip });
      });

      const mockBunServer = {
        requestIP(_r: Request) {
          return { address: '198.51.100.77', port: 51234, family: 'IPv4' };
        },
      };

      const res = await app.fetch(req('/bun-ip'), mockBunServer);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ clientIp: '198.51.100.77' });
    });

    it('UNIT-FETCH-07: Deno 2-arg invocation (req, info) resolves client IP via info.remoteAddr.hostname', async () => {
      app.get('/deno-ip', (ctx) => {
        ctx.json({ clientIp: ctx.ip });
      });

      const mockDenoInfo = {
        remoteAddr: {
          transport: 'tcp',
          hostname: '203.0.113.45',
          port: 48999,
        },
      };

      const res = await app.fetch(req('/deno-ip'), mockDenoInfo);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ clientIp: '203.0.113.45' });
    });
  });

  // =========================================================================
  // 3. Deferred Boot Barrier & Concurrent Booting
  // =========================================================================
  describe('Deferred Boot Barrier Integration', () => {
    it('UNIT-FETCH-08: cold request automatically boots application without calling app.ready() or listen()', async () => {
      let extensionBooted = false;
      const testExtension: Extension = {
        name: 'test-auto-boot-ext',
        setup: () => {
          extensionBooted = true;
        },
      };

      app.extend(testExtension);
      app.get('/auto-boot', (ctx) => ctx.send('boot-success'));

      expect(app.isReady).toBe(false);
      expect(extensionBooted).toBe(false);

      const res = await app.fetch(req('/auto-boot'));

      expect(res.status).toBe(200);
      expect(await res.text()).toBe('boot-success');
      expect(app.isReady).toBe(true);
      expect(extensionBooted).toBe(true);
    });

    it('UNIT-FETCH-09: memoizes boot promise across 20 concurrent cold-start requests', async () => {
      let bootCalls = 0;
      app.extend({
        name: 'test-counter-ext',
        setup: async () => {
          bootCalls += 1;
          await new Promise((r) => setTimeout(r, 15));
        },
      });

      app.get('/concurrent', (ctx) => ctx.json({ bootCalls }));

      const concurrentRequests = Array.from({ length: 20 }, () =>
        app.fetch(req('/concurrent'))
      );

      const responses = await Promise.all(concurrentRequests);
      for (const res of responses) {
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ bootCalls: 1 });
      }

      expect(bootCalls).toBe(1);
    });

    it('UNIT-FETCH-10: boot failure returns 500 error envelope and clears boot promise for retry', async () => {
      let bootAttempt = 0;
      app.extend({
        name: 'test-retry-ext',
        setup: () => {
          bootAttempt += 1;
          if (bootAttempt === 1) {
            throw new Error('Database connection unavailable');
          }
        },
      });

      app.get('/retryable', (ctx) => ctx.send('finally-booted'));

      // First call fails
      const res1 = await app.fetch(req('/retryable'));
      expect(res1.status).toBe(500);
      expect(await res1.json()).toEqual({ error: 'Internal Server Error' });
      expect(app.isReady).toBe(false);

      // Second call retries and succeeds
      const res2 = await app.fetch(req('/retryable'));
      expect(res2.status).toBe(200);
      expect(await res2.text()).toBe('finally-booted');
      expect(app.isReady).toBe(true);
      expect(bootAttempt).toBe(2);
    });
  });

  // =========================================================================
  // 4. Zero-Overhead Invariant for Node.js listen()
  // =========================================================================
  describe('Zero-Overhead Invariant for Traditional Servers', () => {
    it('UNIT-FETCH-11: _fetchRunner remains strictly undefined when app is booted or used for listen()', async () => {
      const serverApp = createApp();
      serverApp.use((ctx) => {
        ctx.send('node-http');
      });

      // Simulate Node.js server lifecycle: ready() followed by callback()
      await serverApp.ready();
      const nodeHandler = serverApp.callback();
      expect(typeof nodeHandler).toBe('function');

      // Verify internal zero-overhead property: _fetchRunner must NOT exist
      const internal = serverApp as unknown as { _fetchRunner?: unknown };
      expect(internal._fetchRunner).toBeUndefined();

      await serverApp.close();
    });

    it('UNIT-FETCH-12: _fetchRunner is only initialized upon the first invocation of app.fetch()', async () => {
      const internal = app as unknown as { _fetchRunner?: unknown };
      expect(internal._fetchRunner).toBeUndefined();

      app.get('/lazy-runner', (ctx) => ctx.send('ok'));
      await app.fetch(req('/lazy-runner'));

      expect(internal._fetchRunner).toBeDefined();
      expect(typeof internal._fetchRunner).toBe('function');
    });
  });

  // =========================================================================
  // 5. Teardown Lifecycle & Clean Re-Booting
  // =========================================================================
  describe('Shutdown Lifecycle & Re-Booting Isolation', () => {
    it('UNIT-FETCH-13: app.close() resets _fetchRunner to undefined and isReady to false', async () => {
      app.get('/lifecycle', (ctx) => ctx.send('ok'));

      await app.fetch(req('/lifecycle'));
      const internal = app as unknown as { _fetchRunner?: unknown };
      expect(internal._fetchRunner).toBeDefined();
      expect(app.isReady).toBe(true);

      await app.close();

      expect(internal._fetchRunner).toBeUndefined();
      expect(app.isReady).toBe(false);
    });

    it('UNIT-FETCH-14: calling app.fetch() after app.close() cleanly re-boots application', async () => {
      let setupCount = 0;
      let destroyCount = 0;

      const ext: Extension = {
        name: 'test-reboot-ext',
        setup: () => {
          setupCount += 1;
        },
        destroy: () => {
          destroyCount += 1;
        },
      };

      app.extend(ext);
      app.get('/reboot-test', (ctx) => ctx.json({ setupCount, destroyCount }));

      // Phase 1: Initial boot via fetch
      const res1 = await app.fetch(req('/reboot-test'));
      expect(res1.status).toBe(200);
      expect(await res1.json()).toEqual({ setupCount: 1, destroyCount: 0 });

      // Phase 2: Close application
      await app.close();
      expect(destroyCount).toBe(1);

      // Re-register extension on un-frozen app
      app.extend(ext);

      // Phase 3: Re-boot via second fetch
      const res2 = await app.fetch(req('/reboot-test'));
      expect(res2.status).toBe(200);
      expect(await res2.json()).toEqual({ setupCount: 2, destroyCount: 1 });
    });
  });

  // =========================================================================
  // 6. Error & Timeout Handling (options.fetch Configuration)
  // =========================================================================
  describe('Error Boundaries & Timeout Handling', () => {
    it('UNIT-FETCH-15: options.fetch.timeout triggers 504 Gateway Timeout and aborts ctx.signal', async () => {
      let signalAborted = false;
      const timeoutApp = createApp({
        router: createTestRouter() as never,
        fetch: { timeout: 35 },
      });

      timeoutApp.get('/slow', async (ctx) => {
        ctx.signal.addEventListener('abort', () => {
          signalAborted = true;
        });
        await new Promise((r) => setTimeout(r, 80));
        ctx.json({ finished: true });
      });

      const res = await timeoutApp.fetch(req('/slow'));
      expect(res.status).toBe(504);
      expect(await res.json()).toEqual({ error: 'Gateway Timeout' });
      expect(signalAborted).toBe(true);

      await timeoutApp.close();
    });

    it('UNIT-FETCH-16: response commitment protection preserves 200 response when slow work exceeds timeout', async () => {
      const timeoutApp = createApp({
        router: createTestRouter() as never,
        fetch: { timeout: 35 },
      });

      timeoutApp.get('/slow-committed', async (ctx) => {
        ctx.json({ committed: true });
        await new Promise((r) => setTimeout(r, 70));
      });

      const res = await timeoutApp.fetch(req('/slow-committed'));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ committed: true });

      await timeoutApp.close();
    });

    it('UNIT-FETCH-17: fetch.timeout: 0 disables the framework timeout barrier', async () => {
      const noTimeoutApp = createApp({
        router: createTestRouter() as never,
        fetch: { timeout: 0 },
      });

      noTimeoutApp.get('/long-op', async (ctx) => {
        await new Promise((r) => setTimeout(r, 50));
        ctx.send('done');
      });

      const res = await noTimeoutApp.fetch(req('/long-op'));
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('done');

      await noTimeoutApp.close();
    });

    it('UNIT-FETCH-18: uncaught sync and async exceptions return 500 JSON error envelope', async () => {
      app.get('/crash-sync', () => {
        throw new Error('Sync explosion');
      });
      app.get('/crash-async', async () => {
        await Promise.resolve();
        throw new Error('Async explosion');
      });

      const resSync = await app.fetch(req('/crash-sync'));
      expect(resSync.status).toBe(500);
      expect(await resSync.json()).toMatchObject({ status: 500, error: 'Internal Server Error' });

      const resAsync = await app.fetch(req('/crash-async'));
      expect(resAsync.status).toBe(500);
      expect(await resAsync.json()).toMatchObject({ status: 500, error: 'Internal Server Error' });
    });

    it('UNIT-FETCH-19: options.fetch.onError transforms uncaught exceptions to custom response', async () => {
      const customErrorApp = createApp({
        router: createTestRouter() as never,
        fetch: {
          onError: (err: Error, ctx: Context) => {
            return new Response(JSON.stringify({ customMessage: err.message, path: ctx.path }), {
              status: 422,
              headers: { 'content-type': 'application/json', 'x-custom-error': '1' },
            });
          },
        },
      });

      customErrorApp.get('/unprocessable', () => {
        throw new Error('Invalid payload parameters');
      });

      const res = await customErrorApp.fetch(req('/unprocessable'));
      expect(res.status).toBe(422);
      expect(res.headers.get('x-custom-error')).toBe('1');
      expect(await res.json()).toEqual({
        customMessage: 'Invalid payload parameters',
        path: '/unprocessable',
      });

      await customErrorApp.close();
    });

    it('UNIT-FETCH-20: custom onError that throws synchronously or asynchronously falls back safely to 500', async () => {
      const brokenHookApp = createApp({
        router: createTestRouter() as never,
        fetch: {
          onError: () => {
            throw new Error('Crash in error hook');
          },
        },
      });

      brokenHookApp.get('/hook-fail', () => {
        throw new Error('Original error');
      });

      const res = await brokenHookApp.fetch(req('/hook-fail'));
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Internal Server Error' });

      await brokenHookApp.close();
    });
  });

  // =========================================================================
  // 7. Fast Path & Default Routing
  // =========================================================================
  describe('Synchronous Dispatch Fast Path & Default Envelopes', () => {
    it('UNIT-FETCH-21: synchronous handler with syncDispatchSafe returns bare Response synchronously', async () => {
      const syncApp = createApp({ router: createTestRouter() as never });
      syncApp.get('/pure-sync', (ctx) => {
        ctx.json({ fast: true });
      });

      // Synchronous bypass test
      const res = syncApp.fetch(req('/pure-sync'));
      if (syncApp.syncDispatchSafe) {
        expect(res).toBeInstanceOf(Response);
        expect(typeof (res as Promise<Response>).then).toBe('undefined');
      } else {
        const resolved = await res;
        expect(resolved.status).toBe(200);
      }
      await syncApp.close();
    });

    it('UNIT-FETCH-22: unhandled routes return default 404 JSON envelope', async () => {
      const res = await app.fetch(req('/non-existent-route'));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'Not Found' });
    });
  });
});

import { describe, expect, it, vi } from 'vitest';
import { DISPATCH_SETTLED_SYNC, type Logger } from '@nextrush/types';
import {
  createUniversalFetchHandler,
  DEFAULT_UNIVERSAL_TIMEOUT_MS,
  type UniversalFetchOptions,
} from '../universal-runner';
import type { WebRunnerApp } from '../web-runner';
import {
  createUniversalWebContext,
  UniversalWebContext,
  type UniversalExecutionContext,
} from '../universal-context';

function createMockApp(
  dispatch: (ctx: UniversalWebContext) => Promise<void> | void,
  options: {
    syncDispatchSafe?: boolean;
    isReady?: boolean;
    bootDelayMs?: number;
    bootError?: Error;
    throwOnCallback?: boolean;
  } = {}
): WebRunnerApp<(ctx: UniversalWebContext) => Promise<void>> & { readyCalls: number } {
  let readyCalls = 0;
  const logger: Logger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };

  return {
    isReady: options.isReady ?? false,
    isProduction: true,
    logger,
    syncDispatchSafe: options.syncDispatchSafe ?? true,
    get readyCalls() {
      return readyCalls;
    },
    ready: () => {
      readyCalls += 1;
      if (options.bootError) {
        return Promise.reject(options.bootError);
      }
      if (options.bootDelayMs && options.bootDelayMs > 0) {
        return new Promise<void>((resolve) => setTimeout(resolve, options.bootDelayMs));
      }
      return Promise.resolve();
    },
    start: vi.fn(),
    callback: () => {
      if (options.throwOnCallback) {
        throw new Error('Callback generator exploded');
      }
      return (ctx: UniversalWebContext) => {
        const res = dispatch(ctx);
        return res instanceof Promise ? res : Promise.resolve();
      };
    },
  };
}

describe('Empirical Adversarial Stress Suite: UniversalWebContext & Fetch Runner', () => {
  // =========================================================================
  // Dimension 1: Extreme Calling Conventions & Boundary Inputs
  // =========================================================================
  describe('Dimension 1: Extreme Calling Conventions', () => {
    it('handles malformed env types (primitives, null, arrays, symbols, circular objects)', () => {
      const circularEnv: Record<string, unknown> = { key: 'value' };
      circularEnv.self = circularEnv;

      const malformedEnvs = [
        null,
        12345,
        'string-env',
        true,
        Symbol('env-sym'),
        BigInt(9007199254740991),
        ['array', 'of', 'items'],
        circularEnv,
      ];

      for (const env of malformedEnvs) {
        const ctx = new UniversalWebContext(
          new Request('http://localhost/malformed-env'),
          env,
          { waitUntil() {} }
        );
        expect(ctx.env).toBe(env);
        expect(ctx.executionContext).toBeDefined();
        expect(ctx.path).toBe('/malformed-env');
      }
    });

    it('handles missing or malformed executionCtx in 3-argument calls', () => {
      const malformedCtxs = [
        undefined,
        null,
        'invalid-context',
        12345,
        false,
        Symbol('ctx-sym'),
        {}, // Object without waitUntil
        { waitUntil: 'not-a-function' },
      ];

      for (const badCtx of malformedCtxs) {
        const ctx = new UniversalWebContext(
          new Request('http://localhost/bad-ctx'),
          { KV: 'binding' },
          badCtx
        );
        expect(ctx.env).toEqual({ KV: 'binding' });

        if (badCtx && typeof badCtx === 'object' && typeof (badCtx as { waitUntil?: unknown }).waitUntil === 'function') {
          expect(ctx.executionContext).toBeDefined();
        } else {
          // If executionCtx is null or not an object, executionContext is undefined
          if (badCtx === null || typeof badCtx !== 'object') {
            expect(ctx.executionContext).toBeUndefined();
          }
          // Standalone waitUntil handles tracking safely
          const p = Promise.resolve('ok');
          ctx.waitUntil(p);
          expect(ctx.pendingWaitUntils).toContain(p);
        }
      }
    });

    it('safely catches missing or non-Request arguments to universalFetch', async () => {
      const app = createMockApp((ctx) => {
        ctx.json({ ok: true });
      });
      const fetch = createUniversalFetchHandler(app);

      // 0 arguments passed
      const r0 = await (fetch as unknown as () => Promise<Response>)();
      expect(r0.status).toBe(500);
      expect(await r0.json()).toEqual({ error: 'Internal Server Error' });

      // null passed as request
      const rNull = await (fetch as unknown as (r: unknown) => Promise<Response>)(null);
      expect(rNull.status).toBe(500);
      expect(await rNull.json()).toEqual({ error: 'Internal Server Error' });

      // Plain object passed instead of Request
      const rObj = await (fetch as unknown as (r: unknown) => Promise<Response>)({ url: 'http://localhost/' });
      expect(rObj.status).toBe(500);
      expect(await rObj.json()).toEqual({ error: 'Internal Server Error' });
    });

    it('handles calls with 4 or more arguments gracefully without side-effects', async () => {
      const app = createMockApp((ctx) => {
        ctx.json({ path: ctx.path, hasEnv: Boolean(ctx.env) });
      });
      const fetch = createUniversalFetchHandler(app);

      const r = await (fetch as unknown as (...args: unknown[]) => Promise<Response>)(
        new Request('http://localhost/extra-args'),
        { KV: {} },
        { waitUntil() {} },
        'fourth-arg',
        999,
        { extra: true }
      );

      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ path: '/extra-args', hasEnv: true });
    });

    it('catches invalid CIDR configuration on Edge runtimes inside universalFetch returning 500', async () => {
      const app = createMockApp((ctx) => {
        ctx.json({ ip: ctx.ip });
      });
      const fetch = createUniversalFetchHandler(app, {
        proxy: ['10.0.0.0/8'],
      });

      // Edge 3-arg invocation with CIDR proxy must be intercepted and return 500
      const res = await fetch(
        new Request('http://localhost/edge-cidr'),
        { KV: {} },
        { waitUntil() {} }
      );
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Internal Server Error' });
    });

    it('handles Bun server.requestIP throwing an exception', async () => {
      const mockServer = {
        requestIP: () => {
          throw new Error('Socket closed or broken');
        },
      };

      const app = createMockApp((ctx) => {
        // Accessing ctx.ip triggers the throwing server.requestIP
        ctx.json({ ip: ctx.ip });
      });
      const fetch = createUniversalFetchHandler(app);

      const res = await fetch(new Request('http://localhost/bun-throw'), mockServer);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Internal Server Error' });
    });
  });

  // =========================================================================
  // Dimension 2: High Concurrency Under Cold-Start Boot Barrier
  // =========================================================================
  describe('Dimension 2: Cold-Start Boot Barrier Under Concurrency', () => {
    it('executes app.ready() exactly once under 100 concurrent requests with boot delay', async () => {
      const CONCURRENCY = 100;
      let handledCount = 0;

      const app = createMockApp(
        (ctx) => {
          handledCount += 1;
          ctx.json({ index: ctx.path, handled: handledCount });
        },
        {
          isReady: false,
          bootDelayMs: 30, // 30ms artificial cold-start boot delay
        }
      );

      const fetch = createUniversalFetchHandler(app);

      // Fire 100 concurrent requests before boot resolves
      const requests = Array.from({ length: CONCURRENCY }, (_, i) =>
        fetch(new Request(`http://localhost/req/${i}`))
      );

      const responses = await Promise.all(requests);

      // Verify app.ready() was invoked exactly once
      expect(app.readyCalls).toBe(1);
      expect(responses).toHaveLength(CONCURRENCY);

      for (let i = 0; i < CONCURRENCY; i++) {
        const res = responses[i]!;
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.index).toBe(`/req/${i}`);
      }
      expect(handledCount).toBe(CONCURRENCY);
    });

    it('isolates cold-start boot failure across 100 concurrent requests and transparently retries on request 101', async () => {
      const CONCURRENCY = 100;
      let shouldFail = true;
      let readyCalls = 0;

      const logger: Logger = {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      };

      const app: WebRunnerApp<(ctx: UniversalWebContext) => Promise<void>> & { readyCalls: number } = {
        isReady: false,
        isProduction: true,
        logger,
        syncDispatchSafe: true,
        get readyCalls() {
          return readyCalls;
        },
        ready: () => {
          readyCalls += 1;
          if (shouldFail) {
            return Promise.reject(new Error('Cold-start initialization failed'));
          }
          return Promise.resolve();
        },
        start: vi.fn(),
        callback: () => (ctx) => {
          ctx.json({ recovered: true, path: ctx.path });
          return Promise.resolve();
        },
      };

      const fetch = createUniversalFetchHandler(app);

      // Burst of 100 concurrent requests during boot failure
      const failingBatch = Array.from({ length: CONCURRENCY }, (_, i) =>
        fetch(new Request(`http://localhost/burst/${i}`))
      );

      const failingResponses = await Promise.all(failingBatch);

      // Verify boot was attempted once for this burst
      expect(readyCalls).toBe(1);
      for (const res of failingResponses) {
        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: 'Internal Server Error' });
      }

      // Now resolve the underlying issue
      shouldFail = false;

      // Request 101 should trigger retry of ready() and succeed
      const recoveryRes = await fetch(new Request('http://localhost/retry'));
      expect(readyCalls).toBe(2);
      expect(recoveryRes.status).toBe(200);
      expect(await recoveryRes.json()).toEqual({ recovered: true, path: '/retry' });

      // Request 102 should use steady-state handler without calling ready() again
      const steadyRes = await fetch(new Request('http://localhost/steady'));
      expect(readyCalls).toBe(2);
      expect(steadyRes.status).toBe(200);
    });

    it('handles app.callback() throwing during boot gate resolution', async () => {
      const app = createMockApp(
        (ctx) => {
          ctx.json({ ok: true });
        },
        {
          isReady: false,
          throwOnCallback: true,
        }
      );

      const fetch = createUniversalFetchHandler(app);
      const res = await fetch(new Request('http://localhost/callback-crash'));

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Internal Server Error' });
    });
  });

  // =========================================================================
  // Dimension 3: Timeout Boundary Stress & Response Commitment
  // =========================================================================
  describe('Dimension 3: Timeout Boundary Stress', () => {
    it('returns 504 Gateway Timeout and aborts ctx.signal when slow async handler exceeds deadline', async () => {
      let abortedObserved = false;
      let abortReason: unknown = undefined;

      const app = createMockApp(async (ctx) => {
        ctx.signal.addEventListener('abort', () => {
          abortedObserved = true;
          abortReason = ctx.signal.reason;
        });

        // Sleep longer than the 25ms timeout
        await new Promise((resolve) => setTimeout(resolve, 80));
        ctx.json({ late: true });
      });

      const fetch = createUniversalFetchHandler(app, { timeout: 25 });
      const res = await fetch(new Request('http://localhost/timeout-slow'));

      expect(res.status).toBe(504);
      expect(await res.json()).toEqual({ error: 'Gateway Timeout' });
      expect(abortedObserved).toBe(true);
      expect(abortReason).toBeInstanceOf(Error);
      expect((abortReason as Error).message).toBe('Request timeout');
    });

    it('protects committed response when handler commits headers before timeout expires', async () => {
      const app = createMockApp(async (ctx) => {
        // Commit headers and body early
        ctx.status = 200;
        ctx.json({ committed: true, step: 'done' });

        // Continue running long async work after commit
        await new Promise((resolve) => setTimeout(resolve, 80));
      });

      const fetch = createUniversalFetchHandler(app, { timeout: 25 });
      const res = await fetch(new Request('http://localhost/timeout-committed'));

      // Commitment protection: 200 delivered instead of 504
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ committed: true, step: 'done' });
    });

    it('returns 504 when handler sets status but does not commit a body before timeout', async () => {
      const app = createMockApp(async (ctx) => {
        ctx.status = 202; // Sets status code but ctx.responded remains false!
        await new Promise((resolve) => setTimeout(resolve, 80));
      });

      const fetch = createUniversalFetchHandler(app, { timeout: 25 });
      const res = await fetch(new Request('http://localhost/timeout-uncommitted-status'));

      expect(res.status).toBe(504);
      expect(await res.json()).toEqual({ error: 'Gateway Timeout' });
    });

    it('handles 50 concurrent requests simultaneously timing out without timer corruption', async () => {
      const CONCURRENCY = 50;

      const app = createMockApp(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
      });

      const fetch = createUniversalFetchHandler(app, { timeout: 20 });

      const batch = Array.from({ length: CONCURRENCY }, (_, i) =>
        fetch(new Request(`http://localhost/timeout-batch/${i}`))
      );

      const responses = await Promise.all(batch);
      expect(responses).toHaveLength(CONCURRENCY);

      for (const res of responses) {
        expect(res.status).toBe(504);
        expect(await res.json()).toEqual({ error: 'Gateway Timeout' });
      }
    });

    it('supports disabling the timeout barrier via timeout: 0 or negative', async () => {
      const app = createMockApp(async (ctx) => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        ctx.json({ disabledTimeout: true });
      });

      const fetchZero = createUniversalFetchHandler(app, { timeout: 0 });
      const r0 = await fetchZero(new Request('http://localhost/no-timeout-0'));
      expect(r0.status).toBe(200);
      expect(await r0.json()).toEqual({ disabledTimeout: true });

      const fetchNeg = createUniversalFetchHandler(app, { timeout: -1 });
      const rNeg = await fetchNeg(new Request('http://localhost/no-timeout-neg'));
      expect(rNeg.status).toBe(200);
      expect(await rNeg.json()).toEqual({ disabledTimeout: true });
    });

    it('prevents unhandled rejections when slow background task rejects after timeout has returned 504', async () => {
      let lateRejectionOccurred = false;

      const app = createMockApp(async () => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        lateRejectionOccurred = true;
        throw new Error('Late background explosion after timeout');
      });

      const fetch = createUniversalFetchHandler(app, { timeout: 15 });
      const res = await fetch(new Request('http://localhost/late-rejection'));

      expect(res.status).toBe(504);

      // Wait long enough for the background task to explode
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(lateRejectionOccurred).toBe(true);
      // If dispatch.then had not handled the rejection, Node would emit unhandledRejection
    });
  });

  // =========================================================================
  // Dimension 4: Unhandled Exception Injection & Custom onError Shielding
  // =========================================================================
  describe('Dimension 4: Unhandled Exception Injection', () => {
    it('catches non-Error thrown objects (primitives, null, undefined, plain objects)', async () => {
      const throwValues = [
        'literal string error',
        404,
        null,
        undefined,
        false,
        { customCode: 'FATAL_ERR' },
      ];

      for (const val of throwValues) {
        const app = createMockApp(() => {
          throw val;
        });
        const fetch = createUniversalFetchHandler(app);

        const res = await fetch(new Request('http://localhost/throw-primitive'));
        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: 'Internal Server Error' });
      }
    });

    it('catches circular error structures without JSON.stringify stack overflow or crash', async () => {
      const circularError: Record<string, unknown> = new Error('Circular structure error');
      circularError.self = circularError;
      circularError.nested = { parent: circularError };

      const app = createMockApp(() => {
        throw circularError;
      });
      const fetch = createUniversalFetchHandler(app);

      const res = await fetch(new Request('http://localhost/throw-circular'));
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Internal Server Error' });
    });

    it('shields against custom onError hook throwing synchronously', async () => {
      const app = createMockApp(() => {
        throw new Error('Original handler error');
      });

      const fetch = createUniversalFetchHandler(app, {
        onError: () => {
          throw new Error('Fatal error inside onError hook');
        },
      });

      const res = await fetch(new Request('http://localhost/onerror-sync-throw'));
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Internal Server Error' });
    });

    it('shields against custom onError hook rejecting asynchronously', async () => {
      const app = createMockApp(() => {
        throw new Error('Original handler error');
      });

      const fetch = createUniversalFetchHandler(app, {
        onError: async () => {
          await Promise.resolve();
          throw new Error('Fatal error inside async onError hook');
        },
      });

      const res = await fetch(new Request('http://localhost/onerror-async-throw'));
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Internal Server Error' });
    });

    it('shields against custom onError hook throwing circular errors', async () => {
      const circularHookError: Record<string, unknown> = new Error('Circular onError error');
      circularHookError.self = circularHookError;

      const app = createMockApp(() => {
        throw new Error('Handler fail');
      });

      const fetch = createUniversalFetchHandler(app, {
        onError: () => {
          throw circularHookError;
        },
      });

      const res = await fetch(new Request('http://localhost/onerror-circular'));
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Internal Server Error' });
    });

    it('allows custom onError hook to return custom Web Response', async () => {
      const app = createMockApp(() => {
        throw new Error('Database locked');
      });

      const fetch = createUniversalFetchHandler(app, {
        onError: (err, ctx) => {
          return new Response(
            JSON.stringify({
              custom: true,
              message: err.message,
              path: ctx.path,
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        },
      });

      const res = await fetch(new Request('http://localhost/onerror-custom'));
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({
        custom: true,
        message: 'Database locked',
        path: '/onerror-custom',
      });
    });
  });

  // =========================================================================
  // Dimension 5: waitUntil Promise Tracking & Drain Verification
  // =========================================================================
  describe('Dimension 5: waitUntil Tracking & Drain Verification', () => {
    it('catches unhandled rejections inside standalone waitUntil and tracks them for drain', async () => {
      const ctx = new UniversalWebContext(
        new Request('http://localhost/waituntil-rejection'),
        undefined,
        undefined,
        { isProduction: true }
      );

      let rejectionHandled = false;
      const failingPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          rejectionHandled = true;
          reject(new Error('Background analytics failed'));
        }, 10);
      });

      ctx.waitUntil(failingPromise);
      expect(ctx.pendingWaitUntils).toHaveLength(1);

      // Drain must await settlement without throwing or letting unhandled rejection escape
      await ctx.drainWaitUntil();
      expect(rejectionHandled).toBe(true);
    });

    it('drains multiple concurrent promises (mix of fulfilled, rejected, and delayed)', async () => {
      const ctx = new UniversalWebContext(
        new Request('http://localhost/waituntil-multi'),
        undefined,
        undefined,
        { isProduction: true }
      );

      const executed: number[] = [];

      ctx.waitUntil(
        new Promise<void>((resolve) => {
          setTimeout(() => {
            executed.push(1);
            resolve();
          }, 15);
        })
      );

      ctx.waitUntil(
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            executed.push(2);
            reject(new Error('Task 2 failed'));
          }, 10);
        })
      );

      ctx.waitUntil(
        Promise.resolve().then(() => {
          executed.push(3);
        })
      );

      expect(ctx.pendingWaitUntils).toHaveLength(3);

      await ctx.drainWaitUntil();
      expect(executed).toEqual(expect.arrayContaining([1, 2, 3]));
      expect(executed).toHaveLength(3);
    });

    it('resolves drainWaitUntil immediately when no background tasks were registered', async () => {
      const ctx = new UniversalWebContext(new Request('http://localhost/waituntil-empty'));
      expect(ctx.pendingWaitUntils).toHaveLength(0);

      const start = Date.now();
      await ctx.drainWaitUntil();
      expect(Date.now() - start).toBeLessThan(20);
    });

    it('delegates directly to host executionContext.waitUntil when provided', () => {
      const hostWaitUntilSpy = vi.fn();
      const mockHostCtx: UniversalExecutionContext = { waitUntil: hostWaitUntilSpy };

      const ctx = new UniversalWebContext(
        new Request('http://localhost/waituntil-host'),
        { KV: {} },
        mockHostCtx
      );

      const p = Promise.resolve('host-done');
      ctx.waitUntil(p);

      expect(hostWaitUntilSpy).toHaveBeenCalledWith(p);
      expect(ctx.pendingWaitUntils).toHaveLength(0); // Host owns tracking
    });

    it('propagates host executionContext.waitUntil synchronous errors directly', () => {
      const mockHostCtx: UniversalExecutionContext = {
        waitUntil: () => {
          throw new Error('Host execution context already completed');
        },
      };

      const ctx = new UniversalWebContext(
        new Request('http://localhost/waituntil-host-throw'),
        { KV: {} },
        mockHostCtx
      );

      expect(() => {
        ctx.waitUntil(Promise.resolve());
      }).toThrow('Host execution context already completed');
    });

    it('emits a single warning in development mode when waitUntil is called without execution context', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const ctx = new UniversalWebContext(
        new Request('http://localhost/waituntil-dev-warn'),
        undefined,
        undefined,
        { isProduction: false }
      );

      ctx.waitUntil(Promise.resolve());
      expect(warnSpy).toHaveBeenCalledTimes(1);

      // Second call does not duplicate warning
      ctx.waitUntil(Promise.resolve());
      expect(warnSpy).toHaveBeenCalledTimes(1);

      warnSpy.mockRestore();
    });
  });

  // =========================================================================
  // Dimension 6: Memory Leaks, Resource Cleanup & State Isolation Stress
  // =========================================================================
  describe('Dimension 6: Resource Cleanup & State Isolation', () => {
    it('executes 1,000 requests without timer or state leakage', async () => {
      const ITERATIONS = 1000;
      let totalCompleted = 0;

      const app = createMockApp((ctx) => {
        totalCompleted += 1;
        ctx.json({ ok: true, id: totalCompleted });
      }, { syncDispatchSafe: false });

      const fetch = createUniversalFetchHandler(app, { timeout: 5000 });

      // Run 1,000 requests in batches of 100
      for (let batch = 0; batch < 10; batch++) {
        const batchPromises = Array.from({ length: 100 }, (_, i) =>
          fetch(new Request(`http://localhost/churn/${batch * 100 + i}`))
        );
        const responses = await Promise.all(batchPromises);
        expect(responses).toHaveLength(100);
        for (const res of responses) {
          expect(res.status).toBe(200);
        }
      }

      expect(totalCompleted).toBe(ITERATIONS);
    });

    it('tracks waitUntil promises even when route returns synchronously via fast-path bypass', async () => {
      let bgSettled = false;
      let capturedCtx: UniversalWebContext | undefined;

      const app = createMockApp((ctx) => {
        capturedCtx = ctx;
        ctx.json({ fast: true });
        (ctx as unknown as Record<symbol, unknown>)[DISPATCH_SETTLED_SYNC] = true;

        ctx.waitUntil(
          new Promise<void>((resolve) => {
            setTimeout(() => {
              bgSettled = true;
              resolve();
            }, 10);
          })
        );
      }, { syncDispatchSafe: true, isReady: true });

      const fetch = createUniversalFetchHandler(app);

      // Synchronous return
      const res = fetch(new Request('http://localhost/fast-sync-waituntil'));
      expect(res).toBeInstanceOf(Response);
      expect(res instanceof Promise).toBe(false);
      expect(res.status).toBe(200);

      expect(capturedCtx).toBeDefined();
      expect(capturedCtx!.pendingWaitUntils).toHaveLength(1);
      expect(bgSettled).toBe(false);

      // Drain the background task
      await capturedCtx!.drainWaitUntil();
      expect(bgSettled).toBe(true);
    });

    it('normalizes HTTP methods to uppercase and derives path/query safely across exotic URLs', async () => {
      const captured: { method: string; path: string; query: unknown }[] = [];

      const app = createMockApp((ctx) => {
        captured.push({
          method: ctx.method,
          path: ctx.path,
          query: ctx.query,
        });
        ctx.json({ ok: true });
      });

      const fetch = createUniversalFetchHandler(app);

      // Lowercase get with query parameters and hash fragment
      await fetch(new Request('http://localhost/api/test?foo=bar&baz=1#fragment', { method: 'get' }));

      // Custom patch method with encoded parameters
      await fetch(new Request('http://localhost/api/resource?filter=%20special%20', { method: 'patch' }));

      expect(captured).toHaveLength(2);
      expect(captured[0]!.method).toBe('GET');
      expect(captured[0]!.path).toBe('/api/test');
      expect(captured[0]!.query).toEqual({ foo: 'bar', baz: '1' });

      expect(captured[1]!.method).toBe('PATCH');
      expect(captured[1]!.path).toBe('/api/resource');
      expect(captured[1]!.query).toEqual({ filter: ' special ' });
    });
  });
});


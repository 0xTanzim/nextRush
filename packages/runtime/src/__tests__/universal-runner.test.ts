import { describe, expect, it, vi } from 'vitest';
import { DISPATCH_SETTLED_SYNC, type Logger } from '@nextrush/types';
import {
  createUniversalFetchHandler,
  DEFAULT_UNIVERSAL_TIMEOUT_MS,
} from '../universal-runner';
import type { WebRunnerApp } from '../web-runner';
import { UniversalWebContext } from '../universal-context';

function createMockApp(
  dispatch: (ctx: UniversalWebContext) => Promise<void> | void,
  syncDispatchSafe = true
): WebRunnerApp<(ctx: UniversalWebContext) => Promise<void>> & { readyCalls: number } {
  let readyCalls = 0;
  const logger: Logger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };

  return {
    isReady: false,
    isProduction: true,
    logger,
    syncDispatchSafe,
    get readyCalls() {
      return readyCalls;
    },
    ready: () => {
      readyCalls += 1;
      return Promise.resolve();
    },
    start: vi.fn(),
    callback: () => (ctx: UniversalWebContext) => {
      const res = dispatch(ctx);
      return res instanceof Promise ? res : Promise.resolve();
    },
  };
}

describe('createUniversalFetchHandler', () => {
  it('exposes the standard default timeout constant of 24s', () => {
    expect(DEFAULT_UNIVERSAL_TIMEOUT_MS).toBe(24_000);
  });

  it('handles the 5 Web platform calling conventions transparently', async () => {
    const app = createMockApp((ctx) => {
      ctx.json({
        ok: true,
        path: ctx.path,
        ip: ctx.ip,
        hasEnv: Boolean(ctx.env),
        hasExecutionCtx: Boolean(ctx.executionContext),
      });
    });

    const fetch = createUniversalFetchHandler(app, { proxy: 1 });

    // 1-argument: standard fetch (Node 22+, Deno, tests)
    const r1 = await fetch(new Request('http://localhost/api/items'));
    expect(r1.status).toBe(200);
    expect(await r1.json()).toEqual({
      ok: true,
      path: '/api/items',
      ip: '',
      hasEnv: false,
      hasExecutionCtx: false,
    });

    // 3-argument: Cloudflare Workers (req, env, ctx)
    const r2 = await fetch(
      new Request('http://localhost/api/cf', {
        headers: { 'cf-connecting-ip': '203.0.113.88' },
      }),
      { KV: {} },
      { waitUntil() {} }
    );
    expect(r2.status).toBe(200);
    expect(await r2.json()).toEqual({
      ok: true,
      path: '/api/cf',
      ip: '203.0.113.88',
      hasEnv: true,
      hasExecutionCtx: true,
    });

    // 2-argument: Vercel Edge (req, ctx)
    const r3 = await fetch(
      new Request('http://localhost/api/edge'),
      { waitUntil() {} }
    );
    expect(r3.status).toBe(200);
    expect(await r3.json()).toEqual({
      ok: true,
      path: '/api/edge',
      ip: '',
      hasEnv: false,
      hasExecutionCtx: true,
    });

    // 2-argument: Bun (req, server)
    const r4 = await fetch(
      new Request('http://localhost/api/bun'),
      { requestIP: () => ({ address: '127.0.0.1' }) }
    );
    expect(r4.status).toBe(200);
    expect(await r4.json()).toEqual({
      ok: true,
      path: '/api/bun',
      ip: '127.0.0.1',
      hasEnv: false,
      hasExecutionCtx: false,
    });

    // 2-argument: Deno (req, info)
    const r5 = await fetch(
      new Request('http://localhost/api/deno'),
      { remoteAddr: { hostname: '10.1.1.1' } }
    );
    expect(r5.status).toBe(200);
    expect(await r5.json()).toEqual({
      ok: true,
      path: '/api/deno',
      ip: '10.1.1.1',
      hasEnv: false,
      hasExecutionCtx: false,
    });
  });

  describe('Deferred boot barrier', () => {
    it('defers app.ready() until the first request and runs it only once across concurrent requests', async () => {
      let bootResolve!: () => void;
      const bootDeferred = new Promise<void>((resolve) => {
        bootResolve = resolve;
      });

      const app = createMockApp((ctx) => {
        ctx.json({ booted: true });
      });

      let readyCount = 0;
      app.ready = () => {
        readyCount += 1;
        return bootDeferred;
      };

      const fetch = createUniversalFetchHandler(app);
      expect(readyCount).toBe(0);

      // Launch 5 concurrent first requests
      const p1 = fetch(new Request('http://localhost/1'));
      const p2 = fetch(new Request('http://localhost/2'));
      const p3 = fetch(new Request('http://localhost/3'));
      const p4 = fetch(new Request('http://localhost/4'));
      const p5 = fetch(new Request('http://localhost/5'));

      expect(readyCount).toBe(1);

      // Resolve boot
      bootResolve();

      const responses = await Promise.all([p1, p2, p3, p4, p5]);
      for (const res of responses) {
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ booted: true });
      }

      // Subsequent requests do not trigger app.ready() again
      const p6 = await fetch(new Request('http://localhost/6'));
      expect(p6.status).toBe(200);
      expect(readyCount).toBe(1);
    });

    it('allows boot retry when app.ready() fails on initial attempt', async () => {
      let attempts = 0;
      const app = createMockApp((ctx) => {
        ctx.json({ ok: true });
      });

      app.ready = () => {
        attempts += 1;
        if (attempts === 1) {
          return Promise.reject(new Error('Extension initialization failed'));
        }
        return Promise.resolve();
      };

      const fetch = createUniversalFetchHandler(app);

      // First request fails with 500 error envelope
      const res1 = await fetch(new Request('http://localhost/retry'));
      expect(res1.status).toBe(500);
      expect(await res1.json()).toEqual({ error: 'Internal Server Error' });

      // Second request retries app.ready() and succeeds
      const res2 = await fetch(new Request('http://localhost/retry'));
      expect(res2.status).toBe(200);
      expect(await res2.json()).toEqual({ ok: true });
      expect(attempts).toBe(2);
    });
  });

  describe('Synchronous bypass fast path', () => {
    it('returns bare Response synchronously without Promise wrap when syncDispatchSafe', () => {
      const app = createMockApp((ctx) => {
        ctx.json({ sync: true });
        (ctx as unknown as Record<symbol, unknown>)[DISPATCH_SETTLED_SYNC] = true;
      }, true);

      // Mark ready at creation so handler is resolved immediately
      (app as { isReady: boolean }).isReady = true;

      const fetch = createUniversalFetchHandler(app);
      const res = fetch(new Request('http://localhost/sync'));

      expect(res).toBeInstanceOf(Response);
      expect(typeof (res as Promise<Response>).then).toBe('undefined');
    });

    it('returns a Promise when route handler is asynchronous', async () => {
      const app = createMockApp(async (ctx) => {
        await Promise.resolve();
        ctx.json({ async: true });
      });
      (app as { isReady: boolean }).isReady = true;

      const fetch = createUniversalFetchHandler(app);
      const res = fetch(new Request('http://localhost/async'));

      expect(typeof (res as Promise<Response>).then).toBe('function');
      const response = await res;
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ async: true });
    });
  });

  describe('Timeout barrier & commitment protection', () => {
    it('times out and returns 504 Gateway Timeout when dispatch does not settle', async () => {
      let contextCaptured: UniversalWebContext | undefined;
      const app = createMockApp((ctx) => {
        contextCaptured = ctx;
        return new Promise(() => {}); // Never settles
      });

      const fetch = createUniversalFetchHandler(app, { timeout: 25 });
      const res = await fetch(new Request('http://localhost/slow'));

      expect(res.status).toBe(504);
      expect(await res.json()).toEqual({ error: 'Gateway Timeout' });
      expect(contextCaptured?.signal.aborted).toBe(true);
    });

    it('preserves committed response if response was committed before timeout deadline', async () => {
      const app = createMockApp(async (ctx) => {
        ctx.json({ committed: true });
        // Hang after committing response
        await new Promise(() => {});
      });

      const fetch = createUniversalFetchHandler(app, { timeout: 25 });
      const res = await fetch(new Request('http://localhost/committed-slow'));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ committed: true });
    });

    it('allows disabling the timeout by setting timeout: 0', async () => {
      const app = createMockApp(async (ctx) => {
        await new Promise((resolve) => setTimeout(resolve, 35));
        ctx.json({ delayed: true });
      });

      const fetch = createUniversalFetchHandler(app, { timeout: 0 });
      const res = await fetch(new Request('http://localhost/no-timeout'));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ delayed: true });
    });
  });

  describe('Error boundary & custom onError hook', () => {
    it('catches unhandled synchronous exceptions and returns 500 error envelope', async () => {
      const app = createMockApp(() => {
        throw new Error('Database connection crashed');
      });

      const fetch = createUniversalFetchHandler(app);
      const res = await fetch(new Request('http://localhost/crash'));

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Internal Server Error' });
    });

    it('catches unhandled asynchronous rejections and returns 500 error envelope', async () => {
      const app = createMockApp(async () => {
        await Promise.resolve();
        throw new Error('Async processing failed');
      });

      const fetch = createUniversalFetchHandler(app);
      const res = await fetch(new Request('http://localhost/async-crash'));

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Internal Server Error' });
    });

    it('delegates to custom onError handler returning custom response', async () => {
      const app = createMockApp(() => {
        throw new Error('Entity not found');
      });

      const fetch = createUniversalFetchHandler(app, {
        onError: (err, ctx) => {
          return new Response(JSON.stringify({ customError: err.message, path: ctx.path }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        },
      });

      const res = await fetch(new Request('http://localhost/missing'));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ customError: 'Entity not found', path: '/missing' });
    });

    it('shields against custom onError handler throwing synchronously', async () => {
      const app = createMockApp(() => {
        throw new Error('Initial error');
      });

      const fetch = createUniversalFetchHandler(app, {
        onError: () => {
          throw new Error('Error inside onError hook');
        },
      });

      const res = await fetch(new Request('http://localhost/nested-crash'));
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Internal Server Error' });
    });

    it('shields against custom onError handler rejecting asynchronously', async () => {
      const app = createMockApp(() => {
        throw new Error('Initial error');
      });

      const fetch = createUniversalFetchHandler(app, {
        onError: async () => {
          await Promise.resolve();
          throw new Error('Async error inside onError hook');
        },
      });

      const res = await fetch(new Request('http://localhost/nested-async-crash'));
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Internal Server Error' });
    });

    it('handles context construction failure (e.g. invalid CIDR proxy on edge)', async () => {
      const app = createMockApp((ctx) => {
        ctx.json({ ok: true });
      });

      const fetch = createUniversalFetchHandler(app, {
        proxy: ['10.0.0.1'], // CIDR proxy trust
      });

      // Passing 3 arguments simulates EdgeHeaders mode with CIDR proxy trust, which throws in constructor
      const res = await fetch(
        new Request('http://localhost/cidr-fail'),
        { KV: {} },
        { waitUntil() {} }
      );

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Internal Server Error' });
    });
  });

  describe('Implicit 404 handler', () => {
    it('returns 404 JSON envelope if route produces no response', async () => {
      const app = createMockApp((_ctx) => {
        // Did not call ctx.json or ctx.send, default status is 404 when unhandled
        _ctx.status = 404;
      });

      const fetch = createUniversalFetchHandler(app);
      const res = await fetch(new Request('http://localhost/unhandled'));

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'Not Found' });
    });
  });
});

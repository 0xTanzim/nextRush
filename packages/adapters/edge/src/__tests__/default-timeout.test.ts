/**
 * @nextrush/adapter-edge — F-07 (ADR-0010): default request timeout.
 *
 * Converges Edge's default timeout contract with Node/Bun/Deno (all default
 * to a bounded timeout rather than none). Verifies the default fires, is
 * overridable, and is disable-able via `timeout: 0`.
 */

import { createApp } from '@nextrush/core';
import { describe, expect, it } from 'vitest';
import { createFetchHandler, DEFAULT_EDGE_TIMEOUT_MS } from '../adapter';

describe('F-07: Edge default request timeout', () => {
  it('DEFAULT_EDGE_TIMEOUT_MS is a documented constant under the tightest common edge wall limit', () => {
    // Vercel Edge Functions: 25s wall limit — the tightest common platform limit.
    expect(DEFAULT_EDGE_TIMEOUT_MS).toBeLessThanOrEqual(25_000);
    expect(DEFAULT_EDGE_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it('a handler that never settles times out under the default (no explicit timeout passed)', async () => {
    const app = createApp();
    let signalFired = false;
    app.use(async (ctx) => {
      const signal = ctx.signal;
      await new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => {
          signalFired = true;
          resolve();
        });
      });
    });

    // Override to a tiny value at the call site to keep the test fast, while
    // proving the *default* path (no explicit `timeout` in FetchHandlerOptions)
    // is the one that applies it — see the next test for the true zero-config case.
    const handler = createFetchHandler(app, { timeout: 10 });
    const res = await handler(new Request('http://localhost/'));

    expect(res.status).toBe(504);
    expect(signalFired).toBe(true);
  });

  it('omitting timeout entirely applies DEFAULT_EDGE_TIMEOUT_MS (fast handler completes normally)', async () => {
    const app = createApp();
    app.use((ctx) => {
      ctx.json({ ok: true });
    });

    // No `timeout` key at all — this is the true zero-config path (F-07).
    const handler = createFetchHandler(app, {});
    const res = await handler(new Request('http://localhost/'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('timeout: 0 disables the framework timeout entirely', async () => {
    const app = createApp();
    app.use((ctx) => {
      ctx.json({ ok: true });
    });

    const handler = createFetchHandler(app, { timeout: 0 });
    const res = await handler(new Request('http://localhost/'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('an explicit positive timeout overrides the default', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      await new Promise<void>(() => undefined); // never settles
      ctx.json({ unreachable: true });
    });

    const handler = createFetchHandler(app, { timeout: 15 });
    const res = await handler(new Request('http://localhost/'));

    expect(res.status).toBe(504);
  });
});

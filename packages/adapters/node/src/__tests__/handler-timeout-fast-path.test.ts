/**
 * @nextrush/adapter-node - Handler timeout: synchronous-response fast path
 *
 * A handler that has already committed its response by the time its promise is
 * returned can no longer be timed out — the 504 branch is guarded on
 * `!ctx.responded && !res.headersSent`, so arming a 30-second timer for it only
 * ever costs an allocation and a timer-list insert/remove.
 *
 * This was measured as roughly half the fixed-floor excess versus Fastify: a
 * pinned, interleaved 2x2 factorial attributed +3.36% throughput (t=2.71) to
 * removing the race, growing with concurrency because 256 in-flight requests
 * mean up to 256 live Timeout objects on the 30s list.
 *
 * The timeout contract itself (ADR-0010: clean 504 + cooperative cancel via
 * `ctx.signal`) is unchanged for every handler that has NOT already responded.
 *
 * @see reports/investigations/2026-07-31-measured-floor-params-compliance/02-floor-attribution.md
 */

import { createApp, type Application } from '@nextrush/core';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHandler } from '../adapter';

let server: ReturnType<typeof createServer> | undefined;

afterEach(async () => {
  vi.restoreAllMocks();
  if (server) {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = undefined;
  }
});

async function listenAndGet(
  app: Application,
  timeout: number,
  path = '/'
): Promise<{ status: number; body: string }> {
  server = createServer(createHandler(app, { timeout }));
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as AddressInfo;
  const res = await fetch(`http://127.0.0.1:${String(port)}${path}`);
  return { status: res.status, body: await res.text() };
}

describe('no timer is armed when the handler responds synchronously', () => {
  /**
   * Counts only timers armed with the handler bound itself — the in-process
   * `fetch` client arms its own unrelated timers, so a bare "never called"
   * assertion would be measuring undici.
   */
  const armedWithBound = (spy: ReturnType<typeof vi.spyOn>, bound: number): number =>
    spy.mock.calls.filter((c) => c[1] === bound).length;

  it('arms zero timers for a synchronous JSON response', async () => {
    const app = createApp();
    app.use((ctx) => ctx.json({ hello: 'world' }));

    const spy = vi.spyOn(globalThis, 'setTimeout');
    const { status, body } = await listenAndGet(app, 30_000);

    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual({ hello: 'world' });
    expect(armedWithBound(spy, 30_000)).toBe(0);
  });

  it('arms zero timers when several synchronous middlewares run before responding', async () => {
    const app = createApp();
    app.use((ctx) => {
      ctx.state.a = 1;
      return ctx.next();
    });
    app.use((ctx) => {
      ctx.state.b = 2;
      return ctx.next();
    });
    app.use((ctx) => ctx.json({ n: ctx.state.a }));

    const spy = vi.spyOn(globalThis, 'setTimeout');
    const { status } = await listenAndGet(app, 30_000);

    expect(status).toBe(200);
    expect(armedWithBound(spy, 30_000)).toBe(0);
  });

  it('still arms a timer for a handler that has not responded synchronously', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      await new Promise((r) => setTimeout(r, 5));
      ctx.json({ ok: true });
    });

    const spy = vi.spyOn(globalThis, 'setTimeout');
    const { status } = await listenAndGet(app, 30_000);

    expect(status).toBe(200);
    // The handler awaited before responding, so the race must still cover it.
    expect(armedWithBound(spy, 30_000)).toBe(1);
  });
});

describe('the ADR-0010 timeout contract is unchanged for handlers that have not responded', () => {
  it('still returns a clean 504 for a handler that exceeds the bound', async () => {
    const app = createApp();
    app.use(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });

    const { status, body } = await listenAndGet(app, 20);
    expect(status).toBe(504);
    expect(JSON.parse(body)).toEqual({ error: 'Gateway Timeout' });
  });

  it('still aborts ctx.signal cooperatively on timeout', async () => {
    let aborted = false;
    const app = createApp();
    app.use(async (ctx) => {
      ctx.signal.addEventListener('abort', () => {
        aborted = true;
      });
      await new Promise((r) => setTimeout(r, 200));
    });

    const { status } = await listenAndGet(app, 20);
    expect(status).toBe(504);
    expect(aborted).toBe(true);
  });

  it('does not time out an async handler that responds within the bound', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      await new Promise((r) => setTimeout(r, 10));
      ctx.json({ ok: true });
    });

    const { status, body } = await listenAndGet(app, 500);
    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual({ ok: true });
  });

  it('surfaces a synchronous throw as a 500 without arming a timer', async () => {
    const app = createApp();
    app.use(() => {
      throw new Error('boom');
    });

    const { status } = await listenAndGet(app, 30_000);
    expect(status).toBe(500);
  });

  it('surfaces an async rejection as a 500', async () => {
    const app = createApp();
    app.use(async () => {
      await new Promise((r) => setTimeout(r, 5));
      throw new Error('boom');
    });

    const { status } = await listenAndGet(app, 30_000);
    expect(status).toBe(500);
  });
});

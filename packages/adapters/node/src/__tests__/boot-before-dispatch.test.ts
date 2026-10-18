/**
 * @nextrush/adapter-node — the entry point boots before it dispatches.
 *
 * @remarks
 * `createHandler(app)` is the node seam for building a server by hand
 * (`createServer(createHandler(app))`), and it used to snapshot the middleware
 * stack at construction time. Anything boot contributes — the application's own
 * router and extension-registered middleware — was therefore missing, so every
 * declared route answered an empty 200. Driven over a real socket: a boot that
 * never happens is only observable by the client.
 */

import { createApp, type Application } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import type { ExtensionContext } from '@nextrush/types';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHandler } from '../adapter';

let server: ReturnType<typeof createServer> | undefined;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = undefined;
  }
});

/** Server built with no explicit `app.ready()`, exactly as a hand-rolled setup would. */
async function startServer(app: Application): Promise<string> {
  server = createServer(createHandler(app, { timeout: 0 }));
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${String(port)}`;
}

async function get(base: string, path = '/'): Promise<{ status: number; body: string }> {
  const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(5_000) });
  return { status: res.status, body: await res.text() };
}

/** An application with one declared route and no prior `ready()`. */
function appWithDeclaredRoute(): { app: Application; ready: ReturnType<typeof vi.spyOn> } {
  const app = createApp({ router: createRouter() });
  app.get('/', (ctx) => {
    ctx.json({ ok: 1 });
  });
  // Observes the real boot without replacing it.
  return { app, ready: vi.spyOn(app, 'ready') };
}

/** An application whose only responder comes from an extension — that is, from boot. */
function appWithBootRoute(): { app: Application; setup: ReturnType<typeof vi.fn> } {
  const app = createApp();
  const setup = vi.fn((ctx: ExtensionContext) => {
    ctx.app.use((c) => {
      c.json({ booted: true });
    });
  });
  app.extend({ name: 'boot-route', setup });
  return { app, setup };
}

describe('node createHandler without an explicit ready()', () => {
  it('routes a declared route on the first request', async () => {
    const { app, ready } = appWithDeclaredRoute();
    const base = await startServer(app);

    const res = await get(base);

    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: 1 });
    expect(ready).toHaveBeenCalledTimes(1);
  });

  it('answers 404, not an empty response, for an unknown path', async () => {
    const { app } = appWithDeclaredRoute();
    const base = await startServer(app);

    const res = await get(base, '/missing');

    expect(res.status).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ error: 'Not Found' });
  });

  it('shares one boot across concurrent first requests', async () => {
    const { app, ready } = appWithDeclaredRoute();
    const base = await startServer(app);

    const responses = await Promise.all([get(base), get(base), get(base)]);

    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(ready).toHaveBeenCalledTimes(1);
  });

  it('boots once for a sequence of requests', async () => {
    const { app, ready } = appWithDeclaredRoute();
    const base = await startServer(app);

    for (let i = 0; i < 5; i++) {
      await get(base);
    }

    expect(ready).toHaveBeenCalledTimes(1);
  });

  it('runs extension setup exactly once, before the first response', async () => {
    const { app, setup } = appWithBootRoute();
    const base = await startServer(app);

    const res = await get(base);

    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ booted: true });
    expect(setup).toHaveBeenCalledTimes(1);
  });

  it('does not re-enter the boot path on later requests', async () => {
    const { app } = appWithDeclaredRoute();
    const base = await startServer(app);

    expect((await get(base)).status).toBe(200);

    // A second boot attempt would reject; a steady-state request must not make one.
    vi.spyOn(app, 'ready').mockRejectedValue(new Error('ready() must not be called again'));

    expect((await get(base)).status).toBe(200);
  });

  it('answers a failed boot with a 500 instead of an unhandled rejection', async () => {
    const app = createApp();
    app.extend({
      name: 'broken',
      setup: () => {
        throw new Error('extension setup exploded');
      },
    });
    const base = await startServer(app);

    const first = await get(base);
    const second = await get(base);

    expect([first.status, second.status]).toEqual([500, 500]);
    expect(JSON.parse(first.body)).toEqual({ error: 'Internal Server Error' });
  });

  it('leaves the running state to the server lifecycle', async () => {
    const { app } = appWithDeclaredRoute();
    const base = await startServer(app);

    await get(base);

    expect(app.isRunning).toBe(false);
  });
});

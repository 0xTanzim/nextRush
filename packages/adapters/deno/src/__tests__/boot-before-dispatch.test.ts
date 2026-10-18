/**
 * @nextrush/adapter-deno — the entry point boots before it dispatches.
 *
 * @remarks
 * `Deno.serve({ handler: createHandler(app) })` is the documented Web form with
 * no explicit boot, but `createHandler` used to snapshot the middleware stack at
 * construction time. Anything boot contributes — the application's own router
 * and extension-registered middleware — was therefore missing, so every declared
 * route answered an empty 200. These tests drive the handler directly, without a
 * prior `ready()`, and assert both halves: the request routes, and boot happens
 * exactly once, on the first request only.
 */

import { createApp, type Application } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import type { ExtensionContext } from '@nextrush/types';
import { describe, expect, it, vi } from 'vitest';
import { createHandler } from '../adapter';

const info = { remoteAddr: { hostname: '127.0.0.1', port: 1234 } };

function makeRequest(path = '/'): Request {
  return new Request(`http://localhost${path}`);
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

describe('deno createHandler without an explicit ready()', () => {
  it('routes a declared route on the first request', async () => {
    const { app, ready } = appWithDeclaredRoute();
    const handler = createHandler(app, { timeout: 0 });

    const res = await handler(makeRequest(), info);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: 1 });
    expect(ready).toHaveBeenCalledTimes(1);
  });

  it('answers 404, not an empty response, for an unknown path', async () => {
    const { app } = appWithDeclaredRoute();
    const handler = createHandler(app, { timeout: 0 });

    const res = await handler(makeRequest('/missing'), info);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not Found' });
  });

  it('shares one boot across concurrent first requests', async () => {
    const { app, ready } = appWithDeclaredRoute();
    const handler = createHandler(app, { timeout: 0 });

    const responses = await Promise.all([
      handler(makeRequest(), info),
      handler(makeRequest(), info),
      handler(makeRequest(), info),
    ]);

    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(ready).toHaveBeenCalledTimes(1);
  });

  it('boots once for a sequence of requests', async () => {
    const { app, ready } = appWithDeclaredRoute();
    const handler = createHandler(app, { timeout: 0 });

    for (let i = 0; i < 5; i++) {
      await handler(makeRequest(), info);
    }

    expect(ready).toHaveBeenCalledTimes(1);
  });

  it('runs extension setup exactly once, before the first response', async () => {
    const { app, setup } = appWithBootRoute();
    const handler = createHandler(app, { timeout: 0 });

    const res = await handler(makeRequest(), info);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ booted: true });
    expect(setup).toHaveBeenCalledTimes(1);
  });

  it('does not re-enter the boot path on later requests', async () => {
    const { app } = appWithDeclaredRoute();
    const handler = createHandler(app, { timeout: 0 });

    expect((await handler(makeRequest(), info)).status).toBe(200);

    // A second boot attempt would reject; a steady-state request must not make one.
    vi.spyOn(app, 'ready').mockRejectedValue(new Error('ready() must not be called again'));

    expect((await handler(makeRequest(), info)).status).toBe(200);
  });

  it('answers a failed boot with a 500 instead of an unhandled rejection', async () => {
    const app = createApp();
    app.extend({
      name: 'broken',
      setup: () => {
        throw new Error('extension setup exploded');
      },
    });
    const handler = createHandler(app, { timeout: 0 });

    const first = await handler(makeRequest(), info);
    const second = await handler(makeRequest(), info);

    expect([first.status, second.status]).toEqual([500, 500]);
    expect(await first.json()).toEqual({ error: 'Internal Server Error' });
  });

  it('leaves the running state to the server lifecycle', async () => {
    const { app } = appWithDeclaredRoute();
    const handler = createHandler(app, { timeout: 0 });

    await handler(makeRequest(), info);

    expect(app.isRunning).toBe(false);
  });
});

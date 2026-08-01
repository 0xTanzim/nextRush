/**
 * Unit: explicit TCP accept-queue backlog on `serve()` (router-highload-harness-fixes).
 *
 * `report/router-highload-saturation-findings.md` found `serve()` calls
 * `server.listen(port, host, cb)` with no `backlog` argument, so Node defaults to 511 —
 * a plausible bottleneck under a connection burst well before the server's CPU is
 * stressed. This suite pins two things: (1) `serve()` now passes an explicit backlog
 * argument to the underlying `net.Server#listen`, greater than Node's 511 default, and
 * (2) request-serving behavior for an accepted connection is completely unaffected —
 * the backlog only changes how many *pending* connections may queue, never per-request
 * behavior.
 *
 * `listen(port, host, backlog, cb)` is the 4-arg overload of `net.Server#listen` we
 * assert against — spying on the real `net.Server.prototype.listen` method (not a
 * private/internal field) is the correct probe here: it's asserting the exact argument
 * NextRush passes to a stable Node.js public API, not an implementation detail.
 */

import { createApp, type Application } from '@nextrush/core';
import { Server } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { serve, type ServerInstance } from '../adapter';

let instance: ServerInstance | undefined;

afterEach(async () => {
  if (instance) {
    await instance.close();
    instance = undefined;
  }
  vi.restoreAllMocks();
});

describe('serve() — TCP accept-queue backlog', () => {
  it('passes an explicit backlog greater than Node’s 511 default to server.listen()', async () => {
    const listenSpy = vi.spyOn(Server.prototype, 'listen');

    const app = createApp();
    instance = await serve(app, { port: 0 });

    // net.Server#listen has several overloads; NextRush's call is
    // listen(port, host, backlog, callback) — assert the 3rd positional arg (backlog).
    expect(listenSpy).toHaveBeenCalledTimes(1);
    const args = listenSpy.mock.calls[0];
    expect(args).toBeDefined();
    const backlogArg = args?.[2];
    expect(typeof backlogArg).toBe('number');
    expect(backlogArg as number).toBeGreaterThan(511);
  });

  it('serves requests identically regardless of the configured backlog', async () => {
    const app = createApp();
    app.use((ctx) => {
      ctx.json({ ok: true });
    });

    instance = await serve(app, { port: 0 });
    const { port } = instance;

    const res = await fetch(`http://localhost:${port}/`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

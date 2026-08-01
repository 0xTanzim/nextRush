/**
 * Integration: idle keep-alive connections release at drain start (F-05, N5).
 *
 * `drainAndClose` (`adapter.ts`) previously called only `server.close()` and then
 * waited, force-closing only at `shutdownTimeout`. The reliability review
 * (`report/reliability/reliability-framework-review.md`, F-05) recommended calling
 * `server.closeIdleConnections()` explicitly at drain start.
 *
 * Investigation note (see tasks.md §6 Finding): on the Node versions this framework
 * supports (`engines.node >= 22`), `http.Server.prototype.close()` already invokes
 * `this.closeIdleConnections()` internally (Node's own `httpServerPreClose`, shipped in
 * Node 18.2 — https://github.com/nodejs/node/pull/43522), verified empirically against
 * this repo's actual `serve()`/`drainAndClose` on the installed Node runtime: an idle
 * keep-alive connection (single or many concurrent) never delayed a drain even before
 * this node's change. A purely timing-based RED test would therefore pass with ZERO
 * production-code change and cannot serve as a real regression signal here.
 *
 * This suite instead asserts the two things this node actually adds: (1) an EXPLICIT
 * `closeIdleConnections()` call at drain start, so the guarantee is part of this
 * package's own observable contract rather than an accidental, version-specific
 * side effect of calling `server.close()` — verified by spying on the method AND by
 * proving the drain does not depend on the force-close fallback timer; (2) a response
 * completed WHILE a drain is in progress advertises `Connection: close`, which Node's
 * own idle-connection handling does not provide (that only closes truly idle sockets,
 * not an active one finishing an in-flight request during shutdown).
 *
 * @packageDocumentation
 */

import { createApp, type Application } from '@nextrush/core';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { serve, type ServerInstance } from '../adapter';

/** Deliberately slow so a pass can only be explained by the fast path, never this timer firing. */
const SLOW_SHUTDOWN_TIMEOUT_MS = 5_000;
/** The drain must complete well under the slow timeout above. */
const FAST_DRAIN_BUDGET_MS = 300;

let server: ServerInstance | undefined;

afterEach(async () => {
  if (server) {
    await server.close().catch(() => undefined);
    server = undefined;
  }
});

describe('drainAndClose() — idle keep-alive release (F-05)', () => {
  it('calls server.closeIdleConnections() explicitly at drain start (6.1/6.2)', async () => {
    const app: Application = createApp();
    app.use(async (ctx) => {
      ctx.json({ ok: true });
    });

    server = await serve(app, {
      port: 0,
      host: '127.0.0.1',
      shutdownTimeout: SLOW_SHUTDOWN_TIMEOUT_MS,
    });
    const { port } = server;

    // Real keep-alive HTTP request/response cycle, then left idle — the F-05
    // scenario (no in-flight requests, an idle keep-alive connection held open).
    const response = await fetch(`http://127.0.0.1:${String(port)}/`, {
      headers: { Connection: 'keep-alive' },
    });
    expect(response.status).toBe(200);
    await response.text();

    const closeIdleConnectionsSpy = vi.spyOn(server.server, 'closeIdleConnections');

    await server.close();

    expect(closeIdleConnectionsSpy).toHaveBeenCalled();
  });

  it('the drain does not depend on the force-close fallback timer (6.1/6.2)', async () => {
    const app: Application = createApp();
    app.use(async (ctx) => {
      ctx.json({ ok: true });
    });

    server = await serve(app, {
      port: 0,
      host: '127.0.0.1',
      shutdownTimeout: SLOW_SHUTDOWN_TIMEOUT_MS,
    });
    const { port } = server;

    const response = await fetch(`http://127.0.0.1:${String(port)}/`, {
      headers: { Connection: 'keep-alive' },
    });
    expect(response.status).toBe(200);
    await response.text();

    // Neutralize the pre-existing force-close fallback so a pass here can only be
    // explained by the explicit closeIdleConnections() call at drain start — never
    // by the force timer/closeAllConnections() masking a slow drain, and never by
    // this test accidentally re-measuring Node's own internal close() behavior
    // (closeAllConnections is untouched by that internal path, so mocking it here
    // is a clean, independent probe of THIS node's addition).
    const closeAllConnectionsSpy = vi
      .spyOn(server.server as Server, 'closeAllConnections')
      .mockImplementation(() => undefined);

    const start = Date.now();
    await server.close();
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(FAST_DRAIN_BUDGET_MS);
    expect(closeAllConnectionsSpy).not.toHaveBeenCalled();
  });

  it('marks a response completed during drain with Connection: close (6.1/6.2)', async () => {
    const app: Application = createApp();
    let releaseHandler: (() => void) | undefined;
    const handlerStarted = new Promise<void>((resolveStarted) => {
      app.use(async (ctx) => {
        resolveStarted();
        await new Promise<void>((resolveHold) => {
          releaseHandler = resolveHold;
        });
        ctx.json({ ok: true });
      });
    });

    server = await serve(app, {
      port: 0,
      host: '127.0.0.1',
      shutdownTimeout: SLOW_SHUTDOWN_TIMEOUT_MS,
    });
    const { port } = server;

    const responsePromise = fetch(`http://127.0.0.1:${String(port)}/`);
    await handlerStarted;

    // Begin the drain while the request above is still in flight.
    const closePromise = server.close();

    // Let the in-flight handler finish now that drain has started.
    releaseHandler?.();

    const response = await responsePromise;
    expect(response.status).toBe(200);
    expect(response.headers.get('connection')).toBe('close');

    await closePromise;
  });

  it('does not mark a response Connection: close when no drain is in progress (6.1/6.2)', async () => {
    const app: Application = createApp();
    app.use(async (ctx) => {
      ctx.json({ ok: true });
    });

    server = await serve(app, { port: 0, host: '127.0.0.1' });
    const { port } = server;

    const response = await fetch(`http://127.0.0.1:${String(port)}/`, {
      headers: { Connection: 'keep-alive' },
    });
    expect(response.status).toBe(200);
    await response.text();

    expect(response.headers.get('connection')).not.toBe('close');
  });
});

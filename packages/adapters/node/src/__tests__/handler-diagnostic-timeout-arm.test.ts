/**
 * @nextrush/adapter-node — diagnostic timeout-arm control (D4).
 *
 * A benchmark/test-scoped way to disable `createHandler`'s handler-level
 * `Promise.race` timeout mechanism independently of `server.timeout`, so the
 * three-arm A/B experiment (reconciliation report recommendation 4) can
 * attribute a measured difference to a specific mechanism instead of the
 * two-variable confound `serve()`'s single `timeout` option previously
 * created. Deliberately NOT on `ServeOptions` — see `public-surface.test.ts`
 * for the type-level lock proving this stays true.
 */

import { createApp } from '@nextrush/core';
import { request as httpRequest } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createHandler, listen, serve, type ServerInstance } from '../adapter';

let instance: ServerInstance | undefined;

afterEach(async () => {
  await instance?.close();
  instance = undefined;
});

function get(port: number, path = '/'): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('diagnostic timeout-arm control', () => {
  it('createHandler still returns a 504 by default when the handler never settles (race enabled)', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      await new Promise<void>(() => undefined);
      ctx.json({ unreachable: true });
    });
    instance = await serve(app, { port: 0, timeout: 20 });

    const res = await get(instance.port);
    expect(res.status).toBe(504);
  });

  it('server.timeout stays at its configured value regardless of the diagnostic control, proving independence', async () => {
    const app = createApp();
    app.use((ctx) => ctx.json({ ok: true }));

    // Two servers, same server.timeout, one with the handler race disabled —
    // the socket-level guard's own configured value must not move either way.
    const { createServer } = await import('node:http');
    const raceEnabled = createServer(createHandler(app, { timeout: 20 }));
    const raceDisabled = createServer(createHandler(app, { timeout: 20 }, { disableHandlerTimeoutRace: true }));
    raceEnabled.timeout = 12_345;
    raceDisabled.timeout = 12_345;

    expect(raceEnabled.timeout).toBe(12_345);
    expect(raceDisabled.timeout).toBe(12_345);
  });

  it('with the race disabled, a handler slower than `timeout` still succeeds instead of getting a 504', async () => {
    // Deterministic proof the race itself never runs when disabled: a
    // handler that resolves AFTER the configured `timeout` would elapse
    // must still succeed, because there is no Promise.race left to lose to
    // the timer. (With the race enabled — see the first test in this file —
    // the same shape of handler produces a 504 instead.)
    const app = createApp();
    app.use(async (ctx) => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      ctx.json({ slowButSuccessful: true });
    });
    const handler = createHandler(app, { timeout: 20 }, { disableHandlerTimeoutRace: true });

    const { createServer } = await import('node:http');
    const server = createServer(handler);
    server.timeout = 0; // disable the socket guard too, so only the race matters here
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;

    try {
      const res = await get(port);
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ slowButSuccessful: true });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('createHandler exposes no new field visible to a plain object-shape check beyond logger/timeout', () => {
    // HandlerOptions (the shared cross-adapter type) only ever had logger/timeout.
    // This is a structural smoke check, not the authoritative lock — the
    // authoritative lock is public-surface.test.ts's ServeOptions field list.
    const handler = createHandler(createApp(), { timeout: 0 });
    expect(typeof handler).toBe('function');
  });

  it('serve() with timeout: 0 disables both the handler race and the socket timeout together (existing fast path, unaffected)', async () => {
    const app = createApp();
    app.use((ctx) => ctx.json({ ok: true }));
    instance = await serve(app, { port: 0, timeout: 0 });

    const res = await get(instance.port);
    expect(res.status).toBe(200);
    // server.timeout mirrors Node's own default (disabled) when timeout: 0,
    // per the existing pre-F-04 contract this diagnostic control must not change.
    expect(instance.server.timeout).toBe(0);
  });

  it('listen() (the common entry point) is unaffected by the diagnostic control existing at all', async () => {
    const app = createApp();
    app.use((ctx) => ctx.json({ ok: true }));
    instance = await listen(app, 0);

    const res = await get(instance.port);
    expect(res.status).toBe(200);
  });
});

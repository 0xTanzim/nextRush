/**
 * @nextrush/adapter-bun - Adapter behavior tests
 *
 * Regression guards for:
 *  - F-02: headers set via ctx.set() survive an implicit/empty (and 404) response.
 *  - F-07: the exported createHandler honors `timeout` (parity with serve()).
 *  - F-08: a timeout aborts ctx.signal so the handler can stop cooperatively.
 */

import { createApp } from '@nextrush/core';
import { ServerStartError } from '@nextrush/runtime';
import { describe, expect, it } from 'vitest';
import { createHandler, serve } from '../adapter';

/** Minimal stand-in for the Bun server object (only requestIP is used). */
function fakeBunServer(): ReturnType<typeof import('bun').serve> {
  return { requestIP: () => ({ address: '127.0.0.1' }) } as unknown as ReturnType<
    typeof import('bun').serve
  >;
}

describe('bun adapter — F-02 header preservation', () => {
  it('keeps ctx.set() headers on an empty (no body method) response', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      ctx.set('X-Custom', 'kept');
      ctx.status = 204;
    });
    const handler = createHandler(app, { timeout: 0 });

    const res = await handler(new Request('http://localhost/'), fakeBunServer());
    expect(res.status).toBe(204);
    expect(res.headers.get('X-Custom')).toBe('kept');
  });

  it('keeps ctx.set() headers on the default 404 response', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      ctx.set('X-Trace', 'abc');
      ctx.status = 404;
    });
    const handler = createHandler(app, { timeout: 0 });

    const res = await handler(new Request('http://localhost/missing'), fakeBunServer());
    expect(res.status).toBe(404);
    expect(res.headers.get('X-Trace')).toBe('abc');
  });
});

describe('bun adapter — F-07/F-08 timeout', () => {
  it('createHandler honors timeout and returns 504', async () => {
    const app = createApp();
    app.use(
      async () =>
        new Promise<void>(() => {
          /* never resolves */
        })
    );
    const handler = createHandler(app, { timeout: 20 });

    const res = await handler(new Request('http://localhost/'), fakeBunServer());
    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({ error: 'Gateway Timeout' });
  });

  it('aborts ctx.signal on timeout so the handler can stop', async () => {
    const app = createApp();
    let aborted = false;
    app.use(
      (ctx) =>
        new Promise<void>((resolve) => {
          ctx.signal.addEventListener('abort', () => {
            aborted = true;
            resolve();
          });
        })
    );
    const handler = createHandler(app, { timeout: 20 });

    const res = await handler(new Request('http://localhost/'), fakeBunServer());
    expect(res.status).toBe(504);
    // Give the microtask queue a tick for the abort listener to fire.
    await new Promise((r) => setTimeout(r, 5));
    expect(aborted).toBe(true);
  });
});

describe('bun adapter — single-argument handler dispatch & runtime guarding', () => {
  it('allows handler(request) execution without requiring a second dummy server argument', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      ctx.json({ ok: true });
    });
    const handler = createHandler(app);

    // Call with ONLY 1 argument — no dummyServer required!
    const res = await handler(new Request('http://localhost/ping'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('throws ServerStartError with code ERR_RUNTIME_NOT_DETECTED when serve() is called outside Bun', async () => {
    const app = createApp();

    await expect(serve(app, { port: 8080 })).rejects.toThrowError(ServerStartError);

    try {
      await serve(app, { port: 8080 });
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ServerStartError);
      const serverErr = err as ServerStartError;
      expect(serverErr.code).toBe('ERR_RUNTIME_NOT_DETECTED');
      expect(serverErr.message).toContain('[@nextrush/adapter-bun] Bun runtime not detected');
      expect(serverErr.message).toContain('@nextrush/adapter-node');
    }
  });
});

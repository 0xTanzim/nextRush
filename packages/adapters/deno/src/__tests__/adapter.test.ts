/**
 * @nextrush/adapter-deno - Adapter behavior tests
 *
 * Regression guards for:
 *  - F-02: headers set via ctx.set() survive an implicit/empty (and 404) response.
 *  - F-08: a timeout returns 504 and aborts ctx.signal.
 */

import { createApp } from '@nextrush/core';
import { ServerStartError } from '@nextrush/runtime';
import { describe, expect, it } from 'vitest';
import { createHandler, serve } from '../adapter';

const info = { remoteAddr: { hostname: '127.0.0.1', port: 1234 } };

describe('deno adapter — F-02 header preservation', () => {
  it('keeps ctx.set() headers on an empty (no body method) response', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      ctx.set('X-Custom', 'kept');
      ctx.status = 204;
    });
    const handler = createHandler(app, { timeout: 0 });

    const res = await handler(new Request('http://localhost/'), info);
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

    const res = await handler(new Request('http://localhost/missing'), info);
    expect(res.status).toBe(404);
    expect(res.headers.get('X-Trace')).toBe('abc');
  });
});

describe('deno adapter — F-08 timeout', () => {
  it('returns 504 and aborts ctx.signal on timeout', async () => {
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

    const res = await handler(new Request('http://localhost/'), info);
    expect(res.status).toBe(504);
    await new Promise((r) => setTimeout(r, 5));
    expect(aborted).toBe(true);
  });
});

describe('deno adapter — runtime guarding and ergonomics', () => {
  it('throws ServerStartError with ERR_RUNTIME_NOT_DETECTED when serve() is called in non-Deno runtime', async () => {
    const originalDeno = (globalThis as unknown as { Deno?: unknown }).Deno;
    try {
      // Ensure Deno is absent in the test execution environment
      delete (globalThis as unknown as { Deno?: unknown }).Deno;

      const app = createApp();
      await expect(serve(app, { port: 0 })).rejects.toThrow(ServerStartError);

      try {
        await serve(app, { port: 0 });
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ServerStartError);
        const serverError = err as ServerStartError;
        expect(serverError.code).toBe('ERR_RUNTIME_NOT_DETECTED');
        expect(serverError.message).toContain('Deno runtime not detected');
      }
    } finally {
      if (originalDeno !== undefined) {
        (globalThis as unknown as { Deno?: unknown }).Deno = originalDeno;
      }
    }
  });

  it('functions without a second info argument', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      ctx.json({ ok: true });
    });
    const handler = createHandler(app, { timeout: 0 });

    // Call with ONLY the request argument (no dummy info object)
    const res = await handler(new Request('http://localhost/'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});

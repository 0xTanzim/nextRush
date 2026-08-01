/**
 * @nextrush/adapter-edge - Adapter behavior tests
 *
 * Regression guards for:
 *  - F-02: headers set via ctx.set() survive an implicit/empty (and 404) response.
 *  - F-03: Cloudflare `env` bindings are threaded onto ctx.env.
 *  - F-14: app.isRunning becomes true after the first request boots the app.
 */

import { createApp } from '@nextrush/core';
import { describe, expect, it } from 'vitest';
import { createCloudflareHandler, createFetchHandler } from '../adapter';

describe('edge adapter — F-02 header preservation', () => {
  it('keeps headers set via ctx.set() on a header-only (no body method) response', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      ctx.set('X-Custom', 'kept');
      ctx.set('Access-Control-Allow-Origin', '*');
      ctx.status = 204;
    });
    const handler = createFetchHandler(app);

    const res = await handler(new Request('http://localhost/'));
    expect(res.status).toBe(204);
    expect(res.headers.get('X-Custom')).toBe('kept');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('keeps headers set via ctx.set() on the default 404 response', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      ctx.set('X-Trace', 'abc');
      ctx.status = 404;
    });
    const handler = createFetchHandler(app);

    const res = await handler(new Request('http://localhost/missing'));
    expect(res.status).toBe(404);
    expect(res.headers.get('X-Trace')).toBe('abc');
    expect(await res.json()).toEqual({ error: 'Not Found' });
  });

  it('accumulates multiple Set-Cookie headers on an empty response', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      ctx.set('Set-Cookie', 'a=1; Path=/');
      ctx.set('Set-Cookie', 'b=2; Path=/');
      ctx.status = 204;
    });
    const handler = createFetchHandler(app);

    const res = await handler(new Request('http://localhost/'));
    expect(res.headers.getSetCookie()).toHaveLength(2);
  });
});

describe('edge adapter — F-03 Cloudflare env', () => {
  it('threads env onto ctx.env for the Cloudflare handler', async () => {
    interface Env {
      MY_SECRET: string;
    }
    const app = createApp();
    app.use(async (ctx) => {
      const env = ctx.env as Env | undefined;
      ctx.json({ secret: env?.MY_SECRET ?? null });
    });

    const mod = createCloudflareHandler<Env>(app);
    const res = await mod.fetch(
      new Request('http://localhost/'),
      { MY_SECRET: 'shhh' },
      { waitUntil: () => undefined }
    );
    expect(await res.json()).toEqual({ secret: 'shhh' });
  });
});

describe('edge adapter — F-14 lifecycle', () => {
  it('marks the app running after the first request boots it', async () => {
    const app = createApp();
    app.use(async (ctx) => ctx.json({ ok: true }));
    expect(app.isRunning).toBe(false);

    const handler = createFetchHandler(app);
    await handler(new Request('http://localhost/'));
    expect(app.isRunning).toBe(true);
  });
});

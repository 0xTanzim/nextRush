/**
 * @nextrush/adapter-deno - Adapter behavior tests
 *
 * Regression guards for:
 *  - F-02: headers set via ctx.set() survive an implicit/empty (and 404) response.
 *  - F-08: a timeout returns 504 and aborts ctx.signal.
 */

import { createApp } from '@nextrush/core';
import { describe, expect, it } from 'vitest';
import { createHandler } from '../adapter';

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

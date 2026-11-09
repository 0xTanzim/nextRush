/**
 * Exhaustive adversarial audit of Candidate A lifecycle and settlement semantics.
 */

import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { notFoundHandler } from '@nextrush/errors';
import { RESOLVED_PROMISE } from '@nextrush/types';
import http, { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHandler } from '../adapter';

function armedWithBound(spy: ReturnType<typeof vi.spyOn>, bound: number): number {
  return spy.mock.calls.filter((call) => call[1] === bound).length;
}

async function listenAndGet(
  app: ReturnType<typeof createApp>,
  timeout: number,
  path = '/'
): Promise<{ status: number; body: string }> {
  const server = createServer(createHandler(app, { timeout }));
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const port = (server.address() as AddressInfo).port;
  try {
    return await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = http.request(
        {
          host: '127.0.0.1',
          port,
          path,
          method: 'GET',
        },
        (res) => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({ status: res.statusCode ?? 0, body: data });
          });
        }
      );
      req.on('error', reject);
      req.end();
    });
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
}

describe('Candidate A adversarial lifecycle suite (14 cases)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Ordinary matched synchronous handler
  it('Case 1: ordinary matched synchronous handler returns 200 with 0 timers', async () => {
    const app = createApp({ router: createRouter() });
    app.get('/hit', (ctx) => ctx.json({ ok: true }));

    const spy = vi.spyOn(globalThis, 'setTimeout');
    const { status, body } = await listenAndGet(app, 30_000, '/hit');

    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual({ ok: true });
    expect(armedWithBound(spy, 30_000)).toBe(0);
  });

  // 2. Synchronous unmatched 404
  it('Case 2: synchronous unmatched 404 returns 404 with 0 timers', async () => {
    const app = createApp({ router: createRouter() });
    app.get('/hit', (ctx) => ctx.json({ ok: true }));

    const spy = vi.spyOn(globalThis, 'setTimeout');
    const { status, body } = await listenAndGet(app, 30_000, '/unknown');

    expect(status).toBe(404);
    expect(JSON.parse(body)).toEqual({ error: 'Not Found' });
    expect(armedWithBound(spy, 30_000)).toBe(0);
  });

  // 3. Custom synchronous not-found handler
  it('Case 3: custom synchronous not-found handler returns custom 404 with 0 timers', async () => {
    const app = createApp({ router: createRouter() });
    app.use(notFoundHandler('Custom Not Found'));

    const spy = vi.spyOn(globalThis, 'setTimeout');
    const { status, body } = await listenAndGet(app, 30_000, '/unknown');

    expect(status).toBe(404);
    expect(JSON.parse(body).message).toBe('Custom Not Found');
    expect(armedWithBound(spy, 30_000)).toBe(0);
  });

  // 4. Asynchronous not-found handler
  it('Case 4: asynchronous not-found handler returns 404 with timer armed during execution', async () => {
    const app = createApp({ router: createRouter() });
    app.use(async (ctx, next) => {
      await next();
      if (ctx.status === 404) {
        await new Promise((r) => setTimeout(r, 10));
        ctx.json({ error: 'Async Not Found' });
      }
    });

    const spy = vi.spyOn(globalThis, 'setTimeout');
    const { status, body } = await listenAndGet(app, 30_000, '/unknown');

    expect(status).toBe(404);
    expect(JSON.parse(body)).toEqual({ error: 'Async Not Found' });
    expect(armedWithBound(spy, 30_000)).toBe(1);
  });

  // 5. Middleware calling next() without awaiting it
  it('Case 5: middleware calling next() without awaiting returns 200', async () => {
    const app = createApp({ router: createRouter() });
    app.use((_ctx, next) => {
      void next();
    });
    app.get('/sync', (ctx) => ctx.json({ synced: true }));

    const { status, body } = await listenAndGet(app, 30_000, '/sync');
    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual({ synced: true });
  });

  // 6. Middleware awaiting next()
  it('Case 6: middleware awaiting next() returns 200', async () => {
    const app = createApp({ router: createRouter() });
    app.use(async (_ctx, next) => {
      await next();
    });
    app.get('/sync', (ctx) => ctx.json({ synced: true }));

    const { status, body } = await listenAndGet(app, 30_000, '/sync');
    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual({ synced: true });
  });

  // 7. Middleware returning a promise
  it('Case 7: middleware returning a promise resolves cleanly', async () => {
    const app = createApp({ router: createRouter() });
    app.use((_ctx, next) => Promise.resolve().then(() => next()));
    app.get('/sync', (ctx) => ctx.json({ ok: true }));

    const { status, body } = await listenAndGet(app, 30_000, '/sync');
    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual({ ok: true });
  });

  // 8. Middleware that calls next() and then performs asynchronous work that times out
  it('Case 8: middleware that calls next() then performs hanging async work returns 504', async () => {
    const app = createApp({ router: createRouter() });
    app.use(async (_ctx, next) => {
      await next();
      await new Promise((r) => setTimeout(r, 200));
    });

    const { status, body } = await listenAndGet(app, 20, '/unmatched');
    expect(status).toBe(504);
    expect(JSON.parse(body)).toEqual({ error: 'Gateway Timeout' });
  });

  // 9. Middleware that throws or rejects
  it('Case 9: middleware throwing synchronously surfaces as 500', async () => {
    const app = createApp({ router: createRouter() });
    app.use(() => {
      throw new Error('sync failure');
    });

    const { status } = await listenAndGet(app, 30_000, '/unknown');
    expect(status).toBe(500);
  });

  // 10. Error middleware that writes a response
  it('Case 10: custom error handler catches error and writes response', async () => {
    const app = createApp({ router: createRouter() });
    app.use(() => {
      throw new Error('handled failure');
    });
    app.setErrorHandler((err, ctx) => {
      ctx.status = 500;
      ctx.json({ customError: err.message });
    });

    const { status, body } = await listenAndGet(app, 30_000, '/unknown');
    expect(status).toBe(500);
    expect(JSON.parse(body)).toEqual({ customError: 'handled failure' });
  });

  // 11. Synchronously rejected or dot-segment path
  it('Case 11: dot-segment path is rejected with 400 Bad Request and arms 0 timers', async () => {
    const app = createApp({ router: createRouter() });
    app.get('/files/*', (ctx) => ctx.text('ok'));

    const spy = vi.spyOn(globalThis, 'setTimeout');
    const { status, body } = await listenAndGet(app, 30_000, '/files/../secret');

    expect(status).toBe(400);
    expect(JSON.parse(body)).toEqual({ error: 'Bad Request' });
    expect(armedWithBound(spy, 30_000)).toBe(0);
  });

  // 12. Matched asynchronous handler
  it('Case 12: matched asynchronous handler arms timer and resolves 200', async () => {
    const app = createApp({ router: createRouter() });
    app.get('/async', async (ctx) => {
      await new Promise((r) => setTimeout(r, 10));
      ctx.json({ async: true });
    });

    const spy = vi.spyOn(globalThis, 'setTimeout');
    const { status, body } = await listenAndGet(app, 30_000, '/async');

    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual({ async: true });
    expect(armedWithBound(spy, 30_000)).toBe(1);
  });

  // 13. Downstream handler that settles after an asynchronous boundary
  it('Case 13: downstream handler settling after async boundary arms timer', async () => {
    const app = createApp({ router: createRouter() });
    app.use(async (_ctx, next) => {
      await new Promise((r) => setTimeout(r, 5));
      return next();
    });
    app.get('/downstream', (ctx) => ctx.json({ downstream: true }));

    const spy = vi.spyOn(globalThis, 'setTimeout');
    const { status, body } = await listenAndGet(app, 30_000, '/downstream');

    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual({ downstream: true });
    expect(armedWithBound(spy, 30_000)).toBe(1);
  });

  // 14. Supported RESOLVED_PROMISE special case
  it('Case 14: middleware returning RESOLVED_PROMISE settles cleanly with 0 timers', async () => {
    const app = createApp({ router: createRouter() });
    app.use((ctx) => {
      ctx.json({ sentinel: true });
      return RESOLVED_PROMISE;
    });

    const spy = vi.spyOn(globalThis, 'setTimeout');
    const { status, body } = await listenAndGet(app, 30_000, '/any');

    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual({ sentinel: true });
    expect(armedWithBound(spy, 30_000)).toBe(0);
  });
});

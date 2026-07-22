/**
 * @nextrush/adapter-node — F-04 (ADR-0010): handler-level timeout race.
 *
 * Node now races the handler against `timeout` and returns a clean `504`,
 * cancelling via `ctx.signal` — converging with Bun/Deno/Edge/Serverless.
 * `server.timeout` (set in `serve()`) remains the independent socket-level
 * slow-client guard and is asserted separately here.
 */

import { createApp } from '@nextrush/core';
import { request as httpRequest } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { serve, type ServerInstance } from '../adapter';

let instance: ServerInstance | undefined;

afterEach(async () => {
  await instance?.close();
  instance = undefined;
});

function get(port: number, path = '/'): Promise<{ status: number; contentType?: string; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          contentType: res.headers['content-type'],
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

describe('F-04: Node handler-level timeout races the handler and returns 504', () => {
  it('a slow handler that never settles returns 504 with uniform Content-Type', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      // Never resolves within the test's lifetime — forces the timeout race.
      await new Promise<void>(() => undefined);
      ctx.json({ unreachable: true });
    });
    instance = await serve(app, { port: 0, timeout: 20 });

    const res = await get(instance.port);
    expect(res.status).toBe(504);
    expect(res.contentType).toBe('application/json; charset=utf-8');
    expect(JSON.parse(res.body)).toEqual({ error: 'Gateway Timeout' });
  });

  it('cancels the still-running handler via ctx.signal', async () => {
    const app = createApp();
    let signalFired = false;
    app.use(async (ctx) => {
      const signal = ctx.signal;
      await new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => {
          signalFired = true;
          resolve();
        });
      });
    });
    instance = await serve(app, { port: 0, timeout: 20 });

    await get(instance.port);
    // Give the aborted handler's promise chain a tick to settle.
    await new Promise((r) => setTimeout(r, 20));
    expect(signalFired).toBe(true);
  });

  it('a late handler rejection after the timeout already responded is swallowed, not an unhandled rejection', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      const signal = ctx.signal;
      await new Promise<void>((resolve) => {
        signal.addEventListener('abort', resolve, { once: true });
      });
      // The handler "cleans up" after being aborted by throwing — this must
      // not surface as an unhandled rejection now that the timeout already
      // responded with 504 (F-04's swallow-late-rejection branch).
      throw new Error('cleanup failed after abort');
    });
    instance = await serve(app, { port: 0, timeout: 20 });

    const res = await get(instance.port);
    expect(res.status).toBe(504);
    // Give the late rejection a tick to settle through the swallow path.
    await new Promise((r) => setTimeout(r, 20));
  });

  it('does not clobber a response the handler already committed before the timeout fired', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      ctx.json({ committed: true });
      // Hang after responding — the timeout must not attempt a second write.
      await new Promise<void>(() => undefined);
    });
    instance = await serve(app, { port: 0, timeout: 20 });

    const res = await get(instance.port);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ committed: true });
  });

  it('timeout: 0 disables the handler-level race (pre-F-04 behavior)', async () => {
    const app = createApp();
    app.use((ctx) => {
      ctx.json({ ok: true });
    });
    instance = await serve(app, { port: 0, timeout: 0 });

    const res = await get(instance.port);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it('a fast handler is unaffected by a configured timeout', async () => {
    const app = createApp();
    app.use((ctx) => {
      ctx.json({ fast: true });
    });
    instance = await serve(app, { port: 0, timeout: 5000 });

    const res = await get(instance.port);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ fast: true });
  });
});

describe('F-04: server.timeout remains an independent slow-client guard', () => {
  it('serve() still configures server.timeout from the same timeout option', async () => {
    const app = createApp();
    app.use((ctx) => {
      ctx.json({ ok: true });
    });
    instance = await serve(app, { port: 0, timeout: 1234 });

    expect(instance.server.timeout).toBe(1234);
  });
});

describe('F-04: createHandler finalize paths (implicit 404 / handler error) stay correct after the timeout refactor', () => {
  it('an implicit 404 (no route matched, no explicit response) finalizes correctly', async () => {
    const app = createApp();
    app.use((ctx) => {
      ctx.status = 404;
      // No explicit ctx.json/send — exercises the implicit-404 finalize branch.
    });
    instance = await serve(app, { port: 0, timeout: 5000 });

    const res = await get(instance.port);
    expect(res.status).toBe(404);
    expect(res.contentType).toBe('application/json; charset=utf-8');
    expect(JSON.parse(res.body)).toEqual({ error: 'Not Found' });
  });

  it('an implicit non-404 empty response finalizes with the set status and no body', async () => {
    const app = createApp();
    app.use((ctx) => {
      ctx.status = 204;
    });
    instance = await serve(app, { port: 0, timeout: 5000 });

    const res = await get(instance.port);
    expect(res.status).toBe(204);
    expect(res.body).toBe('');
  });

  it('a synchronously-thrown handler error finalizes as a 500 with no leak', async () => {
    const app = createApp();
    app.use(() => {
      throw new Error('secret-leak-xyz');
    });
    instance = await serve(app, { port: 0, timeout: 5000 });

    const res = await get(instance.port);
    expect(res.status).toBe(500);
    expect(res.contentType).toBe('application/json; charset=utf-8');
    expect(res.body).not.toContain('secret-leak-xyz');
  });

  it('a rejected handler promise finalizes as a 500 with no leak (async error path)', async () => {
    const app = createApp();
    app.use(async () => {
      await Promise.resolve();
      throw new Error('secret-leak-async');
    });
    instance = await serve(app, { port: 0, timeout: 5000 });

    const res = await get(instance.port);
    expect(res.status).toBe(500);
    expect(res.body).not.toContain('secret-leak-async');
  });
});

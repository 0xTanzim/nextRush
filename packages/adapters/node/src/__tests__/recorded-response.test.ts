/**
 * @nextrush/adapter-node — the recorded response
 *
 * The Node adapter used to commit inside the handler: `ctx.json()` called
 * `writeHead`/`end` immediately, so by the time middleware that runs after
 * `await next()` looked at the response, it was already on the wire. These tests
 * pin the replacement contract: a response method only records, the adapter
 * flushes once after the chain settles, and a post-handler write therefore lands.
 */

import { createApp } from '@nextrush/core';
import { IncomingMessage, ServerResponse, request as httpRequest } from 'node:http';
import { Socket } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { serve, type ServerInstance } from '../adapter';
import { NodeContext } from '../context';

let instance: ServerInstance | undefined;

afterEach(async () => {
  await instance?.close();
  instance = undefined;
  vi.restoreAllMocks();
});

function get(port: number, path = '/'): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

describe('a response method records instead of writing', () => {
  it('reaches the socket only after the middleware chain settles', async () => {
    const app = createApp();
    let headersSentAfterHandler: boolean | undefined;

    app.use(async (ctx, next) => {
      await next();
      // After the handler: under the recorded model nothing has been written yet.
      headersSentAfterHandler = ctx.raw.res.headersSent;
    });

    app.use((ctx) => {
      ctx.json({ ok: true });
    });

    instance = await serve(app, { port: 0 });
    const res = await get(instance.port);

    expect(headersSentAfterHandler).toBe(false);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it('calls writeHead and end exactly once, from the flush', () => {
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = 'GET';
    req.url = '/';
    req.headers = {};

    const res = new ServerResponse(req);
    Object.defineProperty(res, 'headersSent', { value: false, writable: true, configurable: true });
    const writeHead = vi.spyOn(res, 'writeHead').mockImplementation(() => {
      (res as unknown as { headersSent: boolean }).headersSent = true;
      return res;
    });
    const end = vi.spyOn(res, 'end').mockImplementation(() => res);
    vi.spyOn(res, 'setHeader').mockImplementation(() => res);

    const ctx = new NodeContext(req, res);
    ctx.json({ ok: true });

    expect(writeHead).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();

    ctx.flushResponse();

    expect(writeHead).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(1);
  });
});

describe('a post-handler header write', () => {
  it('lands on the response instead of being discarded', async () => {
    const app = createApp();

    app.use(async (ctx, next) => {
      await next();
      ctx.set('X-Late-Header', 'written-after-handler');
    });

    app.use((ctx) => {
      ctx.json({ ok: true });
    });

    instance = await serve(app, { port: 0 });
    const res = await get(instance.port);

    expect(res.status).toBe(200);
    expect(res.headers['x-late-header']).toBe('written-after-handler');
  });

  it('still completes every outer post-next() step', async () => {
    const app = createApp();
    const order: string[] = [];

    app.use(async (_ctx, next) => {
      await next();
      order.push('outer-after');
    });

    app.use(async (ctx, next) => {
      await next();
      ctx.set('X-Inner-Late', 'v');
      order.push('inner-after');
    });

    app.use((ctx) => {
      ctx.json({ ok: true });
    });

    instance = await serve(app, { port: 0 });
    const res = await get(instance.port);

    expect(order).toEqual(['inner-after', 'outer-after']);
    expect(res.headers['x-inner-late']).toBe('v');
  });
});

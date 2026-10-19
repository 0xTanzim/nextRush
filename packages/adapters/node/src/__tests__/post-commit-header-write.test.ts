/**
 * @nextrush/adapter-node — a post-commit response-header write must not abort the chain
 *
 * The Node adapter commits a response inside the handler (`writeHead`/`end`). A
 * middleware that writes a header *after* `await next()` therefore reaches
 * `res.setHeader()` once `headersSent` is true, which Node rejects with
 * `ERR_HTTP_HEADERS_SENT`.
 *
 * That rejection used to escape the inner middleware and unwind the rest of the
 * stack, so every outer middleware's post-`next()` work was skipped — while the
 * request still answered 200, because the error boundary returns early once the
 * response is committed. The failure was invisible: no log, no failing status.
 *
 * These tests pin the contract that replaces it: a header written after commit
 * is discarded, and the chain completes.
 */

import { createApp } from '@nextrush/core';
import { IncomingMessage, ServerResponse } from 'node:http';
import { request as httpRequest } from 'node:http';
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

function get(port: number, path = '/'): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

describe('a header written after the response is committed', () => {
  it('does not abort the middleware chain: every outer post-next() runs', async () => {
    const app = createApp();
    const order: string[] = [];

    app.use(async (_ctx, next) => {
      await next();
      order.push('outer-after');
    });

    app.use(async (ctx, next) => {
      await next();
      // The response is committed by the handler below; writing now must not
      // throw, and must not stop this middleware or anything outside it.
      ctx.set('x-late', 'v');
      order.push('inner-after');
    });

    app.use((ctx) => {
      ctx.json({ ok: true });
    });

    instance = await serve(app, { port: 0 });
    const res = await get(instance.port);

    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
    expect(order).toEqual(['inner-after', 'outer-after']);
  });

  it('discards the late header without failing the request or surfacing an error', async () => {
    const app = createApp();
    const errors: unknown[] = [];

    app.use(async (ctx, next) => {
      await next();
      ctx.set('x-late', 'v');
    });

    app.use((ctx) => {
      ctx.json({ ok: true });
    });

    instance = await serve(app, { port: 0 });
    const res = await get(instance.port);

    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
    expect(errors).toEqual([]);
  });
});

// A mocked response keeps the header write from reaching a real socket, so the
// warning assertion is about the report and nothing else.
function createMockReq(): IncomingMessage {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = 'GET';
  req.url = '/';
  req.headers = {};
  return req;
}

function createMockRes(): ServerResponse {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  const res = new ServerResponse(req);
  // A real `ServerResponse` flips `headersSent` when `writeHead` runs, and the
  // discard guard reads exactly that field, so the stand-in has to model it.
  Object.defineProperty(res, 'headersSent', { value: false, writable: true, configurable: true });
  vi.spyOn(res, 'setHeader').mockImplementation(() => res);
  vi.spyOn(res, 'end').mockImplementation(() => res);
  vi.spyOn(res, 'writeHead').mockImplementation(() => {
    (res as unknown as { headersSent: boolean }).headersSent = true;
    return res;
  });
  return res;
}

describe('a header written from inside writeHead', () => {
  it('still lands, because the response is not on the wire yet', () => {
    const res = createMockRes();
    const ctx = new NodeContext(createMockReq(), res);
    const written: string[] = [];
    let respondedInside = false;

    vi.spyOn(res, 'setHeader').mockImplementation((name: string) => {
      written.push(name);
      return res;
    });
    // Node runs `on-headers`-style listeners inside `writeHead`: `responded` is
    // already true there, while the headers can still legally be set. The compat
    // bridge writes headers from exactly this position.
    vi.spyOn(res, 'writeHead').mockImplementation(() => {
      respondedInside = ctx.responded;
      ctx.set('x-during-headers', 'v');
      (res as unknown as { headersSent: boolean }).headersSent = true;
      return res;
    });

    ctx.json({ ok: true });

    expect(respondedInside).toBe(true);
    expect(written).toContain('x-during-headers');
  });
});

describe('the header-validation guard is unchanged', () => {
  it('still throws a typed error for an invalid write after commit', () => {
    const ctx = new NodeContext(createMockReq(), createMockRes());
    ctx.json({ ok: true });

    expect(() => ctx.set('X-Bad\r\nInjected', 'v')).toThrow(/invalid characters/);
    expect(() => ctx.set('X-Ok', 'bad\nvalue')).toThrow(/invalid characters/);
  });
});

describe('the discarded write is reported', () => {
  it('warns once per process and names the field it discarded', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // A fresh module instance starts with a clean once-per-process flag, so this
    // assertion does not depend on which tests ran before it.
    vi.resetModules();
    const { NodeContext } = await import('../context');

    const ctx = new NodeContext(createMockReq(), createMockRes());
    ctx.json({ ok: true });
    ctx.set('x-first-late', 'v');
    ctx.set('x-second-late', 'v');
    ctx.set('x-third-late', 'v');

    const reported = warn.mock.calls
      .map((call) => String(call[0]))
      .filter((message) => message.includes('x-'));
    expect(reported).toHaveLength(1);
    expect(reported[0]).toContain('x-first-late');
  });
});

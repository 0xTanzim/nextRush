/**
 * @nextrush/adapter-node — HP-5 lazy `ctx.raw` regression contract
 *
 * Executable contract for OpenSpec change `router-context-final-cleanup` (HP-5).
 * `NodeContext` no longer allocates the `{ req, res }` wrapper eagerly in the
 * constructor; it stores `req`/`res` as private fields and builds the wrapper
 * lazily, once, only when a caller reads `ctx.raw`.
 *
 * Two kinds of tests:
 *  - OPTIMIZATION ASSERTION (RED before HP-5): no internal response method,
 *    `ctx.signal`, or client-IP resolution reads `ctx.raw` — proven with a
 *    read-counting getter shadowing `raw`. Before the rewire, `json()` etc. read
 *    `this.raw.res` (count > 0 → fail); after, they use the private fields
 *    (count 0 → pass). This is the observable proxy for "a raw-unread request
 *    allocates no wrapper" (the allocation itself is measured by the 4.4
 *    micro-bench).
 *  - CHARACTERIZATION (green before and after): `ctx.raw` shape + memoized
 *    identity, and byte-identical behavior of every response method, `ctx.signal`,
 *    and `ctx.ip`.
 */

import { createServer, type Server } from 'node:http';
import { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Socket } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NodeContext } from '../context';

function createMockReq(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = overrides.method ?? 'GET';
  req.url = overrides.url ?? '/';
  req.headers = overrides.headers ?? {};
  return req;
}

function createMockRes(): ServerResponse {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  const res = new ServerResponse(req);
  vi.spyOn(res, 'setHeader').mockImplementation(() => res);
  vi.spyOn(res, 'end').mockImplementation(() => res);
  vi.spyOn(res, 'writeHead').mockImplementation(() => res);
  return res;
}

/**
 * Build a context and shadow `ctx.raw` with a getter that counts reads, so a
 * test can assert an internal path never touches `ctx.raw`. Returns the live
 * count via a closure.
 */
function withRawReadCounter(
  req: IncomingMessage,
  res: ServerResponse
): { ctx: NodeContext; reads: () => number } {
  const ctx = new NodeContext(req, res);
  let count = 0;
  Object.defineProperty(ctx, 'raw', {
    configurable: true,
    get() {
      count++;
      return { req, res };
    },
  });
  return { ctx, reads: () => count };
}

// Real-server harness for byte-identical parity.
let server: Server;
let baseUrl: string;

function serve(handler: (ctx: NodeContext) => void | Promise<void>): Promise<void> {
  server = createServer((req, res) => {
    const ctx = new NodeContext(req, res);
    Promise.resolve(handler(ctx)).catch(() => {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end();
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

afterEach(() => {
  return new Promise<void>((resolve) => {
    if (server?.listening) server.close(() => resolve());
    else resolve();
  });
});

// ===========================================================================
// §1 ctx.raw shape + memoized identity (characterization)
// ===========================================================================

describe('HP-5: ctx.raw shape and memoized identity', () => {
  it('returns the underlying req/res', () => {
    const req = createMockReq();
    const res = createMockRes();
    const ctx = new NodeContext(req, res);
    expect(ctx.raw.req).toBe(req);
    expect(ctx.raw.res).toBe(res);
  });

  it('is memoized — repeated reads return the same object', () => {
    const ctx = new NodeContext(createMockReq(), createMockRes());
    expect(ctx.raw).toBe(ctx.raw);
  });

  it('gives each context its own wrapper (no shared instance)', () => {
    const a = new NodeContext(createMockReq(), createMockRes());
    const b = new NodeContext(createMockReq(), createMockRes());
    expect(a.raw).not.toBe(b.raw);
  });
});

// ===========================================================================
// §2 Lazy: no internal path reads ctx.raw (RED before HP-5)
// ===========================================================================

describe('HP-5: internal paths use private req/res, never ctx.raw', () => {
  it('[trim] json() does not read ctx.raw', () => {
    const { ctx, reads } = withRawReadCounter(createMockReq(), createMockRes());
    ctx.json({ ok: true });
    expect(reads()).toBe(0);
  });

  it('[trim] send() (string) does not read ctx.raw', () => {
    const { ctx, reads } = withRawReadCounter(createMockReq(), createMockRes());
    ctx.send('hello');
    expect(reads()).toBe(0);
  });

  it('[trim] html() does not read ctx.raw', () => {
    const { ctx, reads } = withRawReadCounter(createMockReq(), createMockRes());
    ctx.html('<p>hi</p>');
    expect(reads()).toBe(0);
  });

  it('[trim] redirect() does not read ctx.raw', () => {
    const { ctx, reads } = withRawReadCounter(createMockReq(), createMockRes());
    ctx.redirect('/elsewhere');
    expect(reads()).toBe(0);
  });

  it('[trim] set() does not read ctx.raw', () => {
    const { ctx, reads } = withRawReadCounter(createMockReq(), createMockRes());
    ctx.set('X-Test', 'v');
    expect(reads()).toBe(0);
  });

  it('[trim] reading ctx.signal does not read ctx.raw', () => {
    const { ctx, reads } = withRawReadCounter(createMockReq(), createMockRes());
    void ctx.signal;
    expect(reads()).toBe(0);
  });

  it('[trim] a full request that never reads ctx.raw touches it zero times', () => {
    const { ctx, reads } = withRawReadCounter(createMockReq(), createMockRes());
    ctx.set('X-A', '1');
    void ctx.signal;
    ctx.json({ ok: true });
    expect(reads()).toBe(0);
  });
});

// ===========================================================================
// §3 Response-method parity (characterization, real round-trip)
// ===========================================================================

describe('HP-5: response methods behave identically over private req/res', () => {
  it('json() produces a byte-identical JSON response', async () => {
    await serve((ctx) => ctx.json({ message: 'hello' }));
    const res = await fetch(baseUrl);
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(body).toBe('{"message":"hello"}');
  });

  it('send() sends text with the right content-type', async () => {
    await serve((ctx) => ctx.send('plain text'));
    const res = await fetch(baseUrl);
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await res.text()).toBe('plain text');
  });

  it('html() sends HTML with the right content-type', async () => {
    await serve((ctx) => ctx.html('<h1>Hi</h1>'));
    const res = await fetch(baseUrl);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await res.text()).toBe('<h1>Hi</h1>');
  });

  it('redirect() sets Location and status', async () => {
    await serve((ctx) => ctx.redirect('/target', 301));
    const res = await fetch(baseUrl, { redirect: 'manual' });
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('/target');
  });

  it('sendStream() streams the source bytes to the client', async () => {
    await serve((ctx) => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('chunk1'));
          controller.enqueue(new TextEncoder().encode('chunk2'));
          controller.close();
        },
      });
      return ctx.sendStream(stream);
    });
    const res = await fetch(baseUrl);
    expect(await res.text()).toBe('chunk1chunk2');
  });

  it('ctx.signal aborts when the client disconnects', async () => {
    let aborted = false;
    await serve(async (ctx) => {
      ctx.signal.addEventListener('abort', () => {
        aborted = true;
      });
      // Hold the response open so the client can abort mid-flight.
      await new Promise((r) => setTimeout(r, 200));
      if (!ctx.responded) ctx.json({ late: true });
    });
    const controller = new AbortController();
    const req = fetch(baseUrl, { signal: controller.signal }).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 50));
    controller.abort();
    await req;
    await new Promise((r) => setTimeout(r, 100));
    expect(aborted).toBe(true);
  });

  it('ctx.ip resolves the client address', async () => {
    let seenIp = '';
    await serve((ctx) => {
      seenIp = ctx.ip;
      ctx.json({ ok: true });
    });
    await (await fetch(baseUrl)).text();
    // Loopback address family varies (::1 / 127.0.0.1); just assert it resolved.
    expect(seenIp.length).toBeGreaterThan(0);
  });
});

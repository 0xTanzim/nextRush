/**
 * @nextrush/adapter-node — context-response-microtrims regression contract
 *
 * Executable contract for OpenSpec change `node-context-response-microtrims`
 * (hot-path review P3). Pins the byte-identical observable behavior of
 * `ctx.query`, `ctx.json()`, and `ctx.set()` (characterization tests, green
 * before and after the trims) AND proves each trim actually happened (the
 * optimization-assertion tests, RED before implementation):
 *
 *  - HP-2:  a query-less request assigns a shared frozen empty query object
 *           instead of allocating a fresh `{}` per request.
 *  - HP-14: `ctx.json()` writes Content-Type + Content-Length + status via a
 *           single `res.writeHead()` (one outgoing-header-map touch) rather than
 *           two `res.setHeader()` calls, merge-safe with prior `ctx.set()`.
 *  - HP-15: `ctx.set()` gates the `set-cookie` detection behind a constant-time
 *           pre-check so `field.toLowerCase()` is not allocated for non-cookie
 *           headers, while the CRLF guard still runs on every call.
 */

import { createServer, type Server } from 'node:http';
import { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Socket } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NodeContext } from '../context';

// ---------------------------------------------------------------------------
// Unit-level mocks (setHeader/end/writeHead stubbed so no real socket write)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Real-server harness (observable byte-identical parity for HP-14)
// ---------------------------------------------------------------------------

let server: Server;
let baseUrl: string;

function serve(handler: (ctx: NodeContext) => void): Promise<void> {
  server = createServer((req, res) => {
    const ctx = new NodeContext(req, res);
    try {
      handler(ctx);
    } catch {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end();
      }
    }
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
// §2.1 HP-2 — shared frozen empty query
// ===========================================================================

describe('HP-2: query-less request uses a shared frozen empty query object', () => {
  // ---- parity / characterization (green before and after) -----------------

  it('a request with no query string has an empty query', () => {
    const ctx = new NodeContext(createMockReq({ url: '/users' }), createMockRes());
    expect(ctx.path).toBe('/users');
    expect({ ...ctx.query }).toEqual({});
  });

  it('a request with a query string is parsed identically to today', () => {
    const ctx = new NodeContext(
      createMockReq({ url: '/search?q=test&limit=10' }),
      createMockRes()
    );
    expect(ctx.path).toBe('/search');
    expect(ctx.query).toEqual({ q: 'test', limit: '10' });
  });

  // ---- optimization assertion (RED before HP-2) ----------------------------

  it('[trim] two query-less requests share the SAME query reference (no per-request alloc)', () => {
    const a = new NodeContext(createMockReq({ url: '/a' }), createMockRes());
    const b = new NodeContext(createMockReq({ url: '/b' }), createMockRes());
    expect(a.query).toBe(b.query);
  });

  it('[trim] the shared empty query object is frozen (read-only contract)', () => {
    const ctx = new NodeContext(createMockReq({ url: '/no-query' }), createMockRes());
    expect(Object.isFrozen(ctx.query)).toBe(true);
  });

  it('a with-query request does NOT return the shared frozen instance', () => {
    const shared = new NodeContext(createMockReq({ url: '/no-query' }), createMockRes()).query;
    const parsed = new NodeContext(createMockReq({ url: '/x?a=1' }), createMockRes()).query;
    expect(parsed).not.toBe(shared);
    expect(parsed).toEqual({ a: '1' });
  });
});

// ===========================================================================
// §2.2 HP-14 — single writeHead in json(), merge-safe
// ===========================================================================

describe('HP-14: ctx.json() writes headers with a single writeHead', () => {
  // ---- optimization assertion (RED before HP-14) ---------------------------

  it('[trim] json() performs one writeHead and no Content-Type/Length setHeader', () => {
    const res = createMockRes();
    const ctx = new NodeContext(createMockReq(), res);
    ctx.json({ message: 'hello' });

    expect(res.writeHead).toHaveBeenCalledTimes(1);
    expect(res.writeHead).toHaveBeenCalledWith(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': String(Buffer.byteLength('{"message":"hello"}')),
    });
    // Content-Type / Content-Length must NOT also go through setHeader.
    const setHeaderCalls = vi.mocked(res.setHeader).mock.calls.map((c) => c[0]);
    expect(setHeaderCalls).not.toContain('Content-Type');
    expect(setHeaderCalls).not.toContain('Content-Length');
  });

  it('[trim] json() writeHead carries the custom status', () => {
    const res = createMockRes();
    const ctx = new NodeContext(createMockReq(), res);
    ctx.status = 201;
    ctx.json({ created: true });
    expect(res.writeHead).toHaveBeenCalledWith(201, expect.any(Object));
  });

  // ---- parity / characterization (green before and after, real round-trip) -

  it('produces a byte-identical JSON response (status/type/length/body)', async () => {
    await serve((ctx) => ctx.json({ message: 'hello' }));
    const res = await fetch(baseUrl);
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('content-length')).toBe(String(Buffer.byteLength(body)));
    expect(body).toBe('{"message":"hello"}');
  });

  it('preserves a header set via ctx.set() before json() (writeHead merges)', async () => {
    await serve((ctx) => {
      ctx.set('X-Custom', 'v');
      ctx.json({ ok: true });
    });
    const res = await fetch(baseUrl);
    await res.text();
    expect(res.headers.get('x-custom')).toBe('v');
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
  });

  it('preserves accumulated Set-Cookie across the writeHead', async () => {
    await serve((ctx) => {
      ctx.set('Set-Cookie', 'a=1; Path=/');
      ctx.set('Set-Cookie', 'b=2; Path=/');
      ctx.json({ ok: true });
    });
    const res = await fetch(baseUrl);
    await res.text();
    // Undici exposes multiple Set-Cookie via getSetCookie().
    expect(res.headers.getSetCookie()).toEqual(['a=1; Path=/', 'b=2; Path=/']);
  });

  it('suppresses the body for a HEAD request', async () => {
    await serve((ctx) => ctx.json({ ok: true }));
    const res = await fetch(baseUrl, { method: 'HEAD' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await res.text()).toBe('');
  });

  it('suppresses the body for status 204', async () => {
    await serve((ctx) => {
      ctx.status = 204;
      ctx.json({ ignored: true });
    });
    const res = await fetch(baseUrl);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
  });

  it('suppresses the body for status 304', async () => {
    await serve((ctx) => {
      ctx.status = 304;
      ctx.json({ ignored: true });
    });
    const res = await fetch(baseUrl);
    expect(res.status).toBe(304);
    expect(await res.text()).toBe('');
  });

  it('a second json() after commit is a no-op', () => {
    const res = createMockRes();
    const ctx = new NodeContext(createMockReq(), res);
    ctx.json({ first: true });
    ctx.json({ second: true });
    expect(res.end).toHaveBeenCalledTimes(1);
    expect(res.end).toHaveBeenCalledWith('{"first":true}');
  });
});

// ===========================================================================
// §2.3 HP-15 — set-cookie pre-check before toLowerCase
// ===========================================================================

describe('HP-15: ctx.set() gates set-cookie toLowerCase behind a cheap pre-check', () => {
  /** Build a context over a real ServerResponse so header accumulation is observable. */
  function realCtx(): { ctx: NodeContext; res: ServerResponse } {
    const socket = new Socket();
    const rawReq = new IncomingMessage(socket);
    rawReq.method = 'GET';
    rawReq.url = '/';
    rawReq.headers = {};
    const rawRes = new ServerResponse(rawReq);
    return { ctx: new NodeContext(rawReq, rawRes), res: rawRes };
  }

  // ---- parity / characterization (green before and after) ------------------

  it.each(['Set-Cookie', 'set-cookie', 'SET-COOKIE', 'sET-cOOKIE'])(
    'detects and accumulates cookies for casing %s',
    (field) => {
      const { ctx, res } = realCtx();
      ctx.set(field, 'a=1; Path=/');
      ctx.set(field, 'b=2; Path=/');
      expect(res.getHeader('set-cookie')).toEqual(['a=1; Path=/', 'b=2; Path=/']);
    }
  );

  it('sets a non-cookie header correctly (overwrite semantics)', () => {
    const { ctx, res } = realCtx();
    ctx.set('X-Test', '1');
    ctx.set('X-Test', '2');
    expect(res.getHeader('x-test')).toBe('2');
  });

  it('still throws via assertHeaderSafe when the field contains CR/LF', () => {
    const { ctx } = realCtx();
    expect(() => ctx.set('X-Bad\r\nInjected', 'v')).toThrow(/invalid characters/);
  });

  it('still throws via assertHeaderSafe when the value contains CR/LF', () => {
    const { ctx } = realCtx();
    expect(() => ctx.set('X-Ok', 'bad\nvalue')).toThrow(/invalid characters/);
  });

  // ---- optimization assertion (RED before HP-15) ---------------------------

  it('[trim] a non-cookie header does NOT allocate a lowercased field string', () => {
    const res = createMockRes();
    const ctx = new NodeContext(createMockReq(), res);
    const spy = vi.spyOn(String.prototype, 'toLowerCase');
    const before = spy.mock.calls.length;
    ctx.set('X-Custom-Header', 'value');
    const after = spy.mock.calls.length;
    spy.mockRestore();
    expect(after - before).toBe(0);
  });

  it('[trim] a real Set-Cookie still falls through to case-insensitive detection', () => {
    const { ctx, res } = realCtx();
    // A length-10 's'-initial non-cookie header must NOT be misdetected.
    ctx.set('sabotage10', 'v'); // length 10, starts with 's', but not set-cookie
    expect(res.getHeader('sabotage10')).toBe('v');
    // And a genuine mixed-case cookie is still detected + accumulates.
    ctx.set('Set-Cookie', 'x=1');
    ctx.set('sET-cOOKIE', 'y=2');
    expect(res.getHeader('set-cookie')).toEqual(['x=1', 'y=2']);
  });
});

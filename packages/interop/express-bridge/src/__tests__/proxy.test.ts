/**
 * @nextrush/express-bridge — four-bucket proxy tests
 */

import { describe, expect, it, vi } from 'vitest';
import type { Context } from '@nextrush/types';
import { createRequestProxy } from '../request-proxy';
import { createResponseProxy } from '../response-proxy';
import { UnsupportedExpressApiError } from '../errors';

function ctx(partial: Partial<Context> = {}): Context {
  const state: Record<string, unknown> = {};
  const headers: Record<string, string | string[]> = {};
  return {
    method: 'GET',
    url: '/users?x=1',
    path: '/users',
    query: { x: '1' },
    headers,
    ip: '1.2.3.4',
    body: undefined,
    params: {},
    status: 200,
    state,
    cookies: {} as never,
    raw: { req: {}, res: {} },
    runtime: 'node',
    platform: undefined,
    json: vi.fn(),
    send: vi.fn(),
    html: vi.fn(),
    redirect: vi.fn(),
    throw: vi.fn(),
    assert: vi.fn(),
    set: vi.fn((field: string, value: string | number | string[]) => {
      headers[field.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value);
    }),
    get: vi.fn((field: string) => headers[field.toLowerCase()]),
    next: vi.fn(),
    responded: false,
    bodySource: {} as never,
    signal: new AbortController().signal,
    sendStream: vi.fn(),
    stream: vi.fn(),
    sse: vi.fn(),
    ndjson: vi.fn(),
    ...partial,
  };
}

function rawReq() {
  const req = {
    method: 'GET',
    url: '/users?x=1',
    headers: {},
    socket: { encrypted: false, remoteAddress: '1.2.3.4' },
    on() {},
    pipe() {},
    read() {},
  };
  return req;
}

function rawRes() {
  const res = {
    statusCode: 200,
    headersSent: false,
    finished: false,
    setHeader() {},
    getHeader() {},
    removeHeader() {},
    end() {},
    write() {
      return true;
    },
    writeHead() {},
    on() {},
    once() {},
    emit() {},
  };
  return res;
}

describe('request proxy (four buckets)', () => {
  it('overlays ctx-backed request properties', () => {
    const c = ctx();
    const req = createRequestProxy(c, rawReq()) as Record<string, unknown>;
    expect(req.method).toBe('GET');
    expect(req.path).toBe('/users');
    expect(req.originalUrl).toBe('/users?x=1');
    expect(req.query).toEqual({ x: '1' });
    expect(req.ip).toBe('1.2.3.4');
    expect(req.protocol).toBe('http');
    expect(req.secure).toBe(false);
  });

  it('passes through Node request members (socket, pipe, read)', () => {
    const r = rawReq();
    const req = createRequestProxy(ctx(), r) as Record<string, unknown>;
    expect(req.socket).toBe(r.socket);
    expect(req.pipe).toBe(r.pipe);
    expect(req.read).toBe(r.read);
  });

  it('traps a known-unsupported Express request API', () => {
    const req = createRequestProxy(ctx(), rawReq()) as Record<string, unknown>;
    expect(() => req.accepts).toThrow(UnsupportedExpressApiError);
  });

  it('projects ad-hoc req.user onto ctx.state', () => {
    const c = ctx();
    const req = createRequestProxy(c, rawReq()) as Record<string, unknown>;
    req.user = 'alice';
    expect(c.state.user).toBe('alice');
  });

  it('ignores a denylisted write without polluting', () => {
    const c = ctx();
    const req = createRequestProxy(c, rawReq()) as Record<string, unknown>;
    (req as Record<string, unknown>)['__proto__'] = { polluted: true };
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(c.state.__proto__).not.toEqual({ polluted: true });
  });

  it('does not re-prototype the real request on setPrototypeOf', () => {
    const r = rawReq();
    const req = createRequestProxy(ctx(), r);
    expect(() => Object.setPrototypeOf(req as object, {})).toThrow();
    expect(Object.getPrototypeOf(r)).toBe(Object.prototype);
  });
});

describe('response proxy (four buckets)', () => {
  it('overlays status()/json() chainably', () => {
    const c = ctx();
    const res = createResponseProxy({ ctx: c, rawRes: rawRes(), onTerminal: vi.fn() }) as Record<
      string,
      unknown
    > & { status: (n: number) => unknown; json: (b: unknown) => unknown };
    res.status(201).json({ ok: true });
    expect(c.status).toBe(201);
    expect(c.responded).toBe(false); // ctx.json mock does not set responded; see integration test
  });

  it('sets statusCode overlay', () => {
    const c = ctx();
    const res = createResponseProxy({ ctx: c, rawRes: rawRes(), onTerminal: vi.fn() }) as Record<string, unknown>;
    res.statusCode = 404;
    expect(c.status).toBe(404);
  });

  it('setHeader overlay writes via ctx.set', () => {
    const c = ctx();
    const res = createResponseProxy({ ctx: c, rawRes: rawRes(), onTerminal: vi.fn() }) as {
      setHeader: (f: string, v: string) => unknown;
    };
    res.setHeader('X-Foo', 'bar');
    expect(c.set).toHaveBeenCalledWith('X-Foo', 'bar');
  });

  it('passes through Node response members (on, write)', () => {
    const r = rawRes();
    const res = createResponseProxy({ ctx: ctx(), rawRes: r, onTerminal: vi.fn() }) as Record<string, unknown>;
    expect(res.on).toBe(r.on);
    expect(res.write).toBe(r.write);
  });

  it('traps a known-unsupported Express response API', () => {
    const res = createResponseProxy({ ctx: ctx(), rawRes: rawRes(), onTerminal: vi.fn() }) as Record<string, unknown>;
    expect(() => res.render).toThrow(UnsupportedExpressApiError);
  });

  it('res.locals is null-prototype', () => {
    const res = createResponseProxy({ ctx: ctx(), rawRes: rawRes(), onTerminal: vi.fn() }) as {
      locals: Record<string, unknown>;
    };
    expect(Object.getPrototypeOf(res.locals)).toBeNull();
  });
});

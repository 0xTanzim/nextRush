/**
 * @nextrush/express-bridge — proxy branch-coverage tests
 *
 * Exercises every overlay/pass-through/ad-hoc branch of the four-bucket
 * request and response proxies so the package holds its 90% coverage gate.
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
    params: { id: '7' },
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
    set: vi.fn(),
    get: vi.fn((field: string) => headers[field.toLowerCase()] as string | undefined),
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

function reqTarget() {
  return {
    method: 'GET',
    url: '/users?x=1',
    headers: { host: 'example.com:3000' },
    socket: { encrypted: true, remoteAddress: '9.8.7.6' },
    on() {},
    pipe() {},
    read() {},
    existing: 'node-value',
  };
}

function resTarget() {
  const headers: Record<string, unknown> = {};
  return {
    statusCode: 200,
    headersSent: false,
    finished: false,
    setHeader(name: string, value: unknown) {
      headers[name] = value;
    },
    getHeader(name: string) {
      return headers[name];
    },
    removeHeader(name: string) {
      delete headers[name];
    },
    end() {},
    write() {
      return true;
    },
    writeHead() {},
    on() {},
    once() {},
    emit() {},
    existing: 'node-value',
  };
}

describe('request proxy branch coverage', () => {
  it('overlays protocol https, secure true, hostname, params, cookies', () => {
    const c = ctx();
    c.state.cookies = { a: '1' };
    (c.get as ReturnType<typeof vi.fn>).mockImplementation((field: string) =>
      field.toLowerCase() === 'host' ? 'example.com:3000' : undefined
    );
    const req = createRequestProxy(c, reqTarget()) as Record<string, unknown>;
    expect(req.protocol).toBe('https');
    expect(req.secure).toBe(true);
    expect(req.hostname).toBe('example.com');
    expect(req.params).toEqual({ id: '7' });
    expect(req.cookies).toEqual({ a: '1' });
  });

  it('overlay get(field) forwards to ctx.get', () => {
    const c = ctx();
    const req = createRequestProxy(c, reqTarget()) as { get: (f: string) => unknown };
    expect(req.get('host')).toBeUndefined();
    expect(c.get).toHaveBeenCalledWith('host');
  });

  it('overlay body set writes ctx.body', () => {
    const c = ctx();
    const req = createRequestProxy(c, reqTarget()) as Record<string, unknown>;
    req.body = { a: 1 };
    expect(c.body).toEqual({ a: 1 });
  });

  it('overlay cookies set projects onto state', () => {
    const c = ctx();
    const req = createRequestProxy(c, reqTarget()) as Record<string, unknown>;
    req.cookies = { b: '2' };
    expect(c.state.cookies).toEqual({ b: '2' });
  });

  it('has returns true for overlay, target, and state keys', () => {
    const c = ctx();
    c.state.custom = 'x';
    const req = createRequestProxy(c, reqTarget());
    expect('method' in (req as object)).toBe(true);
    expect('existing' in (req as object)).toBe(true);
    expect('custom' in (req as object)).toBe(true);
  });

  it('set passes through to a target key', () => {
    const c = ctx();
    const target = reqTarget();
    const req = createRequestProxy(c, target) as Record<string, unknown>;
    req.existing = 'changed';
    expect(target.existing).toBe('changed');
  });

  it('set throws on an unsupported request API', () => {
    const req = createRequestProxy(ctx(), reqTarget()) as Record<string, unknown>;
    expect(() => {
      req.accepts = 'json';
    }).toThrow(UnsupportedExpressApiError);
  });

  it('defineProperty passes through to a target key', () => {
    const c = ctx();
    const target = reqTarget();
    const req = createRequestProxy(c, target) as object;
    Object.defineProperty(req, 'existing', { value: 'defined' });
    expect(target.existing).toBe('defined');
  });

  it('defineProperty overlays body', () => {
    const c = ctx();
    const req = createRequestProxy(c, reqTarget()) as object;
    Object.defineProperty(req, 'body', { value: 'b' });
    expect(c.body).toBe('b');
  });

  it('getPrototypeOf returns the real prototype', () => {
    const target = reqTarget();
    const req = createRequestProxy(ctx(), target) as object;
    expect(Object.getPrototypeOf(req)).toBe(Object.getPrototypeOf(target));
  });
});

describe('response proxy branch coverage', () => {
  it('getHeader falls back to ctx.get when raw has no getHeader', () => {
    const c = ctx();
    const raw = resTarget();
    delete (raw as Record<string, unknown>).getHeader;
    const res = createResponseProxy({ ctx: c, rawRes: raw, onTerminal: vi.fn() }) as {
      getHeader: (f: string) => unknown;
    };
    res.getHeader('X-Foo');
    expect(c.get).toHaveBeenCalledWith('X-Foo');
  });

  it('getHeader reads from raw when present', () => {
    const raw = resTarget();
    raw.setHeader('X-Foo', 'bar');
    const res = createResponseProxy({ ctx: ctx(), rawRes: raw, onTerminal: vi.fn() }) as {
      getHeader: (f: string) => unknown;
    };
    expect(res.getHeader('X-Foo')).toBe('bar');
  });

  it('removeHeader forwards to raw', () => {
    const raw = resTarget();
    raw.setHeader('X-Foo', 'bar');
    const res = createResponseProxy({ ctx: ctx(), rawRes: raw, onTerminal: vi.fn() }) as {
      removeHeader: (f: string) => unknown;
    };
    res.removeHeader('X-Foo');
    expect(raw.getHeader('X-Foo')).toBeUndefined();
  });

  it('send/json/end mark terminal', () => {
    const onTerminal = vi.fn();
    const res = createResponseProxy({ ctx: ctx(), rawRes: resTarget(), onTerminal }) as {
      send: (b: unknown) => unknown;
      json: (b: unknown) => unknown;
      end: () => unknown;
    };
    res.send('hi');
    res.json({ ok: true });
    res.end();
    expect(onTerminal).toHaveBeenCalledTimes(3);
  });

  it('redirect supports all three overloads', () => {
    const c = ctx();
    const res = createResponseProxy({ ctx: c, rawRes: resTarget(), onTerminal: vi.fn() }) as {
      redirect: (a: unknown, b?: unknown) => unknown;
    };
    res.redirect('/x');
    expect(c.redirect).toHaveBeenLastCalledWith('/x', undefined);
    res.redirect(301, '/y');
    expect(c.redirect).toHaveBeenLastCalledWith('/y', 301);
    res.redirect('/z', 302);
    expect(c.redirect).toHaveBeenLastCalledWith('/z', 302);
  });

  it('cookie overlay writes Set-Cookie via ctx.set', () => {
    const c = ctx();
    const res = createResponseProxy({ ctx: c, rawRes: resTarget(), onTerminal: vi.fn() }) as {
      cookie: (n: string, v: string, o?: { maxAge: number }) => unknown;
    };
    res.cookie('sid', 'x', { maxAge: 1000 });
    expect(c.set).toHaveBeenCalledWith('Set-Cookie', expect.stringContaining('Max-Age=1'));
  });

  it('set statusCode / writeHead overlays', () => {
    const c = ctx();
    const raw = resTarget();
    const res = createResponseProxy({ ctx: c, rawRes: raw, onTerminal: vi.fn() }) as Record<string, unknown>;
    res.statusCode = 201;
    expect(c.status).toBe(201);
    res.writeHead = function replacedWriteHead(): void {};
    expect(raw.writeHead).toBeInstanceOf(Function);
  });

  it('headersSent and locals overlays', () => {
    const res = createResponseProxy({ ctx: ctx(), rawRes: resTarget(), onTerminal: vi.fn() }) as {
      headersSent: boolean;
      locals: Record<string, unknown>;
    };
    expect(res.headersSent).toBe(false);
    expect(Object.getPrototypeOf(res.locals)).toBeNull();
  });

  it('has returns true for overlay, target, and state keys', () => {
    const c = ctx();
    c.state.custom = 'x';
    const res = createResponseProxy({ ctx: c, rawRes: resTarget(), onTerminal: vi.fn() });
    expect('status' in (res as object)).toBe(true);
    expect('existing' in (res as object)).toBe(true);
    expect('custom' in (res as object)).toBe(true);
  });

  it('set throws on unsupported response API', () => {
    const res = createResponseProxy({ ctx: ctx(), rawRes: resTarget(), onTerminal: vi.fn() }) as Record<string, unknown>;
    expect(() => {
      res.render = 'x';
    }).toThrow(UnsupportedExpressApiError);
  });

  it('defineProperty passes through to target', () => {
    const raw = resTarget();
    const res = createResponseProxy({ ctx: ctx(), rawRes: raw, onTerminal: vi.fn() }) as object;
    Object.defineProperty(res, 'existing', { value: 'defined' });
    expect(raw.existing).toBe('defined');
  });

  it('defineProperty with statusCode overlays', () => {
    const c = ctx();
    const res = createResponseProxy({ ctx: c, rawRes: resTarget(), onTerminal: vi.fn() }) as object;
    Object.defineProperty(res, 'statusCode', { value: 418 });
    expect(c.status).toBe(418);
  });

  it('getPrototypeOf returns the real prototype', () => {
    const raw = resTarget();
    const res = createResponseProxy({ ctx: ctx(), rawRes: raw, onTerminal: vi.fn() }) as object;
    expect(Object.getPrototypeOf(res)).toBe(Object.getPrototypeOf(raw));
  });
});

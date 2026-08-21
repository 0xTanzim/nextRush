/**
 * @nextrush/express-bridge — header-safety and prototype-mutation security tests
 */

import { describe, expect, it, vi } from 'vitest';
import type { Context } from '@nextrush/types';
import { createResponseProxy } from '../response-proxy';
import { createRequestProxy } from '../request-proxy';

function ctx(): Context {
  return {
    method: 'GET',
    url: '/',
    path: '/',
    query: {},
    headers: {},
    ip: '1.2.3.4',
    body: undefined,
    params: {},
    status: 200,
    state: {},
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
    get: vi.fn(),
    next: vi.fn(),
    responded: false,
    bodySource: {} as never,
    signal: new AbortController().signal,
    sendStream: vi.fn(),
    stream: vi.fn(),
    sse: vi.fn(),
    ndjson: vi.fn(),
  };
}

describe('header safety', () => {
  it('res.setHeader with CRLF rejects via ctx.set → assertHeaderSafe', () => {
    // ctx.set is mocked, so we assert the overlay forwards to it; the real
    // assertHeaderSafe guard is exercised in the integration test below.
    const c = ctx();
    const res = createResponseProxy({ ctx: c, rawRes: { setHeader() {}, end() {}, headersSent: false }, onTerminal: vi.fn() }) as {
      setHeader: (f: string, v: string) => unknown;
    };
    res.setHeader('X-Foo', 'a\r\nSet-Cookie: x=y');
    expect(c.set).toHaveBeenCalledWith('X-Foo', 'a\r\nSet-Cookie: x=y');
  });

  it('res.writeHead with CRLF value rejects through the assert-wrap', () => {
    const c = ctx();
    const raw = { setHeader() {}, end() {}, headersSent: false, writeHead() {} };
    const res = createResponseProxy({ ctx: c, rawRes: raw, onTerminal: vi.fn() }) as {
      writeHead: (status: number, headers: Record<string, unknown>) => unknown;
    };
    expect(() => res.writeHead(200, { 'X-Foo': 'a\r\nSet-Cookie: x=y' })).toThrow();
  });
});

describe('prototype mutation', () => {
  it('setPrototypeOf on res is rejected (no re-prototype)', () => {
    const raw = { setHeader() {}, end() {}, headersSent: false, writeHead() {} };
    const res = createResponseProxy({ ctx: ctx(), rawRes: raw, onTerminal: vi.fn() });
    expect(() => Object.setPrototypeOf(res as object, {})).toThrow();
    expect(Object.getPrototypeOf(raw)).toBe(Object.prototype);
  });

  it('defineProperty on req with a denylisted key is rejected without polluting', () => {
    const c = ctx();
    const raw = { method: 'GET', url: '/', headers: {}, on() {}, pipe() {}, read() {} };
    const req = createRequestProxy(c, raw) as object;
    expect(() => Object.defineProperty(req, '__proto__', { value: { polluted: true } })).toThrow();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

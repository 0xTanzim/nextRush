/**
 * @nextrush/express-bridge — `compat()` arity + wrapping tests
 */

import { describe, expect, it, vi } from 'vitest';
import type { Context } from '@nextrush/types';
import { compat } from '../compat';
import { ExpressBridgeArityError, ExpressBridgeCapabilityError } from '../errors';

function ctx(partial: Partial<Context> = {}): Context {
  const state: Record<string, unknown> = {};
  return {
    method: 'GET',
    url: '/',
    path: '/',
    query: {},
    headers: {},
    ip: '127.0.0.1',
    body: undefined,
    params: {},
    status: 200,
    state,
    cookies: {} as never,
    raw: {
      req: { on() {}, method: 'GET', url: '/', headers: {} },
      res: { setHeader() {}, end() {}, headersSent: false, statusCode: 200, writeHead() {} },
    },
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
    ...partial,
  };
}

describe('compat() registration-time checks', () => {
  it('accepts a 3-arity function', () => {
    const fn = (_req: unknown, _res: unknown, _next: unknown): void => {};
    expect(() => compat(fn)).not.toThrow();
  });

  it('throws for a 4-arity function', () => {
    const fn = (_err: unknown, _req: unknown, _res: unknown, _next: unknown): void => {};
    expect(() => compat(fn)).toThrow(ExpressBridgeArityError);
  });

  it('throws for an array', () => {
    expect(() => compat([] as never)).toThrow(ExpressBridgeArityError);
  });

  it('throws for a non-function', () => {
    expect(() => compat(42 as never)).toThrow(ExpressBridgeArityError);
  });
});

describe('compat() request execution', () => {
  it('wraps a 3-arity middleware and calls next() to delegate downstream', async () => {
    const calls: string[] = [];
    const fn = (_req: unknown, _res: unknown, next: (err?: unknown) => void): void => {
      calls.push('mw');
      next();
    };
    const mw = compat(fn);
    await mw(ctx(), async () => {
      calls.push('downstream');
    });
    expect(calls).toEqual(['mw', 'downstream']);
  });

  it('refuses Web-shaped ctx.raw before calling fn', async () => {
    const fn = vi.fn((_req: unknown, _res: unknown, _next: unknown): void => {});
    const mw = compat(fn);
    await expect(
      mw(ctx({ raw: { req: new Request('http://x'), res: undefined } }), async () => {})
    ).rejects.toBeInstanceOf(ExpressBridgeCapabilityError);
    expect(fn).not.toHaveBeenCalled();
  });

  it('next(err) rejects into the pipeline', async () => {
    const err = new Error('boom');
    const fn = (_req: unknown, _res: unknown, next: (e?: unknown) => void): void => next(err);
    const mw = compat(fn);
    await expect(mw(ctx(), async () => {})).rejects.toBe(err);
  });

  it('terminal response skips downstream', async () => {
    const downstream = vi.fn(async () => {});
    const fn = (_req: unknown, res: { json: (b: unknown) => void }, _next: unknown): void => {
      (res as { json: (b: unknown) => void }).json({ ok: true });
    };
    const mw = compat(fn);
    await mw(ctx(), downstream);
    expect(downstream).not.toHaveBeenCalled();
  });
});

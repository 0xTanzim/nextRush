/**
 * @nextrush/express-bridge — continuation state machine tests (RFC-035 §8.6)
 */

import { describe, expect, it, vi } from 'vitest';
import type { Context } from '@nextrush/types';
import { createContinuation } from '../continuation';
import { ExpressBridgeProtocolError, UnsupportedExpressApiError } from '../errors';

function ctx(partial: Partial<Context> = {}): Context {
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
    ...partial,
  };
}

function downstream(): Promise<void> {
  return Promise.resolve();
}

describe('continuation state machine', () => {
  it('next() awaits downstream and fulfills', async () => {
    const c = ctx();
    const downstreamSpy = vi.fn(downstream);
    const cont = createContinuation({ ctx: c, downstream: downstreamSpy, rawRes: {} });

    cont.expressNext();
    await expect(cont.promise).resolves.toBeUndefined();
    expect(downstreamSpy).toHaveBeenCalledOnce();
    expect(cont.state).toBe('continued');
  });

  it('next(err) rejects into the error pipeline', async () => {
    const err = new Error('boom');
    const downstreamSpy = vi.fn(downstream);
    const cont = createContinuation({ ctx: ctx(), downstream: downstreamSpy, rawRes: {} });

    cont.expressNext(err);
    await expect(cont.promise).rejects.toBe(err);
    expect(downstreamSpy).not.toHaveBeenCalled();
    expect(cont.state).toBe('error');
  });

  it('fail() rejects with the original error', async () => {
    const err = new Error('sync');
    const cont = createContinuation({ ctx: ctx(), downstream, rawRes: {} });
    cont.fail(err);
    await expect(cont.promise).rejects.toBe(err);
  });

  it('terminal markTerminated() fulfills without downstream', async () => {
    const downstreamSpy = vi.fn(downstream);
    const cont = createContinuation({ ctx: ctx(), downstream: downstreamSpy, rawRes: {} });
    cont.markTerminated();
    await expect(cont.promise).resolves.toBeUndefined();
    expect(downstreamSpy).not.toHaveBeenCalled();
    expect(cont.state).toBe('terminated');
  });

  it('thenable hang fails closed', async () => {
    const cont = createContinuation({ ctx: ctx(), downstream, rawRes: {} });
    cont.adoptReturn(Promise.resolve());
    await expect(cont.promise).rejects.toBeInstanceOf(ExpressBridgeProtocolError);
    expect(cont.state).toBe('protocolError');
  });

  it('thenable that commits a response is terminal, not hanging', async () => {
    const c = ctx({ responded: true });
    const cont = createContinuation({ ctx: c, downstream, rawRes: {} });
    cont.adoptReturn(Promise.resolve());
    await expect(cont.promise).resolves.toBeUndefined();
    expect(cont.state).toBe('terminated');
  });

  it('thenable with raw headersSent is terminal, not hanging', async () => {
    const cont = createContinuation({ ctx: ctx(), downstream, rawRes: { headersSent: true } });
    cont.adoptReturn(Promise.resolve());
    await expect(cont.promise).resolves.toBeUndefined();
    expect(cont.state).toBe('terminated');
  });

  it('non-thenable return is Express continuation (not failed)', async () => {
    const cont = createContinuation({ ctx: ctx(), downstream, rawRes: {} });
    cont.adoptReturn(undefined);
    // Still idle; awaiting downstream would hang. Just assert state + unsettled.
    expect(cont.state).toBe('idle');
    let settled = false;
    void cont.promise.then(
      () => (settled = true),
      () => (settled = true)
    );
    await Promise.resolve();
    expect(settled).toBe(false);
  });

  it('next(); next() first wins, second is no-op', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const downstreamSpy = vi.fn(downstream);
      const cont = createContinuation({ ctx: ctx(), downstream: downstreamSpy, rawRes: {} });
      cont.expressNext();
      cont.expressNext();
      await expect(cont.promise).resolves.toBeUndefined();
      expect(downstreamSpy).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });

  it('next(err); next() first wins, second is no-op', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const err = new Error('boom');
      const cont = createContinuation({ ctx: ctx(), downstream, rawRes: {} });
      cont.expressNext(err);
      cont.expressNext();
      await expect(cont.promise).rejects.toBe(err);
    } finally {
      warn.mockRestore();
    }
  });

  it('response then next(): response wins (warned no-op)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const downstreamSpy = vi.fn(downstream);
      const cont = createContinuation({ ctx: ctx(), downstream: downstreamSpy, rawRes: {} });
      cont.markTerminated();
      cont.expressNext();
      await expect(cont.promise).resolves.toBeUndefined();
      expect(downstreamSpy).not.toHaveBeenCalled();
      expect(cont.state).toBe('terminated');
    } finally {
      warn.mockRestore();
    }
  });

  it('next(); next("route") does not throw and does not double-settle', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const cont = createContinuation({ ctx: ctx(), downstream, rawRes: {} });
      cont.expressNext();
      expect(() => cont.expressNext('route')).not.toThrow();
      await expect(cont.promise).resolves.toBeUndefined();
    } finally {
      warn.mockRestore();
    }
  });

  it('idle next("route") throws UnsupportedExpressApiError', () => {
    const cont = createContinuation({ ctx: ctx(), downstream, rawRes: {} });
    expect(() => cont.expressNext('route')).toThrow(UnsupportedExpressApiError);
  });

  it('next(); thenable rejection later is ignored (first continuation wins)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const cont = createContinuation({ ctx: ctx(), downstream, rawRes: {} });
      cont.expressNext();
      cont.adoptReturn(Promise.reject(new Error('late')));
      await expect(cont.promise).resolves.toBeUndefined();
    } finally {
      warn.mockRestore();
    }
  });

  it('setImmediate next() is not a hang', async () => {
    const cont = createContinuation({ ctx: ctx(), downstream, rawRes: {} });
    cont.adoptReturn(undefined);
    await new Promise<void>((resolve) => setImmediate(() => {
      cont.expressNext();
      resolve();
    }));
    await expect(cont.promise).resolves.toBeUndefined();
  });
});

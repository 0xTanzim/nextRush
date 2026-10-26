import { describe, expect, it, vi } from 'vitest';
import { compose } from '../middleware';
import { RESOLVED_PROMISE, type Context } from '@nextrush/types';

function makeContext(): Context {
  let _next: (() => Promise<void>) | undefined;
  return {
    method: 'GET',
    path: '/hit',
    status: 200,
    responded: false,
    headers: {},
    params: {},
    state: {},
    setNext(fn: () => Promise<void>) {
      _next = fn;
    },
    next() {
      if (!_next) return Promise.reject(new Error('no next'));
      return _next();
    },
  } as unknown as Context;
}

describe('Middleware len === 2 fast path (composedTwo)', () => {
  it('executes two middleware in order', async () => {
    const order: number[] = [];
    const mw1 = (_ctx: Context, next: () => Promise<void>) => {
      order.push(1);
      return next();
    };
    const mw2 = () => {
      order.push(2);
    };

    const fn = compose([mw1, mw2]);
    const ctx = makeContext();
    const res = fn(ctx);
    expect(res).toBe(RESOLVED_PROMISE);
    expect(order).toEqual([1, 2]);
  });

  it('short-circuits when first middleware does not call next()', async () => {
    const order: number[] = [];
    const mw1 = () => {
      order.push(1);
    };
    const mw2 = () => {
      order.push(2);
    };

    const fn = compose([mw1, mw2]);
    const ctx = makeContext();
    const res = fn(ctx);
    expect(res).toBe(RESOLVED_PROMISE);
    expect(order).toEqual([1]);
  });

  it('supports asynchronous two-middleware stacks with onion ordering', async () => {
    const order: number[] = [];
    const mw1 = async (_ctx: Context, next: () => Promise<void>) => {
      order.push(1);
      await next();
      order.push(4);
    };
    const mw2 = async () => {
      order.push(2);
      await new Promise((r) => setTimeout(r, 10));
      order.push(3);
    };

    const fn = compose([mw1, mw2]);
    const ctx = makeContext();
    await fn(ctx);
    expect(order).toEqual([1, 2, 3, 4]);
  });

  it('rejects with "next() called multiple times" when first calls next twice', async () => {
    const mw1 = async (_ctx: Context, next: () => Promise<void>) => {
      await next();
      await next();
    };
    const mw2 = () => {};

    const fn = compose([mw1, mw2]);
    const ctx = makeContext();
    await expect(fn(ctx)).rejects.toThrow('next() called multiple times');
  });

  it('rejects with "next() called multiple times" when second calls next twice', async () => {
    const mw1 = (_ctx: Context, next: () => Promise<void>) => next();
    const mw2 = async (_ctx: Context, next: () => Promise<void>) => {
      await next();
      await next();
    };

    const fn = compose([mw1, mw2]);
    const ctx = makeContext();
    await expect(fn(ctx)).rejects.toThrow('next() called multiple times');
  });

  it('rejects with "next() called multiple times" across ctx.next()', async () => {
    const mw1 = async (ctx: Context) => {
      await ctx.next();
      await ctx.next();
    };
    const mw2 = () => {};

    const fn = compose([mw1, mw2]);
    const ctx = makeContext();
    await expect(fn(ctx)).rejects.toThrow('next() called multiple times');
  });

  it('converts synchronous throws in first middleware to rejected promise', async () => {
    const mw1 = () => {
      throw new Error('sync err in first');
    };
    const mw2 = () => {};

    const fn = compose([mw1, mw2]);
    const ctx = makeContext();
    await expect(fn(ctx)).rejects.toThrow('sync err in first');
  });

  it('converts synchronous throws in second middleware to rejected promise', async () => {
    const mw1 = (_ctx: Context, next: () => Promise<void>) => next();
    const mw2 = () => {
      throw new Error('sync err in second');
    };

    const fn = compose([mw1, mw2]);
    const ctx = makeContext();
    await expect(fn(ctx)).rejects.toThrow('sync err in second');
  });

  it('converts non-Error throws to new Error(String(err))', async () => {
    const mw1 = () => {
      throw 'string error';
    };
    const mw2 = () => {};

    const fn = compose([mw1, mw2]);
    const ctx = makeContext();
    await expect(fn(ctx)).rejects.toThrow('string error');
  });

  it('emits double-response warning when enabled and ctx.responded is true', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mw1 = (ctx: Context, next: () => Promise<void>) => {
      Object.defineProperty(ctx, 'responded', { value: true, configurable: true });
      return next();
    };
    const mw2 = () => {};

    const fn = compose([mw1, mw2], { warnDoubleResponse: true });
    const ctx = makeContext();
    await fn(ctx);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('Middleware at index 0 called next()');
    warnSpy.mockRestore();
  });

  it('preserves RESOLVED_PROMISE reference identity across synchronous settlement', () => {
    const mw1 = (_ctx: Context, next: () => Promise<void>) => next();
    const mw2 = () => RESOLVED_PROMISE;

    const fn = compose([mw1, mw2]);
    const ctx = makeContext();
    const res = fn(ctx);

    expect(res).toBe(RESOLVED_PROMISE);
  });
});

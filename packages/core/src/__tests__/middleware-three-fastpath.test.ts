import { describe, expect, it, vi } from 'vitest';
import { compose } from '../middleware';
import { DISPATCH_SETTLED_SYNC, RESOLVED_PROMISE, type Context, type DispatchMarkerCarrier } from '@nextrush/types';

function makeContext(): Context & DispatchMarkerCarrier {
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
    next(): Promise<void> {
      if (!_next) {
        return Promise.reject(new Error('no next registered on context'));
      }
      return _next();
    },
  } as unknown as Context & DispatchMarkerCarrier;
}

describe('Middleware len === 3 fast path (composedThree)', () => {
  it('executes three middleware in order', async () => {
    const order: number[] = [];
    const mw1 = async (_ctx: Context, next: () => Promise<void>) => {
      order.push(1);
      await next();
      order.push(6);
    };
    const mw2 = async (_ctx: Context, next: () => Promise<void>) => {
      order.push(2);
      await next();
      order.push(5);
    };
    const mw3 = async (_ctx: Context, next: () => Promise<void>) => {
      order.push(3);
      await next();
      order.push(4);
    };

    const fn = compose([mw1, mw2, mw3]);
    const ctx = makeContext();
    await fn(ctx);

    expect(order).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('short-circuits when second middleware does not call next()', async () => {
    const order: number[] = [];
    const mw1 = async (_ctx: Context, next: () => Promise<void>) => {
      order.push(1);
      await next();
      order.push(4);
    };
    const mw2 = async () => {
      order.push(2);
    };
    const mw3 = async () => {
      order.push(3);
    };

    const fn = compose([mw1, mw2, mw3]);
    const ctx = makeContext();
    await fn(ctx);

    expect(order).toEqual([1, 2, 4]);
  });

  it('rejects with "next() called multiple times" when mw1 calls next twice', async () => {
    const mw1 = async (_ctx: Context, next: () => Promise<void>) => {
      await next();
      await next();
    };
    const mw2 = (_ctx: Context, next: () => Promise<void>) => next();
    const mw3 = () => {};

    const fn = compose([mw1, mw2, mw3]);
    const ctx = makeContext();
    await expect(fn(ctx)).rejects.toThrow('next() called multiple times');
  });

  it('rejects with "next() called multiple times" when mw2 calls next twice', async () => {
    const mw1 = (_ctx: Context, next: () => Promise<void>) => next();
    const mw2 = async (_ctx: Context, next: () => Promise<void>) => {
      await next();
      await next();
    };
    const mw3 = () => {};

    const fn = compose([mw1, mw2, mw3]);
    const ctx = makeContext();
    await expect(fn(ctx)).rejects.toThrow('next() called multiple times');
  });

  it('rejects with "next() called multiple times" when mw3 calls next twice', async () => {
    const mw1 = (_ctx: Context, next: () => Promise<void>) => next();
    const mw2 = (_ctx: Context, next: () => Promise<void>) => next();
    const mw3 = async (_ctx: Context, next: () => Promise<void>) => {
      await next();
      await next();
    };

    const fn = compose([mw1, mw2, mw3]);
    const ctx = makeContext();
    await expect(fn(ctx)).rejects.toThrow('next() called multiple times');
  });

  it('rejects with "next() called multiple times" across ctx.next()', async () => {
    const mw1 = async (ctx: Context) => {
      await ctx.next();
      await ctx.next();
    };
    const mw2 = (ctx: Context) => ctx.next();
    const mw3 = () => {};

    const fn = compose([mw1, mw2, mw3]);
    const ctx = makeContext();
    await expect(fn(ctx)).rejects.toThrow('next() called multiple times');
  });

  it('converts synchronous throws to rejected promise', async () => {
    const mw1 = (_ctx: Context, next: () => Promise<void>) => next();
    const mw2 = () => {
      throw new Error('sync throw in mw2');
    };
    const mw3 = () => {};

    const fn = compose([mw1, mw2, mw3]);
    const ctx = makeContext();
    await expect(fn(ctx)).rejects.toThrow('sync throw in mw2');
  });

  it('preserves RESOLVED_PROMISE reference identity across synchronous settlement', () => {
    const mw1 = (_ctx: Context, next: () => Promise<void>) => next();
    const mw2 = (_ctx: Context, next: () => Promise<void>) => next();
    const mw3 = () => RESOLVED_PROMISE;

    const fn = compose([mw1, mw2, mw3]);
    const ctx = makeContext();
    const res = fn(ctx);

    expect(res).toBe(RESOLVED_PROMISE);
  });

  it('marks DISPATCH_SETTLED_SYNC when the entire chain completes synchronously', () => {
    const mw1 = (_ctx: Context, next: () => Promise<void>) => next();
    const mw2 = (_ctx: Context, next: () => Promise<void>) => next();
    const mw3 = (_ctx: Context, next: () => Promise<void>) => next();

    const fn = compose([mw1, mw2, mw3]);
    const ctx = makeContext();
    const res = fn(ctx);

    expect(res).toBe(RESOLVED_PROMISE);
    expect(ctx[DISPATCH_SETTLED_SYNC]).toBe(true);
  });

  it('emits double-response warning for index 1 when ctx.responded is true', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mw1 = (_ctx: Context, next: () => Promise<void>) => next();
    const mw2 = (ctx: Context, next: () => Promise<void>) => {
      Object.defineProperty(ctx, 'responded', { value: true, configurable: true });
      return next();
    };
    const mw3 = () => {};

    const fn = compose([mw1, mw2, mw3], { warnDoubleResponse: true });
    const ctx = makeContext();
    await fn(ctx);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('Middleware at index 1 called next()');
    warnSpy.mockRestore();
  });
});

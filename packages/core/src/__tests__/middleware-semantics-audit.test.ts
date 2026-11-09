import { describe, expect, it, vi } from 'vitest';
import { compose } from '../middleware';
import { Application } from '../application';
import { RESOLVED_PROMISE, type Context, type Middleware } from '@nextrush/types';
import { createMockContext } from './_shared/create-mock-context';

function nextAwareContext(overrides: Partial<Context> = {}): Context {
  let stored: () => Promise<void> = () => Promise.resolve();
  return createMockContext({
    setNext: (fn: () => Promise<void>) => {
      stored = fn;
    },
    next: () => stored(),
    ...overrides,
  });
}

describe('Phase 2 — Middleware Semantics First-Principles Audit', () => {
  // 1. Synchronous middleware return
  it('1. synchronous middleware return settles to RESOLVED_PROMISE', () => {
    const fn = compose([
      (_ctx, next) => next(),
      () => undefined,
    ]);
    const ctx = nextAwareContext();
    const res = fn(ctx);
    expect(res).toBe(RESOLVED_PROMISE);
  });

  // 2. Synchronous next() continuation
  it('2. synchronous next() continuation executes in strict FIFO then LIFO order', async () => {
    const order: number[] = [];
    const fn = compose([
      (_ctx, next) => {
        order.push(1);
        const p = next();
        order.push(2);
        return p;
      },
      () => {
        order.push(3);
      },
    ]);
    const ctx = nextAwareContext();
    await fn(ctx);
    expect(order).toEqual([1, 3, 2]);
  });

  // 3. Asynchronous middleware return
  it('3. asynchronous middleware return adopts returned promise', async () => {
    let resolved = false;
    const fn = compose([
      async () => {
        await new Promise((r) => setTimeout(r, 10));
        resolved = true;
      },
    ]);
    const ctx = nextAwareContext();
    await fn(ctx);
    expect(resolved).toBe(true);
  });

  // 4. next() awaited by middleware (Onion model)
  it('4. next() awaited by middleware preserves onion execution across 2 and 3 middleware', async () => {
    const order: string[] = [];
    const fn2 = compose([
      async (_ctx, next) => {
        order.push('1-in');
        await next();
        order.push('1-out');
      },
      async () => {
        order.push('2-in');
        await new Promise((r) => setTimeout(r, 5));
        order.push('2-out');
      },
    ]);
    await fn2(nextAwareContext());
    expect(order).toEqual(['1-in', '2-in', '2-out', '1-out']);

    order.length = 0;
    const fn3 = compose([
      async (_ctx, next) => {
        order.push('1-in');
        await next();
        order.push('1-out');
      },
      async (_ctx, next) => {
        order.push('2-in');
        await next();
        order.push('2-out');
      },
      async () => {
        order.push('3-in');
        order.push('3-out');
      },
    ]);
    await fn3(nextAwareContext());
    expect(order).toEqual(['1-in', '2-in', '3-in', '3-out', '2-out', '1-out']);
  });

  // 5. Middleware calling next() without awaiting it
  it('5. middleware calling next() without awaiting returns valid promise', async () => {
    let downstreamDone = false;
    const fn = compose([
      (_ctx, next) => {
        return next();
      },
      async () => {
        await new Promise((r) => setTimeout(r, 5));
        downstreamDone = true;
      },
    ]);
    await fn(nextAwareContext());
    expect(downstreamDone).toBe(true);
  });

  // 6. Rejected promises before continuation
  it('6. rejected promises before continuation reject upstream immediately', async () => {
    const downstream = vi.fn();
    const fn = compose([
      async () => {
        throw new Error('fail before next');
      },
      downstream,
    ]);
    await expect(fn(nextAwareContext())).rejects.toThrow('fail before next');
    expect(downstream).not.toHaveBeenCalled();
  });

  // 7. Rejected promises after continuation
  it('7. rejected promises downstream propagate up to awaiting upstream', async () => {
    let caughtInUpstream = false;
    const fn = compose([
      async (_ctx, next) => {
        try {
          await next();
        } catch (err: any) {
          if (err.message === 'downstream boom') caughtInUpstream = true;
          throw err;
        }
      },
      async () => {
        throw new Error('downstream boom');
      },
    ]);
    await expect(fn(nextAwareContext())).rejects.toThrow('downstream boom');
    expect(caughtInUpstream).toBe(true);
  });

  // 8. Synchronous exceptions
  it('8. synchronous exceptions are converted to rejected promises', async () => {
    const fn = compose([
      () => {
        throw new Error('sync throw');
      },
    ]);
    await expect(fn(nextAwareContext())).rejects.toThrow('sync throw');
  });

  // 9. Exceptions thrown after an await
  it('9. exceptions thrown after an await bubble up properly', async () => {
    const fn = compose([
      async (_ctx, next) => {
        await next();
        throw new Error('throw after await');
      },
      () => undefined,
    ]);
    await expect(fn(nextAwareContext())).rejects.toThrow('throw after await');
  });

  // 10. Multiple or repeated next() calls
  it('10. multiple next() calls reject with next() called multiple times', async () => {
    const fn = compose([
      async (_ctx, next) => {
        await next();
        await next();
      },
      () => undefined,
    ]);
    await expect(fn(nextAwareContext())).rejects.toThrow('next() called multiple times');
  });

  // 11. Errors passed through framework error-handling mechanism
  it('11. errors are caught and processed by Application.handleError exactly once', async () => {
    const app = new Application();
    const errorHandlerSpy = vi.fn();
    app.setErrorHandler(errorHandlerSpy);

    app.use(async () => {
      throw new Error('app error');
    });

    const callback = app.callback();
    const ctx = nextAwareContext();
    await callback(ctx);

    expect(errorHandlerSpy).toHaveBeenCalledTimes(1);
    expect(errorHandlerSpy.mock.calls[0]?.[0]?.message).toBe('app error');
  });

  // 12. ctx.setNext wiring and nested dispatch
  it('12. ctx.setNext interoperates across nested composition boundaries', async () => {
    const order: string[] = [];
    const inner = compose([
      async (ctx) => {
        order.push('inner-before');
        await ctx.next();
        order.push('inner-after');
      },
    ]);

    const outer = compose([
      async (ctx) => {
        order.push('outer-before');
        await ctx.next();
        order.push('outer-after');
      },
      inner,
    ]);

    const ctx = nextAwareContext();
    await outer(ctx, async () => {
      order.push('leaf');
    });

    expect(order).toEqual([
      'outer-before',
      'inner-before',
      'leaf',
      'inner-after',
      'outer-after',
    ]);
  });

  // 13. Middleware short-circuiting without calling next()
  it('13. middleware short-circuiting prevents downstream execution', async () => {
    const order: string[] = [];
    const fn = compose([
      () => {
        order.push('first');
        // no next()
      },
      () => {
        order.push('second');
      },
      () => {
        order.push('third');
      },
    ]);

    const ctx = nextAwareContext();
    const res = fn(ctx);
    expect(res).toBe(RESOLVED_PROMISE);
    expect(order).toEqual(['first']);
  });

  // 14. Fallback to generic runner for len >= 4
  it('14. stacks of 4 or more middleware preserve identical semantics on generic runner', async () => {
    const order: number[] = [];
    const mw = (n: number): Middleware => async (_ctx, next) => {
      order.push(n);
      await next();
      order.push(n * 10);
    };

    const fn = compose([mw(1), mw(2), mw(3), mw(4)]);
    await fn(nextAwareContext());
    expect(order).toEqual([1, 2, 3, 4, 40, 30, 20, 10]);
  });
});

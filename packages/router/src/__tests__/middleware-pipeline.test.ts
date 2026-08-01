/**
 * @nextrush/router - Middleware pipeline edge cases
 *
 * Exercises per-route middleware (compiled by `compileExecutor`) across both
 * calling styles — traditional `(ctx, next)` and modern `ctx.next()` — and every
 * pipeline edge case: onion ordering, short-circuit, async ordering, error
 * propagation, state sharing, chain sizes, mixed styles, sync throws, and the
 * double-next() guard.
 */

import type { Context, Middleware, RouteHandler } from '@nextrush/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, Router } from '../router';

/**
 * Context mock whose setNext/next behave like a real adapter context:
 * setNext stores the wired next; ctx.next() invokes it.
 */
function createCtx(overrides: Partial<Context> = {}): Context {
  let stored: () => Promise<void> = () => Promise.resolve();
  return {
    method: 'GET',
    path: '/',
    params: {},
    query: {},
    body: undefined,
    headers: {},
    status: 200,
    state: {},
    responded: false,
    json: vi.fn(),
    send: vi.fn(),
    html: vi.fn(),
    redirect: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    setNext: (fn: () => Promise<void>) => {
      stored = fn;
    },
    next: () => stored(),
    raw: { req: {}, res: {} },
    ...overrides,
  } as unknown as Context;
}

const run = (router: Router, ctx: Context): Promise<void> => router.routes()(ctx, async () => {});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe.each([
  ['traditional (ctx, next)', false],
  ['modern ctx.next()', true],
])('per-route middleware pipeline — %s', (_label, modern) => {
  let router: Router;
  beforeEach(() => {
    router = createRouter();
  });

  /** Build a middleware in the style under test that runs `before`, awaits, then `after`. */
  const layer = (before: (ctx: Context) => void, after?: (ctx: Context) => void): Middleware =>
    modern
      ? (async (ctx: Context) => {
          before(ctx);
          await ctx.next();
          after?.(ctx);
        }) as Middleware
      : (async (ctx: Context, next: () => Promise<void>) => {
          before(ctx);
          await next();
          after?.(ctx);
        }) as Middleware;

  it('runs the onion model: before → handler → after (reverse)', async () => {
    const order: string[] = [];
    router.get(
      '/',
      layer(() => order.push('1-before'), () => order.push('1-after')),
      layer(() => order.push('2-before'), () => order.push('2-after')),
      layer(() => order.push('3-before'), () => order.push('3-after')),
      (async () => {
        order.push('handler');
      }) as RouteHandler
    );

    await run(router, createCtx());

    expect(order).toEqual([
      '1-before',
      '2-before',
      '3-before',
      'handler',
      '3-after',
      '2-after',
      '1-after',
    ]);
  });

  it('short-circuits: a layer that never calls next skips the rest', async () => {
    const order: string[] = [];
    const handler = vi.fn();
    const stop: Middleware = modern
      ? (async () => {
          order.push('stop');
        }) as Middleware
      : (async () => {
          order.push('stop');
        }) as Middleware;

    router.get(
      '/',
      layer(() => order.push('a')),
      stop,
      layer(() => order.push('b')),
      handler as RouteHandler
    );

    await run(router, createCtx());

    expect(order).toEqual(['a', 'stop']);
    expect(handler).not.toHaveBeenCalled();
  });

  it('preserves order across async delays', async () => {
    const order: number[] = [];
    const delayed = (n: number, ms: number): Middleware =>
      modern
        ? (async (ctx: Context) => {
            await sleep(ms);
            order.push(n);
            await ctx.next();
          }) as Middleware
        : (async (ctx: Context, next: () => Promise<void>) => {
            await sleep(ms);
            order.push(n);
            await next();
          }) as Middleware;

    router.get('/', delayed(1, 5), delayed(2, 1), delayed(3, 3), (async () => {
      order.push(4);
    }) as RouteHandler);

    await run(router, createCtx());
    expect(order).toEqual([1, 2, 3, 4]);
  });

  it('propagates an error thrown in a middleware and skips the handler', async () => {
    const handler = vi.fn();
    const boom: Middleware = (async () => {
      throw new Error('mw boom');
    }) as Middleware;

    router.get('/', layer(() => {}), boom, handler as RouteHandler);

    await expect(run(router, createCtx())).rejects.toThrow('mw boom');
    expect(handler).not.toHaveBeenCalled();
  });

  it('propagates an error thrown by the handler', async () => {
    router.get('/', layer(() => {}), (async () => {
      throw new Error('handler boom');
    }) as RouteHandler);

    await expect(run(router, createCtx())).rejects.toThrow('handler boom');
  });

  it('propagates a synchronous throw in a middleware', async () => {
    const sync: Middleware = ((_ctx: Context) => {
      throw new Error('sync boom');
    }) as Middleware;

    router.get('/', sync, (async () => {}) as RouteHandler);

    await expect(run(router, createCtx())).rejects.toThrow('sync boom');
  });

  it('shares ctx.state across all layers', async () => {
    router.get(
      '/',
      layer((ctx) => {
        ctx.state.a = 1;
      }),
      layer((ctx) => {
        ctx.state.b = 2;
      }),
      (async (ctx: Context) => {
        ctx.state.c = 3;
      }) as RouteHandler
    );

    const ctx = createCtx();
    await run(router, ctx);
    expect(ctx.state).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('runs a 10-layer chain in order (general dispatch path)', async () => {
    const order: number[] = [];
    const layers = Array.from({ length: 10 }, (_, i) => layer(() => order.push(i + 1)));
    router.get('/', ...layers, (async () => {
      order.push(0);
    }) as RouteHandler);

    await run(router, createCtx());
    expect(order).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0]);
  });

  it.each([1, 2, 3, 5])('runs correctly with %i middleware layer(s)', async (count) => {
    const order: number[] = [];
    const layers = Array.from({ length: count }, (_, i) => layer(() => order.push(i + 1)));
    router.get('/', ...layers, (async () => {
      order.push(0);
    }) as RouteHandler);

    await run(router, createCtx());
    expect(order).toEqual([...Array.from({ length: count }, (_, i) => i + 1), 0]);
  });
});

describe('per-route middleware pipeline — cross-cutting', () => {
  let router: Router;
  beforeEach(() => {
    router = createRouter();
  });

  it('interleaves traditional and modern styles in one chain', async () => {
    const order: string[] = [];
    router.get(
      '/',
      (async (ctx: Context) => {
        order.push('m1');
        await ctx.next();
        order.push('m1-after');
      }) as Middleware,
      (async (_ctx: Context, next: () => Promise<void>) => {
        order.push('t2');
        await next();
        order.push('t2-after');
      }) as Middleware,
      (async (ctx: Context) => {
        order.push('m3');
        await ctx.next();
      }) as Middleware,
      (async () => {
        order.push('handler');
      }) as RouteHandler
    );

    await run(router, createCtx());
    expect(order).toEqual(['m1', 't2', 'm3', 'handler', 't2-after', 'm1-after']);
  });

  it('rejects when the next argument is called more than once', async () => {
    const bad: Middleware = (async (_ctx: Context, next: () => Promise<void>) => {
      await next();
      await next();
    }) as Middleware;

    router.get('/', bad, (async () => {}) as RouteHandler);

    await expect(run(router, createCtx())).rejects.toThrow('next() called multiple times');
  });

  it('rejects double-next even after intervening layers', async () => {
    const bad: Middleware = (async (_ctx: Context, next: () => Promise<void>) => {
      await next();
      await next();
    }) as Middleware;

    router.get(
      '/',
      bad,
      (async (_ctx: Context, next: () => Promise<void>) => {
        await next();
      }) as Middleware,
      (async () => {}) as RouteHandler
    );

    await expect(run(router, createCtx())).rejects.toThrow('next() called multiple times');
  });

  it('treats ctx.next() inside the final handler as a safe no-op', async () => {
    let reached = false;
    router.get(
      '/',
      (async (ctx: Context) => {
        await ctx.next();
      }) as Middleware,
      (async (ctx: Context) => {
        reached = true;
        await ctx.next(); // handler calling next() must not throw or re-run anything
      }) as RouteHandler
    );

    await expect(run(router, createCtx())).resolves.toBeUndefined();
    expect(reached).toBe(true);
  });

  it('handler-only route: 2nd-arg next is a safe no-op', async () => {
    let called = false;
    router.get('/', (async (_ctx: Context, next: () => Promise<void>) => {
      called = true;
      await next(); // no middleware — next is NOOP
    }) as RouteHandler);

    await expect(run(router, createCtx())).resolves.toBeUndefined();
    expect(called).toBe(true);
  });
});

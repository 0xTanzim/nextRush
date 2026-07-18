/**
 * @nextrush/router — Dispatch de-async regression contract (NF-1)
 *
 * Executable contract for OpenSpec change
 * `hot-path-dispatch-deasync-and-lazy-state`. The router's primary dispatch
 * middleware (`createRoutesMiddleware`, dispatch.ts) and the no-middleware
 * (`len === 0`) compiled executor (`compileExecutor`, segment-trie.ts) forward
 * the route's promise directly instead of crossing an extra `async` frame,
 * while preserving every observable dispatch semantic.
 *
 * Two kinds of tests:
 *  - STRUCTURAL PROBES (RED before the change): the de-async is proven by
 *    PROMISE IDENTITY — a non-`async` `createRoutesMiddleware` returns the exact
 *    promise its executor returned, and a non-`async` `len === 0` executor
 *    returns a native handler promise unwrapped (`Promise.resolve(p) === p`).
 *    An `async` wrapper necessarily allocates a NEW promise, so these fail
 *    against the current code and pass only once the frames are removed.
 *  - BEHAVIOR CONTRACTS (guarding a *correct* de-async): sync-throw → reject,
 *    async/returned-promise rejection propagation, thenable adoption (RED
 *    against a naive `instanceof Promise` de-async that would drop it),
 *    non-`Error` wrapping, the 404 → `next()` fall-through, the load-bearing
 *    `setNext(NOOP_NEXT)` chain termination (RED against a de-async that drops
 *    the guard), and the untouched `len >= 1` chain.
 */

import type { Context, RouteHandler } from '@nextrush/types';
import { compose } from '@nextrush/core';
import { describe, expect, it, vi } from 'vitest';
import { createRoutesMiddleware } from '../dispatch';
import { compileExecutor } from '../segment-trie';
import { createRouter, type Router } from '../router';

/**
 * Context mock whose setNext/next behave like a real adapter context:
 * setNext stores the wired next; ctx.next() invokes it. Mirrors the helper in
 * middleware-pipeline.test.ts so dispatch behavior is exercised realistically.
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

const run = (router: Router, ctx: Context): Promise<void> =>
  router.routes()(ctx, async () => {});

/** Settle a promise into its resolution or rejection reason without throwing. */
const settle = (p: Promise<unknown>): Promise<unknown> => p.then((v) => v, (e) => e);

// ===========================================================================
// §2.1 — no extra async frame (structural identity probes, RED before change)
// ===========================================================================

describe('NF-1 §2.1: dispatch forwards without an extra async frame', () => {
  it('createRoutesMiddleware returns the executor promise directly (identity)', () => {
    const sentinel = Promise.resolve();
    const match = () => ({
      params: {},
      middleware: [],
      executor: () => sentinel,
      handler: (() => {}) as RouteHandler,
    });
    const mw = createRoutesMiddleware(match as never);

    const returned = mw(createCtx());

    // An `async` wrapper allocates a new promise; a direct forward returns the
    // very promise the executor produced.
    expect(returned).toBe(sentinel);
  });

  it('the len === 0 executor forwards a native handler promise unwrapped (identity)', () => {
    const p = Promise.resolve();
    const exec = compileExecutor((() => p) as RouteHandler, []);

    // Promise.resolve(p) === p for a native promise; an `async` wrapper would
    // return a distinct promise.
    expect(exec(createCtx())).toBe(p);
  });

  it('a matched synchronous handler still produces a byte-identical response', async () => {
    const router = createRouter();
    router.get('/', ((ctx: Context) => {
      ctx.json({ ok: true });
    }) as RouteHandler);

    const ctx = createCtx();
    await run(router, ctx);

    expect(ctx.json).toHaveBeenCalledWith({ ok: true });
    expect(ctx.status).toBe(200);
  });
});

// ===========================================================================
// §2.2–§2.5 — error / return-shape propagation (behavior contracts)
// ===========================================================================

describe('NF-1 §2.2: a synchronous throw becomes a rejected promise', () => {
  it('the executor never throws synchronously out of dispatch', async () => {
    const exec = compileExecutor((() => {
      throw new Error('sync boom');
    }) as RouteHandler, []);

    let returned: Promise<void> | undefined;
    expect(() => {
      returned = exec(createCtx());
    }).not.toThrow();
    await expect(returned).rejects.toThrow('sync boom');
  });

  it('a synchronous throw reaching the composer still rejects (reaches error handler)', async () => {
    const router = createRouter();
    router.get('/error', (() => {
      throw new Error('kaboom');
    }) as RouteHandler);

    // compose wraps the router like the app does; the rejection must surface.
    const stack = compose([router.routes()]);
    await expect(stack(createCtx({ path: '/error' }), async () => {})).rejects.toThrow('kaboom');
  });
});

describe('NF-1 §2.3: async / returned-promise rejections propagate', () => {
  it('an async handler rejection propagates', async () => {
    const exec = compileExecutor((async () => {
      throw new Error('async boom');
    }) as RouteHandler, []);
    await expect(exec(createCtx())).rejects.toThrow('async boom');
  });

  it('a handler returning a rejected promise propagates', async () => {
    const exec = compileExecutor((() =>
      Promise.reject(new Error('rejected promise'))) as RouteHandler, []);
    await expect(exec(createCtx())).rejects.toThrow('rejected promise');
  });
});

describe('NF-1 §2.4: a thenable handler return is adopted (not dropped)', () => {
  it('awaits a non-Promise thenable so its async work completes', async () => {
    let sideEffectRan = false;
    const thenable = {
      then(resolve: (v?: unknown) => void): void {
        setTimeout(() => {
          sideEffectRan = true;
          resolve();
        }, 5);
      },
    };
    const exec = compileExecutor((() => thenable) as unknown as RouteHandler, []);

    await exec(createCtx());

    // A naive `x instanceof Promise ? x : RESOLVED` de-async would drop the
    // thenable and resolve immediately, leaving this false.
    expect(sideEffectRan).toBe(true);
  });
});

describe('NF-1 §2.5: a non-Error throw is wrapped as Error(String(thrown))', () => {
  it.each([
    ['a string', 'string-error', 'string-error'],
    ['a number', 42, '42'],
    ['null', null, 'null'],
    ['undefined', undefined, 'undefined'],
  ])('wraps %s', async (_label, thrown, expectedMessage) => {
    const exec = compileExecutor((() => {
      throw thrown;
    }) as RouteHandler, []);

    const err = await settle(exec(createCtx()));

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe(expectedMessage);
  });
});

// ===========================================================================
// §2.6 — miss → 404 → next() fall-through (allowedMethods 405)
// ===========================================================================

describe('NF-1 §2.6: a miss sets 404 and forwards next()', () => {
  it('a known-path/unregistered-method miss becomes 405 with Allow via allowedMethods', async () => {
    const router = createRouter();
    router.get('/users', ((ctx: Context) => ctx.json([])) as RouteHandler);

    const ctx = createCtx({ method: 'POST', path: '/users' });
    // routes() sets 404 + forwards next; allowedMethods() (as next) turns it into 405.
    await router.routes()(ctx, () => router.allowedMethods()(ctx, async () => {}));

    expect(ctx.status).toBe(405);
    expect(ctx.set).toHaveBeenCalledWith('Allow', expect.stringContaining('GET'));
  });

  it('a total miss with no next resolves and leaves 404', async () => {
    const router = createRouter();
    router.get('/users', (() => {}) as RouteHandler);

    const ctx = createCtx({ method: 'GET', path: '/nope' });
    await expect(router.routes()(ctx)).resolves.toBeUndefined();
    expect(ctx.status).toBe(404);
  });
});

// ===========================================================================
// §2.7 — load-bearing setNext(NOOP_NEXT) chain termination (NF-4a KEPT)
// ===========================================================================

describe('NF-1 §2.7: setNext(NOOP_NEXT) terminates the chain at the handler', () => {
  it('a route handler calling ctx.next() does NOT advance into app middleware after the router', async () => {
    const router = createRouter();
    let handlerNextResolved = false;
    router.get('/', (async (ctx: Context) => {
      await ctx.next(); // must be a safe no-op, NOT advance into appMw
      handlerNextResolved = true;
    }) as RouteHandler);

    const appMw = vi.fn(async (_ctx: Context, next: () => Promise<void>) => {
      await next();
    });

    // General compose dispatch: middleware mounted AFTER the router. compose
    // wires ctx._next to advance into appMw before running the router; the
    // executor's setNext(NOOP_NEXT) must overwrite that so the handler's
    // ctx.next() cannot leak into appMw.
    const stack = compose([router.routes(), appMw]);
    await stack(createCtx(), async () => {});

    expect(appMw).not.toHaveBeenCalled();
    expect(handlerNextResolved).toBe(true);
  });
});

// ===========================================================================
// §2.8 — the len >= 1 per-route middleware chain is unchanged
// ===========================================================================

describe('NF-1 §2.8: the len >= 1 executor path is unchanged', () => {
  it('preserves onion ordering across a 5-layer ctx.next() chain', async () => {
    const router = createRouter();
    const order: string[] = [];
    const layer = (n: number) =>
      (async (ctx: Context) => {
        order.push(`${n}-before`);
        await ctx.next();
        order.push(`${n}-after`);
      }) as never;

    router.get(
      '/',
      layer(1),
      layer(2),
      layer(3),
      layer(4),
      layer(5),
      (async () => {
        order.push('handler');
      }) as RouteHandler
    );

    await run(router, createCtx());

    expect(order).toEqual([
      '1-before',
      '2-before',
      '3-before',
      '4-before',
      '5-before',
      'handler',
      '5-after',
      '4-after',
      '3-after',
      '2-after',
      '1-after',
    ]);
  });

  it('still rejects when a layer calls next() more than once', async () => {
    const router = createRouter();
    router.get(
      '/',
      (async (_ctx: Context, next: () => Promise<void>) => {
        await next();
        await next();
      }) as never,
      (async () => {}) as RouteHandler
    );

    await expect(run(router, createCtx())).rejects.toThrow('next() called multiple times');
  });
});

/**
 * @nextrush/core — `compose()` return-value adoption contract
 * (`elide-resolved-promise-allocation`)
 *
 * These tests characterize behavior the CURRENT implementation already
 * provides, so they pass BEFORE and AFTER the shared-resolved-promise
 * optimization. They exist because that optimization's one real hazard is
 * short-circuiting a return value that must instead be adopted:
 * `segment-trie.ts` already warns that an `instanceof Promise` test would drop
 * a non-Promise thenable's pending work.
 *
 * @see openspec/changes/elide-resolved-promise-allocation/design.md
 */

import { describe, expect, it } from 'vitest';
import { compose } from '../middleware';
import type { Context, Middleware } from '@nextrush/types';

/** Minimal context mirroring the surface `compose` actually touches. */
function makeCtx(): Context {
  let stored: () => Promise<void> = () => Promise.resolve();
  return {
    responded: false,
    state: {},
    setNext(fn: () => Promise<void>) {
      stored = fn;
    },
    next() {
      return stored();
    },
  } as unknown as Context;
}

/** A no-op passthrough used to force the general (len >= 2) path. */
const passthrough: Middleware = (_ctx, next) => next();

/**
 * Run `body` as the LAST middleware on both compose paths, so every assertion
 * is proven against the `len === 1` fast path and the `len >= 2` general path.
 */
function bothPaths(body: Middleware): Array<[string, ReturnType<typeof compose>]> {
  return [
    ['fast path (len 1)', compose([body])],
    ['general path (len 2)', compose([passthrough, body])],
  ];
}

describe('compose() adopts a non-Promise thenable rather than dropping it', () => {
  for (const [label, composed] of bothPaths((ctx) => {
    // A thenable that is NOT a Promise instance and settles asynchronously.
    return {
      then(resolve: () => void) {
        setTimeout(() => {
          (ctx.state as Record<string, unknown>).thenableFinished = true;
          resolve();
        }, 10);
      },
    } as unknown as Promise<void>;
  })) {
    it(`${label}: does not settle until the thenable settles`, async () => {
      const ctx = makeCtx();
      const promise = composed(ctx);
      // Not yet finished — the thenable's timer has not fired.
      expect((ctx.state as Record<string, unknown>).thenableFinished).toBeUndefined();
      await promise;
      // The side effect MUST have happened before the composed promise settled.
      expect((ctx.state as Record<string, unknown>).thenableFinished).toBe(true);
    });
  }

  it('fast path: a thenable that rejects still rejects the composed promise', async () => {
    const composed = compose([
      () =>
        ({
          then(_res: () => void, rej: (e: Error) => void) {
            setTimeout(() => rej(new Error('thenable failed')), 5);
          },
        }) as unknown as Promise<void>,
    ]);
    await expect(composed(makeCtx())).rejects.toThrow('thenable failed');
  });
});

describe('compose() preserves a falsy-but-defined middleware return', () => {
  // `null`/`false`/`0`/`''` are NOT `undefined` — a `!result` test would be a bug.
  const falsyValues: Array<[string, unknown]> = [
    ['null', null],
    ['false', false],
    ['zero', 0],
    ['empty string', ''],
  ];

  for (const [name, value] of falsyValues) {
    for (const [label, composed] of bothPaths(() => value as unknown as Promise<void>)) {
      it(`${label}: resolves with ${name}, not undefined`, async () => {
        await expect(composed(makeCtx())).resolves.toBe(value);
      });
    }
  }
});

describe('compose() resolves an undefined return to undefined', () => {
  for (const [label, composed] of bothPaths(() => undefined as unknown as Promise<void>)) {
    it(`${label}: synchronous void middleware resolves to undefined`, async () => {
      await expect(composed(makeCtx())).resolves.toBeUndefined();
    });
  }

  it('fast path: a synchronous middleware still runs before the promise settles', async () => {
    const order: string[] = [];
    const composed = compose([
      (ctx) => {
        order.push('middleware');
        (ctx.state as Record<string, unknown>).ran = true;
        return undefined as unknown as Promise<void>;
      },
    ]);
    const ctx = makeCtx();
    const p = composed(ctx);
    // Synchronous middleware body has already executed by the time compose returns.
    expect(order).toEqual(['middleware']);
    await p;
    expect((ctx.state as Record<string, unknown>).ran).toBe(true);
  });
});

describe('a returned resolved promise is safe to share across concurrent invocations', () => {
  it('each concurrent caller runs its own continuation exactly once', async () => {
    const composed = compose([() => undefined as unknown as Promise<void>]);
    const completions: number[] = [];
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        composed(makeCtx()).then(() => {
          completions.push(i);
        })
      )
    );
    expect(completions).toHaveLength(25);
    expect(new Set(completions).size).toBe(25);
  });

  // Attributes the measured allocation reduction to the intended mechanism
  // rather than to unrelated drift: a synchronous middleware must yield the
  // SAME promise object every call, while a promise-returning middleware must
  // still yield its own distinct promise.
  it('a synchronous middleware yields the shared sentinel, an async one does not', () => {
    const ctx = makeCtx();
    const syncComposed = compose([() => undefined as unknown as Promise<void>]);
    expect(syncComposed(ctx)).toBe(syncComposed(ctx));

    const asyncComposed = compose([() => Promise.resolve()]);
    expect(asyncComposed(ctx)).not.toBe(asyncComposed(ctx));
  });
});

/**
 * @nextrush/core - Single-middleware fast-path contract
 *
 * OpenSpec change: core-single-middleware-fastpath.
 *
 * `compose()` gains a dedicated `len === 1` execution path that avoids the
 * recursive `dispatch` closure of the general path. These tests are the
 * regression contract for that path: they pin every observable middleware
 * semantic (next()-call-count detection across 0/1/2/3/n and mixed surfaces,
 * error propagation/wrapping, the double-response warning, setNext wiring, and
 * per-request isolation under concurrency) and assert byte-for-byte parity with
 * the general (`len >= 2`) path.
 *
 * They characterize behavior that must hold identically before and after the
 * fast path is added — a naive fast path that drops the multiple-next() guard,
 * hoists the guard across requests, or diverges the rejection/warning text
 * fails this suite.
 */

import type { Context, Middleware, Next } from '@nextrush/types';
import { describe, expect, it, vi } from 'vitest';
import { compose } from '../middleware';
import { createMockContext } from './_shared/create-mock-context';

const MULTIPLE_NEXT_MESSAGE = 'next() called multiple times';

/**
 * Mock context whose `setNext` stores the wired thunk and whose `ctx.next()`
 * invokes exactly that stored thunk — mirroring the real Context so that the
 * "same guarded thunk on both surfaces" contract (design D3) is observable.
 */
function nextAwareContext(overrides: Partial<Context> = {}): Context {
  let stored: Next = () => Promise.resolve();
  return createMockContext({
    setNext: (fn: Next) => {
      stored = fn;
    },
    next: () => stored(),
    ...overrides,
  });
}

/** A transparent passthrough middleware — used to force the general path with
 * the real middleware still at index 0 (so the double-response warning's
 * index-0 reference is identical on both paths). */
const passthrough: Middleware = (_ctx, next) => (next ? next() : Promise.resolve());

describe('compose: single-middleware fast path — §2 next() call-count', () => {
  it('2.1 next() called once advances the tail and preserves onion ordering', async () => {
    const order: string[] = [];
    const mw: Middleware = async (_ctx, next) => {
      order.push('before');
      await next();
      order.push('after');
    };

    const composed = compose([mw]);
    await composed(nextAwareContext(), async () => {
      order.push('tail');
    });

    expect(order).toEqual(['before', 'tail', 'after']);
  });

  it('2.2 next() called zero times settles without invoking the tail', async () => {
    const tail = vi.fn<Next>().mockResolvedValue(undefined);
    const mw: Middleware = async () => {
      // responds, never calls next()
    };

    const composed = compose([mw]);
    await expect(composed(nextAwareContext(), tail)).resolves.toBeUndefined();
    expect(tail).not.toHaveBeenCalled();
  });

  it('2.3 next() called twice synchronously → second call rejects', async () => {
    let secondCall: Promise<void> | undefined;
    const mw: Middleware = (_ctx, next) => {
      void next();
      secondCall = next();
      return Promise.resolve();
    };

    const composed = compose([mw]);
    await composed(nextAwareContext());
    await expect(secondCall).rejects.toThrow(MULTIPLE_NEXT_MESSAGE);
  });

  it('2.4 next() called three times → both second and third reject', async () => {
    const rejections: Promise<void>[] = [];
    const mw: Middleware = (_ctx, next) => {
      void next();
      rejections.push(next());
      rejections.push(next());
      return Promise.resolve();
    };

    const composed = compose([mw]);
    await composed(nextAwareContext());

    expect(rejections).toHaveLength(2);
    for (const r of rejections) {
      await expect(r).rejects.toThrow(MULTIPLE_NEXT_MESSAGE);
    }
  });

  it.each([4, 5, 8, 16])(
    '2.5 next() called %i times → exactly the first advances, all others reject',
    async (n) => {
      let advanced = 0;
      const laterCalls: Promise<void>[] = [];
      const mw: Middleware = (_ctx, next) => {
        for (let i = 0; i < n; i++) {
          const p = next();
          if (i === 0) {
            void p.then(() => {
              advanced++;
            });
          } else {
            laterCalls.push(p);
          }
        }
        return Promise.resolve();
      };

      const composed = compose([mw]);
      await composed(nextAwareContext(), () => Promise.resolve());

      expect(laterCalls).toHaveLength(n - 1);
      for (const r of laterCalls) {
        await expect(r).rejects.toThrow(MULTIPLE_NEXT_MESSAGE);
      }
      expect(advanced).toBe(1);
    }
  );

  it('2.6 next() called twice with an await in between → second rejects', async () => {
    const mw: Middleware = async (_ctx, next) => {
      await next();
      await next();
    };

    const composed = compose([mw]);
    await expect(composed(nextAwareContext(), () => Promise.resolve())).rejects.toThrow(
      MULTIPLE_NEXT_MESSAGE
    );
  });
});

describe('compose: single-middleware fast path — §3 surface, errors, warning', () => {
  it('3.1 ctx.next() advances the same chain as the next argument', async () => {
    const order: string[] = [];
    const mw: Middleware = async (ctx) => {
      order.push('before');
      await ctx.next();
      order.push('after');
    };

    const composed = compose([mw]);
    await composed(nextAwareContext(), async () => {
      order.push('tail');
    });

    expect(order).toEqual(['before', 'tail', 'after']);
  });

  it('3.2 argument-then-ctx.next() is detected as a double-call', async () => {
    let second: Promise<void> | undefined;
    const mw: Middleware = (ctx, next) => {
      void next();
      second = ctx.next();
      return Promise.resolve();
    };

    const composed = compose([mw]);
    await composed(nextAwareContext());
    await expect(second).rejects.toThrow(MULTIPLE_NEXT_MESSAGE);
  });

  it('3.2 ctx.next()-then-argument is detected as a double-call', async () => {
    let second: Promise<void> | undefined;
    const mw: Middleware = (ctx, next) => {
      void ctx.next();
      second = next();
      return Promise.resolve();
    };

    const composed = compose([mw]);
    await composed(nextAwareContext());
    await expect(second).rejects.toThrow(MULTIPLE_NEXT_MESSAGE);
  });

  it('3.3 a context without setNext runs via the argument and does not throw', async () => {
    const order: string[] = [];
    // Default mock has no setNext.
    const ctx = createMockContext();
    expect(ctx.setNext).toBeUndefined();

    const mw: Middleware = async (_ctx, next) => {
      order.push('before');
      await next();
      order.push('after');
    };

    const composed = compose([mw]);
    await expect(
      composed(ctx, async () => {
        order.push('tail');
      })
    ).resolves.toBeUndefined();
    expect(order).toEqual(['before', 'tail', 'after']);
  });

  it('3.4 a synchronous throw becomes a rejected promise (never a sync throw)', () => {
    const mw: Middleware = () => {
      throw new Error('sync boom');
    };
    const composed = compose([mw]);

    let result: Promise<void>;
    expect(() => {
      result = composed(nextAwareContext());
    }).not.toThrow();
    return expect(result!).rejects.toThrow('sync boom');
  });

  it('3.4 a returned rejected promise propagates', async () => {
    const mw: Middleware = () => Promise.reject(new Error('async boom'));
    const composed = compose([mw]);
    await expect(composed(nextAwareContext())).rejects.toThrow('async boom');
  });

  it.each([
    ['string', 'boom-string'],
    ['number', 42],
    ['null', null],
    ['undefined', undefined],
    ['object', { code: 'X' }],
  ])('3.5 a thrown non-Error (%s) is wrapped as Error(String(value))', async (_label, thrown) => {
    const mw: Middleware = () => {
      throw thrown;
    };
    const composed = compose([mw]);

    await expect(composed(nextAwareContext())).rejects.toThrowError(
      expect.objectContaining({ message: String(thrown) })
    );
    await expect(composed(nextAwareContext())).rejects.toBeInstanceOf(Error);
  });

  it('3.6 an error from the tail next propagates back through the awaiting middleware', async () => {
    const order: string[] = [];
    const mw: Middleware = async (_ctx, next) => {
      order.push('before');
      try {
        await next();
      } catch (err) {
        order.push('caught');
        throw err;
      }
    };

    const composed = compose([mw]);
    await expect(
      composed(nextAwareContext(), () => Promise.reject(new Error('tail boom')))
    ).rejects.toThrow('tail boom');
    expect(order).toEqual(['before', 'caught']);
  });

  it('3.7 double-response warning fires in non-production (index-0 parity)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = nextAwareContext();
    const mw: Middleware = async (c, next) => {
      (c as { responded: boolean }).responded = true;
      await next();
    };

    const composed = compose([mw], { warnDoubleResponse: true });
    await composed(ctx, () => Promise.resolve());

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Middleware at index 0 called next() after the response was already committed')
    );
    warnSpy.mockRestore();
  });

  it('3.7 double-response warning is silent in production', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = nextAwareContext();
    const mw: Middleware = async (c, next) => {
      (c as { responded: boolean }).responded = true;
      await next();
    };

    const composed = compose([mw], { warnDoubleResponse: false });
    await composed(ctx, () => Promise.resolve());

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('compose: single-middleware fast path — §4 concurrency isolation', () => {
  it('4.1 a double-caller does not corrupt a concurrent single-caller', async () => {
    const doubleCaller: Middleware = async (_ctx, next) => {
      await next();
      await next();
    };
    const singleCaller: Middleware = async (_ctx, next) => {
      await next();
    };

    const doubleComposed = compose([doubleCaller]);
    const singleComposed = compose([singleCaller]);

    const [doubleResult, singleResult] = await Promise.allSettled([
      doubleComposed(nextAwareContext(), () => Promise.resolve()),
      singleComposed(nextAwareContext(), () => Promise.resolve()),
    ]);

    expect(doubleResult.status).toBe('rejected');
    expect((doubleResult as PromiseRejectedResult).reason).toHaveProperty(
      'message',
      MULTIPLE_NEXT_MESSAGE
    );
    expect(singleResult.status).toBe('fulfilled');
  });

  it('4.2 high-concurrency mix keeps per-invocation guards independent', async () => {
    const COUNT = 50;
    const mw: Middleware = async (ctx, next) => {
      await next();
      if ((ctx.state as { double?: boolean }).double) {
        await next(); // second call — should reject only for these
      }
    };
    // Fast path: a single composed function reused across all invocations.
    const composed = compose([mw]);

    const results = await Promise.allSettled(
      Array.from({ length: COUNT }, (_v, i) => {
        const ctx = nextAwareContext();
        (ctx.state as { double?: boolean }).double = i % 2 === 0;
        return composed(ctx, () => Promise.resolve());
      })
    );

    results.forEach((r, i) => {
      if (i % 2 === 0) {
        expect(r.status).toBe('rejected');
        expect((r as PromiseRejectedResult).reason).toHaveProperty(
          'message',
          MULTIPLE_NEXT_MESSAGE
        );
      } else {
        expect(r.status).toBe('fulfilled');
      }
    });
  });

  it('4.3 interleaved async execution keeps state isolated', async () => {
    let releaseSlow: () => void = () => {};
    const slowTail = () =>
      new Promise<void>((resolve) => {
        releaseSlow = resolve;
      });

    const mw: Middleware = async (_ctx, next) => {
      await next();
    };
    const composed = compose([mw]);

    const aState: string[] = [];
    const aPromise = composed(nextAwareContext(), slowTail).then(() => {
      aState.push('A-done');
    });

    // B runs to completion while A is parked on the slow tail.
    await composed(nextAwareContext(), () => Promise.resolve());
    expect(aState).toEqual([]); // A still parked

    releaseSlow();
    await aPromise;
    expect(aState).toEqual(['A-done']);
  });
});

describe('compose: general-vs-fast parity harness — §4.4', () => {
  /** Run a behavior through the fast path (1 entry) and the general path
   * (mw at index 0 + trailing transparent passthrough → len 2). */
  async function runBothPaths(
    mw: Middleware,
    tail?: Next,
    options?: { warnDoubleResponse?: boolean }
  ): Promise<{
    fast: PromiseSettledResult<void>;
    general: PromiseSettledResult<void>;
    fastWarnings: unknown[][];
    generalWarnings: unknown[][];
  }> {
    const fastWarnings: unknown[][] = [];
    const generalWarnings: unknown[][] = [];

    const fastSpy = vi.spyOn(console, 'warn').mockImplementation((...args) => {
      fastWarnings.push(args);
    });
    const fastComposed = compose([mw], options);
    const [fast] = await Promise.allSettled([fastComposed(nextAwareContext(), tail)]);
    fastSpy.mockRestore();

    const generalSpy = vi.spyOn(console, 'warn').mockImplementation((...args) => {
      generalWarnings.push(args);
    });
    const generalComposed = compose([mw, passthrough], options);
    const [general] = await Promise.allSettled([generalComposed(nextAwareContext(), tail)]);
    generalSpy.mockRestore();

    return { fast, general, fastWarnings, generalWarnings };
  }

  it('resolves identically for a normal single-next() middleware', async () => {
    const mw: Middleware = async (_ctx, next) => {
      await next();
    };
    const { fast, general } = await runBothPaths(mw, () => Promise.resolve());
    expect(fast.status).toBe('fulfilled');
    expect(general.status).toBe('fulfilled');
  });

  it('rejects identically (same message) for a double-next() middleware', async () => {
    const mw: Middleware = async (_ctx, next) => {
      await next();
      await next();
    };
    const { fast, general } = await runBothPaths(mw, () => Promise.resolve());
    expect(fast.status).toBe('rejected');
    expect(general.status).toBe('rejected');
    expect((fast as PromiseRejectedResult).reason.message).toBe(
      (general as PromiseRejectedResult).reason.message
    );
    expect((fast as PromiseRejectedResult).reason.message).toBe(MULTIPLE_NEXT_MESSAGE);
  });

  it('wraps a thrown non-Error identically on both paths', async () => {
    const mw: Middleware = () => {
      throw 'plain string';
    };
    const { fast, general } = await runBothPaths(mw);
    expect((fast as PromiseRejectedResult).reason.message).toBe(
      (general as PromiseRejectedResult).reason.message
    );
    expect((fast as PromiseRejectedResult).reason.message).toBe('plain string');
  });

  it('emits identical double-response warning text (index 0) on both paths', async () => {
    const mw: Middleware = async (c, next) => {
      (c as { responded: boolean }).responded = true;
      await next();
    };
    const { fastWarnings, generalWarnings } = await runBothPaths(mw, () => Promise.resolve(), {
      warnDoubleResponse: true,
    });
    // The fast path emits exactly one warning (for the middleware at index 0).
    // In the general harness the trailing transparent passthrough legitimately
    // adds its OWN index-1 warning (it too calls next() after responded), so we
    // compare the behavior-under-test warning: the index-0 entry on both paths.
    expect(fastWarnings).toHaveLength(1);
    expect(generalWarnings.length).toBeGreaterThanOrEqual(1);
    expect(fastWarnings[0]).toEqual(generalWarnings[0]);
  });
});

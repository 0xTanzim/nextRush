/**
 * @nextrush/core - Adversarial Middleware & Dispatch Conformance Suite
 *
 * Exhaustive adversarial testing targeting the fundamental invariants of
 * NextRush's middleware engine across all stack sizes (0, 1, 2, 3, 4, 10).
 *
 * Verifies ordering, synchronous/asynchronous continuation, error propagation,
 * double-next guards, unawaited next, context restoration, and canonical sentinels.
 */

import { describe, expect, it } from 'vitest';
import { compose } from '../middleware';
import { MULTIPLE_NEXT_MESSAGE } from '../middleware-fastpaths';
import {
  DISPATCH_SETTLED_SYNC,
  RESOLVED_PROMISE,
  type Context,
  type DispatchMarkerCarrier,
  type Middleware,
} from '@nextrush/types';
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

describe('Adversarial Middleware Suite — Core Dispatch & Boundary Invariants', () => {
  describe('1. Execution Ordering Across All Stack Lengths (0, 1, 2, 3, 4, 8)', () => {
    it.each([0, 1, 2, 3, 4, 8])('preserves strict FIFO entry and LIFO exit for stack size %i', async (size) => {
      const order: number[] = [];
      const stack: Middleware[] = [];

      for (let i = 0; i < size; i++) {
        const id = i + 1;
        stack.push(async (_ctx, next) => {
          order.push(id);
          await next();
          order.push(-id);
        });
      }

      const fn = compose(stack);
      const ctx = nextAwareContext();
      await fn(ctx);

      const expected: number[] = [];
      for (let i = 1; i <= size; i++) expected.push(i);
      for (let i = size; i >= 1; i--) expected.push(-i);

      expect(order).toEqual(expected);
    });
  });

  describe('2. Synchronous Settlement & Canonical Sentinel Identity', () => {
    it.each([0, 1, 2, 3, 4, 8])(
      'returns RESOLVED_PROMISE reference equality when stack of size %i completes synchronously',
      (size) => {
        const stack: Middleware[] = [];
        for (let i = 0; i < size; i++) {
          stack.push((_ctx, next) => next());
        }

        const fn = compose(stack);
        const ctx = nextAwareContext();
        const res = fn(ctx);

        expect(res).toBe(RESOLVED_PROMISE);
        expect((ctx as Context & DispatchMarkerCarrier)[DISPATCH_SETTLED_SYNC]).toBe(true);
      }
    );

    it('returns RESOLVED_PROMISE when middleware returns undefined or RESOLVED_PROMISE explicitly', () => {
      const fn = compose([
        (_ctx, next) => next(),
        (_ctx, next) => {
          next();
          return RESOLVED_PROMISE;
        },
        () => undefined,
      ]);
      const ctx = nextAwareContext();
      const res = fn(ctx);
      expect(res).toBe(RESOLVED_PROMISE);
    });
  });

  describe('3. Short-Circuiting at Every Position', () => {
    it.each([
      { size: 2, haltIndex: 0 },
      { size: 3, haltIndex: 0 },
      { size: 3, haltIndex: 1 },
      { size: 4, haltIndex: 1 },
      { size: 4, haltIndex: 2 },
    ])('halts execution when middleware at index $haltIndex does not call next() in stack of $size', async ({ size, haltIndex }) => {
      const executed: number[] = [];
      const stack: Middleware[] = [];

      for (let i = 0; i < size; i++) {
        const id = i;
        stack.push(async (_ctx, next) => {
          executed.push(id);
          if (id !== haltIndex) {
            await next();
          }
        });
      }

      const fn = compose(stack);
      const ctx = nextAwareContext();
      await fn(ctx);

      expect(executed).toEqual(Array.from({ length: haltIndex + 1 }, (_, i) => i));
    });
  });

  describe('4. Synchronous Exceptions (Pre-Next, Post-Next, and Nested)', () => {
    it('converts synchronous throw before next() into rejected Promise without calling downstream', async () => {
      let downstreamCalled = false;
      const fn = compose([
        () => {
          throw new Error('sync throw before next');
        },
        () => {
          downstreamCalled = true;
          return Promise.resolve();
        },
      ]);
      const ctx = nextAwareContext();
      await expect(fn(ctx)).rejects.toThrow('sync throw before next');
      expect(downstreamCalled).toBe(false);
    });

    it('converts synchronous throw after next() into rejected Promise', async () => {
      const fn = compose([
        (_ctx, next) => {
          next();
          throw new Error('sync throw after next');
        },
        () => undefined,
      ]);
      const ctx = nextAwareContext();
      await expect(fn(ctx)).rejects.toThrow('sync throw after next');
    });

    it('converts non-Error throws to standard Error instances', async () => {
      const fn = compose([
        () => {
          throw 'string-thrown'; // eslint-disable-line no-throw-literal
        },
      ]);
      const ctx = nextAwareContext();
      await expect(fn(ctx)).rejects.toThrow('string-thrown');
    });

    it('bubbles downstream synchronous throw to awaiting upstream try/catch block', async () => {
      let caught = false;
      const fn = compose([
        async (_ctx, next) => {
          try {
            await next();
          } catch (err: unknown) {
            caught = true;
            expect((err as Error).message).toBe('downstream explosion');
          }
        },
        () => {
          throw new Error('downstream explosion');
        },
      ]);
      const ctx = nextAwareContext();
      await fn(ctx);
      expect(caught).toBe(true);
    });
  });

  describe('5. Asynchronous Rejections', () => {
    it('propagates asynchronous rejection across 3-middleware stack', async () => {
      const order: string[] = [];
      const fn = compose([
        async (_ctx, next) => {
          order.push('m1-in');
          try {
            await next();
          } catch (err: unknown) {
            order.push('m1-caught');
            throw err;
          }
        },
        async (_ctx, next) => {
          order.push('m2-in');
          await next();
          order.push('m2-out');
        },
        async () => {
          order.push('m3-reject');
          await new Promise((r) => setTimeout(r, 5));
          throw new Error('async error in m3');
        },
      ]);

      const ctx = nextAwareContext();
      await expect(fn(ctx)).rejects.toThrow('async error in m3');
      expect(order).toEqual(['m1-in', 'm2-in', 'm3-reject', 'm1-caught']);
    });
  });

  describe('6. Repeated next() Guardrails Across All Runners', () => {
    it.each([1, 2, 3, 4])('rejects sequential next() calls with MULTIPLE_NEXT_MESSAGE in stack size %i', async (size) => {
      const stack: Middleware[] = [];
      for (let i = 0; i < size; i++) {
        if (i === 0) {
          stack.push(async (_ctx, next) => {
            await next();
            await next(); // Illegal second call
          });
        } else {
          stack.push((_ctx, next) => next());
        }
      }

      const fn = compose(stack);
      const ctx = nextAwareContext();
      await expect(fn(ctx)).rejects.toThrow(MULTIPLE_NEXT_MESSAGE);
    });

    it.each([1, 2, 3, 4])('rejects concurrent next() calls via Promise.all in stack size %i', async (size) => {
      const stack: Middleware[] = [];
      for (let i = 0; i < size; i++) {
        if (i === 0) {
          stack.push(async (_ctx, next) => {
            await Promise.all([next(), next()]);
          });
        } else {
          stack.push((_ctx, next) => next());
        }
      }

      const fn = compose(stack);
      const ctx = nextAwareContext();
      await expect(fn(ctx)).rejects.toThrow(MULTIPLE_NEXT_MESSAGE);
    });

    it('rejects when next() is called parameter-wise then via ctx.next() if downstream also awaited next()', async () => {
      const fn = compose([
        async (ctx, next) => {
          await next();
          await ctx.next(); // Illegal call: downstream already exhausted next1
        },
        async (_ctx, next) => {
          await next();
        },
      ]);
      const ctx = nextAwareContext();
      await expect(fn(ctx)).rejects.toThrow(MULTIPLE_NEXT_MESSAGE);
    });
  });

  describe('7. Unawaited next() and Dangling Execution Safety', () => {
    it('allows fire-and-forget next() to complete without uncaught rejection when downstream resolves', async () => {
      let downstreamFinished = false;
      const fn = compose([
        (_ctx, next) => {
          void next().then(() => {
            downstreamFinished = true;
          });
          return RESOLVED_PROMISE;
        },
        async () => {
          await new Promise((r) => setTimeout(r, 10));
        },
      ]);

      const ctx = nextAwareContext();
      const res = fn(ctx);
      expect(res).toBe(RESOLVED_PROMISE);

      await new Promise((r) => setTimeout(r, 20));
      expect(downstreamFinished).toBe(true);
    });
  });

  describe('8. ctx.setNext Context Wiring & Unwinding State Restoration', () => {
    it('restores upstream next wiring upon returning from synchronous downstream middleware', async () => {
      let restoredError: Error | undefined;
      const fn = compose([
        async (ctx, next) => {
          next();
          // After next() returns synchronously, ctx.next must point back to next0
          // Calling ctx.next() again here must trigger the duplicate next error
          try {
            await ctx.next();
          } catch (err: unknown) {
            restoredError = err as Error;
          }
          return RESOLVED_PROMISE;
        },
        () => undefined,
      ]);

      const ctx = nextAwareContext();
      await fn(ctx);
      expect(restoredError?.message).toBe(MULTIPLE_NEXT_MESSAGE);
    });

    it('restores upstream next wiring across 3-middleware stack when downstream throws', async () => {
      let m1Restored = false;
      const fn = compose([
        async (ctx, next) => {
          try {
            await next();
          } catch {
            // Upon catching, ctx.next() must be guarded against multiple calls
            await expect(ctx.next()).rejects.toThrow(MULTIPLE_NEXT_MESSAGE);
            m1Restored = true;
          }
        },
        async (_ctx, next) => {
          await next();
        },
        () => {
          throw new Error('m3 crash');
        },
      ]);

      const ctx = nextAwareContext();
      await fn(ctx);
      expect(m1Restored).toBe(true);
    });
  });
});

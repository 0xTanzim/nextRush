/**
 * @nextrush/core - compose() with the modern ctx.next() syntax
 *
 * The existing middleware.test.ts covers the traditional `(ctx, next)` form.
 * These tests prove `compose()` also drives the modern `(ctx) => ctx.next()`
 * form and that the two interoperate — matching the router's per-route executor.
 */

import type { Context, Middleware } from '@nextrush/types';
import { describe, expect, it, vi } from 'vitest';
import { compose } from '../middleware';
import { createMockContext } from './_shared/create-mock-context';

/** Mock context whose setNext stores the wired next and ctx.next() invokes it. */
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

describe('compose: modern ctx.next() syntax', () => {
  it('runs the onion model with ctx.next()', async () => {
    const order: string[] = [];
    const mk = (n: number): Middleware => async (ctx) => {
      order.push(`${n}-before`);
      await ctx.next();
      order.push(`${n}-after`);
    };

    const composed = compose([mk(1), mk(2), mk(3)]);
    await composed(nextAwareContext(), async () => {
      order.push('final');
    });

    expect(order).toEqual([
      '1-before',
      '2-before',
      '3-before',
      'final',
      '3-after',
      '2-after',
      '1-after',
    ]);
  });

  it('short-circuits when a ctx.next() middleware does not call next', async () => {
    const order: string[] = [];
    const composed = compose([
      async (ctx) => {
        order.push('a');
        await ctx.next();
      },
      async () => {
        order.push('b');
        // no next()
      },
      async (ctx) => {
        order.push('c');
        await ctx.next();
      },
    ]);

    await composed(nextAwareContext());
    expect(order).toEqual(['a', 'b']);
  });

  it('interoperates modern and traditional styles in one stack', async () => {
    const order: string[] = [];
    const composed = compose([
      async (ctx) => {
        order.push('modern-before');
        await ctx.next();
        order.push('modern-after');
      },
      async (_ctx, next) => {
        order.push('trad-before');
        await next();
        order.push('trad-after');
      },
    ]);

    await composed(nextAwareContext(), async () => {
      order.push('final');
    });

    expect(order).toEqual([
      'modern-before',
      'trad-before',
      'final',
      'trad-after',
      'modern-after',
    ]);
  });

  it('propagates errors thrown in a ctx.next() middleware', async () => {
    const composed = compose([
      async (ctx) => {
        await ctx.next();
      },
      async () => {
        throw new Error('modern boom');
      },
    ]);

    await expect(composed(nextAwareContext())).rejects.toThrow('modern boom');
  });

  it('invokes the provided final next after a ctx.next() chain', async () => {
    const finalNext = vi.fn().mockResolvedValue(undefined);
    const composed = compose([
      async (ctx) => {
        await ctx.next();
      },
    ]);

    await composed(nextAwareContext(), finalNext);
    expect(finalNext).toHaveBeenCalledTimes(1);
  });
});

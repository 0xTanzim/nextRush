/**
 * @nextrush/core - Single-middleware fast-path boundary guards (§6.2)
 *
 * OpenSpec change: core-single-middleware-fastpath.
 *
 * The `len === 1` fast path is purely additive (design D5): `len === 0` keeps
 * its empty path and `len >= 2` keeps the general `dispatch` path. These tests
 * pin the boundary — a two-middleware stack must still run the general path —
 * and confirm the fast path applies to ANY lone middleware, not only the
 * router (spec: "the single middleware need not be the router").
 */

import type { Middleware } from '@nextrush/types';
import { describe, expect, it } from 'vitest';
import { compose } from '../middleware';
import { createMockContext } from './_shared/create-mock-context';

describe('compose: fast-path boundary (§6.2)', () => {
  it('len === 2 still runs the general onion path unchanged', async () => {
    const order: string[] = [];
    const mk =
      (n: number): Middleware =>
      async (_ctx, next) => {
        order.push(`${n}-before`);
        await next();
        order.push(`${n}-after`);
      };

    const composed = compose([mk(1), mk(2)]);
    await composed(createMockContext(), async () => {
      order.push('tail');
    });

    // Full onion ordering across both layers proves the general path ran.
    expect(order).toEqual(['1-before', '2-before', 'tail', '2-after', '1-after']);
  });

  it('len === 2 double-next() in the SECOND layer still rejects (general path guard)', async () => {
    const composed = compose([
      async (_ctx, next) => {
        await next();
      },
      async (_ctx, next) => {
        await next();
        await next(); // second layer double-calls
      },
    ]);

    await expect(composed(createMockContext(), () => Promise.resolve())).rejects.toThrow(
      'next() called multiple times'
    );
  });

  it('the lone middleware need not be the router — an arbitrary app.use fn runs on the fast path', async () => {
    let ran = false;
    const arbitrary: Middleware = async (ctx, next) => {
      ran = true;
      ctx.state.touched = true;
      await next();
    };

    const ctx = createMockContext();
    const composed = compose([arbitrary]);
    await composed(ctx, () => Promise.resolve());

    expect(ran).toBe(true);
    expect(ctx.state.touched).toBe(true);
  });
});

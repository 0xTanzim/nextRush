/**
 * @nextrush/router — the routes middleware synchronous-settlement marker on misses.
 *
 * @remarks
 * Asserts that a miss or rejection that finishes synchronously marks
 * `DISPATCH_SETTLED_SYNC` so Web adapters (Bun/Deno/Edge) can answer with a bare
 * Response rather than an unnecessary async turn.
 */

import { describe, expect, it } from 'vitest';
import { DISPATCH_SETTLED_SYNC, RESOLVED_PROMISE, type Context, type DispatchMarkerCarrier } from '@nextrush/types';
import { createRoutesMiddleware } from '../dispatch';

function makeContext(path = '/unknown'): Context & DispatchMarkerCarrier {
  return {
    method: 'GET',
    path,
    status: 200,
    responded: false,
    headers: {},
    params: {},
    state: {},
    setNext: () => undefined,
  } as unknown as Context & DispatchMarkerCarrier;
}

describe('routes middleware — synchronous settlement on miss / 400', () => {
  it('marks DISPATCH_SETTLED_SYNC when a miss occurs with no next()', async () => {
    const mw = createRoutesMiddleware(() => null, false, false);
    const ctx = makeContext();

    await mw(ctx);

    expect(ctx.status).toBe(404);
    expect(ctx[DISPATCH_SETTLED_SYNC]).toBe(true);
  });

  it('marks DISPATCH_SETTLED_SYNC when a miss occurs and next() settles synchronously', async () => {
    const mw = createRoutesMiddleware(() => null, false, false);
    const ctx = makeContext();
    const next = () => RESOLVED_PROMISE;

    await mw(ctx, next);

    expect(ctx.status).toBe(404);
    expect(ctx[DISPATCH_SETTLED_SYNC]).toBe(true);
  });

  it('marks DISPATCH_SETTLED_SYNC when a miss occurs and next() returns void', async () => {
    const mw = createRoutesMiddleware(() => null, false, false);
    const ctx = makeContext();
    const next = (() => undefined) as () => Promise<void>;

    await mw(ctx, next);

    expect(ctx.status).toBe(404);
    expect(ctx[DISPATCH_SETTLED_SYNC]).toBe(true);
  });

  it('does NOT mark DISPATCH_SETTLED_SYNC when next() returns a pending promise', async () => {
    const mw = createRoutesMiddleware(() => null, false, false);
    const ctx = makeContext();
    const next = async () => {
      await new Promise((r) => setTimeout(r, 10));
    };

    await mw(ctx, next);

    expect(ctx.status).toBe(404);
    expect(ctx[DISPATCH_SETTLED_SYNC]).toBeUndefined();
  });

  it('marks DISPATCH_SETTLED_SYNC when a request is rejected with 400 for dot segments', async () => {
    const mw = createRoutesMiddleware(() => null, false, false);
    const ctx = makeContext('/files/../admin');

    await mw(ctx);

    expect(ctx.status).toBe(400);
    expect(ctx[DISPATCH_SETTLED_SYNC]).toBe(true);
  });
});

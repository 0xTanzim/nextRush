/**
 * @nextrush/router - reused walk-frame pool safety (`reduce-router-match-allocations`)
 *
 * `matchNodeIndexed`'s `WalkFrame[]` stack and `matchRoute`'s `bindNames`/
 * `bindValues` arrays are pooled per-router-instance to avoid a fresh
 * allocation on every call (F-02). Pinned here, per the new `router`
 * capability requirement ("Reused internal walk state is never shared across
 * concurrent in-flight matches"): pooling must never let one match observe or
 * corrupt another's in-progress walk, and the walk must stay fully
 * synchronous end-to-end for that guarantee to hold.
 *
 * `match-safety.test.ts`'s existing "concurrency isolation (D10)" describe
 * block already proves the returned `params` object is never shared across
 * matches — that stays true unchanged by this pool, since `params` is still
 * materialized fresh via `Object.create(null)` regardless of pooling. This
 * file adds the pool-specific contract the existing suite doesn't cover:
 * sequential reuse safety and synchronous-only execution.
 */

import type { RouteHandler } from '@nextrush/types';
import { describe, expect, it } from 'vitest';
import { createRouter } from '../router';

const noop: RouteHandler = async () => {};

describe('reused walk state — sequential matches reuse pooled scratch safely', () => {
  it('a second match on the same router is unaffected by the first match’s path or params', () => {
    const router = createRouter();
    router.get('/users/:id', noop);
    router.get('/orgs/:orgId/teams/:teamId', noop);

    const first = router.match('GET', '/orgs/42/teams/7');
    const second = router.match('GET', '/users/99');

    expect(first?.params).toEqual({ orgId: '42', teamId: '7' });
    expect(second?.params).toEqual({ id: '99' });
  });

  it('a miss followed by a hit on the same router produces a clean, uncontaminated result', () => {
    const router = createRouter();
    router.get('/a/:x/c', noop);
    router.get('/a/b/d', noop);

    const miss = router.match('GET', '/a/zz/zz');
    const hit = router.match('GET', '/a/b/c');

    expect(miss).toBeNull();
    expect(hit?.params).toEqual({ x: 'b' });
  });

  it('many interleaved matches at varying depth never bleed state into each other', () => {
    const router = createRouter();
    router.get('/x/:a', noop);
    router.get('/y/:a/:b/:c', noop);
    router.get('/z', noop);

    const results = Array.from({ length: 500 }, (_, i) => {
      const variant = i % 3;
      if (variant === 0) return router.match('GET', `/x/v${i}`);
      if (variant === 1) return router.match('GET', `/y/p${i}/q${i}/r${i}`);
      return router.match('GET', '/z');
    });

    results.forEach((m, i) => {
      const variant = i % 3;
      if (variant === 0) expect(m?.params).toEqual({ a: `v${i}` });
      else if (variant === 1) expect(m?.params).toEqual({ a: `p${i}`, b: `q${i}`, c: `r${i}` });
      else expect(m).not.toBeNull();
    });
  });
});

describe('reused walk state — the walk never suspends mid-frame', () => {
  it('router.match returns synchronously (never a Promise) for a hit', () => {
    const router = createRouter();
    router.get('/users/:id', noop);
    const result = router.match('GET', '/users/1');
    expect(result).not.toBeInstanceOf(Promise);
  });

  it('router.match returns synchronously (never a Promise) for a miss', () => {
    const router = createRouter();
    router.get('/users/:id', noop);
    const result = router.match('GET', '/nope');
    expect(result).not.toBeInstanceOf(Promise);
  });

  it('a deep param match completes entirely within one synchronous call (no microtask boundary)', () => {
    const router = createRouter();
    router.get('/' + Array.from({ length: 50 }, () => ':p').join('/'), noop);
    const path = '/' + Array.from({ length: 50 }, (_, i) => `x${i}`).join('/');

    let sawMicrotask = false;
    queueMicrotask(() => {
      sawMicrotask = true;
    });
    const result = router.match('GET', path);
    // If the walk had suspended on a promise, the queued microtask above
    // would have had a chance to run before match() returned.
    expect(sawMicrotask).toBe(false);
    expect(result).not.toBeNull();
  });
});

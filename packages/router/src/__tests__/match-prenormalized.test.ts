/**
 * @nextrush/router - F-10 preNormalized fast-path
 *
 * Pins the fix for F-10 (reconciliation report, Week 2): on the real HTTP
 * dispatch path (`Router.routes()` -> `createRoutesMiddleware`), the request
 * path is already canonicalized via `canonicalizePath()` before `match()` is
 * ever called, so `matchRoute`'s own independent fold+collapse re-derivation
 * (HP-12's `caseStable`/`isProvablyLowerAscii` decision) is pure repeated
 * work on that path. `resolveMatch`/`matchRoute` gain a `preNormalized`
 * parameter (default `false`) that, when `true`, trusts the input as already
 * canonical and skips the fold+collapse re-derivation entirely. `Router.
 * match()` — the public two-argument method used by tests and direct API
 * callers, none of which canonicalize first — is unaffected: it still omits
 * the argument and gets today's behavior exactly.
 *
 * Note: this test intentionally does not assert on path-parameter casing —
 * a pre-existing, separate behavior (confirmed present before this change,
 * unrelated to F-10) where `Router.routes()`'s dispatch path already
 * publishes a case-folded `ctx.path` upstream of `match()` for a
 * case-insensitive router, regardless of this fix. F-10 is about redundant
 * computation, not about that param-casing question — out of this change's
 * scope.
 */

import type { RouteHandler } from '@nextrush/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveMatch, type MatchState } from '../match-route';
import { createRouter } from '../router';

const noop: RouteHandler = async () => {};

afterEach(() => {
  vi.restoreAllMocks();
});

function buildState(overrides: Partial<MatchState> = {}): MatchState {
  const router = createRouter();
  router.get('/users/:id', noop);
  const state = (router as unknown as { state: MatchState }).state;
  return { ...state, ...overrides };
}

describe("F-10 — preNormalized skips matchRoute's redundant fold+collapse re-derivation", () => {
  it('preNormalized: true skips the fold entirely, even on an uppercase path a fold would normally catch', () => {
    const state = buildState();
    const spy = vi.spyOn(String.prototype, 'toLowerCase');

    // A caller passing preNormalized: true is asserting "I already
    // canonicalized this" — matchRoute must trust that and never re-fold,
    // even though '/USERS/ID' looks like it would otherwise trigger HP-12's
    // fold branch. This is the direct, unambiguous proof the flag suppresses
    // the fold step itself, independent of any caller's actual behavior.
    resolveMatch(state, true, 'GET', '/USERS/ID', true);

    expect(spy).not.toHaveBeenCalled();
  });

  it('preNormalized omitted (default false) behaves identically to today — still folds when needed', () => {
    const state = buildState();
    const match = resolveMatch(state, true, 'GET', '/Users/AbC');

    expect(match).not.toBeNull();
    expect(match?.params).toEqual({ id: 'AbC' });
  });

  it("Router.routes()'s internal dispatch wires preNormalized: true (no toLowerCase inside matchRoute for an already-canonical path)", async () => {
    const router = createRouter();
    router.get('/users/:id', noop);
    const middleware = router.routes();

    const ctx = {
      path: '/users/abc',
      originalPath: '/users/abc',
      method: 'GET',
      params: {},
      set: () => undefined,
    } as unknown as import('@nextrush/types').Context;

    const spy = vi.spyOn(String.prototype, 'toLowerCase');
    await middleware(ctx, undefined);

    // canonicalizePath's own upstream fold call (for ctx.path) is the only
    // toLowerCase attributable to this dispatch — matchRoute must add none.
    expect(spy.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("Router.match() — the public two-argument method — is unaffected: still folds its own raw input", () => {
    const router = createRouter();
    router.get('/users/:id', noop);

    const match = router.match('GET', '/Users/AbC');
    expect(match).not.toBeNull();
    expect(match?.params).toEqual({ id: 'AbC' });
  });
});

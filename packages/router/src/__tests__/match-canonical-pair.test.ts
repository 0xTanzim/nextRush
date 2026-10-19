/**
 * @nextrush/router — the dispatch path forwards a canonical pair
 *
 * `Router.routes()` mounts `createRoutesMiddleware`, which already
 * canonicalizes the request target with `canonicalizePath()` before resolving a
 * route. That single pass yields both strings a match needs: the folded path to
 * match on, and the case-preserved path values are bound from. The dispatching
 * closure therefore forwards the pair rather than letting `matchRoute` re-derive
 * either — and re-derivation is not merely redundant here, it is lossy: the
 * folded string no longer contains the casing a value has to keep.
 *
 * `Router.match()` — the public two-argument method, whose callers have not
 * canonicalized anything — is unaffected: it still normalizes its own input.
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

describe('a supplied canonical pair is used exactly as given', () => {
  it('never re-folds a pair the caller already canonicalized', () => {
    const state = buildState();
    const spy = vi.spyOn(String.prototype, 'toLowerCase');

    // The caller asserts "this is the canonical pair for this request". A path
    // that a fold would normally change must still not be folded again: the two
    // strings are the contract, not a hint to be re-derived.
    resolveMatch(state, true, 'GET', '/USERS/ID', {
      path: '/USERS/ID',
      valuePath: '/USERS/ID',
    });

    expect(spy).not.toHaveBeenCalled();
  });

  it('matches on the folded path and binds from the case-preserved one', () => {
    const state = buildState();

    const match = resolveMatch(state, true, 'GET', '/users/abc', {
      path: '/users/abc',
      valuePath: '/Users/AbC',
    });

    expect(match?.params).toEqual({ id: 'AbC' });
  });

  it('binds no value from the folded path when a fold changed a length', () => {
    const state = buildState();

    // U+0130 folds to two code points. The pair keeps both strings whole, so a
    // value read out of the case-preserved one is unaffected by that.
    const match = resolveMatch(state, true, 'GET', '/users/\u0130a', {
      path: '/users/i\u0307a',
      valuePath: '/users/\u0130a',
    });

    expect(match?.params).toEqual({ id: '\u0130a' });
  });
});

describe('an omitted pair falls back to normalizing the raw input', () => {
  it('still folds when the raw path needs it', () => {
    const state = buildState();
    const match = resolveMatch(state, true, 'GET', '/Users/AbC');

    expect(match).not.toBeNull();
    expect(match?.params).toEqual({ id: 'AbC' });
  });
});

describe('Router.routes() dispatch', () => {
  it('adds no fold of its own for an already-canonical path', async () => {
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

    // canonicalizePath's own upstream fold decision is the only fold this
    // dispatch may perform; matching must contribute none.
    expect(spy.mock.calls.length).toBeLessThanOrEqual(1);
  });
});

describe('Router.match() — the public two-argument method', () => {
  it('is unaffected: still normalizes its own raw input', () => {
    const router = createRouter();
    router.get('/users/:id', noop);

    const match = router.match('GET', '/Users/AbC');
    expect(match).not.toBeNull();
    expect(match?.params).toEqual({ id: 'AbC' });
  });
});

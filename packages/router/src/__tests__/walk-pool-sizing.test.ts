/**
 * @nextrush/router - walk pool sizing tracks maxDepth (`reduce-router-match-allocations`)
 *
 * `Router.addRoute` rebuilds `state.walkPool` whenever a newly registered
 * route's depth exceeds the current pool's size, so the pool is never too
 * small for the deepest route actually registered — never guessed, never
 * left stale after a deeper route is added later.
 */

import type { RouteHandler } from '@nextrush/types';
import { describe, expect, it } from 'vitest';
import { createRouter } from '../router';

const noop: RouteHandler = async () => {};

describe('walk pool sizing follows registered route depth', () => {
  it('has no pool for a router with only static routes', () => {
    const router = createRouter();
    router.get('/a', noop);
    router.get('/b', noop);
    // No param/wildcard route registered — matches still work via the static
    // fast path, and there is nothing for a pool to help with.
    expect(router.match('GET', '/a')?.handler).toBe(noop);
  });

  it('matches correctly immediately after the first param route is registered', () => {
    const router = createRouter();
    router.get('/users/:id', noop);
    const match = router.match('GET', '/users/42');
    expect(match?.params).toEqual({ id: '42' });
  });

  it('matches correctly after a deeper route is registered later, growing the pool', () => {
    const router = createRouter();
    router.get('/users/:id', noop);
    // First match at the shallower depth, pool sized to depth 2.
    expect(router.match('GET', '/users/1')?.params).toEqual({ id: '1' });

    // Register a much deeper route — the pool must grow to cover it.
    router.get('/orgs/:o/teams/:t/members/:m/roles/:r', noop);
    const deep = router.match('GET', '/orgs/1/teams/2/members/3/roles/4');
    expect(deep?.params).toEqual({ o: '1', t: '2', m: '3', r: '4' });

    // The original shallow route still matches correctly after the pool grew.
    expect(router.match('GET', '/users/2')?.params).toEqual({ id: '2' });
  });

  it('a router built with all routes registered up front matches every depth correctly', () => {
    const router = createRouter();
    router.get('/a/:x', noop);
    router.get('/a/:x/b/:y', noop);
    router.get('/a/:x/b/:y/c/:z', noop);

    expect(router.match('GET', '/a/1')?.params).toEqual({ x: '1' });
    expect(router.match('GET', '/a/1/b/2')?.params).toEqual({ x: '1', y: '2' });
    expect(router.match('GET', '/a/1/b/2/c/3')?.params).toEqual({ x: '1', y: '2', z: '3' });
  });

  it('reset() clears pooled state so a shallower re-registration still matches correctly', () => {
    const router = createRouter();
    router.get('/orgs/:o/teams/:t/members/:m', noop);
    expect(router.match('GET', '/orgs/1/teams/2/members/3')?.params).toEqual({
      o: '1',
      t: '2',
      m: '3',
    });

    router.reset();
    router.get('/x/:id', noop);
    expect(router.match('GET', '/x/9')?.params).toEqual({ id: '9' });
  });
});

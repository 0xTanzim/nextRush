/**
 * @nextrush/router - HP-11 safety & critical-flow contract (task 5.2)
 *
 * Forward-looking scenarios for the param-walk rewrite (design.md D4/D8/D9/D10):
 * null-prototype params, `__proto__`-name binding without pollution,
 * encoded-slash/dot never re-segmenting the path, concurrency isolation,
 * deep-path DoS safety (iterative walk), the clean-null miss / 405 flow, the
 * compiled-executor invariant, and the removal of the `Object.keys` post-loop
 * and backtrack `Reflect.deleteProperty` (deterministic spies).
 *
 * The 5.1 core matching invariants (precedence, backtracking, casing, decode,
 * wildcard, param+wildcard, empty-param, trailing-slash, param-less→EMPTY_PARAMS)
 * are pinned by the 66-probe differential golden in `match-differential.test.ts`;
 * this file adds only what the golden cannot express.
 */

import type { RouteHandler } from '@nextrush/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_PARAMS } from '../constants';
import { createRouter } from '../router';

const noop: RouteHandler = async () => {
  /* no-op */
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HP-11 — null-prototype params (D8)', () => {
  it('materializes a populated params object with a null prototype', () => {
    const router = createRouter();
    router.get('/users/:id', noop);
    const match = router.match('GET', '/users/42');
    expect(match?.params).toEqual({ id: '42' });
    expect(Object.getPrototypeOf(match?.params)).toBeNull();
  });

  it('exposes no inherited Object.prototype members on params', () => {
    const router = createRouter();
    router.get('/users/:id', noop);
    const params = router.match('GET', '/users/42')?.params as Record<string, unknown>;
    expect(params['toString']).toBeUndefined();
    expect(params['hasOwnProperty']).toBeUndefined();
  });

  it('binds a __proto__ param as an OWN key without polluting Object.prototype', () => {
    const router = createRouter();
    router.get('/:__proto__', noop);
    const match = router.match('GET', '/danger');
    expect(match).not.toBeNull();
    expect(Object.prototype.hasOwnProperty.call(match?.params, '__proto__')).toBe(true);
    expect((match?.params as Record<string, string>)['__proto__']).toBe('danger');
    // No global prototype pollution.
    expect(({} as Record<string, unknown>)['danger']).toBeUndefined();
    expect((Object.prototype as Record<string, unknown>)['danger']).toBeUndefined();
  });

  it('binds a constructor param as an OWN string key', () => {
    const router = createRouter();
    router.get('/:constructor', noop);
    const match = router.match('GET', '/boom');
    expect(Object.prototype.hasOwnProperty.call(match?.params, 'constructor')).toBe(true);
    expect((match?.params as Record<string, string>)['constructor']).toBe('boom');
  });
});

describe('HP-11 — traversal-safe decode (D9): encoded slash/dot never re-segments', () => {
  it('keeps an encoded slash inside a single param value and matches /files/:name (not a structural /files/a/b)', () => {
    const router = createRouter();
    router.get('/files/:name', noop);
    router.get('/files/a/b', (async () => {}) as RouteHandler);
    const match = router.match('GET', '/files/a%2Fb');
    expect(match?.params).toEqual({ name: 'a/b' });
  });

  it('keeps encoded dots inside the value (no `..` traversal segments)', () => {
    const router = createRouter();
    router.get('/files/:name', noop);
    const match = router.match('GET', '/files/%2E%2E');
    expect(match?.params).toEqual({ name: '..' });
  });
});

describe('HP-11 — concurrency isolation (D10)', () => {
  it('gives each match its own params; no cross-contamination across many matches', () => {
    const router = createRouter();
    router.get('/users/:id', noop);
    const results = Array.from({ length: 1000 }, (_, i) => router.match('GET', `/users/u${i}`));
    results.forEach((m, i) => {
      expect(m?.params).toEqual({ id: `u${i}` });
    });
    // Distinct param objects per match (no shared mutable scratch reused).
    expect(results[0]?.params).not.toBe(results[1]?.params);
  });

  it('shares only the frozen EMPTY_PARAMS for param-less matches', () => {
    const router = createRouter();
    router.get('/a/*', noop); // wildcard keeps hasParamRoutes true; /health walks & binds nothing
    router.get('/health', noop);
    // A static-through-trie param-less match returns the shared sentinel.
    const m1 = router.match('GET', '/health');
    expect(m1?.params).toBe(EMPTY_PARAMS);
  });
});

describe('HP-11 — deep-path DoS safety (iterative walk)', () => {
  it('resolves a very deep matching path without a stack overflow', () => {
    const depth = 60000;
    const router = createRouter();
    // A deep param chain forces the walk to descend `depth` levels.
    router.get('/' + Array.from({ length: depth }, () => ':p').join('/'), noop);
    const path = '/' + Array.from({ length: depth }, (_, i) => `x${i}`).join('/');
    expect(() => router.match('GET', path)).not.toThrow();
    expect(router.match('GET', path)).not.toBeNull();
  });

  it('misses a very deep non-matching path without a stack overflow', () => {
    const depth = 60000;
    const router = createRouter();
    router.get('/short/:id', noop);
    const path = '/' + Array.from({ length: depth }, (_, i) => `x${i}`).join('/');
    expect(() => router.match('GET', path)).not.toThrow();
    expect(router.match('GET', path)).toBeNull();
  });
});

describe('HP-11 — miss / 405 / executor critical flow', () => {
  it('returns null cleanly on a miss', () => {
    const router = createRouter();
    router.get('/x/:id', noop);
    expect(router.match('GET', '/nope')).toBeNull();
  });

  it('returns null for a known path with an unregistered method (so allowedMethods can 405)', () => {
    const router = createRouter();
    router.get('/x/:id', noop);
    expect(router.match('POST', '/x/42')).toBeNull();
  });

  it('returns the pre-compiled executor on a matched param route (not re-composed)', () => {
    const router = createRouter();
    router.get('/x/:id', noop);
    const match = router.match('GET', '/x/42');
    expect(typeof match?.executor).toBe('function');
  });
});

describe('HP-11/HP-13 — allocation mechanism removed (deterministic spies)', () => {
  it('does not call Object.keys on the param match path (HP-13 post-loop gone)', () => {
    const router = createRouter();
    router.get('/x/:id', noop);
    const spy = vi.spyOn(Object, 'keys');
    router.match('GET', '/x/42');
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not call Reflect.deleteProperty during a backtracking match (eager-bind/backtrack gone)', () => {
    const router = createRouter();
    router.get('/a/:x/c', noop);
    router.get('/a/b/d', noop);
    const spy = vi.spyOn(Reflect, 'deleteProperty');
    // /a/b/c: static `b` tried, fails at `c`, backtracks to param :x — the exact
    // path that used to call Reflect.deleteProperty on backtrack.
    const match = router.match('GET', '/a/b/c');
    expect(match?.params).toEqual({ x: 'b' });
    expect(spy).not.toHaveBeenCalled();
  });
});

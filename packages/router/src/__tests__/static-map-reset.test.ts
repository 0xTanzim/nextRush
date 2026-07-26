/**
 * @nextrush/router - HP-9 static-map reset contract
 *
 * The differential golden (`match-differential.test.ts`) already pins the
 * behavior-preserving HP-9 scenarios that live on a freshly-built router:
 * static-over-trie precedence, method-miss, trailing-slash, `all()`, and the
 * prefix/mount/group registration flows. The one contract it CANNOT cover —
 * because it always builds fresh routers — is that `reset()` fully clears the
 * (now method-nested) static map with no ghost entries. This file pins that.
 */

import type { RouteHandler } from '@nextrush/types';
import { describe, expect, it } from 'vitest';
import { createRouter } from '../router';

const noop: RouteHandler = async () => {};

describe('HP-9 — reset() clears the method-nested static map fully', () => {
  it('clears static entries across every method and leaves no ghost matches', () => {
    const router = createRouter();
    router.get('/a', noop);
    router.post('/a', noop);
    router.get('/b/c', noop);
    router.put('/b/c', noop);

    expect(router.match('GET', '/a')).not.toBeNull();
    expect(router.match('POST', '/a')).not.toBeNull();
    expect(router.match('PUT', '/b/c')).not.toBeNull();

    router.reset();

    // Every method's inner map must be gone — no ghost entries.
    expect(router.match('GET', '/a')).toBeNull();
    expect(router.match('POST', '/a')).toBeNull();
    expect(router.match('GET', '/b/c')).toBeNull();
    expect(router.match('PUT', '/b/c')).toBeNull();
  });

  it('allows re-registering the same static routes after reset without a conflict throw', () => {
    const router = createRouter();
    router.get('/x', noop);
    router.reset();

    // A lingering inner-map entry would make this throw "Route conflict".
    expect(() => router.get('/x', noop)).not.toThrow();
    expect(router.match('GET', '/x')).not.toBeNull();
  });
});

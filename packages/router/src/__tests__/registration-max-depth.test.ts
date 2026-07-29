/**
 * @nextrush/router - registration-time max-depth tracking
 *
 * `addRoute` inserts each route's `:param`/static segments as a chain of trie
 * nodes. The reused walk-frame pool (`reduce-router-match-allocations`) needs
 * this chain's worst-case length known at registration time, not guessed —
 * an attacker's request path can never make the walk descend deeper than the
 * trie's own real depth (a mismatched segment backtracks, it never pushes),
 * so sizing the pool from registered-route depth preserves the walk's
 * existing recursion-depth DoS guard rather than reintroducing it.
 */

import { describe, expect, it } from 'vitest';
import { addRoute, type RegistrationState } from '../registration';
import { createNode } from '../segment-trie';

function createState(): RegistrationState & { maxDepth: number } {
  return {
    root: createNode(''),
    caseSensitive: false,
    staticRoutes: new Map(),
    routeDefinitions: [],
    maxDepth: 0,
  };
}

const noop = async (): Promise<void> => {};

describe('registration tracks the deepest registered route', () => {
  it('a single-segment route has depth 1', () => {
    const state = createState();
    addRoute('GET', '/a', [noop], [], state);
    expect(state.maxDepth).toBe(1);
  });

  it('tracks the deepest of several routes, not the last registered', () => {
    const state = createState();
    addRoute('GET', '/a', [noop], [], state);
    addRoute('GET', '/a/b/c/:id', [noop], [], state);
    addRoute('GET', '/x', [noop], [], state);
    expect(state.maxDepth).toBe(4);
  });

  it('a wildcard segment counts toward depth but never pushes beyond it', () => {
    const state = createState();
    addRoute('GET', '/files/*', [noop], [], state);
    expect(state.maxDepth).toBe(2);
  });

  it('registering a shallower route after a deeper one does not shrink maxDepth', () => {
    const state = createState();
    addRoute('GET', '/a/b/c', [noop], [], state);
    addRoute('GET', '/x', [noop], [], state);
    expect(state.maxDepth).toBe(3);
  });
});

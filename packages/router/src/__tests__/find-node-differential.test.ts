/**
 * @nextrush/router - HP-17 findNode iterative-rewrite differential contract
 *
 * Regression + safety contract for OpenSpec change `router-context-final-cleanup`
 * (HP-17). `findNode` (used by `findAllowedMethods`, the 405/OPTIONS path) is
 * being rewritten from recursion to an explicit-stack walk so a pathological
 * segment count can't overflow the call stack — the same DoS class HP-11 closed
 * for the match path.
 *
 * This file pins two things:
 *  1. DIFFERENTIAL PARITY — the production `findNode` returns the byte-identical
 *     node (by reference) and `findAllowedMethods` the byte-identical method set
 *     as a FROZEN reference copy of the pre-rewrite recursive walk, across a
 *     corpus (static, nested static, param, wildcard, backtrack, trailing-slash,
 *     method-miss, miss, precedence). The reference recursion is embedded here
 *     because the old and new impls cannot coexist in one process (same
 *     characterization technique as `match-differential.test.ts`'s golden).
 *  2. DEEP-PATH SAFETY (RED before the rewrite) — a many-segment path resolves
 *     without a stack overflow. This FAILS against the recursive form and PASSES
 *     once `findNode` is iterative.
 */

import type { HttpMethod, RouteHandler } from '@nextrush/types';
import { describe, expect, it } from 'vitest';
import { findAllowedMethods, findNode } from '../find-node';
import { normalizePathForMatch } from '../matching';
import { addRoute, type RegistrationState } from '../registration';
import { createNode, type TrieNode } from '../segment-trie';

const noop: RouteHandler = async () => {
  /* no-op */
};

/** Build a bare trie root from a route list, mirroring how `Router` inserts. */
function buildRoot(
  routes: ReadonlyArray<readonly [HttpMethod, string]>,
  caseSensitive = false
): TrieNode {
  const root = createNode('');
  const state: RegistrationState = {
    root,
    caseSensitive,
    staticRoutes: new Map(),
    routeDefinitions: [],
  };
  for (const [method, path] of routes) {
    addRoute(method, path, [noop], [], state);
  }
  return root;
}

/**
 * FROZEN reference copy of the PRE-REWRITE recursive `findNode`. The production
 * `findNode` must stay byte-identical to this for every non-pathological input;
 * it diverges only by being iterative (stack-safe), which the deep-path test
 * covers separately.
 */
function findNodeRecursive(node: TrieNode, segments: string[], index: number): TrieNode | null {
  if (index === segments.length) return node;
  const segment = segments[index];
  if (segment === undefined) return null;

  const staticChild = node.children.get(segment);
  if (staticChild) {
    const result = findNodeRecursive(staticChild, segments, index + 1);
    if (result) return result;
  }
  if (node.paramChild) {
    const result = findNodeRecursive(node.paramChild, segments, index + 1);
    if (result) return result;
  }
  if (node.wildcardChild) return node.wildcardChild;
  return null;
}

/** Reference `findAllowedMethods` over the recursive walk (mirrors production). */
function refAllowedMethods(
  path: string,
  root: TrieNode,
  caseSensitive: boolean,
  strict: boolean
): HttpMethod[] {
  const normalized = normalizePathForMatch(path, caseSensitive, strict);
  const segments = normalized.split('/').filter(Boolean);
  const node = findNodeRecursive(root, segments, 0);
  if (!node || node.handlers.size === 0) return [];
  return Array.from(node.handlers.keys());
}

/** Split a request path exactly as the pre-rewrite `findAllowedMethods` did. */
function toSegments(path: string, caseSensitive: boolean, strict: boolean): string[] {
  return normalizePathForMatch(path, caseSensitive, strict).split('/').filter(Boolean);
}

/** Production `findNode` over the normalized path (new path-based signature). */
function prodNode(
  path: string,
  root: TrieNode,
  caseSensitive: boolean,
  strict: boolean
): TrieNode | null {
  return findNode(root, normalizePathForMatch(path, caseSensitive, strict), 1);
}

/** Reference `findNode` over the recursive walk (pre-rewrite segments-based). */
function refNode(
  path: string,
  root: TrieNode,
  caseSensitive: boolean,
  strict: boolean
): TrieNode | null {
  return findNodeRecursive(root, toSegments(path, caseSensitive, strict), 0);
}

// A corpus exercising every findNode branch: static, nested static, param,
// wildcard, backtracking, trailing slash (non-strict), method variety, misses.
const ROUTES: ReadonlyArray<readonly [HttpMethod, string]> = [
  ['GET', '/'],
  ['GET', '/users'],
  ['POST', '/users'],
  ['GET', '/users/me'], // static beats param at this node
  ['GET', '/users/:id'],
  ['DELETE', '/users/:id'],
  ['GET', '/a/b/c'], // nested static
  ['GET', '/a/:x/c'], // backtracking target
  ['GET', '/a/b/d'],
  ['GET', '/files/*'], // wildcard (incl. empty capture)
  ['GET', '/g/:x/*'], // param + trailing wildcard
];

const PROBES: readonly string[] = [
  '/',
  '/users',
  '/users/',
  '/users/me',
  '/users/42',
  '/users/42/',
  '/a/b/c',
  '/a/b/d',
  '/a/b/x', // backtrack: static b fails at x → param :x=b
  '/files', // wildcard empty capture
  '/files/a/b/c', // wildcard multi-segment
  '/g/1/rest/of/path', // param + trailing wildcard
  '/nope', // miss
  '/users/1/2/3', // overshoot miss
  '//a//b//c', // repeated-slash collapse
];

describe('HP-17 — findNode iterative rewrite: differential parity with recursion', () => {
  const root = buildRoot(ROUTES);

  it.each(PROBES)('returns the identical node (by reference) for %s', (path) => {
    expect(prodNode(path, root, false, false)).toBe(refNode(path, root, false, false));
  });

  it.each(PROBES)('findAllowedMethods returns the identical method set for %s', (path) => {
    expect(findAllowedMethods(path, root, false, false)).toEqual(
      refAllowedMethods(path, root, false, false)
    );
  });

  it('preserves static > param > wildcard precedence at a shared node', () => {
    // /p/me (static), /p/:id (param), /p/* (wildcard) all branch from /p.
    const r = buildRoot([
      ['GET', '/p/me'],
      ['GET', '/p/:id'],
      ['GET', '/p/*'],
    ]);
    // Static wins.
    expect(findAllowedMethods('/p/me', r, false, false)).toEqual(['GET']);
    // Param wins over wildcard for a single leftover segment.
    const paramNode = prodNode('/p/other', r, false, false);
    expect(paramNode).toBe(refNode('/p/other', r, false, false));
    expect(paramNode?.paramName).toBe('id');
    // Wildcard only when neither static nor param can complete.
    const wildNode = prodNode('/p/a/b', r, false, false);
    expect(wildNode).toBe(refNode('/p/a/b', r, false, false));
    expect(wildNode?.type).toBe(2 /* NodeType.WILDCARD */);
  });

  it('returns null identically on a miss', () => {
    expect(prodNode('/definitely/not/here', root, false, false)).toBeNull();
    expect(refNode('/definitely/not/here', root, false, false)).toBeNull();
  });
});

describe('HP-17 — deep-path 405/OPTIONS safety (RED before the iterative rewrite)', () => {
  it('resolves a very deep matching path without a stack overflow', () => {
    const depth = 60_000;
    const root = buildRoot([['GET', '/' + Array.from({ length: depth }, () => ':p').join('/')]]);
    const deepPath = '/' + Array.from({ length: depth }, (_, i) => `x${i}`).join('/');
    expect(() => findAllowedMethods(deepPath, root, false, false)).not.toThrow();
    expect(findAllowedMethods(deepPath, root, false, false)).toEqual(['GET']);
  });

  it('misses a deep-but-overshooting path without a stack overflow', () => {
    const depth = 60_000;
    // A deep param chain that DOES descend `depth` levels, then the request
    // overshoots by one segment — so the walk recurses the full depth before
    // failing (unlike a shallow miss that bails at level 1). This is the real
    // deep-recursion miss case, matching the DoS surface HP-11 closed.
    const root = buildRoot([['GET', '/' + Array.from({ length: depth }, () => ':p').join('/')]]);
    const overshoot = '/' + Array.from({ length: depth + 1 }, (_, i) => `x${i}`).join('/');
    expect(() => findAllowedMethods(overshoot, root, false, false)).not.toThrow();
    expect(findAllowedMethods(overshoot, root, false, false)).toEqual([]);
  });
});

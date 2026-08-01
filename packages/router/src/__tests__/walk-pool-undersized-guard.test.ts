/**
 * @nextrush/router - walk-pool fail-closed guard when undersized
 * (`reduce-router-match-allocations`)
 *
 * `matchNodeIndexedPooled` defensively fails closed (treats the walk as a
 * miss, never writes past the array) if a caller ever supplies a `WalkPool`
 * smaller than the path actually being walked needs. `createWalkPool` sizes
 * correctly today (`maxDepth + 1`), so this should be unreachable through the
 * public API — this file proves the guard itself is correct if that
 * invariant is ever violated by a future change, rather than leaving an
 * untested "should be unreachable" comment as the only evidence.
 */

import { describe, expect, it } from 'vitest';
import { matchNodeIndexed } from '../matching';
import { createWalkPool } from '../walk-pool';
import { createNode, NodeType, type HandlerEntry } from '../segment-trie';
import { compileExecutor } from '../segment-trie';

const noop = async (): Promise<void> => {};

describe('walk pool — fails closed when undersized (defense-in-depth)', () => {
  it('a static-descent pool undersized by one frame misses cleanly instead of writing past the array', () => {
    const root = createNode('');
    const a = createNode('a');
    root.children.set('a', a);
    const executor = compileExecutor(noop, []);
    const entry: HandlerEntry = { handler: noop, middleware: [], executor };
    a.handlers.set('GET', entry);

    // Correctly sized for depth 0 only (createWalkPool(0) -> 1 frame) — one
    // fewer frame than the descent into 'a' (depth 1) actually needs.
    const undersizedPool = createWalkPool(0);
    const bindNames: string[] = [];
    const bindValues: string[] = [];

    const result = matchNodeIndexed(root, '/a', 1, bindNames, bindValues, 'GET', true, undefined, undersizedPool);
    expect(result).toBeNull();
  });

  it('a param-descent pool undersized by one frame misses cleanly and leaves no dangling bind', () => {
    const root = createNode('');
    const idNode = createNode(':id', NodeType.PARAM);
    idNode.paramName = 'id';
    root.paramChild = idNode;
    const executor = compileExecutor(noop, []);
    idNode.handlers.set('GET', { handler: noop, middleware: [], executor });

    const undersizedPool = createWalkPool(0);
    const bindNames: string[] = [];
    const bindValues: string[] = [];

    const result = matchNodeIndexed(root, '/42', 1, bindNames, bindValues, 'GET', true, undefined, undersizedPool);
    expect(result).toBeNull();
    // The guard pops its own speculative bind before failing closed — no leak.
    expect(bindNames).toEqual([]);
    expect(bindValues).toEqual([]);
  });
});

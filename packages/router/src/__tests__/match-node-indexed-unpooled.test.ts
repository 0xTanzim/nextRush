/**
 * @nextrush/router - matchNodeIndexed's unpooled fallback stays correct
 * (`reduce-router-match-allocations`)
 *
 * `Router` always supplies a `WalkPool` once it has any param/wildcard route
 * (via `Router.addRoute`'s pool-rebuild hook), so the unpooled branch of
 * `matchNodeIndexed` has no reachable caller through the public API today.
 * It is kept as an explicit, documented fallback for any future direct caller
 * that doesn't have a pool — this file is that caller, proving the fallback
 * itself is still correct (same results as the pooled path) rather than
 * leaving it as untested dead code.
 */

import { describe, expect, it } from 'vitest';
import { matchNodeIndexed } from '../matching';
import { createNode, NodeType, type HandlerEntry } from '../segment-trie';
import { compileExecutor } from '../segment-trie';

const noop = async (): Promise<void> => {};

function buildTrie() {
  const root = createNode('');
  const files = createNode('files');
  root.children.set('files', files);
  const executor = compileExecutor(noop, []);
  const entry: HandlerEntry = { handler: noop, middleware: [], executor };

  const idNode = createNode(':id', NodeType.PARAM);
  idNode.paramName = 'id';
  idNode.handlers.set('GET', entry);
  files.paramChild = idNode;

  const wildcard = createNode('*', NodeType.WILDCARD);
  wildcard.handlers.set('GET', entry);
  root.wildcardChild = wildcard;

  return { root, entry };
}

describe('matchNodeIndexed — unpooled fallback (no WalkPool argument)', () => {
  it('matches a param route without a pool', () => {
    const { root, entry } = buildTrie();
    const bindNames: string[] = [];
    const bindValues: string[] = [];
    const result = matchNodeIndexed(root, '/files/42', 1, bindNames, bindValues, 'GET', true);
    expect(result).toBe(entry);
    expect(bindNames).toEqual(['id']);
    expect(bindValues).toEqual(['42']);
  });

  it('returns the empty-segment terminal handler on a bare trailing slash', () => {
    const root = createNode('');
    const executor = compileExecutor(noop, []);
    const entry: HandlerEntry = { handler: noop, middleware: [], executor };
    root.handlers.set('GET', entry);
    const bindNames: string[] = [];
    const bindValues: string[] = [];
    // Position 1 on '/' lands on an empty segment at the root itself.
    const result = matchNodeIndexed(root, '/', 1, bindNames, bindValues, 'GET', true);
    expect(result).toBe(entry);
  });

  it('backtracks from a failed param branch to a wildcard without a pool', () => {
    const { root, entry } = buildTrie();
    const bindNames: string[] = [];
    const bindValues: string[] = [];
    // No 'files' segment here — falls through directly to the root's own wildcard.
    const result = matchNodeIndexed(root, '/anything/here', 1, bindNames, bindValues, 'GET', true);
    expect(result).toBe(entry);
    expect(bindNames).toEqual(['*']);
    expect(bindValues).toEqual(['anything/here']);
  });

  it('returns null cleanly on a miss without a pool', () => {
    const root = createNode('');
    const bindNames: string[] = [];
    const bindValues: string[] = [];
    const result = matchNodeIndexed(root, '/nope', 1, bindNames, bindValues, 'GET', true);
    expect(result).toBeNull();
    expect(bindNames).toEqual([]);
    expect(bindValues).toEqual([]);
  });
});

/**
 * @nextrush/router - Method-agnostic trie walk (allowed-methods / 405 path)
 *
 * `findNode` + `findAllowedMethods` were split out of `matching.ts` when the
 * iterative rewrite of `findNode` (HP-17, OpenSpec change
 * `router-context-final-cleanup`) pushed that file past the 300-line ceiling.
 * They form one cohesive concern — resolving the *node* for a path regardless
 * of HTTP method, to answer OPTIONS/405 — distinct from `matching.ts`'s
 * method-aware handler match (`matchNodeIndexed`) and its normalization
 * primitives, which are reused here via import (`segmentAt`,
 * `normalizePathForMatch`).
 *
 * @packageDocumentation
 * @internal
 */

import type { HttpMethod } from '@nextrush/types';
import { normalizePathForMatch, segmentAt } from './matching';
import type { TrieNode } from './segment-trie';

/**
 * One node in {@link findNode}'s explicit-stack walk. `stage` is a small state
 * machine (0 = extract segment + try static, 1 = try param, 2 = try
 * wildcard/backtrack) so a single frame can be revisited on backtrack without
 * recursion. `next` is the start position of the following segment, captured
 * once in stage 0 and reused when descending into the param branch.
 */
interface FindFrame {
  node: TrieNode;
  pos: number;
  stage: 0 | 1 | 2;
  next: number;
}

/**
 * Walk the trie to find the node matching a path (ignoring HTTP method), the
 * method-agnostic walker used by {@link findAllowedMethods} for the 405/OPTIONS
 * path (design.md D3 / HP-17).
 *
 * Walks with an EXPLICIT stack instead of recursion — mirroring
 * `matchNodeIndexed` — so a pathological segment count cannot overflow the call
 * stack (the same DoS class HP-11 closed for the match path). Behavior is
 * byte-identical to the former recursive walker: precedence is static > param >
 * wildcard at each node, a partially-matching branch backtracks cleanly, the
 * wildcard child is a terminal (it captures the remainder), and the first
 * accepted terminal wins. The scalar {@link segmentAt} scan is reused so the
 * traversal shares one segment-extraction helper rather than duplicating it.
 *
 * `path` is the already-normalized lookup path; `startPos` skips the leading
 * `/` (callers pass `1`, matching `matchNodeIndexed`).
 */
export function findNode(root: TrieNode, path: string, startPos: number): TrieNode | null {
  const stack: FindFrame[] = [{ node: root, pos: startPos, stage: 0, next: 0 }];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame === undefined) break;

    // Stage 0 — first visit: terminal check, then try the static child.
    if (frame.stage === 0) {
      // Whole path consumed at this node → it is the matching node.
      if (frame.pos >= path.length) {
        return frame.node;
      }
      const seg = segmentAt(path, frame.pos);
      // An empty segment means the path is exhausted here (e.g. a strict-mode
      // trailing slash) — treat this node as the terminal, as the recursive
      // walk did after `split('/').filter(Boolean)` dropped empty segments.
      if (seg === '') {
        return frame.node;
      }
      // `segmentAt` already scanned to the next `/`; derive the following
      // position from the segment length (no second indexOf) — a slash follows
      // iff the segment ended before the path did.
      const segEnd = frame.pos + seg.length;
      frame.next = segEnd < path.length ? segEnd + 1 : path.length;
      frame.stage = 1;
      const staticChild = frame.node.children.get(seg);
      if (staticChild) {
        stack.push({ node: staticChild, pos: frame.next, stage: 0, next: 0 });
      }
      continue;
    }

    // Stage 1 — static child (if any) failed: try the param child.
    if (frame.stage === 1) {
      frame.stage = 2;
      if (frame.node.paramChild) {
        stack.push({ node: frame.node.paramChild, pos: frame.next, stage: 0, next: 0 });
      }
      continue;
    }

    // Stage 2 — static and param branches exhausted: the wildcard child is a
    // terminal (matches the remainder). Otherwise this branch fails; backtrack.
    if (frame.node.wildcardChild) {
      return frame.node.wildcardChild;
    }
    stack.pop();
  }

  return null;
}

/**
 * Find all HTTP methods registered for a given path via a single tree walk.
 * `caseSensitive`/`strict` (formerly `this.opts.*`) and `root` (formerly
 * `this.root`) are threaded explicitly.
 */
export function findAllowedMethods(
  path: string,
  root: TrieNode,
  caseSensitive: boolean,
  strict: boolean
): HttpMethod[] {
  const normalized = normalizePathForMatch(path, caseSensitive, strict);

  // Walk from position 1 to skip the leading '/', matching `matchNodeIndexed`'s
  // start offset. The iterative `findNode` scans segments off the path in place,
  // so no `split('/')` array is allocated here.
  const node = findNode(root, normalized, 1);
  if (!node || node.handlers.size === 0) return [];

  return Array.from(node.handlers.keys());
}

/**
 * @nextrush/router - Reused walk-frame pool (F-02, `reduce-router-match-allocations`)
 *
 * Split out of `matching.ts` once the pool implementation pushed it over the
 * 300-line file cap — same reasoning `match-route.ts`'s own extraction used.
 * Holds the pooled scratch structure and its indexed-cursor variant of the
 * tree walk; `matching.ts`'s `matchNodeIndexed` delegates here when a pool is
 * supplied and keeps its own fresh-allocation behavior otherwise.
 *
 * @packageDocumentation
 * @internal
 */

import type { HttpMethod } from '@nextrush/types';
import type { HandlerEntry, TrieNode } from './segment-trie';
import { decodeParam, segmentAt } from './matching';

/**
 * One node in the iterative walk's explicit stack. `stage` is a small state
 * machine (0 = extract + try static, 1 = try param, 2 = try wildcard/backtrack)
 * so a single frame can be revisited on backtrack without recursion. `bound`
 * records whether this frame pushed a deferred param binding, so backtracking
 * can pop it without an object-property delete.
 */
export interface WalkFrame {
  node: TrieNode;
  pos: number;
  stage: 0 | 1 | 2;
  seg: string;
  next: number;
  bound: boolean;
}

/**
 * Per-router-instance reused scratch space for the tree walk — the
 * `WalkFrame[]` stack and the `bindNames`/`bindValues` binding arrays,
 * pre-sized to the deepest currently registered route
 * (`RegistrationState.maxDepth`) instead of allocated fresh on every
 * `matchNodeIndexed` call.
 *
 * Safe under the router's synchronous-walk invariant only: a request path
 * can never make the walk descend past `maxDepth` (a mismatched segment
 * backtracks — the depth cursor decrements — rather than growing past the
 * pool), and the walk never awaits mid-frame, so no two in-flight matches on
 * the same router instance can observe each other's frames. See the
 * `router` capability's "Reused internal walk state is never shared across
 * concurrent in-flight matches" requirement.
 */
export interface WalkPool {
  frames: WalkFrame[];
  bindNames: string[];
  bindValues: string[];
}

/**
 * Build a `WalkPool` sized to hold `maxDepth` matched segments. The walk's
 * frame at index 0 always represents the trie ROOT itself (mirroring the
 * unpooled walk's `stack[0] = { node: root, ... }`), so a route with
 * `maxDepth` segments needs `maxDepth + 1` frames — one for the root plus one
 * per descended segment. Called once when a router's `maxDepth` grows
 * (registration time), never per-request.
 */
export function createWalkPool(maxDepth: number): WalkPool {
  const frames: WalkFrame[] = [];
  for (let i = 0; i < maxDepth + 1; i++) {
    frames.push({
      node: undefined as unknown as TrieNode,
      pos: 0,
      stage: 0,
      seg: '',
      next: 0,
      bound: false,
    });
  }
  return { frames, bindNames: [], bindValues: [] };
}

/**
 * Pooled variant of `matchNodeIndexed` — same stage-machine, same precedence,
 * same backtrack semantics, byte-identical results — but indexes into
 * `pool.frames` by depth (mutating each pre-allocated frame in place) instead
 * of `push`/`pop`-ing fresh frame objects onto a fresh array. `depth` is a
 * local cursor, never shared across calls; only the underlying frame OBJECTS
 * are reused. Safe only because the walk never awaits mid-frame and a
 * mismatched segment decrements `depth` (backtrack) rather than growing past
 * `pool.frames.length` (bounded by the router's `maxDepth` at registration
 * time — see {@link createWalkPool}).
 */
export function matchNodeIndexedPooled(
  root: TrieNode,
  path: string,
  startPos: number,
  bindNames: string[],
  bindValues: string[],
  method: HttpMethod,
  decode: boolean,
  pool: WalkPool,
  originalPath?: string
): HandlerEntry | null {
  const { frames } = pool;
  let depth = 0;
  const first = frames[0];
  if (first === undefined) return null; // maxDepth 0 — no param routes registered, nothing to walk
  first.node = root;
  first.pos = startPos;
  first.stage = 0;
  first.seg = '';
  first.next = 0;
  first.bound = false;

  while (depth >= 0) {
    const frame = frames[depth];
    if (frame === undefined) break;

    if (frame.stage === 0) {
      if (frame.pos >= path.length) {
        const handler = frame.node.handlers.get(method);
        if (handler) return handler;
        depth--;
        continue;
      }
      const slashPos = path.indexOf('/', frame.pos);
      if (slashPos === -1) {
        frame.seg = path.slice(frame.pos);
        frame.next = path.length;
      } else {
        frame.seg = path.slice(frame.pos, slashPos);
        frame.next = slashPos + 1;
      }
      if (frame.seg === '') {
        const handler = frame.node.handlers.get(method);
        if (handler) return handler;
        depth--;
        continue;
      }
      frame.stage = 1;
      const staticChild = frame.node.children.get(frame.seg);
      if (staticChild) {
        depth++;
        const next = frames[depth];
        if (next === undefined) {
          // Should be unreachable — pool sized to maxDepth — but fail closed
          // (treat as a miss) rather than write past the pooled array.
          depth--;
          continue;
        }
        next.node = staticChild;
        next.pos = frame.next;
        next.stage = 0;
        next.seg = '';
        next.next = 0;
        next.bound = false;
      }
      continue;
    }

    if (frame.stage === 1) {
      frame.stage = 2;
      const paramChild = frame.node.paramChild;
      if (paramChild) {
        const paramName = paramChild.paramName;
        if (paramName === undefined) return null;
        const value =
          originalPath !== undefined
            ? decodeParam(segmentAt(originalPath, frame.pos), decode)
            : decodeParam(frame.seg, decode);
        bindNames.push(paramName);
        bindValues.push(value);
        frame.bound = true;
        depth++;
        const next = frames[depth];
        if (next === undefined) {
          bindNames.pop();
          bindValues.pop();
          frame.bound = false;
          depth--;
          continue;
        }
        next.node = paramChild;
        next.pos = frame.next;
        next.stage = 0;
        next.seg = '';
        next.next = 0;
        next.bound = false;
      }
      continue;
    }

    if (frame.bound) {
      bindNames.pop();
      bindValues.pop();
      frame.bound = false;
    }
    const wildcardChild = frame.node.wildcardChild;
    if (wildcardChild) {
      const src = originalPath ?? path;
      bindNames.push('*');
      bindValues.push(decodeParam(src.slice(frame.pos), decode));
      const handler = wildcardChild.handlers.get(method);
      if (handler) return handler;
      bindNames.pop();
      bindValues.pop();
    }
    depth--;
  }

  return null;
}

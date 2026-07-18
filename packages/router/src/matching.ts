/**
 * @nextrush/router - Route Matching Engine
 *
 * The segment-trie lookup logic extracted from the `Router` class (T014,
 * design.md D1). These are standalone pure functions taking the trie root and
 * other needed state as explicit parameters — not methods — so the matching
 * engine has no implicit dependency on broader `Router` instance state beyond
 * what's passed in. `Router` becomes a thin delegating shell around these.
 *
 * @packageDocumentation
 * @internal
 */

import type { HttpMethod } from '@nextrush/types';
import type { HandlerEntry, TrieNode } from './segment-trie';

/**
 * Percent-decode an extracted param/wildcard value when `decode` is enabled.
 * Fast-paths values with no `%`, and falls back to the raw value on malformed
 * encoding (decodeURIComponent throws a URIError) so a bad request never crashes
 * routing.
 */
export function decodeParam(value: string, decode: boolean): string {
  if (!decode || !value.includes('%')) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Return the path segment starting at `start`, up to the next `/` (or end).
 * Scalar — no tuple array (the iterative walk tracks the next position itself).
 * Used to recover an original-case param value from the original-case path at a
 * position already validated against the (folded) lookup path.
 */
function segmentAt(path: string, start: number): string {
  const slashPos = path.indexOf('/', start);
  return slashPos === -1 ? path.slice(start) : path.slice(start, slashPos);
}

/**
 * Walk the tree to find the node matching a path (ignoring HTTP method).
 * Pure function of its three parameters — no implicit dependency on `Router`
 * instance state.
 */
export function findNode(node: TrieNode, segments: string[], index: number): TrieNode | null {
  if (index === segments.length) {
    return node;
  }

  const segment = segments[index];
  if (segment === undefined) return null;

  // Static match
  const staticChild = node.children.get(segment);
  if (staticChild) {
    const result = findNode(staticChild, segments, index + 1);
    if (result) return result;
  }

  // Param match
  if (node.paramChild) {
    const result = findNode(node.paramChild, segments, index + 1);
    if (result) return result;
  }

  // Wildcard match
  if (node.wildcardChild) {
    return node.wildcardChild;
  }

  return null;
}

/**
 * True only when `path.toLowerCase()` is provably a no-op: every character is
 * ASCII (`<= 0x7F`) and none is an ASCII uppercase letter (`A`–`Z`). Any
 * non-ASCII byte is treated as UNCERTAIN (it could be uppercase like `Ü`), so
 * this returns `false` and the caller folds — never skipping unicode case
 * folding (design.md D3). This lets `normalizePathForMatch` skip the
 * `toLowerCase()` allocation for the overwhelmingly common all-lowercase-ASCII
 * request path while staying byte-identical to always folding.
 */
export function isProvablyLowerAscii(path: string): boolean {
  for (let i = 0; i < path.length; i++) {
    const c = path.charCodeAt(i);
    if ((c >= 0x41 && c <= 0x5a) || c > 0x7f) return false;
  }
  return true;
}

/**
 * Structural match-time normalization WITHOUT case folding: collapse repeated
 * slashes and strip a single trailing slash (unless `strict`). Split out of
 * {@link normalizePathForMatch} so the case-fold decision and the structural
 * pass are separable — `matchRoute` reuses this to build the original-case path
 * only when a fold actually happened (HP-12), rather than running the full
 * normalize twice.
 */
export function collapseAndStrip(path: string, strict: boolean): string {
  let normalized = path;

  // Fast-path: skip the regex when there are no double slashes (99%+ of requests).
  if (normalized.includes('//')) {
    normalized = normalized.replace(/\/+/g, '/');
  }

  // Non-strict mode treats a trailing slash as insignificant; strict keeps it.
  if (!strict && normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Normalize a request path for segment-trie matching: fold case (unless
 * `caseSensitive`), collapse repeated slashes, and strip a single trailing
 * slash (unless `strict`). This is the one definition of the match-time
 * normalization rules, shared by `matchRoute` (in `match-route.ts`) and
 * {@link findAllowedMethods}.
 *
 * The `toLowerCase()` call is skipped when the path is provably case-stable
 * ({@link isProvablyLowerAscii}) — byte-identical to always folding, but with
 * no throwaway string on the common all-lowercase-ASCII path (HP-12 / D3).
 *
 * Query-string removal is intentionally NOT done here — it is caller-specific:
 * `matchRoute` strips the query before calling, while `findAllowedMethods`
 * receives an already query-free `ctx.path`. Pass `caseSensitive: true` to
 * normalize while preserving case (used by `matchRoute` to build the
 * original-case path from which param values are extracted).
 *
 * NOTE: registration-time normalization (`Router.normalizePath`) is a separate
 * concern — it joins the router prefix, guarantees a leading slash, and never
 * folds case — so it deliberately does not share this helper.
 */
export function normalizePathForMatch(
  path: string,
  caseSensitive: boolean,
  strict: boolean
): string {
  const folded = caseSensitive || isProvablyLowerAscii(path) ? path : path.toLowerCase();
  return collapseAndStrip(folded, strict);
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

  const segments = normalized.split('/').filter(Boolean);
  const node = findNode(root, segments, 0);
  if (!node || node.handlers.size === 0) return [];

  return Array.from(node.handlers.keys());
}

/**
 * One node in the iterative walk's explicit stack. `stage` is a small state
 * machine (0 = extract + try static, 1 = try param, 2 = try wildcard/backtrack)
 * so a single frame can be revisited on backtrack without recursion. `bound`
 * records whether this frame pushed a deferred param binding, so backtracking
 * can pop it without an object-property delete.
 */
interface WalkFrame {
  node: TrieNode;
  pos: number;
  stage: 0 | 1 | 2;
  seg: string;
  next: number;
  bound: boolean;
}

/**
 * Iterative, index-based segment-trie match (HP-11 / HP-13, design.md D4).
 *
 * Walks the trie with an EXPLICIT stack instead of recursion, so a pathological
 * segment count cannot overflow the call stack (DoS safety) — behavior is
 * otherwise byte-identical to the former recursive matcher: precedence is
 * static > param > wildcard at each node, a partially-matching branch backtracks
 * cleanly, and the first accepted terminal wins.
 *
 * Param/wildcard bindings are DEFERRED onto the caller-owned `bindNames` /
 * `bindValues` stacks and popped on backtrack, so params are materialized ONCE
 * on the accepted terminal by the caller (no eager bind + backtrack
 * `Reflect.deleteProperty`, and no `Object.keys` post-loop — the caller reads
 * the bind count). `decode` runs strictly on the already-split segment/remainder
 * (design.md D9), so an encoded slash/dot decodes into the value only and can
 * never create new path segments.
 *
 * `originalPath` (present only when case-folding actually occurred) supplies the
 * original-case param value at the same position as the folded lookup path.
 */
export function matchNodeIndexed(
  root: TrieNode,
  path: string,
  startPos: number,
  bindNames: string[],
  bindValues: string[],
  method: HttpMethod,
  decode: boolean,
  originalPath?: string
): HandlerEntry | null {
  const stack: WalkFrame[] = [
    { node: root, pos: startPos, stage: 0, seg: '', next: 0, bound: false },
  ];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame === undefined) break;

    // Stage 0 — first visit: terminal checks, then try the static child.
    if (frame.stage === 0) {
      if (frame.pos >= path.length) {
        const handler = frame.node.handlers.get(method);
        if (handler) return handler; // accepted — bind stacks hold this path's params
        stack.pop();
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
        stack.pop();
        continue;
      }
      frame.stage = 1;
      const staticChild = frame.node.children.get(frame.seg);
      if (staticChild) {
        stack.push({ node: staticChild, pos: frame.next, stage: 0, seg: '', next: 0, bound: false });
      }
      continue;
    }

    // Stage 1 — static child (if any) has failed: try the param child, deferring
    // its binding onto the shared stacks.
    if (frame.stage === 1) {
      frame.stage = 2;
      const paramChild = frame.node.paramChild;
      if (paramChild) {
        const paramName = paramChild.paramName;
        if (paramName === undefined) return null; // degenerate param node → whole walk fails (as before)
        const value =
          originalPath !== undefined
            ? decodeParam(segmentAt(originalPath, frame.pos), decode)
            : decodeParam(frame.seg, decode);
        bindNames.push(paramName);
        bindValues.push(value);
        frame.bound = true;
        stack.push({ node: paramChild, pos: frame.next, stage: 0, seg: '', next: 0, bound: false });
      }
      continue;
    }

    // Stage 2 — param branch (if taken) failed: undo its deferred bind, then try
    // the wildcard child (a terminal — it captures the original-case remainder).
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
    stack.pop();
  }

  return null;
}

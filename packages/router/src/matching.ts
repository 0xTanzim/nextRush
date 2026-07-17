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
 * Extract the next segment from path at given position without allocating arrays.
 * Returns [segment, nextIndex] where nextIndex is position after the trailing '/'.
 */
export function extractSegment(path: string, start: number): [segment: string, nextIndex: number] {
  const slashPos = path.indexOf('/', start);
  if (slashPos === -1) {
    return [path.slice(start), path.length];
  }
  return [path.slice(start, slashPos), slashPos + 1];
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
 * Normalize a request path for segment-trie matching: fold case (unless
 * `caseSensitive`), collapse repeated slashes, and strip a single trailing
 * slash (unless `strict`). This is the one definition of the match-time
 * normalization rules, shared by `matchRoute` (in `match-route.ts`) and
 * {@link findAllowedMethods}.
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
  let normalized = caseSensitive ? path : path.toLowerCase();

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
 * Index-based recursive node matching (avoids array allocation).
 *
 * `decode` is threaded explicitly (was `this.opts.decode` on the class) — this
 * function has no implicit dependency on `Router` instance state.
 */
export function matchNodeIndexed(
  node: TrieNode,
  path: string,
  pos: number,
  params: Record<string, string>,
  method: HttpMethod,
  decode: boolean,
  originalPath?: string
): HandlerEntry | null {
  // Reached end of path
  if (pos >= path.length) {
    return node.handlers.get(method) ?? null;
  }

  const [segment, nextPos] = extractSegment(path, pos);
  if (segment === '') return node.handlers.get(method) ?? null;

  // Try static match first (most specific)
  const staticChild = node.children.get(segment);
  if (staticChild) {
    const result = matchNodeIndexed(staticChild, path, nextPos, params, method, decode, originalPath);
    if (result) return result;
  }

  // Try parameter match — use original-case segment for param value
  if (node.paramChild) {
    const paramName = node.paramChild.paramName;
    if (paramName === undefined) return null;
    if (originalPath) {
      const [origSeg] = extractSegment(originalPath, pos);
      params[paramName] = decodeParam(origSeg, decode);
    } else {
      params[paramName] = decodeParam(segment, decode);
    }
    const result = matchNodeIndexed(
      node.paramChild,
      path,
      nextPos,
      params,
      method,
      decode,
      originalPath
    );
    if (result) return result;
    Reflect.deleteProperty(params, paramName);
  }

  // Try wildcard match (catches remaining path) — use original-case path
  if (node.wildcardChild) {
    const src = originalPath ?? path;
    params['*'] = decodeParam(src.slice(pos), decode);
    return node.wildcardChild.handlers.get(method) ?? null;
  }

  return null;
}

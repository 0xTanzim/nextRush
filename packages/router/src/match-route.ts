/**
 * @nextrush/router - Top-Level Route Match Orchestration
 *
 * `matchRoute` was originally part of `matching.ts` (the lookup-primitives
 * module: `decodeParam`/`extractSegment`/`findNode`/`findAllowedMethods`/
 * `matchNodeIndexed`), but `matching.ts` was approaching the 300-line ceiling
 * itself once `matchRoute` moved in — this file separates the top-level
 * "match a request" orchestration (query-strip, normalize, static fast-path,
 * tree-walk delegation, param post-processing) from the lower-level lookup
 * primitives it calls into.
 *
 * @packageDocumentation
 * @internal
 */

import type { Context, HttpMethod, RouteHandler } from '@nextrush/types';
import type { HandlerEntry, TrieNode } from './segment-trie';
import { matchNodeIndexed } from './matching';

/**
 * Frozen empty params for static routes — avoids allocation per request.
 * Duplicated here (also defined in `router.ts`) rather than shared via an
 * import cycle — both are tiny, module-local, and never diverge in practice
 * since `Object.freeze(Object.create(null))` has exactly one meaning.
 */
const EMPTY_PARAMS: Record<string, string> = Object.freeze(
  Object.create(null) as Record<string, string>
);

/**
 * `matchRoute`'s result, before the caller (`Router.match`) attaches
 * `middleware: this.routerMiddleware` — that field is intentionally left off
 * here since `matchRoute` only reads `routerMiddleware`-independent state.
 */
export interface RouteMatchResult {
  handler: RouteHandler;
  params: Record<string, string>;
  executor?: (ctx: Context) => Promise<void>;
}

/**
 * Match a route and return handler + params.
 *
 * Extracted as a standalone function per design.md D1 — `Router.match()`
 * becomes a thin delegating wrapper around this. Every piece of `Router`
 * state it reads (`opts`, `root`, `staticRoutes`, `hasParamRoutes`) is
 * read-only here (no mutation, unlike `addRoute` in `registration.ts`), so
 * it's threaded as plain parameters. `routerMiddleware` is intentionally NOT
 * a parameter — the caller attaches `middleware: this.routerMiddleware` to
 * the result itself, since this function never reads the array's contents.
 */
export function matchRoute(
  method: HttpMethod,
  rawPath: string,
  root: TrieNode,
  staticRoutes: Map<string, HandlerEntry>,
  hasParamRoutes: boolean,
  caseSensitive: boolean,
  strict: boolean,
  decode: boolean
): RouteMatchResult | null {
  let path = rawPath;
  // Query string must not affect path matching (RFC 3986 §3.4). Strip it here
  // so both the normalized lookup path and extracted param values exclude it.
  const queryIdx = path.indexOf('?');
  if (queryIdx !== -1) path = path.slice(0, queryIdx);

  const isCaseInsensitive = !caseSensitive;
  let normalized = isCaseInsensitive ? path.toLowerCase() : path;

  // Fast-path: skip regex when no double slashes (99%+ of requests)
  if (normalized.includes('//')) {
    normalized = normalized.replace(/\/+/g, '/');
  }

  // For strict mode, keep trailing slash; otherwise remove it
  if (!strict && normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  // FAST PATH: O(1) static route lookup (no tree traversal)
  // For static routes, trailing slash is irrelevant — always strip for lookup
  const staticKey =
    normalized.length > 1 && normalized.endsWith('/')
      ? `${method} ${normalized.slice(0, -1)}`
      : `${method} ${normalized}`;
  const staticEntry = staticRoutes.get(staticKey);
  if (staticEntry) {
    return {
      handler: staticEntry.handler,
      params: EMPTY_PARAMS,
      executor: staticEntry.executor,
    };
  }

  // Only walk tree if we have param/wildcard routes
  if (!hasParamRoutes) return null;

  // Use index-based path scanning instead of split('/').filter(Boolean)
  const params: Record<string, string> = {};

  // For case-insensitive mode, preserve original-case path for param values
  let originalPath: string | undefined;
  if (isCaseInsensitive) {
    originalPath = path;
    if (originalPath.includes('//')) {
      originalPath = originalPath.replace(/\/+/g, '/');
    }
    if (!strict && originalPath.length > 1 && originalPath.endsWith('/')) {
      originalPath = originalPath.slice(0, -1);
    }
  }

  const result = matchNodeIndexed(
    root,
    normalized,
    1, // Start after leading '/'
    params,
    method,
    decode,
    originalPath
  );
  if (!result) return null;

  // Check if any params were actually set
  let hasParams = false;
  for (const key of Object.keys(params)) {
    if (params[key] === undefined) {
      Reflect.deleteProperty(params, key);
    } else {
      hasParams = true;
    }
  }

  return {
    handler: result.handler,
    params: hasParams ? params : EMPTY_PARAMS,
    executor: result.executor,
  };
}

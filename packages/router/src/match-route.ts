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

import type { HttpMethod, Middleware, RouteMatch } from '@nextrush/types';
import { EMPTY_PARAMS } from './constants';
import { matchNodeIndexed, collapseAndStrip, isProvablyLowerAscii } from './matching';
import type { StaticRouteMap, TrieNode } from './segment-trie';

/**
 * Match a route and return the full {@link RouteMatch} in a SINGLE allocation
 * (design.md D1 / HP-10).
 *
 * `matchRoute` builds the final `RouteMatch` — including `middleware:
 * routerMiddleware` — directly at each return site, so `Router.match()` gets
 * one object per matched request instead of a bare result later re-wrapped by
 * `resolveMatch`. `routerMiddleware` is threaded in as a parameter (its
 * contents are never read here — only attached by reference), preserving the
 * "no implicit `Router` state" property of the earlier extraction while
 * removing the duplicate wrapper object.
 *
 * Every other piece of `Router` state it reads (`root`, `staticRoutes`,
 * `hasParamRoutes`, the option flags) is read-only here (no mutation, unlike
 * `addRoute` in `registration.ts`), so it is threaded as plain parameters.
 */
export function matchRoute(
  method: HttpMethod,
  rawPath: string,
  root: TrieNode,
  staticRoutes: StaticRouteMap,
  hasParamRoutes: boolean,
  caseSensitive: boolean,
  strict: boolean,
  decode: boolean,
  routerMiddleware: Middleware[]
): RouteMatch | null {
  let path = rawPath;
  // Query string must not affect path matching (RFC 3986 §3.4). Strip it here,
  // before normalization, so both the lookup path and extracted param values
  // exclude it. This strip is caller-specific: `findAllowedMethods` receives an
  // already query-free `ctx.path`, so the shared `normalizePathForMatch` does
  // not strip — only `matchRoute` does.
  const queryIdx = path.indexOf('?');
  if (queryIdx !== -1) path = path.slice(0, queryIdx);

  // HP-12: decide case-stability ONCE. When the path is provably case-stable
  // (case-sensitive router, or an all-lowercase-ASCII path), folding is a no-op
  // and the original-case path equals the normalized one — so we skip both the
  // `toLowerCase()` allocation and the second original-case normalize pass.
  const caseStable = caseSensitive || isProvablyLowerAscii(path);
  const folded = caseStable ? path : path.toLowerCase();
  const normalized = collapseAndStrip(folded, strict);

  // FAST PATH: O(1) static route lookup (no tree traversal). Method-nested map
  // (HP-9): select the inner map by method, then probe by the normalized path —
  // no per-request `${method} ${path}` key-string allocation. For static routes
  // a trailing slash is irrelevant, so always strip it for the probe.
  const methodMap = staticRoutes.get(method);
  if (methodMap) {
    const staticKey =
      normalized.length > 1 && normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
    const staticEntry = methodMap.get(staticKey);
    if (staticEntry) {
      return {
        handler: staticEntry.handler,
        params: EMPTY_PARAMS,
        middleware: routerMiddleware,
        executor: staticEntry.executor,
      };
    }
  }

  // Only walk tree if we have param/wildcard routes
  if (!hasParamRoutes) return null;

  // Use index-based path scanning instead of split('/').filter(Boolean)
  const params: Record<string, string> = {};

  // Original-case (query-stripped) path so extracted param values keep their
  // casing while lookup uses the lowercased `normalized`. Needed ONLY when a
  // fold actually happened (HP-12): when case-stable, `normalized` already IS
  // the original-case structure, so `matchNodeIndexed` extracts from it and no
  // second normalize pass runs.
  const originalPath = caseStable ? undefined : collapseAndStrip(path, strict);

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

  // Post-match: compute `hasParams` so a zero-param walk returns the shared
  // frozen EMPTY_PARAMS sentinel rather than a throwaway object. RETAINED (not
  // removed) per task 2.3 / design.md D3: the `deleteProperty` branch is a cheap
  // defensive guard — `matchNodeIndexed` only ever assigns string param values
  // and deletes its own keys on backtrack, so an undefined-valued key cannot
  // occur today — but removing the loop buys nothing (Object.keys still runs to
  // decide `hasParams`) while dropping that guard, and hot-path rewrites are
  // deferred to the radix RFC's benchmark (design.md D4).
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
    middleware: routerMiddleware,
    executor: result.executor,
  };
}

/**
 * Stable router state `resolveMatch` reads on every request. All fields are
 * fixed references for the router's lifetime, so the caller memoizes this once
 * rather than rebuilding it per request.
 */
export interface MatchState {
  readonly root: TrieNode;
  readonly staticRoutes: StaticRouteMap;
  readonly caseSensitive: boolean;
  readonly strict: boolean;
  readonly decode: boolean;
  readonly routerMiddleware: Middleware[];
}

/**
 * Resolve a request to a full {@link RouteMatch}. Thin delegator to
 * {@link matchRoute}, which now builds the final `RouteMatch` (incl.
 * `state.routerMiddleware`) in one allocation — so this no longer wraps a
 * result in a second object (HP-10). `Router.match()` is a one-line delegator
 * to this. `hasParamRoutes` is passed separately from `state` because it is
 * the one piece of router state that flips after construction.
 */
export function resolveMatch(
  state: MatchState,
  hasParamRoutes: boolean,
  method: HttpMethod,
  path: string
): RouteMatch | null {
  return matchRoute(
    method,
    path,
    state.root,
    state.staticRoutes,
    hasParamRoutes,
    state.caseSensitive,
    state.strict,
    state.decode,
    state.routerMiddleware
  );
}

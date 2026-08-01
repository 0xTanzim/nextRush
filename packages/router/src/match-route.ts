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
import { EMPTY_PARAMS, NULL_PROTO } from './constants';
import { matchNodeIndexed, collapseAndStrip, isProvablyLowerAscii } from './matching';
import type { WalkPool } from './walk-pool';
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
  routerMiddleware: Middleware[],
  /**
   * When `true`, `rawPath` is trusted as already the output of
   * `canonicalizePath()` (same `caseSensitive`/`strict` options) — the fold
   * and structural-collapse steps below are skipped entirely rather than
   * re-derived. Only valid when the caller has actually run
   * `canonicalizePath()` on this exact input first (F-10); the router's own
   * `routes()` dispatch path is the only caller that does. Defaults to
   * `false`, preserving every other caller's existing behavior — including
   * `Router.match()`, which never canonicalizes first.
   */
  preNormalized = false,
  /**
   * When supplied, the param walk reuses this router instance's pooled
   * `WalkFrame[]`/binding-array scratch space instead of allocating fresh
   * arrays on this call (F-02, `reduce-router-match-allocations`). Omitted,
   * `matchRoute` behaves exactly as before.
   */
  walkPool?: WalkPool
): RouteMatch | null {
  let path = rawPath;
  // Query string must not affect path matching (RFC 3986 §3.4). Strip it here,
  // before normalization, so both the lookup path and extracted param values
  // exclude it. This strip is caller-specific: `findAllowedMethods` receives an
  // already query-free `ctx.path`, so the shared `normalizePathForMatch` does
  // not strip — only `matchRoute` does.
  if (!preNormalized) {
    const queryIdx = path.indexOf('?');
    if (queryIdx !== -1) path = path.slice(0, queryIdx);
  }

  // HP-12: decide case-stability ONCE. When the path is provably case-stable
  // (case-sensitive router, or an all-lowercase-ASCII path), folding is a no-op
  // and the original-case path equals the normalized one — so we skip both the
  // `toLowerCase()` allocation and the second original-case normalize pass.
  //
  // F-10: when `preNormalized` is true, the caller already ran this exact
  // fold+collapse via `canonicalizePath()` — trust `path` as both the
  // normalized AND original-case string, skipping the fold+collapse
  // re-derivation entirely rather than repeating work already done upstream.
  let normalized: string;
  let caseStable: boolean;
  if (preNormalized) {
    normalized = path;
    caseStable = true;
  } else {
    caseStable = caseSensitive || isProvablyLowerAscii(path);
    const folded = caseStable ? path : path.toLowerCase();
    normalized = collapseAndStrip(folded, strict);
  }

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

  // Original-case (query-stripped) path so extracted param values keep their
  // casing while lookup uses the lowercased `normalized`. Needed ONLY when a
  // fold actually happened (HP-12): when case-stable, `normalized` already IS
  // the original-case structure, so the walk extracts from it and no second
  // normalize pass runs.
  const originalPath = caseStable ? undefined : collapseAndStrip(path, strict);

  // Deferred param binding (HP-11): the walk records the accepted path's
  // `:param`/`*` bindings onto these parallel stacks (pushed on descent, popped
  // on backtrack) so params are materialized ONCE here on the accepted terminal
  // — no eager bind + backtrack `Reflect.deleteProperty`. Reused from the
  // router's pool when supplied (F-02) instead of allocated fresh.
  const bindNames: string[] = walkPool ? walkPool.bindNames : [];
  const bindValues: string[] = walkPool ? walkPool.bindValues : [];
  // A pooled bindNames/bindValues array persists across calls — clear any
  // leftover entries from a prior match before this walk starts (the walk
  // itself pops everything it pushes on a clean miss or match, but a defensive
  // clear here costs nothing on the common empty case and closes any future
  // edit that might leave a stale entry behind).
  if (walkPool) {
    bindNames.length = 0;
    bindValues.length = 0;
  }

  const entry = matchNodeIndexed(
    root,
    normalized,
    1, // Start after leading '/'
    bindNames,
    bindValues,
    method,
    decode,
    originalPath,
    walkPool
  );
  if (!entry) return null;

  // Materialize params once on a bag whose prototype chain excludes
  // `Object.prototype` (design.md D8): a param named
  // `__proto__`/`constructor`/`prototype` binds as an OWN key with no prototype
  // mutation, and no inherited member is visible on `ctx.params`. Derived from
  // `NULL_PROTO` rather than `Object.create(null)` so the object keeps V8 fast
  // properties and handler reads stay inline-cacheable. The bind count replaces
  // the former `Object.keys` post-loop (HP-13); zero binds returns the shared
  // frozen `EMPTY_PARAMS`.
  const count = bindNames.length;
  let params: Record<string, string>;
  if (count === 0) {
    params = EMPTY_PARAMS;
  } else {
    params = Object.create(NULL_PROTO) as Record<string, string>;
    for (let i = 0; i < count; i++) {
      const name = bindNames[i];
      const value = bindValues[i];
      if (name !== undefined && value !== undefined) params[name] = value;
    }
  }

  return {
    handler: entry.handler,
    params,
    middleware: routerMiddleware,
    executor: entry.executor,
  };
}

/**
 * Stable router state `resolveMatch` reads on every request. All fields are
 * fixed references for the router's lifetime, so the caller memoizes this once
 * rather than rebuilding it per request.
 *
 * `walkPool` is the one field that is itself mutable (its contents, not the
 * reference) — the reused `WalkFrame[]`/binding-array scratch space (F-02,
 * `reduce-router-match-allocations`). It is `undefined` until the router has
 * at least one param/wildcard route (no pool needed for a static-only router,
 * per `createWalkPool(0)` never being called) and is rebuilt whenever the
 * router's `maxDepth` grows past what the current pool was sized for — see
 * `Router`'s own wiring, not this interface, for when that rebuild happens.
 */
export interface MatchState {
  readonly root: TrieNode;
  readonly staticRoutes: StaticRouteMap;
  readonly caseSensitive: boolean;
  readonly strict: boolean;
  readonly decode: boolean;
  readonly routerMiddleware: Middleware[];
  walkPool?: WalkPool;
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
  path: string,
  /**
   * Forwarded to {@link matchRoute} — see its own doc comment for the
   * caller contract. Defaults to `false`.
   */
  preNormalized = false
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
    state.routerMiddleware,
    preNormalized,
    state.walkPool
  );
}

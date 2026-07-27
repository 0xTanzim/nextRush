/**
 * @nextrush/router - Dispatch Middleware Generation
 *
 * The two app-facing `Middleware` factories extracted from the `Router` class
 * (design.md D2 — finishing T014's split along the same seam: the composition,
 * matching-engine, and sealing clusters were already extracted; this is the
 * dispatch/allowed-methods generation cluster).
 *
 * Both closures are structurally pure — every value they read (the `match`
 * function, the trie root, the case-sensitivity/strict flags) is passed in
 * explicitly rather than captured off `this`, so they carry no hidden
 * dependency on `Router` beyond their parameters (same principle as the
 * matching-engine extraction, design.md D1). `Router.routes()` and
 * `Router.allowedMethods()` stay as thin public methods that supply that
 * state and return these closures.
 *
 * @packageDocumentation
 * @internal
 */

import type { Context, HttpMethod, Middleware, RouteMatch } from '@nextrush/types';
import { NOOP_NEXT, type TrieNode } from './segment-trie';
import { findAllowedMethods } from './find-node';
import { canonicalizePath } from './canonicalize';

/**
 * Shared resolved promise for the no-`next` miss path (NF-1). Reused rather than
 * allocating a fresh `Promise.resolve()` per miss, mirroring the router's
 * existing `NOOP_NEXT`/`RESOLVED_PROMISE` sentinels.
 */
const RESOLVED: Promise<void> = Promise.resolve();

/**
 * Build the router's primary dispatch middleware.
 *
 * On each request it canonicalizes the path (RFC-029): a dot segment
 * (`.`/`..`) is rejected with 400 before any route match or path-based
 * middleware runs — resolving it locally would diverge from how a front-end
 * proxy already handled the same segment, so it is never resolved, only
 * rejected. Otherwise it resolves the route via the injected `match`
 * function, publishes the canonical path onto `ctx.path` (preserving the raw
 * target as `ctx.originalPath`), sets `ctx.params`, and runs the
 * pre-compiled executor (which already bakes in any router-level
 * middleware). A miss sets `ctx.status = 404` and yields to the next
 * middleware so `allowedMethods()`/a 404 handler can act.
 *
 * @param match - Route resolver, supplied by `Router.match` so this factory
 *   never touches `Router` internals directly.
 * @param caseSensitive - Router case-sensitivity option, forwarded to
 *   canonicalization so the published `ctx.path` matches what `match` used.
 * @param strict - Router strict-trailing-slash option, forwarded likewise.
 */
export function createRoutesMiddleware(
  match: (method: HttpMethod, path: string) => RouteMatch | null,
  caseSensitive: boolean,
  strict: boolean
): Middleware {
  return (ctx: Context, next?: () => Promise<void>): Promise<void> => {
    const originalPath = ctx.path;
    const canonical = canonicalizePath(originalPath, caseSensitive, strict);

    if (canonical.rejected) {
      // A dot segment is a request-shape violation, not a 404 — it stops the
      // chain outright rather than falling through to a 404/allowedMethods
      // handler, which would still leak information about the un-normalized
      // target via ctx.path.
      ctx.status = 400;
      (ctx as { originalPath: string }).originalPath = originalPath;
      return RESOLVED;
    }

    (ctx as { path: string }).path = canonical.path;
    (ctx as { originalPath: string }).originalPath = originalPath;

    const routeMatch = match(ctx.method, canonical.path);

    if (!routeMatch) {
      // No route matched — set 404 so allowedMethods()/notFoundHandler() can act,
      // then forward to the next middleware (the allowedMethods fall-through).
      ctx.status = 404;
      return next ? next() : RESOLVED;
    }

    ctx.params = routeMatch.params;

    // NF-1: forward the executor's promise DIRECTLY instead of `await`-ing it in
    // an extra `async` frame. The executor already returns a `Promise<void>`,
    // converts synchronous throws to rejections, and terminates the chain at the
    // handler, so ordering, rejection propagation, and the `setNext(NOOP_NEXT)`
    // guard are unchanged — one state machine + one microtask hop removed. A
    // synchronous throw from `match()` itself is still converted to a rejection
    // by the composer's `try/catch` that wraps this middleware call.
    return routeMatch.executor
      ? routeMatch.executor(ctx)
      : // Fallback (no pre-compiled executor — shouldn't happen): wrap so a void
        // or thenable return still yields a Promise<void> and never a sync throw.
        Promise.resolve(routeMatch.handler(ctx, NOOP_NEXT));
  };
}

/**
 * Build the allowed-methods middleware.
 *
 * Runs after the dispatch middleware: if the request was a 404, it does a
 * single tree walk to collect every method registered for the path. An
 * `OPTIONS` request gets a `200` with an `Allow` header; any other method
 * gets a `405` with `Allow`. If no method is registered for the path it
 * leaves the 404 untouched.
 *
 * @param root - Trie root to walk for allowed methods.
 * @param caseSensitive - Router case-sensitivity option.
 * @param strict - Router strict-trailing-slash option.
 */
export function createAllowedMethodsMiddleware(
  root: TrieNode,
  caseSensitive: boolean,
  strict: boolean
): Middleware {
  return async (ctx: Context, next?: () => Promise<void>): Promise<void> => {
    if (next) {
      await next();
    }

    if (ctx.status !== 404) return;

    // Single tree walk to find all allowed methods instead of N×match()
    const allowed = findAllowedMethods(ctx.path, root, caseSensitive, strict);

    if (allowed.length === 0) return;

    const allowHeader = allowed.join(', ');

    // If OPTIONS request, respond with allowed methods
    if (ctx.method === 'OPTIONS') {
      ctx.status = 200;
      ctx.set('Allow', allowHeader);
      ctx.body = '';
      return;
    }

    // Otherwise, return 405 Method Not Allowed
    ctx.status = 405;
    ctx.set('Allow', allowHeader);
  };
}

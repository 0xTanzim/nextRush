/**
 * @nextrush/core - Router Prefix Mount
 *
 * Builds the middleware that mounts a router at a path prefix, rewriting
 * `ctx.path` for the duration of the sub-router and restoring it afterward.
 * Extracted from `Application.route()` (audit C-5).
 *
 * @packageDocumentation
 */

import type { Context, Middleware } from '@nextrush/types';

const SLASH_CHAR_CODE = 0x2f; // '/'.charCodeAt(0)

/** @internal Symbol keys for mount state — avoids polluting the user's ctx.state namespace */
const ORIGINAL_PATH = Symbol.for('nextrush.originalPath');
const ROUTE_PREFIX = Symbol.for('nextrush.routePrefix');

/**
 * Test whether `currentPath` falls under `normalizedPrefix`, delegating to
 * the mounted router's own `matchesMountPrefix` when it implements one
 * (RFC-029, task 3.8) so the mount boundary uses the SAME case-folding and
 * structural normalization the router's own dispatch does — never a rule of
 * its own. A `Routable` with no such method (e.g. a minimal test double)
 * falls back to the literal, case-sensitive prefix + boundary check this
 * function previously did inline.
 */
function resolveMountedPath(
  currentPath: string,
  normalizedPrefix: string,
  matchesMountPrefix?: (path: string, prefix: string) => string | undefined
): string | undefined {
  if (matchesMountPrefix) {
    return matchesMountPrefix(currentPath, normalizedPrefix);
  }

  const prefixLen = normalizedPrefix.length;
  if (!currentPath.startsWith(normalizedPrefix)) return undefined;

  const hasCharAfterPrefix = prefixLen < currentPath.length;
  if (hasCharAfterPrefix && currentPath.charCodeAt(prefixLen) !== SLASH_CHAR_CODE) return undefined;

  return currentPath.slice(prefixLen) || '/';
}

/**
 * Create a middleware that mounts `routerMiddleware` at `normalizedPrefix`.
 *
 * @remarks
 * On a matching request it strips the prefix from `ctx.path`, runs the mounted
 * middleware, and restores the original path in a `finally` — including across
 * the downstream `next()` boundary, so middleware after the mount sees the
 * original path. Callers pass an already-normalized prefix (leading `/`, no
 * trailing `/`).
 *
 * @param normalizedPrefix - The mount prefix (e.g. `/api/users`).
 * @param routerMiddleware - The mounted router's `routes()` middleware.
 * @param matchesMountPrefix - The mounted router's own prefix test, when it
 *   implements {@link import('./application').Routable.matchesMountPrefix} —
 *   see {@link resolveMountedPath}.
 */
export function createPrefixMount(
  normalizedPrefix: string,
  routerMiddleware: Middleware,
  matchesMountPrefix?: (path: string, prefix: string) => string | undefined
): Middleware {
  return async (ctx: Context, next): Promise<void> => {
    const currentPath = ctx.path;

    const adjustedPath = resolveMountedPath(currentPath, normalizedPrefix, matchesMountPrefix);
    if (adjustedPath === undefined) {
      return next();
    }

    // Direct path manipulation (no Proxy - fast!)
    (ctx as { path: string }).path = adjustedPath;

    // Store original for recovery (Symbol keys avoid ctx.state pollution)
    (ctx.state as Record<symbol, unknown>)[ORIGINAL_PATH] = currentPath;
    (ctx.state as Record<symbol, unknown>)[ROUTE_PREFIX] = normalizedPrefix;

    try {
      await routerMiddleware(ctx, async () => {
        (ctx as { path: string }).path = currentPath;
        await next();
        (ctx as { path: string }).path = adjustedPath;
      });
    } finally {
      (ctx as { path: string }).path = currentPath;
      (ctx.state as Record<symbol, unknown>)[ORIGINAL_PATH] = undefined;
      (ctx.state as Record<symbol, unknown>)[ROUTE_PREFIX] = undefined;
    }
  };
}

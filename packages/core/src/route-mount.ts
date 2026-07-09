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

/** @internal Symbol keys for mount state — avoids polluting the user's ctx.state namespace */
const ORIGINAL_PATH = Symbol.for('nextrush.originalPath');
const ROUTE_PREFIX = Symbol.for('nextrush.routePrefix');

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
 */
export function createPrefixMount(
  normalizedPrefix: string,
  routerMiddleware: Middleware
): Middleware {
  const prefixLen = normalizedPrefix.length;

  return async (ctx: Context, next): Promise<void> => {
    const currentPath = ctx.path;

    // Fast prefix check
    if (!currentPath.startsWith(normalizedPrefix)) {
      return next();
    }

    // Check prefix boundary (avoid /api/usersxxx matching /api/users)
    const hasCharAfterPrefix = prefixLen < currentPath.length;
    if (hasCharAfterPrefix && currentPath.charCodeAt(prefixLen) !== 47) {
      // 47 = '/'
      return next();
    }

    // Direct path manipulation (no Proxy - fast!)
    const adjustedPath = currentPath.slice(prefixLen) || '/';
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

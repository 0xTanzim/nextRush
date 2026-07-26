/**
 * @nextrush/adapter-nextjs - Mount a NextRush app in a Next.js App Router
 * route handler
 *
 * ```typescript
 * import { createApp, createRouter } from 'nextrush';
 * import { handle } from 'nextrush/nextjs';
 *
 * const app = createApp();
 * const api = createRouter();
 * api.get('/hello', (ctx) => ctx.json({ message: 'Hello Next.js!' }));
 * app.route('/api', api);
 *
 * export const { GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS } = handle(app);
 * ```
 *
 * The request is never modified: mount prefixes are the application's own
 * (`app.route(prefix, router)`), not this bridge's — see RFC-024 §7.4/§9.3/§9.4.
 * This package is fully Web-standard: no `node:*`, `process`, or runtime
 * global, so one entry point runs on every host Next.js runs on (RFC-024 §13).
 *
 * @packageDocumentation
 * @module @nextrush/adapter-nextjs
 */

import type { Application, Context } from '@nextrush/core';
import { createFetchHandler, type EdgeExecutionContext } from '@nextrush/adapter-edge';
import { type AppSource, memoizeAppSource, resolveAfter } from './boot';
import { explainMountMismatch, resolveMountSplit } from './diagnose';

export type { AppSource };

/** Route params as Next supplies them: a Promise since 15.0.0-RC, a plain object in 14. */
export type NextRouteParams = Record<string, string | string[] | undefined>;

/**
 * The structural minimum of Next's second handler argument. Typed structurally
 * rather than imported from `next`, so this package compiles without `next`
 * installed and does not break when Next renames the concrete type (it
 * already added `RouteContext<'…'>`).
 *
 * @remarks
 * Both the interface and `params` are intentionally non-optional: Next's own
 * generated `RouteContext<Route>` (`.next/types/routes.d.ts`) declares
 * `params: Promise<...>` as required, and its route-handler type check
 * rejects an exported handler whose second parameter is narrower (optional,
 * or a plain object) than that — proven by the Next 15/16 `next build`
 * fixtures under `packages/adapters/conformance/deploy-verification/`.
 */
export interface NextRouteContext {
  params: Promise<NextRouteParams>;
}

/** One Next.js route-handler export. */
export type NextRouteHandler = (
  request: Request,
  context: NextRouteContext
) => Promise<Response>;

/** The seven methods Next.js supports, ready to destructure. */
export interface NextRouteHandlers {
  GET: NextRouteHandler;
  POST: NextRouteHandler;
  PUT: NextRouteHandler;
  PATCH: NextRouteHandler;
  DELETE: NextRouteHandler;
  HEAD: NextRouteHandler;
  OPTIONS: NextRouteHandler;
}

export interface NextHandlerOptions {
  /** Per-request timeout in ms, raced to a 504. Default: the edge engine's default. */
  timeout?: number;
  /** Custom error → Response mapping. Same contract as the edge adapter's `onError`. */
  onError?: (error: Error, ctx: Context) => Response | Promise<Response>;
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

/**
 * Mount a NextRush application in a Next.js App Router route handler.
 *
 * @param app - An {@link Application}, or a (possibly async) factory producing
 *   one. The factory is memoized once (RFC-024 §8.7) — it is retried on the
 *   next request after a failed boot, never permanently poisoned.
 * @param options - Timeout and error-handling pass-throughs to the underlying
 *   fetch engine. See {@link NextHandlerOptions}.
 * @returns The seven Next.js route-handler exports, ready to destructure.
 */
export function handle(app: AppSource, options: NextHandlerOptions = {}): NextRouteHandlers {
  const resolveApp = memoizeAppSource(app);

  // Deferred: the fetch engine is built lazily on first dispatch, once the
  // app is resolved — a factory app is not available synchronously.
  let enginePromise:
    | Promise<{ engine: ReturnType<typeof createFetchHandler>; resolvedApp: Application }>
    | undefined;
  const ensureEngine = (): Promise<{
    engine: ReturnType<typeof createFetchHandler>;
    resolvedApp: Application;
  }> => {
    enginePromise ??= resolveApp()
      .then((resolvedApp) => ({
        engine: createFetchHandler(resolvedApp, options),
        resolvedApp,
      }))
      .catch((err: unknown) => {
        enginePromise = undefined;
        throw err;
      });
    return enginePromise;
  };

  /**
   * Diagnose a 404, in development only, by re-dispatching the mount-prefix-
   * stripped path through the same engine (RFC-024 §8.4). Never serves the
   * alternate response — only logs, if a mismatch is proven.
   */
  const diagnoseIfMismatched = async (
    engine: ReturnType<typeof createFetchHandler>,
    resolvedApp: Application,
    pathname: string,
    context: NextRouteContext | undefined
  ): Promise<void> => {
    if (resolvedApp.isProduction) return;

    const params = (await context?.params) ?? {};
    const split = resolveMountSplit(pathname, params);
    if (split === undefined) return;

    const probeRequest = new Request(new URL(split.stripped, 'http://localhost'));
    const probeResponse = await engine(probeRequest);
    const matched = probeResponse.status !== 404;

    const hint = explainMountMismatch({
      pathname,
      params,
      routeExists: (candidate) => matched && candidate === split.stripped,
    });
    if (hint) resolvedApp.logger.warn(hint);
  };

  const dispatch = async (request: Request, context?: NextRouteContext): Promise<Response> => {
    const { engine, resolvedApp } = await ensureEngine();
    const after = await resolveAfter();
    const executionContext: EdgeExecutionContext | undefined = after
      ? {
          waitUntil: (p: Promise<unknown>) => {
            // `ctx.waitUntil` is documented never to throw from the caller's
            // perspective (EdgeContext no-ops silently with no execution
            // context) — preserve that contract even when `after()` itself
            // rejects or throws synchronously (e.g. called outside a real
            // Next request scope in a misconfigured host).
            try {
              after(() => p.then(() => undefined));
            } catch {
              // Swallowed by design — see the remark above.
            }
          },
        }
      : undefined;

    const response = await engine(request, executionContext);
    if (response.status === 404) {
      const pathname = new URL(request.url).pathname;
      await diagnoseIfMismatched(engine, resolvedApp, pathname, context);
    }
    return response;
  };

  const handlers = {} as NextRouteHandlers;
  for (const method of METHODS) {
    handlers[method] = (request: Request, context?: NextRouteContext) =>
      dispatch(request, context);
  }
  return handlers;
}

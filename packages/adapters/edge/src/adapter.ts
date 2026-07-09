/**
 * @nextrush/adapter-edge - Edge Runtime Adapter
 *
 * Connects NextRush Application to Edge runtimes via fetch handlers.
 *
 * @remarks
 * **Size optimization**: Edge runtimes have strict bundle-size constraints
 * (e.g. Cloudflare Workers 1 MB limit). Import only the packages you need:
 *
 * - Import `@nextrush/core` and `@nextrush/adapter-edge` only.
 * - Avoid `@nextrush/di` unless you need DI (adds `reflect-metadata`).
 * - Tree-shake unused middleware — each middleware is a separate package.
 * - Use `@nextrush/router` only if you have dynamic routes; for simple
 *   handlers, use the application directly.
 *
 * @packageDocumentation
 */

import type { Application } from '@nextrush/core';
import type { FetchAdapter } from '@nextrush/types';
import { createEdgeContext, EdgeContext, type EdgeExecutionContext } from './context';

/**
 * Options for the fetch handler
 */
export interface FetchHandlerOptions {
  /**
   * Custom error handler
   */
  onError?: (error: Error, ctx: EdgeContext) => Response | Promise<Response>;

  /**
   * Request timeout in milliseconds. When set, the handler races the
   * application logic against a timer and returns a 504 Gateway Timeout
   * if the timer fires first.
   *
   * Recommended defaults per platform:
   * - Cloudflare Workers: 30 000 (30 s CPU limit)
   * - Vercel Edge:        25 000 (25 s wall limit)
   *
   * When omitted, no timeout is enforced.
   */
  timeout?: number;
}

/**
 * Standard edge fetch handler type
 */
export type FetchHandler = (
  request: Request,
  ctx?: EdgeExecutionContext
) => Response | Promise<Response>;

/**
 * Create a fetch handler for Edge runtimes
 *
 * @param app - NextRush Application instance
 * @param options - Handler options
 * @returns Fetch handler function
 *
 * @example
 * ```typescript
 * // Cloudflare Workers
 * import { createApp } from '@nextrush/core';
 * import { createFetchHandler } from '@nextrush/adapter-edge';
 *
 * const app = createApp();
 * const handler = createFetchHandler(app);
 *
 * export default {
 *   fetch: handler
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Vercel Edge Functions
 * import { createApp } from '@nextrush/core';
 * import { createFetchHandler } from '@nextrush/adapter-edge';
 *
 * const app = createApp();
 * export const config = { runtime: 'edge' };
 * export default createFetchHandler(app);
 * ```
 */
export function createFetchHandler(
  app: Application,
  options: FetchHandlerOptions = {}
): FetchHandler {
  const run = createRequestRunner(app, options);
  return (request: Request, executionContext?: EdgeExecutionContext): Promise<Response> =>
    run(request, executionContext);
}

/**
 * Internal request runner shared by every edge entry point.
 *
 * @remarks
 * Centralizes booting, context creation (threading Cloudflare `env` — F-03),
 * timeout racing with cooperative cancellation (F-08), the header-preserving
 * finalize path (F-02), and error handling — so Cloudflare/Vercel/Netlify
 * handlers cannot drift.
 */
function createRequestRunner(
  app: Application,
  options: FetchHandlerOptions
): (request: Request, executionContext?: EdgeExecutionContext, env?: unknown) => Promise<Response> {
  const { timeout } = options;
  const trustProxy = app.options.proxy ?? false;

  /** Sentinel value returned by the timeout racer */
  const TIMEOUT_SENTINEL = Symbol('timeout');

  // Edge has no serve()/start() phase, so the deferred boot barrier runs lazily
  // on the first request (idempotent). The boot promise caches the snapshotted
  // request handler, so every request awaits and reuses the same one.
  let bootPromise: Promise<ReturnType<Application['callback']>> | null = null;
  const ensureBooted = (): Promise<ReturnType<Application['callback']>> => {
    bootPromise ??= app.ready().then(() => {
      const handler = app.callback();
      // F-14: mark the app running so `app.isRunning` is consistent with the
      // server adapters. Edge has no server lifetime, so close()/destroy() are
      // intentionally never called — that no-teardown contract is documented
      // on createFetchHandler.
      app.start();
      return handler;
    });
    return bootPromise;
  };

  return async (
    request: Request,
    executionContext?: EdgeExecutionContext,
    env?: unknown
  ): Promise<Response> => {
    const handler = await ensureBooted();
    const ctx = createEdgeContext(request, executionContext, trustProxy, env);

    try {
      if (timeout !== undefined && timeout > 0) {
        let timerId: ReturnType<typeof setTimeout> | undefined;
        try {
          const result = await Promise.race([
            handler(ctx).then(() => undefined),
            new Promise<typeof TIMEOUT_SENTINEL>((resolve) => {
              timerId = setTimeout(() => {
                resolve(TIMEOUT_SENTINEL);
              }, timeout);
            }),
          ]);

          if (result === TIMEOUT_SENTINEL) {
            // F-08: cancel the still-running handler cooperatively via ctx.signal.
            ctx.triggerTimeout();
            return new Response(JSON.stringify({ error: 'Gateway Timeout' }), {
              status: 504,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        } finally {
          // F-08: always clear the timer, on both handler-wins and timeout paths.
          if (timerId !== undefined) clearTimeout(timerId);
        }
      } else {
        await handler(ctx);
      }

      // F-02: finalize through the context so headers set via ctx.set() survive
      // an implicit/empty response. The 404 default body is written through the
      // same builder, preserving those headers too.
      if (!ctx.responded && ctx.status === 404) {
        ctx.json({ error: 'Not Found' });
      }
      return ctx.getResponse();
    } catch (error) {
      // Custom error handler
      if (options.onError) {
        return options.onError(error as Error, ctx);
      }

      // Default error handling
      app.logger.error('Request error:', error);

      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}

/**
 * Cloudflare Workers fetch handler type
 *
 * Cloudflare's module format passes `(request, env, ctx)` where:
 * - `env` contains bindings (KV, D1, R2, secrets, etc.)
 * - `ctx` provides `waitUntil()` and `passThroughOnException()`
 *
 * @typeParam Env - The shape of the Worker's bindings.
 */
export type CloudflareFetchHandler<Env = Record<string, unknown>> = (
  request: Request,
  env: Env,
  ctx: EdgeExecutionContext
) => Response | Promise<Response>;

/**
 * Create Cloudflare Workers module export
 *
 * @param app - NextRush Application instance
 * @param options - Handler options
 * @returns Cloudflare Workers module export object with correct `(request, env, ctx)` signature
 *
 * @remarks
 * The Cloudflare `env` argument (KV, D1, R2, Durable Objects, Queues, secrets)
 * is threaded onto the context as `ctx.env` (audit F-03). Pass a binding type
 * as the generic to make `ctx.env` fully typed inside handlers.
 *
 * @example
 * ```typescript
 * interface Env { MY_KV: KVNamespace }
 * export default createCloudflareHandler<Env>(app);
 * // inside a handler: ctx.env.MY_KV.get('key')
 * ```
 */
export function createCloudflareHandler<Env = Record<string, unknown>>(
  app: Application,
  options: FetchHandlerOptions = {}
): { fetch: CloudflareFetchHandler<Env> } {
  const run = createRequestRunner(app, options);

  return {
    fetch: (request: Request, env: Env, ctx: EdgeExecutionContext): Promise<Response> =>
      run(request, ctx, env),
  };
}

/**
 * Create Vercel Edge Function handler
 *
 * @param app - NextRush Application instance
 * @param options - Handler options
 * @returns Vercel Edge Function handler
 *
 * @example
 * ```typescript
 * // api/hello.ts
 * import { createApp } from '@nextrush/core';
 * import { createVercelHandler } from '@nextrush/adapter-edge';
 *
 * const app = createApp();
 *
 * app.use(async (ctx) => {
 *   ctx.json({
 *     message: 'Hello from Vercel Edge!',
 *     region: process.env.VERCEL_REGION
 *   });
 * });
 *
 * export const config = { runtime: 'edge' };
 * export default createVercelHandler(app);
 * ```
 */
export function createVercelHandler(
  app: Application,
  options: FetchHandlerOptions = {}
): FetchHandler {
  return createFetchHandler(app, options);
}

/**
 * Create Netlify Edge Function handler
 *
 * @param app - NextRush Application instance
 * @param options - Handler options
 * @returns Netlify Edge Function handler
 *
 * @example
 * ```typescript
 * // netlify/edge-functions/api.ts
 * import { createApp } from '@nextrush/core';
 * import { createNetlifyHandler } from '@nextrush/adapter-edge';
 *
 * const app = createApp();
 *
 * app.use(async (ctx) => {
 *   ctx.json({ message: 'Hello from Netlify Edge!' });
 * });
 *
 * export default createNetlifyHandler(app);
 * ```
 */
export function createNetlifyHandler(
  app: Application,
  options: FetchHandlerOptions = {}
): FetchHandler {
  return createFetchHandler(app, options);
}

// Alias for backwards compatibility and consistency
export const createHandler = createFetchHandler;

// F-01: compile-time conformance guard. If the exported fetch-adapter shape
// drifts from the shared `FetchAdapter` contract, this stops compiling.
const _edgeConformance: FetchAdapter<Application, EdgeExecutionContext> = { createFetchHandler };
void _edgeConformance;

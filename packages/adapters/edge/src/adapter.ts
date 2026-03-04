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
  const appHandler = app.callback();
  const { timeout } = options;
  const trustProxy = app.options.proxy ?? false;

  /** Sentinel value returned by the timeout racer */
  const TIMEOUT_SENTINEL = Symbol('timeout');

  return async (request: Request, executionContext?: EdgeExecutionContext): Promise<Response> => {
    const ctx = createEdgeContext(request, executionContext, trustProxy);

    try {
      if (timeout !== undefined && timeout > 0) {
        // Race the handler against a timeout
        let timerId: ReturnType<typeof setTimeout> | undefined;
        const result = await Promise.race([
          appHandler(ctx).then(() => {
            if (timerId !== undefined) clearTimeout(timerId);
            return undefined;
          }),
          new Promise<typeof TIMEOUT_SENTINEL>((resolve) => {
            timerId = setTimeout(() => {
              resolve(TIMEOUT_SENTINEL);
            }, timeout);
          }),
        ]);

        if (result === TIMEOUT_SENTINEL) {
          return new Response(JSON.stringify({ error: 'Gateway Timeout' }), {
            status: 504,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } else {
        await appHandler(ctx);
      }

      if (!ctx.responded) {
        if (ctx.status === 404) {
          return new Response(JSON.stringify({ error: 'Not Found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(null, { status: ctx.status });
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
 */
export type CloudflareFetchHandler = (
  request: Request,
  env: Record<string, unknown>,
  ctx: EdgeExecutionContext
) => Response | Promise<Response>;

/**
 * Create Cloudflare Workers module export
 *
 * @param app - NextRush Application instance
 * @param options - Handler options
 * @returns Cloudflare Workers module export object with correct `(request, env, ctx)` signature
 *
 * @example
 * ```typescript
 * // wrangler.toml format
 * import { createApp } from '@nextrush/core';
 * import { createCloudflareHandler } from '@nextrush/adapter-edge';
 *
 * const app = createApp();
 *
 * app.use(async (ctx) => {
 *   ctx.json({
 *     message: 'Hello from Cloudflare Workers!',
 *     colo: ctx.raw.req.cf?.colo
 *   });
 * });
 *
 * export default createCloudflareHandler(app);
 * ```
 */
export function createCloudflareHandler(
  app: Application,
  options: FetchHandlerOptions = {}
): { fetch: CloudflareFetchHandler } {
  const fetchHandler = createFetchHandler(app, options);

  return {
    fetch: (request: Request, _env: Record<string, unknown>, ctx: EdgeExecutionContext) =>
      fetchHandler(request, ctx),
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

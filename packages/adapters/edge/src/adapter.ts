/**
 * @nextrush/adapter-edge - Edge Runtime Adapter
 *
 * Connects NextRush Application to Edge runtimes via fetch handlers.
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

  return async (request: Request, executionContext?: EdgeExecutionContext): Promise<Response> => {
    const ctx = createEdgeContext(request, executionContext);

    try {
      await appHandler(ctx);

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
      console.error('Request error:', error);

      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}

/**
 * Create Cloudflare Workers module export
 *
 * @param app - NextRush Application instance
 * @param options - Handler options
 * @returns Cloudflare Workers module export object
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
): { fetch: FetchHandler } {
  return {
    fetch: createFetchHandler(app, options),
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

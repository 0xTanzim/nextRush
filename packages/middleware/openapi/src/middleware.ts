/**
 * @nextrush/openapi - Middleware
 *
 * `openapi({ router })` returns **middleware** that lazily generates the OpenAPI
 * document on the first request to the spec route (so route registration order
 * never matters), caches it in memory, and serves it plus a docs UI. The
 * generator is never invoked during normal request handling.
 *
 * @example
 * ```typescript
 * app.use(openapi({ router })); // serves /openapi.json and /docs
 * ```
 */

import type { Context, Middleware, Next } from '@nextrush/types';
import { swaggerUiHtml } from './docs-ui.js';
import { generateDocument } from './generate.js';
import type { OpenApiDocument, OpenApiOptions } from './types.js';

/**
 * Create the OpenAPI middleware.
 *
 * Mount it with `app.use()`. It responds to the spec path (`/openapi.json` by
 * default) and the docs path (`/docs`); all other requests fall through.
 */
export function openapi(options: OpenApiOptions): Middleware {
  const specPath = options.path ?? '/openapi.json';
  const docsPath = options.docs === false ? undefined : (options.docs ?? '/docs');
  const enabled = options.enabled ?? true;
  const title = options.info?.title ?? 'API';

  let cached: OpenApiDocument | null = null;

  return async (ctx: Context, next: Next): Promise<void> => {
    if (!enabled) {
      return next();
    }
    if (ctx.method === 'GET' && ctx.path === specPath) {
      cached ??= await generateDocument(options.router.getRoutes(), options);
      ctx.json(cached);
      return;
    }
    if (docsPath !== undefined && ctx.method === 'GET' && ctx.path === docsPath) {
      ctx.html(swaggerUiHtml(specPath, title));
      return;
    }
    await next();
  };
}

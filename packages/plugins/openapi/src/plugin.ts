/**
 * @nextrush/openapi - Plugin
 *
 * `openapi({ router })` returns a Plugin that lazily generates the OpenAPI
 * document on the first request to the spec route (so route/plugin registration
 * order never matters), caches it in memory, and serves it plus a docs UI.
 * The generator is never invoked during normal request handling.
 */

import type { ApplicationLike, Context, Next, Plugin } from '@nextrush/types';
import { swaggerUiHtml } from './docs-ui.js';
import { generateDocument } from './generate.js';
import type { OpenApiDocument, OpenApiOptions } from './types.js';

/**
 * Create the OpenAPI plugin.
 *
 * @example
 * ```typescript
 * app.plugin(openapi({ router })); // serves /openapi.json and /docs
 * ```
 */
export function openapi(options: OpenApiOptions): Plugin {
  const specPath = options.path ?? '/openapi.json';
  const docsPath = options.docs === false ? undefined : (options.docs ?? '/docs');
  const enabled = options.enabled ?? true;
  const title = options.info?.title ?? 'API';

  let cached: OpenApiDocument | null = null;

  return {
    name: 'openapi',
    version: '3.0.5',
    install(app: ApplicationLike): void {
      if (!enabled) return;

      app.use(async (ctx: Context, next: Next): Promise<void> => {
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
      });
    },
  };
}

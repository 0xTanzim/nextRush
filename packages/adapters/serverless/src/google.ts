/**
 * @nextrush/adapter-serverless - Google Cloud Functions (Tier 1 handler).
 *
 * ```typescript
 * import { createGoogleHandler } from '@nextrush/adapter-serverless';
 * const api = createGoogleHandler(app);
 * functions.http('api', (req, res) => api(adaptReq(req)).then(sendRes(res)));
 * ```
 *
 * Zero config. GCF hands you an Express-style `req`/`res`; adapt it to the
 * mapper's request shape at the boundary (a few lines), then this handler runs
 * the shared `Context` pipeline.
 *
 * @packageDocumentation
 */

import type { Application } from '@nextrush/core';
import { createServerlessAdapter } from './adapter';
import { gcf, type GcfEvent, type GcfResult } from './mappers/gcf';
import type { ServerlessHandler, ServerlessHandlerOptions } from './types';

/**
 * Create a Google Cloud Functions HTTP handler for a NextRush app.
 *
 * @param app - The NextRush application.
 * @param options - Optional Tier-2 tuning ({@link ServerlessHandlerOptions}).
 * @returns A handler `(event) => Promise<result>` over the GCF request essentials.
 */
export function createGoogleHandler(
  app: Application,
  options: ServerlessHandlerOptions = {}
): ServerlessHandler<GcfEvent, GcfResult> {
  return createServerlessAdapter<GcfEvent, GcfResult>({
    mappers: [gcf],
    provider: 'gcf',
    ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
  }).createHandler(app);
}

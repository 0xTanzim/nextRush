/**
 * @nextrush/adapter-serverless - Azure Functions (Tier 1 handler).
 *
 * ```typescript
 * import { createAzureHandler } from '@nextrush/adapter-serverless';
 * const api = createAzureHandler(app);
 * app.http('api', { handler: (req) => api(adaptReq(req)) });
 * ```
 *
 * Zero config. Azure's v4 model hands you an `HttpRequest`; adapt it to the
 * mapper's request shape at the boundary, then this handler runs the shared
 * `Context` pipeline and returns an `HttpResponseInit`-shaped result.
 *
 * @packageDocumentation
 */

import type { Application } from '@nextrush/core';
import { createServerlessAdapter } from './adapter';
import { azure, type AzureEvent, type AzureResult } from './mappers/azure';
import type { ServerlessHandler, ServerlessHandlerOptions } from './types';

/**
 * Create an Azure Functions (v4) HTTP handler for a NextRush app.
 *
 * @param app - The NextRush application.
 * @param options - Optional Tier-2 tuning ({@link ServerlessHandlerOptions}).
 * @returns A handler `(event) => Promise<result>` over the Azure v4 request essentials.
 */
export function createAzureHandler(
  app: Application,
  options: ServerlessHandlerOptions = {}
): ServerlessHandler<AzureEvent, AzureResult> {
  return createServerlessAdapter<AzureEvent, AzureResult>({
    mappers: [azure],
    provider: 'azure',
    ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
  }).createHandler(app);
}

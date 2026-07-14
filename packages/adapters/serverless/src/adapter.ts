/**
 * @nextrush/adapter-serverless - Adapter
 *
 * `createServerlessAdapter({ mappers, provider?, timeout? })` returns a handler
 * factory. The execution model (per-invocation, stateless, timeout→504, warm
 * `ready()` reuse) is delegated to the edge adapter's fetch engine; this module
 * owns only mapper resolution and the event↔Request/Response translation.
 *
 * @packageDocumentation
 */

import type { Application } from '@nextrush/core';
import { createFetchHandler as createEdgeFetchHandler } from '@nextrush/adapter-edge';
import type { EventMapper, ServerlessAdapterOptions, ServerlessHandler } from './types';

/**
 * Resolve the mapper for an invocation.
 *
 * @remarks
 * Explicit-first: a configured `provider` wins and is resolved once. Otherwise
 * `detect(event)` runs per invocation and the first match is used. Throws a
 * clear configuration error when neither yields a mapper.
 */
function resolveMapper<Event, Result, Ctx>(
  mappers: readonly EventMapper<Event, Result, Ctx>[],
  provider: string | undefined,
  event: Event
): EventMapper<Event, Result, Ctx> {
  if (provider !== undefined) {
    const explicit = mappers.find((m) => m.name === provider);
    if (explicit === undefined) {
      throw new Error(
        `[nextrush/serverless] No EventMapper named "${provider}" in the adapter's mappers. Registered: ${mappers.map((m) => m.name).join(', ') || '(none)'}.`
      );
    }
    return explicit;
  }
  const detected = mappers.find((m) => m.detect?.(event) === true);
  if (detected === undefined) {
    throw new Error(
      `[nextrush/serverless] No EventMapper matched the event via detect(). Set an explicit "provider" or add a mapper with a detect() that recognizes it. Registered: ${mappers.map((m) => m.name).join(', ') || '(none)'}.`
    );
  }
  return detected;
}

/**
 * Create a serverless adapter over an immutable, adapter-scoped mapper registry.
 *
 * @param options - The mappers, optional explicit provider, and per-invocation timeout.
 * @returns A `{ createHandler(app) }` factory producing an event→result handler.
 *
 * @example
 * ```typescript
 * import { createServerlessAdapter, lambdaFunctionUrl } from '@nextrush/adapter-serverless';
 *
 * const adapter = createServerlessAdapter({ mappers: [lambdaFunctionUrl] });
 * const handler = adapter.createHandler(app);
 * export const fetch = handler; // Lambda Function URL entry
 * ```
 */
export function createServerlessAdapter<Event, Result, Ctx = unknown>(
  options: ServerlessAdapterOptions<Event, Result, Ctx>
): { createHandler(app: Application): ServerlessHandler<Event, Result, Ctx> } {
  const { mappers, provider, timeout } = options;
  return {
    createHandler(app: Application): ServerlessHandler<Event, Result, Ctx> {
      // Reuse the edge fetch engine: boots ready() once (warm reuse), races the
      // per-invocation timeout to a 504, and runs the shared Context pipeline.
      const engine = createEdgeFetchHandler(app, timeout !== undefined ? { timeout } : {});
      return async (event: Event, platformCtx?: Ctx): Promise<Result> => {
        const mapper = resolveMapper(mappers, provider, event);
        const request = mapper.toRequest(event, platformCtx);
        const response = await engine(request);
        return mapper.fromResponse(response, event);
      };
    },
  };
}

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
import { createWebRunner } from '@nextrush/runtime';
import type { AdapterContextFactory, FetchAdapter, PlatformId, ProxyTrust } from '@nextrush/types';
import { createEdgeContext, EdgeContext, type EdgeExecutionContext } from './context';

/**
 * Default request timeout applied when the caller specifies none (F-07,
 * ADR-0010), converging Edge's default contract with Node/Bun/Deno (which all
 * default to a bounded timeout rather than none).
 *
 * @remarks
 * 24 000 ms — strictly below the tightest common edge-platform wall limit
 * (Vercel Edge Functions: 25 s exactly), comfortably above typical handler
 * durations, so the framework's clean `504` reliably fires before the
 * platform terminates the isolate. A prior value of 25 000 ms sat exactly
 * *at* that limit rather than below it, racing the platform's own kill with
 * no margin — this constant is deliberately 1 000 ms under the tightest
 * limit rather than per-platform-branched, since one shared constant is
 * simpler to reason about than a platform switch inside a package whose
 * whole point is one runner for every edge platform.
 * Pass `timeout: 0` to disable the framework timeout entirely (platform limit
 * alone applies) or a positive value to override the default.
 */
export const DEFAULT_EDGE_TIMEOUT_MS = 24_000;

/**
 * Options for the fetch handler
 */
export interface FetchHandlerOptions {
  /**
   * Custom error handler
   */
  onError?: (error: Error, ctx: EdgeContext) => Response | Promise<Response>;

  /**
   * Request timeout in milliseconds. The handler races the application logic
   * against a timer and returns a 504 Gateway Timeout if the timer fires
   * first, cancelling the still-running handler via `ctx.signal`.
   *
   * @remarks
   * Defaults to {@link DEFAULT_EDGE_TIMEOUT_MS} (24 000 ms) when omitted
   * (F-07/ADR-0010) — strictly below the tightest common edge-platform wall
   * limit (Vercel Edge: 25 s), so the framework's clean `504` fires before
   * the platform terminates the isolate. Pass `0` to disable the framework
   * timeout entirely (the platform's own limit still applies).
   *
   * Per-platform CPU/wall limits for context when overriding:
   * - Cloudflare Workers: 30 000 (30 s CPU limit)
   * - Vercel Edge:        25 000 (25 s wall limit)
   *
   * @default DEFAULT_EDGE_TIMEOUT_MS (24000)
   */
  timeout?: number;

  /**
   * Explicit named platform, overriding detection (RFC-026).
   *
   * @remarks
   * Internal — set by `@nextrush/adapter-serverless`'s Tier-1 handlers
   * (`createLambdaHandler`, `createGoogleHandler`, `createAzureHandler`),
   * which already know their own platform identity unambiguously and pass it
   * through rather than relying on detection. Application code calling
   * `createFetchHandler`/`createCloudflareHandler`/etc. directly should not
   * normally need to set this — the three named edge platforms
   * (Cloudflare Workers, Vercel Edge, Netlify Edge) are still auto-detected
   * when omitted.
   */
  platform?: PlatformId;
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
  const run = createEdgeRunner(app, options);
  return (request: Request, executionContext?: EdgeExecutionContext): Response | Promise<Response> =>
    run(request, { executionContext });
}

/** Per-request platform extras the edge context needs. */
interface EdgeExtras {
  executionContext?: EdgeExecutionContext;
  env?: unknown;
}

/**
 * Wire the shared Web runner for every edge entry point.
 *
 * @remarks
 * Booting, dispatch, the timeout race with cooperative cancellation, the
 * header-preserving finalize path, and error handling all live in
 * `createWebRunner` — so Cloudflare/Vercel/Netlify handlers cannot drift. This
 * function supplies only what is edge-specific: the context (threading
 * Cloudflare `env` — F-03), the named timeout in the 504 warning, and the
 * caller's error handler.
 */
function createEdgeRunner(
  app: Application,
  options: FetchHandlerOptions
): (request: Request, extras: EdgeExtras) => Response | Promise<Response> {
  const proxy = app.options.proxy ?? false;
  // F-07/ADR-0010: default to DEFAULT_EDGE_TIMEOUT_MS when the caller specifies
  // none (`undefined`); `0` remains an explicit opt-out (no framework timeout).
  const timeout = options.timeout ?? DEFAULT_EDGE_TIMEOUT_MS;
  const timeoutSource = options.timeout === undefined ? 'default' : 'explicit options.timeout';

  return createWebRunner(app, {
    label: 'edge',
    timeout,
    timeoutWarningSource: timeoutSource,
    // Edge has no serve()/start() phase, so the shared boot barrier runs on the
    // first request. `markRunning` keeps `app.isRunning` consistent with the
    // server adapters even though there is no server lifetime (F-14).
    markRunning: true,
    makeContext: (request, extras) =>
      createEdgeContext(
        request,
        extras.executionContext,
        proxy,
        extras.env,
        app.isProduction,
        options.platform
      ),
    onError: options.onError,
  });
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
  const run = createEdgeRunner(app, options);

  return {
    fetch: (request: Request, env: Env, ctx: EdgeExecutionContext): Response | Promise<Response> =>
      run(request, { executionContext: ctx, env }),
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

/**
 * Alias of {@link createFetchHandler}.
 *
 * @deprecated Use {@link createFetchHandler} directly (P3-1) — two exported
 * names for one function means autocomplete shows both with neither
 * obviously canonical, on a package whose docs stress bundle discipline.
 * `createFetchHandler` is the canonical name; this alias is kept for
 * backwards compatibility and will be removed in a future major.
 */
export const createHandler = createFetchHandler;

// F-01: compile-time conformance guard. If the exported fetch-adapter shape
// drifts from the shared `FetchAdapter` contract, this stops compiling.
const _edgeConformance: FetchAdapter<Application, EdgeExecutionContext> = { createFetchHandler };
void _edgeConformance;

// RFC-NEXTRUSH-ADAPTER-CONTRACT: prove the context factory produces an
// AdapterContext over the shared Context contract. A drift in createEdgeContext's
// return type stops compiling here.
const _edgeContextFactory: AdapterContextFactory<
  [Request, EdgeExecutionContext?, ProxyTrust?, unknown?, boolean?, PlatformId?],
  EdgeContext
> = createEdgeContext;
void _edgeContextFactory;

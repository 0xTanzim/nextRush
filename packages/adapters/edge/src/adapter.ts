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
import { jsonErrorResponse } from '@nextrush/runtime';
import type { AdapterContextFactory, FetchAdapter, PlatformId } from '@nextrush/types';
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
 * Module-level tracking for the boot-reuse warning (P1-3a).
 *
 * @remarks
 * `bootedApps` records every distinct `Application` that has completed at
 * least one request through this module instance; `warnedBootReuse` ensures
 * the warning fires at most once per module instance, not once per extra app.
 * Module-level (not per-closure) is deliberate: the mistake this catches
 * (calling `createApp()`/`createFetchHandler()` inside the exported handler)
 * produces a NEW `createRequestRunner` closure on every invocation, so
 * per-closure state could never observe a second app.
 */
const bootedApps = new WeakSet<Application>();
let hasBootedAnyApp = false;
let warnedBootReuse = false;

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
  // F-07/ADR-0010: default to DEFAULT_EDGE_TIMEOUT_MS when the caller specifies
  // none (`undefined`); `0` remains an explicit opt-out (no framework timeout).
  const timeout = options.timeout ?? DEFAULT_EDGE_TIMEOUT_MS;
  const timeoutSource = options.timeout === undefined ? 'default' : 'explicit options.timeout';
  const trustProxy = app.options.proxy ?? false;

  /** Sentinel value returned by the timeout racer */
  const TIMEOUT_SENTINEL = Symbol('timeout');

  // Edge has no serve()/start() phase, so the deferred boot barrier runs lazily
  // on the first request (idempotent). The boot promise caches the snapshotted
  // request handler, so every request awaits and reuses the same one.
  let bootPromise: Promise<ReturnType<Application['callback']>> | null = null;
  const ensureBooted = (): Promise<ReturnType<Application['callback']>> => {
    bootPromise ??= app.ready().then(() => {
      // P1-3a: outside production, warn once per module instance if a
      // DIFFERENT Application already booted here — the mechanical signature
      // of building the app inside the exported handler instead of at module
      // scope (rebuilding the app on every invocation defeats warm reuse).
      if (!app.isProduction && !warnedBootReuse && hasBootedAnyApp && !bootedApps.has(app)) {
        warnedBootReuse = true;
        console.warn(
          '[nextrush/edge] A different Application booted in this process/isolate than the one ' +
            'that booted first. This usually means createApp() (or createFetchHandler/createCloudflareHandler/' +
            'createVercelHandler/createNetlifyHandler) is being called inside the exported handler ' +
            'instead of at module scope — rebuilding the app on every invocation defeats warm-instance ' +
            'reuse and increases cold-start-like latency on every request. Build the app once, at module ' +
            'scope, above the export. (This message appears in development only.)'
        );
      }
      bootedApps.add(app);
      hasBootedAnyApp = true;

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
    const ctx = createEdgeContext(request, executionContext, trustProxy, env, app.isProduction, options.platform);

    try {
      if (timeout > 0) {
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
            // P1-3b: name the effective timeout and its source so a 504 is
            // attributable without reading this adapter's source.
            app.logger.warn(
              `[nextrush/edge] Request timed out after ${String(timeout)}ms (${timeoutSource}) — returning 504. ` +
                `${ctx.method} ${ctx.path}`
            );
            return jsonErrorResponse(504, 'Gateway Timeout');
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

      return jsonErrorResponse(500, 'Internal Server Error');
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
  [Request, EdgeExecutionContext?, boolean?, unknown?, boolean?, PlatformId?],
  EdgeContext
> = createEdgeContext;
void _edgeContextFactory;

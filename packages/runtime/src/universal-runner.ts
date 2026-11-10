/**
 * @nextrush/runtime - Universal Fetch Runner (RFC-052)
 *
 * Request dispatch engine powering instance-bound `app.fetch` across Web Platform runtimes
 * (Cloudflare Workers, Vercel Edge, Bun, Deno, and standard 1-arg fetch).
 *
 * @remarks
 * Architectural guarantees:
 * 1. Zero per-request wrapper allocations: consumes 3 explicit arguments directly.
 * 2. Deferred boot barrier: invokes `app.ready()` on first call, steady-state calls read `handler` synchronously.
 * 3. Synchronous bypass: returns bare `Response` synchronously when `syncDispatchSafe === true`
 *    and `[DISPATCH_SETTLED_SYNC] === true`.
 * 4. Microtask settle turns: bodyless requests settle within 4 microtasks without arming any timer.
 * 5. Robust error boundary: returns RFC 7807/JSON 500 on uncaught exceptions, 504 on uncommitted timeouts,
 *    and preserves committed responses.
 *
 * @packageDocumentation
 */

import {
  DISPATCH_SETTLED_SYNC,
  type DispatchMarkerCarrier,
  type PlatformId,
  type ProxyTrust,
  type UniversalFetchHandler,
} from '@nextrush/types';
import { createBootGate } from './boot-gate';
import { DeadlineScheduler } from './deadline-scheduler';
import { jsonErrorResponse } from './response-builder';
import { UniversalWebContext } from './universal-context';
import { settleTurnsFor, type WebRunnerApp } from './web-runner';
import type { WebStreamRunners } from './web-context-base';

/**
 * Default timeout for standalone universal fetch dispatches (24 seconds).
 *
 * @remarks
 * Chosen to safely intercept in-flight timeouts and return an RFC-compliant 504
 * Gateway Timeout response before host serverless isolates (Cloudflare Workers,
 * Vercel Edge, AWS Lambda) reach their hard execution limits (typically 25s–30s).
 */
export const DEFAULT_UNIVERSAL_TIMEOUT_MS = 24_000;

/**
 * Options for {@link createUniversalFetchHandler}.
 */
export interface UniversalFetchOptions {
  /**
   * Handler timeout in milliseconds.
   *
   * @defaultValue 24_000 (24 seconds)
   *
   * Set to `0` or a negative value to disable the timeout barrier completely.
   */
  timeout?: number;

  /**
   * Custom unhandled error handler. Receives the error and the universal context,
   * returning a custom Web `Response` or `Promise<Response>`.
   */
  onError?: (error: Error, ctx: UniversalWebContext) => Response | Promise<Response>;

  /**
   * Target deployment platform override (e.g. `'cloudflare-workers'`, `'vercel-edge'`).
   * When omitted, the platform is inferred from the runtime environment.
   */
  platform?: PlatformId;

  /**
   * Proxy trust configuration for client IP resolution.
   * When omitted, defaults to the application's configured proxy trust or `false`.
   */
  proxy?: ProxyTrust;

  /**
   * Whether the application runs in production mode.
   * When omitted, defaults to the application's `isProduction` flag.
   */
  isProduction?: boolean;

  /**
   * Optional custom stream runners.
   */
  streamRunners?: WebStreamRunners;
}

/**
 * Await a dispatch, arming a deadline only if it is still pending after the settle window.
 */
async function dispatchWithTimeout(
  dispatch: Promise<void>,
  timeoutMs: number,
  onTimeout: () => void,
  deadlines: DeadlineScheduler,
  settleTurns: number
): Promise<boolean> {
  const outcome: { done: boolean; failed: boolean; error?: unknown } = {
    done: false,
    failed: false,
  };

  const race: { settle?: (timedOut: boolean) => void } = {};
  const raced = new Promise<boolean>((resolve) => {
    race.settle = resolve;
  });

  dispatch.then(
    () => {
      outcome.done = true;
      race.settle?.(false);
    },
    (error: unknown) => {
      outcome.done = true;
      outcome.failed = true;
      outcome.error = error;
      race.settle?.(false);
    }
  );

  for (let turn = 0; turn < settleTurns && !outcome.done; turn += 1) {
    await Promise.resolve();
  }

  if (outcome.done) {
    if (outcome.failed) throw outcome.error;
    return false;
  }

  const state: { timedOut: boolean; timeoutError?: Error } = { timedOut: false };
  const registration = deadlines.register(timeoutMs, () => {
    state.timedOut = true;
    race.settle?.(true);
    try {
      onTimeout();
    } catch (error: unknown) {
      state.timeoutError =
        error instanceof Error ? error : new Error(String(error), { cause: error });
    }
  });

  try {
    await raced;
  } finally {
    registration.cancel();
  }

  if (state.timeoutError !== undefined) throw state.timeoutError;
  if (state.timedOut) return true;
  if (outcome.failed) throw outcome.error;
  return false;
}

/**
 * Create a universal fetch handler backing `app.fetch` across all Web Platform runtimes.
 *
 * @param app - The structural Web application instance.
 * @param options - Configuration for timeout, custom error handler, and platform.
 * @returns A universal 3-signature fetch handler returning `Response | Promise<Response>`.
 */
export function createUniversalFetchHandler(
  app: WebRunnerApp<(ctx: UniversalWebContext) => Promise<void>>,
  options: UniversalFetchOptions = {}
): UniversalFetchHandler {
  const boot = createBootGate(app, { label: 'universal', markRunning: true });
  const logger = app.logger;
  const timeout = options.timeout ?? DEFAULT_UNIVERSAL_TIMEOUT_MS;
  const platform = options.platform;
  const proxy =
    options.proxy ??
    (app as { options?: { proxy?: ProxyTrust } }).options?.proxy ??
    false;
  const isProduction = options.isProduction ?? app.isProduction;
  const streamRunners = options.streamRunners;

  // Steady-state handler cache (resolved synchronously after boot barrier clears)
  let handler = boot.handler;

  // Synchronous dispatch safety flag (refreshed after boot completes)
  let syncDispatchSafe = app.syncDispatchSafe === true;

  // Single shared deadline scheduler for in-flight requests
  const deadlines = new DeadlineScheduler();

  /**
   * Handle unhandled dispatch errors, isolating errors thrown by custom onError hooks.
   */
  function handleError(
    error: unknown,
    ctx: UniversalWebContext | undefined
  ): Response | Promise<Response> {
    const err = error instanceof Error ? error : new Error(String(error), { cause: error });

    if (options.onError !== undefined && ctx !== undefined) {
      try {
        const result = options.onError(err, ctx);
        if (result instanceof Promise || typeof (result as { then?: unknown }).then === 'function') {
          return (result as Promise<Response>).catch((hookErr: unknown) => {
            logger.error('[nextrush/universal] Custom onError hook rejected:', hookErr);
            return jsonErrorResponse(500, 'Internal Server Error');
          });
        }
        return result;
      } catch (hookErr: unknown) {
        logger.error('[nextrush/universal] Custom onError hook threw synchronously:', hookErr);
        return jsonErrorResponse(500, 'Internal Server Error');
      }
    }

    logger.error('[nextrush/universal] Unhandled request error:', err);
    return jsonErrorResponse(500, 'Internal Server Error');
  }

  /**
   * Finalize the context, applying 404 envelope if unhandled, and extracting Web Response.
   */
  function finalize(ctx: UniversalWebContext): Response {
    if (!ctx.responded && ctx.status === 404) {
      ctx.json({ error: 'Not Found' });
    }
    return ctx.getResponse();
  }

  /**
   * Await an in-flight dispatch against the deadline race, handling timeouts and finalization.
   */
  async function answer(ctx: UniversalWebContext, dispatch: Promise<void>): Promise<Response> {
    try {
      if (timeout > 0) {
        const timedOut = await dispatchWithTimeout(
          dispatch,
          timeout,
          () => {
            ctx.triggerTimeout();
          },
          deadlines,
          settleTurnsFor((ctx.bodyLength ?? 0) > 0)
        );

        if (timedOut) {
          // If the handler already committed a response before deadline expired,
          // deliver the committed response rather than replacing it with a 504.
          if (ctx.responded) {
            return ctx.getResponse();
          }

          logger.warn(
            `[nextrush/universal] Request timed out after ${String(timeout)}ms — returning 504. ${ctx.method} ${ctx.path}`
          );
          return jsonErrorResponse(504, 'Gateway Timeout');
        }
      } else {
        await dispatch;
      }

      return finalize(ctx);
    } catch (error: unknown) {
      return handleError(error, ctx);
    }
  }

  /**
   * Cold-start boot barrier: executes on first request, resolves handler, then dispatches.
   */
  async function bootAndAnswer(ctx: UniversalWebContext): Promise<Response> {
    try {
      handler ??= await boot.ensure();
      syncDispatchSafe = app.syncDispatchSafe === true;
      return await answer(ctx, handler(ctx));
    } catch (error: unknown) {
      return handleError(error, ctx);
    }
  }

  /**
   * Steady-state universal fetch function.
   * Explicit 3-argument signature eliminates rest parameter array allocation on the hot path.
   */
  return function universalFetch(
    request: Request,
    envOrServerOrInfoOrCtx?: unknown,
    executionCtx?: unknown
  ): Response | Promise<Response> {
    let ctx: UniversalWebContext;
    try {
      ctx = new UniversalWebContext(request, envOrServerOrInfoOrCtx, executionCtx, {
        proxy,
        isProduction,
        platform,
        streamRunners,
      });
    } catch (error: unknown) {
      return handleError(error, undefined);
    }

    const ready = handler;
    if (ready === undefined) {
      return bootAndAnswer(ctx);
    }

    try {
      const dispatch = ready(ctx);

      // Fast synchronous bypass: bare Response returned synchronously with 0 microtask hops
      if (
        syncDispatchSafe &&
        (ctx as unknown as DispatchMarkerCarrier)[DISPATCH_SETTLED_SYNC] === true
      ) {
        return finalize(ctx);
      }

      return answer(ctx, dispatch);
    } catch (error: unknown) {
      return handleError(error, ctx);
    }
  };
}

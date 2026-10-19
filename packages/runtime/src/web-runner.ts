/**
 * @nextrush/runtime — the shared per-request runner for Web adapters.
 *
 * @remarks
 * Bun, Deno, and Edge each used to own a copy of the same request flow: read the
 * booted handler behind the boot gate, dispatch through the context, race the
 * dispatch against a timeout, write the not-found body when nothing responded,
 * and answer a thrown error. Three copies of that flow is three places for the
 * next fix to miss — the timeout fix had to be made three times, and the
 * header-preserving finalize twice.
 *
 * The runner takes the only genuinely adapter-specific pieces as parameters:
 * how to build the context (which decides how the client address is resolved)
 * and which platform extras that context needs. Everything else lives here once.
 *
 * @packageDocumentation
 */

import type { FetchContext } from '@nextrush/types';
import type { Logger } from '@nextrush/types';
import { createBootGate, type BootableApp } from './boot-gate';
import { jsonErrorResponse } from './response-builder';

/**
 * A Web context the runner can drive.
 *
 * @remarks
 * {@link FetchContext} plus cooperative cancellation — the one adapter-context
 * primitive that is not part of the shared contract yet.
 */
export interface WebRunnerContext extends FetchContext {
  /** Cancel the in-flight request cooperatively (called when the race times out). */
  triggerTimeout(reason?: unknown): void;
}

/**
 * The structural slice of `Application` the runner needs.
 *
 * @remarks
 * Structural, not `import type { Application }`: `@nextrush/runtime` does not
 * depend on `@nextrush/core`, and inverting that edge would create a cycle.
 */
export interface WebRunnerApp<THandler> extends BootableApp<THandler> {
  readonly logger: Logger;
}

/** What the runner needs to know about one adapter's entry point. */
export interface WebRunnerOptions<TCtx extends WebRunnerContext, TExtra> {
  /** Adapter label for log lines, e.g. `'bun'` renders as `[nextrush/bun]`. */
  label: string;

  /** Handler timeout in milliseconds. `0` disables the race entirely. */
  timeout: number;

  /**
   * Mark the application running once boot completes.
   *
   * @remarks
   * Set by runtimes with no server lifetime (Edge). Server adapters call
   * `start()` themselves in their `serve()` phase.
   */
  markRunning?: boolean;

  /**
   * Arms a warning on timeout, naming the effective timeout and its source.
   *
   * @remarks
   * Only the Edge adapter has this today. Kept as data rather than a callback so
   * the runner owns the one place a timeout is reported.
   */
  timeoutWarningSource?: string;

  /** Build the adapter's context for one request. */
  makeContext: (request: Request, extra: TExtra) => TCtx;

  /** Adapter-specific error response; the default logs and answers 500. */
  onError?: (error: Error, ctx: TCtx) => Response | Promise<Response>;

  /** Logger override; defaults to the application's logger. */
  logger?: Logger;
}

/** One request's dispatch, as the timeout race sees it. */
type Dispatch = Promise<void>;

/**
 * Microtask turns an already-resolving chain needs before it counts as unsettled.
 *
 * @remarks
 * Arming a timer is not free, and most handlers settle within a handful of
 * microtasks, so the race gives the dispatch a bounded number of turns first.
 * The bound is a trade: too low and a fast handler still pays for a timer, too
 * high and a genuinely stuck handler waits that many microtasks (nanoseconds)
 * before its timeout starts counting.
 */
const SETTLE_TURNS = 4;

/**
 * Await a dispatch, arming a timeout timer only if it is still pending.
 *
 * @returns `true` when the timeout won the race (the caller answers 504)
 */
async function dispatchWithTimeout(
  dispatch: Dispatch,
  timeoutMs: number,
  onTimeout: () => void
): Promise<boolean> {
  // A holder, not a bare `let`: the settlement is observed from a callback, and a
  // flat variable would be narrowed to its initial value by control-flow analysis
  // (and by the lint rule that reads the same narrowing).
  const outcome: { done: boolean; failed: boolean; error?: unknown } = {
    done: false,
    failed: false,
  };

  // Both outcomes are handled here, so this promise never rejects unobserved
  // while the microtask window is still open.
  const settlement = dispatch.then(
    () => {
      outcome.done = true;
    },
    (error: unknown) => {
      outcome.done = true;
      outcome.failed = true;
      outcome.error = error;
    }
  );

  for (let turn = 0; turn < SETTLE_TURNS && !outcome.done; turn += 1) {
    await Promise.resolve();
  }

  if (outcome.done) {
    await settlement;
    if (outcome.failed) throw outcome.error;
    return false;
  }

  const TIMEOUT = Symbol('timeout');
  let timerId: ReturnType<typeof setTimeout> | undefined;
  try {
    const winner = await Promise.race([
      settlement,
      new Promise<typeof TIMEOUT>((resolve) => {
        timerId = setTimeout(() => {
          resolve(TIMEOUT);
        }, timeoutMs);
      }),
    ]);

    if (winner === TIMEOUT) {
      onTimeout();
      return true;
    }
    if (outcome.failed) throw outcome.error;
    return false;
  } finally {
    if (timerId !== undefined) clearTimeout(timerId);
  }
}

/**
 * Build the per-request runner for one Web adapter entry point.
 *
 * @param app - The application to boot behind the first request
 * @param options - Adapter label, timeout, context factory, error policy
 * @returns A `(request, extra) => Response` function
 *
 * @example
 * ```typescript
 * const run = createWebRunner(app, {
 *   label: 'bun',
 *   timeout: 30_000,
 *   makeContext: (request, server) => new BunContext(request, () => server.requestIP(request)?.address ?? ''),
 * });
 *
 * export const handler = (request, server) => run(request, server);
 * ```
 */
export function createWebRunner<TCtx extends WebRunnerContext, TExtra = undefined>(
  app: WebRunnerApp<(ctx: TCtx) => Promise<void>>,
  options: WebRunnerOptions<TCtx, TExtra>
): (request: Request, extra: TExtra) => Promise<Response> {
  const boot = createBootGate(app, { label: options.label, markRunning: options.markRunning });
  const logger = options.logger ?? app.logger;

  // Booted handler, read synchronously once boot has completed. Only the first
  // request awaits the barrier, so a steady-state request adds no promise hop.
  let handler = boot.handler;

  return async (request: Request, extra: TExtra): Promise<Response> => {
    const ctx = options.makeContext(request, extra);

    try {
      handler ??= await boot.ensure();

      if (options.timeout > 0) {
        const timedOut = await dispatchWithTimeout(handler(ctx), options.timeout, () => {
          ctx.triggerTimeout();
        });

        if (timedOut) {
          // The handler committed a response before it ran past the timeout.
          // Answering 504 here would discard a response the client is owed, and
          // the Node adapter keeps the committed response in the same situation
          // (its 504 write is guarded the same way). The timeout is still
          // reported to the context — `triggerTimeout` already aborted
          // `ctx.signal` above — and the 504 is reserved for a request that
          // produced nothing. No warning is emitted, because the warning states
          // that a 504 was returned.
          if (ctx.responded) {
            return ctx.getResponse();
          }

          if (options.timeoutWarningSource !== undefined) {
            logger.warn(
              `[nextrush/${options.label}] Request timed out after ${String(options.timeout)}ms ` +
                `(${options.timeoutWarningSource}) — returning 504. ${ctx.method} ${ctx.path}`
            );
          }
          return jsonErrorResponse(504, 'Gateway Timeout');
        }
      } else {
        await handler(ctx);
      }

      // Finalize through the context so headers set via ctx.set() survive an
      // implicit/empty response; the 404 body is written through the same builder.
      if (!ctx.responded && ctx.status === 404) {
        ctx.json({ error: 'Not Found' });
      }
      return ctx.getResponse();
    } catch (error) {
      if (options.onError) {
        return options.onError(error as Error, ctx);
      }

      logger.error('Request error:', error);
      return jsonErrorResponse(500, 'Internal Server Error');
    }
  };
}

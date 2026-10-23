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
import { DISPATCH_SETTLED_SYNC, type DispatchMarkerCarrier } from '@nextrush/types';
import { createBootGate, type BootableApp } from './boot-gate';
import { DeadlineScheduler } from './deadline-scheduler';
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

  /**
   * The request's declared body length in bytes, when the adapter knows it.
   *
   * @remarks
   * Read from the `content-length` the body source already parsed; absent when
   * the length is unknown (a chunked body) or the adapter does not report it.
   * The runner uses it only to choose the settle window: a request with a
   * declared, non-empty body arms its deadline immediately, because the body
   * read is a macrotask and no microtask window can avoid the deadline.
   */
  readonly bodyLength?: number;
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

  /**
   * Whether a synchronous dispatch of a fully settled route completes the
   * request (see `Application.syncDispatchSafe`).
   *
   * @remarks
   * Optional so a structural test double stays valid; absent means `false`, the
   * conservative answer. When true, a dispatch that reports
   * {@link DISPATCH_SETTLED_SYNC} lets the runner return the built `Response`
   * without a promise hop — the difference between a synchronous and an async
   * handler at the runtime boundary.
   */
  readonly syncDispatchSafe?: boolean;
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
 * Arming a timer is not free, and a bodyless handler can settle within a handful
 * of microtasks, so the race gives such a dispatch a bounded number of turns
 * before registering a deadline. The bound is a trade: too low and a fast
 * handler still pays for a registration, too high and a genuinely stuck handler
 * waits that many microtasks (nanoseconds) before its timeout starts counting.
 *
 * @internal Shared with the Node adapter so both timeout races use one bound.
 */
export const SETTLE_TURNS = 4;

/**
 * Microtask turns a dispatch gets before its deadline is armed.
 *
 * @remarks
 * A dispatch whose request carries a body cannot settle inside a microtask
 * window: the body read waits on I/O, which is a macrotask on every supported
 * runtime. The window only adds turns to such a request (measured on Bun: four
 * turns cost ~1.5 µs of server CPU per POST on the wire), so the deadline is
 * registered immediately (measured: ~0.26 µs for register + cancel).
 *
 * A request with no known body can settle inside the window, and there the
 * window still saves it a registration (the "quick dispatch arms no timer"
 * contract). So the window is applied per shape, not removed. The signal is the
 * `content-length` the context's body source has already parsed: asking
 * `request.body` here would initialise the stream and cost ~0.8 µs on Bun
 * before the body is read, more than the window saves. A body with no declared
 * length (chunked) keeps the window, the conservative choice.
 *
 * The Node adapter keeps the window for every request: its deadlines are
 * per-request timers, so arming is the expensive outcome it must avoid.
 */
export function settleTurnsFor(hasBody: boolean): number {
  return hasBody ? 0 : SETTLE_TURNS;
}

/**
 * Whether a context has already committed its response.
 *
 * @remarks
 * Read through a call so the value is the one at the deadline, not a narrowing
 * established earlier in the request function. The check decides between the
 * committed response and a 504, so it must observe the flag after the race.
 */
function hasCommittedResponse(ctx: WebRunnerContext): boolean {
  return ctx.responded;
}

/**
 * Await a dispatch, arming a deadline only if it is still pending.
 *
 * @returns `true` when the deadline won the race (the caller answers 504)
 *
 * @remarks
 * The deadline is served by the runner's shared {@link DeadlineScheduler}, so a
 * request that outlives the settle window does not pay for its own timer. The
 * race itself is one deferred promise rather than a `Promise.race` over two
 * promises: whichever of the dispatch and the deadline settles first resolves
 * it, and the dispatch's rejection is observed here so a rejection that
 * arrives after the deadline is not left unhandled.
 */
async function dispatchWithTimeout(
  dispatch: Dispatch,
  timeoutMs: number,
  onTimeout: () => void,
  deadlines: DeadlineScheduler,
  settleTurns: number
): Promise<boolean> {
  // A holder, not a bare `let`: the settlement is observed from a callback, and a
  // flat variable would be narrowed to its initial value by control-flow analysis
  // (and by the lint rule that reads the same narrowing).
  const outcome: { done: boolean; failed: boolean; error?: unknown } = {
    done: false,
    failed: false,
  };

  const race: { settle?: (timedOut: boolean) => void } = {};
  const raced = new Promise<boolean>((resolve) => {
    race.settle = resolve;
  });

  // Both outcomes are handled here, so this promise never rejects unobserved
  // while the microtask window is still open.
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
    // The dispatch has already settled, so there is nothing to race and no
    // deadline to register.
    if (outcome.failed) throw outcome.error;
    return false;
  }

  // A holder, for the same reason `outcome` is one: the deadline callback runs
  // outside this flow, so a flat variable would be narrowed to its initial
  // value by control-flow analysis.
  const state: { timedOut: boolean; timeoutError?: Error } = { timedOut: false };
  const registration = deadlines.register(timeoutMs, () => {
    state.timedOut = true;
    race.settle?.(true);
    try {
      onTimeout();
    } catch (error: unknown) {
      state.timeoutError = error instanceof Error ? error : new Error(String(error), { cause: error });
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
 * Build the per-request runner for one Web adapter entry point.
 *
 * @param app - The application to boot behind the first request
 * @param options - Adapter label, timeout, context factory, error policy
 * @returns A `(request, extra) => Response | Promise<Response>` function
 *
 * @remarks
 * The returned function answers with a bare `Response` when the dispatch proved
 * it had already finished (see {@link DISPATCH_SETTLED_SYNC}). Bun, Deno and edge
 * runtimes all accept either shape, so a synchronous route avoids the promise hop
 * at the runtime boundary — the same fast path Hono's `app.fetch` takes.
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
): (request: Request, extra: TExtra) => Response | Promise<Response> {
  const boot = createBootGate(app, { label: options.label, markRunning: options.markRunning });
  const logger = options.logger ?? app.logger;

  // Booted handler, read synchronously once boot has completed. Only the first
  // request awaits the barrier, so a steady-state request adds no promise hop.
  let handler = boot.handler;

  // Whether a synchronous dispatch really completes the request. The middleware
  // stack is only final after boot, so this is re-read once the barrier clears.
  let syncDispatchSafe = app.syncDispatchSafe === true;

  // One scheduler per runner: the pending deadlines of this adapter share a
  // single timer instead of each request arming its own.
  const deadlines = new DeadlineScheduler();

  function handleError(error: unknown, ctx: TCtx | undefined): Response | Promise<Response> {
    if (options.onError !== undefined) {
      // A context-factory failure has no request context to hand over; answer the
      // generic 500 rather than widening the adapter's error hook contract.
      if (ctx === undefined) return jsonErrorResponse(500, 'Internal Server Error');
      return options.onError(error as Error, ctx);
    }

    logger.error('Request error:', error);
    return jsonErrorResponse(500, 'Internal Server Error');
  }

  /** Write the not-found body, then finalize through the context. */
  function finalize(ctx: TCtx): Response {
    // Finalize through the context so headers set via ctx.set() survive an
    // implicit/empty response; the 404 body is written through the same builder.
    if (!ctx.responded && ctx.status === 404) {
      ctx.json({ error: 'Not Found' });
    }
    return ctx.getResponse();
  }

  /** Bound a dispatch, then finalize it. */
  async function answer(ctx: TCtx, dispatch: Dispatch): Promise<Response> {
    try {
      if (options.timeout > 0) {
        // Every dispatch is bounded by the deadline, including one that already
        // committed its response. Commitment is not settlement: a handler can
        // publish its response and then keep running (a post-`next()` middleware,
        // or a body that never closes), and awaiting that chain without a bound
        // holds the connection open for the lifetime of the server. The settle
        // window is shape-dependent (see `settleTurnsFor`).
        const timedOut = await dispatchWithTimeout(
          dispatch,
          options.timeout,
          () => {
            ctx.triggerTimeout();
          },
          deadlines,
          settleTurnsFor((ctx.bodyLength ?? 0) > 0)
        );

        if (timedOut) {
          // A handler that committed a response before the deadline is answered
          // with that response: the 504 is reserved for a request that produced
          // nothing. Node keeps the committed response in the same situation, and
          // `triggerTimeout` above already aborted `ctx.signal`. No warning is
          // emitted, because the warning states that a 504 was returned.
          if (hasCommittedResponse(ctx)) {
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
        await dispatch;
      }

      return finalize(ctx);
    } catch (error) {
      return handleError(error, ctx);
    }
  }

  /** The first request: clear the boot barrier, then dispatch. */
  async function bootAndAnswer(ctx: TCtx): Promise<Response> {
    try {
      handler ??= await boot.ensure();
      syncDispatchSafe = app.syncDispatchSafe === true;
      // `await` so a rejection from the adapter's error hook is also observed
      // here rather than escaping past this catch.
      return await answer(ctx, handler(ctx));
    } catch (error) {
      return handleError(error, ctx);
    }
  }

  return function run(request: Request, extra: TExtra): Response | Promise<Response> {
    let ctx: TCtx;
    try {
      ctx = options.makeContext(request, extra);
    } catch (error) {
      return handleError(error, undefined);
    }

    const ready = handler;
    if (ready === undefined) return bootAndAnswer(ctx);

    try {
      const dispatch = ready(ctx);

      // A handler that finished synchronously leaves nothing to await: answer
      // with the built response. The marker is only honoured when the app proved
      // no outer middleware can resume after the handler, and the route executor
      // is the only thing that sets it.
      if (syncDispatchSafe && (ctx as TCtx & DispatchMarkerCarrier)[DISPATCH_SETTLED_SYNC] === true) {
        return finalize(ctx);
      }

      return answer(ctx, dispatch);
    } catch (error) {
      return handleError(error, ctx);
    }
  };
}

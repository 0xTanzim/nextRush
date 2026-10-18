/**
 * @nextrush/runtime — the shared boot gate for adapter entry points.
 *
 * @remarks
 * A server adapter has two ways to hand an application to a runtime: a
 * `serve()`-style API that owns a startup phase and can boot eagerly, and a
 * `createHandler()`-style API that only builds a request handler. The second form
 * has no startup phase, so before this gate existed each adapter either booted
 * per request (Edge) or not at all (Bun, Deno, Node) — and "not at all" is
 * invisible: the handler composes an empty stack, every declared route falls
 * through, and a caller who never awaited `ready()` gets an empty 200 with no
 * error anywhere.
 *
 * The gate makes the first request the boot barrier. `ready()` runs once,
 * concurrent first requests share that single boot, and a failed boot is
 * retryable. The steady-state fast path is the point of the API shape: a request
 * reads {@link BootGate.handler} (already resolved) instead of awaiting
 * {@link BootGate.ensure}, so only the first request pays the boot microtask —
 * and not even that when the application was booted eagerly by the caller.
 *
 * @packageDocumentation
 */

/**
 * The structural slice of `Application` the gate needs.
 *
 * @remarks
 * Deliberately structural rather than `import type { Application }` from
 * `@nextrush/core`: this package depends on `@nextrush/errors` and
 * `@nextrush/types` only, and a core import would invert that direction. The type
 * parameter carries the handler type through, so callers get their own concrete
 * handler back with no cast.
 */
export interface BootableApp<THandler> {
  /** Whether the boot sequence has already completed. */
  readonly isReady: boolean;

  /** Run the boot sequence (extension setup, router mount). Idempotent. */
  ready(): Promise<unknown>;

  /** Snapshot the middleware stack into a request handler. */
  callback(): THandler;

  /** Mark the application as running. */
  start(): void;

  /** Whether the application runs in production. */
  readonly isProduction: boolean;
}

/** Options for {@link createBootGate}. */
export interface BootGateOptions {
  /**
   * Adapter label used in the boot-reuse warning, e.g. `'bun'` renders as
   * `[nextrush/bun]`.
   */
  label: string;

  /**
   * Mark the application running once boot completes.
   *
   * @remarks
   * Adapters with a server lifetime (`serve`/`listen`) call `start()` themselves
   * and leave this unset, so a bare handler does not claim the application is
   * serving. A runtime with no server lifetime (Edge) sets it, so `app.isRunning`
   * stays consistent with the server adapters.
   */
  markRunning?: boolean;
}

/** The boot barrier returned by {@link createBootGate}. */
export interface BootGate<THandler> {
  /**
   * The handler, once boot has completed — `undefined` before the first
   * {@link ensure}. Reading this is synchronous: the intended steady-state
   * request path is `handler ?? (await gate.ensure())`, which never awaits after
   * the first boot.
   */
  readonly handler: THandler | undefined;

  /**
   * Boot the application if it has not booted, and resolve to its handler.
   *
   * @remarks
   * Memoized: concurrent callers share one `ready()` call. A rejected boot
   * clears the memo, so the next request re-attempts boot rather than serving
   * every later request from a permanently failed barrier. Resolves immediately
   * when the application was already booted before the gate was built.
   */
  ensure(): Promise<THandler>;
}

/**
 * Module-level boot-reuse bookkeeping.
 *
 * @remarks
 * `bootedApps` records every application that has booted through a gate in this
 * process/isolate; `warnedBootReuse` keeps the warning to one per module
 * instance. Module scope — not per-gate — is deliberate: the mistake this
 * catches (`createApp()` called inside the exported handler instead of at module
 * scope) creates a NEW gate on every invocation, so per-gate state could never
 * observe a second application.
 */
const bootedApps = new WeakSet<object>();
let hasBootedAnyApp = false;
let warnedBootReuse = false;

function warnOnAppReuse(app: BootableApp<unknown>, label: string): void {
  if (app.isProduction || warnedBootReuse || !hasBootedAnyApp || bootedApps.has(app)) {
    return;
  }
  warnedBootReuse = true;
  console.warn(
    `[nextrush/${label}] A different Application booted in this process/isolate than the one ` +
      `that booted first. This usually means createApp() (or the adapter's handler factory) is being ` +
      `called inside the exported handler instead of at module scope — rebuilding the app on every ` +
      `invocation defeats warm-instance reuse and increases cold-start-like latency on every request. ` +
      `Build the app once, at module scope, above the export. (This message appears in development only.)`
  );
}

/**
 * Build a memoized boot barrier for one adapter entry point.
 *
 * @param app - The application to boot before the first dispatch
 * @param options - Adapter label and running-state policy
 * @returns A gate exposing the resolved {@link BootGate.handler} and an
 * {@link BootGate.ensure} that boots at most once per success
 *
 * @example
 * ```typescript
 * const boot = createBootGate(app, { label: 'bun' });
 *
 * return async (request) => {
 *   const handler = boot.handler ?? (await boot.ensure());
 *   // …build a context and dispatch through `handler`
 * };
 * ```
 */
export function createBootGate<THandler>(
  app: BootableApp<THandler>,
  options: BootGateOptions
): BootGate<THandler> {
  // An entry point that runs inside a `serve()`/`listen()` startup phase has
  // already awaited `ready()` by the time the gate is built, so its very first
  // request must not be deferred behind the barrier: composer here, once, at
  // construction. Observable as a timing regression, not a correctness one — the
  // gate would have resolved one microtask later on that first request, which is
  // enough to lose a race against a socket-level timeout configured to the same
  // value as the handler timeout.
  let handler: THandler | undefined = app.isReady ? app.callback() : undefined;
  let bootPromise: Promise<THandler> | null = null;

  const ensure = (): Promise<THandler> => {
    if (handler !== undefined) {
      // Already composed — at construction (eager caller) or by an earlier
      // request. Never re-enter `ready()`.
      return Promise.resolve(handler);
    }
    bootPromise ??= app
      .ready()
      .then(() => {
        warnOnAppReuse(app, options.label);
        bootedApps.add(app);
        hasBootedAnyApp = true;

        const booted = app.callback();
        if (options.markRunning) {
          app.start();
        }
        handler = booted;
        return booted;
      })
      .catch((error: unknown) => {
        // Boot is retryable: a failed barrier must not poison every later request.
        bootPromise = null;
        throw error;
      });
    return bootPromise;
  };

  return {
    get handler(): THandler | undefined {
      return handler;
    },
    ensure,
  };
}

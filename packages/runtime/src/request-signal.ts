/**
 * @nextrush/runtime - Request Signal Combiner
 *
 * Shared helper that lets a per-request timeout cooperatively cancel the
 * handler through `ctx.signal` (audit F-08). A web adapter combines the
 * platform `Request.signal` (client disconnect) with an adapter-owned
 * controller (timeout) so a cooperative handler/stream can stop when either
 * fires.
 *
 * @packageDocumentation
 */

/** A combined abort signal plus the handle to fire the adapter-owned side. */
export interface CombinedAbort {
  /** The signal to expose as `ctx.signal` — aborts when base OR timeout fires. */
  readonly signal: AbortSignal;
  /** Abort the adapter-owned side (e.g. on request timeout). Idempotent. */
  abort(reason?: unknown): void;
}

/**
 * Combine a base `AbortSignal` (the platform request signal) with a fresh
 * adapter-owned `AbortController`, so timeout cancellation can be fed into the
 * same signal a handler already observes.
 *
 * @remarks
 * Uses `AbortSignal.any`, available on all NextRush target runtimes (Node ≥
 * 20.3, Bun, Deno, Cloudflare Workers). Created lazily by the context on first
 * `signal` access to keep the non-streaming/non-timeout hot path allocation-free.
 *
 * @param base - The platform `Request.signal` (fires on client disconnect).
 * @returns The combined signal and an `abort()` handle for the timeout side.
 */
export function combineAbortSignal(base: AbortSignal): CombinedAbort {
  const controller = new AbortController();
  return {
    signal: AbortSignal.any([base, controller.signal]),
    abort(reason?: unknown): void {
      if (!controller.signal.aborted) {
        controller.abort(reason);
      }
    },
  };
}

/**
 * Derive a bounded child `AbortSignal` from a parent signal (typically
 * `ctx.signal`), so handler authors can race work against a deadline without
 * hand-rolling `AbortSignal.any`/`setTimeout` composition themselves (audit
 * F-06/F-13, N11 task 11.3).
 *
 * @remarks
 * The returned signal aborts when EITHER `ms` milliseconds elapse OR the
 * parent signal aborts — whichever happens first. Uses `AbortSignal.any` +
 * `AbortSignal.timeout`, both available on every NextRush target runtime
 * (Node ≥ 20.3, Bun, Deno, Cloudflare Workers), giving the same shared shape
 * `combineAbortSignal` already relies on. `AbortSignal.timeout`'s own timer
 * is unref'd/cleared internally by the platform once the signal settles, so
 * no manual `clearTimeout` bookkeeping is needed here.
 *
 * @param parentSignal - The signal to inherit cancellation from (e.g. `ctx.signal`).
 * @param ms - The deadline in milliseconds.
 * @returns A signal that aborts on whichever of `parentSignal` or the `ms` deadline fires first.
 *
 * @example
 * ```typescript
 * const deadline = deriveDeadlineSignal(ctx.signal, 2_000);
 * const result = await fetch(url, { signal: deadline });
 * ```
 */
export function deriveDeadlineSignal(parentSignal: AbortSignal, ms: number): AbortSignal {
  return AbortSignal.any([parentSignal, AbortSignal.timeout(ms)]);
}

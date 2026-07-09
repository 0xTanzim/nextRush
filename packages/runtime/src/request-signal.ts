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

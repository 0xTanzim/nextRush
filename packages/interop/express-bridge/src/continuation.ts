/**
 * @nextrush/express-bridge - Continuation state machine
 *
 * Owns the translation of Express `next` / terminal responses / thenables /
 * thrown errors into the NextRush `compose()` continuation, without forking
 * `compose()` semantics.
 *
 * The normative contract (RFC-035 §8.6):
 *   - `next()`          → await downstream NextRush `next()`, then fulfill.
 *   - `next(err)`       → reject into `compose` / `Application.handleError`.
 *   - terminal response → fulfill without downstream.
 *   - response + next() → response wins; `next()` is a warned no-op.
 *   - double `next()`   → first wins; second is warned no-op (never double-settle).
 *   - thenable hang     → fail closed (`ExpressBridgeProtocolError`).
 *   - callback-style    → Express continuation (not microtask-failed).
 *
 * @packageDocumentation
 */

import type { Context, Next } from '@nextrush/types';
import { ExpressBridgeProtocolError, UnsupportedExpressApiError } from './errors';

export type ContinuationState =
  | 'idle'
  | 'continued'
  | 'terminated'
  | 'error'
  | 'protocolError';

/** Diagnostic-verbosity switch: the only switch this package reads. */
function isDev(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/** Wrap non-Error values exactly as `compose()` does. */
function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

function warnOnce(message: string): void {
  if (isDev()) {
    console.warn(message);
  }
}

/**
 * A per-request continuation handle. `promise` is what the returned NextRush
 * middleware returns; it settles exactly once, mirroring `compose()`.
 */
export interface Continuation {
  readonly state: ContinuationState;
  readonly promise: Promise<void>;
  /** The `next` argument handed to foreign middleware. */
  readonly expressNext: (err?: unknown) => void;
  /** Mark the response terminal (a terminal `res` write happened). */
  markTerminated(): void;
  /** Adopt the foreign middleware's return value (thenable vs non-thenable). */
  adoptReturn(result: unknown): void;
  /** Reject with an error (sync throw / `next(err)` / thenable rejection). */
  fail(err: unknown): void;
}

interface ContinuationDeps {
  ctx: Context;
  downstream: Next;
  /** The real Node `res`, used for `headersSent` on thenable-hang detection. */
  rawRes: { headersSent?: boolean };
}

export function createContinuation(deps: ContinuationDeps): Continuation {
  const { ctx, downstream, rawRes } = deps;

  let state: ContinuationState = 'idle';

  let resolvePromise!: () => void;
  let rejectPromise!: (err: unknown) => void;
  let settled = false;

  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  function settleResolve(): void {
    if (settled) return;
    settled = true;
    resolvePromise();
  }

  function settleReject(err: unknown): void {
    if (settled) return;
    settled = true;
    rejectPromise(err);
  }

  function markTerminated(): void {
    if (state !== 'idle') {
      warnOnce(
        '[express-bridge] response was already committed or next() already called; the later terminal write was ignored.'
      );
      return;
    }
    state = 'terminated';
    settleResolve();
  }

  function fail(err: unknown): void {
    if (state !== 'idle') {
      warnOnce(
        '[express-bridge] middleware failed after continuation already advanced; the error was ignored.'
      );
      return;
    }
    state = 'error';
    settleReject(toError(err));
  }

  function expressNext(err?: unknown): void {
    if (state !== 'idle') {
      warnOnce(
        '[express-bridge] next() called multiple times; the second call was ignored.'
      );
      return;
    }

    if (err === 'route' || err === 'router') {
      // Idle + `'route'`/`'router'`: unsupported route-skip, not a generic error.
      throw new UnsupportedExpressApiError(`next('${err}')`);
    }

    if (err !== undefined) {
      fail(err);
      return;
    }

    state = 'continued';
    Promise.resolve()
      .then(() => downstream())
      .then(
        () => {
          settleResolve();
        },
        (e: unknown) => {
          state = 'error';
          settleReject(toError(e));
        }
      );
  }

  function adoptReturn(result: unknown): void {
    // Only a thenable is adopted. A non-thenable (`undefined` or other) is
    // Express callback continuation: it may call next() later from I/O.
    if (result === null || result === undefined) {
      return;
    }
    const thenable = result as { then?: unknown };
    if (typeof thenable.then !== 'function') {
      return;
    }

    Promise.resolve(result).then(
      () => {
        if (state !== 'idle') return;
        if (ctx.responded || rawRes.headersSent === true) {
          markTerminated();
          return;
        }
        state = 'protocolError';
        settleReject(new ExpressBridgeProtocolError());
      },
      (e: unknown) => {
        fail(e);
      }
    );
  }

  return {
    get state() {
      return state;
    },
    promise,
    expressNext,
    markTerminated,
    adoptReturn,
    fail,
  };
}

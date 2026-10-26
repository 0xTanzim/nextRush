/**
 * @nextrush/core - Specialized Middleware Composition Fast Paths
 *
 * Dedicated fast-path runners for zero, single, and two-middleware stacks.
 * Unrolls dispatch recursions and dynamic indexing while strictly preserving
 * every Koa-style observable invariant and error contract.
 *
 * @packageDocumentation
 */

import {
  DISPATCH_SETTLED_SYNC,
  RESOLVED_PROMISE as RESOLVED,
  type Context,
  type DispatchMarkerCarrier,
  type Middleware,
  type Next,
} from '@nextrush/types';
import type { ComposedMiddleware } from './middleware';

/**
 * Rejection message shared across all composition paths.
 * Asserted by downstream tests and contracts.
 */
export const MULTIPLE_NEXT_MESSAGE = 'next() called multiple times';

/**
 * Emit the double-response warning for the middleware at `index`.
 */
export function emitDoubleResponseWarning(index: number): void {
  console.warn(
    `[nextrush] Middleware at index ${String(index)} called next() after the response was already committed. ` +
      'Downstream middleware may attempt to write to an already-finished response. ' +
      'Either await next() to delegate downstream, or send a response without calling next().'
  );
}

/**
 * Fast-path runner for zero middleware.
 */
export function createEmptyMiddlewareRunner(): ComposedMiddleware {
  return function composedEmpty(ctx: Context, next?: Next): Promise<void> {
    if (!next) {
      (ctx as Context & DispatchMarkerCarrier)[DISPATCH_SETTLED_SYNC] = true;
      return RESOLVED;
    }
    return next();
  };
}

/**
 * Fast-path runner for exactly one middleware.
 *
 * Avoids allocating the recursive `dispatch` closure and the per-call index
 * comparison of the general path while preserving every observable semantic:
 *   - Per-invocation double-call protection (`called`);
 *   - The same guarded thunk passed as `next` and wired to `ctx.setNext`;
 *   - Double-response warning when enabled;
 *   - Synchronous throw conversion to `Promise.reject`.
 */
export function createSingleMiddlewareRunner(
  only: Middleware,
  warnDoubleResponse: boolean
): ComposedMiddleware {
  return function composedSingle(ctx: Context, next?: Next): Promise<void> {
    let called = false; // PER-INVOCATION guard

    const nextFn = (): Promise<void> => {
      if (called) {
        return Promise.reject(new Error(MULTIPLE_NEXT_MESSAGE));
      }
      called = true;
      if (warnDoubleResponse && ctx.responded) {
        emitDoubleResponseWarning(0);
      }
      if (!next) {
        (ctx as Context & DispatchMarkerCarrier)[DISPATCH_SETTLED_SYNC] = true;
        return RESOLVED;
      }
      return next();
    };

    if (ctx.setNext) {
      ctx.setNext(nextFn);
    }

    try {
      const result = only(ctx, nextFn);
      return result === undefined || result === RESOLVED ? RESOLVED : Promise.resolve(result);
    } catch (err: unknown) {
      return Promise.reject(err instanceof Error ? err : new Error(String(err)));
    }
  };
}

/**
 * Fast-path runner for exactly two middleware.
 *
 * Unrolls recursive `dispatch` into two direct call frames while preserving:
 *   - Per-invocation double-call protection (`called0`/`called1`);
 *   - Per-invocation double-response warning per index;
 *   - `ctx.setNext` wiring per middleware with proper restoration on unwinding;
 *   - Synchronous throw conversion to `Promise.reject`.
 */
export function createTwoMiddlewareRunner(
  first: Middleware,
  second: Middleware,
  warnDoubleResponse: boolean
): ComposedMiddleware {
  return function composedTwo(ctx: Context, next?: Next): Promise<void> {
    let called0 = false;
    let called1 = false;

    const next1 = (): Promise<void> => {
      if (called1) {
        return Promise.reject(new Error(MULTIPLE_NEXT_MESSAGE));
      }
      called1 = true;
      if (warnDoubleResponse && ctx.responded) {
        emitDoubleResponseWarning(1);
      }
      if (!next) {
        (ctx as Context & DispatchMarkerCarrier)[DISPATCH_SETTLED_SYNC] = true;
        return RESOLVED;
      }
      return next();
    };

    const next0 = (): Promise<void> => {
      if (called0) {
        return Promise.reject(new Error(MULTIPLE_NEXT_MESSAGE));
      }
      called0 = true;
      if (warnDoubleResponse && ctx.responded) {
        emitDoubleResponseWarning(0);
      }
      if (ctx.setNext) {
        ctx.setNext(next1);
      }
      try {
        const result = second(ctx, next1);
        if (result === undefined || result === RESOLVED) {
          if (ctx.setNext) {
            ctx.setNext(next0);
          }
          return RESOLVED;
        }
        return Promise.resolve(result);
      } catch (err: unknown) {
        if (ctx.setNext) {
          ctx.setNext(next0);
        }
        return Promise.reject(err instanceof Error ? err : new Error(String(err)));
      }
    };

    if (ctx.setNext) {
      ctx.setNext(next0);
    }

    try {
      const result = first(ctx, next0);
      return result === undefined || result === RESOLVED ? RESOLVED : Promise.resolve(result);
    } catch (err: unknown) {
      return Promise.reject(err instanceof Error ? err : new Error(String(err)));
    }
  };
}

/**
 * Fast-path runner for exactly three middleware.
 *
 * Unrolls recursive `dispatch` into three direct call frames while preserving:
 *   - Per-invocation double-call protection (`called0`/`called1`/`called2`);
 *   - Per-invocation double-response warning per index;
 *   - `ctx.setNext` wiring per middleware with proper restoration on unwinding;
 *   - Synchronous throw conversion to `Promise.reject`.
 */
export function createThreeMiddlewareRunner(
  first: Middleware,
  second: Middleware,
  third: Middleware,
  warnDoubleResponse: boolean
): ComposedMiddleware {
  return function composedThree(ctx: Context, next?: Next): Promise<void> {
    let called0 = false;
    let called1 = false;
    let called2 = false;

    const next2 = (): Promise<void> => {
      if (called2) {
        return Promise.reject(new Error(MULTIPLE_NEXT_MESSAGE));
      }
      called2 = true;
      if (warnDoubleResponse && ctx.responded) {
        emitDoubleResponseWarning(2);
      }
      if (!next) {
        (ctx as Context & DispatchMarkerCarrier)[DISPATCH_SETTLED_SYNC] = true;
        return RESOLVED;
      }
      return next();
    };

    const next1 = (): Promise<void> => {
      if (called1) {
        return Promise.reject(new Error(MULTIPLE_NEXT_MESSAGE));
      }
      called1 = true;
      if (warnDoubleResponse && ctx.responded) {
        emitDoubleResponseWarning(1);
      }
      if (ctx.setNext) {
        ctx.setNext(next2);
      }
      try {
        const result = third(ctx, next2);
        if (result === undefined || result === RESOLVED) {
          if (ctx.setNext) {
            ctx.setNext(next1);
          }
          return RESOLVED;
        }
        return Promise.resolve(result);
      } catch (err: unknown) {
        if (ctx.setNext) {
          ctx.setNext(next1);
        }
        return Promise.reject(err instanceof Error ? err : new Error(String(err)));
      }
    };

    const next0 = (): Promise<void> => {
      if (called0) {
        return Promise.reject(new Error(MULTIPLE_NEXT_MESSAGE));
      }
      called0 = true;
      if (warnDoubleResponse && ctx.responded) {
        emitDoubleResponseWarning(0);
      }
      if (ctx.setNext) {
        ctx.setNext(next1);
      }
      try {
        const result = second(ctx, next1);
        if (result === undefined || result === RESOLVED) {
          if (ctx.setNext) {
            ctx.setNext(next0);
          }
          return RESOLVED;
        }
        return Promise.resolve(result);
      } catch (err: unknown) {
        if (ctx.setNext) {
          ctx.setNext(next0);
        }
        return Promise.reject(err instanceof Error ? err : new Error(String(err)));
      }
    };

    if (ctx.setNext) {
      ctx.setNext(next0);
    }

    try {
      const result = first(ctx, next0);
      return result === undefined || result === RESOLVED ? RESOLVED : Promise.resolve(result);
    } catch (err: unknown) {
      return Promise.reject(err instanceof Error ? err : new Error(String(err)));
    }
  };
}

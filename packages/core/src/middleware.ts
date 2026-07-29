/**
 * @nextrush/core - Middleware Composition
 *
 * Koa-style middleware composition with async/await support.
 * This is the heart of the middleware pipeline.
 *
 * @packageDocumentation
 */

import type { Context, Middleware, Next } from '@nextrush/types';

/**
 * Composed middleware handler - can be called with just context
 */
export type ComposedMiddleware = (ctx: Context, next?: Next) => Promise<void>;

/**
 * Rejection message shared by BOTH the general path and the single-middleware
 * fast path (design D4). Downstream code/tests assert on this exact string, so
 * it is defined once to prevent the two paths from drifting.
 */
const MULTIPLE_NEXT_MESSAGE = 'next() called multiple times';

/**
 * Shared already-resolved promise, returned wherever this module would
 * otherwise construct a fresh one. Mirrors the router's existing `RESOLVED` /
 * `NOOP_NEXT` sentinels.
 *
 * @see openspec/changes/elide-resolved-promise-allocation/design.md
 */
const RESOLVED: Promise<void> = Promise.resolve();

/**
 * Emit the double-response warning for the middleware at `index`.
 *
 * Shared by the general path and the fast path so the text (including the
 * index reference) cannot diverge between them (design D4). Fires only when
 * `warnDoubleResponse` is enabled AND the context has already committed a
 * response — the caller supplies both conditions.
 */
function emitDoubleResponseWarning(index: number): void {
  console.warn(
    `[nextrush] Middleware at index ${String(index)} called next() after the response was already committed. ` +
      'Downstream middleware may attempt to write to an already-finished response. ' +
      'Either await next() to delegate downstream, or send a response without calling next().'
  );
}

/**
 * Options for middleware composition
 */
export interface ComposeOptions {
  /**
   * Warn when a middleware sends a response AND calls next().
   *
   * @remarks
   * Opt-in and defaults to `false` — `@nextrush/core` is a runtime-agnostic
   * package and must not read `process.env` (global-rules §2, audit C-4). The
   * `Application` enables this in non-production by passing the flag from its
   * own `env` option.
   *
   * @default false
   */
  warnDoubleResponse?: boolean;
}

/**
 * Compose multiple middleware functions into a single middleware.
 *
 * Executes middleware in order, each middleware can call `await next()`
 * to pass control to the next middleware and wait for it to complete.
 *
 * @param middleware - Array of middleware functions to compose
 * @param options - Composition options
 * @returns Single composed middleware function
 *
 * @example
 * ```typescript
 * const composed = compose([
 *   async (ctx, next) => {
 *     console.log('1 - before');
 *     await next();
 *     console.log('1 - after');
 *   },
 *   async (ctx, next) => {
 *     console.log('2 - before');
 *     await next();
 *     console.log('2 - after');
 *   },
 * ]);
 *
 * // Output:
 * // 1 - before
 * // 2 - before
 * // 2 - after
 * // 1 - after
 * ```
 */
export function compose(middleware: Middleware[], options?: ComposeOptions): ComposedMiddleware {
  // Validate middleware array
  if (!Array.isArray(middleware)) {
    throw new TypeError('Middleware stack must be an array');
  }

  for (const fn of middleware) {
    if (typeof fn !== 'function') {
      throw new TypeError('Middleware must be a function');
    }
  }

  const warnDoubleResponse = options?.warnDoubleResponse ?? false;

  // Snapshot middleware array at compose time
  const stack = [...middleware];
  const len = stack.length;

  // FAST PATH: No middleware — just call next()
  if (len === 0) {
    return function composedMiddleware(_ctx: Context, next?: Next): Promise<void> {
      return next ? next() : RESOLVED;
    };
  }

  // FAST PATH: Exactly one middleware — the overwhelmingly common application
  // shape (a single mounted router). Avoids allocating the recursive `dispatch`
  // closure and the per-call index comparison of the general path while
  // preserving every observable semantic (design D2/D3/D7):
  //   - a PER-INVOCATION guard (`called`) declared inside the returned function,
  //     never hoisted, so concurrent requests cannot corrupt each other;
  //   - the SAME guarded thunk is passed as the `next` argument AND wired to
  //     `ctx.setNext`, so a double-call is caught across either surface;
  //   - a synchronous throw becomes a rejected promise and non-`Error` throws
  //     are wrapped, identical to the general path.
  if (len === 1) {
    const only = stack[0];
    if (only) {
      return function composedSingle(ctx: Context, next?: Next): Promise<void> {
        let called = false; // PER-INVOCATION — must never be hoisted out of here
        const nextFn = (): Promise<void> => {
          if (called) {
            return Promise.reject(new Error(MULTIPLE_NEXT_MESSAGE));
          }
          called = true;
          if (warnDoubleResponse && ctx.responded) {
            emitDoubleResponseWarning(0);
          }
          return next ? next() : RESOLVED;
        };

        // Wire ctx.next() to the SAME thunk passed as the argument (design D3).
        if (ctx.setNext) {
          ctx.setNext(nextFn);
        }

        try {
          // Only `undefined` short-circuits to the sentinel. A thenable MUST
          // stay on the `Promise.resolve` path so its work is adopted, and a
          // falsy-but-defined value must keep its own resolved value.
          const result = only(ctx, nextFn);
          return result === undefined ? RESOLVED : Promise.resolve(result);
        } catch (err: unknown) {
          return Promise.reject(err instanceof Error ? err : new Error(String(err)));
        }
      };
    }
  }

  /**
   * Composed middleware function
   * Uses index-based dispatch to avoid per-request closure chains
   * while preserving double-next detection per call.
   */
  return function composedMiddleware(ctx: Context, next?: Next): Promise<void> {
    // Per-request index tracker — only state needed
    let index = -1;

    function dispatch(i: number): Promise<void> {
      if (i <= index) {
        return Promise.reject(new Error(MULTIPLE_NEXT_MESSAGE));
      }

      index = i;

      let fn: Middleware | Next | undefined;
      if (i < len) {
        fn = stack[i];
      } else if (i === len) {
        fn = next;
      }

      if (!fn) {
        return RESOLVED;
      }

      const nextFn = (): Promise<void> => {
        if (warnDoubleResponse && ctx.responded) {
          emitDoubleResponseWarning(i);
        }
        return dispatch(i + 1);
      };

      // Wire up ctx.next() if the context supports it
      if (ctx.setNext) {
        ctx.setNext(nextFn);
      }

      try {
        // See the fast path's note: `undefined` only, so thenables are adopted.
        const result = fn(ctx, nextFn);
        return result === undefined ? RESOLVED : Promise.resolve(result);
      } catch (err: unknown) {
        return Promise.reject(err instanceof Error ? err : new Error(String(err)));
      }
    }

    return dispatch(0);
  };
}

/**
 * Check if a function is a valid middleware
 */
export function isMiddleware(fn: unknown): fn is Middleware {
  return typeof fn === 'function';
}

/**
 * Flatten nested middleware arrays with type validation.
 * Uses bounded depth (10 levels) to prevent V8 deoptimization on deeply nested arrays.
 */
export function flattenMiddleware(arr: (Middleware | Middleware[])[]): Middleware[] {
  const flattened = arr.flat(10);
  for (const fn of flattened) {
    if (typeof fn !== 'function') {
      throw new TypeError(`Invalid middleware: expected function, got ${typeof fn}`);
    }
  }
  return flattened;
}

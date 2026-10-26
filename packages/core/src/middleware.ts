/**
 * @nextrush/core - Middleware Composition
 *
 * Koa-style middleware composition with async/await support.
 * This is the heart of the middleware pipeline.
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
import {
  MULTIPLE_NEXT_MESSAGE,
  createEmptyMiddlewareRunner,
  createSingleMiddlewareRunner,
  createTwoMiddlewareRunner,
  createThreeMiddlewareRunner,
  emitDoubleResponseWarning,
} from './middleware-fastpaths';

/**
 * Composed middleware handler - can be called with just context
 */
export type ComposedMiddleware = (ctx: Context, next?: Next) => Promise<void>;

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

  // FAST PATH: Zero middleware
  if (len === 0) {
    return createEmptyMiddlewareRunner();
  }

  // FAST PATH: Exactly one middleware
  if (len === 1) {
    const only = stack[0];
    if (only) {
      return createSingleMiddlewareRunner(only, warnDoubleResponse);
    }
  }

  // FAST PATH: Exactly two middleware
  if (len === 2) {
    const first = stack[0];
    const second = stack[1];
    if (first && second) {
      return createTwoMiddlewareRunner(first, second, warnDoubleResponse);
    }
  }

  // FAST PATH: Exactly three middleware
  if (len === 3) {
    const first = stack[0];
    const second = stack[1];
    const third = stack[2];
    if (first && second && third) {
      return createThreeMiddlewareRunner(first, second, third, warnDoubleResponse);
    }
  }

  /**
   * Composed middleware function for general stacks (len >= 3).
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
        if (!next) {
          (ctx as Context & DispatchMarkerCarrier)[DISPATCH_SETTLED_SYNC] = true;
        }
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

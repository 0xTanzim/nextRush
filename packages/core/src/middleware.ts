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
 * Compose multiple middleware functions into a single middleware.
 *
 * Executes middleware in order, each middleware can call `await next()`
 * to pass control to the next middleware and wait for it to complete.
 *
 * @param middleware - Array of middleware functions to compose
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
export function compose(middleware: Middleware[]): ComposedMiddleware {
  // Validate middleware array
  if (!Array.isArray(middleware)) {
    throw new TypeError('Middleware stack must be an array');
  }

  for (const fn of middleware) {
    if (typeof fn !== 'function') {
      throw new TypeError('Middleware must be a function');
    }
  }

  // Snapshot middleware array at compose time
  const stack = [...middleware];
  const len = stack.length;

  // FAST PATH: No middleware — just call next()
  if (len === 0) {
    return function composedMiddleware(_ctx: Context, next?: Next): Promise<void> {
      return next ? next() : Promise.resolve();
    };
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
        return Promise.reject(new Error('next() called multiple times'));
      }

      index = i;

      let fn: Middleware | Next | undefined;
      if (i < len) {
        fn = stack[i];
      } else if (i === len) {
        fn = next;
      }

      if (!fn) {
        return Promise.resolve();
      }

      const nextFn = () => dispatch(i + 1);

      // Wire up ctx.next() if the context supports it
      if (ctx.setNext) {
        ctx.setNext(nextFn);
      }

      try {
        return Promise.resolve(fn(ctx, nextFn));
      } catch (err) {
        return Promise.reject(err);
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
  return flattened as Middleware[];
}

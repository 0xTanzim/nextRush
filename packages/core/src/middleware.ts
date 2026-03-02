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

  /**
   * Composed middleware function
   */
  return function composedMiddleware(ctx: Context, next?: Next): Promise<void> {
    // Track the index to prevent multiple next() calls
    let index = -1;

    /**
     * Dispatch to middleware at index i
     */
    async function dispatch(i: number): Promise<void> {
      // Ensure next() wasn't called multiple times
      if (i <= index) {
        throw new Error('next() called multiple times');
      }

      index = i;

      // Get the middleware function at index i
      // If we've gone through all middleware, call the final next
      let fn: Middleware | Next | undefined;

      if (i < middleware.length) {
        fn = middleware[i];
      } else if (i === middleware.length) {
        fn = next;
      }

      // If no more middleware, we're done
      if (!fn) {
        return;
      }

      const nextFn = () => dispatch(i + 1);

      // Wire up ctx.next() if the context supports it
      if (ctx.setNext) {
        ctx.setNext(nextFn);
      }

      // Call the middleware with context and next function
      // Support both (ctx) and (ctx, next) signatures
      await fn(ctx, nextFn);
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
 * Flatten nested middleware arrays with type validation
 */
export function flattenMiddleware(arr: (Middleware | Middleware[])[]): Middleware[] {
  const flattened = arr.flat(Infinity);
  for (const fn of flattened) {
    if (typeof fn !== 'function') {
      throw new TypeError(`Invalid middleware: expected function, got ${typeof fn}`);
    }
  }
  return flattened as Middleware[];
}

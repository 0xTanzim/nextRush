/**
 * @nextrush/controllers - Exception Filter Runner
 *
 * Runs exception filters when a route handler body throws. Filters are matched
 * by their `@Catch` types (or catch-all), resolved from the DI container, and
 * the first matching filter handles the error by setting the response. If no
 * filter matches, the error is rethrown so the global error middleware handles
 * it — preserving current, filter-free behavior.
 */

import type { ExceptionFilter, ExceptionFilterClass } from '@nextrush/decorators';
import { getCatchTypes } from '@nextrush/decorators';
import type { Container } from '@nextrush/di';
import type { Context, Next, RouteHandler } from '@nextrush/types';

/**
 * Whether a filter's `@Catch` types match a thrown error.
 *
 * Empty `catchTypes` (no-arg `@Catch()` or no `@Catch` metadata) is a
 * catch-all and matches any error.
 */
function filterMatches(catchTypes: readonly Function[], error: unknown): boolean {
  if (catchTypes.length === 0) {
    return true;
  }
  return catchTypes.some(
    (type) => error instanceof (type as new (...args: unknown[]) => unknown)
  );
}

/**
 * Invoke the first applicable filter for a thrown error.
 *
 * Filters are walked in the precedence order supplied by the caller
 * (method-level first, then class-level). The first filter whose `@Catch`
 * types match is resolved from the DI container and its `catch(error, ctx)`
 * sets the response.
 *
 * @returns `true` if a filter handled the error; `false` if none matched (the
 *   caller must rethrow so the global error middleware still runs).
 */
export async function applyFilters(
  filters: readonly ExceptionFilterClass[],
  error: unknown,
  ctx: Context,
  container: Container
): Promise<boolean> {
  for (const filter of filters) {
    if (!filterMatches(getCatchTypes(filter), error)) {
      continue;
    }

    const instance = container.resolve(filter) as ExceptionFilter;
    await instance.catch(error, ctx);
    return true;
  }

  return false;
}

/**
 * Wrap a route handler so thrown errors flow through the exception filters.
 *
 * A matched filter handles the error (sets the response); an unmatched error is
 * rethrown unchanged. Only installed when a route has at least one filter, so
 * filter-free routes keep their original (unwrapped) behavior.
 */
export function wrapWithFilters(
  execute: RouteHandler,
  filters: readonly ExceptionFilterClass[],
  container: Container
): RouteHandler {
  return async (ctx: Context, next: Next): Promise<void> => {
    try {
      await execute(ctx, next);
    } catch (error) {
      const handled = await applyFilters(filters, error, ctx, container);
      if (!handled) {
        throw error;
      }
    }
  };
}

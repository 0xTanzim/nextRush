/**
 * Exception Filter Handler for NextRush v2
 *
 * Manages exception filter middleware creation and caching.
 * Follows Single Responsibility Principle.
 *
 * @packageDocumentation
 */

import {
  GlobalExceptionFilter,
  type ExceptionFilter,
} from '@/errors/custom-errors';
import type { Context, Middleware } from '@/types/context';

/**
 * Symbol used to mark exception filter middleware
 */
export const EXCEPTION_FILTER_MARK = Symbol('ExceptionFilter');

/**
 * Exception filter manager
 */
export interface ExceptionFilterManager {
  /** Find cached exception filter or scan middleware */
  findExceptionFilter: () => Middleware | null;
  /** Create and cache an exception filter middleware */
  createExceptionFilter: (filters?: ExceptionFilter[]) => Middleware;
  /** Invalidate the cached filter */
  invalidateCache: () => void;
}

/**
 * Create an exception filter manager
 *
 * @param getMiddleware - Function to get the middleware array
 * @returns Exception filter manager
 */
export function createExceptionFilterManager(
  getMiddleware: () => Middleware[]
): ExceptionFilterManager {
  let cachedFilter: Middleware | null = null;

  const findExceptionFilter = (): Middleware | null => {
    if (cachedFilter !== null) {
      return cachedFilter;
    }

    const middleware = getMiddleware();
    const found = middleware.find((mw) => {
      // Check for marker symbol
      const marked =
        (mw as any)[EXCEPTION_FILTER_MARK] === true;
      if (marked) return true;

      // Fallback: check function source
      const source = mw.toString();
      return source.includes('exceptionFilter') || source.includes('ExceptionFilter');
    });

    cachedFilter = found ?? null;
    return cachedFilter;
  };

  const createExceptionFilter = (
    filters: ExceptionFilter[] = [new GlobalExceptionFilter()]
  ): Middleware => {
    const middleware: Middleware = async (ctx: Context, next) => {
      try {
        await next();
      } catch (error) {
        const filter = findFilterForError(error as Error, filters);
        await filter.catch(error as Error, ctx);
      }
    };

    // Mark as exception filter for O(1) detection
    (middleware as any)[EXCEPTION_FILTER_MARK] = true;
    // Cache immediately
    cachedFilter = middleware;

    return middleware;
  };

  const invalidateCache = (): void => {
    cachedFilter = null;
  };

  return {
    findExceptionFilter,
    createExceptionFilter,
    invalidateCache,
  };
}

/**
 * Find the appropriate filter for an error
 *
 * @param error - The error to handle
 * @param filters - Available exception filters
 * @returns The appropriate filter
 */
function findFilterForError(
  error: Error,
  filters: ExceptionFilter[]
): ExceptionFilter {
  const filter = filters.find((f) => {
    // Global filter catches all
    if (f.constructor.name === 'GlobalExceptionFilter') {
      return true;
    }

    // Check if filter has exceptions property (from @Catch decorator)
    const filterClass = f.constructor as any;
    if (filterClass.exceptions) {
      return filterClass.exceptions.some(
        (ExceptionClass: any) => error instanceof ExceptionClass
      );
    }

    return false;
  });

  // Fallback to global filter
  return filter ?? new GlobalExceptionFilter();
}

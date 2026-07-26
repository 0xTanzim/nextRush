/**
 * @nextrush/class - Exception Filter Decorators
 *
 * Exception filters localize error handling to a controller or route. A filter
 * is a class implementing {@link ExceptionFilter}; it declares which errors it
 * handles with `@Catch(...)` and turns a thrown error into a response.
 *
 * Filters are opt-in and non-breaking: a controller/route with no `@UseFilter`
 * behaves exactly as before — errors propagate to the global error middleware.
 */

import { getMetadata, defineMetadata } from '../reflection/reflection.js';
import type { ExceptionFilterClass, FilterMetadata } from '../types.js';
import { DECORATOR_METADATA_KEYS } from '../types.js';

/**
 * Declare which error constructors an exception filter handles.
 *
 * `@Catch(NotFoundError)` matches `NotFoundError` and its subclasses (via
 * `instanceof`). `@Catch()` with no arguments is a **catch-all** — it matches
 * any thrown value. A filter with no `@Catch` at all is also treated as
 * catch-all.
 *
 * @param errorTypes - Error constructors this filter handles (empty = catch-all)
 *
 * @example
 * ```typescript
 * @Catch(EntityNotFoundError)
 * class NotFoundFilter implements ExceptionFilter {
 *   catch(error: unknown, ctx: Context) {
 *     ctx.status = 404;
 *     ctx.json({ error: 'Not found' });
 *   }
 * }
 * ```
 */
export function Catch(...errorTypes: Function[]): ClassDecorator {
  return function catchDecorator(target: object): void {
    defineMetadata(DECORATOR_METADATA_KEYS.CATCH, errorTypes, target);
  };
}

/**
 * Apply exception filters to a controller or route.
 *
 * Works as both a class decorator (covers every route on the controller) and a
 * method decorator (covers that route only), mirroring {@link UseGuard}.
 * Method-level filters take precedence over class-level filters; within a
 * level, the first matching filter wins.
 *
 * @param filters - Exception filter classes to apply
 *
 * @example Controller-level (applies to all routes)
 * ```typescript
 * @UseFilter(DomainErrorFilter)
 * @Controller('/users')
 * class UserController {}
 * ```
 *
 * @example Method-level (higher precedence)
 * ```typescript
 * @Controller('/users')
 * class UserController {
 *   @UseFilter(ConflictFilter)
 *   @Post()
 *   create() {}
 * }
 * ```
 */
export function UseFilter(...filters: ExceptionFilterClass[]): ClassDecorator & MethodDecorator {
  return function filterDecorator(
    target: object | Function,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor
  ): void {
    if (propertyKey !== undefined && descriptor !== undefined) {
      // Method decorator - store on method
      const existing: FilterMetadata[] =
        getMetadata(DECORATOR_METADATA_KEYS.FILTERS, target.constructor, propertyKey) ?? [];

      const metadata: FilterMetadata = {
        filters,
        target: 'method',
        methodName: propertyKey,
      };

      defineMetadata(
        DECORATOR_METADATA_KEYS.FILTERS,
        [...existing, metadata],
        target.constructor,
        propertyKey
      );
    } else {
      // Class decorator - store on class
      const existing: FilterMetadata[] =
        getMetadata(DECORATOR_METADATA_KEYS.FILTERS, target) ?? [];

      const metadata: FilterMetadata = {
        filters,
        target: 'class',
      };

      defineMetadata(DECORATOR_METADATA_KEYS.FILTERS, [...existing, metadata], target);
    }
  };
}

/**
 * Get the error constructors an exception filter handles.
 *
 * @param target - Filter class
 * @returns Error constructors from `@Catch` (empty array = catch-all)
 */
export function getCatchTypes(target: Function): Function[] {
  return getMetadata(DECORATOR_METADATA_KEYS.CATCH, target) ?? [];
}

/**
 * Get all class-level filters for a controller.
 *
 * @param target - Controller class
 * @returns Filter classes in decorator application order
 */
export function getClassFilters(target: Function): ExceptionFilterClass[] {
  const metadata: FilterMetadata[] =
    getMetadata(DECORATOR_METADATA_KEYS.FILTERS, target) ?? [];
  return metadata.flatMap((m) => m.filters);
}

/**
 * Get method-level filters for a specific route.
 *
 * @param target - Controller class
 * @param methodName - Method name
 * @returns Filter classes in decorator application order
 */
export function getMethodFilters(
  target: Function,
  methodName: string | symbol
): ExceptionFilterClass[] {
  const metadata: FilterMetadata[] =
    getMetadata(DECORATOR_METADATA_KEYS.FILTERS, target, methodName) ?? [];
  return metadata.flatMap((m) => m.filters);
}

/**
 * Get all filters applicable to a route, in resolution/precedence order.
 *
 * Method-level filters come first (higher precedence), then class-level
 * filters. The controllers runtime walks this list and invokes the first
 * filter whose `@Catch` types match the thrown error.
 *
 * @param target - Controller class
 * @param methodName - Method name
 * @returns Filter classes: method filters first, then class filters
 */
export function getAllFilters(
  target: Function,
  methodName: string | symbol
): ExceptionFilterClass[] {
  const methodFilters = getMethodFilters(target, methodName);
  const classFilters = getClassFilters(target);
  return [...methodFilters, ...classFilters];
}

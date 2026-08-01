/**
 * @nextrush/class - Interceptor Decorators
 *
 * Interceptors wrap the controller-method call (onion / around advice). An
 * interceptor runs code before calling `next()`, awaits the downstream result,
 * and may transform or replace it before it flows into response handling.
 *
 * Interceptors are opt-in and non-breaking: a controller/route with no
 * `@UseInterceptor` behaves exactly as before — the method result flows
 * straight into response handling.
 *
 * Use interceptors for:
 * - Response shaping / envelope wrapping
 * - Timing, logging, and metrics around the handler
 * - Caching (short-circuit `next()` and return a cached value)
 * - Cross-cutting error mapping (try/catch around `next()`)
 */

import { getMetadata, defineMetadata } from '../reflection/reflection.js';
import type { InterceptorClass, InterceptorMetadata } from '../types.js';
import { DECORATOR_METADATA_KEYS } from '../types.js';

/**
 * Apply interceptors to a controller or route.
 *
 * Works as both a class decorator (wraps every route on the controller) and a
 * method decorator (wraps that route only), mirroring {@link UseGuard}. Class
 * interceptors are the outermost layers of the onion; method interceptors are
 * inner, closest to the handler. Interceptor classes are resolved from the DI
 * container at request time.
 *
 * @param interceptors - Interceptor classes to apply
 *
 * @example Controller-level (wraps all routes)
 * ```typescript
 * @UseInterceptor(TimingInterceptor)
 * @Controller('/users')
 * class UserController {}
 * ```
 *
 * @example Method-level (inner layer, closest to the handler)
 * ```typescript
 * @Controller('/users')
 * class UserController {
 *   @UseInterceptor(CacheInterceptor)
 *   @Get()
 *   findAll() {}
 * }
 * ```
 */
export function UseInterceptor(
  ...interceptors: InterceptorClass[]
): ClassDecorator & MethodDecorator {
  return function interceptorDecorator(
    target: object | Function,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor
  ): void {
    if (propertyKey !== undefined && descriptor !== undefined) {
      // Method decorator - store on method
      const existing: InterceptorMetadata[] =
        getMetadata(DECORATOR_METADATA_KEYS.INTERCEPTORS, target.constructor, propertyKey) ??
        [];

      const metadata: InterceptorMetadata = {
        interceptors,
        target: 'method',
        methodName: propertyKey,
      };

      defineMetadata(
        DECORATOR_METADATA_KEYS.INTERCEPTORS,
        [...existing, metadata],
        target.constructor,
        propertyKey
      );
    } else {
      // Class decorator - store on class
      const existing: InterceptorMetadata[] =
        getMetadata(DECORATOR_METADATA_KEYS.INTERCEPTORS, target) ?? [];

      const metadata: InterceptorMetadata = {
        interceptors,
        target: 'class',
      };

      defineMetadata(
        DECORATOR_METADATA_KEYS.INTERCEPTORS,
        [...existing, metadata],
        target
      );
    }
  };
}

/**
 * Get all class-level interceptors for a controller.
 *
 * Interceptors are returned in bottom-to-top decorator application order,
 * matching TypeScript's native decorator execution semantics.
 *
 * @param target - Controller class
 * @returns Interceptor classes in decorator application order
 */
export function getClassInterceptors(target: Function): InterceptorClass[] {
  const metadata: InterceptorMetadata[] =
    getMetadata(DECORATOR_METADATA_KEYS.INTERCEPTORS, target) ?? [];
  return metadata.flatMap((m) => m.interceptors);
}

/**
 * Get method-level interceptors for a specific route.
 *
 * @param target - Controller class
 * @param methodName - Method name
 * @returns Interceptor classes in decorator application order
 */
export function getMethodInterceptors(
  target: Function,
  methodName: string | symbol
): InterceptorClass[] {
  const metadata: InterceptorMetadata[] =
    getMetadata(DECORATOR_METADATA_KEYS.INTERCEPTORS, target, methodName) ?? [];
  return metadata.flatMap((m) => m.interceptors);
}

/**
 * Get all interceptors applicable to a route, in onion (outer-to-inner) order.
 *
 * Class interceptors come first (outermost layers), then method interceptors
 * (inner, closest to the handler). The controllers runtime builds the chain so
 * the first entry runs first and returns last.
 *
 * @param target - Controller class
 * @param methodName - Method name
 * @returns Interceptor classes: class interceptors first, then method
 */
export function getAllInterceptors(
  target: Function,
  methodName: string | symbol
): InterceptorClass[] {
  const classInterceptors = getClassInterceptors(target);
  const methodInterceptors = getMethodInterceptors(target, methodName);
  return [...classInterceptors, ...methodInterceptors];
}

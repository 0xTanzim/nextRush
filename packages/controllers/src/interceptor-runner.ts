/**
 * @nextrush/controllers - Interceptor Runner
 *
 * Builds and runs the interceptor onion around a controller-method call. Class
 * interceptors are the outermost layers, method interceptors are inner (closest
 * to the handler), and the innermost `next()` invokes the actual method and
 * returns its raw result. Each interceptor is resolved from the DI container.
 *
 * Interceptors may transform the result (their return value replaces it) and
 * may wrap `next()` in try/catch to observe or recover from handler errors. An
 * error an interceptor does not handle propagates out — so exception filters,
 * which wrap the whole handler, can still catch it.
 */

import type { Interceptor, InterceptorClass } from '@nextrush/decorators';
import type { Container } from '@nextrush/di';
import type { Context } from '@nextrush/types';

/**
 * Run the controller method wrapped in the interceptor onion.
 *
 * @param interceptors - Interceptor classes in outer-to-inner order (class
 *   interceptors first, then method interceptors), as returned by
 *   `getAllInterceptors`.
 * @param ctx - Request context passed to each interceptor.
 * @param container - DI container each interceptor is resolved from.
 * @param invokeMethod - Innermost call: invokes the controller method with its
 *   resolved arguments and resolves to its raw return value.
 * @returns The (possibly transformed) result flowing into response handling.
 */
export async function runInterceptors(
  interceptors: readonly InterceptorClass[],
  ctx: Context,
  container: Container,
  invokeMethod: () => Promise<unknown>
): Promise<unknown> {
  // Fold from the innermost layer outward: the last interceptor wraps the
  // method call, and each earlier interceptor wraps the layer built so far, so
  // interceptors[0] (a class interceptor) ends up outermost.
  let next = invokeMethod;

  for (let i = interceptors.length - 1; i >= 0; i--) {
    const interceptorClass = interceptors[i]!;
    const downstream = next;
    next = () => {
      const instance = container.resolve(interceptorClass) as Interceptor;
      return instance.intercept(ctx, downstream);
    };
  }

  return next();
}

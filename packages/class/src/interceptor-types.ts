/**
 * @nextrush/decorators - Interceptor Type Definitions
 *
 * Types for the @UseInterceptor decorator: the interceptor contract, its class
 * constructor alias, and the stored interceptor metadata.
 *
 * An interceptor wraps the controller-method call (onion / around advice): it
 * runs code before calling `next()`, awaits the result, and may transform or
 * replace it — the returned value becomes the new result flowing into response
 * handling. Interceptors are Promise-based (not Observable) and resolved from
 * the DI container, so they may inject services (loggers, metrics, mappers).
 */

import type { Context } from '@nextrush/types';

import type { Constructor } from './guard-types.js';

/**
 * Interface for class-based interceptors with dependency injection support.
 *
 * `intercept` receives the request {@link Context} and a `next` callback that
 * invokes the rest of the chain (inner interceptors, ultimately the controller
 * method) and resolves to its result. Call `next()` to proceed; the value you
 * return becomes the result — return `next()`'s value unchanged to pass through,
 * or return a different value to transform the response. Wrap `next()` in
 * try/catch to observe or recover from handler errors; rethrow to propagate.
 *
 * @example
 * ```typescript
 * import { Service } from '@nextrush/di';
 * import type { Interceptor } from '@nextrush/decorators';
 * import type { Context } from '@nextrush/types';
 *
 * @Service()
 * class WrapInterceptor implements Interceptor {
 *   async intercept(ctx: Context, next: () => Promise<unknown>): Promise<unknown> {
 *     const data = await next();
 *     return { data, timestamp: Date.now() };
 *   }
 * }
 * ```
 */
export interface Interceptor {
  intercept(ctx: Context, next: () => Promise<unknown>): Promise<unknown>;
}

/**
 * Constructor type for a class-based interceptor.
 * Accepted by {@link UseInterceptor}; resolved from the DI container per request.
 */
export type InterceptorClass = Constructor<Interceptor>;

/**
 * Interceptor metadata stored by the @UseInterceptor decorator.
 */
export interface InterceptorMetadata {
  /** Interceptor classes applied at this target */
  readonly interceptors: InterceptorClass[];

  /** Whether this is a class or method level interceptor */
  readonly target: 'class' | 'method';

  /** Method name (only for method-level interceptors) */
  readonly methodName?: string | symbol;
}

/**
 * @nextrush/decorators - Exception Filter Type Definitions
 *
 * Types for the @UseFilter / @Catch decorators: the filter contract, its class
 * constructor alias, and the stored filter metadata.
 */

import type { Context } from '@nextrush/types';

import type { Constructor } from '../guards/guard-types.js';

/**
 * Interface for class-based exception filters with dependency injection support.
 *
 * A filter catches errors thrown by a controller route (guards, parameter
 * resolution, or the handler method) and produces the response by mutating
 * `ctx` (status, headers, body). Filters are resolved from the DI container,
 * so they may inject services (loggers, metrics, error mappers).
 *
 * Which errors a filter handles is declared with {@link Catch}. A filter is
 * only invoked when attached to a controller/route via {@link UseFilter}.
 *
 * @example
 * ```typescript
 * import { Service } from '@nextrush/di';
 * import { Catch, type ExceptionFilter } from '@nextrush/decorators';
 * import { NotFoundError } from '@nextrush/errors';
 * import type { Context } from '@nextrush/types';
 *
 * @Service()
 * @Catch(EntityNotFoundError)
 * class NotFoundFilter implements ExceptionFilter {
 *   catch(error: unknown, ctx: Context): void {
 *     ctx.status = 404;
 *     ctx.json({ error: 'Resource not found' });
 *   }
 * }
 * ```
 */
export interface ExceptionFilter {
  catch(error: unknown, ctx: Context): void | Promise<void>;
}

/**
 * Constructor type for a class-based exception filter.
 * Accepted by {@link UseFilter}; resolved from the DI container at catch time.
 */
export type ExceptionFilterClass = Constructor<ExceptionFilter>;

/**
 * Exception filter metadata stored by the @UseFilter decorator.
 */
export interface FilterMetadata {
  /** Filter classes applied at this target */
  readonly filters: ExceptionFilterClass[];

  /** Whether this is a class or method level filter */
  readonly target: 'class' | 'method';

  /** Method name (only for method-level filters) */
  readonly methodName?: string | symbol;
}

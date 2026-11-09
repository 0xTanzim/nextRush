/**
 * @nextrush/validation - Internal Types
 *
 * These types are internal — they are intentionally not exported from the
 * package barrel. Developers only ever write `validate(schema)` or
 * `validate({ body, query, params })`; they never name these types.
 */

import type { Context, StandardSchemaV1 } from '@nextrush/types';

/** Request part a schema can validate. */
export type ValidationTarget = 'body' | 'query' | 'params';

/** Map of request part → schema, for multi-target validation. */
export type RequestSchemas = Partial<Record<ValidationTarget, StandardSchemaV1>>;

/**
 * Options for {@link validate}.
 *
 * @public
 */
export interface ValidateOptions {
  /**
   * HTTP status emitted when validation fails. Defaults to `400`.
   *
   * @remarks
   * Set this to `422` when your API spec maps semantic validation failures to
   * `422 Unprocessable Entity` and reserves `400` for malformed requests. The
   * error `code` stays `VALIDATION_ERROR` either way.
   */
  errorStatus?: number;
}

/**
 * The coerced values produced by a passing validation, as stored on
 * `ctx.state.validated`.
 *
 * @typeParam TBody - Coerced body type.
 * @typeParam TQuery - Coerced query type.
 * @typeParam TParams - Coerced params type.
 *
 * @remarks
 * Only the targets that were configured AND passed appear here. `ctx.query` and
 * `ctx.params` are deliberately left untouched (they stay string maps), so this
 * is the only place the coerced values are available.
 *
 * @public
 */
export interface ValidatedInput<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown,
> {
  /** Coerced request body, when a `body` schema was configured. */
  body?: TBody;
  /** Coerced query object, when a `query` schema was configured. */
  query?: TQuery;
  /** Coerced params object, when a `params` schema was configured. */
  params?: TParams;
}

/**
 * Accessor function and target helpers for reading coerced inputs from `ctx`.
 *
 * @public
 */
export interface ValidatedAccessor {
  /**
   * Read the coerced values produced by {@link validate}.
   *
   * @typeParam T - Custom input shape extending {@link ValidatedInput}.
   * @param ctx - The request context.
   */
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters
  <T extends ValidatedInput = ValidatedInput>(ctx: Context): T;

  /**
   * Read the coerced values with explicit type parameters for body, query, and params.
   *
   * @typeParam TBody - Coerced body type.
   * @typeParam TQuery - Coerced query type.
   * @typeParam TParams - Coerced params type.
   * @param ctx - The request context.
   */
  <TBody = unknown, TQuery = unknown, TParams = unknown>(
    ctx: Context
  ): ValidatedInput<TBody, TQuery, TParams>;

  /**
   * Convenient typed accessor for coerced query values.
   *
   * @typeParam T - Expected query type.
   * @param ctx - The request context.
   * @returns The coerced query object, or `undefined` if not present.
   */
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters
  query<T = unknown>(ctx: Context): T | undefined;

  /**
   * Convenient typed accessor for coerced route params.
   *
   * @typeParam T - Expected params type.
   * @param ctx - The request context.
   * @returns The coerced params object, or `undefined` if not present.
   */
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters
  params<T = unknown>(ctx: Context): T | undefined;

  /**
   * Convenient typed accessor for coerced request body.
   *
   * @typeParam T - Expected body type.
   * @param ctx - The request context.
   * @returns The coerced body object, or `undefined` if not present.
   */
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters
  body<T = unknown>(ctx: Context): T | undefined;
}

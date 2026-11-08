/**
 * @nextrush/validation - Internal Types
 *
 * These types are internal — they are intentionally not exported from the
 * package barrel. Developers only ever write `validate(schema)` or
 * `validate({ body, query, params })`; they never name these types.
 */

import type { StandardSchemaV1 } from '@nextrush/types';

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
 * @remarks
 * Only the targets that were configured AND passed appear here. `ctx.query` and
 * `ctx.params` are deliberately left untouched (they stay string maps), so this
 * is the only place the coerced values are available.
 *
 * @public
 */
export interface ValidatedInput {
  /** Coerced request body, when a `body` schema was configured. */
  body?: unknown;
  /** Coerced query object, when a `query` schema was configured. */
  query?: unknown;
  /** Coerced params object, when a `params` schema was configured. */
  params?: unknown;
}

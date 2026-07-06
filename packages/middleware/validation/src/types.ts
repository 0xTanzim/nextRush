/**
 * @nextrush/validation - Internal Types
 *
 * These types are internal — they are intentionally not exported from the
 * package barrel. Developers only ever write `validate(schema)` or
 * `validate({ body, query, params })`; they never name these types.
 */

import type { StandardSchemaV1 } from './standard-schema.js';

/** Request part a schema can validate. */
export type ValidationTarget = 'body' | 'query' | 'params';

/** Map of request part → schema, for multi-target validation. */
export type RequestSchemas = Partial<Record<ValidationTarget, StandardSchemaV1>>;

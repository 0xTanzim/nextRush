/**
 * @nextrush/validation - Schema Runner
 *
 * The single place that touches the Standard Schema contract. Every entry
 * point (the `validate` middleware, and any future integration) delegates here
 * so validation behaviour is defined exactly once.
 */

import { ValidationError } from '@nextrush/errors';
import { mapIssues } from './issues.js';
import type { InferOutput, StandardSchemaV1 } from '@nextrush/types';

/**
 * Validate `value` against a Standard Schema and return the coerced output.
 *
 * @param schema - Any schema implementing Standard Schema (Zod, Valibot, ...).
 * @param value - The value to validate (e.g. `ctx.body`).
 * @param pathPrefix - Target name used to prefix issue paths (`'body'` | `'query'` | `'params'`).
 * @returns The schema's validated, coerced output.
 * @throws {ValidationError} Aggregating every issue the schema reported.
 */
export async function runSchema<S extends StandardSchemaV1>(
  schema: S,
  value: unknown,
  pathPrefix: string
): Promise<InferOutput<S>> {
  let result = schema['~standard'].validate(value);
  if (result instanceof Promise) {
    result = await result;
  }

  if (result.issues) {
    throw new ValidationError(mapIssues(result.issues, pathPrefix));
  }

  return result.value as InferOutput<S>;
}

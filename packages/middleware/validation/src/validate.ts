/**
 * @nextrush/validation - Validation Middleware
 *
 * `validate()` is the one public entry point. Pass a schema to validate the
 * request body, or a `{ body, query, params }` map to validate several parts
 * at once. On success the coerced body replaces `ctx.body`; query and params
 * are validated but intentionally left unmodified (see the package README §5).
 * On failure it throws the framework's existing `ValidationError`, aggregating
 * every issue across every target.
 */

import { ValidationError, type ValidationIssue } from '@nextrush/errors';
import type { Context, Middleware, Next } from '@nextrush/types';
import { runSchema } from './run-schema.js';
import type { StandardSchemaV1 } from './standard-schema.js';
import type { RequestSchemas, ValidationTarget } from './types.js';

/**
 * Create request-validation middleware.
 *
 * Pass a schema to validate the request **body**, or a `{ body, query, params }`
 * map to validate several parts at once. On success the coerced body replaces
 * `ctx.body`; query and params are validated but intentionally left unmodified
 * (see the package README). On failure it throws the framework's existing
 * `ValidationError`, aggregating every issue across every target.
 *
 * @param arg - A Standard Schema (validates the body) or a per-target schema map.
 */
export function validate(arg: StandardSchemaV1 | RequestSchemas): Middleware {
  const schemas: RequestSchemas = '~standard' in arg ? { body: arg } : arg;

  return async (ctx: Context, next: Next): Promise<void> => {
    const issues: ValidationIssue[] = [];
    let anyFailed = false;
    let coercedBody: unknown;
    let bodyValidated = false;

    // Validate every target before mutating anything, so a later failure never
    // leaves ctx.body half-updated (atomic).
    if (schemas.body) {
      const outcome = await check(schemas.body, ctx.body, 'body', issues);
      if (outcome.ok) {
        coercedBody = outcome.value;
        bodyValidated = true;
      } else {
        anyFailed = true;
      }
    }
    if (schemas.query) {
      if (!(await check(schemas.query, ctx.query, 'query', issues)).ok) anyFailed = true;
    }
    if (schemas.params) {
      if (!(await check(schemas.params, ctx.params, 'params', issues)).ok) anyFailed = true;
    }

    // Track failure explicitly rather than via `issues.length`: a schema that
    // signals failure with an empty issues array must still reject, never pass
    // silently.
    if (anyFailed) {
      throw new ValidationError(issues);
    }

    if (bodyValidated) {
      ctx.body = coercedBody;
    }
    await next();
  };
}

type CheckResult = { ok: true; value: unknown } | { ok: false };

/**
 * Run one schema and accumulate any validation issues rather than throwing
 * immediately, so issues from all targets aggregate into a single error.
 * A non-validation error (a schema whose `validate()` itself throws) is
 * unexpected and propagates untouched — it is not swallowed into the 400.
 */
async function check(
  schema: StandardSchemaV1,
  value: unknown,
  target: ValidationTarget,
  issues: ValidationIssue[]
): Promise<CheckResult> {
  try {
    const validated = await runSchema(schema, value, target);
    return { ok: true, value: validated };
  } catch (err) {
    if (err instanceof ValidationError) {
      issues.push(...err.issues);
      return { ok: false };
    }
    throw err;
  }
}

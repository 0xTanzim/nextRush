/**
 * @nextrush/core - Error Classes
 *
 * Re-exports from @nextrush/errors for backward compatibility.
 * The canonical error classes live in @nextrush/errors.
 *
 * @packageDocumentation
 */

export {
  BadRequestError,
  ForbiddenError,
  HttpError,
  InternalServerError,
  NextRushError,
  NotFoundError,
  UnauthorizedError,
} from '@nextrush/errors';

/**
 * @deprecated Use `createError` (from `nextrush` or `@nextrush/errors`).
 * `createHttpError` is a legacy alias for the same function and will be
 * removed in a future major version (audit N-3).
 */
export { createError as createHttpError } from '@nextrush/errors';

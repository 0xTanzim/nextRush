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
  createError as createHttpError,
  ForbiddenError,
  HttpError,
  InternalServerError,
  NextRushError,
  NotFoundError,
  UnauthorizedError,
} from '@nextrush/errors';

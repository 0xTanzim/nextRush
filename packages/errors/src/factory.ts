/**
 * @nextrush/errors - Error Factory
 *
 * Factory functions for creating errors.
 *
 * @packageDocumentation
 */

import { HttpError } from './base';
import {
  BadGatewayError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  GatewayTimeoutError,
  InternalServerError,
  MethodNotAllowedError,
  NotFoundError,
  ServiceUnavailableError,
  TooManyRequestsError,
  UnauthorizedError,
  UnprocessableEntityError,
  type HttpErrorOptions,
} from './http-errors';

/**
 * HTTP status code to error class mapping
 */
const ERROR_MAP: Record<number, new (message?: string, options?: HttpErrorOptions) => HttpError> = {
  400: BadRequestError,
  401: UnauthorizedError,
  403: ForbiddenError,
  404: NotFoundError,
  409: ConflictError,
  422: UnprocessableEntityError,
  429: TooManyRequestsError,
  500: InternalServerError,
  502: BadGatewayError,
  503: ServiceUnavailableError,
  504: GatewayTimeoutError,
};

/**
 * Create an HTTP error by status code
 */
export function createError(
  status: number,
  message?: string,
  options?: HttpErrorOptions
): HttpError {
  const ErrorClass = ERROR_MAP[status];

  if (ErrorClass) {
    return new ErrorClass(message, options);
  }

  return new HttpError(status, message ?? `HTTP Error ${status}`, options);
}

/**
 * Create a 400 Bad Request error
 */
export function badRequest(message?: string, options?: HttpErrorOptions): BadRequestError {
  return new BadRequestError(message, options);
}

/**
 * Create a 401 Unauthorized error
 */
export function unauthorized(message?: string, options?: HttpErrorOptions): UnauthorizedError {
  return new UnauthorizedError(message, options);
}

/**
 * Create a 403 Forbidden error
 */
export function forbidden(message?: string, options?: HttpErrorOptions): ForbiddenError {
  return new ForbiddenError(message, options);
}

/**
 * Create a 404 Not Found error
 */
export function notFound(message?: string, options?: HttpErrorOptions): NotFoundError {
  return new NotFoundError(message, options);
}

/**
 * Create a 405 Method Not Allowed error
 */
export function methodNotAllowed(
  allowedMethods?: string[],
  message?: string,
  options?: HttpErrorOptions
): MethodNotAllowedError {
  return new MethodNotAllowedError(allowedMethods, message, options);
}

/**
 * Create a 409 Conflict error
 */
export function conflict(message?: string, options?: HttpErrorOptions): ConflictError {
  return new ConflictError(message, options);
}

/**
 * Create a 422 Unprocessable Entity error
 */
export function unprocessableEntity(
  message?: string,
  options?: HttpErrorOptions
): UnprocessableEntityError {
  return new UnprocessableEntityError(message, options);
}

/**
 * Create a 429 Too Many Requests error
 */
export function tooManyRequests(
  message?: string,
  options?: HttpErrorOptions & { retryAfter?: number }
): TooManyRequestsError {
  return new TooManyRequestsError(message, options);
}

/**
 * Create a 500 Internal Server Error
 */
export function internalError(message?: string, options?: HttpErrorOptions): InternalServerError {
  return new InternalServerError(message, options);
}

/**
 * Create a 502 Bad Gateway error
 */
export function badGateway(message?: string, options?: HttpErrorOptions): BadGatewayError {
  return new BadGatewayError(message, options);
}

/**
 * Create a 503 Service Unavailable error
 */
export function serviceUnavailable(
  message?: string,
  options?: HttpErrorOptions & { retryAfter?: number }
): ServiceUnavailableError {
  return new ServiceUnavailableError(message, options);
}

/**
 * Create a 504 Gateway Timeout error
 */
export function gatewayTimeout(message?: string, options?: HttpErrorOptions): GatewayTimeoutError {
  return new GatewayTimeoutError(message, options);
}

/**
 * Check if an error is a NextRush HttpError
 */
export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

/**
 * Get HTTP status from any error
 */
export function getErrorStatus(error: unknown): number {
  if (error instanceof HttpError) {
    return error.status;
  }
  return 500;
}

/**
 * Get error message safe for client response
 */
export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof HttpError && error.expose) {
    return error.message;
  }
  return 'Internal Server Error';
}

/**
 * @nextrush/errors
 *
 * Standardized error handling for NextRush framework.
 *
 * @packageDocumentation
 */

// Base classes
export { HttpError, NextRushError, getHttpStatusMessage } from './base';

// Header validation
export { HeaderValidationError } from './header-validation';

// Central error-code registry
export { ERROR_CODES, GENERIC_ERROR_CODE, VALIDATION_ERROR_CODE, codeForStatus } from './codes';

// HTTP errors - 4xx
export {
  BadRequestError,
  ConflictError,
  ExpectationFailedError,
  FailedDependencyError,
  ForbiddenError,
  GoneError,
  ImATeapotError,
  LengthRequiredError,
  LockedError,
  MethodNotAllowedError,
  NotAcceptableError,
  NotFoundError,
  PayloadTooLargeError,
  PaymentRequiredError,
  PreconditionFailedError,
  PreconditionRequiredError,
  ProxyAuthRequiredError,
  RangeNotSatisfiableError,
  RequestHeaderFieldsTooLargeError,
  RequestTimeoutError,
  TooEarlyError,
  TooManyRequestsError,
  UnauthorizedError,
  UnavailableForLegalReasonsError,
  UnprocessableEntityError,
  UnsupportedMediaTypeError,
  UpgradeRequiredError,
  UriTooLongError,
  type HttpErrorOptions,
} from './http-errors';

// HTTP errors - 5xx
export {
  BadGatewayError,
  GatewayTimeoutError,
  HttpVersionNotSupportedError,
  InsufficientStorageError,
  InternalServerError,
  LoopDetectedError,
  NetworkAuthRequiredError,
  NotExtendedError,
  NotImplementedError,
  ServiceUnavailableError,
  VariantAlsoNegotiatesError,
} from './http-errors';

// Validation errors
export {
  InvalidEmailError,
  InvalidUrlError,
  LengthError,
  PatternError,
  RangeValidationError,
  RequiredFieldError,
  TypeMismatchError,
  ValidationError,
  type ValidationIssue,
} from './validation';

// Factory functions
export {
  badGateway,
  badRequest,
  conflict,
  createError,
  forbidden,
  gatewayTimeout,
  getErrorStatus,
  getSafeErrorMessage,
  internalError,
  isHttpError,
  methodNotAllowed,
  notFound,
  serviceUnavailable,
  tooManyRequests,
  unauthorized,
  unprocessableEntity,
} from './factory';

// Middleware
export { errorHandler, notFoundHandler, type ErrorHandlerOptions } from './middleware';

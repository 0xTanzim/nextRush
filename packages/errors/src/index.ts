/**
 * @nextrush/errors
 *
 * Standardized error handling for NextRush framework.
 *
 * @packageDocumentation
 */

// Base classes
export { HttpError, NextRushError } from './base';

// HTTP errors - 4xx
export {
    BadRequestError, ConflictError, ExpectationFailedError, FailedDependencyError, ForbiddenError, GoneError, ImATeapotError, LengthRequiredError, LockedError, MethodNotAllowedError,
    NotAcceptableError, NotFoundError, PayloadTooLargeError, PaymentRequiredError, PreconditionFailedError, PreconditionRequiredError, ProxyAuthRequiredError, RangeNotSatisfiableError, RequestHeaderFieldsTooLargeError, RequestTimeoutError, TooEarlyError, TooManyRequestsError, UnauthorizedError, UnavailableForLegalReasonsError, UnprocessableEntityError, UnsupportedMediaTypeError, UpgradeRequiredError, UriTooLongError, type HttpErrorOptions
} from './http-errors';

// HTTP errors - 5xx
export {
    BadGatewayError, GatewayTimeoutError,
    HttpVersionNotSupportedError, InsufficientStorageError, InternalServerError, LoopDetectedError, NetworkAuthRequiredError, NotExtendedError, NotImplementedError, ServiceUnavailableError, VariantAlsoNegotiatesError
} from './http-errors';

// Validation errors
export {
    InvalidEmailError,
    InvalidUrlError, LengthError,
    PatternError, RangeError, RequiredFieldError,
    TypeMismatchError, ValidationError, type ValidationIssue
} from './validation';

// Factory functions
export {
    badGateway, badRequest, conflict, createError, forbidden, gatewayTimeout, getErrorStatus,
    getSafeErrorMessage, internalError, isHttpError, methodNotAllowed, notFound, serviceUnavailable, tooManyRequests, unauthorized, unprocessableEntity
} from './factory';

// Middleware
export {
    catchAsync, errorHandler,
    notFoundHandler, type ErrorContext, type ErrorHandlerOptions, type ErrorMiddleware
} from './middleware';

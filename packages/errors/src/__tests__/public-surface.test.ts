/**
 * @nextrush/errors - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as errorsApi from '../index';
import type { ErrorHandlerOptions } from '../index';
import type { HttpErrorOptions } from '../index';
import type { ValidationIssue } from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(errorsApi).sort();

    // SEALED: intentional public runtime API surface.
    const expectedRuntime = [
      // Base classes + helper
      'HttpError',
      'NextRushError',
      'getHttpStatusMessage',

      // Header validation
      'HeaderValidationError',

      // Central error-code registry
      'ERROR_CODES',
      'GENERIC_ERROR_CODE',
      'VALIDATION_ERROR_CODE',
      'codeForStatus',

      // HTTP errors — 4xx
      'BadRequestError',
      'ConflictError',
      'ExpectationFailedError',
      'FailedDependencyError',
      'ForbiddenError',
      'GoneError',
      'ImATeapotError',
      'LengthRequiredError',
      'LockedError',
      'MethodNotAllowedError',
      'NotAcceptableError',
      'NotFoundError',
      'PayloadTooLargeError',
      'PaymentRequiredError',
      'PreconditionFailedError',
      'PreconditionRequiredError',
      'ProxyAuthRequiredError',
      'RangeNotSatisfiableError',
      'RequestHeaderFieldsTooLargeError',
      'RequestTimeoutError',
      'TooEarlyError',
      'TooManyRequestsError',
      'UnauthorizedError',
      'UnavailableForLegalReasonsError',
      'UnprocessableEntityError',
      'UnsupportedMediaTypeError',
      'UpgradeRequiredError',
      'UriTooLongError',

      // HTTP errors — 5xx
      'BadGatewayError',
      'GatewayTimeoutError',
      'HttpVersionNotSupportedError',
      'InsufficientStorageError',
      'InternalServerError',
      'LoopDetectedError',
      'NetworkAuthRequiredError',
      'NotExtendedError',
      'NotImplementedError',
      'ServiceUnavailableError',
      'VariantAlsoNegotiatesError',

      // Validation errors
      'InvalidEmailError',
      'InvalidUrlError',
      'LengthError',
      'PatternError',
      'RangeValidationError',
      'RequiredFieldError',
      'TypeMismatchError',
      'ValidationError',

      // Factory functions
      'badGateway',
      'badRequest',
      'conflict',
      'createError',
      'forbidden',
      'gatewayTimeout',
      'getErrorStatus',
      'getSafeErrorMessage',
      'internalError',
      'isHttpError',
      'methodNotAllowed',
      'notFound',
      'serviceUnavailable',
      'tooManyRequests',
      'unauthorized',
      'unprocessableEntity',

      // Middleware
      'errorHandler',
      'notFoundHandler',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [HttpErrorOptions, ValidationIssue, ErrorHandlerOptions];
    expectTypeOf<Surface>().not.toBeNever();
  });
});

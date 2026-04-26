/**
 * @nextrush/errors - HTTP Error Classes
 *
 * Standard HTTP error classes for common status codes.
 *
 * @packageDocumentation
 */

import { HttpError } from './base';

/**
 * Options for creating HTTP errors
 */
export interface HttpErrorOptions {
  code?: string;
  expose?: boolean;
  details?: Record<string, unknown>;
  cause?: unknown;
}

// =============================================================================
// 4xx Client Errors
// =============================================================================

/**
 * 400 Bad Request - Invalid syntax or malformed request
 */
export class BadRequestError extends HttpError {
  constructor(message = 'Bad Request', options: HttpErrorOptions = {}) {
    super(400, message, { code: 'BAD_REQUEST', ...options });
  }
}

/**
 * 401 Unauthorized - Authentication required
 */
export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized', options: HttpErrorOptions = {}) {
    super(401, message, { code: 'UNAUTHORIZED', ...options });
  }
}

/**
 * 402 Payment Required - Payment needed
 */
export class PaymentRequiredError extends HttpError {
  constructor(message = 'Payment Required', options: HttpErrorOptions = {}) {
    super(402, message, { code: 'PAYMENT_REQUIRED', ...options });
  }
}

/**
 * 403 Forbidden - Access denied
 */
export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden', options: HttpErrorOptions = {}) {
    super(403, message, { code: 'FORBIDDEN', ...options });
  }
}

/**
 * 404 Not Found - Resource not found
 */
export class NotFoundError extends HttpError {
  constructor(message = 'Not Found', options: HttpErrorOptions = {}) {
    super(404, message, { code: 'NOT_FOUND', ...options });
  }
}

/**
 * 405 Method Not Allowed - HTTP method not supported
 */
export class MethodNotAllowedError extends HttpError {
  readonly allowedMethods: string[];

  constructor(
    allowedMethods: string[] = [],
    message = 'Method Not Allowed',
    options: HttpErrorOptions = {}
  ) {
    super(405, message, {
      code: 'METHOD_NOT_ALLOWED',
      details: { allowedMethods },
      ...options,
    });
    this.allowedMethods = allowedMethods;
  }
}

/**
 * 406 Not Acceptable - Cannot produce acceptable response
 */
export class NotAcceptableError extends HttpError {
  constructor(message = 'Not Acceptable', options: HttpErrorOptions = {}) {
    super(406, message, { code: 'NOT_ACCEPTABLE', ...options });
  }
}

/**
 * 407 Proxy Authentication Required
 */
export class ProxyAuthRequiredError extends HttpError {
  constructor(message = 'Proxy Authentication Required', options: HttpErrorOptions = {}) {
    super(407, message, { code: 'PROXY_AUTH_REQUIRED', ...options });
  }
}

/**
 * 408 Request Timeout - Client took too long
 */
export class RequestTimeoutError extends HttpError {
  constructor(message = 'Request Timeout', options: HttpErrorOptions = {}) {
    super(408, message, { code: 'REQUEST_TIMEOUT', ...options });
  }
}

/**
 * 409 Conflict - Request conflicts with current state
 */
export class ConflictError extends HttpError {
  constructor(message = 'Conflict', options: HttpErrorOptions = {}) {
    super(409, message, { code: 'CONFLICT', ...options });
  }
}

/**
 * 410 Gone - Resource permanently deleted
 */
export class GoneError extends HttpError {
  constructor(message = 'Gone', options: HttpErrorOptions = {}) {
    super(410, message, { code: 'GONE', ...options });
  }
}

/**
 * 411 Length Required - Content-Length header required
 */
export class LengthRequiredError extends HttpError {
  constructor(message = 'Length Required', options: HttpErrorOptions = {}) {
    super(411, message, { code: 'LENGTH_REQUIRED', ...options });
  }
}

/**
 * 412 Precondition Failed - Precondition in headers not met
 */
export class PreconditionFailedError extends HttpError {
  constructor(message = 'Precondition Failed', options: HttpErrorOptions = {}) {
    super(412, message, { code: 'PRECONDITION_FAILED', ...options });
  }
}

/**
 * 413 Payload Too Large - Request body too large
 */
export class PayloadTooLargeError extends HttpError {
  constructor(message = 'Payload Too Large', options: HttpErrorOptions = {}) {
    super(413, message, { code: 'PAYLOAD_TOO_LARGE', ...options });
  }
}

/**
 * 414 URI Too Long - Request URI too long
 */
export class UriTooLongError extends HttpError {
  constructor(message = 'URI Too Long', options: HttpErrorOptions = {}) {
    super(414, message, { code: 'URI_TOO_LONG', ...options });
  }
}

/**
 * 415 Unsupported Media Type - Content type not supported
 */
export class UnsupportedMediaTypeError extends HttpError {
  constructor(message = 'Unsupported Media Type', options: HttpErrorOptions = {}) {
    super(415, message, { code: 'UNSUPPORTED_MEDIA_TYPE', ...options });
  }
}

/**
 * 416 Range Not Satisfiable - Cannot satisfy Range header
 */
export class RangeNotSatisfiableError extends HttpError {
  constructor(message = 'Range Not Satisfiable', options: HttpErrorOptions = {}) {
    super(416, message, { code: 'RANGE_NOT_SATISFIABLE', ...options });
  }
}

/**
 * 417 Expectation Failed - Cannot meet Expect header
 */
export class ExpectationFailedError extends HttpError {
  constructor(message = 'Expectation Failed', options: HttpErrorOptions = {}) {
    super(417, message, { code: 'EXPECTATION_FAILED', ...options });
  }
}

/**
 * 418 I'm a Teapot - RFC 2324
 */
export class ImATeapotError extends HttpError {
  constructor(message = "I'm a teapot", options: HttpErrorOptions = {}) {
    super(418, message, { code: 'IM_A_TEAPOT', ...options });
  }
}

/**
 * 422 Unprocessable Entity - Semantic errors
 */
export class UnprocessableEntityError extends HttpError {
  constructor(message = 'Unprocessable Entity', options: HttpErrorOptions = {}) {
    super(422, message, { code: 'UNPROCESSABLE_ENTITY', ...options });
  }
}

/**
 * 423 Locked - Resource is locked
 */
export class LockedError extends HttpError {
  constructor(message = 'Locked', options: HttpErrorOptions = {}) {
    super(423, message, { code: 'LOCKED', ...options });
  }
}

/**
 * 424 Failed Dependency - Dependent request failed
 */
export class FailedDependencyError extends HttpError {
  constructor(message = 'Failed Dependency', options: HttpErrorOptions = {}) {
    super(424, message, { code: 'FAILED_DEPENDENCY', ...options });
  }
}

/**
 * 425 Too Early - Request replayed too early
 */
export class TooEarlyError extends HttpError {
  constructor(message = 'Too Early', options: HttpErrorOptions = {}) {
    super(425, message, { code: 'TOO_EARLY', ...options });
  }
}

/**
 * 426 Upgrade Required - Client should upgrade protocol
 */
export class UpgradeRequiredError extends HttpError {
  constructor(message = 'Upgrade Required', options: HttpErrorOptions = {}) {
    super(426, message, { code: 'UPGRADE_REQUIRED', ...options });
  }
}

/**
 * 428 Precondition Required - Origin server requires conditional request
 */
export class PreconditionRequiredError extends HttpError {
  constructor(message = 'Precondition Required', options: HttpErrorOptions = {}) {
    super(428, message, { code: 'PRECONDITION_REQUIRED', ...options });
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class TooManyRequestsError extends HttpError {
  readonly retryAfter?: number;

  constructor(
    message = 'Too Many Requests',
    options: HttpErrorOptions & { retryAfter?: number } = {}
  ) {
    super(429, message, {
      code: 'TOO_MANY_REQUESTS',
      details: options.retryAfter ? { retryAfter: options.retryAfter } : undefined,
      ...options,
    });
    this.retryAfter = options.retryAfter;
  }
}

/**
 * 431 Request Header Fields Too Large
 */
export class RequestHeaderFieldsTooLargeError extends HttpError {
  constructor(message = 'Request Header Fields Too Large', options: HttpErrorOptions = {}) {
    super(431, message, { code: 'REQUEST_HEADER_FIELDS_TOO_LARGE', ...options });
  }
}

/**
 * 451 Unavailable For Legal Reasons
 */
export class UnavailableForLegalReasonsError extends HttpError {
  constructor(message = 'Unavailable For Legal Reasons', options: HttpErrorOptions = {}) {
    super(451, message, { code: 'UNAVAILABLE_FOR_LEGAL_REASONS', ...options });
  }
}

// =============================================================================
// 5xx Server Errors
// =============================================================================

/**
 * 500 Internal Server Error - Generic server error
 */
export class InternalServerError extends HttpError {
  constructor(message = 'Internal Server Error', options: HttpErrorOptions = {}) {
    super(500, message, { code: 'INTERNAL_SERVER_ERROR', expose: false, ...options });
  }
}

/**
 * 501 Not Implemented - Feature not implemented
 */
export class NotImplementedError extends HttpError {
  constructor(message = 'Not Implemented', options: HttpErrorOptions = {}) {
    super(501, message, { code: 'NOT_IMPLEMENTED', expose: false, ...options });
  }
}

/**
 * 502 Bad Gateway - Invalid upstream response
 */
export class BadGatewayError extends HttpError {
  constructor(message = 'Bad Gateway', options: HttpErrorOptions = {}) {
    super(502, message, { code: 'BAD_GATEWAY', expose: false, ...options });
  }
}

/**
 * 503 Service Unavailable - Server temporarily unavailable
 */
export class ServiceUnavailableError extends HttpError {
  readonly retryAfter?: number;

  constructor(
    message = 'Service Unavailable',
    options: HttpErrorOptions & { retryAfter?: number } = {}
  ) {
    super(503, message, {
      code: 'SERVICE_UNAVAILABLE',
      expose: false,
      ...options,
    });
    this.retryAfter = options.retryAfter;
  }
}

/**
 * 504 Gateway Timeout - Upstream timeout
 */
export class GatewayTimeoutError extends HttpError {
  constructor(message = 'Gateway Timeout', options: HttpErrorOptions = {}) {
    super(504, message, { code: 'GATEWAY_TIMEOUT', expose: false, ...options });
  }
}

/**
 * 505 HTTP Version Not Supported
 */
export class HttpVersionNotSupportedError extends HttpError {
  constructor(message = 'HTTP Version Not Supported', options: HttpErrorOptions = {}) {
    super(505, message, { code: 'HTTP_VERSION_NOT_SUPPORTED', expose: false, ...options });
  }
}

/**
 * 506 Variant Also Negotiates
 */
export class VariantAlsoNegotiatesError extends HttpError {
  constructor(message = 'Variant Also Negotiates', options: HttpErrorOptions = {}) {
    super(506, message, { code: 'VARIANT_ALSO_NEGOTIATES', expose: false, ...options });
  }
}

/**
 * 507 Insufficient Storage
 */
export class InsufficientStorageError extends HttpError {
  constructor(message = 'Insufficient Storage', options: HttpErrorOptions = {}) {
    super(507, message, { code: 'INSUFFICIENT_STORAGE', expose: false, ...options });
  }
}

/**
 * 508 Loop Detected
 */
export class LoopDetectedError extends HttpError {
  constructor(message = 'Loop Detected', options: HttpErrorOptions = {}) {
    super(508, message, { code: 'LOOP_DETECTED', expose: false, ...options });
  }
}

/**
 * 510 Not Extended
 */
export class NotExtendedError extends HttpError {
  constructor(message = 'Not Extended', options: HttpErrorOptions = {}) {
    super(510, message, { code: 'NOT_EXTENDED', expose: false, ...options });
  }
}

/**
 * 511 Network Authentication Required
 */
export class NetworkAuthRequiredError extends HttpError {
  constructor(message = 'Network Authentication Required', options: HttpErrorOptions = {}) {
    super(511, message, { code: 'NETWORK_AUTH_REQUIRED', expose: false, ...options });
  }
}

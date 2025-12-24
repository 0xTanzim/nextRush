/**
 * Custom error classes for NextRush v2
 *
 * @packageDocumentation
 */

/**
 * Base error class for NextRush v2
 */
export class NextRushError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_SERVER_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'NextRushError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NextRushError);
    }
  }

  /**
   * Create error from HTTP status code
   */
  public static fromStatusCode(
    statusCode: number,
    message?: string
  ): NextRushError {
    const defaultMessages: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      405: 'Method Not Allowed',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout',
    };

    return new NextRushError(
      message || defaultMessages[statusCode] || 'Unknown Error',
      statusCode,
      this.getErrorCode(statusCode)
    );
  }

  /**
   * Get error code from status code
   */
  private static getErrorCode(statusCode: number): string {
    const errorCodes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      405: 'METHOD_NOT_ALLOWED',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
      504: 'GATEWAY_TIMEOUT',
    };

    return errorCodes[statusCode] || 'UNKNOWN_ERROR';
  }

  /**
   * Convert error to JSON
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}

/**
 * Plugin-specific error class
 */
export class PluginError extends NextRushError {
  public readonly pluginName: string;

  constructor(
    message: string,
    pluginName: string = 'unknown',
    statusCode: number = 500
  ) {
    super(message, statusCode, 'PLUGIN_ERROR');
    this.name = 'PluginError';
    this.pluginName = pluginName;
  }

  /**
   * Create plugin error for installation issues
   */
  public static installationFailed(
    pluginName: string,
    reason: string
  ): PluginError {
    return new PluginError(
      `Plugin ${pluginName} installation failed: ${reason}`,
      pluginName,
      500
    );
  }

  /**
   * Create plugin error for configuration issues
   */
  public static configurationError(
    pluginName: string,
    field: string,
    value: unknown
  ): PluginError {
    return new PluginError(
      `Plugin ${pluginName} configuration error: Invalid ${field} = ${value}`,
      pluginName,
      500
    );
  }

  /**
   * Create plugin error for dependency issues
   */
  public static dependencyError(
    pluginName: string,
    dependency: string
  ): PluginError {
    return new PluginError(
      `Plugin ${pluginName} dependency error: Missing ${dependency}`,
      pluginName,
      500
    );
  }
}

/**
 * Bad Request Error (400)
 */
export class BadRequestError extends NextRushError {
  constructor(message: string = 'Bad Request') {
    super(message, 400, 'BAD_REQUEST');
  }
}

/**
 * Unauthorized Error (401)
 */
export class UnauthorizedError extends NextRushError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/**
 * Forbidden Error (403)
 */
export class ForbiddenError extends NextRushError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends NextRushError {
  constructor(message: string = 'Not Found') {
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * Method Not Allowed Error (405)
 */
export class MethodNotAllowedError extends NextRushError {
  constructor(message: string = 'Method Not Allowed') {
    super(message, 405, 'METHOD_NOT_ALLOWED');
  }
}

/**
 * Conflict Error (409)
 */
export class ConflictError extends NextRushError {
  constructor(message: string = 'Conflict') {
    super(message, 409, 'CONFLICT');
  }
}

/**
 * Unprocessable Entity Error (422)
 */
export class UnprocessableEntityError extends NextRushError {
  constructor(message: string = 'Unprocessable Entity') {
    super(message, 422, 'UNPROCESSABLE_ENTITY');
  }
}

/**
 * Too Many Requests Error (429)
 */
export class TooManyRequestsError extends NextRushError {
  constructor(message: string = 'Too Many Requests') {
    super(message, 429, 'TOO_MANY_REQUESTS');
  }
}

/**
 * Internal Server Error (500)
 */
export class InternalServerError extends NextRushError {
  constructor(message: string = 'Internal Server Error') {
    super(message, 500, 'INTERNAL_SERVER_ERROR');
  }
}

/**
 * Service Unavailable Error (503)
 */
export class ServiceUnavailableError extends NextRushError {
  constructor(message: string = 'Service Unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

/**
 * Validation Error (400)
 */
export class ValidationError extends NextRushError {
  public readonly field: string;
  public readonly value: unknown;

  constructor(
    message: string,
    field: string = 'unknown',
    value: unknown = undefined,
    statusCode: number = 400
  ) {
    super(message, statusCode, 'VALIDATION_ERROR');
    this.field = field;
    this.value = value;
  }

  /**
   * Create validation error for specific field
   */
  public static forField(
    field: string,
    message: string,
    value?: unknown
  ): ValidationError {
    return new ValidationError(message, field, value);
  }

  /**
   * Create validation error for multiple fields
   */
  public static forFields(
    errors: Array<{ field: string; message: string; value?: unknown }>
  ): ValidationError {
    const message = `Validation failed for ${errors.length} field(s)`;
    const error = new ValidationError(message);
    (error as any).errors = errors;
    return error;
  }
}

/**
 * Authentication Error (401)
 */
export class AuthenticationError extends NextRushError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

/**
 * Authorization Error (403)
 */
export class AuthorizationError extends NextRushError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

/**
 * Database Error (500)
 */
export class DatabaseError extends NextRushError {
  public readonly operation: string;
  public readonly table: string | undefined;

  constructor(
    message: string,
    operation: string = 'unknown',
    table?: string,
    statusCode: number = 500
  ) {
    super(message, statusCode, 'DATABASE_ERROR');
    this.operation = operation;
    this.table = table;
  }
}

/**
 * Network Error (502)
 */
export class NetworkError extends NextRushError {
  public readonly host: string;
  public readonly port: number;

  constructor(message: string, host: string, port: number) {
    super(message, 502, 'NETWORK_ERROR');
    this.host = host;
    this.port = port;
  }
}

/**
 * Timeout Error (408)
 */
export class TimeoutError extends NextRushError {
  constructor(message: string = 'Request timeout') {
    super(message, 408, 'TIMEOUT_ERROR');
  }
}

/**
 * Rate Limit Error (429)
 */
export class RateLimitError extends NextRushError {
  public readonly retryAfter: number;

  constructor(
    message: string = 'Rate limit exceeded',
    retryAfter: number = 60
  ) {
    super(message, 429, 'RATE_LIMIT_ERROR');
    this.retryAfter = retryAfter;
  }
}

/**
 * Error Factory for creating common errors
 */
export class ErrorFactory {
  /**
   * Create validation error
   */
  public static validation(
    field: string,
    message: string,
    value?: unknown
  ): ValidationError {
    return ValidationError.forField(field, message, value);
  }

  /**
   * Create not found error
   */
  public static notFound(resource: string): NotFoundError {
    return new NotFoundError(`${resource} not found`);
  }

  /**
   * Create unauthorized error
   */
  public static unauthorized(message?: string): AuthenticationError {
    return new AuthenticationError(message);
  }

  /**
   * Create forbidden error
   */
  public static forbidden(message?: string): AuthorizationError {
    return new AuthorizationError(message);
  }

  /**
   * Create bad request error
   */
  public static badRequest(message?: string): BadRequestError {
    return new BadRequestError(message);
  }

  /**
   * Create conflict error
   */
  public static conflict(message?: string): ConflictError {
    return new ConflictError(message);
  }

  /**
   * Create internal server error
   */
  public static internal(message?: string): InternalServerError {
    return new InternalServerError(message);
  }

  /**
   * Create rate limit error
   */
  public static rateLimit(
    message?: string,
    retryAfter?: number
  ): RateLimitError {
    return new RateLimitError(message, retryAfter);
  }

  /**
   * Create timeout error
   */
  public static timeout(message?: string): TimeoutError {
    return new TimeoutError(message);
  }

  /**
   * Create service unavailable error
   */
  public static serviceUnavailable(message?: string): ServiceUnavailableError {
    return new ServiceUnavailableError(message);
  }

  /**
   * Create database error
   */
  public static database(
    message: string,
    operation: string,
    table?: string
  ): DatabaseError {
    return new DatabaseError(message, operation, table);
  }

  /**
   * Create network error
   */
  public static network(
    message: string,
    host: string,
    port: number
  ): NetworkError {
    return new NetworkError(message, host, port);
  }
}

/**
 * Exception Filter Interface (NestJS style)
 */
export interface ExceptionFilter {
  catch(error: Error, ctx: any): void | Promise<void>;
}

/**
 * Global Exception Filter
 */
export class GlobalExceptionFilter implements ExceptionFilter {
  async catch(error: Error, ctx: any): Promise<void> {
    let statusCode = 500;
    let message = 'Internal Server Error';
    let code = 'INTERNAL_SERVER_ERROR';

    // Handle NextRush errors
    if (error instanceof NextRushError) {
      statusCode = error.statusCode;
      message = error.message;
      code = error.code;
    }

    // Handle common Node.js errors
    if (error instanceof SyntaxError) {
      statusCode = 400;
      message = 'Invalid JSON';
      code = 'INVALID_JSON';
    }

    // Set response
    ctx.status = statusCode;
    ctx.res.json({
      error: {
        name: error.constructor.name,
        message,
        code,
        statusCode,
        timestamp: new Date().toISOString(),
        path: ctx.path,
        method: ctx.method,
        requestId: ctx.id,
      },
    });
  }
}

/**
 * Exception Filter Decorator (NestJS style)
 */
export function Catch(...exceptions: Array<new (...args: any[]) => Error>) {
  return function (target: any) {
    target.exceptions = exceptions;
  };
}

/**
 * Exception Filter for specific error types
 */
@Catch(ValidationError, BadRequestError)
export class ValidationExceptionFilter implements ExceptionFilter {
  async catch(error: Error, ctx: any): Promise<void> {
    // Handle ValidationError with proper field and value
    if (error instanceof ValidationError) {
      ctx.status = error.statusCode;
      ctx.res.json({
        error: {
          name: 'ValidationError',
          message: error.message,
          code: error.code,
          statusCode: error.statusCode,
          timestamp: new Date().toISOString(),
          field: error.field,
          value: error.value,
        },
      });
      return;
    }

    // Handle BadRequestError
    if (error instanceof BadRequestError) {
      ctx.status = error.statusCode;
      ctx.res.json({
        error: {
          name: 'BadRequestError',
          message: error.message,
          code: error.code,
          statusCode: error.statusCode,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Check if it's a NextRushError with VALIDATION_ERROR code (from body parser)
    if (error instanceof NextRushError && error.code === 'VALIDATION_ERROR') {
      ctx.status = error.statusCode;
      ctx.res.json({
        error: {
          name: 'ValidationError',
          message: error.message,
          code: error.code,
          statusCode: error.statusCode,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Fallback for other errors
    ctx.status = 400;
    ctx.res.json({
      error: {
        name: 'ValidationError',
        message: error.message,
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Exception Filter for authentication errors
 */
@Catch(AuthenticationError, UnauthorizedError)
export class AuthenticationExceptionFilter implements ExceptionFilter {
  async catch(error: Error, ctx: any): Promise<void> {
    ctx.status = 401;
    ctx.res.json({
      error: {
        name: 'AuthenticationError',
        message: error.message,
        code: 'AUTHENTICATION_ERROR',
        statusCode: 401,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Exception Filter for authorization errors
 */
@Catch(AuthorizationError, ForbiddenError)
export class AuthorizationExceptionFilter implements ExceptionFilter {
  async catch(error: Error, ctx: any): Promise<void> {
    ctx.status = 403;
    ctx.res.json({
      error: {
        name: 'AuthorizationError',
        message: error.message,
        code: 'AUTHORIZATION_ERROR',
        statusCode: 403,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Exception Filter for not found errors
 */
@Catch(NotFoundError)
export class NotFoundExceptionFilter implements ExceptionFilter {
  async catch(error: Error, ctx: any): Promise<void> {
    ctx.status = 404;
    ctx.res.json({
      error: {
        name: 'NotFoundError',
        message: error.message,
        code: 'NOT_FOUND',
        statusCode: 404,
        timestamp: new Date().toISOString(),
        path: ctx.path,
        method: ctx.method,
        requestId: ctx.id,
      },
    });
  }
}

/**
 * Exception Filter for bad request errors
 */
@Catch(BadRequestError)
export class BadRequestExceptionFilter implements ExceptionFilter {
  async catch(error: Error, ctx: any): Promise<void> {
    ctx.status = 400;
    ctx.res.json({
      error: {
        name: 'BadRequestError',
        message: error.message,
        code: 'BAD_REQUEST',
        statusCode: 400,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Exception Filter for conflict errors
 */
@Catch(ConflictError)
export class ConflictExceptionFilter implements ExceptionFilter {
  async catch(error: Error, ctx: any): Promise<void> {
    ctx.status = 409;
    ctx.res.json({
      error: {
        name: 'ConflictError',
        message: error.message,
        code: 'CONFLICT',
        statusCode: 409,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Exception Filter for rate limit errors
 */
@Catch(RateLimitError, TooManyRequestsError)
export class RateLimitExceptionFilter implements ExceptionFilter {
  async catch(error: Error, ctx: any): Promise<void> {
    const retryAfter = (error as RateLimitError).retryAfter || 60;

    ctx.status = 429;
    ctx.res.setHeader('retry-after', retryAfter.toString());
    ctx.res.setHeader('Retry-After', retryAfter.toString());
    ctx.res.json({
      error: {
        name: 'RateLimitError',
        message: error.message,
        code: 'RATE_LIMIT_ERROR',
        statusCode: 429,
        timestamp: new Date().toISOString(),
        retryAfter,
      },
    });
  }
}

/**
 * Custom error classes for NextRush v2
 * 
 * @packageDocumentation
 */

/**
 * Base error class for NextRush
 */
export class NextRushError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_SERVER_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Create error from HTTP status code
   */
  public static fromStatusCode(statusCode: number, message?: string): NextRushError {
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
      504: 'Gateway Timeout'
    };

    const errorMessage = message || defaultMessages[statusCode] || 'Unknown Error';
    const errorCode = this.getErrorCode(statusCode);

    return new NextRushError(errorMessage, statusCode, errorCode);
  }

  /**
   * Get error code from status code
   */
  private static getErrorCode(statusCode: number): string {
    const codeMap: Record<number, string> = {
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
      504: 'GATEWAY_TIMEOUT'
    };

    return codeMap[statusCode] || 'UNKNOWN_ERROR';
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
      stack: this.stack
    };
  }
}

/**
 * Validation error for invalid input
 */
export class ValidationError extends NextRushError {
  public field: string;
  public value: unknown;

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
   * Create validation error for a specific field
   */
  public static forField(field: string, message: string, value?: unknown): ValidationError {
    return new ValidationError(message, field, value);
  }

  /**
   * Create validation error for multiple fields
   */
  public static forFields(errors: Array<{ field: string; message: string; value?: unknown }>): ValidationError {
    const message = `Validation failed for ${errors.length} field(s)`;
    const error = new ValidationError(message);
    error.field = errors.map(e => e.field).join(', ');
    error.value = errors;
    return error;
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends NextRushError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends NextRushError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

/**
 * Not found error
 */
export class NotFoundError extends NextRushError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND_ERROR');
  }
}

/**
 * Bad request error
 */
export class BadRequestError extends NextRushError {
  constructor(message: string = 'Bad request') {
    super(message, 400, 'BAD_REQUEST_ERROR');
  }
}

/**
 * Conflict error
 */
export class ConflictError extends NextRushError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

/**
 * Unprocessable entity error
 */
export class UnprocessableEntityError extends NextRushError {
  constructor(message: string = 'Unprocessable entity') {
    super(message, 422, 'UNPROCESSABLE_ENTITY_ERROR');
  }
}

/**
 * Internal server error
 */
export class InternalServerError extends NextRushError {
  constructor(message: string = 'Internal server error') {
    super(message, 500, 'INTERNAL_SERVER_ERROR');
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends NextRushError {
  public readonly retryAfter: number;

  constructor(message: string = 'Rate limit exceeded', retryAfter: number = 60) {
    super(message, 429, 'RATE_LIMIT_ERROR');
    this.retryAfter = retryAfter;
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends NextRushError {
  constructor(message: string = 'Request timeout') {
    super(message, 408, 'TIMEOUT_ERROR');
  }
}

/**
 * Service unavailable error
 */
export class ServiceUnavailableError extends NextRushError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE_ERROR');
  }
}

/**
 * Database error
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
 * Network error
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
 * Plugin error
 */
export class PluginError extends NextRushError {
  public readonly pluginName: string;
  public readonly pluginVersion: string;

  constructor(
    message: string,
    pluginName: string,
    pluginVersion: string = 'unknown'
  ) {
    super(message, 500, 'PLUGIN_ERROR');
    this.pluginName = pluginName;
    this.pluginVersion = pluginVersion;
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends NextRushError {
  public readonly configKey: string;

  constructor(message: string, configKey: string = 'unknown') {
    super(message, 500, 'CONFIGURATION_ERROR');
    this.configKey = configKey;
  }
}

/**
 * Error factory for creating errors with consistent formatting
 */
export class ErrorFactory {
  /**
   * Create a validation error
   */
  public static validation(field: string, message: string, value?: unknown): ValidationError {
    return ValidationError.forField(field, message, value);
  }

  /**
   * Create a not found error
   */
  public static notFound(resource: string): NotFoundError {
    return new NotFoundError(resource);
  }

  /**
   * Create an authentication error
   */
  public static unauthorized(message?: string): AuthenticationError {
    return new AuthenticationError(message);
  }

  /**
   * Create an authorization error
   */
  public static forbidden(message?: string): AuthorizationError {
    return new AuthorizationError(message);
  }

  /**
   * Create a bad request error
   */
  public static badRequest(message?: string): BadRequestError {
    return new BadRequestError(message);
  }

  /**
   * Create a conflict error
   */
  public static conflict(message?: string): ConflictError {
    return new ConflictError(message);
  }

  /**
   * Create an internal server error
   */
  public static internal(message?: string): InternalServerError {
    return new InternalServerError(message);
  }

  /**
   * Create a rate limit error
   */
  public static rateLimit(message?: string, retryAfter?: number): RateLimitError {
    return new RateLimitError(message, retryAfter);
  }

  /**
   * Create a timeout error
   */
  public static timeout(message?: string): TimeoutError {
    return new TimeoutError(message);
  }

  /**
   * Create a service unavailable error
   */
  public static serviceUnavailable(message?: string): ServiceUnavailableError {
    return new ServiceUnavailableError(message);
  }

  /**
   * Create a database error
   */
  public static database(message: string, operation: string, table?: string): DatabaseError {
    return new DatabaseError(message, operation, table);
  }

  /**
   * Create a network error
   */
  public static network(message: string, host: string, port: number): NetworkError {
    return new NetworkError(message, host, port);
  }

  /**
   * Create a plugin error
   */
  public static plugin(message: string, pluginName: string, pluginVersion?: string): PluginError {
    return new PluginError(message, pluginName, pluginVersion);
  }

  /**
   * Create a configuration error
   */
  public static configuration(message: string, configKey: string): ConfigurationError {
    return new ConfigurationError(message, configKey);
  }
} 
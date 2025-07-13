/**
 * Custom error classes for the framework
 */

export abstract class NextRushError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details ?? {};
    this.timestamp = new Date();

    // Maintain proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}

export class ValidationError extends NextRushError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class NotFoundError extends NextRushError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}

export class MethodNotAllowedError extends NextRushError {
  constructor(method: string, allowedMethods: string[] = []) {
    super(`Method ${method} not allowed`, 'METHOD_NOT_ALLOWED', 405, {
      method,
      allowedMethods,
    });
  }
}

export class RequestTimeoutError extends NextRushError {
  constructor(timeout: number) {
    super(`Request timeout after ${timeout}ms`, 'REQUEST_TIMEOUT', 408, {
      timeout,
    });
  }
}

export class PayloadTooLargeError extends NextRushError {
  constructor(maxSize: number, actualSize?: number) {
    super(
      `Payload too large. Max: ${maxSize} bytes`,
      'PAYLOAD_TOO_LARGE',
      413,
      { maxSize, actualSize }
    );
  }
}

export class UnsupportedMediaTypeError extends NextRushError {
  constructor(contentType: string, supportedTypes: string[] = []) {
    super(
      `Unsupported content type: ${contentType}`,
      'UNSUPPORTED_MEDIA_TYPE',
      415,
      { contentType, supportedTypes }
    );
  }
}

export class InternalServerError extends NextRushError {
  constructor(
    message: string = 'Internal server error',
    details?: Record<string, unknown>
  ) {
    super(message, 'INTERNAL_SERVER_ERROR', 500, details);
  }
}

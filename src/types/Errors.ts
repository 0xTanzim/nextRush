export class ZestfxError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ZestfxError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Ensure the stack trace points to where the error was thrown
    Error.captureStackTrace(this, ZestfxError);
  }
}

export class ValidationError extends ZestfxError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ZestfxError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class MethodNotAllowedError extends ZestfxError {
  constructor(method: string, allowedMethods: string[] = []) {
    super(`Method ${method} not allowed`, 'METHOD_NOT_ALLOWED', 405, {
      allowedMethods,
    });
    this.name = 'MethodNotAllowedError';
  }
}

export class PayloadTooLargeError extends ZestfxError {
  constructor(maxSize: number, actualSize: number) {
    super(
      `Payload too large. Max: ${maxSize} bytes, Received: ${actualSize} bytes`,
      'PAYLOAD_TOO_LARGE',
      413,
      { maxSize, actualSize }
    );
    this.name = 'PayloadTooLargeError';
  }
}

export class UnsupportedMediaTypeError extends ZestfxError {
  constructor(contentType: string, supportedTypes: string[] = []) {
    super(
      `Unsupported media type: ${contentType}`,
      'UNSUPPORTED_MEDIA_TYPE',
      415,
      { contentType, supportedTypes }
    );
    this.name = 'UnsupportedMediaTypeError';
  }
}

export class TimeoutError extends ZestfxError {
  constructor(operation: string, timeout: number) {
    super(
      `Operation '${operation}' timed out after ${timeout}ms`,
      'TIMEOUT',
      408,
      { operation, timeout }
    );
    this.name = 'TimeoutError';
  }
}

export class FileSystemError extends ZestfxError {
  constructor(operation: string, path: string, originalError?: Error) {
    super(
      `File system error during ${operation}: ${path}`,
      'FILE_SYSTEM_ERROR',
      500,
      { operation, path, originalError: originalError?.message }
    );
    this.name = 'FileSystemError';
  }
}

export class RouteError extends ZestfxError {
  constructor(message: string, route?: string) {
    super(message, 'ROUTE_ERROR', 500, { route });
    this.name = 'RouteError';
  }
}

/**
 * @nextrush/core - Error Classes
 *
 * Base error classes for NextRush framework.
 * These provide structured error handling with HTTP status codes.
 *
 * @packageDocumentation
 */

import { HttpStatus } from '@nextrush/types';

/**
 * Base error class for all NextRush errors
 */
export class NextRushError extends Error {
  /**
   * HTTP status code
   */
  readonly status: number;

  /**
   * Error code for programmatic handling
   */
  readonly code: string;

  /**
   * Whether this error should be exposed to clients
   */
  readonly expose: boolean;

  constructor(
    message: string,
    status: number = HttpStatus.INTERNAL_SERVER_ERROR,
    code: string = 'ERR_NEXTRUSH',
    expose: boolean = false
  ) {
    super(message);
    this.name = 'NextRushError';
    this.status = status;
    this.code = code;
    this.expose = expose;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON (safe for client response)
   */
  toJSON(): { error: string; code: string; status: number } {
    return {
      error: this.expose ? this.message : 'Internal Server Error',
      code: this.code,
      status: this.status,
    };
  }
}

/**
 * HTTP error with status code
 */
export class HttpError extends NextRushError {
  constructor(status: number, message?: string) {
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
    };

    super(
      message ?? defaultMessages[status] ?? 'Unknown Error',
      status,
      `HTTP_${status}`,
      status < 500 // Expose client errors, not server errors
    );
    this.name = 'HttpError';
  }
}

/**
 * Not Found error (404)
 */
export class NotFoundError extends HttpError {
  constructor(message: string = 'Not Found') {
    super(HttpStatus.NOT_FOUND, message);
    this.name = 'NotFoundError';
  }
}

/**
 * Bad Request error (400)
 */
export class BadRequestError extends HttpError {
  constructor(message: string = 'Bad Request') {
    super(HttpStatus.BAD_REQUEST, message);
    this.name = 'BadRequestError';
  }
}

/**
 * Unauthorized error (401)
 */
export class UnauthorizedError extends HttpError {
  constructor(message: string = 'Unauthorized') {
    super(HttpStatus.UNAUTHORIZED, message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Forbidden error (403)
 */
export class ForbiddenError extends HttpError {
  constructor(message: string = 'Forbidden') {
    super(HttpStatus.FORBIDDEN, message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Internal Server Error (500)
 */
export class InternalServerError extends HttpError {
  constructor(message: string = 'Internal Server Error') {
    super(HttpStatus.INTERNAL_SERVER_ERROR, message);
    this.name = 'InternalServerError';
  }
}

/**
 * Create an HTTP error from status code
 */
export function createHttpError(status: number, message?: string): HttpError {
  return new HttpError(status, message);
}

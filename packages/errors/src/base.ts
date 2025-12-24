/**
 * @nextrush/errors - Base Error Classes
 *
 * Foundational error classes for NextRush framework.
 *
 * @packageDocumentation
 */

/**
 * Base error class for all NextRush errors
 */
export class NextRushError extends Error {
  /** HTTP status code */
  readonly status: number;

  /** Error code for programmatic handling */
  readonly code: string;

  /** Whether error message is safe to expose to client */
  readonly expose: boolean;

  /** Additional error details */
  readonly details?: Record<string, unknown>;

  /** Original error that caused this error */
  readonly cause?: Error;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: string;
      expose?: boolean;
      details?: Record<string, unknown>;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.status = options.status ?? 500;
    this.code = options.code ?? 'INTERNAL_ERROR';
    this.expose = options.expose ?? this.status < 500;
    this.details = options.details;
    this.cause = options.cause;

    // Maintain proper stack trace for V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON representation
   */
  toJSON(): Record<string, unknown> {
    const json: Record<string, unknown> = {
      error: this.name,
      message: this.expose ? this.message : 'Internal Server Error',
      code: this.code,
      status: this.status,
    };

    if (this.expose && this.details) {
      json.details = this.details;
    }

    return json;
  }

  /**
   * Create a response-safe version of the error
   */
  toResponse(): { status: number; body: Record<string, unknown> } {
    return {
      status: this.status,
      body: this.toJSON(),
    };
  }
}

/**
 * Base class for HTTP errors
 */
export class HttpError extends NextRushError {
  constructor(
    status: number,
    message: string,
    options: {
      code?: string;
      expose?: boolean;
      details?: Record<string, unknown>;
      cause?: Error;
    } = {}
  ) {
    super(message, {
      status,
      code: options.code ?? `HTTP_${status}`,
      expose: options.expose ?? status < 500,
      details: options.details,
      cause: options.cause,
    });
  }
}

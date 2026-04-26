/**
 * @nextrush/body-parser - Error Classes
 *
 * Custom error class for body parsing failures.
 *
 * @packageDocumentation
 */

import type { BodyParserErrorCode } from './types.js';

const V8Error = Error as ErrorConstructor & {
  captureStackTrace?: (targetObject: object, constructorOpt?: Function) => void;
};

/**
 * Error thrown when body parsing fails.
 *
 * Includes HTTP status code, error code, and whether
 * the message is safe to expose to clients.
 *
 * @example
 * ```typescript
 * try {
 *   await parseBody(ctx);
 * } catch (err) {
 *   if (err instanceof BodyParserError) {
 *     ctx.status = err.status;
 *     ctx.json({ error: err.message, code: err.code });
 *   }
 * }
 * ```
 */
export class BodyParserError extends Error {
  /**
   * HTTP status code for this error (e.g., 400, 413)
   */
  public readonly status: number;

  /**
   * Machine-readable error code
   */
  public readonly code: BodyParserErrorCode;

  /**
   * Whether the error message is safe to expose to clients.
   * True for client errors (4xx), false for server errors (5xx).
   */
  public readonly expose: boolean;

  /**
   * Create a new BodyParserError
   *
   * @param message - Human-readable error message
   * @param status - HTTP status code
   * @param code - Machine-readable error code
   */
  constructor(message: string, status: number, code: BodyParserErrorCode) {
    super(message);
    this.name = 'BodyParserError';
    this.status = status;
    this.code = code;
    this.expose = status < 500;

    // Maintain proper stack trace in V8 environments
    if (V8Error.captureStackTrace) {
      V8Error.captureStackTrace(this, BodyParserError);
    }
  }

  /**
   * Create a JSON-serializable representation
   */
  toJSON(): {
    name: string;
    message: string;
    status: number;
    code: BodyParserErrorCode;
  } {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
    };
  }
}

/**
 * Factory functions for common errors
 */
export const Errors = {
  /**
   * Body exceeds size limit
   */
  entityTooLarge(received: number, limit: number): BodyParserError {
    return new BodyParserError(
      `Request body too large (${received} bytes exceeds ${limit} byte limit)`,
      413,
      'ENTITY_TOO_LARGE'
    );
  },

  /**
   * Body exceeds size limit (streaming, size unknown)
   */
  entityTooLargeStreaming(limit: number): BodyParserError {
    return new BodyParserError(
      `Request body too large (exceeds ${limit} byte limit)`,
      413,
      'ENTITY_TOO_LARGE'
    );
  },

  /**
   * Invalid JSON syntax
   */
  invalidJson(parseError: string): BodyParserError {
    return new BodyParserError(`Invalid JSON: ${parseError}`, 400, 'INVALID_JSON');
  },

  /**
   * JSON is not object or array in strict mode
   */
  strictModeViolation(): BodyParserError {
    return new BodyParserError(
      'Request body must be a JSON object or array in strict mode',
      400,
      'STRICT_MODE_VIOLATION'
    );
  },

  /**
   * Invalid URL-encoded data
   */
  invalidUrlEncoded(parseError: string): BodyParserError {
    return new BodyParserError(
      `Invalid URL-encoded body: ${parseError}`,
      400,
      'INVALID_URLENCODED'
    );
  },

  /**
   * Too many parameters
   */
  tooManyParameters(count: number, limit: number): BodyParserError {
    return new BodyParserError(
      `Too many parameters (${count} exceeds ${limit} limit)`,
      413,
      'TOO_MANY_PARAMETERS'
    );
  },

  /**
   * Nesting depth exceeded
   */
  depthExceeded(depth: number, maxDepth: number): BodyParserError {
    return new BodyParserError(
      `Nesting depth exceeded (${depth} exceeds ${maxDepth} limit)`,
      400,
      'DEPTH_EXCEEDED'
    );
  },

  /**
   * Invalid parameter name (prototype pollution attempt)
   */
  invalidParameter(name: string): BodyParserError {
    return new BodyParserError(`Invalid parameter name: "${name}"`, 400, 'INVALID_PARAMETER');
  },

  /**
   * Error reading request body stream
   */
  bodyReadError(originalError: string): BodyParserError {
    return new BodyParserError(
      `Error reading request body: ${originalError}`,
      400,
      'BODY_READ_ERROR'
    );
  },

  /**
   * Request connection closed
   */
  requestClosed(): BodyParserError {
    return new BodyParserError(
      'Request connection closed before body was fully received',
      400,
      'REQUEST_CLOSED'
    );
  },

  /**
   * Request aborted by client
   */
  requestAborted(): BodyParserError {
    return new BodyParserError('Request aborted by client', 400, 'REQUEST_ABORTED');
  },

  /**
   * Unsupported charset
   */
  unsupportedCharset(charset: string): BodyParserError {
    return new BodyParserError(`Unsupported charset: "${charset}"`, 415, 'UNSUPPORTED_CHARSET');
  },

  /**
   * JSON nesting depth exceeded
   */
  jsonDepthExceeded(depth: number, maxDepth: number): BodyParserError {
    return new BodyParserError(
      `JSON nesting depth exceeded (${depth} exceeds ${maxDepth} limit)`,
      400,
      'JSON_DEPTH_EXCEEDED'
    );
  },

  /**
   * Unsupported content type (e.g., multipart/form-data)
   */
  unsupportedContentType(contentType: string, hint?: string): BodyParserError {
    const message = hint
      ? `Unsupported content type: "${contentType}". ${hint}`
      : `Unsupported content type: "${contentType}"`;
    return new BodyParserError(message, 415, 'UNSUPPORTED_CONTENT_TYPE');
  },
} as const;

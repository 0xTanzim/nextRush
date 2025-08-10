/**
 * Error Factory for NextRush v2
 *
 * Provides convenient factory methods for creating common HTTP errors
 *
 * @packageDocumentation
 */

import {
  AuthenticationError,
  AuthorizationError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '../custom-errors';

/**
 * Error Factory for creating common HTTP errors
 *
 * @example
 * ```typescript
 * import { ErrorFactory } from '@/errors/error-factory';
 *
 * // Create validation error
 * const error = ErrorFactory.validation('email', 'Invalid email format');
 *
 * // Create not found error
 * const error = ErrorFactory.notFound('User');
 *
 * // Create authentication error
 * const error = ErrorFactory.unauthorized('Token expired');
 * ```
 */
export class ErrorFactory {
  /**
   * Create a validation error
   */
  static validation(
    field: string,
    message: string,
    value?: unknown
  ): ValidationError {
    return new ValidationError(message, field, value);
  }

  /**
   * Create a not found error
   */
  static notFound(resource: string): NotFoundError {
    return new NotFoundError(`${resource} not found`);
  }

  /**
   * Create an authentication error
   */
  static unauthorized(message: string): AuthenticationError {
    return new AuthenticationError(message);
  }

  /**
   * Create an authorization error
   */
  static forbidden(message: string): AuthorizationError {
    return new AuthorizationError(message);
  }

  /**
   * Create a bad request error
   */
  static badRequest(message: string): BadRequestError {
    return new BadRequestError(message);
  }

  /**
   * Create a conflict error
   */
  static conflict(message: string): ConflictError {
    return new ConflictError(message);
  }

  /**
   * Create a rate limit error
   */
  static rateLimit(message: string, retryAfter?: number): RateLimitError {
    return new RateLimitError(message, retryAfter);
  }
}

/**
 * Export ErrorFactory as default for convenience
 */
export default ErrorFactory;

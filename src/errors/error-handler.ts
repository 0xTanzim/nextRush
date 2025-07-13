/**
 * Error handler that processes and formats errors for HTTP responses
 */
import { ParsedResponse, RequestContext } from '../types/http';
import { InternalServerError, NextRushError } from './custom-errors';

export interface ErrorHandlerConfig {
  includeStack?: boolean;
  logErrors?: boolean;
  customErrorHandler?: (error: Error, context: RequestContext) => void;
}

export class ErrorHandler {
  private config: ErrorHandlerConfig;

  constructor(config: ErrorHandlerConfig = {}) {
    this.config = {
      includeStack: process.env.NODE_ENV !== 'production',
      logErrors: true,
      ...config,
    };
  }

  /**
   * Handle an error and send appropriate HTTP response
   */
  async handle(error: Error, context: RequestContext): Promise<void> {
    const { response } = context;

    // Log error if configured
    if (this.config.logErrors) {
      console.error('Error occurred:', error);
    }

    // Call custom error handler if provided
    if (this.config.customErrorHandler) {
      try {
        this.config.customErrorHandler(error, context);
      } catch (customHandlerError) {
        console.error('Custom error handler failed:', customHandlerError);
      }
    }

    // Convert to NextRushError if it's not already
    const nextRushError = this.normalizeError(error);

    // Send error response
    await this.sendErrorResponse(nextRushError, response);
  }

  /**
   * Convert any error to NextRushError
   */
  private normalizeError(error: Error): NextRushError {
    if (error instanceof NextRushError) {
      return error;
    }

    return new InternalServerError(error.message, {
      originalError: error.name,
      stack: this.config.includeStack ? error.stack : undefined,
    });
  }

  /**
   * Send formatted error response
   */
  private async sendErrorResponse(
    error: NextRushError,
    response: ParsedResponse
  ): Promise<void> {
    if (response.headersSent) {
      return;
    }

    const errorResponse = {
      error: {
        message: error.message,
        code: error.code,
        timestamp: error.timestamp.toISOString(),
        ...(this.config.includeStack && { stack: error.stack }),
        ...(error.details && { details: error.details }),
      },
    };

    response.statusCode = error.statusCode;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(errorResponse, null, 2));
  }

  /**
   * Configure the error handler
   */
  configure(config: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

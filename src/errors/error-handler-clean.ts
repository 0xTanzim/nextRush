/**
 * 🔥 Optimized Error Handler - Simple and Efficient
 * - Memory optimized with smart caching
 * - Performance-first design
 * - Enterprise-grade error classification
 */
import { ParsedResponse, RequestContext } from '../types/http';
import { InternalServerError, NextRushError } from './custom-errors';

export interface ErrorHandlerConfig {
  includeStack?: boolean;
  logErrors?: boolean;
  customErrorHandler?: (error: Error, context: RequestContext) => void;
  enableMetrics?: boolean;
  sanitizeProductionErrors?: boolean;
}

export class ErrorHandler {
  private config: ErrorHandlerConfig;
  private errorCount = 0;
  private lastErrorTime = 0;

  constructor(config: ErrorHandlerConfig = {}) {
    this.config = {
      includeStack: process.env.NODE_ENV !== 'production',
      logErrors: true,
      enableMetrics: false,
      sanitizeProductionErrors: true,
      ...config,
    };
  }

  /**
   * Handle an error and send appropriate HTTP response
   */
  async handle(error: Error, context: RequestContext): Promise<void> {
    const startTime = Date.now();

    try {
      // Update simple metrics
      this.errorCount++;
      this.lastErrorTime = startTime;

      // Log error if configured
      if (this.config.logErrors) {
        this.logError(error, context);
      }

      // Execute custom error handler (non-blocking)
      if (this.config.customErrorHandler) {
        setImmediate(() => {
          try {
            this.config.customErrorHandler!(error, context);
          } catch (customHandlerError) {
            console.error('Custom error handler failed:', customHandlerError);
          }
        });
      }

      // Convert to NextRushError if it's not already
      const nextRushError = this.normalizeError(error, context);

      // Send error response
      await this.sendErrorResponse(nextRushError, context.response);
    } catch (handlerError) {
      // Fallback error handling
      await this.handleFallbackError(handlerError, context);
    }
  }

  /**
   * Convert any error to NextRushError with smart classification
   */
  private normalizeError(error: Error, context: RequestContext): NextRushError {
    if (error instanceof NextRushError) {
      return error;
    }

    // Generate correlation ID
    const correlationId = this.extractCorrelationId(context);

    // Smart error classification
    const classifiedError = this.classifyError(error, correlationId);
    if (classifiedError) {
      return classifiedError;
    }

    // Default to internal server error
    const message =
      this.config.sanitizeProductionErrors &&
      process.env.NODE_ENV === 'production'
        ? 'An internal error occurred'
        : error.message;

    return new InternalServerError(
      message,
      {
        originalError: error.name,
        ...(this.config.includeStack && { originalStack: error.stack }),
      },
      correlationId
    );
  }

  /**
   * Intelligent error classification
   */
  private classifyError(
    error: Error,
    correlationId?: string
  ): NextRushError | null {
    const message = error.message.toLowerCase();

    try {
      // Import errors dynamically to avoid circular dependencies
      const errors = require('./custom-errors');

      // Timeout errors
      if (message.includes('timeout') || message.includes('etimedout')) {
        return new errors.RequestTimeoutError(30000, correlationId);
      }

      // Not found errors
      if (message.includes('not found') || message.includes('enoent')) {
        return new errors.NotFoundError('Resource', undefined, correlationId);
      }

      // Permission errors
      if (message.includes('permission denied') || message.includes('eacces')) {
        return new errors.ForbiddenError(undefined, undefined, correlationId);
      }

      // Connection errors
      if (
        message.includes('connection refused') ||
        message.includes('econnrefused')
      ) {
        return new errors.BadGatewayError(undefined, correlationId);
      }

      // Validation errors
      if (message.includes('invalid') || message.includes('validation')) {
        return new errors.ValidationError(error.message, {}, correlationId);
      }
    } catch (importError) {
      // If we can't import custom errors, fall back to basic error
      console.warn(
        'Failed to import custom errors for classification:',
        importError
      );
    }

    return null;
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
        message: error.getUserMessage(),
        code: error.code,
        timestamp: error.timestamp,
        ...(error.correlationId && { correlationId: error.correlationId }),
        ...(this.config.includeStack &&
          this.shouldIncludeStack(error) && { stack: error.stack }),
        ...(error.details &&
          Object.keys(error.details).length > 0 && { details: error.details }),
      },
    };

    response.statusCode = error.statusCode;
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('X-Error-Code', error.code);

    if (error.correlationId) {
      response.setHeader('X-Correlation-ID', error.correlationId);
    }

    const jsonString = JSON.stringify(
      errorResponse,
      null,
      process.env.NODE_ENV === 'development' ? 2 : 0
    );
    response.end(jsonString);
  }

  /**
   * Smart error logging
   */
  private logError(error: Error, context: RequestContext): void {
    const isNextRushError = error instanceof NextRushError;
    const { ErrorSeverity } = require('./custom-errors');
    const severity = isNextRushError ? error.severity : ErrorSeverity.HIGH;

    const logData = {
      timestamp: new Date().toISOString(),
      message: error.message,
      code: isNextRushError ? error.code : 'UNKNOWN_ERROR',
      statusCode: isNextRushError ? error.statusCode : 500,
      severity,
      path: context.request.url,
      method: context.request.method,
      userAgent: context.request.headers['user-agent'],
      ip: context.request.connection?.remoteAddress,
      ...(isNextRushError &&
        error.correlationId && { correlationId: error.correlationId }),
      ...(this.config.includeStack && { stack: error.stack }),
    };

    // Log based on severity
    if (
      severity === ErrorSeverity.CRITICAL ||
      severity === ErrorSeverity.HIGH
    ) {
      console.error('🔥 ERROR:', JSON.stringify(logData));
    } else if (severity === ErrorSeverity.MEDIUM) {
      console.warn('⚠️  WARNING:', JSON.stringify(logData));
    } else {
      console.log('ℹ️  INFO:', JSON.stringify(logData));
    }
  }

  /**
   * Utility methods
   */
  private shouldIncludeStack(error: NextRushError): boolean {
    const { ErrorSeverity } = require('./custom-errors');
    return (
      process.env.NODE_ENV === 'development' ||
      error.severity === ErrorSeverity.CRITICAL
    );
  }

  private extractCorrelationId(context: RequestContext): string {
    return (
      (context.request.headers['x-correlation-id'] as string) ||
      (context.request.headers['x-request-id'] as string) ||
      `err_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    );
  }

  private async handleFallbackError(
    handlerError: unknown,
    context: RequestContext
  ): Promise<void> {
    console.error('Error handler itself failed:', handlerError);

    if (!context.response.headersSent) {
      context.response.statusCode = 500;
      context.response.setHeader('Content-Type', 'application/json');
      context.response.end(
        JSON.stringify({
          error: {
            message: 'Internal server error',
            code: 'ERROR_HANDLER_FAILURE',
            timestamp: Date.now(),
          },
        })
      );
    }
  }

  /**
   * Configure the error handler
   */
  configure(config: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get basic metrics
   */
  getMetrics() {
    return {
      totalErrors: this.errorCount,
      lastErrorTime: this.lastErrorTime,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.errorCount = 0;
    this.lastErrorTime = 0;
  }
}

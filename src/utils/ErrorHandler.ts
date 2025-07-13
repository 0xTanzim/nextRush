import {
  ErrorHandlerOptions,
  ErrorResponse,
  LitePressError,
  Request,
  Response,
} from '../types';

export class ErrorHandler {
  private static defaultOptions: ErrorHandlerOptions = {
    includeStack: process.env.NODE_ENV !== 'production',
    maxBodySize: 1024 * 1024, // 1MB
    timeout: 30000, // 30 seconds
    logErrors: true,
  };

  static configure(options: Partial<ErrorHandlerOptions>): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  static handleError(
    error: Error,
    req: Request,
    res: Response,
    options?: Partial<ErrorHandlerOptions>
  ): void {
    const config = { ...this.defaultOptions, ...options };

    if (config.logErrors) {
      console.error(`[${new Date().toISOString()}] Error:`, {
        message: error.message,
        stack: error.stack,
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
      });
    }

    // Check if response is already sent
    if (res.headersSent) {
      console.warn('Response already sent, cannot handle error');
      return;
    }

    let statusCode = 500;
    let code = 'INTERNAL_SERVER_ERROR';
    let details: Record<string, unknown> | undefined;

    // Handle LitePressError instances
    if (error instanceof LitePressError) {
      statusCode = error.statusCode;
      code = error.code;
      details = error.details;
    }
    // Handle common Node.js errors
    else if (error.message.includes('ENOENT')) {
      statusCode = 404;
      code = 'FILE_NOT_FOUND';
    } else if (error.message.includes('EACCES')) {
      statusCode = 403;
      code = 'PERMISSION_DENIED';
    } else if (
      error.message.includes('EMFILE') ||
      error.message.includes('ENFILE')
    ) {
      statusCode = 503;
      code = 'TOO_MANY_FILES';
    } else if (error.message.includes('timeout')) {
      statusCode = 408;
      code = 'REQUEST_TIMEOUT';
    }

    const errorResponse: ErrorResponse = {
      error: {
        message: error.message,
        code,
        statusCode,
        timestamp: new Date().toISOString(),
        path: req.pathname || req.url || 'unknown',
        method: req.method || 'unknown',
        details,
        ...(config.includeStack && { stack: error.stack }),
      },
    };

    try {
      res.status(statusCode).json(errorResponse);
    } catch (responseError) {
      // Fallback if JSON response fails
      console.error('Failed to send error response:', responseError);
      try {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      } catch (fallbackError) {
        console.error('Failed to send fallback error response:', fallbackError);
      }
    }
  }

  static createSafeHandler<T extends any[]>(
    handler: (...args: T) => Promise<void> | void
  ): (...args: T) => Promise<void> {
    return async (...args: T): Promise<void> => {
      try {
        await handler(...args);
      } catch (error) {
        // If this is in a request context, the last two args should be req and res
        if (args.length >= 2) {
          const req = args[args.length - 2] as unknown as Request;
          const res = args[args.length - 1] as unknown as Response;

          if (req && res && typeof res.status === 'function') {
            this.handleError(error as Error, req, res);
            return;
          }
        }

        // If not in request context, just log and rethrow
        console.error('Unhandled error in safe handler:', error);
        throw error;
      }
    };
  }

  static validatePayloadSize(contentLength: number, maxSize?: number): void {
    const limit = maxSize || this.defaultOptions.maxBodySize || 1024 * 1024;
    if (contentLength > limit) {
      throw new LitePressError(
        `Payload too large. Maximum allowed: ${limit} bytes`,
        'PAYLOAD_TOO_LARGE',
        413,
        { maxSize: limit, actualSize: contentLength }
      );
    }
  }

  static validateContentType(
    contentType: string,
    allowedTypes: string[]
  ): void {
    if (!allowedTypes.some((type) => contentType.includes(type))) {
      throw new LitePressError(
        `Unsupported content type: ${contentType}`,
        'UNSUPPORTED_MEDIA_TYPE',
        415,
        { contentType, allowedTypes }
      );
    }
  }

  static wrapWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operation: string = 'operation'
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new LitePressError(
              `${operation} timed out after ${timeoutMs}ms`,
              'TIMEOUT',
              408,
              { timeout: timeoutMs, operation }
            )
          );
        }, timeoutMs);
      }),
    ]);
  }
}

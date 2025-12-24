/**
 * @nextrush/errors - Error Handler Middleware
 *
 * Middleware for handling errors in NextRush applications.
 *
 * @packageDocumentation
 */

import { HttpError, NextRushError } from './base';

/**
 * Minimal context interface for error handling
 * This avoids circular dependencies with @nextrush/types
 */
export interface ErrorContext {
  method: string;
  path: string;
  status: number;
  json: (data: unknown) => void;
}

/**
 * Error handler middleware function type
 */
export type ErrorMiddleware = (
  ctx: ErrorContext,
  next?: () => Promise<void>
) => Promise<void>;

/**
 * Error handler options
 */
export interface ErrorHandlerOptions {
  /** Include stack trace in development */
  includeStack?: boolean;

  /** Custom error logger */
  logger?: (error: Error, ctx: ErrorContext) => void;

  /** Custom error transformer */
  transform?: (error: Error, ctx: ErrorContext) => Record<string, unknown>;

  /** Handle specific error types */
  handlers?: Map<new (...args: unknown[]) => Error, (error: Error, ctx: ErrorContext) => void>;
}

/**
 * Default error logger
 */
function defaultLogger(error: Error, ctx: ErrorContext): void {
  const status = error instanceof HttpError ? error.status : 500;

  if (status >= 500) {
    console.error(`[ERROR] ${ctx.method} ${ctx.path}:`, error);
  } else {
    console.warn(`[WARN] ${ctx.method} ${ctx.path}: ${error.message}`);
  }
}

/**
 * Create error handler middleware
 *
 * @example
 * ```typescript
 * const app = createApp();
 *
 * // Add error handler first
 * app.use(errorHandler({
 *   includeStack: process.env.NODE_ENV !== 'production',
 *   logger: (err, ctx) => myLogger.error(err),
 * }));
 * ```
 */
export function errorHandler(options: ErrorHandlerOptions = {}): ErrorMiddleware {
  const { includeStack = false, logger = defaultLogger, transform, handlers } = options;

  return async (ctx: ErrorContext, next?: () => Promise<void>): Promise<void> => {
    try {
      if (next) {
        await next();
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Log the error
      logger(err, ctx);

      // Check for custom handlers
      if (handlers) {
        for (const [ErrorType, handler] of handlers) {
          if (err instanceof ErrorType) {
            handler(err, ctx);
            return;
          }
        }
      }

      // Determine status code
      let status = 500;
      let expose = false;
      let code = 'INTERNAL_ERROR';
      let details: Record<string, unknown> | undefined;

      if (err instanceof HttpError || err instanceof NextRushError) {
        status = err.status;
        expose = err.expose;
        code = err.code;
        details = err.details;
      }

      ctx.status = status;

      // Build response body
      let body: Record<string, unknown>;

      if (transform) {
        body = transform(err, ctx);
      } else {
        body = {
          error: err.name,
          message: expose ? err.message : 'Internal Server Error',
          code,
          status,
        };

        if (expose && details) {
          body.details = details;
        }

        if (includeStack && err.stack) {
          body.stack = err.stack.split('\n').map(line => line.trim());
        }
      }

      ctx.json(body);
    }
  };
}

/**
 * Not found handler middleware - catches unhandled requests
 *
 * @example
 * ```typescript
 * // Add at the end of middleware chain
 * app.use(notFoundHandler());
 * ```
 */
export function notFoundHandler(message = 'Not Found'): ErrorMiddleware {
  return async (ctx: ErrorContext): Promise<void> => {
    // Only handle if response hasn't been sent
    if (ctx.status === 200 || ctx.status === 404) {
      ctx.status = 404;
      ctx.json({
        error: 'NotFoundError',
        message,
        code: 'NOT_FOUND',
        status: 404,
        path: ctx.path,
      });
    }
  };
}

/**
 * Catch async errors wrapper for route handlers
 *
 * @example
 * ```typescript
 * router.get('/users/:id', catchAsync(async (ctx) => {
 *   const user = await db.users.findById(ctx.params.id);
 *   if (!user) throw new NotFoundError('User not found');
 *   ctx.json(user);
 * }));
 * ```
 */
export function catchAsync(
  handler: (ctx: ErrorContext, next?: () => Promise<void>) => Promise<void>
): ErrorMiddleware {
  return async (ctx: ErrorContext, next?: () => Promise<void>): Promise<void> => {
    try {
      await handler(ctx, next);
    } catch (error) {
      // Re-throw to be caught by errorHandler middleware
      throw error;
    }
  };
}

/**
 * @nextrush/errors - Error Handler Middleware
 *
 * Middleware for handling errors in NextRush applications.
 *
 * @packageDocumentation
 */

import type { Context, Middleware, Next } from '@nextrush/types';
import { HttpError, NextRushError } from './base';

/** Standard HTTP status text for non-exposed error responses */
const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

/**
 * Minimal context interface for error handling.
 *
 * @deprecated Use `Context` from `@nextrush/types` instead.
 * Kept for backward compatibility — will be removed in v4.
 */
export interface ErrorContext {
  method: string;
  path: string;
  status: number;
  json: (data: unknown) => void;
}

/**
 * Error handler middleware function type.
 *
 * @deprecated Use `Middleware` from `@nextrush/types` instead.
 * Kept for backward compatibility — will be removed in v4.
 */
export type ErrorMiddleware = Middleware;

/**
 * Error handler options
 */
export interface ErrorHandlerOptions {
  /** Include stack trace in development */
  includeStack?: boolean;

  /** Custom error logger */
  logger?: (error: Error, ctx: Context) => void;

  /** Custom error transformer */
  transform?: (error: Error, ctx: Context) => Record<string, unknown>;

  /** Handle specific error types */
  handlers?: Map<new (...args: unknown[]) => Error, (error: Error, ctx: Context) => void>;
}

/**
 * Default error logger
 */
function defaultLogger(error: Error, ctx: Context): void {
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
export function errorHandler(options: ErrorHandlerOptions = {}): Middleware {
  const { includeStack = false, logger = defaultLogger, transform, handlers } = options;

  return async (ctx: Context, next: Next): Promise<void> => {
    try {
      await next();
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
          error: expose ? err.name : (STATUS_TEXT[status] ?? 'Internal Server Error'),
          message: expose ? err.message : 'Internal Server Error',
          code,
          status,
        };

        if (expose && details) {
          body.details = details;
        }

        if (includeStack && err.stack) {
          body.stack = err.stack.split('\n').map((line) => line.trim());
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
export function notFoundHandler(message = 'Not Found'): Middleware {
  return async (ctx: Context, next: Next): Promise<void> => {
    await next();
    // Only handle if no response body was set and status indicates unhandled
    if (ctx.status === 404) {
      ctx.json({
        error: 'NotFoundError',
        message,
        code: 'NOT_FOUND',
        status: 404,
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
 *
 * @deprecated This wrapper is redundant — async errors propagate naturally
 * through the middleware chain and are caught by `errorHandler()`. Use the
 * handler directly instead.
 */
export function catchAsync(handler: (ctx: Context, next: Next) => Promise<void>): Middleware {
  return handler;
}

/**
 * @nextrush/errors - Error Handler Middleware
 *
 * Middleware for handling errors in NextRush applications.
 *
 * @packageDocumentation
 */

import type { Context, Middleware, Next } from '@nextrush/types';
import { HttpError, NextRushError, getHttpStatusMessage } from './base';

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
      } else if (err instanceof NextRushError) {
        // Delegate to the error's own toJSON() — this is the single source of
        // truth for what a given error type serializes to (e.g. ValidationError
        // adds `issues` while stripping `received`). Duplicating that shape here
        // would silently drift out of sync with subclass overrides.
        body = err.toJSON();
      } else {
        body = {
          error: expose ? err.name : getHttpStatusMessage(status),
          message: expose ? err.message : 'Internal Server Error',
          code,
          status,
        };

        if (expose && details) {
          body.details = details;
        }
      }

      if (includeStack && err.stack) {
        body.stack = err.stack.split('\n').map((line) => line.trim());
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
    // Only handle if no response was sent and status indicates unhandled
    if (!ctx.responded && ctx.status === 404) {
      ctx.json({
        error: 'NotFoundError',
        message,
        code: 'NOT_FOUND',
        status: 404,
      });
    }
  };
}


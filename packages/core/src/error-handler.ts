/**
 * @nextrush/core - Default Error Response
 *
 * The framework's default error serialization, extracted from `Application`
 * (audit C-5). Produces the same JSON shape as `@nextrush/errors`'
 * `errorHandler()` so there is ONE error contract framework-wide (audit C-1):
 * a `NextRushError` serializes via its own `toJSON()`; a plain error becomes a
 * safe coded 500.
 *
 * @packageDocumentation
 */

import { getErrorStatus, getHttpStatusMessage, NextRushError } from '@nextrush/errors';
import type { Context, Logger } from '@nextrush/types';

/** Options for {@link writeDefaultErrorResponse}. */
export interface DefaultErrorOptions {
  logger: Logger;
  isProduction: boolean;
}

/**
 * Write the default error response to `ctx`.
 *
 * @remarks
 * 5xx are always logged; 4xx only outside production (audit C-7). The internal
 * message of a non-exposed error is never sent to the client.
 */
export function writeDefaultErrorResponse(
  error: Error,
  ctx: Context,
  opts: DefaultErrorOptions
): void {
  const status = getErrorStatus(error);

  if (status >= 500 || !opts.isProduction) {
    opts.logger.error('Request error:', error);
  }

  ctx.status = status;

  if (error instanceof NextRushError) {
    ctx.json(error.toJSON());
    return;
  }

  const expose = status < 500;
  ctx.json({
    error: expose ? error.name : getHttpStatusMessage(status),
    message: expose ? error.message : 'Internal Server Error',
    code: 'INTERNAL_ERROR',
    status,
  });
}

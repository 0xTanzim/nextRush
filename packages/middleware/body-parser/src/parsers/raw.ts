/**
 * @nextrush/body-parser - Raw Parser
 *
 * Parse raw binary request bodies.
 *
 * @packageDocumentation
 */

import {
    BODYLESS_METHODS,
    DEFAULT_CONTENT_TYPES,
    DEFAULT_LIMITS,
} from '../constants.js';
import type {
    BodyParserContext,
    BodyParserMiddleware,
    RawOptions,
} from '../types.js';
import { getContentType, matchContentType } from '../utils/content-type.js';
import { parseLimit } from '../utils/limit.js';
import { readBody } from './reader.js';

/**
 * Create raw body parser middleware.
 *
 * Parses incoming requests with `application/octet-stream` content type
 * and sets `ctx.body` to the raw Buffer.
 *
 * @param options - Parser configuration
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { raw } from '@nextrush/body-parser';
 *
 * const app = createApp();
 *
 * // Parse binary data
 * app.use(raw());
 *
 * // Parse with custom types
 * app.use(raw({
 *   type: ['application/octet-stream', 'image/*'],
 *   limit: '50mb',
 * }));
 *
 * app.post('/upload', async (ctx) => {
 *   const buffer = ctx.body; // Buffer
 *   // Process binary data...
 * });
 * ```
 */
export function raw(options: RawOptions = {}): BodyParserMiddleware {
  const {
    limit = DEFAULT_LIMITS.RAW,
    type = DEFAULT_CONTENT_TYPES.RAW,
    rawBody: _rawBody = false, // Raw parser always returns buffer, option kept for consistency
  } = options;

  // Pre-compute configuration
  const limitBytes = parseLimit(limit, DEFAULT_LIMITS.RAW);
  const types = Array.isArray(type) ? type : [type];

  return async (
    ctx: BodyParserContext,
    next?: () => Promise<void>
  ): Promise<void> => {
    // Skip methods that don't have bodies
    if (BODYLESS_METHODS.has(ctx.method)) {
      if (next) await next();
      return;
    }

    // Check content type
    const contentType = getContentType(ctx.headers);
    if (!matchContentType(contentType, types)) {
      if (next) await next();
      return;
    }

    // Read body as raw buffer
    const buffer = await readBody(ctx, limitBytes);

    // For raw parser, body is always the buffer
    ctx.body = buffer;

    // Also set rawBody for consistency
    ctx.rawBody = buffer;

    if (next) await next();
  };
}

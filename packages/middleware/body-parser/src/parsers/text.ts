/**
 * @nextrush/body-parser - Text Parser
 *
 * Parse plain text request bodies.
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
    TextOptions,
} from '../types.js';
import { bufferToString } from '../utils/buffer.js';
import {
    extractCharset,
    getContentType,
    matchContentType,
    normalizeCharset,
} from '../utils/content-type.js';
import { parseLimit } from '../utils/limit.js';
import { readBody } from './reader.js';

/**
 * Create text body parser middleware.
 *
 * Parses incoming requests with `text/*` content type
 * and sets `ctx.body` to the parsed string.
 *
 * @param options - Parser configuration
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { text } from '@nextrush/body-parser';
 *
 * const app = createApp();
 *
 * // Parse plain text
 * app.use(text());
 *
 * // Parse with custom types
 * app.use(text({
 *   type: ['text/plain', 'text/html', 'text/xml'],
 *   limit: '5mb',
 * }));
 *
 * app.post('/webhook', async (ctx) => {
 *   const payload = ctx.body; // string
 * });
 * ```
 */
export function text(options: TextOptions = {}): BodyParserMiddleware {
  const {
    limit = DEFAULT_LIMITS.TEXT,
    type = DEFAULT_CONTENT_TYPES.TEXT,
    rawBody = false,
    defaultCharset = 'utf-8',
  } = options;

  // Pre-compute configuration
  const limitBytes = parseLimit(limit, DEFAULT_LIMITS.TEXT);
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

    // Read body
    const buffer = await readBody(ctx, limitBytes);

    // Store raw body if requested
    if (rawBody) {
      ctx.rawBody = buffer;
    }

    // Handle empty body
    if (buffer.length === 0) {
      ctx.body = '';
      if (next) await next();
      return;
    }

    // Extract and normalize charset
    const rawCharset = extractCharset(contentType) ?? defaultCharset;
    const encoding = normalizeCharset(rawCharset, 'utf-8');

    // Convert buffer to string
    ctx.body = bufferToString(buffer, encoding as BufferEncoding);

    if (next) await next();
  };
}

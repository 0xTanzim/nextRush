/**
 * @nextrush/body-parser - URL-Encoded Parser
 *
 * Parse URL-encoded request bodies.
 *
 * @packageDocumentation
 */

import {
    BODYLESS_METHODS,
    DEFAULT_CONTENT_TYPES,
    DEFAULT_LIMITS,
    DEFAULT_PARAMETER_LIMITS,
} from '../constants.js';
import { Errors } from '../errors.js';
import type {
    BodyParserContext,
    BodyParserMiddleware,
    UrlEncodedOptions,
} from '../types.js';
import { bufferToString } from '../utils/buffer.js';
import { getContentType, matchContentType } from '../utils/content-type.js';
import { parseLimit } from '../utils/limit.js';
import { parseUrlEncoded } from '../utils/url-decode.js';
import { readBody } from './reader.js';

/**
 * Create URL-encoded body parser middleware.
 *
 * Parses incoming requests with `application/x-www-form-urlencoded`
 * content type and sets `ctx.body` to the parsed object.
 *
 * @param options - Parser configuration
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { urlencoded } from '@nextrush/body-parser';
 *
 * const app = createApp();
 *
 * // Parse URL-encoded bodies
 * app.use(urlencoded());
 *
 * // With extended parsing for nested objects
 * app.use(urlencoded({
 *   extended: true,
 *   limit: '100kb',
 *   depth: 5,
 * }));
 *
 * app.post('/login', async (ctx) => {
 *   const { username, password } = ctx.body;
 * });
 * ```
 */
export function urlencoded(options: UrlEncodedOptions = {}): BodyParserMiddleware {
  const {
    limit = DEFAULT_LIMITS.URLENCODED,
    type = DEFAULT_CONTENT_TYPES.URLENCODED,
    rawBody = false,
    extended = true,
    parameterLimit = DEFAULT_PARAMETER_LIMITS.MAX_PARAMS,
    depth = DEFAULT_PARAMETER_LIMITS.MAX_DEPTH,
  } = options;

  // Pre-compute configuration
  const limitBytes = parseLimit(limit, DEFAULT_LIMITS.URLENCODED);
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
      ctx.body = {};
      if (next) await next();
      return;
    }

    // Parse URL-encoded string
    const str = bufferToString(buffer);

    try {
      ctx.body = parseUrlEncoded(str, extended, parameterLimit, depth);
    } catch (err) {
      // Re-throw BodyParserError
      if (err instanceof Error && err.name === 'BodyParserError') {
        throw err;
      }

      // Wrap other errors
      throw Errors.invalidUrlEncoded((err as Error).message);
    }

    if (next) await next();
  };
}

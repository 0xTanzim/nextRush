/**
 * @nextrush/body-parser - JSON Parser
 *
 * Parse JSON request bodies.
 *
 * @packageDocumentation
 */

import { BODYLESS_METHODS, DEFAULT_CONTENT_TYPES, DEFAULT_LIMITS } from '../constants.js';
import { Errors } from '../errors.js';
import type {
    BodyParserContext,
    BodyParserMiddleware,
    JsonOptions,
} from '../types.js';
import { bufferToString } from '../utils/buffer.js';
import { getContentType, isJsonContentType, matchContentType } from '../utils/content-type.js';
import { parseLimit } from '../utils/limit.js';
import { readBody } from './reader.js';

/**
 * Create JSON body parser middleware.
 *
 * Parses incoming requests with JSON payloads and sets `ctx.body`
 * to the parsed JSON object.
 *
 * @param options - Parser configuration
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { json } from '@nextrush/body-parser';
 *
 * const app = createApp();
 *
 * // Parse JSON bodies up to 1MB
 * app.use(json());
 *
 * // Custom configuration
 * app.use(json({
 *   limit: '5mb',
 *   strict: true,
 *   rawBody: true,
 * }));
 *
 * app.post('/api/users', async (ctx) => {
 *   console.log(ctx.body); // Parsed JSON object
 * });
 * ```
 */
export function json(options: JsonOptions = {}): BodyParserMiddleware {
  const {
    limit = DEFAULT_LIMITS.JSON,
    reviver,
    type = DEFAULT_CONTENT_TYPES.JSON,
    rawBody = false,
    strict = true,
  } = options;

  // Pre-compute configuration
  const limitBytes = parseLimit(limit, DEFAULT_LIMITS.JSON);
  const types = Array.isArray(type) ? type : [type];

  // Optimize for default case (single 'application/json' type)
  const useSimpleCheck =
    types.length === 1 && types[0] === 'application/json';

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
    const isMatch = useSimpleCheck
      ? isJsonContentType(contentType)
      : matchContentType(contentType, types);

    if (!isMatch) {
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
      // Empty body returns empty object for convenience
      ctx.body = {};
      if (next) await next();
      return;
    }

    // Parse JSON
    const str = bufferToString(buffer);

    try {
      const parsed: unknown = JSON.parse(str, reviver);

      // Strict mode: only accept objects and arrays
      if (strict) {
        if (typeof parsed !== 'object' || parsed === null) {
          throw Errors.strictModeViolation();
        }
      }

      ctx.body = parsed;
    } catch (err) {
      // Re-throw BodyParserError
      if (err instanceof Error && err.name === 'BodyParserError') {
        throw err;
      }

      // Wrap JSON parse errors
      throw Errors.invalidJson((err as Error).message);
    }

    if (next) await next();
  };
}

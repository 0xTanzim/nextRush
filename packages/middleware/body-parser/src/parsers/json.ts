/**
 * @nextrush/body-parser - JSON Parser
 *
 * Parse JSON request bodies.
 *
 * @packageDocumentation
 */

import type { Middleware } from '@nextrush/types';

import { BODYLESS_METHODS, DEFAULT_CONTENT_TYPES, DEFAULT_LIMITS } from '../constants.js';
import { Errors } from '../errors.js';
import type { BodyParserContext, JsonOptions } from '../types.js';
import { bufferToString } from '../utils/buffer.js';
import { getContentType, isJsonContentType, matchContentType } from '../utils/content-type.js';
import { parseLimit } from '../utils/limit.js';
import { readBody } from './reader.js';

/**
 * Iterative JSON depth checker.
 *
 * Uses an explicit stack to avoid stack overflow on deeply nested payloads.
 *
 * @param value - Parsed JSON value to check
 * @param maxDepth - Maximum allowed nesting depth
 * @throws BodyParserError if depth exceeds limit
 */
function checkJsonDepth(value: unknown, maxDepth: number): void {
  // Use parallel arrays instead of object stack to reduce GC pressure
  const values: unknown[] = [value];
  const depths: number[] = [1];

  while (values.length > 0) {
    const val = values.pop();
    const depth = depths.pop()!;
    if (depth > maxDepth) {
      throw Errors.jsonDepthExceeded(depth, maxDepth);
    }

    if (Array.isArray(val)) {
      for (const child of val) {
        if (typeof child === 'object' && child !== null) {
          values.push(child);
          depths.push(depth + 1);
        }
      }
    } else if (typeof val === 'object' && val !== null) {
      for (const key of Object.keys(val as Record<string, unknown>)) {
        const child = (val as Record<string, unknown>)[key];
        if (typeof child === 'object' && child !== null) {
          values.push(child);
          depths.push(depth + 1);
        }
      }
    }
  }
}

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
export function json(options: JsonOptions = {}): Middleware {
  const {
    limit = DEFAULT_LIMITS.JSON,
    reviver,
    type = DEFAULT_CONTENT_TYPES.JSON,
    rawBody = false,
    strict = true,
    verify,
    maxDepth,
  } = options;

  // Pre-compute configuration
  const limitBytes = parseLimit(limit, DEFAULT_LIMITS.JSON);
  const types = Array.isArray(type) ? type : [type];

  // Optimize for default case (single 'application/json' type)
  const useSimpleCheck = types.length === 1 && types[0] === 'application/json';

  return (async (ctx: BodyParserContext, next?: () => Promise<void>): Promise<void> => {
    // Skip methods that don't have bodies
    if (BODYLESS_METHODS.has(ctx.method)) {
      if (next) await next();
      return;
    }

    // Skip if body already parsed by another middleware
    if (ctx.body !== undefined) {
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
      if (next) await next();
      return;
    }

    // Invoke verify callback before parsing
    if (verify) {
      await verify(ctx, buffer, 'utf-8');
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

      // Check nesting depth
      if (maxDepth !== undefined && typeof parsed === 'object' && parsed !== null) {
        checkJsonDepth(parsed, maxDepth);
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
  }) as unknown as Middleware;
}

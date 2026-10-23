/**
 * @nextrush/body-parser - JSON Parser
 *
 * Parse JSON request bodies.
 *
 * @packageDocumentation
 */

import type { Middleware } from '@nextrush/types';

import { BODYLESS_METHODS, DEFAULT_CONTENT_TYPES, DEFAULT_JSON_MAX_DEPTH, DEFAULT_LIMITS } from '../constants.js';
import { Errors } from '../errors.js';
import { hasResolvedBody, installLazyReader } from '../lazy.js';
import type { BodyParserContext, JsonOptions } from '../types.js';
import { bufferToString, toRawBody } from '../utils/buffer.js';
import { isJsonContentType, matchContentType } from '../utils/content-type.js';
import { readHeader } from '../utils/header-value.js';
import { parseLimit } from '../utils/limit.js';
import { readBody, readBodyText } from './reader.js';

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
 * The JSON parser's two halves: the middleware and the bare read.
 *
 * @internal
 *
 * @remarks
 * `read` is the eager parser's whole body without detection, assignment or
 * `next()`, so the combined parser and the lazy reader share one implementation
 * of the byte limit, `verify`, decoding, `strict` and the depth guard. Not
 * exported from the package entry point.
 */
export interface JsonParserParts {
  readonly middleware: Middleware;
  readonly read: (ctx: BodyParserContext) => Promise<unknown>;
}

/**
 * Create the JSON parser's middleware and its read function.
 *
 * @internal
 */
export function createJsonParser(options: JsonOptions = {}): JsonParserParts {
  const {
    limit = DEFAULT_LIMITS.JSON,
    reviver,
    type = DEFAULT_CONTENT_TYPES.JSON,
    rawBody = false,
    strict = true,
    verify,
    maxDepth = DEFAULT_JSON_MAX_DEPTH,
    lazy = false,
  } = options;

  // Pre-compute configuration
  const limitBytes = parseLimit(limit, DEFAULT_LIMITS.JSON);
  const types = Array.isArray(type) ? type : [type];

  // Optimize for default case (single 'application/json' type)
  const useSimpleCheck = types.length === 1 && types[0] === 'application/json';

  const read = async (ctx: BodyParserContext): Promise<unknown> => {
    // A caller that needs the bytes (`rawBody`, `verify`) reads them directly.
    // Otherwise the parser only needs the decoded string, so a body source that
    // can prove the body fits hands it over without materialising a buffer.
    const needsBytes = rawBody || verify !== undefined;
    let str: string;
    let depthCheckBytes: number;

    if (needsBytes) {
      const buffer = await readBody(ctx, limitBytes);

      if (rawBody) {
        ctx.rawBody = toRawBody(buffer);
      }

      if (buffer.length === 0) {
        return undefined;
      }

      if (verify) {
        await verify(ctx, toRawBody(buffer), 'utf-8');
      }

      str = bufferToString(buffer);
      depthCheckBytes = buffer.length;
    } else {
      str = await readBodyText(ctx, limitBytes);

      if (str.length === 0) {
        return undefined;
      }

      // Decoded length is a lower bound on the UTF-8 size; three bytes per code
      // unit is the upper bound, which keeps the depth guard conservative for
      // multi-byte bodies instead of skipping a walk that could matter.
      depthCheckBytes = str.length * 3;
    }

    try {
      const parsed: unknown = JSON.parse(str, reviver);

      // Strict mode: only accept objects and arrays
      if (strict) {
        if (typeof parsed !== 'object' || parsed === null) {
          throw Errors.strictModeViolation();
        }
      }

      // Check nesting depth — but skip the traversal for payloads too small to
      // possibly exceed maxDepth (BP-D). Representing nesting depth d requires at
      // least 2d structural bytes (d opening + d closing brackets); keys/values only
      // add bytes. So a body under 2*(maxDepth+1) bytes cannot reach depth maxDepth+1,
      // and the walk (plus its two working arrays) cannot change the outcome. When
      // maxDepth is Infinity the threshold is Infinity, so the walk is always skipped —
      // matching "depth checking disabled".
      if (
        maxDepth !== undefined &&
        typeof parsed === 'object' &&
        parsed !== null &&
        depthCheckBytes >= 2 * (maxDepth + 1)
      ) {
        checkJsonDepth(parsed, maxDepth);
      }

      return parsed;
    } catch (err) {
      // Re-throw BodyParserError
      if (err instanceof Error && err.name === 'BodyParserError') {
        throw err;
      }

      // Wrap JSON parse errors
      throw Errors.invalidJson((err as Error).message);
    }
  };

  const middleware = (async (
    ctx: BodyParserContext,
    next?: () => Promise<void>
  ): Promise<void> => {
    if (BODYLESS_METHODS.has(ctx.method)) {
      if (next) await next();
      return;
    }
    if (hasResolvedBody(ctx)) {
      if (next) await next();
      return;
    }
    const contentType = readHeader(ctx, 'content-type');
    const isMatch = useSimpleCheck
      ? isJsonContentType(contentType)
      : matchContentType(contentType, types);
    if (!isMatch) {
      if (next) await next();
      return;
    }

    // Lazy mode installs the reader and returns; the read happens only if the
    // application asks for the body (RFC-047).
    if (lazy) {
      installLazyReader(ctx, () => read(ctx));
    } else {
      ctx.body = await read(ctx);
    }

    if (next) await next();
  }) as unknown as Middleware;

  return { middleware, read };
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
  return createJsonParser(options).middleware;
}

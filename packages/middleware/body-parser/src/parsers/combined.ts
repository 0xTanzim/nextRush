/**
 * @nextrush/body-parser - Combined Parser
 *
 * Combined body parser that handles multiple content types.
 *
 * @packageDocumentation
 */

import type { Middleware } from '@nextrush/types';

import { BODYLESS_METHODS, DEFAULT_CONTENT_TYPES } from '../constants.js';
import { Errors } from '../errors.js';
import type { BodyParserContext, BodyParserMiddleware, BodyParserOptions } from '../types.js';
import { getContentType, matchContentType } from '../utils/content-type.js';
import { json } from './json.js';
import { raw } from './raw.js';
import { text } from './text.js';
import { urlencoded } from './urlencoded.js';

/**
 * Create combined body parser middleware.
 *
 * This middleware automatically detects the content type and applies
 * the appropriate parser. By default, it handles JSON and URL-encoded bodies.
 * Text and raw parsing must be explicitly enabled.
 *
 * @param options - Parser configuration
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { bodyParser } from '@nextrush/body-parser';
 *
 * const app = createApp();
 *
 * // Use combined parser (JSON + URL-encoded by default)
 * app.use(bodyParser());
 *
 * // Enable text and raw parsing
 * app.use(bodyParser({
 *   json: { limit: '10mb', strict: true },
 *   urlencoded: { extended: true, depth: 5 },
 *   text: { limit: '5mb' },    // Enable text parsing
 *   raw: { limit: '10mb' },    // Enable raw parsing
 * }));
 *
 * app.post('/api/data', async (ctx) => {
 *   // ctx.body is automatically parsed based on content-type
 *   console.log(ctx.body);
 * });
 * ```
 */
export function bodyParser(options: BodyParserOptions = {}): Middleware {
  const {
    json: jsonOptions = {},
    urlencoded: urlencodedOptions = {},
    // Text and raw disabled by default for backward compatibility
    text: textOptions,
    raw: rawOptions,
  } = options;

  // Helper to normalize type option to string array
  const normalizeTypes = (
    optionType: string | readonly string[] | undefined,
    defaultType: readonly string[]
  ): string[] => {
    if (optionType === undefined) {
      return [...defaultType];
    }
    if (typeof optionType === 'string') {
      return [optionType];
    }
    return [...optionType];
  };

  // Build content type matchers from options
  // This fixes HIGH-002: Combined parser now respects custom types
  const jsonTypes =
    jsonOptions !== false ? normalizeTypes(jsonOptions.type, DEFAULT_CONTENT_TYPES.JSON) : [];
  const urlencodedTypes =
    urlencodedOptions !== false
      ? normalizeTypes(urlencodedOptions.type, DEFAULT_CONTENT_TYPES.URLENCODED)
      : [];
  // Text and raw only enabled when explicitly configured (not undefined, not false)
  const hasTextOptions = textOptions !== undefined && textOptions !== false;
  const hasRawOptions = rawOptions !== undefined && rawOptions !== false;
  const textTypes = hasTextOptions
    ? normalizeTypes(
        (textOptions as Exclude<typeof textOptions, false | undefined>).type,
        DEFAULT_CONTENT_TYPES.TEXT
      )
    : [];
  const rawTypes = hasRawOptions
    ? normalizeTypes(
        (rawOptions as Exclude<typeof rawOptions, false | undefined>).type,
        DEFAULT_CONTENT_TYPES.RAW
      )
    : [];

  // Pre-create individual parsers with correct options
  // Cast to BodyParserMiddleware for internal use (optional next parameter)
  const jsonParser =
    jsonOptions !== false ? (json(jsonOptions) as unknown as BodyParserMiddleware) : null;
  const urlencodedParser =
    urlencodedOptions !== false
      ? (urlencoded(urlencodedOptions) as unknown as BodyParserMiddleware)
      : null;
  // Text and raw parsers only created when explicitly enabled
  const textParser = hasTextOptions
    ? (text(
        textOptions as Exclude<typeof textOptions, false | undefined>
      ) as unknown as BodyParserMiddleware)
    : null;
  const rawParser = hasRawOptions
    ? (raw(
        rawOptions as Exclude<typeof rawOptions, false | undefined>
      ) as unknown as BodyParserMiddleware)
    : null;

  return (async (ctx: BodyParserContext, next?: () => Promise<void>): Promise<void> => {
    // Skip methods that don't have bodies
    if (BODYLESS_METHODS.has(ctx.method)) {
      if (next) await next();
      return;
    }

    // Get content type for routing
    const contentType = getContentType(ctx.headers);

    // Route to appropriate parser based on content type
    // Order matters: check more specific types first

    // JSON
    if (jsonParser && matchContentType(contentType, jsonTypes)) {
      await jsonParser(ctx);
      if (next) await next();
      return;
    }

    // URL-encoded
    if (urlencodedParser && matchContentType(contentType, urlencodedTypes)) {
      await urlencodedParser(ctx);
      if (next) await next();
      return;
    }

    // Text
    if (textParser && matchContentType(contentType, textTypes)) {
      await textParser(ctx);
      if (next) await next();
      return;
    }

    // Raw (fallback for binary)
    if (rawParser && matchContentType(contentType, rawTypes)) {
      await rawParser(ctx);
      if (next) await next();
      return;
    }

    // Multipart stub: provide a clear error instead of silent pass-through
    if (contentType && contentType.startsWith('multipart/')) {
      throw Errors.unsupportedContentType(
        'multipart/form-data',
        'Use a dedicated multipart parser package for file uploads'
      );
    }

    // No matching parser, continue without parsing
    if (next) await next();
  }) as unknown as Middleware;
}

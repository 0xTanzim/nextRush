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
import { hasResolvedBody, installLazyReader } from '../lazy.js';
import type { BodyParserContext, BodyParserOptions } from '../types.js';
import { matchContentType } from '../utils/content-type.js';
import { readHeader } from '../utils/header-value.js';
import { createJsonParser, type JsonParserParts } from './json.js';
import { createRawParser, type RawParserParts } from './raw.js';
import { createTextParser, type TextParserParts } from './text.js';
import { createUrlEncodedParser, type UrlEncodedParserParts } from './urlencoded.js';

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
    onUnsupportedContentType = 'ignore',
    lazy = false,
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

  // Pre-create individual parsers. Only their read functions are used: the
  // combined parser already performed detection, so re-entering the middleware
  // would repeat it (BP-E).
  const jsonParser: JsonParserParts | null =
    jsonOptions !== false ? createJsonParser(jsonOptions) : null;
  const urlencodedParser: UrlEncodedParserParts | null =
    urlencodedOptions !== false ? createUrlEncodedParser(urlencodedOptions) : null;
  // Text and raw parsers only created when explicitly enabled
  const textParser: TextParserParts | null = hasTextOptions
    ? createTextParser(textOptions as Exclude<typeof textOptions, false | undefined>)
    : null;
  const rawParser: RawParserParts | null = hasRawOptions
    ? createRawParser(rawOptions as Exclude<typeof rawOptions, false | undefined>)
    : null;

  /**
   * Deliver one parser's result: eagerly assign it, or install the deferred
   * reader that assigns it the first time the application asks (RFC-047).
   */
  const deliver = async (
    ctx: BodyParserContext,
    read: () => Promise<unknown>
  ): Promise<void> => {
    if (lazy) {
      installLazyReader(ctx, read);
      return;
    }
    ctx.body = await read();
  };

  return (async (ctx: BodyParserContext, next?: () => Promise<void>): Promise<void> => {
    // Skip methods that don't have bodies
    if (BODYLESS_METHODS.has(ctx.method)) {
      if (next) await next();
      return;
    }

    // Skip if the body was already parsed upstream. In lazy mode this asks the
    // installed reader slot, not `ctx.body`, which throws until the body has
    // actually been read.
    if (hasResolvedBody(ctx)) {
      if (next) await next();
      return;
    }

    // Get content type for routing
    const contentType = readHeader(ctx, 'content-type');

    // Route to appropriate parser based on content type
    // Order matters: check more specific types first

    // JSON
    if (jsonParser && matchContentType(contentType, jsonTypes)) {
      await deliver(ctx, () => jsonParser.read(ctx));
      if (next) await next();
      return;
    }

    // URL-encoded
    if (urlencodedParser && matchContentType(contentType, urlencodedTypes)) {
      await deliver(ctx, () => urlencodedParser.read(ctx));
      if (next) await next();
      return;
    }

    // Text
    if (textParser && matchContentType(contentType, textTypes)) {
      await deliver(ctx, () => textParser.read(ctx, contentType));
      if (next) await next();
      return;
    }

    // Raw (fallback for binary)
    if (rawParser && matchContentType(contentType, rawTypes)) {
      await deliver(ctx, () => rawParser.read(ctx));
      if (next) await next();
      return;
    }

    // Multipart stub: provide a clear error instead of silent pass-through.
    // A media-type decision, not a body decision — it needs no bytes, so lazy
    // mode still rejects before the handler.
    if (contentType && contentType.startsWith('multipart/')) {
      throw Errors.unsupportedContentType(
        'multipart/form-data',
        'Use a dedicated multipart parser package for file uploads'
      );
    }

    // Nothing matched. Under the rejecting policy this is a 415 rather than a
    // handler running against an undefined body; a request with no content type
    // at all carries no media type to reject, so it is left alone either way.
    if (onUnsupportedContentType === 'reject' && contentType) {
      throw Errors.unsupportedContentType(contentType);
    }

    // No matching parser, continue without parsing
    if (next) await next();
  }) as unknown as Middleware;
}

/**
 * @nextrush/body-parser - Text Parser
 *
 * Parse plain text request bodies.
 *
 * @packageDocumentation
 */

import type { Middleware } from '@nextrush/types';

import { BODYLESS_METHODS, DEFAULT_CONTENT_TYPES, DEFAULT_LIMITS } from '../constants.js';
import { hasResolvedBody, installLazyReader } from '../lazy.js';
import type { BodyParserContext, TextOptions } from '../types.js';
import { bufferToString, toRawBody } from '../utils/buffer.js';
import {
  extractCharset,
  matchContentType,
  normalizeCharset,
} from '../utils/content-type.js';
import { readHeader } from '../utils/header-value.js';
import { parseLimit } from '../utils/limit.js';
import { readBody } from './reader.js';

/**
 * The text parser's two halves: the middleware and the bare read.
 *
 * @internal
 *
 * @remarks
 * `read` takes the already-read `Content-Type` so neither mode pays a second
 * header lookup: the charset it carries decides the decoder. Not exported from
 * the package entry point.
 */
export interface TextParserParts {
  readonly middleware: Middleware;
  readonly read: (
    ctx: BodyParserContext,
    contentType: string | undefined
  ) => Promise<unknown>;
}

/**
 * Create the text parser's middleware and its read function.
 *
 * @internal
 */
export function createTextParser(options: TextOptions = {}): TextParserParts {
  const {
    limit = DEFAULT_LIMITS.TEXT,
    type = DEFAULT_CONTENT_TYPES.TEXT,
    rawBody = false,
    defaultCharset = 'utf-8',
    verify,
    lazy = false,
  } = options;

  // Pre-compute configuration
  const limitBytes = parseLimit(limit, DEFAULT_LIMITS.TEXT);
  const types = Array.isArray(type) ? type : [type];

  const read = async (
    ctx: BodyParserContext,
    contentType: string | undefined
  ): Promise<unknown> => {
    // Read body
    const buffer = await readBody(ctx, limitBytes);

    // Store raw body if requested (Buffer on Node, Uint8Array on edge)
    if (rawBody) {
      ctx.rawBody = toRawBody(buffer);
    }

    // Handle empty body
    if (buffer.length === 0) {
      return '';
    }

    // Extract and normalize charset
    const rawCharset = extractCharset(contentType) ?? defaultCharset;
    const encoding = normalizeCharset(rawCharset, 'utf-8');

    // Invoke verify callback before parsing
    if (verify) {
      await verify(ctx, toRawBody(buffer), encoding);
    }

    // Decode bytes to string via the runtime-agnostic decoder
    return bufferToString(buffer, encoding);
  };

  const middleware = (async (
    ctx: BodyParserContext,
    next?: () => Promise<void>
  ): Promise<void> => {
    // Content-type is needed below for charset detection, so compute it always; the
    // guard checks are skipped when routed by the combined parser (BP-E).
    const contentType = readHeader(ctx, 'content-type');
    if (BODYLESS_METHODS.has(ctx.method)) {
      if (next) await next();
      return;
    }
    if (hasResolvedBody(ctx)) {
      if (next) await next();
      return;
    }
    if (!matchContentType(contentType, types)) {
      if (next) await next();
      return;
    }

    // Lazy mode installs the reader and returns; the read happens only if the
    // application asks for the body (RFC-047).
    if (lazy) {
      installLazyReader(ctx, () => read(ctx, contentType));
    } else {
      ctx.body = await read(ctx, contentType);
    }

    if (next) await next();
  }) as unknown as Middleware;

  return { middleware, read };
}

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
export function text(options: TextOptions = {}): Middleware {
  return createTextParser(options).middleware;
}

/**
 * @nextrush/body-parser - Raw Parser
 *
 * Parse raw binary request bodies.
 *
 * @packageDocumentation
 */

import type { Middleware } from '@nextrush/types';

import { BODYLESS_METHODS, DEFAULT_CONTENT_TYPES, DEFAULT_LIMITS } from '../constants.js';
import { hasResolvedBody, installLazyReader } from '../lazy.js';
import type { BodyParserContext, RawOptions } from '../types.js';
import { toRawBody } from '../utils/buffer.js';
import { matchContentType } from '../utils/content-type.js';
import { readHeader } from '../utils/header-value.js';
import { parseLimit } from '../utils/limit.js';
import { readBody } from './reader.js';

/**
 * The raw parser's two halves: the middleware and the bare read.
 *
 * @internal
 *
 * @remarks
 * Not exported from the package entry point.
 */
export interface RawParserParts {
  readonly middleware: Middleware;
  readonly read: (ctx: BodyParserContext) => Promise<unknown>;
}

/**
 * Create the raw parser's middleware and its read function.
 *
 * @internal
 */
export function createRawParser(options: RawOptions = {}): RawParserParts {
  const {
    limit = DEFAULT_LIMITS.RAW,
    type = DEFAULT_CONTENT_TYPES.RAW,
    rawBody: _rawBody = false, // Raw parser always returns buffer, option kept for consistency
    verify,
    lazy = false,
  } = options;

  // Pre-compute configuration
  const limitBytes = parseLimit(limit, DEFAULT_LIMITS.RAW);
  const types = Array.isArray(type) ? type : [type];

  const read = async (ctx: BodyParserContext): Promise<unknown> => {
    // Read body as raw bytes
    const buffer = await readBody(ctx, limitBytes);

    // Present as a Node Buffer where available (DX), Uint8Array on edge.
    const body = toRawBody(buffer);

    // Invoke verify callback before resolving the body
    if (verify) {
      await verify(ctx, body, 'binary');
    }

    // For raw parser, body is always the raw bytes; rawBody is set for consistency
    ctx.rawBody = body;

    return body;
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
    if (!matchContentType(contentType, types)) {
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
export function raw(options: RawOptions = {}): Middleware {
  return createRawParser(options).middleware;
}

/**
 * @nextrush/body-parser - URL-Encoded Parser
 *
 * Parse URL-encoded request bodies.
 *
 * @packageDocumentation
 */

import type { Middleware } from '@nextrush/types';

import {
  BODYLESS_METHODS,
  DEFAULT_CONTENT_TYPES,
  DEFAULT_LIMITS,
  DEFAULT_PARAMETER_LIMITS,
} from '../constants.js';
import { Errors } from '../errors.js';
import { hasResolvedBody, installLazyReader } from '../lazy.js';
import type { BodyParserContext, UrlEncodedOptions } from '../types.js';
import { bufferToString, toRawBody } from '../utils/buffer.js';
import { matchContentType } from '../utils/content-type.js';
import { readHeader } from '../utils/header-value.js';
import { parseLimit } from '../utils/limit.js';
import { parseUrlEncoded } from '../utils/url-decode.js';
import { readBody } from './reader.js';

/**
 * The URL-encoded parser's two halves: the middleware and the bare read.
 *
 * @internal
 *
 * @remarks
 * Not exported from the package entry point.
 */
export interface UrlEncodedParserParts {
  readonly middleware: Middleware;
  readonly read: (ctx: BodyParserContext) => Promise<unknown>;
}

/**
 * Create the URL-encoded parser's middleware and its read function.
 *
 * @internal
 */
export function createUrlEncodedParser(options: UrlEncodedOptions = {}): UrlEncodedParserParts {
  const {
    limit = DEFAULT_LIMITS.URLENCODED,
    type = DEFAULT_CONTENT_TYPES.URLENCODED,
    rawBody = false,
    extended = true,
    parameterLimit = DEFAULT_PARAMETER_LIMITS.MAX_PARAMS,
    depth = DEFAULT_PARAMETER_LIMITS.MAX_DEPTH,
    verify,
    lazy = false,
  } = options;

  // Pre-compute configuration
  const limitBytes = parseLimit(limit, DEFAULT_LIMITS.URLENCODED);
  const types = Array.isArray(type) ? type : [type];

  const read = async (ctx: BodyParserContext): Promise<unknown> => {
    // Read body
    const buffer = await readBody(ctx, limitBytes);

    // Store raw body if requested (Buffer on Node, Uint8Array on edge)
    if (rawBody) {
      ctx.rawBody = toRawBody(buffer);
    }

    // Handle empty body
    if (buffer.length === 0) {
      return {};
    }

    // Invoke verify callback before parsing
    if (verify) {
      await verify(ctx, toRawBody(buffer), 'utf-8');
    }

    // Parse URL-encoded string
    const str = bufferToString(buffer);

    try {
      return parseUrlEncoded(str, extended, parameterLimit, depth);
    } catch (err) {
      // Re-throw BodyParserError
      if (err instanceof Error && err.name === 'BodyParserError') {
        throw err;
      }

      // Wrap other errors
      throw Errors.invalidUrlEncoded((err as Error).message);
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
export function urlencoded(options: UrlEncodedOptions = {}): Middleware {
  return createUrlEncodedParser(options).middleware;
}

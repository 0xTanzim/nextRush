/**
 * @nextrush/body-parser - Body Reader
 *
 * Core functionality for reading request body streams.
 * Supports all runtimes: Node.js, Bun, Deno, Edge.
 *
 * @packageDocumentation
 */

import { Errors } from '../errors.js';
import type { BodyParserContext } from '../types.js';
import { parseContentLength } from '../utils/content-type.js';
import { readHeader } from '../utils/header-value.js';

/** Shared utf-8 decoder: `decode()` without `{ stream: true }` is stateless. */
const UTF8_DECODER = new TextDecoder('utf-8');

/**
 * Structural probe for a body source that can read text directly.
 *
 * @remarks
 * Probed rather than imported so this package keeps its only dependency on
 * `@nextrush/types` instead of gaining a runtime dependency for one optional
 * capability.
 */
interface TextCapableBodySource {
  readTextIfProvenWithin?: (limit: number) => Promise<string | undefined>;
}

/**
 * Read body from request using cross-runtime BodySource API.
 *
 * Features:
 * - Cross-runtime support (Node.js, Bun, Deno, Edge)
 * - Size limit enforcement (pre-check and post-read validation)
 * - Proper error handling with descriptive messages
 *
 * @param ctx - Request context
 * @param limit - Maximum body size in bytes
 * @returns Promise resolving to body buffer
 * @throws BodyParserError on size limit, abort, or stream error
 *
 * @example
 * ```typescript
 * // Works on any runtime
 * const buffer = await readBody(ctx, 1024 * 1024); // 1MB limit
 * const text = buffer.toString('utf-8');
 * ```
 */
export async function readBody(ctx: BodyParserContext, limit: number): Promise<Uint8Array> {
  const bodySource = ctx.bodySource;

  // No body source available (modern adapters always provide one) — empty body.
  if (!bodySource) {
    return new Uint8Array(0);
  }

  // Pre-check Content-Length if available (synchronous rejection)
  const contentLength = bodySource.contentLength ?? parseContentLength(readHeader(ctx, 'content-length'));
  if (contentLength !== undefined && contentLength > limit) {
    throw Errors.entityTooLarge(contentLength, limit);
  }

  try {
    // Read body as Uint8Array using cross-runtime API. Pass the parser's configured
    // limit so the adapter enforces it incrementally during the read (RFC 017), rather
    // than a fixed adapter default with only a post-materialization check here.
    const uint8Array = await bodySource.buffer(limit);

    // Post-read size check (for chunked transfers without Content-Length)
    if (uint8Array.length > limit) {
      throw Errors.entityTooLargeStreaming(limit);
    }

    // Return the bytes as-is (runtime-agnostic). Parsers decode via TextDecoder
    // and expose raw bytes as a Node Buffer only where the runtime provides one.
    return uint8Array;
  } catch (err) {
    // Re-throw BodyParserError
    if (err instanceof Error && err.name === 'BodyParserError') {
      throw err;
    }

    // Handle BodySource-specific errors
    if (err instanceof Error) {
      if (err.name === 'BodyConsumedError') {
        throw Errors.bodyReadError('Body has already been consumed');
      }
      if (err.name === 'BodyTooLargeError') {
        throw Errors.entityTooLargeStreaming(limit);
      }
      throw Errors.bodyReadError(err.message);
    }

    throw Errors.bodyReadError('Unknown error reading body');
  }
}

/**
 * Read the body as a decoded string, preferring a bounded native text read.
 *
 * @param ctx - Request context.
 * @param limit - Maximum body size in bytes.
 * @returns Decoded body.
 * @throws BodyParserError on size limit, abort, or stream error.
 *
 * @remarks
 * The text path is taken only when the body source can prove the body fits —
 * a declared `Content-Length` within `limit`. Everything else falls back to
 * {@link readBody}, which enforces the limit incrementally while reading, so an
 * unprovable length is never materialised just to be checked afterwards.
 */
export async function readBodyText(ctx: BodyParserContext, limit: number): Promise<string> {
  const bodySource = ctx.bodySource;
  if (!bodySource) return '';

  const contentLength =
    bodySource.contentLength ?? parseContentLength(readHeader(ctx, 'content-length'));
  if (contentLength !== undefined && contentLength > limit) {
    throw Errors.entityTooLarge(contentLength, limit);
  }

  try {
    const capable = bodySource as unknown as TextCapableBodySource;
    if (typeof capable.readTextIfProvenWithin === 'function') {
      const text = await capable.readTextIfProvenWithin(limit);
      if (text !== undefined) return text;
    }
    return UTF8_DECODER.decode(await readBody(ctx, limit));
  } catch (err) {
    if (err instanceof Error && err.name === 'BodyParserError') {
      throw err;
    }

    if (err instanceof Error) {
      if (err.name === 'BodyConsumedError') {
        throw Errors.bodyReadError('Body has already been consumed');
      }
      if (err.name === 'BodyTooLargeError') {
        throw Errors.entityTooLargeStreaming(limit);
      }
      throw Errors.bodyReadError(err.message);
    }

    throw Errors.bodyReadError('Unknown error reading body');
  }
}

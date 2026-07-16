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
import { getContentLength } from '../utils/content-type.js';

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
  // Cross-runtime path: use bodySource
  if (ctx.bodySource) {
    return readBodyFromSource(ctx, limit);
  }

  // No body source available - return empty buffer
  return new Uint8Array(0);
}

/**
 * Read body using the modern BodySource API
 *
 * Works on Node.js, Bun, Deno, and Edge runtimes.
 */
async function readBodyFromSource(ctx: BodyParserContext, limit: number): Promise<Uint8Array> {
  const bodySource = ctx.bodySource!;

  // Pre-check Content-Length if available (synchronous rejection)
  const contentLength = bodySource.contentLength ?? getContentLength(ctx.headers);
  if (contentLength !== undefined && contentLength > limit) {
    throw Errors.entityTooLarge(contentLength, limit);
  }

  try {
    // Read body as Uint8Array using cross-runtime API
    const uint8Array = await bodySource.buffer();

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

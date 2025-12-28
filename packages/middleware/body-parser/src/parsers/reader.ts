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
import { concatBuffers } from '../utils/buffer.js';
import { getContentLength } from '../utils/content-type.js';

/**
 * Read body from request using cross-runtime BodySource API.
 *
 * Features:
 * - Cross-runtime support (Node.js, Bun, Deno, Edge)
 * - Size limit enforcement (pre-check and post-read validation)
 * - Automatic fallback to legacy Node.js stream reading
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
export async function readBody(ctx: BodyParserContext, limit: number): Promise<Buffer> {
  // Modern cross-runtime path: use bodySource if available
  if (ctx.bodySource) {
    return readBodyFromSource(ctx, limit);
  }

  // Legacy Node.js path: use raw.req stream
  if (ctx.raw?.req) {
    return readBodyFromNodeStream(ctx, limit);
  }

  // No body source available - return empty buffer
  return Buffer.alloc(0);
}

/**
 * Read body using the modern BodySource API
 *
 * Works on Node.js, Bun, Deno, and Edge runtimes.
 */
async function readBodyFromSource(ctx: BodyParserContext, limit: number): Promise<Buffer> {
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

    // Convert Uint8Array to Buffer for consistency with existing code
    return Buffer.from(uint8Array);
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
 * Read body using Node.js stream API (legacy fallback)
 *
 * @deprecated Prefer using BodySource for cross-runtime compatibility.
 */
function readBodyFromNodeStream(ctx: BodyParserContext, limit: number): Promise<Buffer> {
  // Pre-check Content-Length if available (synchronous rejection)
  const contentLength = getContentLength(ctx.headers);

  if (contentLength !== undefined && contentLength > limit) {
    return Promise.reject(Errors.entityTooLarge(contentLength, limit));
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;
    let finished = false;
    const req = ctx.raw!.req!;

    /**
     * Clean up all event listeners
     */
    const cleanup = (): void => {
      if (finished) return;
      finished = true;

      try {
        req.off('data', onData);
        req.off('end', onEnd);
        req.off('error', onError);
        req.off('close', onClose);
        req.off('aborted', onAborted);
      } catch {
        // Ignore cleanup errors (request may already be destroyed)
      }
    };

    /**
     * Handle incoming data chunk
     */
    const onData = (chunk: Buffer): void => {
      if (finished) return;

      received += chunk.length;

      // Check size limit during streaming
      if (received > limit) {
        cleanup();
        reject(Errors.entityTooLargeStreaming(limit));
        return;
      }

      chunks.push(chunk);
    };

    /**
     * Handle successful stream end
     */
    const onEnd = (): void => {
      if (finished) return;
      cleanup();
      resolve(concatBuffers(chunks, received));
    };

    /**
     * Handle stream error
     */
    const onError = (err: Error): void => {
      if (finished) return;
      cleanup();
      reject(Errors.bodyReadError(err.message));
    };

    /**
     * Handle connection close (client disconnect)
     */
    const onClose = (): void => {
      if (finished) return;
      cleanup();
      reject(Errors.requestClosed());
    };

    /**
     * Handle request abort
     */
    const onAborted = (): void => {
      if (finished) return;
      cleanup();
      reject(Errors.requestAborted());
    };

    // Check if request is already destroyed
    if (req.destroyed) {
      reject(Errors.requestClosed());
      return;
    }

    // Attach event listeners
    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
    req.on('close', onClose);
    req.on('aborted', onAborted);
  });
}

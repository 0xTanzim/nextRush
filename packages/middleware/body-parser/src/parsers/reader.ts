/**
 * @nextrush/body-parser - Body Reader
 *
 * Core functionality for reading request body streams.
 *
 * @packageDocumentation
 */

import { Errors } from '../errors.js';
import type { BodyParserContext } from '../types.js';
import { concatBuffers } from '../utils/buffer.js';
import { getContentLength } from '../utils/content-type.js';

/**
 * Read body from request stream with proper cleanup.
 *
 * Features:
 * - Size limit enforcement (pre-check and streaming)
 * - Request abort/close handling (prevents memory leaks)
 * - Single-chunk optimization (avoids allocation for most requests)
 * - Proper event listener cleanup
 *
 * @param ctx - Request context
 * @param limit - Maximum body size in bytes
 * @returns Promise resolving to body buffer
 * @throws BodyParserError on size limit, abort, or stream error
 */
export function readBody(ctx: BodyParserContext, limit: number): Promise<Buffer> {
  // Pre-check Content-Length if available (synchronous rejection)
  const contentLength = getContentLength(ctx.headers);

  if (contentLength !== undefined && contentLength > limit) {
    return Promise.reject(Errors.entityTooLarge(contentLength, limit));
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;
    let finished = false;

    /**
     * Clean up all event listeners
     */
    const cleanup = (): void => {
      if (finished) return;
      finished = true;

      try {
        ctx.raw.req.off('data', onData);
        ctx.raw.req.off('end', onEnd);
        ctx.raw.req.off('error', onError);
        ctx.raw.req.off('close', onClose);
        ctx.raw.req.off('aborted', onAborted);
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
    if (ctx.raw.req.destroyed) {
      reject(Errors.requestClosed());
      return;
    }

    // Attach event listeners
    ctx.raw.req.on('data', onData);
    ctx.raw.req.on('end', onEnd);
    ctx.raw.req.on('error', onError);
    ctx.raw.req.on('close', onClose);
    ctx.raw.req.on('aborted', onAborted);
  });
}

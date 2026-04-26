/**
 * @nextrush/multipart - Middleware Factory
 *
 * Creates a Koa-style async middleware that parses multipart/form-data
 * requests and populates ctx.state with uploaded files and fields.
 *
 * Zero dependencies — works on Node.js, Bun, Deno, and Edge runtimes.
 *
 * @packageDocumentation
 */

import type { Context, Middleware, Next } from '@nextrush/types';

import { BODYLESS_METHODS, MULTIPART_CONTENT_TYPE, extractBoundary } from './constants.js';
import { Errors } from './errors.js';
import { parseMultipart } from './parser.js';
import type { MultipartOptions, MultipartState } from './types.js';

/**
 * Create multipart/form-data middleware.
 *
 * Parses file uploads and form fields from multipart requests.
 * After processing, `ctx.state.files` contains uploaded files and
 * `ctx.state.fields` contains non-file form fields.
 *
 * @example
 * ```typescript
 * import { multipart } from '@nextrush/multipart';
 *
 * // Basic usage (MemoryStorage, default limits)
 * app.use(multipart());
 *
 * // With disk storage (Node.js/Bun/Deno only)
 * import { DiskStorage } from '@nextrush/multipart';
 * app.use(multipart({
 *   storage: new DiskStorage({ dest: './uploads' }),
 *   limits: { maxFileSize: '50mb', maxFiles: 5 },
 *   allowedTypes: ['image/*', 'application/pdf'],
 * }));
 * ```
 */
export function multipart(options: MultipartOptions = {}): Middleware {
  return async (ctx: Context, next: Next): Promise<void> => {
    // Skip non-body methods
    if (BODYLESS_METHODS.has(ctx.method)) {
      await next();
      return;
    }

    // Check content type
    const rawContentType = getRawContentType(ctx.headers);
    if (!rawContentType || !rawContentType.toLowerCase().startsWith(MULTIPART_CONTENT_TYPE)) {
      await next();
      return;
    }

    // Extract boundary (from original case — boundary is case-sensitive per RFC 2046)
    const boundary = extractBoundary(rawContentType);
    if (!boundary) {
      throw Errors.parseError('Missing boundary in Content-Type header');
    }

    // Get the request body as a ReadableStream or Uint8Array
    const body = await getRequestBody(ctx);
    if (!body) {
      throw Errors.parseError('Unable to read request body');
    }

    // Parse the multipart data
    const result = await parseMultipart(body, boundary, options);

    // Populate ctx.state
    const state = ctx.state as Record<string, unknown>;
    const multipartState: MultipartState = {
      files: result.files,
      fields: result.fields,
    };

    state.files = multipartState.files;
    state.fields = multipartState.fields;

    await next();
  };
}

/**
 * Extract the raw content-type header value (case-preserved).
 * Handles both string and string[] header values.
 */
function getRawContentType(
  headers: Record<string, string | string[] | undefined>
): string | undefined {
  const value = headers['content-type'];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Get the request body as a ReadableStream or Uint8Array.
 *
 * Tries multiple access patterns for cross-runtime compatibility:
 * 1. bodySource.stream() — NextRush standard (returns ReadableStream on all adapters)
 * 2. bodySource.buffer() — NextRush standard (returns Uint8Array)
 * 3. ctx.raw.req (Node.js IncomingMessage — convert to ReadableStream if available)
 */
async function getRequestBody(ctx: Context): Promise<ReadableStream<Uint8Array> | Uint8Array | undefined> {
  // Modern path: use bodySource
  if (ctx.bodySource && !ctx.bodySource.consumed) {
    const stream = ctx.bodySource.stream();

    // Web ReadableStream — use directly
    if (isWebReadableStream(stream)) {
      return stream as ReadableStream<Uint8Array>;
    }

    // Node.js Readable — convert via async iteration
    if (isNodeReadable(stream)) {
      const streamObj = stream as unknown;
      if (
        typeof streamObj === 'object' &&
        streamObj !== null &&
        Symbol.asyncIterator in streamObj
      ) {
        return readableToWebStream(streamObj);
      }
    }

    // Fallback to buffer
    const buffer = await ctx.bodySource.buffer();
    return buffer;
  }

  // Legacy path: raw request — try to get a Web ReadableStream
  if (ctx.raw?.req) {
    const req = ctx.raw.req as unknown;

    // Bun/Deno may expose a body property as ReadableStream
    if (typeof req === 'object' && req !== null && 'body' in (req as object)) {
      const body = (req as Record<string, unknown>)['body'];
      if (isWebReadableStream(body)) {
        return body as ReadableStream<Uint8Array>;
      }
    }

    // Node.js IncomingMessage — convert to ReadableStream
    if (isNodeReadable(req)) {
      return readableToWebStream(req);
    }
  }

  return undefined;
}

function isWebReadableStream(obj: unknown): boolean {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof (obj as Record<string, unknown>).getReader === 'function'
  );
}

function isNodeReadable(obj: unknown): boolean {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof (obj as Record<string, unknown>).pipe === 'function'
  );
}

/**
 * Convert a Node.js-style readable (async iterable) to a Web ReadableStream.
 * Works on Node.js 22+, Bun, and Deno.
 */
function readableToWebStream(readable: unknown): ReadableStream<Uint8Array> {
  const iterable = readable as AsyncIterable<Uint8Array>;

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of iterable) {
          controller.enqueue(
            chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk as ArrayBuffer)
          );
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

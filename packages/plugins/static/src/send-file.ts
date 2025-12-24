/**
 * @nextrush/static - File Sending
 *
 * Handles streaming files with proper headers, range requests, and caching.
 *
 * @packageDocumentation
 */

import type { Context } from '@nextrush/types';
import { createReadStream, promises as fsp } from 'node:fs';
import type { NormalizedStaticOptions, StatsLike } from './static.types';
import { generateETag, getMimeType, isFresh, parseRange } from './utils';

/**
 * Set common response headers for file serving
 */
function setFileHeaders(
  ctx: Context,
  absolutePath: string,
  stat: StatsLike,
  options: NormalizedStaticOptions
): string {
  // Content-Type
  const mimeType = getMimeType(absolutePath);
  ctx.set('Content-Type', mimeType);

  // Content-Length
  ctx.set('Content-Length', stat.size);

  // Last-Modified
  if (options.lastModified) {
    ctx.set('Last-Modified', stat.mtime.toUTCString());
  }

  // ETag
  let etag = '';
  if (options.etag) {
    etag = generateETag(stat);
    ctx.set('ETag', etag);
  }

  // Accept-Ranges
  if (options.acceptRanges) {
    ctx.set('Accept-Ranges', 'bytes');
  }

  // Cache-Control
  if (options.maxAge > 0) {
    const directives = ['public', `max-age=${options.maxAge}`];
    if (options.immutable) {
      directives.push('immutable');
    }
    ctx.set('Cache-Control', directives.join(', '));
  }

  // Custom headers hook
  if (options.setHeaders) {
    options.setHeaders(ctx, absolutePath, stat);
  }

  return etag;
}

/**
 * Send file response with streaming
 *
 * Handles:
 * - Conditional requests (304 Not Modified)
 * - Range requests (206 Partial Content)
 * - HEAD requests
 * - Full file streaming
 */
export async function sendFile(
  ctx: Context,
  absolutePath: string,
  stat: StatsLike,
  options: NormalizedStaticOptions
): Promise<void> {
  const etag = setFileHeaders(ctx, absolutePath, stat, options);

  // Handle conditional requests (304)
  if (options.etag || options.lastModified) {
    if (isFresh(ctx, stat, etag)) {
      ctx.status = 304;
      // Remove content headers for 304
      ctx.raw.res.removeHeader('Content-Type');
      ctx.raw.res.removeHeader('Content-Length');
      ctx.raw.res.end();
      return;
    }
  }

  // Handle range requests
  const rangeHeader = ctx.headers['range'];
  if (options.acceptRanges && typeof rangeHeader === 'string') {
    const range = parseRange(rangeHeader, stat.size);

    if (range) {
      // Valid range - send partial content
      const { start, end } = range;
      const contentLength = end - start + 1;

      ctx.status = 206;
      ctx.set('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      ctx.set('Content-Length', contentLength);

      // HEAD request - just headers
      if (ctx.method === 'HEAD') {
        ctx.raw.res.end();
        return;
      }

      // Stream partial content
      const stream = createReadStream(absolutePath, { start, end });
      await streamToResponse(ctx, stream);
      return;
    }

    // Unsatisfiable range
    ctx.status = 416;
    ctx.set('Content-Range', `bytes */${stat.size}`);
    ctx.raw.res.removeHeader('Content-Length');
    ctx.raw.res.end();
    return;
  }

  // HEAD request - just headers
  if (ctx.method === 'HEAD') {
    ctx.raw.res.end();
    return;
  }

  // Small files - read entire content
  if (stat.size <= options.highWaterMark) {
    const content = await fsp.readFile(absolutePath);
    ctx.raw.res.end(content);
    return;
  }

  // Large files - stream
  const stream = createReadStream(absolutePath);
  await streamToResponse(ctx, stream);
}

/**
 * Stream file to response with error handling
 */
function streamToResponse(
  ctx: Context,
  stream: ReturnType<typeof createReadStream>
): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.on('error', (err) => {
      // Only set error if headers not sent
      if (!ctx.raw.res.headersSent) {
        ctx.status = 500;
        ctx.raw.res.end();
      }
      reject(err);
    });

    stream.on('end', resolve);

    // Pipe stream to response
    stream.pipe(ctx.raw.res);
  });
}

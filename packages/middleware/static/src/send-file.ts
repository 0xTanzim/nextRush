/**
 * @nextrush/static - File Sending
 *
 * Handles streaming files with proper headers, range requests, and caching.
 *
 * @packageDocumentation
 */

import * as fsp from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { getCachedFileMetadata } from './metadata-cache';
import type { NodeContext, NormalizedStaticOptions, StatsLike } from './static.types';
import { isFresh, isScriptCapable, parseRange } from './utils';

/**
 * Set common response headers for file serving
 */
function setFileHeaders(
  ctx: NodeContext,
  absolutePath: string,
  stat: StatsLike,
  options: NormalizedStaticOptions
): string {
  // MIME type, ETag, and Last-Modified are all pure functions of `stat` (size
  // + mtime) and the path's extension — cached so an unchanged file skips the
  // Date formatting and FNV-1a hash on every request. `statSafe()` above this
  // call still ran, so freshness is never skipped; only the *derivation* of
  // these three fields is.
  const cached = getCachedFileMetadata(absolutePath, stat);

  // Content-Type — downgraded to application/octet-stream under untrusted
  // mode for any script-capable type (SEC-11), regardless of whether this
  // path came from a direct match, a directory index, or an extension
  // fallback — sendFile() is the single place every resolution converges.
  const neutralize = options.untrusted && isScriptCapable(absolutePath);
  const mimeType = neutralize ? 'application/octet-stream' : cached.mimeType;
  ctx.set('Content-Type', mimeType);

  if (options.untrusted) {
    ctx.set('Content-Disposition', 'attachment');
    ctx.set('Content-Security-Policy', "sandbox; default-src 'none'");
  }

  // X-Content-Type-Options (prevent MIME sniffing)
  if (options.xContentTypeOptions) {
    ctx.set('X-Content-Type-Options', 'nosniff');
  }

  // Content-Length
  ctx.set('Content-Length', stat.size);

  // Last-Modified
  if (options.lastModified) {
    ctx.set('Last-Modified', cached.lastModifiedString);
  }

  // ETag
  let etag = '';
  if (options.etag) {
    etag = cached.etag;
    ctx.set('ETag', etag);
  }

  // Accept-Ranges
  if (options.acceptRanges) {
    ctx.set('Accept-Ranges', 'bytes');
  }

  // Cache-Control — precomputed once at registration time (index.ts's
  // normalizeOptions), not rebuilt on every request.
  if (options.cacheControlValue) {
    ctx.set('Cache-Control', options.cacheControlValue);
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
 * - TOCTOU-safe reads (SEC-13): a single descriptor is opened for the
 *   request and every subsequent operation (size verification, read,
 *   stream) uses that same descriptor rather than re-resolving `absolutePath`
 *   by name, so a symlink swapped in after the safety check cannot be
 *   followed.
 */
export async function sendFile(
  ctx: NodeContext,
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

  // Open exactly once for the request (SEC-13); every branch below reads
  // from this handle, never from `absolutePath` again.
  const handle = await fsp.open(absolutePath, 'r');

  try {
    // Handle range requests
    const rangeHeader = ctx.headers.range;
    if (options.acceptRanges && typeof rangeHeader === 'string') {
      const range = parseRange(rangeHeader, stat.size);

      if (range) {
        // Valid range - send partial content
        const { start, end } = range;
        const contentLength = end - start + 1;

        ctx.status = 206;
        ctx.set('Content-Range', `bytes ${String(start)}-${String(end)}/${String(stat.size)}`);
        ctx.set('Content-Length', contentLength);

        // HEAD request - just headers
        if (ctx.method === 'HEAD') {
          ctx.raw.res.end();
          return;
        }

        // Stream partial content from the already-open descriptor.
        const stream = handle.createReadStream({ start, end });
        await streamToResponse(ctx, stream, options.streamTimeout);
        return;
      }

      // Unsatisfiable range
      ctx.status = 416;
      ctx.set('Content-Range', `bytes */${String(stat.size)}`);
      ctx.raw.res.removeHeader('Content-Length');
      ctx.raw.res.end();
      return;
    }

    // HEAD request - just headers
    if (ctx.method === 'HEAD') {
      ctx.raw.res.end();
      return;
    }

    // Small files - read entire content with TOCTOU-safe fstat verification
    if (stat.size <= options.highWaterMark) {
      const fstat = await handle.stat();
      const content = await handle.readFile();

      // Update Content-Length if the descriptor's own size differs from the
      // pre-open stat (file grew/shrank between the safety check and open —
      // the descriptor's view, not the stale stat, is authoritative).
      if (fstat.size !== stat.size || content.length !== fstat.size) {
        ctx.set('Content-Length', content.length);
      }

      ctx.raw.res.end(content);
      return;
    }

    // Large files - stream from the already-open descriptor
    const stream = handle.createReadStream();
    await streamToResponse(ctx, stream, options.streamTimeout);
  } finally {
    // streamToResponse's own stream (fd-backed) closes the descriptor when
    // it ends/errors; the small-file and HEAD/range-rejection paths never
    // hand the handle to a stream, so they must close it here. A
    // double-close is a no-op on a FileHandle.
    await handle.close().catch(() => {
      /* already closed by the stream, or never opened past this point */
    });
  }
}

/**
 * Stream file to response with error handling and timeout
 */
function streamToResponse(
  ctx: NodeContext,
  stream: ReturnType<FileHandle['createReadStream']>,
  timeout: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let settled = false;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    };

    const settle = (fn: () => void) => {
      if (!settled) {
        settled = true;
        cleanup();
        fn();
      }
    };

    // Set up timeout if configured
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        settle(() => {
          stream.destroy();
          if (!ctx.raw.res.headersSent) {
            ctx.status = 504; // Gateway Timeout
            ctx.raw.res.end();
          }
          reject(new Error('Stream timeout'));
        });
      }, timeout);
    }

    stream.on('error', (err) => {
      settle(() => {
        // Only set error if headers not sent
        if (!ctx.raw.res.headersSent) {
          ctx.status = 500;
          ctx.raw.res.end();
        }
        reject(err);
      });
    });

    stream.on('end', () => {
      settle(resolve);
    });

    // Handle client disconnect
    ctx.raw.res.on('close', () => {
      if (!settled) {
        stream.destroy();
        settle(resolve);
      }
    });

    // Pipe stream to response
    stream.pipe(ctx.raw.res);
  });
}

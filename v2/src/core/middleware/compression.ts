/**
 * Compression middleware for NextRush v2
 *
 * @packageDocumentation
 */

import type { CompressionOptions } from '@/core/middleware/types';
import type { Context, Middleware } from '@/types/context';
import { pipeline } from 'node:stream';
import { createBrotliCompress, createDeflate, createGzip } from 'node:zlib';

/**
 * Default compression options
 */
const defaultCompressionOptions: Required<CompressionOptions> = {
  level: 6,
  threshold: 1024,
  filter: () => true,
  contentType: ['text/*', 'application/json', 'application/xml'],
  exclude: ['image/*', 'video/*', 'audio/*'],
  gzip: true,
  deflate: true,
  brotli: false,
  windowBits: 15,
  memLevel: 8,
  strategy: 0,
  chunkSize: 16384,
  dictionary: Buffer.alloc(0),
};

/**
 * Check if content type should be compressed
 */
function shouldCompressContentType(
  contentType: string,
  options: Required<CompressionOptions>
): boolean {
  if (!contentType) return false;

  // Check exclude list first
  for (const excludePattern of options.exclude) {
    if (contentType.startsWith(excludePattern.replace('*', ''))) {
      return false;
    }
  }

  // Check include list
  for (const includePattern of options.contentType) {
    if (contentType.startsWith(includePattern.replace('*', ''))) {
      return true;
    }
  }

  return false;
}

/**
 * Get best compression algorithm based on Accept-Encoding header
 */
function getBestCompression(
  acceptEncoding: string,
  options: Required<CompressionOptions>
): 'gzip' | 'deflate' | 'br' | null {
  const algorithms = acceptEncoding
    .toLowerCase()
    .split(',')
    .map(a => a.trim())
    .map(a => a.split(';')[0]?.trim() || ''); // Remove quality values

  // Check for brotli support
  if (options.brotli && algorithms.includes('br')) {
    return 'br';
  }

  // Check for gzip support
  if (options.gzip && algorithms.includes('gzip')) {
    return 'gzip';
  }

  // Check for deflate support
  if (options.deflate && algorithms.includes('deflate')) {
    return 'deflate';
  }

  return null;
}

/**
 * Create compression stream
 */
function createCompressionStream(
  algorithm: 'gzip' | 'deflate' | 'br',
  options: Required<CompressionOptions>
) {
  switch (algorithm) {
    case 'gzip':
      return createGzip({
        level: options.level,
        windowBits: options.windowBits,
        memLevel: options.memLevel,
        strategy: options.strategy,
        chunkSize: options.chunkSize,
        dictionary: options.dictionary,
      });
    case 'deflate':
      return createDeflate({
        level: options.level,
        windowBits: options.windowBits,
        memLevel: options.memLevel,
        strategy: options.strategy,
        chunkSize: options.chunkSize,
        dictionary: options.dictionary,
      });
    case 'br':
      return createBrotliCompress({
        params: {
          0: options.level || 6, // BROTLI_PARAM_QUALITY
          1: options.chunkSize || 16384, // BROTLI_PARAM_SIZE_HINT
        },
      });
    default:
      throw new Error(`Unsupported compression algorithm: ${algorithm}`);
  }
}

/**
 * Create compression middleware
 */
export function compression(options: CompressionOptions = {}): Middleware {
  // Merge with defaults
  const config: Required<CompressionOptions> = {
    ...defaultCompressionOptions,
    ...options,
  };

  return async (ctx: Context, next: () => Promise<void>) => {
    // Check if response should be compressed
    if (!config.filter(ctx)) {
      await next();
      return;
    }

    // Get Accept-Encoding header
    const acceptEncoding = ctx.req.headers['accept-encoding'] || '';
    const algorithm = getBestCompression(acceptEncoding, config);

    if (!algorithm) {
      await next();
      return;
    }

    // Store original response methods
    const originalEnd = ctx.res.end;
    const originalWrite = ctx.res.write;
    const originalSetHeader = ctx.res.setHeader;

    let compressed = false;
    let compressionStream: NodeJS.ReadableStream | null = null;

    // Override setHeader to capture content-type
    ctx.res.setHeader = function (name: string, value: string | string[]) {
      if (name.toLowerCase() === 'content-type') {
        const contentType = Array.isArray(value) ? value[0] : value;

        // Check if content should be compressed
        if (!shouldCompressContentType(contentType || '', config)) {
          originalSetHeader.call(this, name, value);
          return ctx.res;
        }

        // Set compression headers
        originalSetHeader.call(this, 'Content-Encoding', algorithm);
        originalSetHeader.call(this, 'Vary', 'Accept-Encoding');

        // Create compression stream
        compressionStream = createCompressionStream(algorithm, config);
        compressed = true;
      }

      originalSetHeader.call(this, name, value);
      return ctx.res;
    };

    // Override write to compress data
    ctx.res.write = function (
      chunk: unknown,
      encoding?: BufferEncoding | ((error?: Error | null) => void),
      callback?: (error?: Error | null) => void
    ) {
      if (compressed && compressionStream) {
        (compressionStream as any).write(chunk, encoding, callback);
        return true;
      }
      return originalWrite.call(
        this,
        chunk,
        encoding as BufferEncoding,
        callback as (error?: Error | null) => void
      );
    };

    // Override end to finalize compression
    ctx.res.end = function (
      chunk?: unknown,
      encoding?: BufferEncoding | (() => void),
      callback?: () => void
    ) {
      if (compressed && compressionStream) {
        if (chunk) {
          (compressionStream as any).write(chunk, encoding);
        }
        (compressionStream as any).end();

        // Pipe compressed data to response
        pipeline(
          compressionStream,
          ctx.res as NodeJS.WritableStream,
          (error: NodeJS.ErrnoException | null) => {
            if (error) {
              // eslint-disable-next-line no-console
              console.error('Compression error:', error);
              // Fallback to uncompressed response
              if (chunk) {
                originalWrite.call(
                  ctx.res,
                  chunk,
                  (encoding as BufferEncoding) || 'utf8'
                );
              }
              originalEnd.call(
                ctx.res,
                chunk,
                (encoding as BufferEncoding) || 'utf8',
                callback
              );
            }
          }
        );
      } else {
        originalEnd.call(
          this,
          chunk,
          (encoding as BufferEncoding) || 'utf8',
          callback
        );
      }
      return ctx.res;
    };

    await next();
  };
}

/**
 * Create compression middleware with specific algorithm
 */
export function compressionWithAlgorithm(
  algorithm: 'gzip' | 'deflate' | 'br',
  options: CompressionOptions = {}
): Middleware {
  const config = {
    ...options,
    gzip: algorithm === 'gzip',
    deflate: algorithm === 'deflate',
    brotli: algorithm === 'br',
  };

  return compression(config);
}

/**
 * Gzip-only compression middleware
 */
export function gzip(options: CompressionOptions = {}): Middleware {
  return compressionWithAlgorithm('gzip', options);
}

/**
 * Deflate-only compression middleware
 */
export function deflate(options: CompressionOptions = {}): Middleware {
  return compressionWithAlgorithm('deflate', options);
}

/**
 * Brotli-only compression middleware
 */
export function brotli(options: CompressionOptions = {}): Middleware {
  return compressionWithAlgorithm('br', options);
}

/**
 * Compression middleware with performance metrics
 */
export function compressionWithMetrics(
  options: CompressionOptions = {}
): Middleware {
  const compressionMiddleware = compression(options);

  return async (ctx: Context, next: () => Promise<void>) => {
    const startTime = Date.now();

    await compressionMiddleware(ctx, next);

    const duration = Date.now() - startTime;

    // Log slow compression operations
    if (duration > 100) {
      console.warn(`Slow compression operation: ${duration}ms`);
    }
  };
}

/**
 * Compression utilities for testing and advanced usage
 */
export const compressionUtils = {
  /**
   * Check if content type should be compressed
   */
  shouldCompressContentType,

  /**
   * Get best compression algorithm
   */
  getBestCompression,

  /**
   * Create compression stream
   */
  createCompressionStream,

  /**
   * Default compression options
   */
  DEFAULT_OPTIONS: defaultCompressionOptions,
};

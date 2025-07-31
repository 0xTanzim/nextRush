/**
 * Compression Middleware for NextRush v2
 *
 * Provides response compression functionality
 *
 * @packageDocumentation
 */

import type { Context } from '@/types/context';
import { pipeline } from 'node:stream/promises';
import {
  constants,
  createBrotliCompress,
  createDeflate,
  createGzip,
} from 'node:zlib';
import type { CompressionOptions, Middleware } from './types';

/**
 * Default compression options
 */
const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
  level: 6,
  threshold: 1024,
  filter: () => true,
  contentType: ['text/*', 'application/*', 'json'],
  exclude: [],
  gzip: true,
  deflate: true,
  brotli: false,
  windowBits: 15,
  memLevel: 8,
  strategy: 0,
  chunkSize: 16 * 1024,
  // dictionary is optional, so we don't set it in defaults
};

/**
 * Supported compression algorithms
 */
type CompressionAlgorithm = 'gzip' | 'deflate' | 'br';

/**
 * Check if content type should be compressed
 */
function shouldCompressContentType(
  contentType: string,
  options: Required<CompressionOptions>
): boolean {
  // Check exclusions first
  for (const exclude of options.exclude) {
    if (contentType.includes(exclude)) {
      return false;
    }
  }

  // Check inclusions
  for (const include of options.contentType) {
    if (contentType.includes(include.replace('*', ''))) {
      return true;
    }
  }

  return false;
}

/**
 * Get the best compression algorithm based on Accept-Encoding header
 */
function getBestCompression(
  acceptEncoding: string,
  options: Required<CompressionOptions>
): CompressionAlgorithm | null {
  const algorithms: CompressionAlgorithm[] = [];

  if (options.brotli) algorithms.push('br');
  if (options.gzip) algorithms.push('gzip');
  if (options.deflate) algorithms.push('deflate');

  // Parse Accept-Encoding header
  const accepted = acceptEncoding
    .toLowerCase()
    .split(',')
    .map(s => s.trim().split(';')[0]);

  for (const algorithm of algorithms) {
    if (accepted.includes(algorithm)) {
      return algorithm;
    }
  }

  return null;
}

/**
 * Create compression stream based on algorithm
 */
function createCompressionStream(
  algorithm: CompressionAlgorithm,
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
          [constants.BROTLI_PARAM_QUALITY]: options.level,
        },
      });

    default:
      throw new Error(`Unsupported compression algorithm: ${algorithm}`);
  }
}

/**
 * Create compression middleware
 *
 * @param options - Compression configuration options
 * @returns Compression middleware function
 *
 * @example
 * ```typescript
 * import { compression } from '@/core/middleware/compression';
 *
 * const app = createApp();
 *
 * // Basic compression
 * app.use(compression());
 *
 * // Advanced compression
 * app.use(compression({
 *   level: 9,
 *   threshold: 2048,
 *   filter: (ctx) => ctx.path.startsWith('/api'),
 *   contentType: ['text/*', 'application/json'],
 * }));
 * ```
 */
export function compression(options: CompressionOptions = {}): Middleware {
  const config = { ...DEFAULT_COMPRESSION_OPTIONS, ...options };

  return async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    // Check if compression should be applied
    if (!config.filter?.(ctx)) {
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
        if (
          !shouldCompressContentType(
            contentType,
            config as Required<CompressionOptions>
          )
        ) {
          originalSetHeader.call(this, name, value);
          return ctx.res;
        }

        // Set compression headers
        originalSetHeader.call(this, 'Content-Encoding', algorithm);
        originalSetHeader.call(this, 'Vary', 'Accept-Encoding');

        // Create compression stream
        compressionStream = createCompressionStream(
          algorithm,
          config as Required<CompressionOptions>
        );
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
      return originalWrite.call(this, chunk, encoding as BufferEncoding, callback);
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
        pipeline(compressionStream, ctx.res).catch(error => {
          // eslint-disable-next-line no-console
          console.error('Compression error:', error);
          // Fallback to uncompressed response
          if (chunk) {
            originalWrite.call(ctx.res, chunk, (encoding as BufferEncoding) || 'utf8');
          }
          originalEnd.call(ctx.res, callback);
        });
      } else {
        originalEnd.call(this, chunk, (encoding as BufferEncoding) || 'utf8', callback);
      }
      return ctx.res;
    };

    await next();
  };
}

/**
 * Create compression middleware with specific algorithm
 *
 * @param algorithm - Compression algorithm to use
 * @param options - Compression configuration options
 * @returns Compression middleware function
 */
export function compressionWithAlgorithm(
  algorithm: CompressionAlgorithm,
  options: CompressionOptions = {}
): Middleware {
  return compression({
    ...options,
    gzip: algorithm === 'gzip',
    deflate: algorithm === 'deflate',
    brotli: algorithm === 'br',
  });
}

/**
 * Create gzip compression middleware
 *
 * @param options - Compression configuration options
 * @returns Gzip compression middleware function
 */
export function gzip(options: CompressionOptions = {}): Middleware {
  return compressionWithAlgorithm('gzip', options);
}

/**
 * Create deflate compression middleware
 *
 * @param options - Compression configuration options
 * @returns Deflate compression middleware function
 */
export function deflate(options: CompressionOptions = {}): Middleware {
  return compressionWithAlgorithm('deflate', options);
}

/**
 * Create brotli compression middleware
 *
 * @param options - Compression configuration options
 * @returns Brotli compression middleware function
 */
export function brotli(options: CompressionOptions = {}): Middleware {
  return compressionWithAlgorithm('br', options);
}

/**
 * Create compression middleware with metrics
 *
 * @param options - Compression configuration options
 * @returns Compression middleware function with performance monitoring
 */
export function compressionWithMetrics(
  options: CompressionOptions = {}
): Middleware {
  const compressionMiddleware = compression(options);

  return async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    const start = process.hrtime.bigint();

    await compressionMiddleware(ctx, async () => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to milliseconds

      if (duration > 1) {
        // eslint-disable-next-line no-console
        console.warn(`Slow compression: ${duration.toFixed(3)}ms`);
      }

      await next();
    });
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
  DEFAULT_OPTIONS: DEFAULT_COMPRESSION_OPTIONS,
};

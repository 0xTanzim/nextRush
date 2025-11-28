/**
 * Compression Middleware for NextRush v2
 *
 * High-performance compression middleware with support for gzip, deflate, and brotli.
 *
 * @packageDocumentation
 */

import type { Context, Middleware, NextRushResponse } from '@/types/context';
import { performance } from 'node:perf_hooks';
import type { CompressionOptions } from '../types';

import { CompressionStream, createSimpleCompressionStream } from './stream-wrapper';
import type { CompressionMetrics, EnhancedCompressionOptions } from './types';
import {
  COMPRESSION_LEVEL,
  CPU_USAGE,
  DEFAULT_COMPRESSION_OPTIONS,
} from './types';
import {
  compilePatterns,
  getBestCompression,
  getCompressionLevel,
  getContentLength,
  getContentType,
  isAlreadyCompressed,
  shouldCompress,
  shouldCompressContentType,
  shouldSkipForCpuUsage,
} from './utils';

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate compression options
 */
function validateCompressionOptions(options: CompressionOptions): void {
  const config = { ...DEFAULT_COMPRESSION_OPTIONS, ...options };

  if (
    !Number.isInteger(config.level) ||
    config.level < COMPRESSION_LEVEL.MIN ||
    config.level > COMPRESSION_LEVEL.MAX
  ) {
    throw new Error(
      `Compression level must be an integer between ${COMPRESSION_LEVEL.MIN} and ${COMPRESSION_LEVEL.MAX}`
    );
  }

  if (config.threshold < 0) {
    throw new Error('Threshold must be non-negative');
  }

  if (
    config.maxCpuUsage &&
    (config.maxCpuUsage < CPU_USAGE.MIN || config.maxCpuUsage > CPU_USAGE.MAX)
  ) {
    throw new Error(
      `maxCpuUsage must be between ${CPU_USAGE.MIN} and ${CPU_USAGE.MAX}`
    );
  }

  if (!config.gzip && !config.deflate && !config.brotli) {
    throw new Error('At least one compression algorithm must be enabled');
  }
}

// =============================================================================
// Response Override
// =============================================================================

/**
 * Override response methods to pipe through compression
 */
function overrideResponseMethods(
  ctx: Context,
  compressionStream: CompressionStream
): void {
  const originalWrite = ctx.res.write.bind(ctx.res);
  const originalEnd = ctx.res.end.bind(ctx.res);

  let isCompressing = false;
  let hasError = false;

  compressionStream.on('data', chunk => {
    if (!hasError) {
      originalWrite(chunk);
    }
  });

  compressionStream.on('end', () => {
    if (!hasError) {
      originalEnd();
    }
  });

  compressionStream.on('error', err => {
    hasError = true;
    // Remove compression headers on error
    ctx.res.removeHeader('Content-Encoding');
    ctx.res.removeHeader('Vary');
    console.error('[CompressionMiddleware] Compression failed:', err);
  });

  // Override write method
  ctx.res.write = function (
    chunk: unknown,
    encoding?: BufferEncoding | ((error: Error | null | undefined) => void),
    callback?: (error: Error | null | undefined) => void
  ): boolean {
    if (!hasError && !isCompressing) {
      isCompressing = true;
      if (typeof encoding === 'function') {
        compressionStream.write(chunk, encoding);
      } else {
        compressionStream.write(chunk, encoding || 'utf8', callback);
      }
    }
    return true;
  };

  // Override end method
  ctx.res.end = function (
    chunk?: unknown,
    encoding?: BufferEncoding | (() => void),
    callback?: () => void
  ): NextRushResponse {
    if (!hasError && !isCompressing) {
      isCompressing = true;
      if (chunk) {
        if (typeof encoding === 'function') {
          compressionStream.end(chunk, encoding);
        } else {
          compressionStream.end(chunk, encoding || 'utf8', callback);
        }
      } else {
        compressionStream.end();
      }
    }
    return ctx.res;
  };
}

// =============================================================================
// Main Middleware
// =============================================================================

/**
 * Compression middleware factory
 *
 * @param options - Compression configuration options
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * app.use(compression({
 *   gzip: true,
 *   brotli: true,
 *   level: 6,
 *   threshold: 1024
 * }));
 * ```
 */
export function compression(options: CompressionOptions = {}): Middleware {
  // Validate options
  validateCompressionOptions(options);

  const config: EnhancedCompressionOptions = {
    ...DEFAULT_COMPRESSION_OPTIONS,
    ...options,
    excludePatterns: compilePatterns(
      options.exclude || DEFAULT_COMPRESSION_OPTIONS.exclude
    ),
    contentTypePatterns: compilePatterns(
      options.contentType || DEFAULT_COMPRESSION_OPTIONS.contentType
    ),
  };

  return async (ctx: Context, next) => {
    // Let downstream middleware set content-type and body
    await next();

    // Early exit conditions
    if (!config.filter(ctx)) {
      return;
    }

    const acceptEncoding = ctx.req.headers['accept-encoding'] as string;
    if (!acceptEncoding) {
      return;
    }

    // Get content type safely
    const contentType = getContentType(ctx.res);
    if (!contentType || !shouldCompressContentType(contentType, config)) {
      return;
    }

    // Check if already compressed
    if (isAlreadyCompressed(ctx.res)) {
      return;
    }

    // Check threshold
    const contentLength = getContentLength(ctx.res);
    if (contentLength > 0 && contentLength < config.threshold) {
      return;
    }

    // Check CPU usage for adaptive compression
    if (shouldSkipForCpuUsage(config)) {
      return;
    }

    // Pick algorithm
    const algorithm = getBestCompression(acceptEncoding, config);
    if (!algorithm) {
      return;
    }

    // Set compression headers
    ctx.res.setHeader('Content-Encoding', algorithm);
    ctx.res.setHeader('Vary', 'Accept-Encoding');

    // Create and apply compression stream
    try {
      const compressionStream = new CompressionStream(algorithm, config);
      overrideResponseMethods(ctx, compressionStream);
    } catch (err) {
      // Remove compression headers on error
      ctx.res.removeHeader('Content-Encoding');
      ctx.res.removeHeader('Vary');
      console.error(
        '[CompressionMiddleware] Failed to create compression stream:',
        err
      );
    }
  };
}

// =============================================================================
// Specialized Middleware Variants
// =============================================================================

/**
 * Compression with specific algorithm
 */
export function compressionWithAlgorithm(
  algorithm: 'gzip' | 'deflate' | 'brotli',
  options: CompressionOptions = {}
): Middleware {
  const config = { ...DEFAULT_COMPRESSION_OPTIONS, ...options };
  config.gzip = algorithm === 'gzip';
  config.deflate = algorithm === 'deflate';
  config.brotli = algorithm === 'brotli';
  return compression(config);
}

/**
 * Compression with metrics collection
 */
export function compressionWithMetrics(
  options: CompressionOptions = {}
): Middleware {
  return async (ctx: Context, next) => {
    const startTime = performance.now();
    const originalBody = ctx.body;

    await compression(options)(ctx, next);

    const endTime = performance.now();
    const duration = endTime - startTime;
    const contentEncoding = ctx.res.getHeader('Content-Encoding');
    const algorithm =
      typeof contentEncoding === 'string' ? contentEncoding : 'none';

    // Store metrics in context for external collection
    if (!ctx.state['compressionMetrics']) {
      ctx.state['compressionMetrics'] = [];
    }

    const metrics: CompressionMetrics = {
      algorithm,
      duration,
      originalSize:
        typeof originalBody === 'string' ? Buffer.byteLength(originalBody) : 0,
      compressedSize: getContentLength(ctx.res),
    };

    (ctx.state['compressionMetrics'] as CompressionMetrics[]).push(metrics);
  };
}

// =============================================================================
// Legacy Exports
// =============================================================================

/**
 * Gzip-only compression middleware
 */
export const gzip = (options: CompressionOptions = {}) =>
  compression({ ...options, gzip: true, deflate: false, brotli: false });

/**
 * Deflate-only compression middleware
 */
export const deflate = (options: CompressionOptions = {}) =>
  compression({ ...options, gzip: false, deflate: true, brotli: false });

/**
 * Brotli-only compression middleware
 */
export const brotli = (options: CompressionOptions = {}) =>
  compression({ ...options, gzip: false, deflate: false, brotli: true });

// =============================================================================
// Utility Exports
// =============================================================================

/**
 * Compression utilities for external use
 */
export const compressionUtils = {
  createCompressionStream: createSimpleCompressionStream,
  getCompressionLevel,
  shouldCompress,
  shouldCompressContentType,
  getBestCompression,
};

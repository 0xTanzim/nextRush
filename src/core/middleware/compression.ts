/**
 * Compression middleware for NextRush v2
 *
 * @packageDocumentation
 */

import type { CompressionOptions } from '@/core/middleware/types';
import type { Context, Middleware, NextRushResponse } from '@/types/context';
import { cpus, loadavg } from 'node:os';
import { performance } from 'node:perf_hooks';
import { Transform, type TransformCallback } from 'node:stream';
import {
  constants,
  createBrotliCompress,
  createDeflate,
  createGzip,
  type BrotliOptions,
  type ZlibOptions,
} from 'node:zlib';

/**
 * Enhanced compression options with proper defaults
 */
interface EnhancedCompressionOptions extends Required<CompressionOptions> {
  /** Pre-compiled regex patterns for content type matching */
  excludePatterns: (RegExp | string)[];
  /** Pre-compiled regex patterns for content type matching */
  contentTypePatterns: (RegExp | string)[];
}

/**
 * Default compression options
 */
const defaultCompressionOptions: Required<CompressionOptions> = {
  gzip: true,
  deflate: false,
  brotli: false,
  level: 6,
  threshold: 1024,
  filter: () => true,
  contentType: ['text/*', 'application/json', 'application/xml'],
  exclude: ['image/*', 'video/*', 'audio/*'],
  windowBits: 16,
  memLevel: 8,
  strategy: 0,
  chunkSize: 16384,
  dictionary: Buffer.alloc(0),
  adaptive: false,
  maxCpuUsage: 80,
  backpressureThreshold: 16384,
};

/**
 * Pre-compile regex patterns for efficient content type matching
 */
function compilePatterns(patterns: string[]): (RegExp | string)[] {
  return patterns.map(pattern => {
    if (pattern.includes('*')) {
      return new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    }
    return pattern;
  });
}

/**
 * Get the best compression algorithm based on accept-encoding
 */
function getBestCompression(
  acceptEncoding: string,
  options: EnhancedCompressionOptions
): string | null {
  if (!acceptEncoding) return null;

  const encodings = acceptEncoding
    .toLowerCase()
    .split(',')
    .map(e => e.trim().split(';')[0]); // Remove q-values

  // Check brotli first (best compression)
  if (options.brotli && encodings.includes('br')) {
    return 'br';
  }

  // Check gzip
  if (options.gzip && encodings.includes('gzip')) {
    return 'gzip';
  }

  // Check deflate as last resort
  if (options.deflate && encodings.includes('deflate')) {
    return 'deflate';
  }

  return null;
}

/**
 * Check if content type should be compressed using pre-compiled patterns
 */
function shouldCompressContentType(
  contentType: string,
  options: EnhancedCompressionOptions
): boolean {
  if (!contentType) return false;

  const normalizedContentType = contentType.toLowerCase().split(';')[0];
  if (!normalizedContentType) return false;

  // Check exclusions first
  for (const pattern of options.excludePatterns) {
    if (typeof pattern === 'string') {
      if (normalizedContentType.startsWith(pattern)) {
        return false;
      }
    } else if (pattern.test(normalizedContentType)) {
      return false;
    }
  }

  // Check included content types
  for (const pattern of options.contentTypePatterns) {
    if (typeof pattern === 'string') {
      if (normalizedContentType.startsWith(pattern)) {
        return true;
      }
    } else if (pattern.test(normalizedContentType)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if response is already compressed
 */
function isAlreadyCompressed(res: Context['res']): boolean {
  const contentEncoding = res.getHeader('Content-Encoding');
  const transferEncoding = res.getHeader('Transfer-Encoding');

  return !!(
    contentEncoding ||
    transferEncoding === 'chunked' ||
    transferEncoding === 'gzip' ||
    transferEncoding === 'deflate' ||
    transferEncoding === 'br'
  );
}

/**
 * Get response content length
 */
function getContentLength(res: Context['res']): number {
  const contentLength = res.getHeader('Content-Length');
  if (typeof contentLength === 'string') {
    return parseInt(contentLength, 10) || 0;
  }
  if (typeof contentLength === 'number') {
    return contentLength;
  }
  return 0;
}

/**
 * Check CPU usage for adaptive compression
 */
function shouldSkipForCpuUsage(options: EnhancedCompressionOptions): boolean {
  if (!options.adaptive || !options.maxCpuUsage) {
    return false;
  }

  try {
    // Use os.loadavg() for more accurate real-time load detection
    const load = loadavg()[0]; // 1-minute load average
    if (load === undefined) {
      throw new Error('loadavg() returned undefined');
    }
    const cpuCount = cpus().length;
    const cpuUsagePercent = (load / cpuCount) * 100;

    return cpuUsagePercent > options.maxCpuUsage;
  } catch {
    // Fallback to process.cpuUsage() if os.loadavg() fails
    const cpuUsage = process.cpuUsage();
    const totalCpuMicroseconds = cpuUsage.user + cpuUsage.system;
    return totalCpuMicroseconds > options.maxCpuUsage * 1000000; // Convert to microseconds
  }
}

/**
 * Compression stream wrapper for proper error handling
 */
class CompressionStream extends Transform {
  private compressionStream!: Transform;
  private error: Error | null = null;

  constructor(algorithm: string, options: EnhancedCompressionOptions) {
    super();

    try {
      this.compressionStream = this.createCompressionStream(algorithm, options);

      this.compressionStream.on('data', chunk => {
        this.push(chunk);
      });

      this.compressionStream.on('end', () => {
        this.push(null);
      });

      this.compressionStream.on('error', err => {
        this.error = err;
        this.emit('error', err);
      });
    } catch (err) {
      this.error = err as Error;
      this.emit('error', err);
    }
  }

  private createCompressionStream(
    algorithm: string,
    options: EnhancedCompressionOptions
  ): Transform {
    const zlibOptions: ZlibOptions = {
      level: options.level,
      windowBits: options.windowBits,
      memLevel: options.memLevel,
      strategy: options.strategy,
      chunkSize: options.chunkSize,
      dictionary: options.dictionary,
    };

    switch (algorithm) {
      case 'gzip': {
        return createGzip(zlibOptions);
      }
      case 'deflate': {
        return createDeflate(zlibOptions);
      }
      case 'br': {
        const brotliOptions: BrotliOptions = {
          params: {
            [constants.BROTLI_PARAM_QUALITY]: options.level,
            [constants.BROTLI_PARAM_SIZE_HINT]: options.chunkSize,
          },
        };
        return createBrotliCompress(brotliOptions);
      }
      default:
        throw new Error(`Unsupported compression algorithm: ${algorithm}`);
    }
  }

  override _transform(
    chunk: Buffer,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    if (this.error) {
      callback(this.error);
      return;
    }

    try {
      this.compressionStream.write(chunk, encoding, callback);
    } catch (err) {
      callback(err as Error);
    }
  }

  override _flush(callback: TransformCallback): void {
    if (this.error) {
      callback(this.error);
      return;
    }

    try {
      this.compressionStream.end(callback);
    } catch (err) {
      callback(err as Error);
    }
  }
}

/**
 * Validate compression options
 */
function validateCompressionOptions(options: CompressionOptions): void {
  const config = { ...defaultCompressionOptions, ...options };

  if (!Number.isInteger(config.level) || config.level < 0 || config.level > 9) {
    throw new Error('Compression level must be an integer between 0 and 9');
  }

  if (config.threshold < 0) {
    throw new Error('Threshold must be non-negative');
  }

  if (
    config.maxCpuUsage &&
    (config.maxCpuUsage < 0 || config.maxCpuUsage > 100)
  ) {
    throw new Error('maxCpuUsage must be between 0 and 100');
  }

  if (!config.gzip && !config.deflate && !config.brotli) {
    throw new Error('At least one compression algorithm must be enabled');
  }
}

/**
 * Compression middleware factory
 */
export function compression(options: CompressionOptions = {}): Middleware {
  // Validate options
  validateCompressionOptions(options);

  const config: EnhancedCompressionOptions = {
    ...defaultCompressionOptions,
    ...options,
    excludePatterns: compilePatterns(
      options.exclude || defaultCompressionOptions.exclude
    ),
    contentTypePatterns: compilePatterns(
      options.contentType || defaultCompressionOptions.contentType
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
    const contentType =
      ctx.res.getHeader('content-type')?.toString() ||
      ctx.res.getHeader('Content-Type')?.toString();

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

    // Create compression stream
    try {
      const compressionStream = new CompressionStream(algorithm, config);

      // Override response methods to pipe through compression
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
        chunk: any,
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
        chunk?: any,
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

/**
 * Compression utilities
 */
export const compressionUtils = {
  /**
   * Create a compression stream
   */
  createCompressionStream(algorithm: string, level: number = 6): Transform {
    const zlibOptions: ZlibOptions = { level };

    switch (algorithm) {
      case 'gzip':
        return createGzip(zlibOptions);
      case 'deflate':
        return createDeflate(zlibOptions);
      case 'br':
        return createBrotliCompress({
          params: { [constants.BROTLI_PARAM_QUALITY]: level },
        });
      default:
        throw new Error(`Unsupported compression algorithm: ${algorithm}`);
    }
  },

  /**
   * Get compression level based on content type
   */
  getCompressionLevel(
    contentType: string | undefined,
    baseLevel: number = 6
  ): number {
    if (contentType?.includes('json')) {
      return Math.min(baseLevel + 2, 9);
    }
    if (contentType?.includes('xml')) {
      return Math.min(baseLevel + 1, 9);
    }
    return baseLevel;
  },

  /**
   * Check if content should be compressed
   */
  shouldCompress(
    contentType: string | undefined,
    exclude: string[] = []
  ): boolean {
    if (!contentType) return false;

    const excludePatterns = compilePatterns(exclude);
    const normalizedContentType = contentType.toLowerCase().split(';')[0];
    if (!normalizedContentType) return false;

    for (const pattern of excludePatterns) {
      if (typeof pattern === 'string') {
        if (normalizedContentType.startsWith(pattern)) {
          return false;
        }
      } else if (pattern.test(normalizedContentType)) {
        return false;
      }
    }

    return true;
  },

  /**
   * Check if content type should be compressed
   */
  shouldCompressContentType,

  /**
   * Get the best compression algorithm
   */
  getBestCompression,
};

/**
 * Compression with specific algorithm
 */
export function compressionWithAlgorithm(
  algorithm: 'gzip' | 'deflate' | 'brotli',
  options: CompressionOptions = {}
): Middleware {
  const config = { ...defaultCompressionOptions, ...options };
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

    (
      ctx.state['compressionMetrics'] as Array<{
        algorithm: string;
        duration: number;
        originalSize: number;
        compressedSize: number;
      }>
    ).push({
      algorithm,
      duration,
      originalSize:
        typeof originalBody === 'string' ? Buffer.byteLength(originalBody) : 0,
      compressedSize: (() => {
        const contentLength = ctx.res.getHeader('Content-Length');
        if (typeof contentLength === 'string') {
          return parseInt(contentLength, 10) || 0;
        }
        if (typeof contentLength === 'number') {
          return contentLength;
        }
        return 0;
      })(),
    });
  };
}

// Legacy exports for backward compatibility
export const gzip = (options: CompressionOptions = {}) =>
  compression({ ...options, gzip: true, deflate: false, brotli: false });

export const deflate = (options: CompressionOptions = {}) =>
  compression({ ...options, gzip: false, deflate: true, brotli: false });

export const brotli = (options: CompressionOptions = {}) =>
  compression({ ...options, gzip: false, deflate: false, brotli: true });

/**
 * Compression Stream Wrapper for NextRush v2
 *
 * Transform stream wrapper for compression with error handling.
 *
 * @packageDocumentation
 */

import { Transform, type TransformCallback } from 'node:stream';
import {
    constants,
    createBrotliCompress,
    createDeflate,
    createGzip,
    type BrotliOptions,
    type ZlibOptions,
} from 'node:zlib';

import type { EnhancedCompressionOptions } from './types';

// =============================================================================
// Stream Factory
// =============================================================================

/**
 * Create a compression stream for the given algorithm
 */
export function createCompressionStream(
  algorithm: string,
  options: EnhancedCompressionOptions | { level: number }
): Transform {
  const level = options.level;

  const zlibOptions: ZlibOptions = {
    level,
    ...('windowBits' in options && { windowBits: options.windowBits }),
    ...('memLevel' in options && { memLevel: options.memLevel }),
    ...('strategy' in options && { strategy: options.strategy }),
    ...('chunkSize' in options && { chunkSize: options.chunkSize }),
    ...('dictionary' in options && { dictionary: options.dictionary }),
  };

  switch (algorithm) {
    case 'gzip':
      return createGzip(zlibOptions);

    case 'deflate':
      return createDeflate(zlibOptions);

    case 'br': {
      const brotliOptions: BrotliOptions = {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: level,
          ...('chunkSize' in options && {
            [constants.BROTLI_PARAM_SIZE_HINT]: options.chunkSize,
          }),
        },
      };
      return createBrotliCompress(brotliOptions);
    }

    default:
      throw new Error(`Unsupported compression algorithm: ${algorithm}`);
  }
}

// =============================================================================
// Compression Stream Wrapper
// =============================================================================

/**
 * Compression stream wrapper with proper error handling
 *
 * Wraps native zlib streams with error propagation and lifecycle management.
 */
export class CompressionStream extends Transform {
  private compressionStream!: Transform;
  private error: Error | null = null;

  constructor(algorithm: string, options: EnhancedCompressionOptions) {
    super();

    try {
      this.compressionStream = createCompressionStream(algorithm, options);
      this.setupListeners();
    } catch (err) {
      this.error = err as Error;
      this.emit('error', err);
    }
  }

  /**
   * Setup event listeners for the compression stream
   */
  private setupListeners(): void {
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
  }

  /**
   * Transform implementation - write to compression stream
   */
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

  /**
   * Flush implementation - end compression stream
   */
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

// =============================================================================
// Simple Stream Factory
// =============================================================================

/**
 * Create a simple compression stream with default options
 */
export function createSimpleCompressionStream(
  algorithm: string,
  level: number = 6
): Transform {
  return createCompressionStream(algorithm, { level });
}

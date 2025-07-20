/**
 * 🗜️ Static Files Compression Handler
 * Optimized compression for NextRush static files
 */

import { promisify } from 'util';
import * as zlib from 'zlib';
import { COMPRESSIBLE_TYPES, COMPRESSION_THRESHOLD } from './types';

/**
 * Compression handler for static files
 */
export class CompressionHandler {
  private gzipAsync = promisify(zlib.gzip);
  private brotliAsync = promisify(zlib.brotliCompress);

  // Compression level configuration
  private readonly gzipOptions = { level: 6 };
  private readonly brotliOptions = {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 6,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: 0,
    },
  };

  /**
   * Check if content should be compressed
   */
  shouldCompress(content: Buffer, mimeType: string): boolean {
    // Skip compression for small files
    if (content.length < COMPRESSION_THRESHOLD) {
      return false;
    }

    // Check if MIME type is compressible
    if (COMPRESSIBLE_TYPES.has(mimeType)) {
      return true;
    }

    // Check for text-based MIME types
    return (
      mimeType.startsWith('text/') ||
      mimeType.includes('javascript') ||
      mimeType.includes('json') ||
      mimeType.includes('xml')
    );
  }

  /**
   * Compress content with specified method
   */
  async compressContent(
    content: Buffer,
    method: 'gzip' | 'brotli' | 'auto'
  ): Promise<{ data: Buffer; encoding: string } | null> {
    try {
      switch (method) {
        case 'gzip':
          return {
            data: await this.gzipAsync(content, this.gzipOptions),
            encoding: 'gzip',
          };

        case 'brotli':
          return {
            data: await this.brotliAsync(content, this.brotliOptions),
            encoding: 'br',
          };

        case 'auto':
          // Try both and choose the best compression
          const [gzipResult, brotliResult] = await Promise.allSettled([
            this.gzipAsync(content, this.gzipOptions),
            this.brotliAsync(content, this.brotliOptions),
          ]);

          // Prefer brotli if available and better compression
          if (
            brotliResult.status === 'fulfilled' &&
            gzipResult.status === 'fulfilled'
          ) {
            if (brotliResult.value.length < gzipResult.value.length) {
              return {
                data: brotliResult.value,
                encoding: 'br',
              };
            } else {
              return {
                data: gzipResult.value,
                encoding: 'gzip',
              };
            }
          }

          // Fallback to available compression
          if (brotliResult.status === 'fulfilled') {
            return {
              data: brotliResult.value,
              encoding: 'br',
            };
          } else if (gzipResult.status === 'fulfilled') {
            return {
              data: gzipResult.value,
              encoding: 'gzip',
            };
          }
          break;
      }
    } catch (error) {
      console.warn('[StaticFiles] Compression failed:', error);
    }

    return null;
  }

  /**
   * Check if client accepts specific encoding
   */
  acceptsEncoding(acceptEncoding: string, encoding: string): boolean {
    if (!acceptEncoding) return false;

    const normalized = acceptEncoding.toLowerCase();

    // Map encoding to what browsers send
    const encodingMap: Record<string, string[]> = {
      gzip: ['gzip', 'x-gzip'],
      br: ['br', 'brotli'],
      deflate: ['deflate'],
    };

    const acceptedEncodings = encodingMap[encoding] || [encoding];
    return acceptedEncodings.some((enc) => normalized.includes(enc));
  }

  /**
   * Determine best encoding for client
   */
  getBestEncoding(acceptEncoding: string): 'br' | 'gzip' | null {
    if (!acceptEncoding) return null;

    const normalized = acceptEncoding.toLowerCase();

    // Check for brotli support (better compression)
    if (normalized.includes('br') || normalized.includes('brotli')) {
      return 'br';
    }

    // Check for gzip support (wider compatibility)
    if (normalized.includes('gzip') || normalized.includes('x-gzip')) {
      return 'gzip';
    }

    return null;
  }

  /**
   * Calculate compression ratio
   */
  getCompressionRatio(original: number, compressed: number): number {
    if (original === 0) return 0;
    return Math.round((1 - compressed / original) * 100);
  }

  /**
   * Check if compression is beneficial
   */
  isCompressionBeneficial(original: number, compressed: number): boolean {
    // Only use compression if it saves at least 5% and 100 bytes
    const ratio = this.getCompressionRatio(original, compressed);
    const savings = original - compressed;

    return ratio >= 5 && savings >= 100;
  }
}

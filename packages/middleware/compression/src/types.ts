import type { Context } from '@nextrush/types';

/**
 * Compression algorithm type
 */
export type CompressionAlgorithm = 'gzip' | 'deflate' | 'br';

/**
 * Compression encoding to algorithm mapping
 */
export type CompressionEncoding = 'gzip' | 'deflate' | 'br';

/**
 * Compression options
 */
export interface CompressionOptions {
  /**
   * Enable gzip compression
   * @default true
   */
  gzip?: boolean;

  /**
   * Enable deflate compression
   * @default true
   */
  deflate?: boolean;

  /**
   * Enable brotli compression
   * @default true
   */
  brotli?: boolean;

  /**
   * Compression level (0-9 for gzip/deflate, 0-11 for brotli)
   * @default 6
   */
  level?: number;

  /**
   * Minimum response size in bytes to compress
   * @default 1024 (1KB)
   */
  threshold?: number;

  /**
   * Content types to compress (supports wildcards)
   * @default ['text/*', 'application/json', 'application/javascript', 'application/xml']
   */
  contentTypes?: string[];

  /**
   * Content types to exclude from compression
   * @default ['image/*', 'video/*', 'audio/*']
   */
  exclude?: string[];

  /**
   * Custom filter function to determine if response should be compressed
   */
  filter?: (ctx: Context) => boolean;

  /**
   * Memory level for zlib (1-9)
   * @default 8
   */
  memLevel?: number;

  /**
   * Flush mode for streaming responses
   * @default 'Z_NO_FLUSH'
   */
  flush?: number;
}

/**
 * Compression info returned by negotiation
 */
export interface CompressionInfo {
  encoding: CompressionEncoding;
  algorithm: CompressionAlgorithm;
  level: number;
}

/**
 * Compression middleware function type
 */
export type CompressionMiddleware = (
  ctx: Context,
  next?: () => Promise<void>
) => Promise<void>;

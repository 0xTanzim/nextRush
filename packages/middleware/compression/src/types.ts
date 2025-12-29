/**
 * @nextrush/compression - Types
 *
 * TypeScript type definitions for compression middleware.
 *
 * @packageDocumentation
 */

import type { Context, Middleware } from '@nextrush/types';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Compression encoding types.
 */
export type CompressionEncoding = 'gzip' | 'deflate' | 'br';

/**
 * Compression algorithm (alias for encoding).
 */
export type CompressionAlgorithm = CompressionEncoding;

/**
 * Web Compression Streams format.
 * Note: 'br' is non-standard and not widely supported in Web Compression Streams.
 */
export type WebCompressionFormat = 'gzip' | 'deflate' | 'deflate-raw';

// ============================================================================
// Options Types
// ============================================================================

/**
 * Compression middleware options.
 */
export interface CompressionOptions {
  /**
   * Enable gzip compression.
   * @default true
   */
  gzip?: boolean;

  /**
   * Enable deflate compression.
   * @default true
   */
  deflate?: boolean;

  /**
   * Enable Brotli compression.
   * Note: Brotli is only available in Node.js, Bun, and some Edge runtimes.
   * Falls back to gzip if Brotli is unavailable.
   * @default true
   */
  brotli?: boolean;

  /**
   * Compression level.
   * - 0-9 for gzip/deflate (0 = no compression, 9 = maximum)
   * - 0-11 for Brotli (0 = no compression, 11 = maximum)
   * @default 6
   */
  level?: number;

  /**
   * Minimum response size in bytes to compress.
   * Responses smaller than this threshold won't be compressed.
   * @default 1024 (1KB)
   */
  threshold?: number;

  /**
   * Content types to compress.
   * Supports exact matches and wildcard patterns (e.g., 'text/*').
   * @default DEFAULT_COMPRESSIBLE_TYPES
   */
  contentTypes?: readonly string[];

  /**
   * Content types to exclude from compression.
   * Supports exact matches and wildcard patterns.
   * @default DEFAULT_EXCLUDED_TYPES
   */
  exclude?: readonly string[];

  /**
   * Custom filter function to determine if response should be compressed.
   * Return `true` to compress, `false` to skip.
   * @param ctx - Request context
   * @returns Whether to compress the response
   */
  filter?: (ctx: Context) => boolean;

  /**
   * Enable BREACH attack mitigation by adding random padding.
   * Recommended for responses that include user secrets and reflect user input.
   * @default false
   */
  breachMitigation?: boolean;
}

/**
 * Resolved compression options with all defaults applied.
 */
export interface ResolvedCompressionOptions {
  gzip: boolean;
  deflate: boolean;
  brotli: boolean;
  level: number;
  threshold: number;
  contentTypes: readonly string[];
  exclude: readonly string[];
  filter?: (ctx: Context) => boolean;
  breachMitigation: boolean;
}

// ============================================================================
// Compression Info
// ============================================================================

/**
 * Information about a compression operation.
 */
export interface CompressionInfo {
  /** The encoding used */
  encoding: CompressionEncoding;
  /** Original size in bytes */
  originalSize: number;
  /** Compressed size in bytes */
  compressedSize: number;
  /** Compression ratio (compressed/original) */
  ratio: number;
  /** Time taken to compress in milliseconds */
  duration?: number;
}

/**
 * Result of a compression operation.
 */
export interface CompressionResult {
  /** Compressed data */
  data: Uint8Array;
  /** Compression info */
  info: CompressionInfo;
}

// ============================================================================
// Negotiation Types
// ============================================================================

/**
 * Parsed Accept-Encoding entry.
 */
export interface AcceptEncodingEntry {
  /** Encoding name */
  encoding: string;
  /** Quality value (0-1) */
  quality: number;
}

/**
 * Result of encoding negotiation.
 */
export interface NegotiationResult {
  /** Selected encoding, or null if none suitable */
  encoding: CompressionEncoding | null;
  /** All accepted encodings with quality values */
  accepted: AcceptEncodingEntry[];
}

// ============================================================================
// Middleware Types
// ============================================================================

/**
 * Compression middleware function.
 */
export type CompressionMiddleware = Middleware;

/**
 * Context state added by compression middleware.
 */
export interface CompressionState {
  /** Information about the compression applied */
  compression?: CompressionInfo;
}

// ============================================================================
// Runtime Detection
// ============================================================================

/**
 * Runtime capabilities for compression.
 */
export interface RuntimeCapabilities {
  /** Web Compression Streams API available */
  hasCompressionStreams: boolean;
  /** Node.js zlib available */
  hasNodeZlib: boolean;
  /** Brotli compression available */
  hasBrotli: boolean;
  /** Current runtime name */
  runtime: 'node' | 'bun' | 'deno' | 'edge' | 'browser' | 'unknown';
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Compression error with additional context.
 */
export class CompressionError extends Error {
  /**
   * Error code for programmatic handling.
   */
  readonly code: string;

  /**
   * The encoding that was being used when the error occurred.
   */
  readonly encoding?: CompressionEncoding;

  constructor(message: string, code: string, encoding?: CompressionEncoding) {
    super(message);
    this.name = 'CompressionError';
    this.code = code;
    this.encoding = encoding;
    Object.setPrototypeOf(this, CompressionError.prototype);
  }
}

/**
 * Error codes for compression errors.
 */
export const CompressionErrorCode = {
  /** Encoding not supported in current runtime */
  ENCODING_NOT_SUPPORTED: 'ENCODING_NOT_SUPPORTED',
  /** Compression failed */
  COMPRESSION_FAILED: 'COMPRESSION_FAILED',
  /** Decompression failed */
  DECOMPRESSION_FAILED: 'DECOMPRESSION_FAILED',
  /** Response too large to compress in memory */
  RESPONSE_TOO_LARGE: 'RESPONSE_TOO_LARGE',
  /** Compression ratio suspicious (possible bomb) */
  SUSPICIOUS_RATIO: 'SUSPICIOUS_RATIO',
  /** Invalid compression level */
  INVALID_LEVEL: 'INVALID_LEVEL',
} as const;

export type CompressionErrorCodeType = typeof CompressionErrorCode[keyof typeof CompressionErrorCode];

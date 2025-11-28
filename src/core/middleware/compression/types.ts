/**
 * Compression Middleware Types for NextRush v2
 *
 * Type definitions and default configuration for compression.
 *
 * @packageDocumentation
 */

import type { CompressionOptions } from '../types';

/**
 * Enhanced compression options with pre-compiled patterns
 */
export interface EnhancedCompressionOptions extends Required<CompressionOptions> {
  /** Pre-compiled regex patterns for content type exclusions */
  excludePatterns: (RegExp | string)[];
  /** Pre-compiled regex patterns for content type matching */
  contentTypePatterns: (RegExp | string)[];
}

/**
 * Compression metrics for monitoring
 */
export interface CompressionMetrics {
  algorithm: string;
  duration: number;
  originalSize: number;
  compressedSize: number;
}

/**
 * Supported compression algorithms
 */
export type CompressionAlgorithm = 'gzip' | 'deflate' | 'br';

/**
 * Default compression options
 */
export const DEFAULT_COMPRESSION_OPTIONS: Required<CompressionOptions> = {
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
 * Compression level constraints
 */
export const COMPRESSION_LEVEL = {
  MIN: 0,
  MAX: 9,
  DEFAULT: 6,
} as const;

/**
 * CPU usage constraints
 */
export const CPU_USAGE = {
  MIN: 0,
  MAX: 100,
} as const;

/**
 * Compression Utilities for NextRush v2
 *
 * Pattern matching, content type checking, and helper functions.
 *
 * @packageDocumentation
 */

import type { Context } from '@/types/context';
import { cpus, loadavg } from 'node:os';

import type { EnhancedCompressionOptions } from './types';

// =============================================================================
// Pattern Compilation
// =============================================================================

/**
 * Pre-compile regex patterns for efficient content type matching
 */
export function compilePatterns(patterns: string[]): (RegExp | string)[] {
  return patterns.map(pattern => {
    if (pattern.includes('*')) {
      return new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    }
    return pattern;
  });
}

// =============================================================================
// Content Type Matching
// =============================================================================

/**
 * Check if content type should be compressed using pre-compiled patterns
 */
export function shouldCompressContentType(
  contentType: string,
  options: EnhancedCompressionOptions
): boolean {
  if (!contentType) return false;

  const normalizedContentType = contentType.toLowerCase().split(';')[0];
  if (!normalizedContentType) return false;

  // Check exclusions first
  for (const pattern of options.excludePatterns) {
    if (matchPattern(normalizedContentType, pattern)) {
      return false;
    }
  }

  // Check included content types
  for (const pattern of options.contentTypePatterns) {
    if (matchPattern(normalizedContentType, pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Match a content type against a pattern
 */
function matchPattern(contentType: string, pattern: RegExp | string): boolean {
  if (typeof pattern === 'string') {
    return contentType.startsWith(pattern);
  }
  return pattern.test(contentType);
}

// =============================================================================
// Algorithm Selection
// =============================================================================

/**
 * Get the best compression algorithm based on accept-encoding header
 */
export function getBestCompression(
  acceptEncoding: string,
  options: EnhancedCompressionOptions
): string | null {
  if (!acceptEncoding) return null;

  const encodings = acceptEncoding
    .toLowerCase()
    .split(',')
    .map(e => e.trim().split(';')[0]); // Remove q-values

  // Check brotli first (best compression ratio)
  if (options.brotli && encodings.includes('br')) {
    return 'br';
  }

  // Check gzip (most compatible)
  if (options.gzip && encodings.includes('gzip')) {
    return 'gzip';
  }

  // Check deflate as last resort
  if (options.deflate && encodings.includes('deflate')) {
    return 'deflate';
  }

  return null;
}

// =============================================================================
// Response Helpers
// =============================================================================

/**
 * Check if response is already compressed
 */
export function isAlreadyCompressed(res: Context['res']): boolean {
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
export function getContentLength(res: Context['res']): number {
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
 * Get content type from response
 */
export function getContentType(res: Context['res']): string | undefined {
  return (
    res.getHeader('content-type')?.toString() ||
    res.getHeader('Content-Type')?.toString()
  );
}

// =============================================================================
// CPU Usage Check
// =============================================================================

/**
 * Check CPU usage for adaptive compression
 */
export function shouldSkipForCpuUsage(
  options: EnhancedCompressionOptions
): boolean {
  if (!options.adaptive || !options.maxCpuUsage) {
    return false;
  }

  try {
    // Use os.loadavg() for accurate real-time load detection
    const load = loadavg()[0];
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
    return totalCpuMicroseconds > options.maxCpuUsage * 1000000;
  }
}

// =============================================================================
// Compression Level Helpers
// =============================================================================

/**
 * Get compression level based on content type
 */
export function getCompressionLevel(
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
}

/**
 * Check if content should be compressed
 */
export function shouldCompress(
  contentType: string | undefined,
  exclude: string[] = []
): boolean {
  if (!contentType) return false;

  const excludePatterns = compilePatterns(exclude);
  const normalizedContentType = contentType.toLowerCase().split(';')[0];
  if (!normalizedContentType) return false;

  for (const pattern of excludePatterns) {
    if (matchPattern(normalizedContentType, pattern)) {
      return false;
    }
  }

  return true;
}

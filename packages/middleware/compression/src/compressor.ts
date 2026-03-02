/**
 * @nextrush/compression - Compressor
 *
 * Multi-runtime compression implementation using Web Compression Streams API
 * with fallback to Node.js zlib for Brotli support.
 *
 * @packageDocumentation
 */

import {
  DEFAULT_COMPRESSION_LEVEL,
  MAX_BROTLI_LEVEL,
  MAX_COMPRESSION_RATIO,
  MAX_ZLIB_LEVEL,
} from './constants.js';
import {
  CompressionError,
  CompressionErrorCode,
  type CompressionEncoding,
  type CompressionInfo,
  type CompressionResult,
  type RuntimeCapabilities,
} from './types.js';

// ============================================================================
// Global Type Declarations
// ============================================================================

// Declare global variables for runtime detection
declare const Deno: { version?: { deno?: string } } | undefined;
declare const EdgeRuntime: string | undefined;

/**
 * Safe check for global existence.
 */
function hasGlobal(name: string): boolean {
  try {
    return typeof (globalThis as Record<string, unknown>)[name] !== 'undefined';
  } catch {
    return false;
  }
}

// ============================================================================
// Runtime Detection
// ============================================================================

let cachedCapabilities: RuntimeCapabilities | null = null;

/**
 * Detect runtime compression capabilities.
 *
 * @returns Runtime capabilities object
 */
export function detectCapabilities(): RuntimeCapabilities {
  if (cachedCapabilities) {
    return cachedCapabilities;
  }

  // Check for Web Compression Streams
  const hasCompressionStreams = typeof CompressionStream !== 'undefined';

  // Check for Node.js zlib
  let hasNodeZlib = false;
  let hasBrotli = false;

  // Detect runtime
  let runtime: RuntimeCapabilities['runtime'] = 'unknown';

  if (typeof process !== 'undefined' && process.versions?.node) {
    runtime = 'node';
    hasNodeZlib = true;
    hasBrotli = true; // Node.js has native Brotli
  } else if (typeof process !== 'undefined' && process.versions?.bun) {
    runtime = 'bun';
    hasBrotli = true; // Bun supports Brotli via CompressionStream
  } else if (typeof Deno !== 'undefined' && Deno?.version?.deno) {
    runtime = 'deno';
    hasBrotli = false; // Deno doesn't support Brotli in CompressionStream yet
  } else if (typeof EdgeRuntime !== 'undefined' || hasGlobal('caches')) {
    runtime = 'edge';
    hasBrotli = false; // Most edge runtimes don't support Brotli
  } else if (hasGlobal('window')) {
    runtime = 'browser';
    hasBrotli = false; // Browsers don't support Brotli in CompressionStream
  }

  cachedCapabilities = {
    hasCompressionStreams,
    hasNodeZlib,
    hasBrotli,
    runtime,
  };

  return cachedCapabilities;
}

/**
 * Check if a specific encoding is supported in the current runtime.
 *
 * @param encoding - Compression encoding to check
 * @returns Whether the encoding is supported
 */
export function isEncodingSupported(encoding: CompressionEncoding): boolean {
  const caps = detectCapabilities();

  switch (encoding) {
    case 'br':
      return caps.hasBrotli;
    case 'gzip':
    case 'deflate':
      return caps.hasCompressionStreams || caps.hasNodeZlib;
    default:
      return false;
  }
}

// ============================================================================
// Web Compression Streams Implementation
// ============================================================================

/**
 * Compress data using Web Compression Streams API.
 *
 * @param data - Data to compress
 * @param format - Compression format ('gzip' or 'deflate')
 * @returns Compressed data as Uint8Array
 */
async function compressWithWebStreams(
  data: Uint8Array,
  format: 'gzip' | 'deflate'
): Promise<Uint8Array> {
  const stream = new CompressionStream(format);
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();

  // Write data — explicit ArrayBuffer slice for TS 5.9+ BufferSource compatibility
  const buf =
    data.buffer instanceof ArrayBuffer
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : new Uint8Array(data);
  await writer.write(buf as Uint8Array<ArrayBuffer>);
  await writer.close();

  // Read compressed chunks
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.length;
  }

  // Concatenate chunks
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

// ============================================================================
// Node.js zlib Implementation (for Brotli)
// ============================================================================

/**
 * Compress data using Node.js zlib.
 *
 * @param data - Data to compress
 * @param encoding - Compression encoding
 * @param level - Compression level
 * @returns Compressed data as Uint8Array
 */
async function compressWithNodeZlib(
  data: Uint8Array,
  encoding: CompressionEncoding,
  level: number
): Promise<Uint8Array> {
  // Dynamic import for Node.js zlib
  const zlib = await import('node:zlib');
  const { promisify } = await import('node:util');

  const buffer = Buffer.from(data);

  switch (encoding) {
    case 'br': {
      const brotliCompress = promisify(zlib.brotliCompress);
      const compressed = await brotliCompress(buffer, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: Math.min(level, MAX_BROTLI_LEVEL),
        },
      });
      return new Uint8Array(compressed);
    }

    case 'gzip': {
      const gzip = promisify(zlib.gzip);
      const compressed = await gzip(buffer, {
        level: Math.min(level, MAX_ZLIB_LEVEL),
      });
      return new Uint8Array(compressed);
    }

    case 'deflate': {
      const deflate = promisify(zlib.deflate);
      const compressed = await deflate(buffer, {
        level: Math.min(level, MAX_ZLIB_LEVEL),
      });
      return new Uint8Array(compressed);
    }

    default:
      throw new CompressionError(
        `Unsupported encoding: ${encoding}`,
        CompressionErrorCode.ENCODING_NOT_SUPPORTED,
        encoding
      );
  }
}

// ============================================================================
// Main Compression Function
// ============================================================================

/**
 * Compress data using the best available method for the current runtime.
 *
 * @example
 * ```typescript
 * const data = new TextEncoder().encode('Hello, World!');
 * const result = await compress(data, 'gzip');
 * console.log(result.info.ratio); // e.g., 0.65
 * ```
 *
 * @param data - Data to compress (string or Uint8Array)
 * @param encoding - Compression encoding
 * @param options - Compression options
 * @returns Compression result with data and info
 *
 * @throws {CompressionError} If encoding is not supported or compression fails
 */
export async function compress(
  data: string | Uint8Array,
  encoding: CompressionEncoding,
  options: { level?: number } = {}
): Promise<CompressionResult> {
  const startTime = performance.now();
  const level = options.level ?? DEFAULT_COMPRESSION_LEVEL;

  // Convert string to Uint8Array
  const inputData = typeof data === 'string' ? new TextEncoder().encode(data) : data;

  const originalSize = inputData.length;

  if (!isEncodingSupported(encoding)) {
    throw new CompressionError(
      `Encoding "${encoding}" is not supported in the current runtime`,
      CompressionErrorCode.ENCODING_NOT_SUPPORTED,
      encoding
    );
  }

  const caps = detectCapabilities();
  let compressed: Uint8Array;

  try {
    // Use Web Compression Streams for gzip/deflate when available
    if ((encoding === 'gzip' || encoding === 'deflate') && caps.hasCompressionStreams) {
      compressed = await compressWithWebStreams(inputData, encoding);
    }
    // Use Node.js zlib for all encodings (including Brotli)
    else if (caps.hasNodeZlib) {
      compressed = await compressWithNodeZlib(inputData, encoding, level);
    }
    // Fallback error
    else {
      throw new CompressionError(
        'No compression implementation available',
        CompressionErrorCode.COMPRESSION_FAILED,
        encoding
      );
    }
  } catch (error) {
    if (error instanceof CompressionError) {
      throw error;
    }
    throw new CompressionError(
      `Compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      CompressionErrorCode.COMPRESSION_FAILED,
      encoding
    );
  }

  const compressedSize = compressed.length;
  const ratio = originalSize > 0 ? compressedSize / originalSize : 1;
  const duration = performance.now() - startTime;

  // Check for suspicious compression ratio (decompression bomb prevention)
  if (ratio > MAX_COMPRESSION_RATIO) {
    throw new CompressionError(
      `Suspicious compression ratio: ${ratio}. This might indicate a decompression bomb.`,
      CompressionErrorCode.SUSPICIOUS_RATIO,
      encoding
    );
  }

  const info: CompressionInfo = {
    encoding,
    originalSize,
    compressedSize,
    ratio,
    duration,
  };

  return { data: compressed, info };
}

/**
 * Simple compress function that returns just the compressed data.
 *
 * @param data - Data to compress
 * @param encoding - Compression encoding
 * @param options - Compression options
 * @returns Compressed data as Uint8Array
 */
export async function compressData(
  data: string | Uint8Array,
  encoding: CompressionEncoding,
  options: { level?: number } = {}
): Promise<Uint8Array> {
  const result = await compress(data, encoding, options);
  return result.data;
}

/**
 * Compress data and return as Buffer (for Node.js compatibility).
 *
 * @param data - Data to compress
 * @param encoding - Compression encoding
 * @param options - Compression options
 * @returns Compressed data as Buffer
 */
export async function compressToBuffer(
  data: string | Uint8Array | Buffer,
  encoding: CompressionEncoding,
  options: { level?: number } = {}
): Promise<Buffer> {
  const inputData = Buffer.isBuffer(data)
    ? new Uint8Array(data)
    : typeof data === 'string'
      ? new TextEncoder().encode(data)
      : data;

  const result = await compress(inputData, encoding, options);
  return Buffer.from(result.data);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Estimate compressed size without actually compressing.
 *
 * This is a rough estimate based on typical compression ratios.
 * Actual compressed size may vary significantly.
 *
 * @param originalSize - Original size in bytes
 * @param encoding - Compression encoding
 * @param contentType - Content type (affects estimation)
 * @returns Estimated compressed size in bytes
 */
export function estimateCompressedSize(
  originalSize: number,
  encoding: CompressionEncoding,
  contentType?: string
): number {
  // Base ratios for different encodings
  const baseRatios: Record<CompressionEncoding, number> = {
    br: 0.2, // Brotli typically achieves best compression
    gzip: 0.3, // Gzip is good for most content
    deflate: 0.32, // Deflate similar to gzip
  };

  let ratio = baseRatios[encoding] ?? 0.35;

  // Adjust for content type
  if (contentType) {
    const lower = contentType.toLowerCase();

    // Text-heavy content compresses better
    if (lower.includes('json') || lower.includes('javascript') || lower.includes('css')) {
      ratio *= 0.8;
    }
    // HTML with lots of whitespace compresses very well
    else if (lower.includes('html') || lower.includes('xml')) {
      ratio *= 0.7;
    }
  }

  return Math.ceil(originalSize * ratio);
}

/**
 * Check if compression would be beneficial for given data.
 *
 * @param originalSize - Original size in bytes
 * @param threshold - Minimum size threshold
 * @returns Whether compression is recommended
 */
export function isCompressionBeneficial(originalSize: number, threshold: number = 1024): boolean {
  // Don't compress if below threshold
  if (originalSize < threshold) {
    return false;
  }

  // Always compress if large enough
  return true;
}

/**
 * Get the best encoding for the current runtime.
 *
 * @param preferred - Preferred encodings in order
 * @returns Best available encoding or null
 */
export function getBestAvailableEncoding(
  preferred: CompressionEncoding[] = ['br', 'gzip', 'deflate']
): CompressionEncoding | null {
  for (const encoding of preferred) {
    if (isEncodingSupported(encoding)) {
      return encoding;
    }
  }
  return null;
}

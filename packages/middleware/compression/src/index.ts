/**
 * @nextrush/compression
 *
 * High-performance, multi-runtime response compression middleware for NextRush.
 * Supports Gzip, Deflate, and Brotli with automatic content negotiation.
 *
 * Features:
 * - Web Compression Streams API for runtime compatibility
 * - Automatic content negotiation via Accept-Encoding
 * - Content-type based filtering
 * - Size threshold to skip small responses
 * - BREACH attack mitigation option
 * - Works in Node.js, Bun, Deno, and Edge runtimes
 *
 * @packageDocumentation
 *
 * @example Basic Usage
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { compression } from '@nextrush/compression';
 *
 * const app = createApp();
 * app.use(compression());
 * ```
 *
 * @example With Options
 * ```typescript
 * app.use(compression({
 *   level: 9,        // Maximum compression
 *   threshold: 512,  // Compress responses > 512 bytes
 *   brotli: true,    // Enable Brotli (where supported)
 * }));
 * ```
 */

// ============================================================================
// Middleware Exports (Primary API)
// ============================================================================

export {
    brotli, compression, deflate, getCompressionInfo, gzip, secureCompressionOptions, wasCompressed
} from './middleware.js';

export { compression as default } from './middleware.js';

// ============================================================================
// Compressor Exports
// ============================================================================

export {
    compress,
    compressData,
    compressToBuffer,
    detectCapabilities, estimateCompressedSize, getBestAvailableEncoding, isCompressionBeneficial, isEncodingSupported
} from './compressor.js';

// ============================================================================
// Content Negotiation Exports
// ============================================================================

export {
    acceptsCompression,
    getAcceptedEncodings, getEncodingQuality, isEncodingAccepted, negotiateEncoding, parseAcceptEncoding, selectEncoding
} from './negotiation.js';

// ============================================================================
// Content Type Detection Exports
// ============================================================================

export {
    extractMimeType, getCompressionRecommendation, isAlreadyCompressed, isBinaryContent, isCompressible, isTextContent, matchesAnyPattern, matchesPattern
} from './content-type.js';

// ============================================================================
// Constants Exports
// ============================================================================

export {
    COMPRESSION_ENCODINGS, DEFAULT_COMPRESSIBLE_TYPES, DEFAULT_COMPRESSION_LEVEL, DEFAULT_EXCLUDED_TYPES, DEFAULT_OPTIONS, DEFAULT_THRESHOLD, ENCODING_PRIORITY, MAX_BROTLI_LEVEL,
    MAX_COMPRESSION_RATIO,
    MAX_IN_MEMORY_SIZE, MAX_ZLIB_LEVEL, NO_BODY_METHODS,
    NO_COMPRESS_STATUS_CODES, VARY_HEADER
} from './constants.js';

// ============================================================================
// Type Exports
// ============================================================================

export type {
    AcceptEncodingEntry, CompressionAlgorithm, CompressionEncoding, CompressionErrorCodeType, CompressionInfo, CompressionMiddleware, CompressionOptions, CompressionResult, CompressionState, NegotiationResult, ResolvedCompressionOptions, RuntimeCapabilities, WebCompressionFormat
} from './types.js';

export {
    CompressionError,
    CompressionErrorCode
} from './types.js';

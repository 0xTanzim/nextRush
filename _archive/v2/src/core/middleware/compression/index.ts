/**
 * Compression Middleware Module Index
 *
 * @packageDocumentation
 */

// Main middleware
export {
    brotli,
    compression,
    compressionUtils,
    compressionWithAlgorithm,
    compressionWithMetrics,
    deflate,
    gzip
} from './compression';

// Stream utilities
export {
    CompressionStream,
    createCompressionStream,
    createSimpleCompressionStream
} from './stream-wrapper';

// Utility functions
export {
    compilePatterns,
    getBestCompression,
    getCompressionLevel,
    getContentLength,
    getContentType,
    isAlreadyCompressed,
    shouldCompress,
    shouldCompressContentType,
    shouldSkipForCpuUsage
} from './utils';

// Types and constants
export {
    COMPRESSION_LEVEL,
    CPU_USAGE,
    DEFAULT_COMPRESSION_OPTIONS
} from './types';

export type {
    CompressionAlgorithm,
    CompressionMetrics,
    EnhancedCompressionOptions
} from './types';

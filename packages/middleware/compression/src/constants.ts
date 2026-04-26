/**
 * @nextrush/compression - Constants
 *
 * Configuration constants and defaults for compression middleware.
 *
 * @packageDocumentation
 */

// ============================================================================
// Compression Encodings
// ============================================================================

/**
 * Supported compression encodings.
 * Order matters - first available encoding wins during negotiation.
 */
export const COMPRESSION_ENCODINGS = {
  /** Brotli - best compression, limited runtime support */
  BROTLI: 'br',
  /** Gzip - universal support, good compression */
  GZIP: 'gzip',
  /** Deflate - universal support, fast compression */
  DEFLATE: 'deflate',
} as const;

/**
 * Encoding priority for content negotiation.
 * Higher index = higher priority.
 */
export const ENCODING_PRIORITY: readonly string[] = ['deflate', 'gzip', 'br'];

// ============================================================================
// Compression Levels
// ============================================================================

/**
 * Default compression level (0-9 for gzip/deflate).
 * Level 6 provides good balance of speed and compression ratio.
 */
export const DEFAULT_COMPRESSION_LEVEL = 6;

/**
 * Maximum compression level for gzip/deflate.
 */
export const MAX_ZLIB_LEVEL = 9;

/**
 * Maximum compression level for Brotli.
 */
export const MAX_BROTLI_LEVEL = 11;

/**
 * Minimum compression level.
 */
export const MIN_COMPRESSION_LEVEL = 0;

// ============================================================================
// Thresholds
// ============================================================================

/**
 * Default minimum response size to compress (in bytes).
 * Responses smaller than this won't benefit from compression.
 */
export const DEFAULT_THRESHOLD = 1024; // 1KB

/**
 * Minimum recommended threshold.
 * Compressing very small responses adds overhead without benefit.
 */
export const MIN_THRESHOLD = 0;

/**
 * Maximum recommended threshold.
 * Higher values may miss compression opportunities.
 */
export const MAX_THRESHOLD = 1024 * 1024; // 1MB

// ============================================================================
// Content Types
// ============================================================================

/**
 * Default compressible content types.
 * These MIME types typically benefit from compression.
 */
export const DEFAULT_COMPRESSIBLE_TYPES: readonly string[] = [
  // Text formats
  'text/plain',
  'text/html',
  'text/css',
  'text/javascript',
  'text/xml',
  'text/csv',
  'text/markdown',

  // Application formats
  'application/json',
  'application/javascript',
  'application/xml',
  'application/xhtml+xml',
  'application/rss+xml',
  'application/atom+xml',
  'application/x-javascript',
  'application/ld+json',
  'application/manifest+json',
  'application/graphql+json',

  // Fonts
  'application/x-font-ttf',
  'application/vnd.ms-fontobject',
  'font/opentype',
  'font/ttf',
  'font/eot',
  'font/otf',
  'font/woff', // Note: woff is already compressed, but some clients prefer it

  // Images that benefit from compression
  'image/svg+xml',
  'image/x-icon',
  'image/bmp',

  // Other
  'application/wasm',
];

/**
 * Default excluded content types.
 * These MIME types are already compressed or don't benefit from compression.
 */
export const DEFAULT_EXCLUDED_TYPES: readonly string[] = [
  // Compressed images
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',

  // Video (already compressed)
  'video/*',

  // Audio (already compressed)
  'audio/*',

  // Archives (already compressed)
  'application/zip',
  'application/gzip',
  'application/x-gzip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/x-bzip',
  'application/x-bzip2',

  // Compressed fonts
  'font/woff2',
  'application/font-woff2',

  // Other compressed formats
  'application/pdf',
  'application/octet-stream',
];

// ============================================================================
// HTTP Status Codes
// ============================================================================

/**
 * Status codes that should never have compressed responses.
 */
export const NO_COMPRESS_STATUS_CODES: readonly number[] = [
  204, // No Content
  304, // Not Modified
];

/**
 * HTTP methods that never have response bodies.
 */
export const NO_BODY_METHODS: readonly string[] = ['HEAD'];

// ============================================================================
// Security
// ============================================================================

/**
 * Maximum decompression ratio to prevent decompression bombs.
 * If compressed/original ratio exceeds this, reject the response.
 */
export const MAX_COMPRESSION_RATIO = 1000;

/**
 * Maximum size for in-memory compression (in bytes).
 * Larger responses should use streaming compression.
 */
export const MAX_IN_MEMORY_SIZE = 10 * 1024 * 1024; // 10MB

// ============================================================================
// Vary Header
// ============================================================================

/**
 * The header to add to Vary for proper caching.
 */
export const VARY_HEADER = 'Accept-Encoding';

// ============================================================================
// Default Options
// ============================================================================

/**
 * Default compression middleware options.
 */
export const DEFAULT_OPTIONS = {
  /** Enable gzip compression */
  gzip: true,
  /** Enable deflate compression */
  deflate: true,
  /** Enable brotli compression (where supported) */
  brotli: true,
  /** Compression level (0-9 for gzip/deflate, 0-11 for brotli) */
  level: DEFAULT_COMPRESSION_LEVEL,
  /** Minimum response size to compress */
  threshold: DEFAULT_THRESHOLD,
  /** Content types to compress */
  contentTypes: DEFAULT_COMPRESSIBLE_TYPES,
  /** Content types to exclude */
  exclude: DEFAULT_EXCLUDED_TYPES,
} as const;

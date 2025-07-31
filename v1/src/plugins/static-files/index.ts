/**
 * 📁 NextRush Static Files Plugin - Main Export
 * Modular, high-performance static file serving
 */

// Export the optimized plugin
export { StaticFilesPlugin } from './static-files.plugin';
export type { StaticOptions } from './types';

// Export modular components for advanced usage
export { CacheManager } from './cache-manager';
export { CompressionHandler } from './compression-handler';
export { MimeTypeHandler } from './mime-handler';
export { RangeHandler } from './range-handler';
export { SecurityHandler } from './security-handler';

// Export types and constants
export type {
  CacheEntry,
  CompressionOptions,
  RangeInfo,
  StaticMount,
  StaticStats,
} from './types';

export {
  COMPRESSIBLE_TYPES,
  COMPRESSION_THRESHOLD,
  DEFAULT_STATIC_OPTIONS,
  MIME_TYPES,
} from './types';

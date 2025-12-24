/**
 * MIME Type Utilities for NextRush v2
 *
 * Provides content type detection and MIME type mapping.
 *
 * @packageDocumentation
 */

/**
 * MIME type mapping for common file extensions
 */
const MIME_TYPES: Record<string, string> = {
  // Text
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',

  // Scripts
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ts': 'application/typescript; charset=utf-8',

  // Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',

  // Fonts
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',

  // Documents
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx':
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',

  // Archives
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.rar': 'application/vnd.rar',
  '.7z': 'application/x-7z-compressed',

  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',

  // Video
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',

  // Other
  '.wasm': 'application/wasm',
  '.map': 'application/json',
};

/**
 * Default MIME type for unknown extensions
 */
const DEFAULT_MIME_TYPE = 'application/octet-stream';

/**
 * Get MIME type from file extension
 *
 * @param ext - File extension (with or without leading dot)
 * @returns MIME type string
 *
 * @example
 * ```typescript
 * getContentTypeFromExtension('.html'); // 'text/html; charset=utf-8'
 * getContentTypeFromExtension('json');  // 'application/json; charset=utf-8'
 * ```
 */
export function getContentTypeFromExtension(ext: string): string {
  const normalizedExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  return MIME_TYPES[normalizedExt] || DEFAULT_MIME_TYPE;
}

/**
 * Get MIME type from file path
 *
 * @param filePath - Full file path
 * @returns MIME type string
 *
 * @example
 * ```typescript
 * getSmartContentType('/path/to/file.html'); // 'text/html; charset=utf-8'
 * ```
 */
export function getSmartContentType(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1) {
    return DEFAULT_MIME_TYPE;
  }
  const ext = filePath.substring(lastDot).toLowerCase();
  return MIME_TYPES[ext] || DEFAULT_MIME_TYPE;
}

/**
 * Check if MIME type is text-based
 *
 * @param mimeType - MIME type to check
 * @returns true if text-based
 */
export function isTextMimeType(mimeType: string): boolean {
  return (
    mimeType.startsWith('text/') ||
    mimeType.includes('json') ||
    mimeType.includes('xml') ||
    mimeType.includes('javascript')
  );
}

/**
 * Check if MIME type is binary
 *
 * @param mimeType - MIME type to check
 * @returns true if binary
 */
export function isBinaryMimeType(mimeType: string): boolean {
  return !isTextMimeType(mimeType);
}

/**
 * Get all supported MIME types
 *
 * @returns Record of extension to MIME type
 */
export function getSupportedMimeTypes(): Record<string, string> {
  return { ...MIME_TYPES };
}

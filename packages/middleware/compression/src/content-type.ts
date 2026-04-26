/**
 * @nextrush/compression - Content Type Detection
 *
 * Determines whether a response should be compressed based on content type.
 *
 * @packageDocumentation
 */

import {
    DEFAULT_COMPRESSIBLE_TYPES,
    DEFAULT_EXCLUDED_TYPES,
} from './constants.js';

// ============================================================================
// Content Type Matching
// ============================================================================

/**
 * Match a content type against a pattern.
 *
 * Supports:
 * - Exact matches: 'application/json'
 * - Prefix wildcards: 'text/*'
 * - Suffix wildcards: '* /json' (without space)
 *
 * @example
 * ```typescript
 * matchesPattern('text/html', 'text/*');     // true
 * matchesPattern('image/png', 'image/*');    // true
 * matchesPattern('text/html', 'text/html');  // true
 * matchesPattern('text/html', 'text/plain'); // false
 * ```
 *
 * @param contentType - Content type to check
 * @param pattern - Pattern to match against
 * @returns Whether the content type matches the pattern
 */
export function matchesPattern(
  contentType: string,
  pattern: string
): boolean {
  // Exact match
  if (pattern === contentType) {
    return true;
  }

  // Prefix wildcard: 'text/*' matches 'text/html', 'text/plain', etc.
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -1); // 'text/'
    return contentType.startsWith(prefix);
  }

  // Suffix wildcard: '*/json' matches 'application/json', 'text/json', etc.
  if (pattern.startsWith('*/')) {
    const suffix = pattern.slice(1); // '/json'
    return contentType.endsWith(suffix);
  }

  return false;
}

/**
 * Check if a content type matches any pattern in a list.
 *
 * @param contentType - Content type to check
 * @param patterns - Patterns to match against
 * @returns Whether any pattern matches
 */
export function matchesAnyPattern(
  contentType: string,
  patterns: readonly string[]
): boolean {
  for (const pattern of patterns) {
    if (matchesPattern(contentType, pattern)) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// Compressibility Detection
// ============================================================================

/**
 * Extract the MIME type from a Content-Type header value.
 *
 * Strips charset and other parameters.
 *
 * @example
 * ```typescript
 * extractMimeType('application/json; charset=utf-8');
 * // 'application/json'
 * ```
 *
 * @param contentType - Content-Type header value
 * @returns MIME type without parameters
 */
export function extractMimeType(
  contentType: string | null | undefined
): string | null {
  if (!contentType) {
    return null;
  }

  // Split on semicolon to remove parameters
  const [mimeType] = contentType.split(';');
  return mimeType?.trim().toLowerCase() || null;
}

/**
 * Check if a content type is compressible.
 *
 * A content type is compressible if:
 * 1. It matches the include patterns (or defaults)
 * 2. It doesn't match the exclude patterns (or defaults)
 *
 * @example
 * ```typescript
 * isCompressible('application/json');  // true
 * isCompressible('image/png');         // false (already compressed)
 * isCompressible('text/html');         // true
 * ```
 *
 * @param contentType - Content-Type header value
 * @param options - Optional configuration
 * @returns Whether the content type should be compressed
 */
export function isCompressible(
  contentType: string | null | undefined,
  options: {
    contentTypes?: readonly string[];
    exclude?: readonly string[];
  } = {}
): boolean {
  const mimeType = extractMimeType(contentType);

  if (!mimeType) {
    return false;
  }

  const includePatterns = options.contentTypes ?? DEFAULT_COMPRESSIBLE_TYPES;
  const excludePatterns = options.exclude ?? DEFAULT_EXCLUDED_TYPES;

  // Check exclusions first (already compressed content)
  if (matchesAnyPattern(mimeType, excludePatterns)) {
    return false;
  }

  // Check if it matches compressible patterns
  return matchesAnyPattern(mimeType, includePatterns);
}

/**
 * Check if a content type represents already-compressed content.
 *
 * @param contentType - Content-Type header value
 * @returns Whether the content is already compressed
 */
export function isAlreadyCompressed(
  contentType: string | null | undefined
): boolean {
  const mimeType = extractMimeType(contentType);

  if (!mimeType) {
    return false;
  }

  return matchesAnyPattern(mimeType, DEFAULT_EXCLUDED_TYPES);
}

// ============================================================================
// Content Type Categories
// ============================================================================

/**
 * Check if a content type is text-based.
 *
 * @param contentType - Content-Type header value
 * @returns Whether the content is text-based
 */
export function isTextContent(
  contentType: string | null | undefined
): boolean {
  const mimeType = extractMimeType(contentType);

  if (!mimeType) {
    return false;
  }

  return (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/javascript' ||
    mimeType === 'application/xml' ||
    mimeType.endsWith('+json') ||
    mimeType.endsWith('+xml')
  );
}

/**
 * Check if a content type is binary.
 *
 * @param contentType - Content-Type header value
 * @returns Whether the content is binary
 */
export function isBinaryContent(
  contentType: string | null | undefined
): boolean {
  const mimeType = extractMimeType(contentType);

  if (!mimeType) {
    return false;
  }

  return (
    mimeType.startsWith('image/') ||
    mimeType.startsWith('video/') ||
    mimeType.startsWith('audio/') ||
    mimeType === 'application/octet-stream' ||
    mimeType.startsWith('application/x-') ||
    mimeType.includes('zip') ||
    mimeType.includes('tar') ||
    mimeType.includes('rar')
  );
}

/**
 * Get compression recommendation for a content type.
 *
 * @param contentType - Content-Type header value
 * @returns Recommendation object
 */
export function getCompressionRecommendation(
  contentType: string | null | undefined
): {
  shouldCompress: boolean;
  reason: string;
  estimatedRatio?: number;
} {
  const mimeType = extractMimeType(contentType);

  if (!mimeType) {
    return {
      shouldCompress: false,
      reason: 'No content type specified',
    };
  }

  if (isAlreadyCompressed(contentType)) {
    return {
      shouldCompress: false,
      reason: 'Content is already compressed',
    };
  }

  if (isTextContent(contentType)) {
    return {
      shouldCompress: true,
      reason: 'Text content compresses well',
      estimatedRatio: 0.3, // Text typically compresses to ~30% of original
    };
  }

  if (isBinaryContent(contentType)) {
    return {
      shouldCompress: false,
      reason: 'Binary content typically does not benefit from compression',
    };
  }

  if (isCompressible(contentType)) {
    return {
      shouldCompress: true,
      reason: 'Content type is in compressible list',
      estimatedRatio: 0.5,
    };
  }

  return {
    shouldCompress: false,
    reason: 'Content type not in compressible list',
  };
}

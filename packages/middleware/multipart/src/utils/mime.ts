/**
 * @nextrush/multipart - MIME Type Validation
 *
 * Utilities for matching MIME types against allowlists with wildcard support.
 *
 * @packageDocumentation
 */

/**
 * Check if a MIME type matches any of the allowed type patterns.
 *
 * Supports exact matches and wildcard patterns:
 * - `'image/png'` matches only `'image/png'`
 * - `'image/*'` matches `'image/png'`, `'image/jpeg'`, etc.
 * - `'*.*'` matches everything (but don't use this — just omit allowedTypes)
 */
export function isAllowedType(mimeType: string, allowedTypes: string[]): boolean {
  const normalized = mimeType.toLowerCase().trim();

  for (const pattern of allowedTypes) {
    if (matchMimePattern(normalized, pattern.toLowerCase().trim())) {
      return true;
    }
  }

  return false;
}

/**
 * Match a MIME type against a single pattern.
 * Supports `type/*` wildcard matching.
 */
function matchMimePattern(mimeType: string, pattern: string): boolean {
  // Exact match
  if (mimeType === pattern) return true;

  // Wildcard match: 'image/*' matches 'image/png'
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -1); // 'image/'
    return mimeType.startsWith(prefix);
  }

  return false;
}

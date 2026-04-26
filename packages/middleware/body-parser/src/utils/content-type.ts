/**
 * @nextrush/body-parser - Content-Type Utilities
 *
 * Content-type parsing and matching.
 *
 * @packageDocumentation
 */

import { PATTERNS, SUPPORTED_CHARSETS } from '../constants.js';
import type { SupportedCharset } from '../types.js';

/**
 * Extract content-type from headers.
 *
 * @param headers - Request headers object
 * @returns Content-type string or undefined
 */
export function getContentType(
  headers: Readonly<Record<string, string | string[] | undefined>>
): string | undefined {
  const ct = headers['content-type'];
  if (Array.isArray(ct)) {
    return ct[0];
  }
  return ct;
}

/**
 * Extract content-length from headers.
 *
 * @param headers - Request headers object
 * @returns Content-length number or undefined
 */
export function getContentLength(
  headers: Readonly<Record<string, string | string[] | undefined>>
): number | undefined {
  const cl = headers['content-length'];
  const value = Array.isArray(cl) ? cl[0] : cl;

  if (!value) {
    return undefined;
  }

  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return undefined;
  }
  return parsed;
}

/**
 * Check if content-type is JSON (fast path).
 *
 * @param contentType - Content-type header value
 * @returns True if JSON content type
 */
export function isJsonContentType(contentType: string | undefined): boolean {
  if (!contentType) {
    return false;
  }
  return PATTERNS.JSON_CONTENT_TYPE.test(contentType);
}

/**
 * Check if content-type matches any of the given types.
 *
 * Supports:
 * - Exact match: 'application/json'
 * - Wildcard: 'text/*'
 * - Universal: '*​/*'
 *
 * @param contentType - Content-type header value
 * @param types - Array of types to match against
 * @returns True if content-type matches any type
 */
export function matchContentType(
  contentType: string | undefined,
  types: readonly string[]
): boolean {
  if (!contentType) {
    return false;
  }

  // Extract base type without parameters
  const semicolonIndex = contentType.indexOf(';');
  const baseType = (semicolonIndex === -1 ? contentType : contentType.slice(0, semicolonIndex))
    .trim()
    .toLowerCase();

  for (const type of types) {
    // Universal wildcard
    if (type === '*/*') {
      return true;
    }

    // Prefix wildcard (e.g., 'text/*')
    if (type.endsWith('/*')) {
      const prefix = type.slice(0, -1); // Keep the '/' → 'text/'
      if (baseType.startsWith(prefix)) {
        return true;
      }
      continue;
    }

    // Exact match
    if (baseType === type) {
      return true;
    }
  }

  return false;
}

/**
 * Extract charset from content-type header.
 *
 * @param contentType - Content-type header value
 * @returns Charset string or undefined
 */
export function extractCharset(contentType: string | undefined): string | undefined {
  if (!contentType) {
    return undefined;
  }

  const match = PATTERNS.CHARSET.exec(contentType);
  if (match?.[1]) {
    return match[1].toLowerCase();
  }

  return undefined;
}

/**
 * Validate and normalize charset.
 *
 * @param charset - Charset to validate
 * @param defaultCharset - Default charset if invalid
 * @returns Valid charset
 */
export function normalizeCharset(
  charset: string | undefined,
  defaultCharset: SupportedCharset
): SupportedCharset {
  if (!charset) {
    return defaultCharset;
  }

  const normalized = charset.toLowerCase();

  if (SUPPORTED_CHARSETS.has(normalized)) {
    return normalized as SupportedCharset;
  }

  return defaultCharset;
}

/**
 * Check if charset is supported.
 *
 * @param charset - Charset to check
 * @returns True if charset is supported
 */
export function isCharsetSupported(charset: string): boolean {
  return SUPPORTED_CHARSETS.has(charset.toLowerCase());
}

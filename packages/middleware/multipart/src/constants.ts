/**
 * @nextrush/multipart - Constants
 *
 * Default values, limits, patterns, and forbidden keys.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Default Limits
// ---------------------------------------------------------------------------

/** Default maximum file size: 5 MB */
export const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Default maximum number of files per request */
export const DEFAULT_MAX_FILES = 10;

/** Default maximum number of non-file fields */
export const DEFAULT_MAX_FIELDS = 50;

/** Default maximum total parts (files + fields) */
export const DEFAULT_MAX_PARTS = 100;

/** Default maximum field name size in bytes */
export const DEFAULT_MAX_FIELD_NAME_SIZE = 200;

/** Default maximum field value size: 1 MB */
export const DEFAULT_MAX_FIELD_SIZE = 1024 * 1024;

/** Default maximum header key-value pairs per part */
export const DEFAULT_MAX_HEADER_PAIRS = 2000;

/** Default maximum total request body size: 10 MB */
export const DEFAULT_MAX_BODY_SIZE = 10 * 1024 * 1024;

/** RFC 2046 Section 5.1.1: boundary must not exceed 70 characters */
export const MAX_BOUNDARY_LENGTH = 70;

// ---------------------------------------------------------------------------
// Size Units (reused from body-parser pattern)
// ---------------------------------------------------------------------------

export const SIZE_UNITS: Readonly<Record<string, number>> = {
  b: 1,
  kb: 1024,
  mb: 1024 * 1024,
  gb: 1024 * 1024 * 1024,
};

export const SIZE_LIMIT_PATTERN = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i;

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------

/** Field names that must be rejected (prototype pollution prevention) */
export const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Characters unsafe in filenames across platforms.
 * Includes null bytes, control chars, path separators, and shell-dangerous chars.
 */
export const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

/** Maximum filename length (filesystem safe) */
export const MAX_FILENAME_LENGTH = 255;

// ---------------------------------------------------------------------------
// Content Type
// ---------------------------------------------------------------------------

export const MULTIPART_CONTENT_TYPE = 'multipart/form-data';

/** HTTP methods that typically carry a request body */
export const BODYLESS_METHODS = new Set(['GET', 'HEAD', 'DELETE', 'OPTIONS']);

// ---------------------------------------------------------------------------
// Boundary Extraction
// ---------------------------------------------------------------------------

/**
 * Extract the boundary string from a Content-Type header.
 *
 * @example
 * ```
 * extractBoundary('multipart/form-data; boundary=----WebKitFormBoundary')
 * // → '----WebKitFormBoundary'
 * ```
 */
export function extractBoundary(contentType: string): string | undefined {
  const match = /\bboundary=(?:"([^"]+)"|([^\s;]+))/i.exec(contentType);
  return match?.[1] ?? match?.[2];
}

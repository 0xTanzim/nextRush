/**
 * @nextrush/body-parser - Constants
 *
 * Default values, limits, and patterns for body parsing.
 *
 * @packageDocumentation
 */

/**
 * Default size limits
 */
export const DEFAULT_LIMITS = {
  /** Default JSON body limit: 1MB */
  JSON: 1024 * 1024,

  /** Default URL-encoded body limit: 100KB */
  URLENCODED: 100 * 1024,

  /** Default text body limit: 100KB */
  TEXT: 100 * 1024,

  /** Default raw body limit: 100KB */
  RAW: 100 * 1024,
} as const;

/**
 * Default parameter limits
 */
export const DEFAULT_PARAMETER_LIMITS = {
  /** Maximum URL-encoded parameters */
  MAX_PARAMS: 1000,

  /** Maximum nesting depth for extended parsing */
  MAX_DEPTH: 20,
} as const;

/**
 * Default content types
 */
export const DEFAULT_CONTENT_TYPES = {
  JSON: ['application/json'] as readonly string[],
  URLENCODED: ['application/x-www-form-urlencoded'] as readonly string[],
  TEXT: ['text/plain'] as readonly string[],
  RAW: ['application/octet-stream'] as readonly string[],
} as const;

/**
 * HTTP methods that typically don't have bodies
 */
export const BODYLESS_METHODS = new Set(['GET', 'HEAD', 'DELETE', 'OPTIONS']);

/**
 * Size unit multipliers for parsing limit strings
 */
export const SIZE_UNITS: Readonly<Record<string, number>> = {
  b: 1,
  kb: 1024,
  mb: 1024 * 1024,
  gb: 1024 * 1024 * 1024,
};

/**
 * Supported charsets for text parsing
 */
export const SUPPORTED_CHARSETS = new Set([
  'utf8',
  'utf-8',
  'ascii',
  'latin1',
  'binary',
  'base64',
  'hex',
  'ucs2',
  'ucs-2',
  'utf16le',
  'utf-16le',
]);

/**
 * Forbidden keys for prototype pollution prevention
 */
export const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Pre-compiled regex patterns
 */
export const PATTERNS = {
  /** Match JSON content types */
  JSON_CONTENT_TYPE: /^application\/(?:json|[^;]*\+json)(?:;|$)/i,

  /** Parse size limit strings */
  SIZE_LIMIT: /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i,

  /** Extract charset from content-type */
  CHARSET: /charset=([^\s;]+)/i,

  /** Match URL-encoded array notation */
  ARRAY_NOTATION: /\[\]$/,

  /** Match URL-encoded nested notation */
  NESTED_NOTATION: /\[|\]/,
} as const;

/**
 * Buffer size threshold for StringDecoder optimization
 */
export const STRING_DECODER_THRESHOLD = 1024;

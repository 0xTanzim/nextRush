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
 * Default maximum JSON nesting depth (BP-6).
 *
 * Generous enough that legitimate API payloads never hit it, but low enough
 * that a small `[[[…]]]` payload cannot be used as a cheap DoS. Override per
 * call via `json({ maxDepth })`, or disable with `maxDepth: Infinity`.
 */
export const DEFAULT_JSON_MAX_DEPTH = 64;

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
 * HTTP methods that do not carry a request body.
 *
 * Aligned with the runtime's canonical `METHODS_WITHOUT_BODY` policy
 * (`@nextrush/runtime`): DELETE is intentionally **excluded** — RFC 7231 §4.3.5
 * permits a body on DELETE, so a DELETE with a matching Content-Type is parsed.
 * TRACE is included — RFC 7231 §4.3.8 forbids a body on TRACE. The value is
 * duplicated here (not imported) to keep body-parser free of a runtime dependency;
 * the runtime constant is the source of truth for the policy (BP-H).
 */
export const BODYLESS_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

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

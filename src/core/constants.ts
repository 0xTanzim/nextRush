/**
 * Core Constants for NextRush v2
 *
 * Replaces magic numbers with named constants for better
 * maintainability and discoverability.
 *
 * @packageDocumentation
 */

/**
 * Router configuration constants
 */
export const ROUTER_CONSTANTS = {
  /** Default LRU cache size for route lookups */
  DEFAULT_CACHE_SIZE: 1000,

  /** Maximum size for path segment cache */
  PATH_CACHE_SIZE: 500,

  /** Maximum pool size for parameter objects */
  MAX_PARAM_POOL_SIZE: 200,

  /** Character code for ':' (parameter indicator) */
  PARAM_CHAR_CODE: 58,

  /** Character code for '/' (path separator) */
  SLASH_CHAR_CODE: 47,
} as const;

/**
 * Context pool configuration constants
 */
export const CONTEXT_CONSTANTS = {
  /** Maximum number of contexts to pool for reuse */
  MAX_POOL_SIZE: 100,
} as const;

/**
 * Body parser configuration constants
 */
export const BODY_PARSER_CONSTANTS = {
  /** Default maximum request body size (10MB) */
  DEFAULT_MAX_SIZE: 10 * 1024 * 1024,

  /** Default body parsing timeout in milliseconds */
  DEFAULT_TIMEOUT: 5000,

  /** Default streaming threshold (50MB) */
  STREAMING_THRESHOLD: 50 * 1024 * 1024,

  /** Default buffer pool size */
  DEFAULT_POOL_SIZE: 100,
} as const;

/**
 * HTTP configuration constants
 */
export const HTTP_CONSTANTS = {
  /** Default keep-alive timeout in milliseconds */
  DEFAULT_KEEP_ALIVE: 5000,

  /** Default request timeout in milliseconds */
  DEFAULT_REQUEST_TIMEOUT: 30000,

  /** Safety buffer for headers timeout */
  HEADERS_TIMEOUT_BUFFER: 1000,

  /** Default server port */
  DEFAULT_PORT: 3000,

  /** Default server host */
  DEFAULT_HOST: '0.0.0.0',
} as const;

/**
 * Cache configuration constants
 */
export const CACHE_CONSTANTS = {
  /** Default max age for CORS preflight cache */
  CORS_MAX_AGE: 86400,

  /** Default max age for HSTS header */
  HSTS_MAX_AGE: 31536000,
} as const;

/**
 * Security-related constants
 */
export const SECURITY_CONSTANTS = {
  /** Default rate limit window in milliseconds */
  RATE_LIMIT_WINDOW: 60000,

  /** Default rate limit max requests */
  RATE_LIMIT_MAX: 100,
} as const;

/**
 * Default IP address when detection fails
 */
export const DEFAULT_IP = '127.0.0.1';

/**
 * Default hostname when detection fails
 */
export const DEFAULT_HOSTNAME = 'localhost';

/**
 * HTTP methods that are considered idempotent
 */
export const IDEMPOTENT_METHODS = [
  'GET',
  'HEAD',
  'PUT',
  'DELETE',
  'OPTIONS',
  'TRACE',
] as const;

/**
 * HTTP methods that typically don't have a body
 */
export const BODYLESS_METHODS = ['GET', 'HEAD', 'DELETE'] as const;

/**
 * Common MIME type mappings
 */
export const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.csv': 'text/csv',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
} as const;

/**
 * Default content type for unknown file extensions
 */
export const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

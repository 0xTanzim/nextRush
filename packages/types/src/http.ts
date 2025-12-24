/**
 * @nextrush/types - HTTP Type Definitions
 *
 * Core HTTP types used across the NextRush framework.
 * These types provide a clean abstraction over Node.js HTTP primitives.
 *
 * @packageDocumentation
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Readable } from 'node:stream';

// ============================================================================
// HTTP Method Types
// ============================================================================

/**
 * Standard HTTP methods supported by NextRush
 */
export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'PATCH'
  | 'HEAD'
  | 'OPTIONS'
  | 'TRACE'
  | 'CONNECT';

/**
 * Common HTTP methods for convenience
 */
export type CommonHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// ============================================================================
// HTTP Headers Types
// ============================================================================

/**
 * Incoming request headers (read-only)
 */
export type IncomingHeaders = Readonly<Record<string, string | string[] | undefined>>;

/**
 * Outgoing response headers (writable)
 */
export type OutgoingHeaders = Record<string, string | number | string[]>;

// ============================================================================
// HTTP Status Codes
// ============================================================================

/**
 * Common HTTP status codes as constants
 */
export const HttpStatus = {
  // 2xx Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // 3xx Redirection
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  SEE_OTHER: 303,
  NOT_MODIFIED: 304,
  TEMPORARY_REDIRECT: 307,
  PERMANENT_REDIRECT: 308,

  // 4xx Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  NOT_ACCEPTABLE: 406,
  CONFLICT: 409,
  GONE: 410,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // 5xx Server Errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

export type HttpStatusCode = (typeof HttpStatus)[keyof typeof HttpStatus];

// ============================================================================
// Request/Response Body Types
// ============================================================================

/**
 * Supported request body types after parsing
 */
export type ParsedBody =
  | string
  | Buffer
  | Record<string, unknown>
  | unknown[]
  | null
  | undefined;

/**
 * Supported response body types
 */
export type ResponseBody =
  | string
  | Buffer
  | Readable
  | Record<string, unknown>
  | unknown[]
  | null
  | undefined;

// ============================================================================
// Raw HTTP Access Types
// ============================================================================

/**
 * Raw Node.js HTTP objects
 * Provides escape hatch for advanced use cases
 */
export interface RawHttp {
  readonly req: IncomingMessage;
  readonly res: ServerResponse;
}

// ============================================================================
// Content Type Helpers
// ============================================================================

/**
 * Common content types
 */
export const ContentType = {
  JSON: 'application/json',
  HTML: 'text/html',
  TEXT: 'text/plain',
  XML: 'application/xml',
  FORM: 'application/x-www-form-urlencoded',
  MULTIPART: 'multipart/form-data',
  OCTET_STREAM: 'application/octet-stream',
} as const;

export type ContentTypeValue = (typeof ContentType)[keyof typeof ContentType];

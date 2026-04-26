/**
 * @nextrush/types - HTTP Type Definitions
 *
 * Core HTTP types used across the NextRush framework.
 * These types provide a clean abstraction over HTTP primitives,
 * designed to work across multiple runtimes (Node.js, Bun, Deno, Edge).
 *
 * @packageDocumentation
 */

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

/**
 * HTTP methods as readonly tuple for iteration.
 *
 * Note: TRACE and CONNECT are intentionally excluded from this constant.
 * - TRACE enables Cross-Site Tracing (XST) attacks and is disabled by most servers.
 * - CONNECT is used for HTTP tunneling (proxies) and is not relevant to application routing.
 * Both remain in the `HttpMethod` type for completeness (e.g., custom proxy adapters).
 */
export const HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'HEAD',
  'OPTIONS',
] as const satisfies readonly HttpMethod[];

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
 * HTTP status codes
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
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  NOT_ACCEPTABLE: 406,
  PROXY_AUTH_REQUIRED: 407,
  REQUEST_TIMEOUT: 408,
  CONFLICT: 409,
  GONE: 410,
  LENGTH_REQUIRED: 411,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  URI_TOO_LONG: 414,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RANGE_NOT_SATISFIABLE: 416,
  EXPECTATION_FAILED: 417,
  IM_A_TEAPOT: 418,
  UNPROCESSABLE_ENTITY: 422,
  LOCKED: 423,
  FAILED_DEPENDENCY: 424,
  TOO_EARLY: 425,
  UPGRADE_REQUIRED: 426,
  PRECONDITION_REQUIRED: 428,
  TOO_MANY_REQUESTS: 429,
  REQUEST_HEADER_FIELDS_TOO_LARGE: 431,
  UNAVAILABLE_FOR_LEGAL_REASONS: 451,

  // 5xx Server Errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  HTTP_VERSION_NOT_SUPPORTED: 505,
  VARIANT_ALSO_NEGOTIATES: 506,
  INSUFFICIENT_STORAGE: 507,
  LOOP_DETECTED: 508,
  NOT_EXTENDED: 510,
  NETWORK_AUTH_REQUIRED: 511,
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
  | Uint8Array
  | Record<string, unknown>
  | unknown[]
  | null
  | undefined;

/**
 * Supported response body types
 *
 * @remarks
 * Uses structural stream interfaces to avoid coupling to any
 * specific runtime (Node.js, Bun, Deno, Edge).
 * Uint8Array and ArrayBuffer provide Web API compatibility.
 */
export type ResponseBody =
  | string
  | Uint8Array
  | ArrayBuffer
  | NodeStreamLike
  | WebStreamLike
  | Record<string, unknown>
  | unknown[]
  | null
  | undefined;

// ============================================================================
// Cross-Runtime Stream Types
// ============================================================================

/**
 * Structural interface for Node.js-compatible readable streams.
 * Matches Node.js `Readable` and `IncomingMessage` without importing `@types/node`.
 */
export interface NodeStreamLike {
  pipe(destination: unknown): unknown;
}

/**
 * Structural interface for Web API ReadableStreams.
 * Matches the global `ReadableStream<Uint8Array>` without requiring DOM lib types.
 */
export interface WebStreamLike {
  getReader(): unknown;
  readonly locked: boolean;
}

// ============================================================================
// Raw HTTP Access Types
// ============================================================================

/**
 * Raw HTTP objects - generic to support multiple runtimes
 *
 * For Node.js: RawHttp<IncomingMessage, ServerResponse>
 * For Bun: RawHttp<Request, Response>
 * For Edge: RawHttp<Request, ResponseInit>
 *
 * @typeParam TReq - Raw request type for the runtime
 * @typeParam TRes - Raw response type for the runtime
 */
export interface RawHttp<TReq = unknown, TRes = unknown> {
  readonly req: TReq;
  readonly res: TRes;
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

/**
 * @nextrush/body-parser - Type Definitions
 *
 * All interfaces and types for body parsing middleware.
 *
 * @packageDocumentation
 */

/**
 * HTTP methods that do not carry a request body (aligned with the runtime
 * `METHODS_WITHOUT_BODY` policy — DELETE excluded, TRACE included; see BP-H).
 */
export type BodylessMethod = 'GET' | 'HEAD' | 'OPTIONS' | 'TRACE';

/**
 * HTTP methods that may carry a request body (DELETE may per RFC 7231 §4.3.5).
 */
export type BodyMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Supported buffer encodings for text parsing
 */
export type SupportedCharset =
  | 'utf8'
  | 'utf-8'
  | 'ascii'
  | 'latin1'
  | 'binary'
  | 'base64'
  | 'hex'
  | 'ucs2'
  | 'ucs-2'
  | 'utf16le'
  | 'utf-16le';

/**
 * Body source interface for cross-runtime body reading
 *
 * @remarks
 * This interface is a minimal version of BodySource from @nextrush/types.
 * It allows body-parser to work independently without importing types package.
 */
export interface BodyParserBodySource {
  /** Read the body as a UTF-8 string */
  text(): Promise<string>;

  /**
   * Read the body as a Uint8Array buffer.
   *
   * @param limit - Optional per-read byte limit enforced incrementally by the
   *   adapter (RFC 017). When omitted, the source's construction-time limit governs.
   */
  buffer(limit?: number): Promise<Uint8Array>;

  /** Read the body as JSON */
  json<T = unknown>(): Promise<T>;

  /** Whether the body has been consumed */
  readonly consumed: boolean;

  /** Content length from headers (if available) */
  readonly contentLength: number | undefined;

  /** Content type from headers (if available) */
  readonly contentType: string | undefined;
}

/**
 * Minimal context interface for body-parser middleware
 *
 * This interface defines the minimum requirements for a context object
 * to work with body-parser middleware. It is designed to be compatible
 * with NextRush Context while remaining decoupled from core.
 *
 * @remarks
 * Requires `ctx.bodySource` for cross-runtime body reading (Node, Bun, Deno,
 * Edge adapters all provide this).
 */
export interface BodyParserContext {
  /** HTTP method (GET, POST, etc.) */
  readonly method: string;

  /** Request path */
  readonly path: string;

  /** Request headers (lowercase keys) */
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;

  /**
   * Body source for cross-runtime body reading
   *
   * @remarks
   * Modern adapters (Node, Bun, Deno, Edge) provide this for unified body reading.
   */
  readonly bodySource?: BodyParserBodySource;

  /** Parsed request body (set by body-parser) */
  body?: unknown;

  /** Raw request body buffer (optional, when rawBody option is true) */
  rawBody?: Buffer | Uint8Array;
}

/**
 * JSON reviver function for custom parsing
 */
export type JsonReviver = (key: string, value: unknown) => unknown;

/**
 * Verify callback invoked after reading the raw body, before parsing.
 *
 * Throw an error to reject the request body.
 *
 * @param ctx - Request context
 * @param body - Raw body bytes. A Node `Buffer` when the runtime provides one
 *   (so `.toString('hex')`, HMAC `.update(body)`, etc. work), otherwise a plain
 *   `Uint8Array` on edge runtimes.
 * @param encoding - Content encoding / charset
 */
export type VerifyCallback = (
  ctx: BodyParserContext,
  body: Uint8Array,
  encoding: string
) => void | Promise<void>;

/**
 * Base options shared by all parsers
 */
export interface BaseParserOptions {
  /**
   * Maximum body size.
   * Can be a number (bytes) or string with unit ('1kb', '1mb', '1gb').
   */
  readonly limit?: number | string;

  /**
   * Content-Types to parse.
   * Can be a single type or array of types.
   * Supports wildcards like 'text/*'.
   */
  readonly type?: string | readonly string[];

  /**
   * Store raw body buffer on ctx.rawBody.
   * @default false
   */
  readonly rawBody?: boolean;

  /**
   * Verify callback invoked after reading raw body, before parsing.
   * Throw an error to reject the body.
   */
  readonly verify?: VerifyCallback;
}

/**
 * JSON body parser options
 */
export interface JsonOptions extends BaseParserOptions {
  /**
   * Custom JSON reviver function.
   * Passed to JSON.parse() as second argument.
   */
  readonly reviver?: JsonReviver;

  /**
   * Strict mode - only accept objects and arrays.
   * Rejects primitives like strings, numbers, booleans, null.
   * @default true
   */
  readonly strict?: boolean;

  /**
   * Maximum JSON nesting depth.
   * Rejects payloads deeper than this limit after parsing.
   * Set to `Infinity` to disable depth checking.
   * @default 64
   */
  readonly maxDepth?: number;
}

/**
 * URL-encoded body parser options
 */
export interface UrlEncodedOptions extends BaseParserOptions {
  /**
   * Enable extended parsing for nested objects.
   * When true, `user[name]=John` becomes `{ user: { name: 'John' } }`.
   * @default true
   */
  readonly extended?: boolean;

  /**
   * Maximum number of parameters to accept.
   * Prevents parameter pollution attacks.
   * @default 1000
   */
  readonly parameterLimit?: number;

  /**
   * Maximum nesting depth for extended parsing.
   * Prevents stack overflow from deeply nested structures.
   * @default 20
   */
  readonly depth?: number;
}

/**
 * Text body parser options
 */
export interface TextOptions extends BaseParserOptions {
  /**
   * Default charset when not specified in Content-Type.
   * @default 'utf-8'
   */
  readonly defaultCharset?: SupportedCharset;
}

/**
 * Raw body parser options
 */
export interface RawOptions extends BaseParserOptions {
  // Raw parser only uses base options
}

/**
 * Combined body parser options
 */
export interface BodyParserOptions {
  /**
   * JSON parser options.
   * Set to false to disable JSON parsing.
   */
  readonly json?: JsonOptions | false;

  /**
   * URL-encoded parser options.
   * Set to false to disable URL-encoded parsing.
   */
  readonly urlencoded?: UrlEncodedOptions | false;

  /**
   * Text parser options.
   * Set to false to disable text parsing.
   */
  readonly text?: TextOptions | false;

  /**
   * Raw parser options.
   * Set to false to disable raw parsing.
   */
  readonly raw?: RawOptions | false;
}

/**
 * Error codes for body parser errors
 */
export type BodyParserErrorCode =
  | 'ENTITY_TOO_LARGE'
  | 'INVALID_JSON'
  | 'INVALID_URLENCODED'
  | 'STRICT_MODE_VIOLATION'
  | 'TOO_MANY_PARAMETERS'
  | 'DEPTH_EXCEEDED'
  | 'JSON_DEPTH_EXCEEDED'
  | 'INVALID_PARAMETER'
  | 'BODY_READ_ERROR'
  | 'REQUEST_CLOSED'
  | 'REQUEST_ABORTED'
  | 'INVALID_CONTENT_TYPE'
  | 'UNSUPPORTED_CONTENT_TYPE'
  | 'UNSUPPORTED_CHARSET';

/**
 * Result of reading a request body
 */
export interface ReadBodyResult {
  /** The body bytes */
  readonly buffer: Uint8Array;

  /** Number of bytes received */
  readonly length: number;
}

/**
 * Parsed URL-encoded data
 */
export type ParsedUrlEncoded = Record<string, unknown>;

/**
 * Parsed JSON data
 */
export type ParsedJson = Record<string, unknown> | unknown[];

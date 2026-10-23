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
   * Single-name header lookup, when the context provides one.
   *
   * @remarks
   * Preferred over `headers` by the parsers: reading `headers` materializes the
   * whole record, while `get(name)` reads one value. Optional so narrow test
   * doubles that only implement `headers` keep working.
   */
  get?(name: string): string | undefined;

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

  /**
   * Defer reading and parsing the body until the application asks for it.
   *
   * @remarks
   * The default (`false`) parses eagerly, before `next()` runs, so a malformed
   * or oversized body is rejected before any handler or middleware side effect.
   *
   * With `lazy: true` the middleware only *detects* — method, existing body,
   * media type — and installs a reader. Bytes are acquired, the size limit is
   * enforced, `verify` runs, and the body is parsed only when the handler calls
   * `await ctx.readBody()`. A request whose body is never read costs nothing.
   *
   * Five observable differences, all consequences of that timing change:
   *
   * 1. On a request this parser claimed, `ctx.body` **throws**
   *    (`BODY_NOT_READ`) before a successful `readBody()`, instead of being
   *    `undefined`. Read it only after awaiting. A request no parser claimed
   *    (bodyless method, unmatched media type under the default policy) keeps
   *    its `undefined`.
   * 2. A malformed body rejects at the `readBody()` call site, so a handler can
   *    `try/catch` it, instead of rejecting before the handler runs.
   * 3. An oversized body returns `413` only if the body is read. A runtime-level
   *    cap (Bun's `maxRequestBodySize`) still applies unconditionally; the other
   *    adapters have no transport cap, and this option does not add or relax one.
   * 4. `ctx.rawBody` is populated only after `readBody()`, at the same moment as
   *    `ctx.body`.
   * 5. A middleware that answers early (`401`, `404`) preempts a body error that
   *    eager parsing would have raised first.
   *
   * `readBody()` is idempotent and safe to call concurrently: the body source is
   * read once and a failure is cached for the rest of the request. It exists in
   * both modes, so handler code does not have to change when the flag changes.
   *
   * @default false
   *
   * @example
   * ```typescript
   * app.use(bodyParser({ lazy: true }));
   *
   * app.post('/hooks', async (ctx) => {
   *   const payload = await ctx.readBody<{ id: string }>();
   *   return ctx.json({ received: payload.id });
   * });
   * ```
   *
   * @see RFC-047
   */
  readonly lazy?: boolean;
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

  /**
   * What to do with a request body whose `Content-Type` no configured parser
   * can handle.
   *
   * @remarks
   * `'ignore'` leaves `ctx.body` undefined and continues — how every content
   * type except `multipart/*` has always behaved. `'reject'` answers
   * `415 Unsupported Content Type` before any handler runs, so a JSON API
   * reports "wrong media type" instead of letting a handler proceed with an
   * undefined body and a validator report the misleading "body required".
   *
   * Only requests that carry a `Content-Type` are rejected; a bodyless method or
   * a request with no `Content-Type` at all is untouched either way.
   * `multipart/*` rejects under both policies — it has always had a dedicated
   * error naming the missing parser.
   *
   * @default 'ignore'
   */
  readonly onUnsupportedContentType?: 'ignore' | 'reject';

  /**
   * Defer reading and parsing every body until `await ctx.readBody()`.
   *
   * @remarks
   * One flag governs the whole combined parser. A per-parser `lazy` inside
   * `json`/`urlencoded`/`text`/`raw` is ignored here — mixing lazy JSON with
   * eager form parsing would make error timing depend on the media type, which
   * is exactly the non-determinism this option must not introduce.
   *
   * Detection still runs eagerly: an unsupported media type under
   * `onUnsupportedContentType: 'reject'` and a `multipart/*` body both answer
   * `415` before the handler, because neither decision needs the bytes.
   *
   * See {@link BaseParserOptions.lazy} for the five observable differences.
   *
   * @default false
   *
   * @see RFC-047
   */
  readonly lazy?: boolean;
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
  | 'UNSUPPORTED_CHARSET'
  | 'BODY_NOT_READ';

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

/**
 * @nextrush/types - Context Type Definitions
 *
 * The Context object is the heart of NextRush's request/response handling.
 * It provides a unified interface for accessing request data and sending responses.
 *
 * Design Philosophy:
 * - ctx.body = request body (INPUT)
 * - ctx.json() = send JSON response (OUTPUT)
 * - ctx.next() = call next middleware
 *
 * @packageDocumentation
 */

import type { HttpMethod, IncomingHeaders, RawHttp, ResponseBody, ResponseOptions } from './http';
import { OUTGOING_RESPONSE, type OutgoingResponseHandle } from './outgoing-response';
import type { CookieCapability } from './cookies';
import type { BodySource, PlatformId, Runtime } from './runtime';
import type {
  NDJSONStreamWriter,
  SSEStreamWriter,
  StreamRun,
  TextStreamWriter,
} from './stream';

// ============================================================================
// Route Parameters
// ============================================================================

/**
 * Route parameters extracted from URL path
 * Example: /users/:id -> { id: '123' }
 */
export type RouteParams = Record<string, string>;

/**
 * Query string parameters
 * Example: ?page=1&limit=10 -> { page: '1', limit: '10' }
 */
export type QueryParams = Record<string, string | string[] | undefined>;

// ============================================================================
// Request State
// ============================================================================

/**
 * Request-scoped state object
 * Use this to pass data between middleware
 */
export type ContextState = Record<string | symbol, unknown>;

// ============================================================================
// Context Interface
// ============================================================================

/**
 * The Context interface - core of NextRush request handling
 *
 * @example
 * ```typescript
 * app.get('/users/:id', async (ctx) => {
 *   // Request data (input)
 *   const { id } = ctx.params;
 *   const { name } = ctx.body;
 *
 *   // Response (output)
 *   ctx.status = 200;
 *   ctx.json({ id, name });
 * });
 * ```
 */
export interface Context {
  // =========================================================================
  // REQUEST - Input (Read-only properties)
  // =========================================================================

  /**
   * HTTP method (GET, POST, PUT, DELETE, etc.)
   * @readonly
   */
  readonly method: HttpMethod;

  /**
   * Full request URL including query string
   * @example '/users/123?include=posts'
   * @readonly
   */
  readonly url: string;

  /**
   * Request path without query string, canonicalized by the router (case
   * folded per `caseSensitive`, structurally normalized) — the value the
   * router actually matched on, and the one path-based policy middleware
   * should compare against instead of hand-rolling its own normalization
   * (RFC-029). See {@link originalPath} for the untouched raw target.
   * @example '/users/123'
   * @readonly
   */
  readonly path: string;

  /**
   * The raw request target as received, before router canonicalization —
   * still query-string-free, but not case-folded or structurally normalized.
   * Optional: populated once the router's dispatch middleware runs; absent
   * (or equal to {@link path}) when no router has run yet, or when a caller
   * constructs a `Context` directly (e.g. a test double) without one. Prefer
   * `path` for any security- or routing-relevant comparison (RFC-029).
   * @example '/Users/123' when a request for '/USERS/123' matched '/users/:id'
   * @readonly
   */
  readonly originalPath?: string;

  /**
   * Parsed query string parameters
   * @example { include: 'posts', limit: '10' }
   * @readonly
   */
  readonly query: QueryParams;

  /**
   * Request headers (read-only)
   * Use ctx.get() for case-insensitive access
   * @readonly
   */
  readonly headers: IncomingHeaders;

  /**
   * Client IP address
   * @readonly
   */
  readonly ip: string;

  // =========================================================================
  // REQUEST BODY - Input (Populated by body parser middleware)
  // =========================================================================

  /**
   * Parsed request body (input).
   *
   * Populated by body-parser middleware (json, urlencoded, multipart).
   * This is the **request body**, not the response body.
   * Use `ctx.json()`, `ctx.send()`, or `ctx.html()` to set response output.
   *
   * @remarks
   * With `bodyParser({ lazy: true })` the body is not parsed until
   * {@link readBody} is called, and reading this property before then throws a
   * `BodyParserError` (`BODY_NOT_READ`) instead of returning `undefined` — a
   * silent `undefined` would be indistinguishable from "no body". Prefer
   * `await ctx.readBody()` in handler code that must work in both modes.
   *
   * @example
   * ```typescript
   * app.post('/users', async (ctx) => {
   *   const { name, email } = ctx.body as CreateUserDto;
   * });
   * ```
   */
  body: unknown;

  /**
   * Read the request body, parsing it once and caching the result.
   *
   * @remarks
   * The portable way to consume a request body: the same call works with eager
   * parsing (resolves from the body the middleware already parsed) and with
   * `bodyParser({ lazy: true })` (performs the deferred read and parse).
   *
   * Concurrent calls share a single read, so the single-consumption body source
   * is never drained twice. A failed read caches its error for the rest of the
   * request, so a retry cannot re-read a consumed stream or produce a different
   * outcome.
   *
   * Resolves with `undefined` when no parser claimed the request (a bodyless
   * method, an unmatched media type under the `'ignore'` policy) or when the
   * parser found an empty JSON body.
   *
   * @typeParam T - Expected parsed body type. Not validated; the caller asserts.
   *
   * @example
   * ```typescript
   * app.post('/hooks', async (ctx) => {
   *   const payload = await ctx.readBody<{ id: string }>();
   *   return ctx.json({ received: payload.id });
   * });
   * ```
   *
   * @see RFC-047
   */
  readBody<T = unknown>(): Promise<T>;

  // =========================================================================
  // ROUTE PARAMS - Input (Set by router)
  // =========================================================================

  /**
   * Route parameters from URL path
   *
   * @example
   * ```typescript
   * // Route: /users/:id/posts/:postId
   * // URL: /users/123/posts/456
   * ctx.params // { id: '123', postId: '456' }
   * ```
   */
  params: RouteParams;

  // =========================================================================
  // RESPONSE - Output
  // =========================================================================

  /**
   * HTTP response status code
   * @default 200
   *
   * @example
   * ```typescript
   * ctx.status = 201; // Created
   * ctx.status = 404; // Not Found
   * ```
   */
  status: number;

  /**
   * Send JSON response
   * Automatically sets Content-Type: application/json
   *
   * @param data - Data to serialize as JSON
   * @param statusOrOptions - Explicit status, or response options carrying
   *   `status` and `headers`. An explicit status overrides the carried
   *   `ctx.status` and is recorded back onto it. Omitting it keeps the carried
   *   status (default 200).
   *
   * @example
   * ```typescript
   * ctx.json({ users: [] });
   * ctx.json({ id: 'u_123' }, 201);
   * ctx.json({ id: 'u_123' }, { status: 201, headers: { Location: '/users/u_123' } });
   * ```
   */
  json(data: unknown, statusOrOptions?: number | ResponseOptions): void;

  /**
   * Send response (text, buffer, or stream)
   * Automatically detects content type
   *
   * @param data - Response data
   * @param statusOrOptions - Explicit status, or response options carrying
   *   `status` and `headers` (see {@link json}).
   *
   * @example
   * ```typescript
   * ctx.send('Hello World');
   * ctx.send('Created', 201);
   * ctx.send('Created', { headers: { Location: '/items/1' } });
   * ctx.send(Buffer.from('binary data'));
   * ctx.send(fileStream);
   * ```
   */
  send(data: ResponseBody, statusOrOptions?: number | ResponseOptions): void;

  /**
   * Send HTML response
   * Automatically sets Content-Type: text/html
   *
   * @param content - HTML string
   * @param statusOrOptions - Explicit status, or response options carrying
   *   `status` and `headers` (see {@link json}).
   *
   * @example
   * ```typescript
   * ctx.html('<h1>Hello World</h1>');
   * ctx.html('<h1>Created</h1>', { status: 201 });
   * ```
   */
  html(content: string, statusOrOptions?: number | ResponseOptions): void;

  /**
   * Redirect to another URL
   *
   * @param url - Target URL
   * @param status - HTTP status code (default: 302)
   *
   * @example
   * ```typescript
   * ctx.redirect('/login');
   * ctx.redirect('/new-page', 301); // Permanent redirect
   * ```
   */
  redirect(url: string, status?: number): void;

  // =========================================================================
  // ERROR HELPERS
  // =========================================================================

  /**
   * Throw an HTTP error - stops execution and triggers error handler
   *
   * @param status - HTTP status code
   * @param message - Error message (optional)
   * @throws HttpError
   *
   * @example
   * ```typescript
   * ctx.throw(404, 'User not found');
   * ctx.throw(401); // Uses default message "Unauthorized"
   * ```
   */
  throw(status: number, message?: string): never;

  /**
   * Assert a condition, throw if falsy
   *
   * @param condition - Condition to check
   * @param status - HTTP status code if assertion fails
   * @param message - Error message (optional)
   * @throws HttpError if condition is falsy
   *
   * @example
   * ```typescript
   * ctx.assert(user, 404, 'User not found');
   * ctx.assert(user.isAdmin, 403, 'Admin access required');
   * ctx.assert(ctx.body, 400); // Uses default "Bad Request"
   * ```
   */
  assert(condition: unknown, status: number, message?: string): asserts condition;

  // =========================================================================
  // HEADER HELPERS
  // =========================================================================

  /**
   * Set response header
   *
   * @param field - Header name
   * @param value - Header value (string, number, or array for multi-value headers like Set-Cookie)
   *
   * @example
   * ```typescript
   * ctx.set('X-Request-Id', '123');
   * ctx.set('Cache-Control', 'no-cache');
   * ctx.set('Set-Cookie', ['a=1; Path=/', 'b=2; Path=/']);
   * ```
   */
  set(field: string, value: string | number | string[]): void;

  /**
   * Get request header (case-insensitive)
   *
   * @param field - Header name
   * @returns Header value or undefined
   *
   * @example
   * ```typescript
   * const auth = ctx.get('Authorization');
   * const contentType = ctx.get('content-type');
   * ```
   */
  get(field: string): string | undefined;

  // =========================================================================
  // MIDDLEWARE
  // =========================================================================

  /**
   * Call the next middleware in the chain
   * Modern syntax: ctx.next() instead of next()
   *
   * @example
   * ```typescript
   * app.use(async (ctx) => {
   *   console.log('Before');
   *   await ctx.next();
   *   console.log('After');
   * });
   * ```
   */
  next(): Promise<void>;

  /**
   * Set the next middleware function
   * @internal Used by middleware compose to wire up ctx.next()
   */
  setNext?(fn: Next): void;

  /**
   * Whether a response has already been sent
   *
   * @remarks
   * Useful for middleware that needs to check if downstream
   * middleware has already sent a response.
   */
  readonly responded: boolean;

  /**
   * The recorded outgoing response an adapter will flush, available to
   * middleware that runs after the handler.
   *
   * @remarks
   * Symbol-keyed and optional: `@nextrush/runtime` owns the implementation, and
   * a hand-written context (a test double, a minimal adapter) is not required to
   * expose one. A middleware that needs the body — compression, ETag — reads it
   * from here and never from {@link body}, which is the parsed *request* body.
   *
   * Use {@link OUTGOING_RESPONSE} to read it; it is `@internal` and carries no
   * semver guarantee.
   */
  readonly [OUTGOING_RESPONSE]?: OutgoingResponseHandle;

  // =========================================================================
  // STATE
  // =========================================================================

  /**
   * Request-scoped state object
   * Use to pass data between middleware
   *
   * @example
   * ```typescript
   * // Auth middleware
   * app.use(async (ctx) => {
   *   ctx.state.user = await validateToken(ctx.get('Authorization'));
   *   await ctx.next();
   * });
   *
   * // Route handler
   * app.get('/profile', (ctx) => {
   *   const user = ctx.state.user;
   * });
   * ```
   */
  state: ContextState;

  /**
   * Cookie capability (RFC-034).
   *
   * Always present on every context; the `cookies()` middleware activates it
   * by replacing the uninitialized slot with a per-request cookie store.
   * Before activation, every operation throws `CapabilityNotInitializedError`
   * (`@nextrush/errors`) — property access itself never throws.
   *
   * @example
   * ```typescript
   * app.use(cookies());
   *
   * app.get('/login', (ctx) => {
   *   ctx.cookies.set('session', 'abc', { httpOnly: true, maxAge: 86400 });
   *   const session = ctx.cookies.get('session');
   * });
   * ```
   */
  cookies: CookieCapability;

  // =========================================================================
  // RAW ACCESS
  // =========================================================================

  /**
   * Raw HTTP objects (platform-specific)
   * Escape hatch for advanced use cases
   *
   * @remarks
   * The type of `raw` depends on the adapter:
   * - Node.js: `{ req: IncomingMessage, res: ServerResponse }`
   * - Bun/Deno/Edge: `{ req: Request, res: Response | undefined }`
   *
   * @example
   * ```typescript
   * // Node.js adapter
   * ctx.raw.req.socket.remoteAddress;
   *
   * // Web API adapter (Bun/Deno/Edge)
   * ctx.raw.req.headers.get('authorization');
   * ```
   */
  readonly raw: RawHttp;

  // =========================================================================
  // RUNTIME & BODY SOURCE
  // =========================================================================

  /**
   * Current JavaScript runtime
   *
   * @remarks
   * Useful for runtime-specific optimizations or conditional logic.
   *
   * @example
   * ```typescript
   * if (ctx.runtime === 'bun') {
   *   // Bun-specific optimization
   * }
   * ```
   */
  readonly runtime: Runtime;

  /**
   * Named deployment platform, when known — orthogonal to {@link runtime}.
   *
   * @remarks
   * `undefined` on adapters/runtimes with no named platform to report (e.g.
   * plain Node.js, Bun, Deno). On `@nextrush/adapter-edge` and
   * `@nextrush/adapter-serverless`, set when the platform is detectable
   * (Cloudflare Workers, Vercel Edge, Netlify Edge) or explicitly known by
   * the Tier-1 handler that built this context (AWS Lambda, Google Cloud
   * Functions, Azure Functions).
   *
   * @example
   * ```typescript
   * if (ctx.platform === 'lambda') {
   *   // AWS Lambda-specific behavior
   * }
   * ```
   */
  readonly platform: PlatformId | undefined;

  /**
   * Body source for cross-runtime body reading
   *
   * @remarks
   * Used by body parsers to read request bodies in a runtime-agnostic way.
   * Most applications should use `ctx.body` (set by body-parser middleware)
   * instead of accessing `bodySource` directly.
   *
   * @example
   * ```typescript
   * // In a custom body parser
   * const text = await ctx.bodySource.text();
   * const json = JSON.parse(text);
   * ```
   */
  readonly bodySource: BodySource;

  // =========================================================================
  // RESPONSE STREAMING (text / SSE / NDJSON)
  // See docs/RFC/request-data/003-stream.md
  // =========================================================================

  /**
   * Abort signal that fires when the client disconnects mid-response.
   *
   * @internal
   * @remarks
   * Adapter-level primitive consumed by `@nextrush/stream`. Handlers should use
   * `writer.signal` inside `ctx.stream()`/`ctx.sse()`/`ctx.ndjson()` instead of
   * accessing this directly. Synthesized on Node from response `close`/request
   * `aborted`; passed through natively on Bun/Deno/Edge from `Request.signal`.
   */
  readonly signal: AbortSignal;

  /**
   * Send a raw byte stream as the response body.
   *
   * @internal
   * @remarks
   * Adapter-level transport primitive consumed by `@nextrush/stream`. Not
   * intended for direct handler use — use `ctx.stream()`/`ctx.sse()`/
   * `ctx.ndjson()`. Resolves when the stream is fully flushed (Node) or once the
   * response body is wired (Bun/Deno/Edge).
   *
   * @param source - A Web `ReadableStream` of bytes to stream to the client.
   */
  sendStream(source: ReadableStream<Uint8Array>): Promise<void>;

  /**
   * Stream a raw text/byte response. The connection closes automatically when
   * the callback resolves.
   *
   * @param run - Callback that receives a {@link TextStreamWriter}.
   *
   * @example
   * ```typescript
   * await ctx.stream(async (writer) => {
   *   await writer.write('Loading...\n');
   *   await writer.write('Done.\n');
   * });
   * ```
   */
  stream(run: StreamRun<TextStreamWriter>): Promise<void>;

  /**
   * Stream a Server-Sent Events (`text/event-stream`) response.
   *
   * @param run - Callback that receives an {@link SSEStreamWriter}.
   *
   * @example
   * ```typescript
   * await ctx.sse(async (writer) => {
   *   for await (const token of llm) await writer.write({ data: token });
   * });
   * ```
   */
  sse(run: StreamRun<SSEStreamWriter>): Promise<void>;

  /**
   * Stream a newline-delimited JSON (`application/x-ndjson`) response.
   *
   * @param run - Callback that receives an {@link NDJSONStreamWriter}.
   *
   * @example
   * ```typescript
   * await ctx.ndjson(async (writer) => {
   *   await writer.write({ step: 'search' });
   *   await writer.write({ step: 'done' });
   * });
   * ```
   */
  ndjson(run: StreamRun<NDJSONStreamWriter>): Promise<void>;
}

/**
 * Next function type (traditional Koa-style)
 */
export type Next = () => Promise<void>;

/**
 * Middleware function type
 * Supports both modern and traditional syntax
 *
 * Modern syntax (ctx.next()):
 * ```typescript
 * app.use(async (ctx) => {
 *   await ctx.next();
 * });
 * ```
 *
 * Traditional syntax (next parameter):
 * ```typescript
 * app.use(async (ctx, next) => {
 *   await next();
 * });
 * ```
 */
export type Middleware = (ctx: Context, next: Next) => void | Promise<void>;

/**
 * Route handler type (alias for middleware)
 */
export type RouteHandler = Middleware;

// ============================================================================
// Context Factory
// ============================================================================

/**
 * Options for creating a new context
 */
export interface ContextOptions {
  /** HTTP method */
  method: HttpMethod;
  /** Request URL */
  url: string;
  /** Request headers */
  headers?: IncomingHeaders;
  /** Client IP */
  ip?: string;
  /** Raw HTTP objects */
  raw: RawHttp;
}

/**
 * @nextrush/runtime - Shared Web Context Base (F-08, ADR-0010)
 *
 * @remarks
 * The Bun, Deno, and Edge contexts share the response *state machine*
 * ({@link WebResponseBuilder}) but, before this extraction, triplicated the
 * Context *shell* — field declarations, response-method delegation, the lazy
 * `raw`/`signal`/`triggerTimeout`, the streaming methods, and
 * `get`/`next`/`throw`/`assert` — as ~200 near-identical lines per adapter.
 * This class is that shell, defined once. Each adapter's context extends it
 * and supplies only its platform-specific `ip` (via the constructor) and any
 * extras (Edge's `env`/`waitUntil`/`executionContext`).
 *
 * This is a behavior-preserving extraction: every documented lazy-allocation
 * and identity guarantee (`ctx.raw === ctx.raw`, the `HP-*`/`F-*` hot-path
 * notes) and every cross-adapter behavior pinned by
 * `packages/adapters/conformance` is carried over unchanged.
 *
 * @packageDocumentation
 */

import { HttpError } from '@nextrush/errors';
import { BODY_READER, OUTGOING_RESPONSE } from '@nextrush/types';
import type {
  BodyReaderCarrier,
  BodySource,
  ContextState,
  CookieCapability,
  FetchContext,
  HttpMethod,
  IncomingHeaders,
  NDJSONStreamWriter,
  OutgoingResponseHandle,
  PlatformId,
  QueryParams,
  RawHttp,
  ResponseBody,
  RouteParams,
  Runtime,
  SSEStreamWriter,
  StreamRun,
  TextStreamWriter,
} from '@nextrush/types';
import { combineAbortSignal, type CombinedAbort } from './request-signal';
import { requestTargetFromUrl } from './request-target';
import { UNINITIALIZED_COOKIES } from './capabilities';
import { createEmptyBodySource } from './body-source';
import { WebBodySource } from './body-source';
import { WebResponseBuilder } from './response-builder';
import { METHODS_WITHOUT_BODY } from './constants';
import { RequestInputs, type ClientAddress } from './request-inputs';
import { NULL_PROTO } from './null-proto';
import { parseQueryString } from './query';

/**
 * Shared empty params object — avoids allocation per request (overwritten by
 * router). Built on {@link NULL_PROTO} because it is *read* on every
 * params-less request, where a dictionary-mode miss-read measured 2.2x slower.
 */
const EMPTY_PARAMS: RouteParams = Object.freeze(Object.create(NULL_PROTO)) as RouteParams;

/** Shared resolved promise for `next()` when no dispatch thunk is wired (HP-7). */
const RESOLVED_NEXT: Promise<void> = Promise.resolve();

/** The `{ req, res }` shape every Web adapter's `ctx.raw` returns (`res` is always `undefined`). */
export type WebRawHttp = RawHttp<Request, undefined>;

/**
 * The streaming/runtime primitives a concrete Web context wires in — the
 * pieces that are genuinely shared logic (`runTextStream`/`runSSEStream`/
 * `runNDJSONStream` from `@nextrush/stream`) but that `@nextrush/runtime`
 * cannot import directly without creating a `runtime` → `stream` dependency
 * edge that inverts the package hierarchy. Each adapter passes its own
 * `@nextrush/stream` imports through once, in its constructor call to `super`.
 */
export interface WebStreamRunners {
  runTextStream: (ctx: FetchContext, run: StreamRun<TextStreamWriter>) => Promise<void>;
  runSSEStream: (ctx: FetchContext, run: StreamRun<SSEStreamWriter>) => Promise<void>;
  runNDJSONStream: (ctx: FetchContext, run: StreamRun<NDJSONStreamWriter>) => Promise<void>;
}

/**
 * Shared Context shell for every Fetch-API adapter (Bun, Deno, Edge).
 *
 * @remarks
 * Subclasses supply the resolved `ip` and `runtime` at construction time (each
 * platform's IP/runtime-detection policy differs and is genuinely adapter-
 * specific — see each adapter's own constructor) and may add platform extras
 * (Edge's `env`/`waitUntil`). Every response method, the lazy `raw`/`signal`,
 * the streaming methods, and `get`/`next`/`throw`/`assert` live here, once.
 */
export abstract class WebContextBase implements FetchContext {
  // `declare` on every field the constructor assigns: with
  // `useDefineForClassFields` (ES2022) a plain `field;` declaration emits a
  // per-instance define for `undefined` that the constructor immediately
  // overwrites. A context is built once per request, so those defines are pure
  // hot-path cost. Initialized fields below keep their initializer.
  declare readonly method: HttpMethod;
  declare readonly url: string;
  declare readonly path: string;
  /**
   * Declared here, not added by the router, so dispatch's assignment is a value
   * write to an existing slot rather than a property addition that transitions
   * the context's hidden class on every request. Initialized to `path`, which
   * is the documented value when no router has canonicalized the target.
   *
   * @see RFC-029
   */
  declare readonly originalPath: string;
  /**
   * Backing field for the lazily parsed {@link query}. Declared (not a plain
   * field) and assigned in the constructor so every context keeps one shape;
   * `undefined` is the "not parsed yet" sentinel.
   */
  declare private _query: QueryParams | undefined;
  declare readonly runtime: Runtime;
  declare readonly bodySource: BodySource;
  /**
   * The request's declared body length, read from the body source's parsed
   * `content-length`; `undefined` when the length is unknown (chunked).
   *
   * @remarks
   * Exposed for the runner's settle-window decision: a non-empty declared body
   * means the dispatch waits on a body read (a macrotask), so the deadline can
   * be armed immediately. Reading `request.body` for the same answer would
   * initialise the body stream and cost ~0.8 µs on Bun before the read.
   */
  declare readonly bodyLength: number | undefined;

  /**
   * The lazily resolved request inputs (headers and client address).
   *
   * @remarks
   * Held rather than spread across the context: building the header record walks
   * every header and resolving the address may call the platform, so both are
   * resolved on first read (see {@link RequestInputs}).
   */
  declare protected readonly _inputs: RequestInputs;

  /**
   * Named deployment platform, when known (RFC-026).
   *
   * @remarks
   * Defaults to `undefined` — Bun/Deno report no named platform. Edge's
   * subclass passes a resolved value through {@link protected constructor}'s
   * `platform` parameter (detected, or explicitly supplied by a serverless
   * Tier-1 handler); the field lives here, not duplicated per subclass, since
   * every Web adapter must satisfy the same {@link Context.platform} contract.
   */
  declare readonly platform: PlatformId | undefined;

  body: unknown = undefined;
  params: RouteParams = EMPTY_PARAMS;
  status = 200;
  state: ContextState = {};
  /**
   * First-class cookie capability (RFC-034). Constructed as the shared
   * uninitialized stub; the `cookies()` middleware activates it by
   * reassigning this field to the per-request store. Reassignment is part of
   * the activation contract, not a hidden-class hazard: the field is declared
   * here so activation is a value write to an existing slot.
   */
  cookies: CookieCapability = UNINITIALIZED_COOKIES;

  private _next: (() => Promise<void>) | null = null;
  declare private readonly _response: WebResponseBuilder;
  /** Lazily-created combiner of the request signal and the timeout signal (F-08). */
  declare private _abort?: CombinedAbort;
  /** The platform request, held privately so `raw` is built lazily (HP-5-web). */
  declare protected readonly _req: Request;
  /** Memoized `{ req, res }` wrapper — built only when `ctx.raw` is read (HP-5-web). */
  declare private _raw?: WebRawHttp;
  declare private readonly _streamRunners: WebStreamRunners;

  /**
   * @param request - The platform Web `Request`.
   * @param ip - The resolved client IP, per the concrete adapter's own policy.
   * @param runtime - The resolved runtime identifier for this context.
   * @param streamRunners - The concrete `@nextrush/stream` runner functions
   *   (passed through by the subclass so this base never imports `@nextrush/stream`
   *   directly, preserving the package hierarchy).
   * @param platform - Named deployment platform, when known (RFC-026). Omitted
   *   by Bun/Deno (always `undefined`); Edge passes its detected or
   *   explicitly-supplied value.
   */
  protected constructor(
    request: Request,
    ip: ClientAddress,
    runtime: Runtime,
    streamRunners: WebStreamRunners,
    platform?: PlatformId
  ) {
    this._req = request;
    this._streamRunners = streamRunners;
    this.method = request.method.toUpperCase() as HttpMethod;
    this.runtime = runtime;
    this.platform = platform;
    this._inputs = new RequestInputs(request, ip);

    // Derive the target by scanning `request.url` instead of parsing it: WHATWG
    // parsing resolves dot segments (every encoded spelling of one included),
    // which would resolve a segment before the router could reject it, and it
    // allocates a `URL` object per request to do that.
    const target = requestTargetFromUrl(request.url);
    this.path = target.path;
    this.originalPath = target.path;
    this.url = target.search === '' ? target.path : target.path + target.search;
    this._query = undefined;

    // Create body source
    const bodySource = METHODS_WITHOUT_BODY.has(this.method)
      ? createEmptyBodySource()
      : new WebBodySource(request);
    this.bodySource = bodySource;
    this.bodyLength = bodySource.contentLength;

    this._response = new WebResponseBuilder(this.method);
  }

  /**
   * The parsed query bag, materialized on the first read and then memoized.
   *
   * @remarks
   * A query string is optional work: many requests carry one (`?utm=…`,
   * `?limit=…`) that the handler never reads, and middleware that does read it
   * (logging, validation) is enabled per app rather than per request. Parsing in
   * the constructor charged every query-bearing request for a bag it discarded.
   * The search is located in {@link url} — which already joins path and search —
   * instead of retaining a second string. A query-less context still resolves to
   * the shared frozen empty bag on its first read.
   */
  get query(): QueryParams {
    let parsed = this._query;
    if (parsed === undefined) {
      const queryMark = this.url.indexOf('?');
      parsed = parseQueryString(queryMark === -1 ? '' : this.url.slice(queryMark + 1));
      this._query = parsed;
    }
    return parsed;
  }

  /**
   * The resolved client IP, per the concrete adapter's own policy.
   *
   * @remarks
   * A getter (not a plain field) for two reasons: it resolves a lazily-supplied
   * address on first read and memoizes it (a handler that never reads `ctx.ip`
   * causes no platform lookup, and two reads cause one), and a subclass can
   * observe a read without changing the value — see {@link EdgeContext}'s
   * override, which warns once per context in development when this is `''`
   * because `trustProxy` is `false` (P2-3). Bun/Deno/Node never see that
   * override; they always return a real resolved IP here, unchanged in value or
   * behavior.
   */
  get ip(): string {
    return this._inputs.ip;
  }

  /**
   * Set the next function for middleware chaining
   * @internal
   */
  setNext(fn: () => Promise<void>): void {
    this._next = fn;
  }

  // ===========================================================================
  // Response Methods (delegated to the shared WebResponseBuilder)
  // ===========================================================================

  json(data: unknown): void {
    this._response.json(data, this.status);
  }

  send(data: ResponseBody): void {
    this._response.send(data, this.status);
  }

  html(content: string): void {
    this._response.html(content, this.status);
  }

  redirect(url: string, status = 302): void {
    this._response.redirect(url, status);
  }

  // ===========================================================================
  // Response Streaming (see docs/RFC/request-data/003-stream.md)
  // ===========================================================================

  /**
   * Raw platform request/response handles.
   *
   * @remarks
   * HP-5-web: built lazily and memoized — the `{ req, res }` wrapper is
   * allocated only when a caller reads `ctx.raw`, which almost no handler does.
   * `res` is always `undefined` on the Web adapters, so the shape and identity
   * match the previous eager field exactly.
   */
  get raw(): WebRawHttp {
    return (this._raw ??= { req: this._req, res: undefined });
  }

  /**
   * Abort signal — combines the platform request signal (client disconnect)
   * with an adapter-owned controller that fires on request timeout (F-08).
   */
  get signal(): AbortSignal {
    this._abort ??= combineAbortSignal(this._req.signal);
    return this._abort.signal;
  }

  /**
   * Abort the in-flight request via `ctx.signal` (e.g. on timeout).
   * @internal
   */
  triggerTimeout(reason?: unknown): void {
    this._abort ??= combineAbortSignal(this._req.signal);
    this._abort.abort(reason ?? new Error('Request timeout'));
  }

  /** @internal Wire a byte stream as the response body (drained by the runtime). */
  sendStream(source: ReadableStream<Uint8Array>): Promise<void> {
    this._response.sendStream(source, this.status);
    return Promise.resolve();
  }

  stream(run: StreamRun<TextStreamWriter>): Promise<void> {
    return this._streamRunners.runTextStream(this, run);
  }

  sse(run: StreamRun<SSEStreamWriter>): Promise<void> {
    return this._streamRunners.runSSEStream(this, run);
  }

  ndjson(run: StreamRun<NDJSONStreamWriter>): Promise<void> {
    return this._streamRunners.runNDJSONStream(this, run);
  }

  /** Incoming request headers, as a record — built on first read (see {@link RequestInputs}). */
  get headers(): IncomingHeaders {
    return this._inputs.headers;
  }

  // ===========================================================================
  // Header Helpers
  // ===========================================================================

  set(field: string, value: string | number | string[]): void {
    this._response.set(field, value);
  }

  /** Read one incoming header; never builds the record (see {@link RequestInputs}). */
  get(field: string): string | undefined {
    return this._inputs.get(field);
  }

  // ===========================================================================
  // Request Body
  // ===========================================================================

  /**
   * Read the request body, parsing it once and caching the result (RFC-047).
   *
   * @remarks
   * Delegates to the reader a body parser installed in lazy mode; with eager
   * parsing (the default) the body is already parsed, so this resolves from it
   * without touching the body source.
   *
   * The slot is only present on contexts a lazy parser claimed, so an eager
   * request allocates nothing and keeps the context's existing shape.
   */
  readBody<T = unknown>(): Promise<T> {
    const reader = (this as BodyReaderCarrier)[BODY_READER];
    if (reader === undefined) return Promise.resolve(this.body as T);
    return reader.read<T>();
  }

  // ===========================================================================
  // Middleware
  // ===========================================================================

  /**
   * Advance the middleware chain.
   *
   * @remarks
   * HP-7 trim: forwards the composer's dispatch thunk directly instead of
   * wrapping it in an extra `async` frame. The thunk always returns a promise
   * and never throws synchronously (the composer converts sync throws to
   * `Promise.reject`), so ordering, rejection propagation, and the
   * `Promise<void>` contract are preserved. Unwired → a cached resolved promise.
   */
  next(): Promise<void> {
    return this._next ? this._next() : RESOLVED_NEXT;
  }

  // ===========================================================================
  // Error Helpers
  // ===========================================================================

  throw(status: number, message?: string): never {
    throw new HttpError(status, message);
  }

  assert(condition: unknown, status: number, message?: string): asserts condition {
    if (!condition) {
      throw new HttpError(status, message);
    }
  }

  // ===========================================================================
  // Response Building
  // ===========================================================================

  /** Whether a response has been committed. */
  get responded(): boolean {
    return this._response.responded;
  }

  /**
   * The response the adapter will flush, for middleware that runs after the
   * handler and rewrites it (compression, timer).
   *
   * @internal Carries no semver guarantee and is not part of the documented
   * `Context` surface; {@link OUTGOING_RESPONSE} is the only key.
   */
  get [OUTGOING_RESPONSE](): OutgoingResponseHandle {
    return this._response.record;
  }

  /** Mark the response as committed (for streaming scenarios). */
  markResponded(): void {
    this._response.markResponded();
  }

  /** Build the Web `Response` accumulated by the context. */
  getResponse(): Response {
    return this._response.getResponse(this.status);
  }
}

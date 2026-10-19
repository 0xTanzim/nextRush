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
import type {
  BodySource,
  ContextState,
  CookieCapability,
  FetchContext,
  HttpMethod,
  IncomingHeaders,
  NDJSONStreamWriter,
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
import { headersToRecord } from './headers';
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
 * A resolved client address, or a resolver called on the first `ctx.ip` read.
 *
 * @remarks
 * Adapters resolve the address from a platform call (Bun's
 * `server.requestIP`, Deno's `remoteAddr`) or from proxy headers. Handing over a
 * resolver instead of a string keeps that work off the request path for the
 * majority of handlers that never look at `ctx.ip`. A plain string stays
 * accepted so a caller that already knows the address pays nothing.
 */
export type ClientAddress = string | (() => string);

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
  readonly method: HttpMethod;
  readonly url: string;
  readonly path: string;
  /**
   * Declared here, not added by the router, so dispatch's assignment is a value
   * write to an existing slot rather than a property addition that transitions
   * the context's hidden class on every request. Initialized to `path`, which
   * is the documented value when no router has canonicalized the target.
   *
   * @see RFC-029
   */
  readonly originalPath: string;
  readonly query: QueryParams;
  readonly runtime: Runtime;
  readonly bodySource: BodySource;

  /**
   * Memoized incoming-header record.
   *
   * @remarks
   * Declared as a slot, not a field, because building it walks every header —
   * work a handler that reads one header (or none) never asked for. Reading
   * {@link headers} fills it once; a single-name {@link get} never fills it at
   * all. The slot is declared on the instance shape so filling it is a value
   * write, not a property addition that transitions the hidden class.
   */
  private _headers?: IncomingHeaders;

  /** Backing field for {@link ip}: an address already known, or a resolver
   * called once on the first read (P2-3 keeps the getter so a subclass can
   * observe a read without changing the value or its identity). */
  private readonly _clientAddress: ClientAddress;
  /** Memoized result of {@link _clientAddress}, once resolved. */
  private _clientIp?: string;

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
  readonly platform: PlatformId | undefined;

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
  private readonly _response: WebResponseBuilder;
  /** Lazily-created combiner of the request signal and the timeout signal (F-08). */
  private _abort?: CombinedAbort;
  /** The platform request, held privately so `raw` is built lazily (HP-5-web). */
  protected readonly _req: Request;
  /** Memoized `{ req, res }` wrapper — built only when `ctx.raw` is read (HP-5-web). */
  private _raw?: WebRawHttp;
  private readonly _streamRunners: WebStreamRunners;

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
    this._clientAddress = ip;

    // Derive the target by scanning `request.url` instead of parsing it: WHATWG
    // parsing resolves dot segments (every encoded spelling of one included),
    // which would resolve a segment before the router could reject it, and it
    // allocates a `URL` object per request to do that.
    const target = requestTargetFromUrl(request.url);
    this.path = target.path;
    this.originalPath = target.path;
    this.url = target.search === '' ? target.path : target.path + target.search;
    this.query = parseQueryString(target.search.slice(1));

    // Create body source
    this.bodySource = METHODS_WITHOUT_BODY.has(this.method)
      ? createEmptyBodySource()
      : new WebBodySource(request);

    this._response = new WebResponseBuilder(this.method);
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
    return this.resolveClientIp();
  }

  /** Resolve the address once; subclasses that wrap {@link ip} call this. */
  protected resolveClientIp(): string {
    return (this._clientIp ??=
      typeof this._clientAddress === 'string' ? this._clientAddress : this._clientAddress());
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

  /**
   * Incoming request headers, as a record.
   *
   * @remarks
   * Built on first read and memoized — the walk over every header is the cost
   * a handler that never reads `ctx.headers` should not pay. `ctx.get(name)`
   * does not build it (see {@link get}); only asking for the record does.
   * Shape is unchanged: prototype-less (nothing inherited is reachable),
   * lower-case keys, and `set-cookie` kept as an array when the platform
   * exposes it.
   */
  get headers(): IncomingHeaders {
    return (this._headers ??= headersToRecord(this._req.headers));
  }

  // ===========================================================================
  // Header Helpers
  // ===========================================================================

  set(field: string, value: string | number | string[]): void {
    this._response.set(field, value);
  }

  /**
   * Read one incoming header.
   *
   * @remarks
   * Reads the platform headers directly unless the record already exists, so a
   * single-name read costs one lookup instead of the full walk. Case folding is
   * the platform's (`Headers.get` is case-insensitive). `set-cookie` keeps the
   * record's "first value" semantics by asking the platform for the separated
   * entries where it can — `Headers.get` would comma-join them.
   */
  get(field: string): string | undefined {
    const name = field.toLowerCase();
    const record = this._headers;
    if (record === undefined) {
      const headers = this._req.headers;
      if (name === 'set-cookie') {
        const getSetCookie = (headers as { getSetCookie?: () => string[] }).getSetCookie;
        if (typeof getSetCookie === 'function') return getSetCookie.call(headers)[0];
      }
      return headers.get(name) ?? undefined;
    }
    const value = record[name];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
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

  /** Mark the response as committed (for streaming scenarios). */
  markResponded(): void {
    this._response.markResponded();
  }

  /** Build the Web `Response` accumulated by the context. */
  getResponse(): Response {
    return this._response.getResponse(this.status);
  }
}

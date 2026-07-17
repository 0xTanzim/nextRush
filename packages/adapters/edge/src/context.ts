/**
 * @nextrush/adapter-edge - Context Implementation
 *
 * Edge-specific Context implementation for Cloudflare Workers, Vercel Edge, etc.
 *
 * @remarks
 * The response-building logic (json/send/html/redirect/set/getResponse and
 * body suppression) is composed from the shared {@link WebResponseBuilder} in
 * `@nextrush/runtime` (audit F-04b), so it is defined once across the Web
 * adapters rather than copy-pasted per runtime.
 *
 * @packageDocumentation
 */

import { HttpError } from '@nextrush/errors';
import {
  combineAbortSignal,
  createEmptyBodySource,
  detectEdgeRuntime,
  getEdgeClientIp,
  headersToRecord,
  METHODS_WITHOUT_BODY,
  parseQueryString,
  WebBodySource,
  WebResponseBuilder,
} from '@nextrush/runtime';
import type { CombinedAbort } from '@nextrush/runtime';
import { runNDJSONStream, runSSEStream, runTextStream } from '@nextrush/stream';
import type {
  BodySource,
  ContextState,
  FetchContext,
  HttpMethod,
  IncomingHeaders,
  NDJSONStreamWriter,
  QueryParams,
  RawHttp,
  ResponseBody,
  RouteParams,
  Runtime,
  SSEStreamWriter,
  StreamRun,
  TextStreamWriter,
} from '@nextrush/types';

/**
 * Edge-specific RawHttp type
 */
type EdgeRawHttp = RawHttp<Request, undefined>;

/**
 * Edge execution context interface
 *
 * @remarks
 * Provides access to edge-specific features like `waitUntil` and `passThroughOnException`.
 */
export interface EdgeExecutionContext {
  /** Extend request lifetime for async operations */
  waitUntil(promise: Promise<unknown>): void;

  /** Pass through to origin on exception */
  passThroughOnException?(): void;
}

/** Shared empty params object — avoids allocation per request (overwritten by router) */
const EMPTY_PARAMS: RouteParams = Object.freeze(Object.create(null)) as RouteParams;

/**
 * Edge Context implementation
 *
 * @remarks
 * Works with any edge runtime that implements the Web Fetch API:
 * - Cloudflare Workers
 * - Vercel Edge Functions
 * - Netlify Edge Functions
 *
 * The response is built internally (via a composed {@link WebResponseBuilder})
 * and returned via `getResponse()`.
 *
 * @example
 * ```typescript
 * const ctx = new EdgeContext(request);
 * ctx.json({ message: 'Hello from Edge!' });
 * const response = ctx.getResponse();
 * ```
 */
export class EdgeContext<Env = unknown> implements FetchContext {
  readonly method: HttpMethod;
  readonly url: string;
  readonly path: string;
  readonly query: QueryParams;
  readonly headers: IncomingHeaders;
  readonly ip: string;
  readonly raw: EdgeRawHttp;
  readonly runtime: Runtime;
  readonly bodySource: BodySource;

  /** Edge execution context (for waitUntil, etc.) */
  readonly executionContext?: EdgeExecutionContext;

  /**
   * Platform bindings passed by the runtime (audit F-03).
   *
   * @remarks
   * On Cloudflare Workers this is the `env` argument of
   * `fetch(request, env, ctx)` — KV, D1, R2, Durable Objects, Queues, secrets.
   * `undefined` on runtimes that do not supply bindings (e.g. Vercel Edge).
   */
  readonly env?: Env;

  body: unknown = undefined;
  params: RouteParams = EMPTY_PARAMS;
  status = 200;
  state: ContextState = {};

  private _next: (() => Promise<void>) | null = null;
  private readonly _response: WebResponseBuilder;
  /** Lazily-created combiner of the request signal and the timeout signal (F-08). */
  private _abort?: CombinedAbort;

  constructor(
    request: Request,
    executionContext?: EdgeExecutionContext,
    trustProxy = false,
    env?: Env
  ) {
    this.raw = { req: request, res: undefined };
    this.method = request.method.toUpperCase() as HttpMethod;
    this.executionContext = executionContext;
    this.env = env;

    // Detect specific edge runtime
    this.runtime = detectEdgeRuntime().runtime;

    // Parse URL
    const urlObj = new URL(request.url);
    this.url = urlObj.pathname + urlObj.search;
    this.path = urlObj.pathname;
    this.query = parseQueryString(urlObj.search.slice(1));

    // Convert Headers to record format
    this.headers = headersToRecord(request.headers);

    // Get client IP from CF headers or standard headers
    this.ip = getEdgeClientIp(request, trustProxy);

    // Create body source
    this.bodySource = METHODS_WITHOUT_BODY.has(this.method)
      ? createEmptyBodySource()
      : new WebBodySource(request);

    this._response = new WebResponseBuilder(this.method);
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
   * Abort signal — combines the platform request signal (client disconnect)
   * with an adapter-owned controller that fires on request timeout (F-08).
   */
  get signal(): AbortSignal {
    this._abort ??= combineAbortSignal(this.raw.req.signal);
    return this._abort.signal;
  }

  /**
   * Abort the in-flight request via `ctx.signal` (e.g. on timeout).
   *
   * @remarks
   * Lets a cooperative handler/stream stop work after a 504 is returned,
   * instead of running to completion unobserved (audit F-08).
   *
   * @internal
   */
  triggerTimeout(reason?: unknown): void {
    this._abort ??= combineAbortSignal(this.raw.req.signal);
    this._abort.abort(reason ?? new Error('Request timeout'));
  }

  /** @internal Wire a byte stream as the response body (drained by the runtime). */
  sendStream(source: ReadableStream<Uint8Array>): Promise<void> {
    this._response.sendStream(source, this.status);
    return Promise.resolve();
  }

  stream(run: StreamRun<TextStreamWriter>): Promise<void> {
    return runTextStream(this, run);
  }

  sse(run: StreamRun<SSEStreamWriter>): Promise<void> {
    return runSSEStream(this, run);
  }

  ndjson(run: StreamRun<NDJSONStreamWriter>): Promise<void> {
    return runNDJSONStream(this, run);
  }

  // ===========================================================================
  // Header Helpers
  // ===========================================================================

  set(field: string, value: string | number | string[]): void {
    this._response.set(field, value);
  }

  get(field: string): string | undefined {
    const value = this.headers[field.toLowerCase()];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }

  // ===========================================================================
  // Middleware
  // ===========================================================================

  async next(): Promise<void> {
    if (this._next) {
      await this._next();
    }
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
  // Edge-Specific Methods
  // ===========================================================================

  /**
   * Extend request lifetime for async operations
   *
   * @remarks
   * Use this for fire-and-forget operations that should complete
   * after the response is sent (logging, analytics, etc.)
   */
  waitUntil(promise: Promise<unknown>): void {
    if (this.executionContext?.waitUntil) {
      this.executionContext.waitUntil(promise);
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

/**
 * Create a new EdgeContext
 */
export function createEdgeContext<Env = unknown>(
  request: Request,
  executionContext?: EdgeExecutionContext,
  trustProxy = false,
  env?: Env
): EdgeContext<Env> {
  return new EdgeContext<Env>(request, executionContext, trustProxy, env);
}

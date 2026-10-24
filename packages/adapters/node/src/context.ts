/**
 * @nextrush/adapter-node - Context Implementation
 *
 * Node.js-specific Context implementation that wraps
 * IncomingMessage and ServerResponse.
 *
 * @packageDocumentation
 */

import { HttpError } from '@nextrush/errors';
import {
  getRuntime,
  isBodylessResponse,
  LAST_RESORT_ERROR_STATUS,
  METHODS_WITHOUT_BODY,
  NULL_PROTO,
  OutgoingResponse,
  resolveClientIp,
  serializeJson,
  unansweredErrorBody,
  UNINITIALIZED_COOKIES,
} from '@nextrush/runtime';
import type { OutgoingHeaderEntry } from '@nextrush/runtime';
import {
  runNDJSONStream,
  runSSEStream,
  runTextStream,
  StreamAbortedError,
} from '@nextrush/stream';
import type {
    AdapterContext,
    BodyReaderCarrier,
    BodySource,
    ContextState,
    CookieCapability,
    HttpMethod,
    IncomingHeaders,
    NDJSONStreamWriter,
    NodeStreamLike,
    OutgoingResponseHandle,
    PlatformId,
    ProxyTrust,
    QueryParams,
    RawHttp,
    ResponseBody,
    RouteParams,
    Runtime,
    SSEStreamWriter,
    StreamRun,
    TextStreamWriter,
    WebStreamLike,
} from '@nextrush/types';
import { BODY_READER, OUTGOING_RESPONSE } from '@nextrush/types';
import type { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from 'node:http';
import { createEmptyBodySource, NodeBodySource } from './body-source';
import { parseQueryString } from './utils';

/**
 * Node.js-specific RawHttp type
 */
type NodeRawHttp = RawHttp<IncomingMessage, ServerResponse>;

/**
 * Options for NodeContext construction
 */
export interface NodeContextOptions {
  /**
   * Proxy-trust specification for `ctx.ip` resolution (RFC-030).
   * When `false`, IP is always read from the socket.
   * @default false
   */
  proxy?: ProxyTrust;
}

/**
 * Shared empty params object — avoids allocation per request (overwritten by
 * router). Built on `NULL_PROTO` because it is *read* on every params-less
 * request, where a dictionary-mode miss-read measured 2.2x slower.
 */
const EMPTY_PARAMS: RouteParams = Object.freeze(Object.create(NULL_PROTO)) as RouteParams;

/**
 * Shared frozen empty query object (HP-2) — avoids allocating a fresh `{}` on
 * every query-less request (the common case), mirroring {@link EMPTY_PARAMS}.
 * `ctx.query` is typed `readonly` and holds URL-parsed data, so the frozen
 * shared instance is safe; no code path mutates `ctx.query`.
 */
const EMPTY_QUERY: QueryParams = Object.freeze(Object.create(NULL_PROTO)) as QueryParams;

/** Shared resolved promise for `next()` when no dispatch thunk is wired (HP-7). */
const RESOLVED_NEXT: Promise<void> = Promise.resolve();

/** The content types the Node response methods record. JSON carries no charset:
 * RFC 8259 defines none, and the Web adapters emit the same bare value. */
const JSON_CONTENT_TYPE = 'application/json';
/** Matches the Web adapters' value, which Deno's static-response fast path requires. */
const TEXT_CONTENT_TYPE = 'text/plain;charset=UTF-8';
const HTML_CONTENT_TYPE = 'text/html; charset=utf-8';
const BINARY_CONTENT_TYPE = 'application/octet-stream';

/**
 * Wait for `res` to drain, settling early if the response socket disconnects
 * first (F-01 / design.md D5).
 *
 * @remarks
 * `res.once('drain', ...)` alone never fires once the underlying socket is
 * destroyed — a byte pump parked on it after a backpressured `res.write()`
 * returns `false` hangs forever, so a disconnect during backpressure never
 * settles the streaming handler's promise (no `finally` runs, no cleanup).
 * This races the drain wait against `res` `'close'`/`'error'`, exactly the
 * `settled`-guarded pattern already proven in
 * `packages/middleware/static/src/send-file.ts`'s `streamToResponse`, adapted
 * here as a small internal helper shared by both Node byte-pump call sites
 * (`sendStream()` and the Web-`ReadableStream` branch of `send()`) instead of
 * duplicated inline. Rejects with {@link StreamAbortedError} on disconnect so
 * callers unwind through the same path as any other stream-abort — no new
 * error type, no `@nextrush/stream` API change.
 */
function waitForDrainOrDisconnect(res: ServerResponse): Promise<void> {
  if (!res.writableNeedDrain && !res.destroyed) {
    // Already drained (or never actually needed to wait) — the common case
    // when this is called defensively; avoids a listener round-trip.
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const onDrain = (): void => {
      settle(resolve);
    };
    const onDisconnect = (): void => {
      settle(() => {
        reject(new StreamAbortedError());
      });
    };

    function settle(fn: () => void): void {
      if (settled) return;
      settled = true;
      res.off('drain', onDrain);
      res.off('close', onDisconnect);
      res.off('error', onDisconnect);
      fn();
    }

    res.once('drain', onDrain);
    res.once('close', onDisconnect);
    res.once('error', onDisconnect);
  });
}

/**
 * Node.js Context implementation
 */
export class NodeContext implements AdapterContext {
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
  readonly headers: IncomingHeaders;
  readonly ip: string;
  readonly runtime: Runtime;

  /**
   * Named deployment platform (RFC-026). Always `undefined` on the Node.js
   * adapter — no named FaaS platform reporting is defined for `adapter-node`.
   */
  readonly platform: PlatformId | undefined = undefined;

  /**
   * BP-F: backing field for the lazily-built {@link bodySource}. A body-method
   * request that never reads the body allocates no `NodeBodySource`.
   */
  private _bodySource?: BodySource;

  body: unknown = undefined;
  params: RouteParams = EMPTY_PARAMS;
  status = 200;
  /**
   * First-class cookie capability (RFC-034). Constructed as the shared
   * uninitialized stub; the `cookies()` middleware activates it by
   * reassigning this field to the per-request store. The field is declared
   * here (not added by the middleware) so activation is a value write to an
   * existing slot rather than a hidden-class transition.
   */
  cookies: CookieCapability = UNINITIALIZED_COOKIES;

  /**
   * HP-5: the request/response are held as private fields; the public
   * `{ req, res }` wrapper is built lazily by {@link raw} and memoized here, so
   * a request that never reads `ctx.raw` allocates no wrapper. Every internal
   * response method reads these fields, never `this.raw`.
   */
  private readonly _req: IncomingMessage;
  private readonly _res: ServerResponse;
  private _raw?: NodeRawHttp;

  /**
   * NF-2: `ctx.state` backing field, materialized lazily by {@link state}. A
   * request that never touches `state` allocates no object — mirroring the lazy
   * `_raw` wrapper above.
   */
  private _state?: ContextState;

  private _next: (() => Promise<void>) | null = null;
  /** The recorded response the adapter flushes once the chain has settled. */
  private readonly _outgoing = new OutgoingResponse();
  private _abortController?: AbortController;

  /**
   * The response the adapter will flush, for middleware that runs after the
   * handler and rewrites it (compression, timer).
   *
   * @internal Carries no semver guarantee and is not part of the documented
   * `Context` surface; {@link OUTGOING_RESPONSE} is the only key.
   */
  get [OUTGOING_RESPONSE](): OutgoingResponseHandle {
    return this._outgoing;
  }

  constructor(req: IncomingMessage, res: ServerResponse, options: NodeContextOptions = {}) {
    this._req = req;
    this._res = res;
    this.runtime = getRuntime();
    this.method = (req.method?.toUpperCase() ?? 'GET') as HttpMethod;
    this.url = req.url ?? '/';

    // Parse URL and query string
    const questionIndex = this.url.indexOf('?');
    if (questionIndex !== -1) {
      this.path = this.url.slice(0, questionIndex);
      this.query = parseQueryString(this.url.slice(questionIndex + 1));
    } else {
      this.path = this.url;
      this.query = EMPTY_QUERY;
    }
    this.originalPath = this.path;

    this.headers = req.headers;
    this.ip = this.getClientIp(req, options.proxy ?? false);
  }

  /**
   * Cross-runtime request body source (BP-F).
   *
   * @remarks
   * Built lazily and memoized, mirroring the lazy `_raw` / `_state` / `signal`
   * fields: a body-method request (`POST`/`PUT`/`PATCH`/…) whose body is never
   * read allocates no `NodeBodySource` and attaches no stream listeners. Bodyless
   * methods (per the runtime `METHODS_WITHOUT_BODY` policy) resolve to the shared
   * `EmptyBodySource` singleton. Identity is stable across reads
   * (`ctx.bodySource === ctx.bodySource`).
   */
  get bodySource(): BodySource {
    return (this._bodySource ??= METHODS_WITHOUT_BODY.has(this.method)
      ? createEmptyBodySource()
      : new NodeBodySource(this._req, undefined, this._res));
  }

  /**
   * Resolve the client IP via the shared cross-adapter policy (audit F-11, RFC-030).
   *
   * @remarks
   * HP-1 trim: when `proxy` is `false` (default) the socket address IS the
   * client IP, so it is returned directly — no header-lookup closure, no
   * {@link resolveClientIp} call — byte-identical to the policy's own
   * `trust: false` branch. Otherwise resolution goes through the shared
   * policy so precedence/validation match Bun/Deno/Edge. The socket address
   * doubles as both `directIp` and `peerIp` (Node's peer IS the direct
   * connection) and is read eagerly, so `ctx.ip` stays stable even after the
   * socket is torn down.
   */
  private getClientIp(req: IncomingMessage, proxy: ProxyTrust): string {
    const directIp = req.socket.remoteAddress ?? '';
    if (proxy === false) {
      return directIp;
    }
    return resolveClientIp(
      (name) => {
        const value = req.headers[name];
        return Array.isArray(value) ? value[0] : value;
      },
      { trust: proxy, directIp, peerIp: directIp }
    );
  }

  /**
   * The raw `{ req, res }` pair (HP-5).
   *
   * @remarks
   * Built lazily and memoized: the wrapper object is allocated only on first
   * read and the same object is returned thereafter (`ctx.raw === ctx.raw`),
   * matching the identity of the former eager field. Internal response methods
   * use the private `_req`/`_res` fields instead, so a request that never reads
   * `ctx.raw` allocates no wrapper at all.
   */
  get raw(): NodeRawHttp {
    return (this._raw ??= { req: this._req, res: this._res });
  }

  /**
   * Per-request shared state (NF-2).
   *
   * @remarks
   * Materialized lazily and memoized: the `{}` object is allocated only on first
   * access (`??=`) and the same object is returned thereafter
   * (`ctx.state === ctx.state`), matching the identity of the former eager
   * `state = {}` field. A request that never reads `state` (the Hello-World /
   * route-params / POST hot paths) allocates no object at all. The setter
   * preserves whole-object reassignment (`ctx.state = {...}`); reads and
   * symbol-keyed writes (the `createPrefixMount` path) both go through the
   * getter, so behavior is identical to the eager object.
   */
  get state(): ContextState {
    return (this._state ??= {});
  }

  set state(value: ContextState) {
    this._state = value;
  }

  /**
   * Set the next function for middleware chaining
   * @internal
   */
  setNext(fn: () => Promise<void>): void {
    this._next = fn;
  }

  // ===========================================================================
  // Response Methods
  // ===========================================================================

  /**
   * Whether the response can no longer be changed: either this context already
   * answered, or the platform has already begun sending the headers. Every
   * response method and `set()` gates on this one check, so a write that arrives
   * too late has a single meaning on this adapter instead of one per method.
   */
  private isCommitted(): boolean {
    return this._outgoing.committed || this._res.headersSent;
  }

  json(data: unknown): void {
    if (this.isCommitted()) return;

    // Serialize before committing: a value JSON cannot represent throws here,
    // with the response still unwritten, so the application error handler can
    // still answer. Marking it committed first is what used to turn a
    // serialization failure into a socket that hung.
    const json = serializeJson(data);

    this._outgoing.status = this.status;
    this._outgoing.setBody(json, JSON_CONTENT_TYPE);
  }

  send(data: ResponseBody): void {
    if (this.isCommitted()) return;

    const outgoing = this._outgoing;
    outgoing.status = this.status;
    const hasContentType =
      outgoing.hasHeader('Content-Type') || this._res.hasHeader('Content-Type');

    if (data === null || data === undefined) {
      outgoing.setBody(null);
      return;
    }

    if (typeof data === 'string') {
      outgoing.setBody(data, hasContentType ? undefined : TEXT_CONTENT_TYPE);
      return;
    }

    if (Buffer.isBuffer(data)) {
      outgoing.setBody(data, hasContentType ? undefined : BINARY_CONTENT_TYPE);
      return;
    }

    // Uint8Array (non-Buffer) — convert to Buffer for Node.js response.
    // `Buffer.from` is the only step that can throw here (a detached backing
    // store), and a throw after the response looks committed would leave the
    // request unanswered.
    if (data instanceof Uint8Array) {
      const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
      outgoing.setBody(buffer, hasContentType ? undefined : BINARY_CONTENT_TYPE);
      return;
    }

    if (data instanceof ArrayBuffer) {
      outgoing.setBody(Buffer.from(data), hasContentType ? undefined : BINARY_CONTENT_TYPE);
      return;
    }

    if (typeof (data as NodeStreamLike).pipe === 'function') {
      this.sendNodeStream(data as NodeStreamLike, hasContentType);
      return;
    }

    if (
      typeof (data as WebStreamLike).getReader === 'function' &&
      'locked' in (data as WebStreamLike)
    ) {
      this.sendWebStream(data as ReadableStream<Uint8Array>, hasContentType);
      return;
    }

    // Object - delegate to json() which manages its own commit guard.
    if (typeof data === 'object') {
      this.json(data);
      return;
    }

    outgoing.setBody(String(data), hasContentType ? undefined : TEXT_CONTENT_TYPE);
  }

  html(content: string): void {
    if (this.isCommitted()) return;

    this._outgoing.status = this.status;
    this._outgoing.setBody(content, HTML_CONTENT_TYPE);
  }

  redirect(url: string, status = 302): void {
    if (this.isCommitted()) return;

    // Plain text avoids HTML injection via user-controlled URLs.
    this._outgoing.status = status;
    this._outgoing.set('Location', url);
    this._outgoing.setBody(`Redirecting to ${url}`, TEXT_CONTENT_TYPE);
  }

  // ===========================================================================
  // Response Flushing
  // ===========================================================================

  /**
   * Flush the recorded response to the socket exactly once.
   *
   * @remarks
   * Called by the adapter's request handler after the middleware chain settles.
   * A response nothing recorded is still answered: an error status gets the
   * framework's envelope, a success status the documented empty `text/plain`
   * response. This is the adapter finalizer of the three redundant layers that
   * keep a request from going unanswered.
   *
   * @internal
   */
  flushResponse(): void {
    const res = this._res;
    // A direct `ctx.raw.res` writer (the static middleware, a hand-rolled
    // stream) has already committed; there is nothing left to flush.
    if (res.headersSent) return;

    const record = this._outgoing;
    if (!record.committed) {
      record.status = this.status;
      if (this.status >= LAST_RESORT_ERROR_STATUS) {
        record.setBody(JSON.stringify(unansweredErrorBody(this.status)), JSON_CONTENT_TYPE);
      } else {
        // F-09: a handler that resolves without responding must still carry an
        // explicit Content-Type. text/plain is the honest default: no body.
        record.set('Content-Type', TEXT_CONTENT_TYPE);
        record.commit();
      }
    }

    record.flush((flushed) => {
      const body = flushed.body;
      res.writeHead(flushed.status, this.nodeHeaders(flushed, body));
      if (body === null || isBodylessResponse(this.method, flushed.status)) {
        res.end();
      } else {
        // Write the recorded form through unchanged. A string body stays a
        // string, which is what the pre-record path did: `res.end` encodes it
        // inside Node, so an untouched response allocates no intermediate byte
        // array (RFC-041 §14.2). Only a rewritten body is already bytes.
        res.end(body);
      }
    });
  }

  /**
   * Apply the recorded head to the socket and freeze the record, for a path
   * that writes its body itself.
   *
   * @remarks
   * Unlike {@link flushResponse} this does not call `writeHead`: the headers go
   * on through `setHeader` and Node sends them with the first body write. That
   * keeps the pre-existing behaviour where a stream that errors before its
   * first chunk can still be answered with a 500 instead of a destroyed socket.
   */
  private applyRecordHead(): void {
    const res = this._res;
    this._outgoing.status = this.status;
    this._outgoing.commit();
    this._outgoing.flush((record) => {
      res.statusCode = record.status;
      const contentType = record.contentType;
      if (contentType !== undefined && !res.hasHeader('Content-Type')) {
        res.setHeader('Content-Type', contentType);
      }
      for (const [name, value] of record.extraHeaders()) {
        if (!res.hasHeader(name)) res.setHeader(name, value);
      }
    });
  }

  /**
   * The recorded headers in the shape `writeHead` accepts.
   *
   * @remarks
   * `Content-Length` is derived from the body actually written, so a rewrite can
   * never flush a length that disagrees with the bytes. It stays absent for an
   * unmeasurable body, which keeps chunked encoding. A string body is measured
   * with `Buffer.byteLength` rather than by encoding it: measuring must not cost
   * the copy that writing the string through avoids.
   */
  private nodeHeaders(
    record: OutgoingResponse,
    body: string | Uint8Array | null
  ): OutgoingHttpHeaders {
    const headers: OutgoingHttpHeaders = {};

    const contentType = record.contentType;
    if (contentType !== undefined) headers['Content-Type'] = contentType;

    const entries: readonly OutgoingHeaderEntry[] = record.extraHeaders();
    for (const [name, value] of entries) {
      if (!Object.hasOwn(headers, name)) {
        headers[name] = value;
        continue;
      }
      const existing = headers[name];
      headers[name] = Array.isArray(existing) ? [...existing, value] : [String(existing), value];
    }

    if (body !== null) {
      headers['Content-Length'] =
        typeof body === 'string' ? String(Buffer.byteLength(body)) : String(body.byteLength);
    }

    return headers;
  }

  /** Adapt a Node-style readable into the response, committing at the pipe. */
  private sendNodeStream(data: NodeStreamLike, hasContentType: boolean): void {
    const stream = data as {
      pipe(dest: ServerResponse): void;
      on(event: string, listener: (err: Error) => void): void;
      destroy?(err?: Error): void;
    };
    const res = this._res;

    // Wiring happens before committing: `.on` is only proven present by its own
    // call, so a duck-typed object carrying `pipe` and nothing else must not be
    // able to leave a response marked sent and never written.
    stream.on('error', (err: Error) => {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      } else {
        res.destroy(err);
      }
    });
    res.on('close', () => {
      if (stream.destroy) stream.destroy();
    });

    if (!hasContentType) this._outgoing.set('Content-Type', BINARY_CONTENT_TYPE);
    this.applyRecordHead();
    stream.pipe(res);
  }

  /** Pump a Web `ReadableStream` into the response, committing at the pump. */
  private sendWebStream(data: ReadableStream<Uint8Array>, hasContentType: boolean): void {
    // Acquiring the reader can throw (a locked or disturbed stream), so it
    // happens before the response looks committed.
    const reader = data.getReader();
    const res = this._res;

    if (!hasContentType) this._outgoing.set('Content-Type', BINARY_CONTENT_TYPE);
    this.applyRecordHead();

    res.on('close', () => {
      void reader.cancel().catch((): undefined => undefined);
    });

    const pump = async (): Promise<void> => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        if (!res.write(value)) {
          await waitForDrainOrDisconnect(res);
        }
      }
    };
    pump().catch((err: unknown) => {
      if (err instanceof StreamAbortedError) {
        // Client disconnected while backpressured — expected, no response to
        // salvage; the `res.on('close')` cleanup above already cancelled it.
        return;
      }
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      } else {
        res.destroy(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  // ===========================================================================
  // Response Streaming (see docs/RFC/request-data/003-stream.md)
  // ===========================================================================

  /**
   * Abort signal that fires when the client disconnects.
   *
   * @remarks
   * Lazily synthesized: the `AbortController` and its listeners are only created
   * on first access, keeping the non-streaming hot path allocation-free.
   */
  get signal(): AbortSignal {
    if (!this._abortController) {
      const controller = new AbortController();
      this._abortController = controller;
      const abort = (): void => {
        if (!controller.signal.aborted) controller.abort();
      };
      // A normal response also emits 'close' after 'finish'. Only a premature
      // close means the client is gone; aborting a completed request makes the
      // signal lie and forces the stream teardown path on every normal stream.
      this._res.on('close', () => {
        if (!this._res.writableFinished) abort();
      });
      // F-10: `req 'aborted'` is deprecated (Node 16+). A request stream that
      // closes before completing is the client-disconnect signal it replaced.
      // `req.destroyed` alone cannot stand in for that: a fully received
      // request is also destroyed when a normal connection tears down.
      this._req.on('close', () => {
        if (!this._req.complete) abort();
      });
    }
    return this._abortController.signal;
  }

  /**
   * Abort the in-flight request via `ctx.signal` (F-04).
   *
   * @remarks
   * Mirrors the Web adapters' `triggerTimeout` so a handler-level timeout race
   * can cooperatively cancel a still-running Node handler. Reads `ctx.signal`
   * first to ensure the (lazily-created) `AbortController` exists, then aborts
   * it directly — the client-disconnect listeners wired by the `signal` getter
   * are unaffected (they no-op once already aborted).
   *
   * @internal
   */
  triggerTimeout(reason?: unknown): void {
    void this.signal; // ensure _abortController is materialized
    if (!this._abortController) return; // unreachable after the line above; type-narrowing guard
    if (!this._abortController.signal.aborted) {
      this._abortController.abort(reason ?? new Error('Request timeout'));
    }
  }

  /**
   * @internal Stream a byte source to the client (Node eager pump). Resolves
   * when the stream is fully flushed; rejects on a non-abort transport error.
   */
  sendStream(source: ReadableStream<Uint8Array>): Promise<void> {
    if (this.isCommitted()) return Promise.resolve();

    const res = this._res;
    // Acquiring the reader can throw (an already-locked or disturbed stream), so
    // it happens before the response looks committed — otherwise the throw would
    // leave a response that is marked sent and was never written.
    const reader = source.getReader();
    this.applyRecordHead();

    // Cancel the source if the client disconnects mid-stream.
    res.on('close', () => {
      void reader.cancel().catch((): undefined => undefined);
    });

    return new Promise<void>((resolve, reject) => {
      const pump = async (): Promise<void> => {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            return;
          }
          if (!res.write(value)) {
            await waitForDrainOrDisconnect(res);
          }
        }
      };
      pump().then(resolve, (err: unknown) => {
        if (err instanceof StreamAbortedError) {
          // Client disconnected while backpressured (F-01) — the reader was
          // already cancelled by the `res.on('close')` handler above; settle
          // cleanly instead of tearing down an already-gone response.
          resolve();
          return;
        }
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end();
        } else {
          res.destroy(err instanceof Error ? err : new Error(String(err)));
        }
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
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
    // Validates the field/value grammar, and discards (once per process) a
    // write that arrives after the response was flushed.
    const accepted = this._outgoing.set(field, value);
    if (!accepted || !this._outgoing.flushing) return;

    // A write made *while* the flush runs — the position Node invokes an
    // `on-headers` bridge listener, after the head was serialized from the
    // record but before it reached the socket — must still land.
    this.writeHeaderToResponse(field, value);
  }

  /** Write one header straight to the socket, preserving `Set-Cookie` accumulation. */
  private writeHeaderToResponse(field: string, value: string | number | string[]): void {
    const res = this._res;

    // An array value means "set exactly these", so it replaces; a scalar
    // `Set-Cookie` accumulates, matching the record and the Web adapters.
    if (
      !Array.isArray(value) &&
      field.length === 10 &&
      (field.charCodeAt(0) | 0x20) === 0x73 /* 's' */ &&
      field.toLowerCase() === 'set-cookie'
    ) {
      const cookie = String(value);
      const appendHeader = (res as { appendHeader?: (name: string, v: string) => void })
        .appendHeader;
      if (typeof appendHeader === 'function') {
        appendHeader.call(res, field, cookie);
        return;
      }
      const existing = res.getHeader(field);
      if (existing === undefined) {
        res.setHeader(field, [cookie]);
      } else if (Array.isArray(existing)) {
        res.setHeader(field, [...existing.map(String), cookie]);
      } else {
        res.setHeader(field, [String(existing), cookie]);
      }
      return;
    }

    res.setHeader(field, value);
  }

  get(field: string): string | undefined {
    const value = this.headers[field.toLowerCase()];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
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
   * without touching the body source — and without allocating the lazily-built
   * `NodeBodySource`.
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
   * `Promise<void>` contract are preserved. Unwired → a cached resolved promise
   * (the same no-op as before, without a per-call allocation).
   */
  next(): Promise<void> {
    return this._next ? this._next() : RESOLVED_NEXT;
  }

  // ===========================================================================
  // Error Helpers
  // ===========================================================================

  /**
   * Throw an HTTP error
   */
  throw(status: number, message?: string): never {
    throw new HttpError(status, message);
  }

  /**
   * Assert a condition, throw if falsy
   */
  assert(condition: unknown, status: number, message?: string): asserts condition {
    if (!condition) {
      throw new HttpError(status, message);
    }
  }

  /**
   * Check if response has been sent
   */
  get responded(): boolean {
    return this._outgoing.committed;
  }

  /**
   * Mark response as sent (for streaming scenarios)
   */
  markResponded(): void {
    this._outgoing.commit();
  }
}

/**
 * Create a new NodeContext
 */
export function createNodeContext(
  req: IncomingMessage,
  res: ServerResponse,
  options?: NodeContextOptions
): NodeContext {
  return new NodeContext(req, res, options);
}

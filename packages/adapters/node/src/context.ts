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
  assertHeaderSafe,
  getRuntime,
  isBodylessResponse,
  METHODS_WITHOUT_BODY,
  resolveClientIp,
} from '@nextrush/runtime';
import {
  runNDJSONStream,
  runSSEStream,
  runTextStream,
} from '@nextrush/stream';
import type {
    AdapterContext,
    BodySource,
    ContextState,
    HttpMethod,
    IncomingHeaders,
    NDJSONStreamWriter,
    NodeStreamLike,
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
import type { IncomingMessage, ServerResponse } from 'node:http';
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
   * Whether to trust proxy headers (X-Forwarded-For, X-Forwarded-Proto, etc.)
   * When false, IP is always read from the socket.
   * @default false
   */
  trustProxy?: boolean;
}

/** Shared empty params object — avoids allocation per request (overwritten by router) */
const EMPTY_PARAMS: RouteParams = Object.freeze(Object.create(null)) as RouteParams;

/**
 * Shared frozen empty query object (HP-2) — avoids allocating a fresh `{}` on
 * every query-less request (the common case), mirroring {@link EMPTY_PARAMS}.
 * `ctx.query` is typed `readonly` and holds URL-parsed data, so the frozen
 * shared instance is safe; no code path mutates `ctx.query`.
 */
const EMPTY_QUERY: QueryParams = Object.freeze(Object.create(null)) as QueryParams;

/** Shared resolved promise for `next()` when no dispatch thunk is wired (HP-7). */
const RESOLVED_NEXT: Promise<void> = Promise.resolve();

/**
 * Node.js Context implementation
 */
export class NodeContext implements AdapterContext {
  readonly method: HttpMethod;
  readonly url: string;
  readonly path: string;
  readonly query: QueryParams;
  readonly headers: IncomingHeaders;
  readonly ip: string;
  readonly raw: NodeRawHttp;
  readonly runtime: Runtime;
  readonly bodySource: BodySource;

  body: unknown = undefined;
  params: RouteParams = EMPTY_PARAMS;
  status = 200;
  state: ContextState = {};

  private _next: (() => Promise<void>) | null = null;
  private _responded = false;
  private _abortController?: AbortController;

  constructor(req: IncomingMessage, res: ServerResponse, options: NodeContextOptions = {}) {
    this.raw = { req, res };
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

    this.headers = req.headers as IncomingHeaders;
    this.ip = this.getClientIp(req, options.trustProxy ?? false);

    // Create body source (empty for methods without body)
    this.bodySource = METHODS_WITHOUT_BODY.has(this.method)
      ? createEmptyBodySource()
      : new NodeBodySource(req);
  }

  /**
   * Resolve the client IP via the shared cross-adapter policy (audit F-11).
   *
   * @remarks
   * HP-1 trim: when `trustProxy` is false (default) the socket address IS the
   * client IP, so it is returned directly — no header-lookup closure, no
   * {@link resolveClientIp} call — byte-identical to the policy's own
   * `trustProxy: false` branch. When true, resolution goes through the shared
   * policy so precedence/validation match Bun/Deno/Edge. The socket address is
   * read eagerly, so `ctx.ip` stays stable even after the socket is torn down.
   */
  private getClientIp(req: IncomingMessage, trustProxy: boolean): string {
    const directIp = req.socket.remoteAddress ?? '';
    if (!trustProxy) {
      return directIp;
    }
    return resolveClientIp(
      (name) => {
        const value = req.headers[name];
        return Array.isArray(value) ? value[0] : value;
      },
      { trustProxy: true, directIp }
    );
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
   * Whether the response should suppress the body per HTTP semantics.
   * HEAD requests, 204 No Content, and 304 Not Modified must not include a body (RFC 7231).
   */
  private shouldSuppressBody(): boolean {
    return isBodylessResponse(this.method, this.status);
  }

  json(data: unknown): void {
    if (this._responded || this.raw.res.headersSent) return;
    this._responded = true;

    const res = this.raw.res;
    const json = JSON.stringify(data);

    // HP-14: one outgoing-header-map write instead of two setHeader calls.
    // Node merges these with any headers set earlier via setHeader() (e.g. a
    // middleware's ctx.set() headers, including accumulated Set-Cookie), giving
    // writeHead precedence — so prior headers survive and json()'s Content-Type
    // still overrides a middleware-set one, byte-identical to the old two-call form.
    res.writeHead(this.status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': String(Buffer.byteLength(json)),
    });

    if (this.shouldSuppressBody()) {
      res.end();
    } else {
      res.end(json);
    }
  }

  send(data: ResponseBody): void {
    if (this._responded || this.raw.res.headersSent) return;

    const res = this.raw.res;
    res.statusCode = this.status;
    const suppress = this.shouldSuppressBody();

    if (data === null || data === undefined) {
      this._responded = true;
      res.end();
      return;
    }

    if (typeof data === 'string') {
      this._responded = true;
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      }
      res.setHeader('Content-Length', Buffer.byteLength(data));
      res.end(suppress ? undefined : data);
      return;
    }

    if (Buffer.isBuffer(data)) {
      this._responded = true;
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
      res.setHeader('Content-Length', data.length);
      res.end(suppress ? undefined : data);
      return;
    }

    // Uint8Array (non-Buffer) — convert to Buffer for Node.js response
    if (data instanceof Uint8Array) {
      this._responded = true;
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
      const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
      res.setHeader('Content-Length', buf.length);
      res.end(suppress ? undefined : buf);
      return;
    }

    // ArrayBuffer — wrap as Buffer
    if (data instanceof ArrayBuffer) {
      this._responded = true;
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
      const buf = Buffer.from(data);
      res.setHeader('Content-Length', buf.length);
      res.end(suppress ? undefined : buf);
      return;
    }

    // Readable stream (Node.js style)
    if (typeof (data as NodeStreamLike).pipe === 'function') {
      this._responded = true;
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
      const stream = data as {
        pipe(dest: ServerResponse): void;
        on(event: string, listener: (err: Error) => void): void;
        destroy?(err?: Error): void;
      };
      stream.on('error', (err: Error) => {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        } else {
          res.destroy(err);
        }
      });
      // Clean up source stream on client disconnect
      res.on('close', () => {
        if (stream.destroy) stream.destroy();
      });
      stream.pipe(res);
      return;
    }

    // Web ReadableStream — convert to Node.js pipeline
    if (
      typeof (data as WebStreamLike).getReader === 'function' &&
      'locked' in (data as WebStreamLike)
    ) {
      this._responded = true;
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
      const reader = (data as ReadableStream<Uint8Array>).getReader();
      // Clean up reader on client disconnect
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
            await new Promise<void>((resolve) => res.once('drain', resolve));
          }
        }
      };
      pump().catch((err: unknown) => {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        } else {
          res.destroy(err instanceof Error ? err : new Error(String(err)));
        }
      });
      return;
    }

    // Object - delegate to json() which manages its own _responded flag
    if (typeof data === 'object') {
      this.json(data);
      return;
    }

    // Default: convert to string
    this._responded = true;
    const str = String(data);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(str));
    res.end(str);
  }

  html(content: string): void {
    if (this._responded || this.raw.res.headersSent) return;
    this._responded = true;

    const res = this.raw.res;
    res.statusCode = this.status;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(content));

    if (this.shouldSuppressBody()) {
      res.end();
    } else {
      res.end(content);
    }
  }

  redirect(url: string, status = 302): void {
    if (this._responded || this.raw.res.headersSent) return;
    this._responded = true;

    const res = this.raw.res;
    res.statusCode = status;
    res.setHeader('Location', url);
    // Use plain text to avoid HTML injection via user-controlled URLs
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(`Redirecting to ${url}`);
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
      this.raw.res.on('close', abort);
      this.raw.req.on('aborted', abort);
    }
    return this._abortController.signal;
  }

  /**
   * @internal Stream a byte source to the client (Node eager pump). Resolves
   * when the stream is fully flushed; rejects on a non-abort transport error.
   */
  sendStream(source: ReadableStream<Uint8Array>): Promise<void> {
    if (this._responded || this.raw.res.headersSent) return Promise.resolve();
    this._responded = true;

    const res = this.raw.res;
    res.statusCode = this.status;
    const reader = source.getReader();
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
            await new Promise<void>((r) => res.once('drain', r));
          }
        }
      };
      pump().then(resolve, (err: unknown) => {
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
    // Guard against CRLF injection (header splitting) via the shared helper.
    assertHeaderSafe(field, value);

    const res = this.raw.res;

    // Set-Cookie must accumulate across calls (multiple headers), not overwrite —
    // matching the web adapter's append semantics so `ctx.set('Set-Cookie', …)`
    // behaves identically on every runtime. An array value means "set exactly
    // these", so it still replaces (Node emits one header per array element).
    //
    // HP-15: gate the toLowerCase() allocation behind a constant-time pre-check —
    // 'set-cookie' is exactly 10 chars and starts with 's'/'S' — so a lowercased
    // string is only ever allocated for a field that could actually be set-cookie,
    // not for every header. Detection stays case-insensitive across all casings.
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
      // Fallback for response objects without appendHeader: merge manually.
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
    return this._responded;
  }

  /**
   * Mark response as sent (for streaming scenarios)
   */
  markResponded(): void {
    this._responded = true;
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

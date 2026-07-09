/**
 * @nextrush/runtime - Web Response Builder
 *
 * A composable collaborator that owns the Web (Fetch API) response-building
 * logic shared by the Bun, Deno, and Edge contexts (audit F-04b). Each
 * per-runtime context composes one `WebResponseBuilder` instead of copy-pasting
 * ~200 lines of `json`/`send`/`html`/`redirect`/`set`/`getResponse` logic.
 *
 * Behavior is intentionally identical to the previous per-adapter copies — this
 * is a behavior-preserving extraction. Cross-adapter fixes (e.g. the empty-body
 * header drop F-02 and the redundant Content-Length encode F-18) land here once
 * in later stages.
 *
 * @packageDocumentation
 */

import type { NodeStreamLike, ResponseBody } from '@nextrush/types';

/**
 * Detect a Node-style readable stream (duck-typed on `.pipe`) that is not a Web
 * `ReadableStream`.
 *
 * @remarks
 * `ResponseBody` permits `NodeStreamLike` (audit F-12). On Web adapters a Node
 * `Readable` previously fell through to the object branch and was
 * `JSON.stringify`'d into `{}`. Node `Readable`s are async-iterable, so we can
 * adapt them to a Web `ReadableStream` without importing `node:stream`.
 */
function isNodeReadable(data: unknown): data is NodeStreamLike & AsyncIterable<unknown> {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as NodeStreamLike).pipe === 'function' &&
    typeof (data as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === 'function'
  );
}

/**
 * Adapt a Node-style async-iterable readable stream into a Web
 * `ReadableStream<Uint8Array>` using only Web APIs (audit F-12).
 *
 * @param stream - A Node `Readable`-like async iterable.
 * @returns A Web `ReadableStream` that pulls from the Node stream.
 */
function nodeStreamToWebStream(
  stream: AsyncIterable<unknown>
): ReadableStream<Uint8Array> {
  // Narrow TReturn to `undefined` so the destructured `value` is `unknown`,
  // not `any` (IteratorResult defaults TReturn to `any`).
  const iterator = stream[Symbol.asyncIterator]() as AsyncIterator<unknown, undefined>;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await iterator.next();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(
          value instanceof Uint8Array ? value : new Uint8Array(value as ArrayBufferLike)
        );
      } catch (err) {
        controller.error(err);
      }
    },
    async cancel() {
      if (typeof iterator.return === 'function') {
        await iterator.return();
      }
    },
  });
}

/**
 * Whether the response must not carry a body per HTTP semantics.
 *
 * @remarks
 * HEAD requests, 204 No Content, 304 Not Modified, and 1xx informational
 * responses never include a body (RFC 7231). Shared by the Web response builder
 * and the Node context so suppression is defined once.
 *
 * @param method - The (upper-cased) request method.
 * @param status - The response status code.
 */
export function isBodylessResponse(method: string, status: number): boolean {
  return method === 'HEAD' || status === 204 || status === 304 || (status >= 100 && status < 200);
}

/**
 * Guard a header field/value against CRLF injection (header splitting).
 *
 * @remarks
 * Shared by every adapter's `set()` so the guard — and its error messages —
 * cannot drift. Numeric values are always safe.
 *
 * @param field - Header field name.
 * @param value - Header value (string, number, or array of strings).
 * @throws Error if the field or any value contains a CR or LF.
 */
export function assertHeaderSafe(field: string, value: string | number | string[]): void {
  if (field.includes('\r') || field.includes('\n')) {
    throw new Error('Header field contains invalid characters');
  }
  if (typeof value === 'string') {
    if (value.includes('\r') || value.includes('\n')) {
      throw new Error('Header value contains invalid characters');
    }
  } else if (Array.isArray(value)) {
    for (const v of value) {
      if (v.includes('\r') || v.includes('\n')) {
        throw new Error('Header value contains invalid characters');
      }
    }
  }
}

/**
 * Owns the Web response state and the response-writing methods for the
 * Fetch-API adapters (Bun/Deno/Edge).
 *
 * @remarks
 * The owning context passes its current `status` into the response methods and
 * into {@link WebResponseBuilder.getResponse} (as the fallback used when no body
 * method has committed a specific status, e.g. a redirect).
 */
export class WebResponseBuilder {
  private readonly method: string;
  private readonly _headers = new Headers();
  private _status = 200;
  private _body: BodyInit | null = null;
  private _responded = false;

  /**
   * @param method - The (upper-cased) request method, used for body suppression.
   */
  constructor(method: string) {
    this.method = method;
  }

  /** Whether a response has been committed. */
  get responded(): boolean {
    return this._responded;
  }

  /** Mark the response committed out-of-band (e.g. after wiring a stream). */
  markResponded(): void {
    this._responded = true;
  }

  /** Send a JSON response. */
  json(data: unknown, status: number): void {
    if (this._responded) return;
    this._responded = true;

    // F-18: do not set Content-Length for a string body — `new Response(string)`
    // derives it from the BodyInit, so encoding it here just to measure length
    // is a wasted full-body encode + allocation on the hot path.
    this._status = status;
    this._headers.set('Content-Type', 'application/json; charset=utf-8');
    this._body = JSON.stringify(data);
  }

  /** Send text/binary/stream/object response, auto-detecting the content type. */
  send(data: ResponseBody, status: number): void {
    if (this._responded) return;
    this._responded = true;

    this._status = status;

    if (data === null || data === undefined) {
      this._body = null;
      return;
    }

    if (typeof data === 'string') {
      if (!this._headers.has('Content-Type')) {
        this._headers.set('Content-Type', 'text/plain; charset=utf-8');
      }
      // F-18: let the runtime derive Content-Length from the string body.
      this._body = data;
      return;
    }

    if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
      const bytes =
        data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      if (!this._headers.has('Content-Type')) {
        this._headers.set('Content-Type', 'application/octet-stream');
      }
      // Length is free for binary bodies (no encode needed) — keep it explicit.
      this._headers.set('Content-Length', String(bytes.length));
      // Uint8Array is a valid BodyInit in Web APIs.
      this._body = bytes as unknown as BodyInit;
      return;
    }

    if (data instanceof ReadableStream) {
      if (!this._headers.has('Content-Type')) {
        this._headers.set('Content-Type', 'application/octet-stream');
      }
      this._body = data as ReadableStream<Uint8Array>;
      return;
    }

    // F-12: Node-style readable stream — adapt to a Web ReadableStream rather
    // than JSON.stringify'ing it into `{}`.
    if (isNodeReadable(data)) {
      if (!this._headers.has('Content-Type')) {
        this._headers.set('Content-Type', 'application/octet-stream');
      }
      this._body = nodeStreamToWebStream(data);
      return;
    }

    // Object — serialize as JSON.
    if (typeof data === 'object') {
      this._headers.set('Content-Type', 'application/json; charset=utf-8');
      // F-18: let the runtime derive Content-Length from the string body.
      this._body = JSON.stringify(data);
      return;
    }

    // Default: coerce to string.
    this._headers.set('Content-Type', 'text/plain; charset=utf-8');
    this._body = String(data);
  }

  /** Send an HTML response. */
  html(content: string, status: number): void {
    if (this._responded) return;
    this._responded = true;

    this._status = status;
    this._headers.set('Content-Type', 'text/html; charset=utf-8');
    // F-18: let the runtime derive Content-Length from the string body.
    this._body = content;
  }

  /** Send a redirect. Body is `text/plain` to avoid HTML injection via URLs. */
  redirect(url: string, status: number): void {
    if (this._responded) return;
    this._responded = true;

    this._status = status;
    this._headers.set('Location', url);
    this._headers.set('Content-Type', 'text/plain; charset=utf-8');
    this._body = `Redirecting to ${url}`;
  }

  /** Wire a byte stream as the response body (drained by the runtime). */
  sendStream(source: ReadableStream<Uint8Array>, status: number): void {
    if (this._responded) return;
    this._responded = true;
    this._status = status;
    this._body = source;
  }

  /** Set a response header, guarding CRLF injection and accumulating cookies. */
  set(field: string, value: string | number | string[]): void {
    assertHeaderSafe(field, value);

    if (Array.isArray(value)) {
      this._headers.delete(field);
      for (const v of value) {
        this._headers.append(field, v);
      }
      return;
    }

    const stringValue = typeof value === 'string' ? value : String(value);
    if (field.toLowerCase() === 'set-cookie') {
      this._headers.append(field, stringValue);
    } else {
      this._headers.set(field, stringValue);
    }
  }

  /**
   * Materialize the accumulated `Response`.
   *
   * @param fallbackStatus - The context status to use when no body method has
   *   committed a specific status yet.
   */
  getResponse(fallbackStatus: number): Response {
    if (!this._responded) {
      this._status = fallbackStatus;
    }

    const status = this._status;

    // A 1xx informational status is not a valid final response status — the Web
    // `Response` constructor only accepts 200–599 and would otherwise throw an
    // opaque `RangeError`. Fail with an actionable message instead (audit R-6).
    if (status < 200) {
      throw new RangeError(
        `Cannot build a Response with informational (1xx) status ${String(status)}; ` +
          `1xx responses are not valid final responses.`
      );
    }

    const suppressBody = isBodylessResponse(this.method, status);

    return new Response(suppressBody ? null : this._body, {
      status,
      headers: this._headers,
    });
  }
}

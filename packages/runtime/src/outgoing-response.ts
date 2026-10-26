/**
 * @nextrush/runtime - the recorded outgoing response
 *
 * One response model for both adapter families. A response method records the
 * status, headers and serialized body here; the adapter flushes the record once
 * after the middleware chain settles. Nothing reaches a transport before that
 * flush, so middleware that runs after the handler can still add a header or
 * replace the body — the capability that used to depend on which adapter ran.
 *
 * Two lifecycle flags, deliberately distinct:
 *
 * - {@link OutgoingResponse.committed} — a response method has recorded the
 *   status and body. A further response method is a no-op, but headers remain
 *   writable: this is the window post-handler middleware writes in.
 * - {@link OutgoingResponse.flushed} — the adapter has handed the record to its
 *   transport. The record is frozen; a later write is discarded and reported
 *   once per process rather than thrown, so a late write cannot unwind the
 *   remaining middleware chain.
 *
 * The record owns the HTTP-independent parts only: header semantics, body
 * length derivation, and the flush lifecycle. Turning the record into a
 * `Response` or into `writeHead`/`write`/`end` calls stays in the adapter.
 *
 * A record is per-request. It must never be retained past the flush that ends
 * the request, and it is not safe to share between requests.
 *
 * @packageDocumentation
 */

import { assertHeaderSafe } from './header-guards';
import { HeaderList, sameHeaderName, type OutgoingHeaderEntry } from './outgoing-headers';
import { warnDiscardedWriteOnce } from './outgoing-warnings';

/** The serialized response body the record holds. A stream is never recorded. */
export type OutgoingBody = string | Uint8Array | null;

export type { OutgoingHeaderEntry };

/** Shared empty list so a header-less response allocates no header map. */
const NO_HEADERS: readonly OutgoingHeaderEntry[] = Object.freeze([]);

const CONTENT_TYPE = 'content-type';
const LOWERCASE_C = 0x63;

/** Reused only for measuring and materializing string bodies. */
const UTF8_ENCODER = new TextEncoder();

/**
 * A recorded outgoing response.
 *
 * @example
 * ```typescript
 * const record = new OutgoingResponse();
 * record.setBody(serializeJson(data), 'application/json');
 * record.set('X-Trace-Id', traceId);
 * // The adapter flushes once, after the middleware chain settles:
 * record.flush((flushed) => writeToTransport(flushed));
 * ```
 */
export class OutgoingResponse {
  /** The status the adapter flushes. Set from the context's `status`. */
  status = 200;

  /**
   * The body-method content type, kept out of the header list so a response
   * whose only header is this default allocates no map (see
   * {@link extraHeaders}). An explicit `set('Content-Type', …)` takes
   * precedence and lands in the list instead.
   */
  private _contentType: string | undefined;

  /** Lazily allocated: absent until a non-default header is written. */
  private _headers: HeaderList | undefined;

  private _body: OutgoingBody = null;
  /** Memoized byte form of a string body so measuring never encodes twice. */
  private _bodyBytes: Uint8Array | undefined;
  /** Body replacements performed after the response was committed. */
  private _bodyCopies = 0;
  private _committed = false;
  private _flushed = false;
  private _flushing = false;

  /** Whether a response method has recorded a status and body. */
  get committed(): boolean {
    return this._committed;
  }

  /** Whether the adapter has handed the record to its transport. */
  get flushed(): boolean {
    return this._flushed;
  }

  /**
   * Whether a flush is running right now.
   *
   * @remarks
   * A transport can still accept a header write from inside its own
   * `writeHead` window (the position a compatibility layer's `on-headers`
   * bridge writes from). An adapter forwards a write made while this is true
   * to its transport instead of discarding it.
   */
  get flushing(): boolean {
    return this._flushing;
  }

  /** The serialized body, or `null` when nothing has been recorded. */
  get body(): OutgoingBody {
    return this._body;
  }

  /**
   * How many times the body was replaced after the response was committed.
   *
   * @remarks
   * Zero for a response no post-handler middleware touched, one for a rewrite
   * such as compression. This is the measurable form of the buffer cost: a
   * response that is never rewritten never pays for a second body.
   */
  get bodyCopies(): number {
    return this._bodyCopies;
  }

  /**
   * The effective `Content-Type`.
   *
   * @remarks
   * Held in a dedicated slot rather than the header list: it is the one header
   * every body method writes, so keeping it out of the list is what lets a
   * response with only this header allocate no map at all.
   */
  get contentType(): string | undefined {
    return this._contentType;
  }

  /**
   * Record the serialized body and, optionally, the content type the response
   * method chose.
   *
   * @remarks
   * Usable after the response is committed: replacing the body is how a
   * post-handler middleware (compression) rewrites the response. A body method's
   * content type replaces the default *and* drops an earlier explicit one, which
   * is the precedence the Node `writeHead` call used to give it.
   *
   * @returns `false` when the record was already flushed and the write was
   *   discarded and reported.
   */
  setBody(body: OutgoingBody, contentType?: string): boolean {
    if (this._flushed) {
      warnDiscardedWriteOnce('body');
      return false;
    }

    this._body = body;
    this._bodyBytes = undefined;
    if (this._committed) this._bodyCopies += 1;
    // A recorded length describes the bytes it was written for. Replacing the
    // body invalidates it: keeping it would flush a length that disagrees with
    // the new body, truncating or over-reading the response. A caller that knows
    // the new length sets it after the replacement.
    this._headers?.remove('content-length');
    if (contentType !== undefined) this._contentType = contentType;
    this._committed = true;
    return true;
  }

  /** Mark the response committed without recording a body (streaming, empty). */
  commit(): void {
    if (this._flushed) return;
    this._committed = true;
  }

  /**
   * Record a response header.
   *
   * @remarks
   * Validation runs first and is not weakened by the flushed state.
   *
   * @returns `false` when the record was already flushed and the write was
   *   discarded and reported.
   */
  set(field: string, value: string | number | string[]): boolean {
    assertHeaderSafe(field, value);

    if (this._flushed) {
      warnDiscardedWriteOnce(field);
      return false;
    }

    // A content type lives in its own slot so the common response allocates no
    // header map. The pre-check keeps the case fold off every other header.
    if (isContentTypeField(field)) {
      this._contentType = Array.isArray(value) ? value.join(', ') : String(value);
      return true;
    }

    (this._headers ??= new HeaderList()).set(field, toHeaderValue(value));
    return true;
  }

  /** The first value recorded for a field, case-insensitively. */
  getHeader(field: string): string | undefined {
    if (isContentTypeField(field)) return this._contentType;
    return this._headers?.get(field);
  }

  /** Whether a field has at least one value, including the content type slot. */
  hasHeader(field: string): boolean {
    if (isContentTypeField(field)) return this._contentType !== undefined;
    return this._headers?.has(field) ?? false;
  }

  /** Every recorded `Set-Cookie` value, in write order. */
  getSetCookie(): string[] {
    return this._headers?.getAll('set-cookie') ?? [];
  }

  /**
   * The recorded headers other than the default content type, in write order.
   *
   * @remarks
   * Returns the shared empty list while nothing was written, so a response that
   * only carries a body method's content type allocates no header map at all.
   */
  extraHeaders(): readonly OutgoingHeaderEntry[] {
    return this._headers?.entries() ?? NO_HEADERS;
  }

  /** The UTF-8 byte length of the recorded body, or `undefined` when unmeasurable. */
  contentLength(): number | undefined {
    if (this._body === null) return undefined;
    return this.bodyBytes()?.byteLength;
  }

  /** The recorded body as bytes, or `undefined` when there is none. */
  bodyBytes(): Uint8Array | undefined {
    const body = this._body;
    if (body === null) return undefined;
    if (typeof body !== 'string') return body;

    // Memoized: measuring the length and writing the body must not each encode
    // the same string, which would be the extra body copy this model exists to
    // avoid on a response nothing rewrites.
    return (this._bodyBytes ??= UTF8_ENCODER.encode(body));
  }

  /**
   * Flush the record exactly once.
   *
   * @param write - The adapter's transport writer, invoked with this record.
   * @returns `true` for the one call that flushed, `false` for every later call.
   */
  flush(write: (record: OutgoingResponse) => void): boolean {
    if (this._flushed) return false;

    this._flushing = true;
    try {
      write(this);
    } finally {
      this._flushing = false;
    }

    // Marked only after the writer returned: a writer that threw (a 1xx status
    // the transport cannot represent) leaves the record retryable so the error
    // path can still answer.
    this._flushed = true;
    return true;
  }
}

/** A header value array is already `string[]`; a number is stringified. */
function toHeaderValue(value: string | number | string[]): string | string[] {
  return typeof value === 'number' ? String(value) : value;
}

/**
 * Whether a field names the content type, without allocating a lower-cased copy.
 *
 * @remarks
 * The content type is held in its own slot rather than the header list: every
 * body method writes it, so keeping it out of the map is what lets a response
 * carrying only that header allocate no map. The length and first-character
 * checks are constant-time, so no case fold runs for any other field.
 */
function isContentTypeField(field: string): boolean {
  return (
    field.length === CONTENT_TYPE.length &&
    (field.charCodeAt(0) | 0x20) === LOWERCASE_C &&
    sameHeaderName(field, CONTENT_TYPE)
  );
}

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
import { HeaderList, type OutgoingHeaderEntry } from './outgoing-headers';

/** The serialized response body the record holds. A stream is never recorded. */
export type OutgoingBody = string | Uint8Array | null;

export type { OutgoingHeaderEntry };

/** Shared empty list so a header-less response allocates no header map. */
const NO_HEADERS: readonly OutgoingHeaderEntry[] = Object.freeze([]);

const CONTENT_TYPE_KEY = 'content-type';

/** Reused only for measuring and materializing string bodies. */
const UTF8_ENCODER = new TextEncoder();

let warnedDiscardedWrite = false;

/**
 * Report once per process that a response write arrived after the flush.
 *
 * @remarks
 * Discarding silently would make a registered middleware stop having an effect
 * with no signal; throwing would unwind the rest of the chain while the request
 * still answers normally, which is what the pre-record Node adapter did. Once
 * per process (not per request) keeps a deterministic code mistake from becoming
 * a log storm under load.
 */
function warnDiscardedWriteOnce(field: string): void {
  if (warnedDiscardedWrite) return;
  warnedDiscardedWrite = true;
  console.warn(
    `[@nextrush/runtime] discarding '${field}': the response was already flushed, so the write was ` +
      `not sent. Change the response from middleware that runs before the flush, or guard on ` +
      `ctx.responded. Later discarded writes in this process are not reported.`
  );
}

/**
 * A recorded outgoing response.
 *
 * @example
 * ```typescript
 * const record = new OutgoingResponse();
 * record.setBody(serializeJson(data), 'application/json; charset=utf-8');
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
   * The effective `Content-Type`: an explicitly set one, else the body method's
   * default.
   */
  get contentType(): string | undefined {
    return this._headers?.get(CONTENT_TYPE_KEY) ?? this._contentType;
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
    if (contentType !== undefined) {
      this._contentType = contentType;
      this._headers?.remove(CONTENT_TYPE_KEY);
    }
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

    (this._headers ??= new HeaderList()).set(field, toHeaderValue(value));
    return true;
  }

  /** The first value recorded for a field, case-insensitively. */
  getHeader(field: string): string | undefined {
    return this._headers?.get(field);
  }

  /** Whether a field has at least one value, including the default content type. */
  hasHeader(field: string): boolean {
    return (
      (this._headers?.has(field) ?? false) ||
      (field.toLowerCase() === CONTENT_TYPE_KEY && this._contentType !== undefined)
    );
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
    const body = this._body;
    if (body === null) return undefined;
    if (typeof body === 'string') return UTF8_ENCODER.encode(body).length;
    return body.byteLength;
  }

  /** The recorded body as bytes, or `undefined` when there is none. */
  bodyBytes(): Uint8Array | undefined {
    const body = this._body;
    if (body === null) return undefined;
    return typeof body === 'string' ? UTF8_ENCODER.encode(body) : body;
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
      this._flushed = true;
    }
    return true;
  }
}

/** A header value array is already `string[]`; a number is stringified. */
function toHeaderValue(value: string | number | string[]): string | string[] {
  return typeof value === 'number' ? String(value) : value;
}

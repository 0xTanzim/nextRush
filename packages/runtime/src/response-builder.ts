/**
 * @nextrush/runtime - Web Response Builder
 *
 * A composable collaborator that owns the Web (Fetch API) response-building
 * logic shared by the Bun, Deno, and Edge contexts (audit F-04b). Each
 * per-runtime context composes one `WebResponseBuilder` instead of copy-pasting
 * ~200 lines of `json`/`send`/`html`/`redirect`/`set`/`getResponse` logic.
 *
 * The builder records into the shared {@link OutgoingResponse} rather than
 * holding private state, so middleware that runs after the handler reaches the
 * same record the adapter flushes. A `Response` is materialised only by
 * {@link WebResponseBuilder.getResponse}, once, after the chain settles.
 *
 * Two guarantees hold for every body method:
 *
 * 1. **A body is resolved before the response is committed.** The record is
 *    marked committed only once the bytes to write exist, so a value that cannot
 *    be serialized throws with the response untouched and the application error
 *    handler can still answer (see `serializeJson`).
 * 2. **Finalization never returns an unanswered error.** An error status that
 *    nothing wrote is answered with the framework's error envelope rather than
 *    returned as an empty response (see `unansweredErrorBody`).
 *
 * @packageDocumentation
 */

import type { ResponseBody } from '@nextrush/types';
import { isBodylessResponse } from './header-guards';
import { OutgoingResponse } from './outgoing-response';
import { prepareBody } from './response-body';
import { serializeJson } from './serialize-json';
import { LAST_RESORT_ERROR_STATUS, unansweredErrorBody } from './unanswered-response';

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';
const TEXT_CONTENT_TYPE = 'text/plain; charset=utf-8';
const HTML_CONTENT_TYPE = 'text/html; charset=utf-8';

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
  private readonly _record = new OutgoingResponse();

  /**
   * A streamed body. Streams are never recorded: the record's body is the
   * serialized form, and a stream has no serialized form to rewrite.
   */
  private _stream?: ReadableStream<Uint8Array>;

  /** The one materialised `Response`; `getResponse` is idempotent. */
  private _response?: Response;

  /**
   * @param method - The (upper-cased) request method, used for body suppression.
   */
  constructor(method: string) {
    this.method = method;
  }

  /** The recorded outgoing response, reachable by response-aware middleware. */
  get record(): OutgoingResponse {
    return this._record;
  }

  /** Whether a response has been committed. */
  get responded(): boolean {
    return this._record.committed;
  }

  /** Mark the response committed out-of-band (e.g. after wiring a stream). */
  markResponded(): void {
    this._record.commit();
  }

  /** Send a JSON response. */
  json(data: unknown, status: number): void {
    if (this._record.committed) return;

    // Resolve before committing: `serializeJson` throws on a value JSON cannot
    // represent, and it must throw before this response looks committed.
    const body = serializeJson(data);

    this._record.status = status;
    // F-18: no Content-Length for a string body — `new Response(string)`
    // derives it from the BodyInit, so encoding it here just to measure length
    // is a wasted full-body encode + allocation on the hot path.
    this._record.setBody(body, JSON_CONTENT_TYPE);
  }

  /** Send text/binary/stream/object response, auto-detecting the content type. */
  send(data: ResponseBody, status: number): void {
    if (this._record.committed) return;

    // Resolve first (it can throw), commit after — see `prepareBody`.
    const prepared = prepareBody(data, this._record.hasHeader('Content-Type'));

    this._record.status = status;

    if (isStream(prepared.body)) {
      this._stream = prepared.body;
      if (prepared.contentType !== undefined) {
        this._record.set('Content-Type', prepared.contentType);
      }
      this._record.commit();
      return;
    }

    this._record.setBody(toRecordedBody(prepared.body), prepared.contentType);
    if (prepared.contentLength !== undefined) {
      this._record.set('Content-Length', String(prepared.contentLength));
    }
  }

  /** Send an HTML response. */
  html(content: string, status: number): void {
    if (this._record.committed) return;

    this._record.status = status;
    // F-18: let the runtime derive Content-Length from the string body.
    this._record.setBody(content, HTML_CONTENT_TYPE);
  }

  /** Send a redirect. Body is `text/plain` to avoid HTML injection via URLs. */
  redirect(url: string, status: number): void {
    if (this._record.committed) return;

    this._record.status = status;
    this._record.set('Location', url);
    this._record.setBody(`Redirecting to ${url}`, TEXT_CONTENT_TYPE);
  }

  /** Wire a byte stream as the response body (drained by the runtime). */
  sendStream(source: ReadableStream<Uint8Array>, status: number): void {
    if (this._record.committed) return;

    this._record.status = status;
    this._stream = source;
    this._record.commit();
  }

  /** Set a response header, guarding CRLF injection and accumulating cookies. */
  set(field: string, value: string | number | string[]): void {
    this._record.set(field, value);
  }

  /**
   * Materialize the accumulated `Response` exactly once.
   *
   * @param fallbackStatus - The context status to use when no body method has
   *   committed a specific status yet.
   */
  getResponse(fallbackStatus: number): Response {
    const cached = this._response;
    if (cached !== undefined) return cached;

    if (!this._record.committed) {
      this.synthesizeUnanswered(fallbackStatus);
    }

    this._record.flush(() => {
      this._response = buildResponse(this.method, this._record, this._stream);
    });

    // `flush` invokes its writer exactly once and this method is the record's
    // only flusher, so the materialised response is always present here.
    return this._response!;
  }

  /**
   * Apply the fallback status, answering an error status that nothing wrote.
   *
   * @remarks
   * This is the last of three deliberately redundant layers (the application
   * error path and the adapter finalizers are the others). It runs only when the
   * response is uncommitted: a success status is left as the documented empty
   * response, while an error status gets the framework's envelope — an error the
   * client can read beats an empty response it cannot.
   */
  private synthesizeUnanswered(fallbackStatus: number): void {
    this._record.status = fallbackStatus;

    if (fallbackStatus < LAST_RESORT_ERROR_STATUS) return;

    this._record.setBody(JSON.stringify(unansweredErrorBody(fallbackStatus)), JSON_CONTENT_TYPE);
  }
}

/** Whether a prepared body is a byte stream rather than a serialized body. */
function isStream(body: BodyInit | null): body is ReadableStream<Uint8Array> {
  return typeof body === 'object' && body !== null && 'getReader' in body;
}

/** Narrow the prepared body to the serialized forms the record holds. */
function toRecordedBody(body: BodyInit | null): string | Uint8Array | null {
  if (body === null || typeof body === 'string' || body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  return null;
}

/**
 * Turn the record into a `Response`, preserving every byte-level guarantee the
 * builder had before the record existed.
 */
function buildResponse(
  method: string,
  record: OutgoingResponse,
  stream: ReadableStream<Uint8Array> | undefined
): Response {
  const status = record.status;

  // A 1xx informational status is not a valid final response status — the Web
  // `Response` constructor only accepts 200–599 and would otherwise throw an
  // opaque `RangeError`. Fail with an actionable message instead (audit R-6).
  if (status < 200) {
    throw new RangeError(
      `Cannot build a Response with informational (1xx) status ${String(status)}; ` +
        `1xx responses are not valid final responses.`
    );
  }

  const suppressBody = isBodylessResponse(method, status);

  // F-03: a HEAD response SHALL carry the `Content-Length` the equivalent GET
  // would (RFC 7231 §4.3.2). The body is suppressed, but the length is set from
  // the would-be body when it is measurable (string / byte body; a stream has
  // no known length). 204 and 304 legitimately omit it and are excluded, and an
  // already-set Content-Length (binary bodies set it explicitly) is preserved.
  if (
    suppressBody &&
    method === 'HEAD' &&
    status !== 204 &&
    status !== 304 &&
    !record.hasHeader('Content-Length')
  ) {
    const length = record.contentLength();
    if (length !== undefined) {
      record.set('Content-Length', String(length));
    }
  }

  const headers = new Headers();
  for (const [name, value] of record.extraHeaders()) {
    headers.append(name, value);
  }
  // The body method's content type is a fallback, so an explicit header — before
  // or after the body method — always wins.
  const contentType = record.contentType;
  if (contentType !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', contentType);
  }

  return new Response(suppressBody ? null : (stream ?? (record.body as BodyInit | null)), {
    status,
    headers,
  });
}

/**
 * Build a framework-generated JSON error response with a Content-Type that is
 * uniform across every adapter (F-05).
 *
 * @remarks
 * The Web adapters (Bun/Deno/Edge) and the serverless engine construct their
 * `404`/`500`/`504` responses through this single helper so the charset cannot
 * drift per adapter (Edge and Bun's server-level error path previously emitted a
 * bare `application/json`). The body shape is `{ error: <message> }`, matching
 * the adapters' existing error payloads.
 *
 * @param status - The HTTP status code.
 * @param message - The human-readable error message placed under `error`.
 * @returns A Web `Response` with `Content-Type: application/json; charset=utf-8`.
 */
export function jsonErrorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': JSON_CONTENT_TYPE },
  });
}

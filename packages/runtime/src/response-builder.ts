/**
 * @nextrush/runtime - Web Response Builder
 *
 * A composable collaborator that owns the Web (Fetch API) response-building
 * logic shared by the Bun, Deno, and Edge contexts (audit F-04b). Each
 * per-runtime context composes one `WebResponseBuilder` instead of copy-pasting
 * ~200 lines of `json`/`send`/`html`/`redirect`/`set`/`getResponse` logic.
 *
 * Two guarantees hold for every body method:
 *
 * 1. **A body is resolved before the response is committed.** The responded flag
 *    is set only once the bytes to write exist, so a value that cannot be
 *    serialized throws with the response untouched and the application error
 *    handler can still answer (see `serializeJson`).
 * 2. **Finalization never returns an unanswered error.** An error status that
 *    nothing wrote is answered with the framework's error envelope rather than
 *    returned as an empty response (see `unansweredErrorBody`).
 *
 * @packageDocumentation
 */

import type { ResponseBody } from '@nextrush/types';
import { assertHeaderSafe, isBodylessResponse } from './header-guards';
import { measureBodyLength, prepareBody } from './response-body';
import { serializeJson } from './serialize-json';
import { LAST_RESORT_ERROR_STATUS, unansweredErrorBody } from './unanswered-response';

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

    // Resolve before committing: `serializeJson` throws on a value JSON cannot
    // represent, and it must throw before this response looks committed.
    const body = serializeJson(data);

    this._status = status;
    this._headers.set('Content-Type', 'application/json; charset=utf-8');
    // F-18: no Content-Length for a string body — `new Response(string)`
    // derives it from the BodyInit, so encoding it here just to measure length
    // is a wasted full-body encode + allocation on the hot path.
    this._body = body;
    this._responded = true;
  }

  /** Send text/binary/stream/object response, auto-detecting the content type. */
  send(data: ResponseBody, status: number): void {
    if (this._responded) return;

    // Resolve first (it can throw), commit after — see `prepareBody`.
    const { body, contentType, contentLength } = prepareBody(
      data,
      this._headers.has('Content-Type')
    );

    this._status = status;
    if (contentType !== undefined) {
      this._headers.set('Content-Type', contentType);
    }
    if (contentLength !== undefined) {
      this._headers.set('Content-Length', String(contentLength));
    }
    this._body = body;
    this._responded = true;
  }

  /** Send an HTML response. */
  html(content: string, status: number): void {
    if (this._responded) return;

    this._status = status;
    this._headers.set('Content-Type', 'text/html; charset=utf-8');
    // F-18: let the runtime derive Content-Length from the string body.
    this._body = content;
    this._responded = true;
  }

  /** Send a redirect. Body is `text/plain` to avoid HTML injection via URLs. */
  redirect(url: string, status: number): void {
    if (this._responded) return;

    this._status = status;
    this._headers.set('Location', url);
    this._headers.set('Content-Type', 'text/plain; charset=utf-8');
    this._body = `Redirecting to ${url}`;
    this._responded = true;
  }

  /** Wire a byte stream as the response body (drained by the runtime). */
  sendStream(source: ReadableStream<Uint8Array>, status: number): void {
    if (this._responded) return;

    this._status = status;
    this._body = source;
    this._responded = true;
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
    // HP-15-web: gate the set-cookie detection behind a constant-time pre-check
    // (length + case-insensitive first char) so a non-cookie header never
    // allocates a lowercased string. 'set-cookie' is 10 chars starting with 's'
    // (0x73); only a field passing both cheap checks falls back to toLowerCase.
    const isSetCookie =
      field.length === 10 && (field.charCodeAt(0) | 0x20) === 0x73 && field.toLowerCase() === 'set-cookie';
    if (isSetCookie) {
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
      this.synthesizeUnanswered(fallbackStatus);
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

    // F-03: a HEAD response SHALL carry the `Content-Length` the equivalent GET
    // would (RFC 7231 §4.3.2). The body is suppressed, but the length is set from
    // the would-be body when it is measurable (string / byte body; a stream has
    // no known length). 204 and 304 legitimately omit it and are excluded, and an
    // already-set Content-Length (binary bodies set it explicitly) is preserved.
    if (
      suppressBody &&
      this.method === 'HEAD' &&
      status !== 204 &&
      status !== 304 &&
      !this._headers.has('Content-Length')
    ) {
      const len = measureBodyLength(this._body);
      if (len !== undefined) {
        this._headers.set('Content-Length', String(len));
      }
    }

    return new Response(suppressBody ? null : this._body, {
      status,
      headers: this._headers,
    });
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
    this._status = fallbackStatus;

    if (fallbackStatus < LAST_RESORT_ERROR_STATUS) return;

    this._headers.set('Content-Type', 'application/json; charset=utf-8');
    this._body = JSON.stringify(unansweredErrorBody(fallbackStatus));
  }
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
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

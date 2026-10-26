/**
 * @nextrush/runtime - Resolving a response body before committing it
 *
 * Splitting body classification out of the response builder is what lets a body
 * method resolve its bytes *first* and commit *after*: the resolution is a pure
 * function of the value and the headers already set, so it can throw (an
 * unserializable object) without leaving the builder half-committed — no status,
 * no `Content-Type`, no responded flag.
 *
 * @packageDocumentation
 */

import type { NodeStreamLike, ResponseBody } from '@nextrush/types';
import { serializeJson } from './serialize-json';

/** Bare JSON: RFC 8259 defines no `charset` parameter, and Deno's static-response
 * fast path accepts only this literal (see `response-builder.ts`). */
const JSON_CONTENT_TYPE = 'application/json';
/**
 * No space after `;`, upper-case `UTF-8`: this is the exact literal Deno's
 * `Response` constructor accepts for its static-response fast path. The
 * conventional `text/plain; charset=utf-8` spelling costs ~0.4 µs more per
 * response there; RFC 9110 makes both the whitespace and the case of the
 * charset value insignificant, so the media type is unchanged.
 */
const TEXT_CONTENT_TYPE = 'text/plain;charset=UTF-8';
const BINARY_CONTENT_TYPE = 'application/octet-stream';

/** A body resolved from a `ResponseBody`, ready to be committed. */
export interface PreparedBody {
  /** The Web `BodyInit` to send, or `null` for a bodyless response. */
  body: BodyInit | null;
  /**
   * The `Content-Type` to apply, or `undefined` when the caller's own header
   * stands (or none was written: the runtime then types the response itself).
   */
  contentType?: string;
  /** A `Content-Length` to apply, or `undefined` when the runtime derives it. */
  contentLength?: number;
}

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
function nodeStreamToWebStream(stream: AsyncIterable<unknown>): ReadableStream<Uint8Array> {
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
 * Resolve the body of a `send()` call, including any header the value implies.
 *
 * @remarks
 * Pure: it reads `hasContentType` rather than reading or writing the builder's
 * headers, which is what makes "resolve, then commit" possible. A value that
 * cannot be serialized throws here, before the caller touches any state.
 *
 * @param data - The value passed to `send()`.
 * @param hasContentType - Whether a `Content-Type` is already set by the caller.
 * @returns The body plus the headers to apply, if any.
 * @throws {TypeError} When an object body has no JSON representation.
 */
export function prepareBody(data: ResponseBody, hasContentType: boolean): PreparedBody {
  if (data === null || data === undefined) {
    return { body: null };
  }

  if (typeof data === 'string') {
    // F-18: no Content-Length — the runtime derives it from the string body, so
    // encoding it here just to measure length is a wasted full-body encode.
    return { body: data, contentType: hasContentType ? undefined : TEXT_CONTENT_TYPE };
  }

  if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
    const bytes =
      data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    // Length is free for binary bodies (no encode needed) — keep it explicit.
    return {
      body: bytes as unknown as BodyInit,
      contentType: hasContentType ? undefined : BINARY_CONTENT_TYPE,
      contentLength: bytes.length,
    };
  }

  if (data instanceof ReadableStream) {
    return {
      body: data as ReadableStream<Uint8Array>,
      contentType: hasContentType ? undefined : BINARY_CONTENT_TYPE,
    };
  }

  // F-12: a Node-style readable is adapted, not JSON.stringify'd into `{}`.
  if (isNodeReadable(data)) {
    return {
      body: nodeStreamToWebStream(data),
      contentType: hasContentType ? undefined : BINARY_CONTENT_TYPE,
    };
  }

  if (typeof data === 'object') {
    // Always JSON: an object is never sent as whatever type a middleware set —
    // the value, not the caller, decides how it is written.
    return { body: serializeJson(data), contentType: JSON_CONTENT_TYPE };
  }

  return { body: String(data), contentType: TEXT_CONTENT_TYPE };
}

/** UTF-8 encoder reused for measuring string body lengths on the HEAD path. */
const HEAD_LENGTH_ENCODER = new TextEncoder();

/**
 * The byte length of a materialized response body, or `undefined` when it cannot
 * be measured (a `ReadableStream` has no known length, and `null` has none).
 *
 * @remarks
 * Used only on the HEAD/bodyless path (F-03) to emit a `Content-Length` equal to
 * what the equivalent GET would carry.
 */
export function measureBodyLength(body: BodyInit | null): number | undefined {
  if (body === null) return undefined;
  if (typeof body === 'string') return HEAD_LENGTH_ENCODER.encode(body).length;
  if (body instanceof Uint8Array) return body.byteLength;
  if (body instanceof ArrayBuffer) return body.byteLength;
  return undefined;
}

/**
 * @nextrush/runtime - BodySource Abstractions
 *
 * Cross-runtime body reading abstraction for body parsers.
 *
 * @packageDocumentation
 */

import { BadRequestError, PayloadTooLargeError } from '@nextrush/errors';
import type { BodySource, BodySourceOptions, NodeStreamLike, WebStreamLike } from '@nextrush/types';
import { exceedsUtf8Limit, utf8ByteLength } from './body-size-guard';

/**
 * Default body size limit (1MB)
 */
export const DEFAULT_BODY_LIMIT = 1024 * 1024;

/**
 * Shared utf-8 decoder: `decode()` without `{ stream: true }` is stateless, and
 * constructing a decoder per body read costs ~0.16 µs of pure overhead.
 */
const UTF8_DECODER = new TextDecoder('utf-8');

/**
 * Error thrown when body has already been consumed
 */
export class BodyConsumedError extends BadRequestError {
  constructor() {
    super('Body has already been consumed', { code: 'BODY_CONSUMED' });
    this.name = 'BodyConsumedError';
  }
}

/**
 * Error thrown when body exceeds size limit
 */
export class BodyTooLargeError extends PayloadTooLargeError {
  readonly limit: number;
  readonly received: number;

  constructor(limit: number, received: number) {
    super(`Body too large: received ${String(received)} bytes, limit is ${String(limit)} bytes`, {
      code: 'BODY_TOO_LARGE',
      details: { limit, received },
    });
    this.name = 'BodyTooLargeError';
    this.limit = limit;
    this.received = received;
  }
}

/**
 * Error thrown when the request stream closes before the body has been fully
 * read — a client disconnect/abort mid-body, not a server fault.
 *
 * @remarks
 * F-10 (reliability hardening): classified as a client-side (4xx) condition
 * distinct from a generic `Error`, so logs/metrics do not misattribute a
 * client disconnect as a server (5xx) error.
 */
export class RequestAbortedError extends BadRequestError {
  constructor() {
    super('Request stream closed before the body was fully read (client disconnected)', {
      code: 'REQUEST_ABORTED',
    });
    this.name = 'RequestAbortedError';
  }
}

/**
 * Abstract base class for BodySource implementations
 *
 * @remarks
 * Adapter packages extend this class to provide runtime-specific
 * body reading functionality:
 * - `NodeBodySource` in `@nextrush/adapter-node`
 * - `BunBodySource` in `@nextrush/adapter-bun`
 * - `WebBodySource` in `@nextrush/adapter-deno` and `@nextrush/adapter-edge`
 *
 * @example
 * ```typescript
 * // In @nextrush/adapter-node
 * export class NodeBodySource extends AbstractBodySource {
 *   constructor(private req: IncomingMessage) {
 *     super(req.headers['content-length'], req.headers['content-type']);
 *   }
 *
 *   protected async _buffer(): Promise<Uint8Array> {
 *     const chunks: Buffer[] = [];
 *     for await (const chunk of this.req) {
 *       chunks.push(chunk);
 *     }
 *     return Buffer.concat(chunks);
 *   }
 *
 *   protected _stream(): NodeStreamLike {
 *     return this.req;
 *   }
 * }
 * ```
 */
export abstract class AbstractBodySource implements BodySource {
  protected _consumed = false;
  protected _cachedBuffer: Uint8Array | undefined;
  /**
   * Body decoded as text by a text-first read. `buffer()` encodes it on demand
   * so a later byte read still observes the same body.
   */
  protected _cachedText: string | undefined;

  readonly contentLength: number | undefined;
  readonly contentType: string | undefined;

  protected readonly options: Required<BodySourceOptions>;

  constructor(
    contentLength: string | number | undefined,
    contentType: string | undefined,
    options: BodySourceOptions = {}
  ) {
    if (typeof contentLength === 'string') {
      const parsed = parseInt(contentLength, 10);
      this.contentLength = Number.isNaN(parsed) ? undefined : parsed;
    } else {
      this.contentLength = contentLength;
    }

    this.contentType = contentType;

    this.options = {
      limit: options.limit ?? DEFAULT_BODY_LIMIT,
      encoding: options.encoding ?? 'utf-8',
    };
  }

  get consumed(): boolean {
    return this._consumed;
  }

  /**
   * Runtime-specific buffer reading implementation.
   *
   * @param limit - Effective byte limit to enforce incrementally while reading.
   * @internal
   */
  protected abstract _buffer(limit: number): Promise<Uint8Array>;

  /**
   * Runtime-specific stream access
   * @internal
   */
  protected abstract _stream(): NodeStreamLike | WebStreamLike;

  async buffer(limit?: number): Promise<Uint8Array> {
    if (this._consumed && this._cachedBuffer) {
      return this._cachedBuffer;
    }

    if (this._consumed) {
      if (this._cachedText !== undefined) {
        this._cachedBuffer = new TextEncoder().encode(this._cachedText);
        return this._cachedBuffer;
      }
      throw new BodyConsumedError();
    }

    // Effective limit: the caller-supplied per-read limit takes precedence over the
    // construction-time limit (RFC 017 — BodySource limit propagation).
    const effectiveLimit = limit ?? this.options.limit;

    // Check content-length limit before reading
    if (this.contentLength !== undefined && this.contentLength > effectiveLimit) {
      throw new BodyTooLargeError(effectiveLimit, this.contentLength);
    }

    this._consumed = true;
    const buffer = await this._buffer(effectiveLimit);

    // Check actual size after reading
    if (buffer.length > effectiveLimit) {
      throw new BodyTooLargeError(effectiveLimit, buffer.length);
    }

    this._cachedBuffer = buffer;
    return buffer;
  }

  async text(): Promise<string> {
    if (this._cachedText !== undefined) return this._cachedText;
    const buffer = await this.buffer();
    const decoder =
      this.options.encoding === 'utf-8'
        ? UTF8_DECODER
        : new TextDecoder(this.options.encoding);
    return decoder.decode(buffer);
  }

  async json<T = unknown>(): Promise<T> {
    // Reject clearly wrong Content-Types before parsing
    if (this.contentType && !this.isJsonContentType(this.contentType)) {
      throw new BadRequestError(`Expected JSON content type, received: ${this.contentType}`, {
        code: 'INVALID_CONTENT_TYPE',
      });
    }

    const text = await this.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new BadRequestError('Invalid JSON in request body', {
        code: 'INVALID_JSON',
      });
    }
  }

  /**
   * Check if the Content-Type header indicates JSON
   */
  private isJsonContentType(contentType: string): boolean {
    const ct = contentType.toLowerCase();
    return ct.includes('application/json') || ct.includes('+json');
  }

  stream(): NodeStreamLike | WebStreamLike {
    if (this._consumed) {
      throw new BodyConsumedError();
    }
    this._consumed = true;

    const raw = this._stream();

    // Wrap web ReadableStream with size enforcement
    if (raw instanceof ReadableStream) {
      return this.wrapWithSizeLimit(raw as ReadableStream<Uint8Array>);
    }

    // Node-style streams returned as-is (Node adapter handles its own enforcement)
    return raw;
  }

  /**
   * Wrap a ReadableStream with a TransformStream that enforces the body size limit.
   * Aborts the stream with BodyTooLargeError if the limit is exceeded.
   */
  private wrapWithSizeLimit(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
    const limit = this.options.limit;
    let totalBytes = 0;

    return stream.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          totalBytes += chunk.byteLength;
          if (totalBytes > limit) {
            controller.error(new BodyTooLargeError(limit, totalBytes));
            return;
          }
          controller.enqueue(chunk);
        },
      })
    );
  }
}

/**
 * Web API BodySource implementation
 *
 * @remarks
 * Works with any runtime that supports the Web Fetch API Request object:
 * - Bun
 * - Deno
 * - Cloudflare Workers
 * - Vercel Edge
 *
 * @example
 * ```typescript
 * const request = new Request('http://example.com', {
 *   method: 'POST',
 *   body: JSON.stringify({ hello: 'world' })
 * });
 *
 * const bodySource = new WebBodySource(request);
 * const data = await bodySource.json();
 * ```
 */
export class WebBodySource extends AbstractBodySource {
  private readonly request: Request;

  constructor(request: Request, options: BodySourceOptions = {}) {
    super(
      request.headers.get('content-length') ?? undefined,
      request.headers.get('content-type') ?? undefined,
      options
    );
    this.request = request;
  }

  /**
   * Read the body as text when the transport proves it fits the limit.
   *
   * @param limit - Byte limit to enforce.
   * @returns The decoded body, or `undefined` when the read is not provably
   * bounded and the caller must fall back to the incremental byte reader.
   *
   * @remarks
   * A declared `Content-Length` at or below the limit bounds the body: HTTP
   * framing truncates the body to that length, so the read cannot exceed the
   * limit on any runtime (verified on Bun 1.4.3 — an understated length yields
   * exactly the declared bytes). A chunked or absent length carries no such
   * proof, and Deno and edge runtimes do not cap the body server-side, so those
   * bodies must not take this path.
   *
   * @internal
   */
  async readTextIfProvenWithin(limit: number): Promise<string | undefined> {
    if (this._consumed) throw new BodyConsumedError();
    // `request.text()` always decodes UTF-8, so a source configured for another
    // encoding cannot be served from it.
    if (this.options.encoding !== 'utf-8') return undefined;
    if (this.contentLength === undefined || this.contentLength > limit) return undefined;

    this._consumed = true;
    const text = await this.request.text();

    // Cache only after the limit check: a rejected body must not become
    // retrievable through the text cache that `buffer()` falls back to.
    if (exceedsUtf8Limit(text, limit)) {
      throw new BodyTooLargeError(limit, utf8ByteLength(text));
    }
    this._cachedText = text;
    return text;
  }

  protected async _buffer(limit: number): Promise<Uint8Array> {
    // RFC-043: an honest Content-Length at or below the effective limit proves
    // the whole body fits, so one native read cannot violate the configured
    // memory bound. Every unprovable body (chunked, absent, understated, or
    // over-limit — the last already rejected by `buffer()`) keeps the
    // incremental reader below, which cancels as soon as the total exceeds it.
    if (this.contentLength !== undefined && this.contentLength <= limit) {
      const arrayBuffer = await this.request.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    }

    // If no body stream, use arrayBuffer() fast path
    if (!this.request.body) {
      const arrayBuffer = await this.request.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    }

    // Stream body with incremental size enforcement to prevent memory DoS
    const reader = this.request.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        totalBytes += value.byteLength;
        if (totalBytes > limit) {
          await reader.cancel();
          throw new BodyTooLargeError(limit, totalBytes);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    // Concatenate chunks into single Uint8Array
    if (chunks.length === 1 && chunks[0] !== undefined) return chunks[0];
    const result = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result;
  }

  protected _stream(): ReadableStream<Uint8Array> {
    if (!this.request.body) {
      // Return an empty stream if no body
      return new ReadableStream({
        start(controller) {
          controller.close();
        },
      });
    }
    return this.request.body;
  }
}

/**
 * Empty BodySource for requests without a body
 *
 * @remarks
 * Used for GET, HEAD, OPTIONS requests that typically don't have a body.
 */
export class EmptyBodySource implements BodySource {
  readonly consumed = false;
  readonly contentLength = 0;
  readonly contentType = undefined;

  text(): Promise<string> {
    return Promise.resolve('');
  }

  buffer(): Promise<Uint8Array> {
    return Promise.resolve(EMPTY_BUFFER);
  }

  json<T = unknown>(): Promise<T> {
    return Promise.reject(
      new BadRequestError('Request body is empty — cannot parse as JSON', {
        code: 'EMPTY_BODY_JSON',
      })
    );
  }

  stream(): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start(controller) {
        controller.close();
      },
    });
  }
}

/** Pre-allocated empty buffer */
const EMPTY_BUFFER = new Uint8Array(0);

/** Singleton empty body source — stateless, safe to share */
const EMPTY_BODY_SOURCE: BodySource = new EmptyBodySource();

/**
 * Create an empty body source (returns shared singleton)
 *
 * @returns A shared EmptyBodySource instance
 */
export function createEmptyBodySource(): BodySource {
  return EMPTY_BODY_SOURCE;
}

/**
 * Create a Web API body source from a Request
 *
 * @param request - Web API Request object
 * @param options - Body source options
 * @returns A WebBodySource instance
 */
export function createWebBodySource(request: Request, options?: BodySourceOptions): BodySource {
  return new WebBodySource(request, options);
}

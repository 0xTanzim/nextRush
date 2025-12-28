/**
 * @nextrush/runtime - BodySource Abstractions
 *
 * Cross-runtime body reading abstraction for body parsers.
 *
 * @packageDocumentation
 */

import type { BodySource, BodySourceOptions } from '@nextrush/types';

/**
 * Default body size limit (1MB)
 */
export const DEFAULT_BODY_LIMIT = 1024 * 1024;

/**
 * Error thrown when body has already been consumed
 */
export class BodyConsumedError extends Error {
  constructor() {
    super('Body has already been consumed');
    this.name = 'BodyConsumedError';
  }
}

/**
 * Error thrown when body exceeds size limit
 */
export class BodyTooLargeError extends Error {
  readonly limit: number;
  readonly received: number;

  constructor(limit: number, received: number) {
    super(`Body too large: received ${received} bytes, limit is ${limit} bytes`);
    this.name = 'BodyTooLargeError';
    this.limit = limit;
    this.received = received;
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
 *   constructor(req: IncomingMessage) {
 *     super(req.headers['content-length'], req.headers['content-type']);
 *     this._stream = req;
 *   }
 *
 *   protected async _buffer(): Promise<Uint8Array> {
 *     const chunks: Buffer[] = [];
 *     for await (const chunk of this._stream) {
 *       chunks.push(chunk);
 *     }
 *     return Buffer.concat(chunks);
 *   }
 * }
 * ```
 */
export abstract class AbstractBodySource implements BodySource {
  protected _consumed = false;
  protected _cachedBuffer: Uint8Array | undefined;

  readonly contentLength: number | undefined;
  readonly contentType: string | undefined;

  protected readonly options: Required<BodySourceOptions>;

  constructor(
    contentLength: string | number | undefined,
    contentType: string | undefined,
    options: BodySourceOptions = {}
  ) {
    this.contentLength =
      typeof contentLength === 'string'
        ? parseInt(contentLength, 10) || undefined
        : contentLength;

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
   * Runtime-specific buffer reading implementation
   * @internal
   */
  protected abstract _buffer(): Promise<Uint8Array>;

  /**
   * Runtime-specific stream access
   * @internal
   */
  protected abstract _stream(): ReadableStream<Uint8Array> | NodeJS.ReadableStream;

  async buffer(): Promise<Uint8Array> {
    if (this._consumed && this._cachedBuffer) {
      return this._cachedBuffer;
    }

    if (this._consumed) {
      throw new BodyConsumedError();
    }

    // Check content-length limit before reading
    if (this.contentLength !== undefined && this.contentLength > this.options.limit) {
      throw new BodyTooLargeError(this.options.limit, this.contentLength);
    }

    this._consumed = true;
    const buffer = await this._buffer();

    // Check actual size after reading
    if (buffer.length > this.options.limit) {
      throw new BodyTooLargeError(this.options.limit, buffer.length);
    }

    this._cachedBuffer = buffer;
    return buffer;
  }

  async text(): Promise<string> {
    const buffer = await this.buffer();
    return new TextDecoder(this.options.encoding).decode(buffer);
  }

  async json<T = unknown>(): Promise<T> {
    const text = await this.text();
    return JSON.parse(text) as T;
  }

  stream(): ReadableStream<Uint8Array> | NodeJS.ReadableStream {
    if (this._consumed) {
      throw new BodyConsumedError();
    }
    this._consumed = true;
    return this._stream();
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

  protected async _buffer(): Promise<Uint8Array> {
    const arrayBuffer = await this.request.arrayBuffer();
    return new Uint8Array(arrayBuffer);
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

  async text(): Promise<string> {
    return '';
  }

  async buffer(): Promise<Uint8Array> {
    return new Uint8Array(0);
  }

  async json<T = unknown>(): Promise<T> {
    throw new SyntaxError('Unexpected end of JSON input');
  }

  stream(): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start(controller) {
        controller.close();
      },
    });
  }
}

/**
 * Create an empty body source
 *
 * @returns An EmptyBodySource instance
 */
export function createEmptyBodySource(): BodySource {
  return new EmptyBodySource();
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

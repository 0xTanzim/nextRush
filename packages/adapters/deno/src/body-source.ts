/**
 * @nextrush/adapter-deno - Deno Body Source
 *
 * BodySource implementation for Deno's Web Request API.
 *
 * @packageDocumentation
 */

import type { BodySource, BodySourceOptions } from '@nextrush/types';

/**
 * Default body size limit (1MB)
 */
const DEFAULT_BODY_LIMIT = 1024 * 1024;

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
 * Deno BodySource implementation
 *
 * @remarks
 * Uses Deno's native Web Request API. Deno follows web standards,
 * so this implementation is similar to the Bun adapter.
 *
 * @example
 * ```typescript
 * import { DenoBodySource } from '@nextrush/adapter-deno';
 *
 * const bodySource = new DenoBodySource(request);
 *
 * // Read as text
 * const text = await bodySource.text();
 *
 * // Read as JSON
 * const data = await bodySource.json();
 *
 * // Read as buffer
 * const buffer = await bodySource.buffer();
 * ```
 */
export class DenoBodySource implements BodySource {
  private readonly request: Request;
  private _consumed = false;
  private _cachedBuffer: Uint8Array | undefined;

  readonly contentLength: number | undefined;
  readonly contentType: string | undefined;

  private readonly options: Required<BodySourceOptions>;

  constructor(request: Request, options: BodySourceOptions = {}) {
    this.request = request;

    // Parse content-length header
    const contentLengthHeader = request.headers.get('content-length');
    this.contentLength =
      contentLengthHeader !== null ? parseInt(contentLengthHeader, 10) || undefined : undefined;

    // Get content-type header
    this.contentType = request.headers.get('content-type') ?? undefined;

    this.options = {
      limit: options.limit ?? DEFAULT_BODY_LIMIT,
      encoding: options.encoding ?? 'utf-8',
    };
  }

  get consumed(): boolean {
    return this._consumed;
  }

  async buffer(): Promise<Uint8Array> {
    // Return cached buffer if available
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

    // Use Web API arrayBuffer()
    const arrayBuffer = await this.request.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Check actual size after reading
    if (buffer.length > this.options.limit) {
      throw new BodyTooLargeError(this.options.limit, buffer.length);
    }

    this._cachedBuffer = buffer;
    return buffer;
  }

  async text(): Promise<string> {
    // If not consumed, use native text() for better performance
    if (!this._consumed) {
      // Check content-length limit before reading
      if (this.contentLength !== undefined && this.contentLength > this.options.limit) {
        throw new BodyTooLargeError(this.options.limit, this.contentLength);
      }

      this._consumed = true;
      const text = await this.request.text();

      // Check actual size after reading
      const byteLength = new TextEncoder().encode(text).length;
      if (byteLength > this.options.limit) {
        throw new BodyTooLargeError(this.options.limit, byteLength);
      }

      // Cache as buffer for potential future use
      this._cachedBuffer = new TextEncoder().encode(text);

      return text;
    }

    // If consumed, use cached buffer
    if (this._cachedBuffer) {
      return new TextDecoder(this.options.encoding).decode(this._cachedBuffer);
    }

    throw new BodyConsumedError();
  }

  async json<T = unknown>(): Promise<T> {
    // If not consumed, use native json() for better performance
    if (!this._consumed) {
      // Check content-length limit before reading
      if (this.contentLength !== undefined && this.contentLength > this.options.limit) {
        throw new BodyTooLargeError(this.options.limit, this.contentLength);
      }

      this._consumed = true;

      return this.request.json() as Promise<T>;
    }

    // If consumed with cached buffer, parse from text
    if (this._cachedBuffer) {
      const text = new TextDecoder(this.options.encoding).decode(this._cachedBuffer);
      return JSON.parse(text) as T;
    }

    throw new BodyConsumedError();
  }

  stream(): ReadableStream<Uint8Array> {
    if (this._consumed) {
      throw new BodyConsumedError();
    }

    this._consumed = true;

    // Return the request body stream or empty stream
    if (!this.request.body) {
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
 * Create a Deno body source from a Request
 *
 * @param request - Web API Request object
 * @param options - Body source options
 * @returns DenoBodySource instance
 */
export function createDenoBodySource(request: Request, options?: BodySourceOptions): BodySource {
  return new DenoBodySource(request, options);
}

/**
 * Empty body source for requests without a body
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
 */
export function createEmptyBodySource(): BodySource {
  return new EmptyBodySource();
}

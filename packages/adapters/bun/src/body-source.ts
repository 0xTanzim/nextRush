/**
 * @nextrush/adapter-bun - Bun Body Source
 *
 * BodySource implementation for Bun's Web Request API.
 *
 * @packageDocumentation
 */

import { BadRequestError } from '@nextrush/errors';
import { BodyConsumedError, BodyTooLargeError, DEFAULT_BODY_LIMIT } from '@nextrush/runtime';
import type { BodySource, BodySourceOptions } from '@nextrush/types';

/**
 * Bun BodySource implementation
 *
 * @remarks
 * Leverages Bun's native Web Request API for optimal performance.
 * Bun has highly optimized `text()`, `json()`, and `arrayBuffer()` methods.
 *
 * @example
 * ```typescript
 * import { BunBodySource } from '@nextrush/adapter-bun';
 *
 * const bodySource = new BunBodySource(request);
 *
 * // Read as text
 * const text = await bodySource.text();
 *
 * // Read as JSON (uses Bun's native JSON parsing)
 * const data = await bodySource.json();
 *
 * // Read as buffer
 * const buffer = await bodySource.buffer();
 * ```
 */
export class BunBodySource implements BodySource {
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

    // Stream body with incremental size enforcement to prevent memory DoS
    if (this.request.body) {
      const reader = this.request.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          totalBytes += value.byteLength;
          if (totalBytes > this.options.limit) {
            reader.cancel();
            throw new BodyTooLargeError(this.options.limit, totalBytes);
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }

      const buffer = chunks.length === 1 ? chunks[0]! : concatUint8Arrays(chunks, totalBytes);
      this._cachedBuffer = buffer;
      return buffer;
    }

    // No body stream — empty body
    const buffer = new Uint8Array(0);
    this._cachedBuffer = buffer;
    return buffer;
  }

  async text(): Promise<string> {
    const buffer = await this.buffer();
    return new TextDecoder(this.options.encoding).decode(buffer);
  }

  async json<T = unknown>(): Promise<T> {
    const text = await this.text();
    try {
      return JSON.parse(text) as T;
    } catch (err) {
      if (err instanceof BodyTooLargeError || err instanceof BodyConsumedError) {
        throw err;
      }
      throw new BadRequestError('Invalid JSON in request body', {
        code: 'INVALID_JSON',
      });
    }
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
 * Create a Bun body source from a Request
 *
 * @param request - Web API Request object
 * @param options - Body source options
 * @returns BunBodySource instance
 */
export function createBunBodySource(request: Request, options?: BodySourceOptions): BodySource {
  return new BunBodySource(request, options);
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
    throw new BadRequestError('Request body is empty — cannot parse as JSON', {
      code: 'EMPTY_BODY_JSON',
    });
  }

  stream(): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start(controller) {
        controller.close();
      },
    });
  }
}

/** Singleton empty body source — stateless, safe to share across requests */
const EMPTY_BODY_SOURCE: BodySource = new EmptyBodySource();

/**
 * Create an empty body source (returns shared singleton)
 */
export function createEmptyBodySource(): BodySource {
  return EMPTY_BODY_SOURCE;
}

/**
 * Concatenate multiple Uint8Array chunks into a single array
 */
function concatUint8Arrays(chunks: Uint8Array[], totalLength: number): Uint8Array {
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

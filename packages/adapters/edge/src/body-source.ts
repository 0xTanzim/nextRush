/**
 * @nextrush/adapter-edge - Edge Body Source
 *
 * BodySource implementation for Edge runtimes (Cloudflare Workers, Vercel Edge).
 *
 * @packageDocumentation
 */

import { BadRequestError } from '@nextrush/errors';
import { BodyConsumedError, BodyTooLargeError, DEFAULT_BODY_LIMIT } from '@nextrush/runtime';
import type { BodySource, BodySourceOptions } from '@nextrush/types';

/**
 * Edge BodySource implementation
 *
 * @remarks
 * Works with any edge runtime that supports the Web Fetch API:
 * - Cloudflare Workers
 * - Vercel Edge Functions
 * - Netlify Edge Functions
 * - AWS Lambda@Edge
 *
 * @example
 * ```typescript
 * import { EdgeBodySource } from '@nextrush/adapter-edge';
 *
 * const bodySource = new EdgeBodySource(request);
 *
 * // Read as text
 * const text = await bodySource.text();
 *
 * // Read as JSON
 * const data = await bodySource.json();
 * ```
 */
export class EdgeBodySource implements BodySource {
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

    if (this.contentLength !== undefined && this.contentLength > this.options.limit) {
      throw new BodyTooLargeError(this.options.limit, this.contentLength);
    }

    this._consumed = true;

    // Stream body with incremental size enforcement to prevent memory DoS
    // Especially critical on edge runtimes with 128MB memory limits
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
            await reader.cancel();
            throw new BodyTooLargeError(this.options.limit, totalBytes);
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }

      const buffer =
        chunks.length === 1 && chunks[0] !== undefined
          ? chunks[0]
          : concatUint8Arrays(chunks, totalBytes);
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

    if (!this.request.body) {
      return new ReadableStream({
        start(controller) {
          controller.close();
        },
      });
    }

    // Wrap with size-limiting transform to prevent unbounded reads
    const limit = this.options.limit;
    let totalBytes = 0;

    const transform = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        totalBytes += chunk.byteLength;
        if (totalBytes > limit) {
          controller.error(new BodyTooLargeError(limit, totalBytes));
          return;
        }
        controller.enqueue(chunk);
      },
    });

    return this.request.body.pipeThrough(transform);
  }
}

/**
 * Create an Edge body source from a Request
 */
export function createEdgeBodySource(request: Request, options?: BodySourceOptions): BodySource {
  return new EdgeBodySource(request, options);
}

/**
 * Empty body source for requests without a body
 */
export class EmptyBodySource implements BodySource {
  readonly consumed = false;
  readonly contentLength = 0;
  readonly contentType = undefined;

  text(): Promise<string> {
    return Promise.resolve('');
  }

  buffer(): Promise<Uint8Array> {
    return Promise.resolve(new Uint8Array(0));
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

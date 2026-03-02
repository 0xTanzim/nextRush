/**
 * @nextrush/adapter-edge - Edge Body Source
 *
 * BodySource implementation for Edge runtimes (Cloudflare Workers, Vercel Edge).
 *
 * @packageDocumentation
 */

import { BadRequestError } from '@nextrush/errors';
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

    const arrayBuffer = await this.request.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    if (buffer.length > this.options.limit) {
      throw new BodyTooLargeError(this.options.limit, buffer.length);
    }

    this._cachedBuffer = buffer;
    return buffer;
  }

  async text(): Promise<string> {
    if (!this._consumed) {
      if (this.contentLength !== undefined && this.contentLength > this.options.limit) {
        throw new BodyTooLargeError(this.options.limit, this.contentLength);
      }

      this._consumed = true;
      const text = await this.request.text();

      const byteLength = new TextEncoder().encode(text).length;
      if (byteLength > this.options.limit) {
        throw new BodyTooLargeError(this.options.limit, byteLength);
      }

      this._cachedBuffer = new TextEncoder().encode(text);
      return text;
    }

    if (this._cachedBuffer) {
      return new TextDecoder(this.options.encoding).decode(this._cachedBuffer);
    }

    throw new BodyConsumedError();
  }

  async json<T = unknown>(): Promise<T> {
    try {
      if (!this._consumed) {
        if (this.contentLength !== undefined && this.contentLength > this.options.limit) {
          throw new BodyTooLargeError(this.options.limit, this.contentLength);
        }

        this._consumed = true;
        return await (this.request.json() as Promise<T>);
      }

      if (this._cachedBuffer) {
        const text = new TextDecoder(this.options.encoding).decode(this._cachedBuffer);
        return JSON.parse(text) as T;
      }

      throw new BodyConsumedError();
    } catch (err) {
      if (
        err instanceof BadRequestError ||
        err instanceof BodyTooLargeError ||
        err instanceof BodyConsumedError
      ) {
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

    return this.request.body;
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

/**
 * Create an empty body source
 */
export function createEmptyBodySource(): BodySource {
  return new EmptyBodySource();
}

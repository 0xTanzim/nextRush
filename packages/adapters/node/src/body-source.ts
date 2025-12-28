/**
 * @nextrush/adapter-node - Node.js Body Source
 *
 * BodySource implementation for Node.js IncomingMessage streams.
 *
 * @packageDocumentation
 */

import type { BodySource, BodySourceOptions } from '@nextrush/types';
import type { IncomingMessage } from 'node:http';

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
 * Node.js BodySource implementation
 *
 * @remarks
 * Reads the request body from a Node.js IncomingMessage stream.
 * Provides unified interface for body reading that works with
 * the NextRush body parser middleware.
 *
 * @example
 * ```typescript
 * import { NodeBodySource } from '@nextrush/adapter-node';
 *
 * const bodySource = new NodeBodySource(req);
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
export class NodeBodySource implements BodySource {
  private readonly req: IncomingMessage;
  private _consumed = false;
  private _cachedBuffer: Uint8Array | undefined;

  readonly contentLength: number | undefined;
  readonly contentType: string | undefined;

  private readonly options: Required<BodySourceOptions>;

  constructor(req: IncomingMessage, options: BodySourceOptions = {}) {
    this.req = req;

    // Parse content-length header
    const contentLengthHeader = req.headers['content-length'];
    this.contentLength =
      typeof contentLengthHeader === 'string'
        ? parseInt(contentLengthHeader, 10) || undefined
        : undefined;

    // Get content-type header
    const contentTypeHeader = req.headers['content-type'];
    this.contentType = Array.isArray(contentTypeHeader)
      ? contentTypeHeader[0]
      : contentTypeHeader;

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

    // Collect chunks from stream
    const chunks: Buffer[] = [];
    let totalLength = 0;

    for await (const chunk of this.req) {
      totalLength += chunk.length;

      // Check limit during streaming
      if (totalLength > this.options.limit) {
        // Destroy the stream to stop reading
        this.req.destroy();
        throw new BodyTooLargeError(this.options.limit, totalLength);
      }

      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
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

  stream(): NodeJS.ReadableStream {
    if (this._consumed) {
      throw new BodyConsumedError();
    }
    this._consumed = true;
    return this.req;
  }
}

/**
 * Create a Node.js body source from an IncomingMessage
 *
 * @param req - Node.js IncomingMessage
 * @param options - Body source options
 * @returns NodeBodySource instance
 */
export function createNodeBodySource(
  req: IncomingMessage,
  options?: BodySourceOptions
): BodySource {
  return new NodeBodySource(req, options);
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

  stream(): NodeJS.ReadableStream {
    // Return an empty readable stream
    const { Readable } = require('node:stream');
    return Readable.from([]);
  }
}

/**
 * Create an empty body source
 */
export function createEmptyBodySource(): BodySource {
  return new EmptyBodySource();
}

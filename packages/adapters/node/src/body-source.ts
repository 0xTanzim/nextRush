/**
 * @nextrush/adapter-node - Node.js Body Source
 *
 * BodySource implementation for Node.js IncomingMessage streams.
 *
 * @packageDocumentation
 */

import { BadRequestError } from '@nextrush/errors';
import { BodyConsumedError, BodyTooLargeError, RequestAbortedError } from '@nextrush/runtime';
import type { BodySource, BodySourceOptions, NodeStreamLike, WebStreamLike } from '@nextrush/types';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable, Transform } from 'node:stream';

/**
 * Default body size limit (1MB)
 */
const DEFAULT_BODY_LIMIT = 1024 * 1024;

function chunkToBuffer(raw: unknown): Buffer {
  if (Buffer.isBuffer(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    return Buffer.from(raw, 'utf8');
  }
  if (raw instanceof Uint8Array) {
    return Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength);
  }
  if (raw instanceof ArrayBuffer) {
    return Buffer.from(raw);
  }
  throw new TypeError('Unexpected body chunk type');
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
  /**
   * BP-K: the paired response, when the source is created by a `NodeContext`.
   * Used only to advise `Connection: close` when an oversized body is rejected
   * without being fully read (see {@link closeConnectionOnOversizedBody}). The
   * cross-runtime `BodySource` contract (`buffer(limit?)`) never takes a response —
   * this is a Node-adapter-internal reference, optional so direct `buffer()` use
   * and the public `createNodeBodySource` factory keep working with no response.
   */
  private readonly res?: ServerResponse;
  private _consumed = false;
  private _cachedBuffer: Uint8Array | undefined;

  readonly contentLength: number | undefined;
  readonly contentType: string | undefined;

  private readonly options: Required<BodySourceOptions>;

  constructor(req: IncomingMessage, options: BodySourceOptions = {}, res?: ServerResponse) {
    this.req = req;
    this.res = res;

    // Parse content-length header
    const contentLengthHeader = req.headers['content-length'];
    if (typeof contentLengthHeader === 'string') {
      const parsed = parseInt(contentLengthHeader, 10);
      this.contentLength = Number.isNaN(parsed) ? undefined : parsed;
    } else {
      this.contentLength = undefined;
    }

    // Get content-type header (`IncomingHttpHeaders` exposes this as a single string)
    const rawContentType = req.headers['content-type'];
    this.contentType = typeof rawContentType === 'string' ? rawContentType : undefined;

    this.options = {
      limit: options.limit ?? DEFAULT_BODY_LIMIT,
      encoding: options.encoding ?? 'utf-8',
    };
  }

  get consumed(): boolean {
    return this._consumed;
  }

  /**
   * BP-K: advise the client to close rather than reuse this connection.
   *
   * @remarks
   * Called when an oversized body is rejected without being fully read. Without
   * this, Node's keep-alive path DRAINS the remaining (already-rejected) body to
   * reuse the socket — wasting bandwidth/CPU on a request known to be over the
   * limit, and a small per-connection DoS lever. Setting `Connection: close`
   * *before* the error response is written (`writeHead` merges prior `setHeader`
   * values) makes Node flush the 413 and close, so the abandoned body is never
   * drained. No-op when there is no paired response (direct `buffer()` use / unit
   * tests) or headers are already sent.
   */
  private closeConnectionOnOversizedBody(): void {
    const res = this.res;
    if (res !== undefined && !res.headersSent) {
      res.setHeader('Connection', 'close');
    }
  }

  async buffer(limit?: number): Promise<Uint8Array> {
    // Return cached buffer if available
    if (this._consumed && this._cachedBuffer) {
      return this._cachedBuffer;
    }

    if (this._consumed) {
      throw new BodyConsumedError();
    }

    // Effective limit: the caller-supplied per-read limit takes precedence over the
    // construction-time limit (RFC 017 — BodySource limit propagation), so a parser's
    // configured limit is enforced incrementally rather than a fixed adapter default.
    const effectiveLimit = limit ?? this.options.limit;

    // Check content-length limit before reading
    if (this.contentLength !== undefined && this.contentLength > effectiveLimit) {
      // BP-K: the client will still send the declared body; close rather than let
      // Node drain it for keep-alive.
      this.closeConnectionOnOversizedBody();
      throw new BodyTooLargeError(effectiveLimit, this.contentLength);
    }

    this._consumed = true;

    const req = this.req;
    const limit_ = effectiveLimit;

    // Already-ended guard (D3): if the stream was fully consumed before buffer() was
    // called, an `end` listener would never fire and the read would hang. The
    // `for await…of` form handled this implicitly; the event form must not.
    if (req.readableEnded) {
      const empty = Buffer.concat([]);
      this._cachedBuffer = empty;
      return empty;
    }

    // Accumulate via event listeners rather than `for await…of`: this avoids the
    // async-iterator + per-chunk promise allocation of iterating an IncomingMessage,
    // while a single-settle guard (D2) and explicit cleanup preserve every observable
    // behavior — limits, error propagation, client-disconnect rejection, and no leaks.
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalLength = 0;
      let settled = false;

      const cleanup = (): void => {
        req.off('data', onData);
        req.off('end', onEnd);
        req.off('error', onError);
        req.off('close', onClose);
      };

      const settleResolve = (value: Buffer): void => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };

      const settleReject = (err: Error): void => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      };

      const onData = (rawChunk: unknown): void => {
        let chunk: Buffer;
        try {
          chunk = chunkToBuffer(rawChunk);
        } catch (err) {
          // Preserve the pre-change behavior: an unexpected chunk type rejects the read.
          settleReject(err as Error);
          req.destroy();
          return;
        }
        totalLength += chunk.length;

        // Streaming limit check on the running total (D5) — enforces the effective
        // (caller-supplied or construction-time) limit.
        if (totalLength > limit_) {
          // BP-K: reject and STOP consuming without tearing the socket down. An
          // immediate `req.destroy()` here reset the connection before the framework's
          // 413 could flush, so the client saw ECONNRESET instead of a clean 413.
          // `cleanup()` (in settleReject) detaches the data listener so no further
          // chunks accumulate (memory stays bounded near the limit); `pause()` halts
          // the stream, and `Connection: close` keeps Node from draining the abandoned
          // body for keep-alive. The response then flushes normally up the chain.
          this.closeConnectionOnOversizedBody();
          settleReject(new BodyTooLargeError(limit_, totalLength));
          req.pause();
          return;
        }

        chunks.push(chunk);
      };

      const onEnd = (): void => {
        settleResolve(Buffer.concat(chunks));
      };

      const onError = (err: Error): void => {
        settleReject(err);
      };

      const onClose = (): void => {
        // Premature close with no prior `end` (client disconnect / abort): reject so the
        // read never stays pending (D4). A normal end removes this listener first.
        // F-10: typed as a client-side condition, not a generic Error, so
        // logs/metrics don't misattribute a client disconnect as a server fault.
        settleReject(new RequestAbortedError());
      };

      req.on('data', onData);
      req.once('end', onEnd);
      req.once('error', onError);
      req.once('close', onClose);
    });

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
    } catch {
      throw new BadRequestError('Invalid JSON in request body', {
        code: 'INVALID_JSON',
      });
    }
  }

  stream(): NodeStreamLike | WebStreamLike {
    if (this._consumed) {
      throw new BodyConsumedError();
    }
    this._consumed = true;

    // Wrap with size enforcement
    const limit = this.options.limit;
    let totalBytes = 0;

    const sizeCheck = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        totalBytes += chunk.length;
        if (totalBytes > limit) {
          callback(new BodyTooLargeError(limit, totalBytes));
          return;
        }
        callback(null, chunk);
      },
    });

    return this.req.pipe(sizeCheck);
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

  stream(): NodeStreamLike | WebStreamLike {
    return Readable.from([]);
  }
}

/** Pre-allocated empty buffer — avoids allocation per request */
const EMPTY_BUFFER = new Uint8Array(0);

/** Singleton empty body source — stateless, safe to share across requests */
const EMPTY_BODY_SOURCE: BodySource = new EmptyBodySource();

/**
 * Create an empty body source (returns shared singleton)
 */
export function createEmptyBodySource(): BodySource {
  return EMPTY_BODY_SOURCE;
}

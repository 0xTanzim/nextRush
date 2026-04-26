/**
 * @nextrush/adapter-node - Context Implementation
 *
 * Node.js-specific Context implementation that wraps
 * IncomingMessage and ServerResponse.
 *
 * @packageDocumentation
 */

import { HttpError } from '@nextrush/errors';
import { getRuntime, METHODS_WITHOUT_BODY } from '@nextrush/runtime';
import type {
    BodySource,
    Context,
    ContextState,
    HttpMethod,
    IncomingHeaders,
    NodeStreamLike,
    QueryParams,
    RawHttp,
    ResponseBody,
    RouteParams,
    Runtime,
    WebStreamLike,
} from '@nextrush/types';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createEmptyBodySource, NodeBodySource } from './body-source';
import { parseQueryString } from './utils';

/**
 * Node.js-specific RawHttp type
 */
type NodeRawHttp = RawHttp<IncomingMessage, ServerResponse>;

/**
 * Options for NodeContext construction
 */
export interface NodeContextOptions {
  /**
   * Whether to trust proxy headers (X-Forwarded-For, X-Forwarded-Proto, etc.)
   * When false, IP is always read from the socket.
   * @default false
   */
  trustProxy?: boolean;
}

/** Shared empty params object — avoids allocation per request (overwritten by router) */
const EMPTY_PARAMS: RouteParams = Object.freeze(Object.create(null)) as RouteParams;

/**
 * Node.js Context implementation
 */
export class NodeContext implements Context {
  readonly method: HttpMethod;
  readonly url: string;
  readonly path: string;
  readonly query: QueryParams;
  readonly headers: IncomingHeaders;
  readonly ip: string;
  readonly raw: NodeRawHttp;
  readonly runtime: Runtime;
  readonly bodySource: BodySource;

  body: unknown = undefined;
  params: RouteParams = EMPTY_PARAMS;
  status = 200;
  state: ContextState = {};

  private _next: (() => Promise<void>) | null = null;
  private _responded = false;

  constructor(req: IncomingMessage, res: ServerResponse, options: NodeContextOptions = {}) {
    this.raw = { req, res };
    this.runtime = getRuntime();
    this.method = (req.method?.toUpperCase() ?? 'GET') as HttpMethod;
    this.url = req.url ?? '/';

    // Parse URL and query string
    const questionIndex = this.url.indexOf('?');
    if (questionIndex !== -1) {
      this.path = this.url.slice(0, questionIndex);
      this.query = parseQueryString(this.url.slice(questionIndex + 1));
    } else {
      this.path = this.url;
      this.query = {};
    }

    this.headers = req.headers as IncomingHeaders;
    this.ip = this.getClientIp(req, options.trustProxy ?? false);

    // Create body source (empty for methods without body)
    this.bodySource = METHODS_WITHOUT_BODY.has(this.method)
      ? createEmptyBodySource()
      : new NodeBodySource(req);
  }

  /**
   * Get client IP address.
   * Only trusts X-Forwarded-For when trustProxy is explicitly enabled.
   */
  private getClientIp(req: IncomingMessage, trustProxy: boolean): string {
    if (trustProxy) {
      const forwarded = req.headers['x-forwarded-for'];
      if (typeof forwarded === 'string') {
        const firstIp = forwarded.split(',')[0]?.trim() ?? '';
        // Basic IP format validation: reject clearly malformed values
        if (firstIp && /^[\da-fA-F.:]+$/.test(firstIp)) {
          return firstIp;
        }
        // Malformed X-Forwarded-For — fall through to socket address
      }
    }

    // Fall back to socket remote address
    return req.socket.remoteAddress ?? '';
  }

  /**
   * Set the next function for middleware chaining
   * @internal
   */
  setNext(fn: () => Promise<void>): void {
    this._next = fn;
  }

  // ===========================================================================
  // Response Methods
  // ===========================================================================

  /**
   * Whether the response should suppress the body per HTTP semantics.
   * HEAD requests, 204 No Content, and 304 Not Modified must not include a body (RFC 7231).
   */
  private shouldSuppressBody(): boolean {
    return (
      this.method === 'HEAD' ||
      this.status === 204 ||
      this.status === 304 ||
      (this.status >= 100 && this.status < 200)
    );
  }

  json(data: unknown): void {
    if (this._responded || this.raw.res.headersSent) return;
    this._responded = true;

    const res = this.raw.res;
    const json = JSON.stringify(data);

    res.statusCode = this.status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(json));

    if (this.shouldSuppressBody()) {
      res.end();
    } else {
      res.end(json);
    }
  }

  send(data: ResponseBody): void {
    if (this._responded || this.raw.res.headersSent) return;

    const res = this.raw.res;
    res.statusCode = this.status;
    const suppress = this.shouldSuppressBody();

    if (data === null || data === undefined) {
      this._responded = true;
      res.end();
      return;
    }

    if (typeof data === 'string') {
      this._responded = true;
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      }
      res.setHeader('Content-Length', Buffer.byteLength(data));
      res.end(suppress ? undefined : data);
      return;
    }

    if (Buffer.isBuffer(data)) {
      this._responded = true;
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
      res.setHeader('Content-Length', data.length);
      res.end(suppress ? undefined : data);
      return;
    }

    // Uint8Array (non-Buffer) — convert to Buffer for Node.js response
    if (data instanceof Uint8Array) {
      this._responded = true;
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
      const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
      res.setHeader('Content-Length', buf.length);
      res.end(suppress ? undefined : buf);
      return;
    }

    // ArrayBuffer — wrap as Buffer
    if (data instanceof ArrayBuffer) {
      this._responded = true;
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
      const buf = Buffer.from(data);
      res.setHeader('Content-Length', buf.length);
      res.end(suppress ? undefined : buf);
      return;
    }

    // Readable stream (Node.js style)
    if (typeof (data as NodeStreamLike).pipe === 'function') {
      this._responded = true;
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
      const stream = data as {
        pipe(dest: ServerResponse): void;
        on(event: string, listener: (err: Error) => void): void;
        destroy?(err?: Error): void;
      };
      stream.on('error', (err: Error) => {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        } else {
          res.destroy(err);
        }
      });
      // Clean up source stream on client disconnect
      res.on('close', () => {
        if (stream.destroy) stream.destroy();
      });
      stream.pipe(res);
      return;
    }

    // Web ReadableStream — convert to Node.js pipeline
    if (
      typeof (data as WebStreamLike).getReader === 'function' &&
      'locked' in (data as WebStreamLike)
    ) {
      this._responded = true;
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
      const reader = (data as ReadableStream<Uint8Array>).getReader();
      // Clean up reader on client disconnect
      res.on('close', () => {
        void reader.cancel().catch((): undefined => undefined);
      });
      const pump = async (): Promise<void> => {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            return;
          }
          if (!res.write(value)) {
            await new Promise<void>((resolve) => res.once('drain', resolve));
          }
        }
      };
      pump().catch((err: unknown) => {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        } else {
          res.destroy(err instanceof Error ? err : new Error(String(err)));
        }
      });
      return;
    }

    // Object - delegate to json() which manages its own _responded flag
    if (typeof data === 'object') {
      this.json(data);
      return;
    }

    // Default: convert to string
    this._responded = true;
    const str = String(data);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(str));
    res.end(str);
  }

  html(content: string): void {
    if (this._responded || this.raw.res.headersSent) return;
    this._responded = true;

    const res = this.raw.res;
    res.statusCode = this.status;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(content));

    if (this.shouldSuppressBody()) {
      res.end();
    } else {
      res.end(content);
    }
  }

  redirect(url: string, status = 302): void {
    if (this._responded || this.raw.res.headersSent) return;
    this._responded = true;

    const res = this.raw.res;
    res.statusCode = status;
    res.setHeader('Location', url);
    // Use plain text to avoid HTML injection via user-controlled URLs
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(`Redirecting to ${url}`);
  }

  // ===========================================================================
  // Header Helpers
  // ===========================================================================

  set(field: string, value: string | number | string[]): void {
    // Validate for CRLF injection (header splitting attack)
    if (field.includes('\r') || field.includes('\n')) {
      throw new Error('Header field contains invalid characters');
    }
    if (typeof value === 'string') {
      if (value.includes('\r') || value.includes('\n')) {
        throw new Error('Header value contains invalid characters');
      }
    } else if (Array.isArray(value)) {
      for (const v of value) {
        if (v.includes('\r') || v.includes('\n')) {
          throw new Error('Header value contains invalid characters');
        }
      }
    }
    this.raw.res.setHeader(field, value);
  }

  get(field: string): string | undefined {
    const value = this.headers[field.toLowerCase()];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }

  // ===========================================================================
  // Middleware
  // ===========================================================================

  async next(): Promise<void> {
    if (this._next) {
      await this._next();
    }
  }

  // ===========================================================================
  // Error Helpers
  // ===========================================================================

  /**
   * Throw an HTTP error
   */
  throw(status: number, message?: string): never {
    throw new HttpError(status, message);
  }

  /**
   * Assert a condition, throw if falsy
   */
  assert(condition: unknown, status: number, message?: string): asserts condition {
    if (!condition) {
      throw new HttpError(status, message);
    }
  }

  /**
   * Check if response has been sent
   */
  get responded(): boolean {
    return this._responded;
  }

  /**
   * Mark response as sent (for streaming scenarios)
   */
  markResponded(): void {
    this._responded = true;
  }
}

/**
 * Create a new NodeContext
 */
export function createNodeContext(
  req: IncomingMessage,
  res: ServerResponse,
  options?: NodeContextOptions
): NodeContext {
  return new NodeContext(req, res, options);
}

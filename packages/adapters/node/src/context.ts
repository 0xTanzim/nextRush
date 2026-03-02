/**
 * @nextrush/adapter-node - Context Implementation
 *
 * Node.js-specific Context implementation that wraps
 * IncomingMessage and ServerResponse.
 *
 * @packageDocumentation
 */

import { HttpError } from '@nextrush/errors';
import { getRuntime } from '@nextrush/runtime';
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

/**
 * HTTP methods that typically don't have a body
 */
const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD', 'OPTIONS']);

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
  status: number = 200;
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
        const firstIp = forwarded.split(',')[0];
        return firstIp?.trim() ?? '';
      }
    }

    // Fall back to socket remote address
    return req.socket?.remoteAddress ?? '';
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

  json(data: unknown): void {
    if (this._responded || this.raw.res.headersSent) return;
    this._responded = true;

    const res = this.raw.res;
    const json = JSON.stringify(data);

    res.statusCode = this.status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(json));
    res.end(json);
  }

  send(data: ResponseBody): void {
    if (this._responded || this.raw.res.headersSent) return;

    const res = this.raw.res;
    res.statusCode = this.status;

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
      res.end(data);
      return;
    }

    if (Buffer.isBuffer(data)) {
      this._responded = true;
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
      res.setHeader('Content-Length', data.length);
      res.end(data);
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
      res.end(buf);
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
      res.end(buf);
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
      pump().catch((err: Error) => {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        } else {
          res.destroy(err);
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
    res.end(content);
  }

  redirect(url: string, status: number = 302): void {
    if (this._responded || this.raw.res.headersSent) return;
    this._responded = true;

    const res = this.raw.res;
    res.statusCode = status;
    res.setHeader('Location', url);
    // Provide a minimal body for clients that don't follow redirects
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`Redirecting to <a href="${encodeURI(url)}">${encodeURI(url)}</a>`);
  }

  // ===========================================================================
  // Header Helpers
  // ===========================================================================

  set(field: string, value: string | number): void {
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

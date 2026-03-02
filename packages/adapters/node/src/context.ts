/**
 * @nextrush/adapter-node - Context Implementation
 *
 * Node.js-specific Context implementation that wraps
 * IncomingMessage and ServerResponse.
 *
 * @packageDocumentation
 */

import { getRuntime } from '@nextrush/runtime';
import type {
  BodySource,
  Context,
  ContextState,
  HttpMethod,
  IncomingHeaders,
  QueryParams,
  RawHttp,
  ResponseBody,
  RouteParams,
  Runtime,
} from '@nextrush/types';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createEmptyBodySource, NodeBodySource } from './body-source';
import { parseQueryString } from './utils';

/**
 * HTTP error class for ctx.throw()
 */
export class HttpError extends Error {
  readonly status: number;
  readonly expose: boolean;

  constructor(status: number, message?: string) {
    const defaultMessages: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      405: 'Method Not Allowed',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    };

    super(message ?? defaultMessages[status] ?? 'Unknown Error');
    this.name = 'HttpError';
    this.status = status;
    this.expose = status < 500;
    Error.captureStackTrace(this, this.constructor);
  }
}

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
const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD', 'OPTIONS', 'DELETE']);

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
  params: RouteParams = {};
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
    if (this._responded) return;
    this._responded = true;

    const res = this.raw.res;
    const json = JSON.stringify(data);

    res.statusCode = this.status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(json));
    res.end(json);
  }

  send(data: ResponseBody): void {
    if (this._responded) return;

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

    // Readable stream
    if (typeof (data as NodeJS.ReadableStream).pipe === 'function') {
      this._responded = true;
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
      (data as NodeJS.ReadableStream).pipe(res);
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
    if (this._responded) return;
    this._responded = true;

    const res = this.raw.res;
    res.statusCode = this.status;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(content));
    res.end(content);
  }

  redirect(url: string, status: number = 302): void {
    if (this._responded) return;
    this._responded = true;

    const res = this.raw.res;
    res.statusCode = status;
    res.setHeader('Location', url);
    res.end();
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

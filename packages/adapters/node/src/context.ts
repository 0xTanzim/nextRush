/**
 * @nextrush/adapter-node - Context Implementation
 *
 * Node.js-specific Context implementation that wraps
 * IncomingMessage and ServerResponse.
 *
 * @packageDocumentation
 */

import type {
  Context,
  ContextState,
  HttpMethod,
  IncomingHeaders,
  QueryParams,
  RawHttp,
  ResponseBody,
  RouteParams,
} from '@nextrush/types';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseQueryString } from './utils';

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
  readonly raw: RawHttp;

  body: unknown = undefined;
  params: RouteParams = {};
  status: number = 200;
  state: ContextState = {};

  private _next: (() => Promise<void>) | null = null;
  private _responded = false;

  constructor(req: IncomingMessage, res: ServerResponse) {
    this.raw = { req, res };
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
    this.ip = this.getClientIp(req);
  }

  /**
   * Get client IP address
   */
  private getClientIp(req: IncomingMessage): string {
    // Check X-Forwarded-For header (when behind proxy)
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      const firstIp = forwarded.split(',')[0];
      return firstIp?.trim() ?? '';
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

    const body = JSON.stringify(data);
    const res = this.raw.res;

    res.statusCode = this.status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(body));
    res.end(body);
  }

  send(data: ResponseBody): void {
    if (this._responded) return;
    this._responded = true;

    const res = this.raw.res;
    res.statusCode = this.status;

    if (data === null || data === undefined) {
      res.end();
      return;
    }

    if (typeof data === 'string') {
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      }
      res.setHeader('Content-Length', Buffer.byteLength(data));
      res.end(data);
      return;
    }

    if (Buffer.isBuffer(data)) {
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
      res.setHeader('Content-Length', data.length);
      res.end(data);
      return;
    }

    // Readable stream
    if (typeof (data as NodeJS.ReadableStream).pipe === 'function') {
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
      (data as NodeJS.ReadableStream).pipe(res);
      return;
    }

    // Object - serialize as JSON
    if (typeof data === 'object') {
      this.json(data);
      return;
    }

    // Default: convert to string
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
export function createNodeContext(req: IncomingMessage, res: ServerResponse): NodeContext {
  return new NodeContext(req, res);
}

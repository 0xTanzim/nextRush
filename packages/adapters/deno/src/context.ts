/**
 * @nextrush/adapter-deno - Context Implementation
 *
 * Deno-specific Context implementation using Web Request/Response APIs.
 *
 * @packageDocumentation
 */

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
import { createEmptyBodySource, DenoBodySource } from './body-source';
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
  }
}

/**
 * Deno-specific RawHttp type
 *
 * @remarks
 * - `req`: The incoming Web Request object
 * - `res`: Not used in Deno (response is returned from handler)
 */
type DenoRawHttp = RawHttp<Request, undefined>;

/**
 * HTTP methods that typically don't have a body
 */
const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD', 'OPTIONS', 'DELETE']);

/**
 * Response builder for Deno context
 */
interface ResponseBuilder {
  status: number;
  headers: Headers;
  body: BodyInit | null;
}

/**
 * Deno Context implementation
 *
 * @remarks
 * Uses Deno's native Web Request/Response APIs following web standards.
 * The response is built internally and returned via `getResponse()`.
 *
 * @example
 * ```typescript
 * const ctx = new DenoContext(request);
 *
 * // Handle request
 * ctx.json({ message: 'Hello from Deno!' });
 *
 * // Get the response to return
 * const response = ctx.getResponse();
 * ```
 */
export class DenoContext implements Context {
  readonly method: HttpMethod;
  readonly url: string;
  readonly path: string;
  readonly query: QueryParams;
  readonly headers: IncomingHeaders;
  readonly ip: string;
  readonly raw: DenoRawHttp;
  readonly runtime: Runtime = 'deno';
  readonly bodySource: BodySource;

  body: unknown = undefined;
  params: RouteParams = {};
  status: number = 200;
  state: ContextState = {};

  private _next: (() => Promise<void>) | null = null;
  private _responded = false;
  private _responseBuilder: ResponseBuilder;

  constructor(request: Request, connInfo?: { remoteAddr?: { hostname: string } }) {
    this.raw = { req: request, res: undefined };
    this.method = request.method.toUpperCase() as HttpMethod;

    // Parse URL
    const urlObj = new URL(request.url);
    this.url = urlObj.pathname + urlObj.search;
    this.path = urlObj.pathname;
    this.query = parseQueryString(urlObj.search.slice(1));

    // Convert Headers to record format
    this.headers = this.headersToRecord(request.headers);

    // Get client IP from connection info or headers
    this.ip = connInfo?.remoteAddr?.hostname ?? this.getClientIp(request);

    // Create body source
    this.bodySource = METHODS_WITHOUT_BODY.has(this.method)
      ? createEmptyBodySource()
      : new DenoBodySource(request);

    // Initialize response builder
    this._responseBuilder = {
      status: 200,
      headers: new Headers(),
      body: null,
    };
  }

  /**
   * Convert Headers object to record format
   */
  private headersToRecord(headers: Headers): IncomingHeaders {
    const record: Record<string, string | string[]> = {};

    headers.forEach((value, key) => {
      const existing = record[key];
      if (existing !== undefined) {
        if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          record[key] = [existing, value];
        }
      } else {
        record[key] = value;
      }
    });

    return record;
  }

  /**
   * Get client IP address from headers
   */
  private getClientIp(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      const firstIp = forwarded.split(',')[0];
      return firstIp?.trim() ?? '';
    }

    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
      return realIp.trim();
    }

    return '';
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

    this._responseBuilder.status = this.status;
    this._responseBuilder.headers.set('Content-Type', 'application/json; charset=utf-8');
    this._responseBuilder.headers.set('Content-Length', String(new TextEncoder().encode(body).length));
    this._responseBuilder.body = body;
  }

  send(data: ResponseBody): void {
    if (this._responded) return;
    this._responded = true;

    this._responseBuilder.status = this.status;

    if (data === null || data === undefined) {
      this._responseBuilder.body = null;
      return;
    }

    if (typeof data === 'string') {
      if (!this._responseBuilder.headers.has('Content-Type')) {
        this._responseBuilder.headers.set('Content-Type', 'text/plain; charset=utf-8');
      }
      this._responseBuilder.headers.set('Content-Length', String(new TextEncoder().encode(data).length));
      this._responseBuilder.body = data;
      return;
    }

    if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
      const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      if (!this._responseBuilder.headers.has('Content-Type')) {
        this._responseBuilder.headers.set('Content-Type', 'application/octet-stream');
      }
      this._responseBuilder.headers.set('Content-Length', String(bytes.length));
      // Cast to BodyInit - Uint8Array is valid in Web APIs
      this._responseBuilder.body = bytes as unknown as BodyInit;
      return;
    }

    // ReadableStream
    if (data instanceof ReadableStream) {
      if (!this._responseBuilder.headers.has('Content-Type')) {
        this._responseBuilder.headers.set('Content-Type', 'application/octet-stream');
      }
      this._responseBuilder.body = data as ReadableStream<Uint8Array>;
      return;
    }

    // Object - serialize as JSON
    if (typeof data === 'object') {
      this._responded = false;
      this.json(data);
      return;
    }

    // Default: convert to string
    const str = String(data);
    this._responseBuilder.headers.set('Content-Type', 'text/plain; charset=utf-8');
    this._responseBuilder.headers.set('Content-Length', String(new TextEncoder().encode(str).length));
    this._responseBuilder.body = str;
  }

  html(content: string): void {
    if (this._responded) return;
    this._responded = true;

    this._responseBuilder.status = this.status;
    this._responseBuilder.headers.set('Content-Type', 'text/html; charset=utf-8');
    this._responseBuilder.headers.set('Content-Length', String(new TextEncoder().encode(content).length));
    this._responseBuilder.body = content;
  }

  redirect(url: string, status: number = 302): void {
    if (this._responded) return;
    this._responded = true;

    this._responseBuilder.status = status;
    this._responseBuilder.headers.set('Location', url);
    this._responseBuilder.body = null;
  }

  // ===========================================================================
  // Header Helpers
  // ===========================================================================

  set(field: string, value: string | number): void {
    this._responseBuilder.headers.set(field, String(value));
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

  throw(status: number, message?: string): never {
    throw new HttpError(status, message);
  }

  assert(condition: unknown, status: number, message?: string): asserts condition {
    if (!condition) {
      throw new HttpError(status, message);
    }
  }

  // ===========================================================================
  // Response Building
  // ===========================================================================

  get responded(): boolean {
    return this._responded;
  }

  markResponded(): void {
    this._responded = true;
  }

  /**
   * Get the built Response object
   */
  getResponse(): Response {
    this._responseBuilder.status = this.status;

    return new Response(this._responseBuilder.body, {
      status: this._responseBuilder.status,
      headers: this._responseBuilder.headers,
    });
  }
}

/**
 * Create a new DenoContext
 */
export function createDenoContext(
  request: Request,
  connInfo?: { remoteAddr?: { hostname: string } }
): DenoContext {
  return new DenoContext(request, connInfo);
}

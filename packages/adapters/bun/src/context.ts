/**
 * @nextrush/adapter-bun - Context Implementation
 *
 * Bun-specific Context implementation using Web Request/Response APIs.
 *
 * @packageDocumentation
 */

import { HttpError } from '@nextrush/errors';
import { getClientIp, getRuntime, headersToRecord, METHODS_WITHOUT_BODY } from '@nextrush/runtime';
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
import { BunBodySource, createEmptyBodySource } from './body-source';
import { parseQueryString } from './utils';

/** Shared encoder — avoids per-call allocation in response methods */
const TEXT_ENCODER = new TextEncoder();

/**
 * Bun-specific RawHttp type
 *
 * @remarks
 * - `req`: The incoming Web Request object
 * - `res`: Not used in Bun (response is returned from handler)
 */
type BunRawHttp = RawHttp<Request, undefined>;

/**
 * Response builder for Bun context
 */
interface ResponseBuilder {
  status: number;
  headers: Headers;
  body: BodyInit | null;
}

/**
 * Bun Context implementation
 *
 * @remarks
 * Uses Bun's native Web Request/Response APIs for optimal performance.
 * The response is built internally and returned via `getResponse()`.
 *
 * @example
 * ```typescript
 * const ctx = new BunContext(request);
 *
 * // Handle request
 * ctx.json({ message: 'Hello from Bun!' });
 *
 * // Get the response to return
 * const response = ctx.getResponse();
 * ```
 */
/** Shared empty params object — avoids allocation per request (overwritten by router) */
const EMPTY_PARAMS: RouteParams = Object.freeze(Object.create(null)) as RouteParams;

export class BunContext implements Context {
  readonly method: HttpMethod;
  readonly url: string;
  readonly path: string;
  readonly query: QueryParams;
  readonly headers: IncomingHeaders;
  readonly ip: string;
  readonly raw: BunRawHttp;
  readonly runtime: Runtime;
  readonly bodySource: BodySource;

  body: unknown = undefined;
  params: RouteParams = EMPTY_PARAMS;
  status = 200;
  state: ContextState = {};

  private _next: (() => Promise<void>) | null = null;
  private _responded = false;
  private _responseBuilder: ResponseBuilder;

  constructor(request: Request, clientIp?: string, trustProxy = false) {
    this.raw = { req: request, res: undefined };
    this.method = request.method.toUpperCase() as HttpMethod;
    this.runtime = getRuntime();

    // Parse URL
    const urlObj = new URL(request.url);
    this.url = urlObj.pathname + urlObj.search;
    this.path = urlObj.pathname;
    this.query = parseQueryString(urlObj.search.slice(1));

    // Convert Headers to record format
    this.headers = headersToRecord(request.headers);

    // Get client IP (Bun provides this via server.requestIP)
    this.ip = clientIp
      ? trustProxy
        ? getClientIp(request, clientIp, true)
        : clientIp
      : getClientIp(request, '', trustProxy);

    // Create body source
    this.bodySource = METHODS_WITHOUT_BODY.has(this.method)
      ? createEmptyBodySource()
      : new BunBodySource(request);

    // Initialize response builder
    this._responseBuilder = {
      status: 200,
      headers: new Headers(),
      body: null,
    };
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
    this._responseBuilder.headers.set('Content-Length', String(TEXT_ENCODER.encode(body).length));
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
      this._responseBuilder.headers.set('Content-Length', String(TEXT_ENCODER.encode(data).length));
      this._responseBuilder.body = data;
      return;
    }

    if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
      const bytes =
        data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
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
      this._responseBuilder.body = data;
      return;
    }

    // Object - serialize as JSON (inline to avoid _responded reset hack)
    if (typeof data === 'object') {
      const json = JSON.stringify(data);
      this._responseBuilder.headers.set('Content-Type', 'application/json; charset=utf-8');
      this._responseBuilder.headers.set('Content-Length', String(TEXT_ENCODER.encode(json).length));
      this._responseBuilder.body = json;
      return;
    }

    // Default: convert to string
    const str = String(data);
    this._responseBuilder.headers.set('Content-Type', 'text/plain; charset=utf-8');
    this._responseBuilder.headers.set('Content-Length', String(TEXT_ENCODER.encode(str).length));
    this._responseBuilder.body = str;
  }

  html(content: string): void {
    if (this._responded) return;
    this._responded = true;

    this._responseBuilder.status = this.status;
    this._responseBuilder.headers.set('Content-Type', 'text/html; charset=utf-8');
    this._responseBuilder.headers.set(
      'Content-Length',
      String(TEXT_ENCODER.encode(content).length)
    );
    this._responseBuilder.body = content;
  }

  redirect(url: string, status = 302): void {
    if (this._responded) return;
    this._responded = true;

    this._responseBuilder.status = status;
    this._responseBuilder.headers.set('Location', url);
    // Use plain text to avoid HTML injection via user-controlled URLs
    this._responseBuilder.headers.set('Content-Type', 'text/plain; charset=utf-8');
    this._responseBuilder.body = `Redirecting to ${url}`;
  }

  // ===========================================================================
  // Header Helpers
  // ===========================================================================

  set(field: string, value: string | number | string[]): void {
    // Validate for CRLF injection (header splitting attack)
    if (field.includes('\r') || field.includes('\n')) {
      throw new Error('Header field contains invalid characters');
    }
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v.includes('\r') || v.includes('\n')) {
          throw new Error('Header value contains invalid characters');
        }
      }
      this._responseBuilder.headers.delete(field);
      for (const v of value) {
        this._responseBuilder.headers.append(field, v);
      }
    } else if (typeof value === 'string') {
      if (value.includes('\r') || value.includes('\n')) {
        throw new Error('Header value contains invalid characters');
      }
      if (field.toLowerCase() === 'set-cookie') {
        this._responseBuilder.headers.append(field, value);
      } else {
        this._responseBuilder.headers.set(field, value);
      }
    } else {
      if (field.toLowerCase() === 'set-cookie') {
        this._responseBuilder.headers.append(field, String(value));
      } else {
        this._responseBuilder.headers.set(field, String(value));
      }
    }
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

  /**
   * Check if response has been sent
   */
  get responded(): boolean {
    return this._responded;
  }

  /**
   * Mark response as sent
   */
  markResponded(): void {
    this._responded = true;
  }

  /**
   * Get the built Response object
   *
   * @returns Web API Response object
   */
  getResponse(): Response {
    // Only sync status from context if response builder hasn't set a specific status
    // (e.g., redirect sets its own status)
    if (!this._responded) {
      this._responseBuilder.status = this.status;
    }

    const status = this._responseBuilder.status;
    // Suppress body for HEAD, 204, 304, and 1xx per HTTP semantics
    const suppressBody =
      this.method === 'HEAD' || status === 204 || status === 304 || (status >= 100 && status < 200);

    return new Response(suppressBody ? null : this._responseBuilder.body, {
      status,
      headers: this._responseBuilder.headers,
    });
  }
}

/**
 * Create a new BunContext
 *
 * @param request - Web API Request object
 * @param clientIp - Optional client IP address
 * @returns BunContext instance
 */
export function createBunContext(
  request: Request,
  clientIp?: string,
  trustProxy = false
): BunContext {
  return new BunContext(request, clientIp, trustProxy);
}

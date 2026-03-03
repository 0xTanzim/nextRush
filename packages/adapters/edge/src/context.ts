/**
 * @nextrush/adapter-edge - Context Implementation
 *
 * Edge-specific Context implementation for Cloudflare Workers, Vercel Edge, etc.
 *
 * @packageDocumentation
 */

import { HttpError } from '@nextrush/errors';
import {
  detectEdgeRuntime,
  getEdgeClientIp,
  headersToRecord,
  METHODS_WITHOUT_BODY,
  parseQueryString,
} from '@nextrush/runtime';
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
import { createEmptyBodySource, EdgeBodySource } from './body-source';

/**
 * Edge-specific RawHttp type
 */
type EdgeRawHttp = RawHttp<Request, undefined>;

/**
 * Response builder for Edge context
 */
interface ResponseBuilder {
  status: number;
  headers: Headers;
  body: BodyInit | null;
}

/**
 * Edge execution context interface
 *
 * @remarks
 * Provides access to edge-specific features like `waitUntil` and `passThroughOnException`.
 */
export interface EdgeExecutionContext {
  /** Extend request lifetime for async operations */
  waitUntil(promise: Promise<unknown>): void;

  /** Pass through to origin on exception */
  passThroughOnException?(): void;
}

/**
 * Edge Context implementation
 *
 * @remarks
 * Works with any edge runtime that implements the Web Fetch API:
 * - Cloudflare Workers
 * - Vercel Edge Functions
 * - Netlify Edge Functions
 *
 * @example
 * ```typescript
 * const ctx = new EdgeContext(request);
 *
 * // Handle request
 * ctx.json({ message: 'Hello from Edge!' });
 *
 * // Get the response to return
 * const response = ctx.getResponse();
 * ```
 */
/** Shared empty params object — avoids allocation per request (overwritten by router) */
const EMPTY_PARAMS: RouteParams = Object.freeze(Object.create(null)) as RouteParams;

export class EdgeContext implements Context {
  readonly method: HttpMethod;
  readonly url: string;
  readonly path: string;
  readonly query: QueryParams;
  readonly headers: IncomingHeaders;
  readonly ip: string;
  readonly raw: EdgeRawHttp;
  readonly runtime: Runtime;
  readonly bodySource: BodySource;

  /** Edge execution context (for waitUntil, etc.) */
  readonly executionContext?: EdgeExecutionContext;

  body: unknown = undefined;
  params: RouteParams = EMPTY_PARAMS;
  status: number = 200;
  state: ContextState = {};

  private _next: (() => Promise<void>) | null = null;
  private _responded = false;
  private _responseBuilder: ResponseBuilder;

  constructor(request: Request, executionContext?: EdgeExecutionContext, trustProxy = false) {
    this.raw = { req: request, res: undefined };
    this.method = request.method.toUpperCase() as HttpMethod;
    this.executionContext = executionContext;

    // Detect specific edge runtime
    this.runtime = detectEdgeRuntime().runtime;

    // Parse URL
    const urlObj = new URL(request.url);
    this.url = urlObj.pathname + urlObj.search;
    this.path = urlObj.pathname;
    this.query = parseQueryString(urlObj.search.slice(1));

    // Convert Headers to record format
    this.headers = headersToRecord(request.headers);

    // Get client IP from CF headers or standard headers
    this.ip = getEdgeClientIp(request, trustProxy);

    // Create body source
    this.bodySource = METHODS_WITHOUT_BODY.has(this.method)
      ? createEmptyBodySource()
      : new EdgeBodySource(request);

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
    this._responseBuilder.headers.set(
      'Content-Length',
      String(new TextEncoder().encode(body).length)
    );
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
      this._responseBuilder.headers.set(
        'Content-Length',
        String(new TextEncoder().encode(data).length)
      );
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
      this._responseBuilder.headers.set(
        'Content-Length',
        String(new TextEncoder().encode(json).length)
      );
      this._responseBuilder.body = json;
      return;
    }

    const str = String(data);
    this._responseBuilder.headers.set('Content-Type', 'text/plain; charset=utf-8');
    this._responseBuilder.headers.set(
      'Content-Length',
      String(new TextEncoder().encode(str).length)
    );
    this._responseBuilder.body = str;
  }

  html(content: string): void {
    if (this._responded) return;
    this._responded = true;

    this._responseBuilder.status = this.status;
    this._responseBuilder.headers.set('Content-Type', 'text/html; charset=utf-8');
    this._responseBuilder.headers.set(
      'Content-Length',
      String(new TextEncoder().encode(content).length)
    );
    this._responseBuilder.body = content;
  }

  redirect(url: string, status: number = 302): void {
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
    if (Array.isArray(value)) {
      this._responseBuilder.headers.delete(field);
      for (const v of value) {
        this._responseBuilder.headers.append(field, v);
      }
    } else {
      this._responseBuilder.headers.set(field, String(value));
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
  // Edge-Specific Methods
  // ===========================================================================

  /**
   * Extend request lifetime for async operations
   *
   * @remarks
   * Use this for fire-and-forget operations that should complete
   * after the response is sent (logging, analytics, etc.)
   */
  waitUntil(promise: Promise<unknown>): void {
    if (this.executionContext?.waitUntil) {
      this.executionContext.waitUntil(promise);
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
 * Create a new EdgeContext
 */
export function createEdgeContext(
  request: Request,
  executionContext?: EdgeExecutionContext
): EdgeContext {
  return new EdgeContext(request, executionContext);
}

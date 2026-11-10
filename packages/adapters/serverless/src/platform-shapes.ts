/**
 * @nextrush/adapter-serverless - Platform shapes (RFC-027).
 *
 * Structural (duck-typed) interfaces for the real GCF/Azure SDK request and
 * response objects. Declared here, not imported from
 * `@google-cloud/functions-framework` / `@azure/functions`, so the package
 * stays at zero runtime/peer dependencies (project-rules §6) — TypeScript's
 * structural assignability makes the real SDK types satisfy these without a
 * nominal relationship.
 *
 * @packageDocumentation
 */

/**
 * The subset of functions-framework's Express-style request this adapter
 * reads. A real `functions.Request` is structurally assignable to this.
 */
export interface GcfHttpRequest {
  readonly method: string;
  readonly path?: string;
  readonly originalUrl?: string;
  readonly url?: string;
  readonly query?: Record<string, string | string[] | undefined>;
  readonly headers: Record<string, string | string[] | undefined>;
  /** functions-framework's unparsed body buffer. Preferred over `body`. */
  readonly rawBody?: Uint8Array;
  /** functions-framework's parsed body (used only as a text fallback). */
  readonly body?: unknown;
}

/** The subset of the Express-style response this adapter writes. */
export interface GcfHttpResponse {
  status(code: number): unknown;
  setHeader(name: string, value: string | readonly string[]): unknown;
  send(body: string | Uint8Array): unknown;
  readonly headersSent?: boolean;
}

/** The subset of Azure Functions v4 `HttpRequest` this adapter reads. */
export interface AzureHttpRequestLike {
  readonly method: string;
  readonly url: string;
  readonly headers: Iterable<[string, string]>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** An Azure Functions v4 structured response cookie. */
export interface AzureCookieLike {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: Date;
  maxAge?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/** Azure v4 `HttpResponseInit`-assignable result this adapter returns. */
export interface AzureHttpResponseLike {
  status: number;
  headers?: Record<string, string>;
  cookies?: readonly AzureCookieLike[];
  body?: string | Uint8Array;
}

/**
 * The subset of Node.js / Vercel Serverless HTTP request this adapter reads.
 * A real `http.IncomingMessage` or `@vercel/node`'s `VercelRequest` is structurally assignable to this.
 */
export interface VercelIncomingMessageLike {
  readonly method?: string;
  readonly url?: string;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly signal?: AbortSignal;
  [Symbol.asyncIterator]?(): AsyncIterableIterator<Uint8Array | Buffer | string>;
  readonly body?: unknown;
  readonly rawBody?: unknown;
}

/**
 * The subset of Node.js / Vercel Serverless HTTP response this adapter writes.
 * A real `http.ServerResponse` or `@vercel/node`'s `VercelResponse` is structurally assignable to this.
 */
export interface VercelServerResponseLike {
  statusCode: number;
  statusMessage?: string;
  readonly headersSent?: boolean;
  readonly writableEnded?: boolean;
  readonly destroyed?: boolean;
  setHeader(name: string, value: string | readonly string[]): unknown;
  write(chunk: unknown): unknown;
  end(chunk?: unknown): unknown;
  once?(event: string, listener: (...args: unknown[]) => void): unknown;
}


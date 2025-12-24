/**
 * @nextrush/types - Context Type Definitions
 *
 * The Context object is the heart of NextRush's request/response handling.
 * It provides a unified interface for accessing request data and sending responses.
 *
 * Design Philosophy:
 * - ctx.body = request body (INPUT)
 * - ctx.json() = send JSON response (OUTPUT)
 * - ctx.next() = call next middleware
 *
 * @packageDocumentation
 */

import type { HttpMethod, IncomingHeaders, RawHttp, ResponseBody } from './http';

// ============================================================================
// Route Parameters
// ============================================================================

/**
 * Route parameters extracted from URL path
 * Example: /users/:id -> { id: '123' }
 */
export type RouteParams = Record<string, string>;

/**
 * Query string parameters
 * Example: ?page=1&limit=10 -> { page: '1', limit: '10' }
 */
export type QueryParams = Record<string, string | string[] | undefined>;

// ============================================================================
// Request State
// ============================================================================

/**
 * Request-scoped state object
 * Use this to pass data between middleware
 */
export type ContextState = Record<string, unknown>;

// ============================================================================
// Context Interface
// ============================================================================

/**
 * The Context interface - core of NextRush request handling
 *
 * @example
 * ```typescript
 * app.get('/users/:id', async (ctx) => {
 *   // Request data (input)
 *   const { id } = ctx.params;
 *   const { name } = ctx.body;
 *
 *   // Response (output)
 *   ctx.status = 200;
 *   ctx.json({ id, name });
 * });
 * ```
 */
export interface Context {
  // =========================================================================
  // REQUEST - Input (Read-only properties)
  // =========================================================================

  /**
   * HTTP method (GET, POST, PUT, DELETE, etc.)
   * @readonly
   */
  readonly method: HttpMethod;

  /**
   * Full request URL including query string
   * @example '/users/123?include=posts'
   * @readonly
   */
  readonly url: string;

  /**
   * Request path without query string
   * @example '/users/123'
   * @readonly
   */
  readonly path: string;

  /**
   * Parsed query string parameters
   * @example { include: 'posts', limit: '10' }
   * @readonly
   */
  readonly query: QueryParams;

  /**
   * Request headers (read-only)
   * Use ctx.get() for case-insensitive access
   * @readonly
   */
  readonly headers: IncomingHeaders;

  /**
   * Client IP address
   * @readonly
   */
  readonly ip: string;

  // =========================================================================
  // REQUEST BODY - Input (Populated by body parser middleware)
  // =========================================================================

  /**
   * Parsed request body
   * Set by body parser middleware (json, urlencoded, multipart)
   *
   * @example
   * ```typescript
   * app.post('/users', async (ctx) => {
   *   const { name, email } = ctx.body as CreateUserDto;
   * });
   * ```
   */
  body: unknown;

  // =========================================================================
  // ROUTE PARAMS - Input (Set by router)
  // =========================================================================

  /**
   * Route parameters from URL path
   *
   * @example
   * ```typescript
   * // Route: /users/:id/posts/:postId
   * // URL: /users/123/posts/456
   * ctx.params // { id: '123', postId: '456' }
   * ```
   */
  params: RouteParams;

  // =========================================================================
  // RESPONSE - Output
  // =========================================================================

  /**
   * HTTP response status code
   * @default 200
   *
   * @example
   * ```typescript
   * ctx.status = 201; // Created
   * ctx.status = 404; // Not Found
   * ```
   */
  status: number;

  /**
   * Send JSON response
   * Automatically sets Content-Type: application/json
   *
   * @param data - Data to serialize as JSON
   *
   * @example
   * ```typescript
   * ctx.json({ users: [] });
   * ctx.json({ error: 'Not found' });
   * ```
   */
  json(data: unknown): void;

  /**
   * Send response (text, buffer, or stream)
   * Automatically detects content type
   *
   * @param data - Response data
   *
   * @example
   * ```typescript
   * ctx.send('Hello World');
   * ctx.send(Buffer.from('binary data'));
   * ctx.send(fileStream);
   * ```
   */
  send(data: ResponseBody): void;

  /**
   * Send HTML response
   * Automatically sets Content-Type: text/html
   *
   * @param content - HTML string
   *
   * @example
   * ```typescript
   * ctx.html('<h1>Hello World</h1>');
   * ```
   */
  html(content: string): void;

  /**
   * Redirect to another URL
   *
   * @param url - Target URL
   * @param status - HTTP status code (default: 302)
   *
   * @example
   * ```typescript
   * ctx.redirect('/login');
   * ctx.redirect('/new-page', 301); // Permanent redirect
   * ```
   */
  redirect(url: string, status?: number): void;

  // =========================================================================
  // ERROR HELPERS
  // =========================================================================

  /**
   * Throw an HTTP error - stops execution and triggers error handler
   *
   * @param status - HTTP status code
   * @param message - Error message (optional)
   * @throws HttpError
   *
   * @example
   * ```typescript
   * ctx.throw(404, 'User not found');
   * ctx.throw(401); // Uses default message "Unauthorized"
   * ```
   */
  throw(status: number, message?: string): never;

  /**
   * Assert a condition, throw if falsy
   *
   * @param condition - Condition to check
   * @param status - HTTP status code if assertion fails
   * @param message - Error message (optional)
   * @throws HttpError if condition is falsy
   *
   * @example
   * ```typescript
   * ctx.assert(user, 404, 'User not found');
   * ctx.assert(user.isAdmin, 403, 'Admin access required');
   * ctx.assert(ctx.body, 400); // Uses default "Bad Request"
   * ```
   */
  assert(condition: unknown, status: number, message?: string): asserts condition;

  // =========================================================================
  // HEADER HELPERS
  // =========================================================================

  /**
   * Set response header
   *
   * @param field - Header name
   * @param value - Header value
   *
   * @example
   * ```typescript
   * ctx.set('X-Request-Id', '123');
   * ctx.set('Cache-Control', 'no-cache');
   * ```
   */
  set(field: string, value: string | number): void;

  /**
   * Get request header (case-insensitive)
   *
   * @param field - Header name
   * @returns Header value or undefined
   *
   * @example
   * ```typescript
   * const auth = ctx.get('Authorization');
   * const contentType = ctx.get('content-type');
   * ```
   */
  get(field: string): string | undefined;

  // =========================================================================
  // MIDDLEWARE
  // =========================================================================

  /**
   * Call the next middleware in the chain
   * Modern syntax: ctx.next() instead of next()
   *
   * @example
   * ```typescript
   * app.use(async (ctx) => {
   *   console.log('Before');
   *   await ctx.next();
   *   console.log('After');
   * });
   * ```
   */
  next(): Promise<void>;

  // =========================================================================
  // STATE
  // =========================================================================

  /**
   * Request-scoped state object
   * Use to pass data between middleware
   *
   * @example
   * ```typescript
   * // Auth middleware
   * app.use(async (ctx) => {
   *   ctx.state.user = await validateToken(ctx.get('Authorization'));
   *   await ctx.next();
   * });
   *
   * // Route handler
   * app.get('/profile', (ctx) => {
   *   const user = ctx.state.user;
   * });
   * ```
   */
  state: ContextState;

  // =========================================================================
  // RAW ACCESS
  // =========================================================================

  /**
   * Raw Node.js HTTP objects
   * Escape hatch for advanced use cases
   *
   * @example
   * ```typescript
   * // Access raw request
   * ctx.raw.req.socket.remoteAddress;
   *
   * // Access raw response
   * ctx.raw.res.writeHead(200);
   * ```
   */
  readonly raw: RawHttp;
}

// ============================================================================
// Middleware Types
// ============================================================================

/**
 * Next function type (traditional Koa-style)
 */
export type Next = () => Promise<void>;

/**
 * Middleware function type
 * Supports both modern and traditional syntax
 *
 * Modern syntax (ctx.next()):
 * ```typescript
 * app.use(async (ctx) => {
 *   await ctx.next();
 * });
 * ```
 *
 * Traditional syntax (next parameter):
 * ```typescript
 * app.use(async (ctx, next) => {
 *   await next();
 * });
 * ```
 */
export type Middleware =
  | ((ctx: Context) => void | Promise<void>)
  | ((ctx: Context, next: Next) => void | Promise<void>);

/**
 * Route handler type (alias for middleware)
 */
export type RouteHandler = Middleware;

// ============================================================================
// Context Factory
// ============================================================================

/**
 * Options for creating a new context
 */
export interface ContextOptions {
  /** HTTP method */
  method: HttpMethod;
  /** Request URL */
  url: string;
  /** Request headers */
  headers?: IncomingHeaders;
  /** Client IP */
  ip?: string;
  /** Raw HTTP objects */
  raw: RawHttp;
}

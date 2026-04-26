/**
 * @nextrush/cors - Type definitions
 *
 * Comprehensive type definitions for CORS middleware.
 * All types are designed with security-first defaults and explicit contracts.
 *
 * @packageDocumentation
 */

import type { Context, Middleware } from '@nextrush/types';

/**
 * CORS context type - a subset of the full Context for origin validation.
 *
 * This allows validators to access request information without
 * requiring the full middleware context.
 */
export interface CorsContext {
  /** HTTP request method */
  readonly method: string;
  /** Request path */
  readonly path: string;
  /** Get request header value */
  get(header: string): string | undefined;
  /** Request headers object */
  readonly headers: Record<string, string | string[] | undefined>;
}

/**
 * Function to dynamically validate request origins.
 *
 * @param origin - The Origin header value from the request
 * @param ctx - The request context for custom validation logic
 * @returns Boolean, allowed origin string, or Promise resolving to either
 *
 * @example
 * ```typescript
 * const validator: OriginValidator = async (origin, ctx) => {
 *   const allowed = await db.getAllowedOrigins(ctx.get('tenant-id'));
 *   return allowed.includes(origin);
 * };
 * ```
 */
export type OriginValidator = (
  origin: string,
  ctx: CorsContext
) => boolean | string | Promise<boolean | string>;

/**
 * Origin configuration type union.
 *
 * @security
 * - `true` reflects the request origin (DANGEROUS with credentials)
 * - `false` disables CORS (responds without headers)
 * - `'*'` allows any origin (incompatible with credentials)
 * - String must be exact match (no protocol guessing)
 * - Array: checks if origin is in list
 * - RegExp: tests origin (use with caution - potential ReDoS)
 * - Function: custom validation (async supported)
 */
export type OriginOption = boolean | string | string[] | RegExp | OriginValidator;

/**
 * Comprehensive CORS configuration options.
 *
 * All options are designed with security-first defaults while maintaining
 * flexibility for various deployment scenarios.
 */
export interface CorsOptions {
  /**
   * Configure allowed origins.
   *
   * @security
   * - `true` reflects the request origin (DANGEROUS with credentials)
   * - `false` disables CORS (responds without headers)
   * - `'*'` allows any origin (incompatible with credentials)
   * - String must be exact match (no protocol guessing)
   * - Array: checks if origin is in list
   * - RegExp: tests origin (use with caution - potential ReDoS)
   * - Function: custom validation (async supported)
   *
   * @default false
   *
   * @example
   * ```typescript
   * // Exact origin
   * cors({ origin: 'https://example.com' })
   *
   * // Multiple origins
   * cors({ origin: ['https://app.example.com', 'https://admin.example.com'] })
   *
   * // Dynamic validation
   * cors({ origin: (origin, ctx) => isAllowed(origin) })
   * ```
   */
  origin?: OriginOption;

  /**
   * Allowed HTTP methods for preflight requests.
   *
   * @default 'GET,HEAD,PUT,PATCH,POST,DELETE'
   *
   * @example
   * ```typescript
   * cors({ methods: ['GET', 'POST'] })
   * cors({ methods: 'GET,POST,PUT' })
   * ```
   */
  methods?: string | string[];

  /**
   * Request headers the client is allowed to send.
   *
   * If not specified, mirrors the `Access-Control-Request-Headers` header
   * from preflight requests (dynamic reflection).
   *
   * @example
   * ```typescript
   * cors({ allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'] })
   * ```
   */
  allowedHeaders?: string | string[];

  /**
   * Response headers that clients can access from JavaScript.
   *
   * @security Simple response headers are always exposed. Use this for
   * custom headers that need to be readable by client-side code.
   *
   * @example
   * ```typescript
   * cors({ exposedHeaders: ['X-Request-Id', 'X-RateLimit-Remaining'] })
   * ```
   */
  exposedHeaders?: string | string[];

  /**
   * Enable cookies and authorization headers in cross-origin requests.
   *
   * @security When `true`:
   * - Origin CANNOT be '*' (wildcard)
   * - Origin MUST be explicitly validated
   * - Sets `Access-Control-Allow-Credentials: true`
   *
   * @default false
   *
   * @example
   * ```typescript
   * cors({
   *   origin: 'https://app.example.com',
   *   credentials: true
   * })
   * ```
   */
  credentials?: boolean;

  /**
   * Cache duration (in seconds) for preflight responses.
   *
   * Reduces preflight requests for repeat API calls.
   *
   * @default undefined (no caching)
   *
   * @example
   * ```typescript
   * cors({ maxAge: 86400 }) // Cache for 24 hours
   * ```
   */
  maxAge?: number;

  /**
   * Pass the preflight request to the next middleware.
   *
   * Useful when you need custom preflight handling or logging.
   *
   * @default false
   */
  preflightContinue?: boolean;

  /**
   * Status code for successful OPTIONS (preflight) responses.
   *
   * Some legacy browsers (Safari, IE11) fail on 204.
   *
   * @default 204
   */
  optionsSuccessStatus?: number;

  /**
   * Enable Private Network Access (PNA) support.
   *
   * @security Required for requests from public websites to local/private
   * network resources. Adds `Access-Control-Allow-Private-Network` header.
   *
   * @see https://wicg.github.io/private-network-access/
   * @default false
   *
   * @example
   * ```typescript
   * // For local development servers accessed from public sites
   * cors({ privateNetworkAccess: true })
   * ```
   */
  privateNetworkAccess?: boolean;

  /**
   * Block requests with `null` origin.
   *
   * @security The `null` origin appears in:
   * - Local file:// pages
   * - Data URLs
   * - Sandboxed iframes
   * - Redirected requests
   *
   * Blocking is recommended unless you specifically need these use cases.
   *
   * @default true (block null origins)
   */
  blockNullOrigin?: boolean;
}

/**
 * CORS middleware function type (for backward compatibility)
 */
export type CorsMiddleware = Middleware;

/**
 * Re-export core types for convenience
 */
export type { Context, Middleware };

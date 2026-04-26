/**
 * @nextrush/csrf - Type Definitions
 *
 * CSRF middleware types for the Signed Double-Submit Cookie pattern.
 *
 * @packageDocumentation
 */

import type { Context, Middleware } from '@nextrush/types';

// ============================================================================
// Cookie Options
// ============================================================================

/**
 * Cookie configuration for the CSRF token cookie.
 *
 * The cookie is NOT httpOnly by default — the client must be able to
 * read the token value and send it back via a custom header or form field.
 */
export interface CsrfCookieOptions {
  /**
   * Cookie name.
   *
   * Use `__Host-` prefix for maximum security (locks to origin, requires Secure,
   * path must be `/`, no Domain attribute).
   *
   * @default '__Host-csrf'
   */
  name?: string;

  /**
   * Cookie path.
   * @default '/'
   */
  path?: string;

  /**
   * SameSite attribute.
   *
   * - `'strict'`: Cookie only sent in same-site requests (strongest)
   * - `'lax'`: Cookie sent on same-site + top-level navigations (recommended)
   * - `'none'`: Cookie sent on all requests (requires `secure: true`)
   *
   * @default 'strict'
   */
  sameSite?: 'strict' | 'lax' | 'none';

  /**
   * Secure flag — cookie only sent over HTTPS.
   *
   * Required for `__Host-` prefix and `sameSite: 'none'`.
   *
   * @default true
   */
  secure?: boolean;

  /**
   * HttpOnly flag.
   *
   * **Must be `false`** for the double-submit cookie pattern — the client
   * needs to read the cookie value to include it in a header or form field.
   *
   * @default false
   */
  httpOnly?: boolean;

  /**
   * Domain attribute.
   *
   * **Not allowed** when using `__Host-` prefix.
   * If omitted, the cookie is scoped to the exact origin.
   */
  domain?: string;

  /**
   * Max-Age in seconds.
   *
   * If omitted, the cookie is a session cookie.
   */
  maxAge?: number;
}

// ============================================================================
// Token Extraction
// ============================================================================

/**
 * Function to extract the CSRF token from the request.
 *
 * The token must come from a header, form body, or query — NOT from the cookie.
 * Cookie-only validation is insecure because browsers auto-send cookies on
 * cross-site requests.
 */
export type TokenExtractor = (ctx: Context) => string | undefined | null;

// ============================================================================
// Session Identifier
// ============================================================================

/**
 * Function to extract a session-dependent identifier from the request.
 *
 * This binds the CSRF token to the user's session, preventing cookie injection
 * attacks where an attacker could set their own cookie on the victim's browser.
 *
 * Common sources: session ID, JWT `jti` claim, or a random value stored in session.
 *
 * If not provided, session binding is disabled (less secure, but sufficient
 * when combined with `__Host-` prefix and `SameSite=Strict`).
 */
export type SessionIdentifierExtractor = (ctx: Context) => string | undefined;

// ============================================================================
// CSRF Options
// ============================================================================

/**
 * Configuration options for the CSRF middleware.
 */
export interface CsrfOptions {
  /**
   * HMAC secret key for signing CSRF tokens.
   *
   * Must be cryptographically random, at least 32 characters.
   * Store in environment variables, never hardcode.
   *
   * Can be a function for dynamic secrets (e.g., key rotation).
   */
  secret: string | (() => string);

  /**
   * Extract a session-dependent value to bind tokens to sessions.
   *
   * Strongly recommended for apps with authenticated sessions.
   * Prevents cookie injection attacks (subdomain takeover, MITM).
   *
   * @example
   * ```typescript
   * getSessionIdentifier: (ctx) => ctx.state.sessionId
   * ```
   */
  getSessionIdentifier?: SessionIdentifierExtractor;

  /**
   * Extract the CSRF token from the incoming request.
   *
   * Must return the token from a header, form body, or query parameter.
   * **Never extract from the cookie** — that defeats the entire pattern.
   *
   * @default Checks `x-csrf-token` header, then `_csrf` body field, then `_csrf` query param
   */
  getTokenFromRequest?: TokenExtractor;

  /**
   * HTTP methods that are exempt from CSRF protection.
   *
   * Safe methods (GET, HEAD, OPTIONS) should not cause state changes
   * and are exempt by default per OWASP guidelines.
   *
   * @default ['GET', 'HEAD', 'OPTIONS', 'TRACE']
   */
  ignoredMethods?: string[];

  /**
   * Paths to exclude from CSRF protection.
   *
   * Useful for webhook endpoints that receive cross-origin POST requests
   * with their own authentication (e.g., Stripe webhooks).
   *
   * Supports exact paths and simple glob patterns:
   * - `/api/webhooks/*` matches `/api/webhooks/stripe`, `/api/webhooks/github`
   * - `/health` matches exactly `/health`
   */
  excludePaths?: string[];

  /**
   * Cookie options for the CSRF token.
   */
  cookie?: CsrfCookieOptions;

  /**
   * Size in bytes of the random value used in token generation.
   *
   * Larger values increase entropy but make tokens longer.
   *
   * @default 32
   */
  tokenSize?: number;

  /**
   * Error handler for CSRF validation failures.
   *
   * By default, sends a 403 Forbidden response with a JSON error body.
   *
   * @param ctx - Request context
   * @param reason - Human-readable reason for the failure
   */
  onError?: (ctx: Context, reason: string) => void | Promise<void>;

  /**
   * Whether to also check `Origin` and `Sec-Fetch-Site` headers
   * as defense-in-depth.
   *
   * When enabled, requests with `Sec-Fetch-Site: cross-site` or
   * mismatched `Origin` headers are rejected even if the token is valid.
   *
   * @default false
   */
  originCheck?: boolean;

  /**
   * Allowed origins when `originCheck` is enabled.
   *
   * If not specified, only same-origin requests are allowed.
   *
   * @example ['https://example.com', 'https://app.example.com']
   */
  allowedOrigins?: string[];
}

// ============================================================================
// CSRF Context
// ============================================================================

/**
 * CSRF utilities attached to `ctx.state.csrf`.
 */
export interface CsrfContext {
  /**
   * Generate a new CSRF token and set the cookie.
   *
   * Call this when rendering forms or returning a token to SPAs.
   *
   * @returns The CSRF token value that should be included in the next request
   *
   * @example
   * ```typescript
   * app.get('/csrf-token', async (ctx) => {
   *   const token = await ctx.state.csrf.generateToken();
   *   ctx.json({ token });
   * });
   * ```
   */
  generateToken(): Promise<string>;

  /**
   * The token value from the current request's cookie (if present).
   *
   * Useful for checking if a token already exists without generating a new one.
   */
  readonly cookieToken: string | undefined;
}

// ============================================================================
// CSRF Middleware Return Type
// ============================================================================

/**
 * Return type of the `csrf()` factory function.
 */
export interface CsrfMiddleware {
  /** The middleware function to register with `app.use()`. */
  readonly protect: Middleware;

  /**
   * Standalone token generation middleware.
   *
   * Attaches `ctx.state.csrf.generateToken()` without enforcing protection.
   * Use on GET routes that need to issue tokens to clients.
   */
  readonly tokenProvider: Middleware;
}

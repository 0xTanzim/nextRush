/**
 * @nextrush/csrf - Middleware
 *
 * Signed Double-Submit Cookie CSRF protection middleware.
 *
 * Pattern (OWASP recommended):
 *   1. Server generates HMAC-signed token → sets cookie (NOT httpOnly)
 *   2. Client reads cookie → sends token back via header/body
 *   3. Server validates: token HMAC is authentic AND cookie matches submitted token
 *
 * Why this is secure:
 *   - Attacker cannot read cross-origin cookies (SameSite + Secure)
 *   - Attacker cannot forge tokens without the HMAC secret
 *   - Session binding prevents cookie injection from subdomains
 *   - Constant-time comparison prevents timing attacks
 *
 * @packageDocumentation
 */

import type { Context, Middleware } from '@nextrush/types';
import {
  CSRF_FIELD,
  CSRF_HEADER,
  DEFAULT_COOKIE_NAME,
  DEFAULT_IGNORED_METHODS,
  DEFAULT_TOKEN_SIZE,
  ERRORS,
  XSRF_HEADER,
} from './constants.js';
import { constantTimeEqual, generateToken, isValidTokenShape, validateToken } from './token.js';
import type {
  CsrfContext,
  CsrfCookieOptions,
  CsrfMiddleware,
  CsrfOptions,
  TokenExtractor,
} from './types.js';

// ============================================================================
// Cookie Parsing
// ============================================================================

/**
 * Parse a specific cookie value from the Cookie header.
 * Avoids parsing all cookies for performance.
 */
function parseCookie(cookieHeader: string, name: string): string | undefined {
  const prefix = `${name}=`;
  const cookies = cookieHeader.split(';');

  for (const raw of cookies) {
    const cookie = raw.trimStart();
    if (cookie.startsWith(prefix)) {
      return cookie.substring(prefix.length).trim();
    }
  }

  return undefined;
}

// ============================================================================
// Default Token Extractor
// ============================================================================

/**
 * Default token extraction strategy.
 *
 * Checks in order:
 *   1. `x-csrf-token` header (standard)
 *   2. `x-xsrf-token` header (Angular convention)
 *   3. `_csrf` body field (form submission)
 *
 * The query string is never read — a token there would leak into access
 * logs, `Referer` headers, and browser history. Applications that need
 * query-string extraction supply an explicit `getTokenFromRequest`.
 */
const defaultTokenExtractor: TokenExtractor = (ctx) => {
  const headerToken = ctx.get(CSRF_HEADER) ?? ctx.get(XSRF_HEADER);
  if (headerToken) return headerToken;

  const body = ctx.body as Record<string, unknown> | undefined;
  if (body && typeof body === 'object' && CSRF_FIELD in body) {
    const val = body[CSRF_FIELD];
    if (typeof val === 'string') return val;
  }

  return undefined;
};

// ============================================================================
// Origin Check
// ============================================================================

/**
 * Validate the request's `Origin` against the configured allowlist.
 *
 * Never compares against `Host` — that header is attacker-controlled on any
 * request the client fully constructs. `Sec-Fetch-Site` is honored only as a
 * reject signal (`cross-site` fails before the allowlist is even consulted);
 * it never grants access on its own. A missing `Origin` fails closed.
 */
function checkOrigin(ctx: Context, allowedOrigins: string[]): boolean {
  const fetchSite = ctx.get('sec-fetch-site');
  if (fetchSite === 'cross-site') return false;

  const origin = ctx.get('origin');
  if (!origin) return false;

  return allowedOrigins.includes(origin);
}

// ============================================================================
// Path Exclusion
// ============================================================================

function isPathExcluded(path: string, excludePaths: string[]): boolean {
  for (const pattern of excludePaths) {
    if (pattern === path) return true;

    // Single wildcard: /api/webhooks/* matches /api/webhooks/stripe (exactly
    // one remaining segment) but NOT /api/webhooks/stripe/deep.
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      if (path.startsWith(prefix) && path.length > prefix.length && path[prefix.length] === '/') {
        const remainder = path.slice(prefix.length + 1);
        if (remainder.length > 0 && !remainder.includes('/')) return true;
      }
      continue;
    }

    // Double wildcard: /api/webhooks/** matches any depth.
    if (pattern.endsWith('/**')) {
      const prefix = pattern.slice(0, -3);
      if (path === prefix || (path.startsWith(prefix) && path[prefix.length] === '/')) {
        return true;
      }
    }
  }

  return false;
}

// ============================================================================
// Cookie Serialization
// ============================================================================

function serializeCookie(name: string, value: string, options: ResolvedCookieOptions): string {
  let cookie = `${name}=${value}`;

  if (options.path) cookie += `; Path=${options.path}`;
  if (options.domain) cookie += `; Domain=${options.domain}`;
  if (options.maxAge !== undefined) cookie += `; Max-Age=${String(options.maxAge)}`;
  if (options.secure) cookie += '; Secure';
  if (options.httpOnly) cookie += '; HttpOnly';
  // sameSite is typed as 'strict' | 'lax' | 'none' after Required<>, but callers
  // may pass empty string via type assertion — guard at runtime for safety.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (options.sameSite) {
    cookie += `; SameSite=${options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1)}`;
  }

  return cookie;
}

// ============================================================================
// Options Resolution
// ============================================================================

/**
 * Resolved cookie options. `maxAge` stays optional (unlike `Required<CsrfCookieOptions>`)
 * so an omitted value can be distinguished from an explicit `0` — the cookie
 * only emits `Max-Age` when the application configured one.
 */
type ResolvedCookieOptions = Required<Omit<CsrfCookieOptions, 'maxAge'>> &
  Pick<CsrfCookieOptions, 'maxAge'>;

interface ResolvedOptions {
  getSecret: () => string;
  getSessionIdentifier: ((ctx: Context) => string | undefined) | undefined;
  getTokenFromRequest: TokenExtractor;
  ignoredMethods: Set<string>;
  excludePaths: string[];
  cookie: ResolvedCookieOptions;
  tokenSize: number;
  onError: (ctx: Context, reason: string) => void | Promise<void>;
  originCheck: boolean;
  allowedOrigins: string[];
}

function validateMaxAge(maxAge: number): void {
  if (!Number.isFinite(maxAge) || maxAge < 0) {
    throw new Error(`${ERRORS.INVALID_MAX_AGE}${String(maxAge)}`);
  }
}

function validateSessionDecision(options: CsrfOptions): void {
  const hasIdentifier = typeof options.getSessionIdentifier === 'function';
  const binding: unknown = options.sessionBinding;

  if (binding !== undefined && binding !== 'none') {
    throw new Error(ERRORS.INVALID_SESSION_BINDING);
  }
  if (!hasIdentifier && binding === undefined) {
    throw new Error(ERRORS.MISSING_SESSION_DECISION);
  }
}

function resolveOptions(options: CsrfOptions): ResolvedOptions {
  const secret = options.secret;

  // Validate secret
  if (!secret) {
    throw new Error(ERRORS.MISSING_SECRET);
  }

  const secretStr = typeof secret === 'function' ? secret() : secret;
  if (secretStr.length < 32) {
    throw new Error(ERRORS.SECRET_TOO_SHORT);
  }

  const getSecret = typeof secret === 'function' ? secret : () => secret;

  validateSessionDecision(options);

  const originCheck = options.originCheck ?? true;
  const allowedOrigins = options.allowedOrigins ?? [];
  if (originCheck && allowedOrigins.length === 0) {
    throw new Error(ERRORS.MISSING_ALLOWED_ORIGINS);
  }

  if (options.cookie?.maxAge !== undefined) {
    validateMaxAge(options.cookie.maxAge);
  }

  // Resolve cookie options
  const cookieName = options.cookie?.name ?? DEFAULT_COOKIE_NAME;
  const cookieOptions: ResolvedCookieOptions = {
    name: cookieName,
    path: options.cookie?.path ?? '/',
    sameSite: options.cookie?.sameSite ?? 'strict',
    secure: options.cookie?.secure ?? true,
    httpOnly: options.cookie?.httpOnly ?? false,
    domain: options.cookie?.domain ?? '',
    maxAge: options.cookie?.maxAge,
  };

  // Validate __Host- prefix constraints
  if (cookieName.startsWith('__Host-')) {
    if (!cookieOptions.secure) {
      throw new Error('Cookies with __Host- prefix require secure: true');
    }
    if (cookieOptions.domain) {
      throw new Error('Cookies with __Host- prefix cannot have a Domain attribute');
    }
    if (cookieOptions.path !== '/') {
      throw new Error('Cookies with __Host- prefix must have path: "/"');
    }
  }

  // Resolve ignored methods as Set for O(1) lookup
  const ignoredMethods = new Set(
    (options.ignoredMethods ?? [...DEFAULT_IGNORED_METHODS]).map((m) => m.toUpperCase())
  );

  // Default error handler: 403 Forbidden JSON response
  const defaultOnError = (ctx: Context, reason: string): void => {
    ctx.status = 403;
    ctx.json({ error: 'CSRF validation failed', message: reason });
  };

  return {
    getSecret,
    getSessionIdentifier: options.getSessionIdentifier,
    getTokenFromRequest: options.getTokenFromRequest ?? defaultTokenExtractor,
    ignoredMethods,
    excludePaths: options.excludePaths ?? [],
    cookie: cookieOptions,
    tokenSize: options.tokenSize ?? DEFAULT_TOKEN_SIZE,
    onError: options.onError ?? defaultOnError,
    originCheck,
    allowedOrigins,
  };
}

// ============================================================================
// CSRF Middleware Factory
// ============================================================================

/**
 * Create CSRF protection middleware using the Signed Double-Submit Cookie pattern.
 *
 * @param options - CSRF configuration
 * @returns Object containing `protect` middleware and `tokenProvider` middleware
 *
 * @example
 * ```typescript
 * import { csrf } from '@nextrush/csrf';
 *
 * const { protect, tokenProvider } = csrf({
 *   secret: process.env.CSRF_SECRET!,
 *   getSessionIdentifier: (ctx) => ctx.state.sessionId,
 * });
 *
 * // Apply to all routes
 * app.use(protect);
 *
 * // Or use tokenProvider on GET routes to issue tokens
 * router.get('/csrf-token', tokenProvider, (ctx) => {
 *   ctx.json({ token: ctx.state.csrf.cookieToken });
 * });
 * ```
 */
export function csrf(options: CsrfOptions): CsrfMiddleware {
  const resolved = resolveOptions(options);

  /**
   * Create the CSRF context that provides token generation utilities.
   */
  function createCsrfContext(ctx: Context, cookieToken: string | undefined): CsrfContext {
    let generated = false;

    return {
      get cookieToken() {
        return cookieToken;
      },

      async generateToken(): Promise<string> {
        const currentSecret = resolved.getSecret();
        const sessionId = resolved.getSessionIdentifier?.(ctx);
        const token = await generateToken(currentSecret, sessionId, resolved.tokenSize);

        // Set the cookie (only once per request)
        if (!generated) {
          const cookieValue = serializeCookie(resolved.cookie.name, token, resolved.cookie);
          ctx.set('Set-Cookie', cookieValue);
          generated = true;
        }

        return token;
      },
    };
  }

  /**
   * Extract the existing cookie token from the request.
   */
  function extractCookieToken(ctx: Context): string | undefined {
    const cookieHeader = ctx.get('cookie');
    if (!cookieHeader) return undefined;
    return parseCookie(cookieHeader, resolved.cookie.name);
  }

  /**
   * Protection middleware — validates CSRF tokens on state-changing requests.
   */
  const protect: Middleware = async (ctx, next) => {
    const method = ctx.method.toUpperCase();
    const cookieToken = extractCookieToken(ctx);

    // Attach csrf utilities to ctx.state regardless of method
    const state = ctx.state as Record<string, unknown>;
    state.csrf = createCsrfContext(ctx, cookieToken);

    // Skip validation for safe methods
    if (resolved.ignoredMethods.has(method)) {
      return next();
    }

    // Skip validation for excluded paths
    if (resolved.excludePaths.length > 0 && isPathExcluded(ctx.path, resolved.excludePaths)) {
      return next();
    }

    // Origin check (defense-in-depth)
    if (resolved.originCheck && !checkOrigin(ctx, resolved.allowedOrigins)) {
      return resolved.onError(ctx, ERRORS.ORIGIN_MISMATCH);
    }

    // Require cookie token
    if (!cookieToken) {
      return resolved.onError(ctx, ERRORS.MISSING_COOKIE);
    }

    // Extract submitted token from header/body
    const submittedToken = resolved.getTokenFromRequest(ctx);
    if (!submittedToken) {
      return resolved.onError(ctx, ERRORS.MISSING_TOKEN);
    }

    // Structural shape check BEFORE any crypto.subtle call — a malformed
    // token is rejected at zero cryptographic cost.
    if (!isValidTokenShape(cookieToken) || !isValidTokenShape(submittedToken)) {
      return resolved.onError(ctx, ERRORS.INVALID_TOKEN);
    }

    // Verify tokens match (constant-time comparison)
    const tokensMatch = await constantTimeEqual(cookieToken, submittedToken);
    if (!tokensMatch) {
      return resolved.onError(ctx, ERRORS.TOKEN_MISMATCH);
    }

    // Validate HMAC signature (proves token authenticity)
    const currentSecret = resolved.getSecret();
    const sessionId = resolved.getSessionIdentifier?.(ctx);
    const isValid = await validateToken(cookieToken, currentSecret, sessionId);
    if (!isValid) {
      return resolved.onError(ctx, ERRORS.INVALID_TOKEN);
    }

    return next();
  };

  /**
   * Token provider middleware — attaches `ctx.state.csrf` without enforcing protection.
   */
  const tokenProvider: Middleware = async (ctx, next) => {
    const cookieToken = extractCookieToken(ctx);
    const state = ctx.state as Record<string, unknown>;
    state.csrf = createCsrfContext(ctx, cookieToken);
    return next();
  };

  return { protect, tokenProvider };
}

/**
 * @nextrush/cors - Core middleware implementation
 *
 * Enterprise-grade CORS middleware with comprehensive security features.
 * Implements all OWASP recommendations and modern security standards.
 *
 * @packageDocumentation
 */

import type { Context, Middleware, Next } from '@nextrush/types';
import { SECURITY_AUDIT, type SecurityAuditVerdict } from '@nextrush/types';
import { CORS_HEADERS, DEFAULT_ALLOWED_HEADERS, DEFAULT_METHODS, PREFLIGHT_INDICATORS } from './constants.js';
import { appendVary, intersectRequestedHeaders, normalizeHeaders } from './headers.js';
import type { CorsContext, CorsOptions } from './types.js';
import { isOriginAllowed } from './validation.js';

/**
 * Create CORS middleware with comprehensive security features.
 *
 * @param options - CORS configuration
 * @returns Middleware function
 *
 * @security This middleware implements:
 * - Null origin attack protection
 * - Regex ReDoS mitigation
 * - Credential+wildcard validation
 * - Private Network Access (PNA) support
 * - Origin format validation
 *
 * @example
 * ```typescript
 * import { cors } from '@nextrush/cors';
 *
 * // Simple usage
 * app.use(cors({ origin: 'https://example.com' }));
 *
 * // Multiple origins with credentials
 * app.use(cors({
 *   origin: ['https://app.example.com', 'https://admin.example.com'],
 *   credentials: true,
 *   exposedHeaders: ['X-Request-Id']
 * }));
 *
 * // Dynamic validation
 * app.use(cors({
 *   origin: async (origin, ctx) => {
 *     const allowed = await db.getAllowedOrigins();
 *     return allowed.includes(origin);
 *   },
 *   credentials: true
 * }));
 * ```
 */
export function cors(options: CorsOptions = {}): Middleware {
  const {
    origin: allowedOrigin = false,
    methods = DEFAULT_METHODS,
    allowedHeaders,
    exposedHeaders,
    credentials = false,
    maxAge,
    preflightContinue = false,
    optionsSuccessStatus = 204,
    privateNetworkAccess = false,
    blockNullOrigin = true,
  } = options;

  // Security validation at configuration time
  if (credentials && allowedOrigin === '*') {
    throw new Error(
      '[@nextrush/cors] Security Error: Cannot use credentials=true with origin="*". ' +
        'This would allow any site to make credentialed requests. ' +
        'Use an explicit origin or array of origins instead.'
    );
  }

  // The reflect+credentials condition is audited by the boot-time
  // security-boundaries mechanism (task 8.2, see `auditVerdict` below) —
  // that is the one enforcement path for this condition; a duplicate
  // dev-console `securityWarning()` call here would be the second parallel
  // mechanism task 8.2 folds away.

  if (
    maxAge !== undefined &&
    (typeof maxAge !== 'number' || maxAge < 0 || !Number.isFinite(maxAge))
  ) {
    throw new Error(
      `[@nextrush/cors] Invalid maxAge: ${String(maxAge)}. Must be a non-negative finite number.`
    );
  }

  const normalizedMethods = Array.isArray(methods) ? methods.join(',') : methods;
  const normalizedAllowedHeaders = normalizeHeaders(allowedHeaders);
  const normalizedExposedHeaders = normalizeHeaders(exposedHeaders);

  /**
   * Boot-time verdict for the reflected-origin-plus-credentials
   * misconfiguration (task 8.1/8.2): `securityWarning()` already logs this in
   * development, but that warning is a no-op in production — where a
   * silent, always-credentialed CORS reflection is exploitable. The boot
   * audit is the one mechanism that enforces this in production; this
   * function is that mechanism's sole input for `cors()`, not a second one.
   */
  function auditVerdict(): SecurityAuditVerdict {
    if (credentials && allowedOrigin === true) {
      return {
        level: 'throw',
        message:
          'cors({ origin: true, credentials: true }) reflects any origin while allowing ' +
          'credentialed requests — any site can read authenticated responses. Use an ' +
          'explicit origin allowlist, or drop credentials: true.',
      };
    }
    return { level: 'ok' };
  }

  const middleware = async function corsMiddleware(ctx: Context, next?: Next): Promise<void> {
    const requestOrigin = ctx.get('Origin') ?? ctx.get('origin');

    // Always add Vary: Origin (for proper caching)
    appendVary(ctx, 'Origin');

    // No Origin header - not a CORS request
    if (!requestOrigin) {
      if (next) await next();
      else await ctx.next();
      return;
    }

    // Create a minimal context for origin validation
    const corsContext: CorsContext = {
      method: ctx.method,
      path: ctx.path,
      get: (header: string) => ctx.get(header),
      headers: ctx.headers,
    };

    // Determine if origin is allowed
    const allowedOriginValue = await isOriginAllowed(
      requestOrigin,
      allowedOrigin,
      corsContext,
      blockNullOrigin
    );

    // Origin not allowed - skip CORS headers
    if (!allowedOriginValue) {
      if (next) await next();
      else await ctx.next();
      return;
    }

    // Set Access-Control-Allow-Origin
    ctx.set(CORS_HEADERS.allowOrigin, allowedOriginValue);

    // Credentials support
    if (credentials) {
      ctx.set(CORS_HEADERS.allowCredentials, 'true');
    }

    // Expose custom headers
    if (normalizedExposedHeaders) {
      ctx.set(CORS_HEADERS.exposeHeaders, normalizedExposedHeaders);
    }

    // Handle preflight (OPTIONS) requests
    const isPreflight = ctx.method === 'OPTIONS' && ctx.get(PREFLIGHT_INDICATORS.method);

    if (isPreflight) {
      // Add Vary for preflight-specific headers
      appendVary(ctx, 'Access-Control-Request-Method');
      appendVary(ctx, 'Access-Control-Request-Headers');

      // Allowed methods
      ctx.set(CORS_HEADERS.allowMethods, normalizedMethods);

      // Allowed headers (SEC-10): a configured allowlist is honored verbatim
      // (developer's explicit choice). Otherwise intersect the requested
      // headers against the conservative default allowlist rather than
      // echoing the request back — Authorization only joins the default set
      // when credentials are enabled, since it is meaningless without them.
      const requestHeaders = ctx.get(PREFLIGHT_INDICATORS.headers);
      const headersToAllow =
        normalizedAllowedHeaders ??
        intersectRequestedHeaders(
          requestHeaders,
          credentials ? [...DEFAULT_ALLOWED_HEADERS, 'Authorization'] : DEFAULT_ALLOWED_HEADERS
        );
      if (headersToAllow) {
        ctx.set(CORS_HEADERS.allowHeaders, headersToAllow);
      }

      // Max age for caching preflight
      if (maxAge !== undefined) {
        ctx.set(CORS_HEADERS.maxAge, String(maxAge));
      }

      // Private Network Access support
      if (privateNetworkAccess && ctx.get(PREFLIGHT_INDICATORS.privateNetwork)) {
        ctx.set(CORS_HEADERS.allowPrivateNetwork, 'true');
      }

      // End preflight or continue
      if (!preflightContinue) {
        ctx.status = optionsSuccessStatus;
        ctx.set('Content-Length', '0');
        ctx.body = '';
        return;
      }
    }

    // Continue to next middleware
    if (next) await next();
    else await ctx.next();
  };

  Object.defineProperty(middleware, SECURITY_AUDIT, {
    value: auditVerdict,
    enumerable: false,
  });

  return middleware;
}

/**
 * Type-safe CORS options builder for complex configurations.
 *
 * @example
 * ```typescript
 * const options = createCorsOptions()
 *   .allowOrigin('https://example.com')
 *   .allowCredentials()
 *   .exposeHeaders(['X-Request-Id'])
 *   .build();
 *
 * app.use(cors(options));
 * ```
 */
export class CorsOptionsBuilder {
  private options: CorsOptions = {};

  /**
   * Set the allowed origin(s).
   */
  allowOrigin(origin: CorsOptions['origin']): this {
    this.options.origin = origin;
    return this;
  }

  /**
   * Set allowed HTTP methods.
   */
  allowMethods(methods: string | string[]): this {
    this.options.methods = methods;
    return this;
  }

  /**
   * Set allowed request headers.
   */
  allowHeaders(headers: string | string[]): this {
    this.options.allowedHeaders = headers;
    return this;
  }

  /**
   * Set exposed response headers.
   */
  exposeHeaders(headers: string | string[]): this {
    this.options.exposedHeaders = headers;
    return this;
  }

  /**
   * Enable credentials (cookies, auth headers).
   */
  allowCredentials(allow = true): this {
    this.options.credentials = allow;
    return this;
  }

  /**
   * Set preflight cache duration.
   */
  setMaxAge(seconds: number): this {
    this.options.maxAge = seconds;
    return this;
  }

  /**
   * Enable Private Network Access.
   */
  allowPrivateNetwork(allow = true): this {
    this.options.privateNetworkAccess = allow;
    return this;
  }

  /**
   * Set whether to block null origins.
   */
  blockNull(block = true): this {
    this.options.blockNullOrigin = block;
    return this;
  }

  /**
   * Build the final options object.
   */
  build(): CorsOptions {
    return { ...this.options };
  }
}

/**
 * Create a new CORS options builder.
 */
export function createCorsOptions(): CorsOptionsBuilder {
  return new CorsOptionsBuilder();
}

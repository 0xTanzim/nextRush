/**
 * @nextrush/cors - Constants
 *
 * Shared constants for CORS middleware implementation.
 *
 * @packageDocumentation
 */

/**
 * Default allowed HTTP methods for preflight requests.
 * Matches the most common REST API patterns.
 */
export const DEFAULT_METHODS = 'GET,HEAD,PUT,PATCH,POST,DELETE';

/**
 * Conservative default preflight header allowlist (SEC-10).
 *
 * @remarks
 * When `allowedHeaders` is not configured, a preflight response intersects
 * `Access-Control-Request-Headers` against this set instead of echoing the
 * request verbatim — the previous behavior turned the allowlist CORS exists
 * to provide into a passthrough for any header an allowed-but-lower-trust
 * origin cared to send. `Authorization` is intentionally excluded here and
 * added conditionally only when `credentials: true` (see `middleware.ts`).
 */
export const DEFAULT_ALLOWED_HEADERS: readonly string[] = [
  'Content-Type',
  'Accept',
  'X-Requested-With',
];

/**
 * Default status code for successful preflight responses.
 * 204 No Content is spec-compliant but some legacy browsers prefer 200.
 */
export const DEFAULT_OPTIONS_SUCCESS_STATUS = 204;

/**
 * Default preflight cache duration (in seconds).
 * Used when maxAge is not specified.
 */
export const DEFAULT_MAX_AGE = 86400; // 24 hours

/**
 * Headers that indicate a preflight (OPTIONS) request.
 */
export const PREFLIGHT_INDICATORS = {
  method: 'access-control-request-method',
  headers: 'access-control-request-headers',
  privateNetwork: 'access-control-request-private-network',
} as const;

/**
 * CORS response header names.
 */
export const CORS_HEADERS = {
  allowOrigin: 'Access-Control-Allow-Origin',
  allowMethods: 'Access-Control-Allow-Methods',
  allowHeaders: 'Access-Control-Allow-Headers',
  allowCredentials: 'Access-Control-Allow-Credentials',
  exposeHeaders: 'Access-Control-Expose-Headers',
  maxAge: 'Access-Control-Max-Age',
  allowPrivateNetwork: 'Access-Control-Allow-Private-Network',
} as const;

/**
 * Vary header name.
 */
export const VARY_HEADER = 'Vary';

/**
 * Origin header name.
 */
export const ORIGIN_HEADER = 'Origin';

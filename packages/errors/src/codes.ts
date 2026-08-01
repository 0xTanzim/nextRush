/**
 * @nextrush/errors - Central Error Code Registry
 *
 * Single source of truth mapping HTTP status codes to their canonical,
 * machine-readable error codes (audit E-4). Both the typed error classes and
 * the {@link createError} factory resolve codes through this registry, so a
 * given status maps to exactly one code regardless of construction path.
 *
 * @packageDocumentation
 */

/**
 * Canonical error code for each supported HTTP status.
 *
 * @remarks
 * Keep this in sync with the typed classes in `http-errors.ts`. The
 * `audit-fixes` test suite asserts `createError(status).code === ERROR_CODES[status]`
 * for every entry, so drift between a class and this registry fails CI.
 */
export const ERROR_CODES: Readonly<Record<number, string>> = Object.freeze({
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  402: 'PAYMENT_REQUIRED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  406: 'NOT_ACCEPTABLE',
  407: 'PROXY_AUTH_REQUIRED',
  408: 'REQUEST_TIMEOUT',
  409: 'CONFLICT',
  410: 'GONE',
  411: 'LENGTH_REQUIRED',
  412: 'PRECONDITION_FAILED',
  413: 'PAYLOAD_TOO_LARGE',
  414: 'URI_TOO_LONG',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  416: 'RANGE_NOT_SATISFIABLE',
  417: 'EXPECTATION_FAILED',
  418: 'IM_A_TEAPOT',
  422: 'UNPROCESSABLE_ENTITY',
  423: 'LOCKED',
  424: 'FAILED_DEPENDENCY',
  425: 'TOO_EARLY',
  426: 'UPGRADE_REQUIRED',
  428: 'PRECONDITION_REQUIRED',
  429: 'TOO_MANY_REQUESTS',
  431: 'REQUEST_HEADER_FIELDS_TOO_LARGE',
  451: 'UNAVAILABLE_FOR_LEGAL_REASONS',
  500: 'INTERNAL_SERVER_ERROR',
  501: 'NOT_IMPLEMENTED',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
  504: 'GATEWAY_TIMEOUT',
  505: 'HTTP_VERSION_NOT_SUPPORTED',
  506: 'VARIANT_ALSO_NEGOTIATES',
  507: 'INSUFFICIENT_STORAGE',
  508: 'LOOP_DETECTED',
  510: 'NOT_EXTENDED',
  511: 'NETWORK_AUTH_REQUIRED',
});

/**
 * Resolve the canonical error code for an HTTP status.
 *
 * @param status - HTTP status code.
 * @returns The registered canonical code, or `HTTP_<status>` for statuses with
 *   no dedicated class.
 */
export function codeForStatus(status: number): string {
  return ERROR_CODES[status] ?? `HTTP_${status}`;
}

/** Generic internal-error code used when no status-specific code applies. */
export const GENERIC_ERROR_CODE = 'INTERNAL_ERROR';

/** Canonical code for validation failures. */
export const VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';

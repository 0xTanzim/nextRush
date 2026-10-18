/**
 * @nextrush/runtime - Shared HTTP response guards
 *
 * The grammars and the body-suppression rule are defined once and reused by
 * every adapter's `set()` and by both response families, so a header or status
 * can never be validated in one place and accepted in another.
 *
 * @packageDocumentation
 */

import { HeaderValidationError } from '@nextrush/errors';

/**
 * RFC 9110 §5.6.2 `token` grammar for a header field name: one or more
 * `tchar` — no separators, no whitespace, no control characters.
 */
const FIELD_NAME_TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/**
 * RFC 9110 §5.5 field-value grammar (as a validation, not a permissive
 * transport rule): printable ASCII plus the Latin-1 supplement range, no
 * control characters (including NUL and DEL), and — checked separately
 * below — no leading/trailing whitespace and no embedded CR/LF (obs-fold).
 * `\t` and space are allowed *inside* the value but not at the edges.
 */
const FIELD_VALUE_CHARS = /^[\t\x20-\x7E\x80-\xFF]*$/;

/**
 * Validate one header value string against the RFC 9110 field-value
 * grammar (SEC-12): no control characters (NUL, DEL, C0 controls), no
 * leading/trailing whitespace, no embedded CR/LF (which also catches
 * obs-fold, a CRLF followed by whitespace).
 */
function assertValueGrammar(value: string): void {
  if (value.includes('\r') || value.includes('\n')) {
    throw new HeaderValidationError('Header value contains invalid characters');
  }
  if (value.startsWith(' ') || value.startsWith('\t')) {
    throw new HeaderValidationError('Header value contains invalid characters');
  }
  if (value !== '' && /[ \t]$/.test(value)) {
    throw new HeaderValidationError('Header value contains invalid characters');
  }
  if (!FIELD_VALUE_CHARS.test(value)) {
    throw new HeaderValidationError('Header value contains invalid characters');
  }
}

/**
 * Guard a header field/value against the full RFC 9110 field grammar
 * (SEC-12), not only CRLF injection.
 *
 * @remarks
 * Shared by every adapter's `set()` so the guard — and its error messages —
 * cannot drift. Validates the field name against the `token` grammar
 * (rejecting separators, whitespace, and control characters, not only
 * `:`/CR/LF) and each value against the field-value grammar (rejecting
 * control characters, leading/trailing whitespace, and obs-fold). Numeric
 * values are always safe. Array values are validated element-wise — a
 * single invalid element rejects the whole write, per the framework's
 * fail-closed rule (`security-boundaries` capability).
 *
 * @param field - Header field name.
 * @param value - Header value (string, number, or array of strings).
 * @throws {HeaderValidationError} If the field or any value violates the
 *   grammar.
 */
export function assertHeaderSafe(field: string, value: string | number | string[]): void {
  if (!FIELD_NAME_TOKEN.test(field)) {
    throw new HeaderValidationError('Header field contains invalid characters');
  }
  if (typeof value === 'string') {
    assertValueGrammar(value);
  } else if (Array.isArray(value)) {
    for (const v of value) {
      assertValueGrammar(v);
    }
  }
}

/**
 * Whether the response must not carry a body per HTTP semantics.
 *
 * @remarks
 * HEAD requests, 204 No Content, 304 Not Modified, and 1xx informational
 * responses never include a body (RFC 7231). Shared by the Web response builder
 * and the Node context so suppression is defined once.
 *
 * @param method - The (upper-cased) request method.
 * @param status - The response status code.
 */
export function isBodylessResponse(method: string, status: number): boolean {
  return method === 'HEAD' || status === 204 || status === 304 || (status >= 100 && status < 200);
}

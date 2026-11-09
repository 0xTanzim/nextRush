/**
 * @nextrush/runtime - per-call response arguments (RFC-048)
 *
 * One resolver for the second argument `ctx.json()`, `ctx.html()` and `ctx.send()`
 * accept: a numeric status or a `ResponseOptions` object. Both adapter families
 * (the Web builder contexts and the Node context) call it, so the precedence and
 * rejection rules are identical by construction.
 *
 * @packageDocumentation
 */

import type { ResponseHeaders, ResponseOptions } from '@nextrush/types';

/** Lowest status every shipped adapter can answer. */
const MIN_STATUS = 200;
/** Highest status every shipped adapter can answer (platform `Response` limit). */
const MAX_STATUS = 599;

const CONTENT_LENGTH_LENGTH = 'content-length'.length;

/** The minimal write surface needed to apply supplied headers to a response. */
export interface HeaderWriter {
  set(field: string, value: string | number | string[]): void;
}

/** The resolved status and headers for one response call. */
export interface ResolvedResponseArgs {
  readonly status: number;
  readonly headers: ResponseHeaders | undefined;
}

/**
 * Reject a status the adapters cannot answer identically.
 *
 * @remarks
 * 200-599 is the intersection of the Web `Response` range and what Node's
 * `writeHead` accepts; the adapters disagree outside it. The carried
 * `ctx.status` assignment path is deliberately not validated — that is existing
 * behavior and out of this contract's scope.
 *
 * @param status - The explicit status supplied by the caller.
 * @param helper - The response helper name, used in the error message.
 * @throws RangeError when the value is not an integer in 200-599.
 */
export function assertResponseStatus(status: number, helper: string): void {
  if (
    typeof status !== 'number' ||
    !Number.isInteger(status) ||
    status < MIN_STATUS ||
    status > MAX_STATUS
  ) {
    throw new RangeError(
      `ctx.${helper}() received status ${String(status)}; expected an integer from ` +
        `${String(MIN_STATUS)} to ${String(MAX_STATUS)}.`
    );
  }
}

function isContentLengthField(field: string): boolean {
  return field.length === CONTENT_LENGTH_LENGTH && field.toLowerCase() === 'content-length';
}

/**
 * Apply supplied headers to a response, rejecting framework-owned fields.
 *
 * @remarks
 * Every field is validated before the first write, so a rejected header leaves
 * the response untouched. `Content-Length` is refused because the framework
 * derives it from the serialized body at flush; a disagreeing value truncates or
 * over-reads the response, and the failure differs per adapter.
 *
 * Fields are written through {@link HeaderWriter.set} — the same path as
 * `ctx.set()` — so `Set-Cookie` accumulation, array semantics and header-name
 * validation are not re-implemented here.
 *
 * @param target - The response's header writer.
 * @param headers - The supplied headers, or `undefined` for no-op.
 * @throws TypeError when a supplied field would corrupt the response.
 */
export function applyResponseHeaders(
  target: HeaderWriter,
  headers: ResponseHeaders | undefined
): void {
  if (headers === undefined) return;

  const fields = Object.keys(headers);
  for (const field of fields) {
    if (isContentLengthField(field)) {
      throw new TypeError(
        `ctx response headers must not set ${field}: Content-Length is derived ` +
          'from the serialized body by the framework.'
      );
    }
  }

  for (const field of fields) {
    const value = headers[field];
    if (value !== undefined) target.set(field, value);
  }
}

/**
 * Resolve the second response-helper argument against the carried status.
 *
 * @param arg - A numeric status, a `ResponseOptions` object, or `undefined`.
 * @param fallback - The carried `ctx.status`; used when no explicit status is given.
 * @param helper - The response helper name, used in error messages.
 * @throws TypeError when the argument is neither a number nor a plain object.
 * @throws RangeError when an explicit status is out of the accepted range.
 */
export function resolveResponseArgs(
  arg: number | ResponseOptions | undefined,
  fallback: number,
  helper: string
): ResolvedResponseArgs {
  // Widened to `unknown`: the declared type is what TypeScript callers see, but
  // untyped JavaScript callers can pass anything, and these guards are the
  // runtime contract for that case.
  const value: unknown = arg;
  if (value === undefined) return { status: fallback, headers: undefined };

  if (typeof value === 'number') {
    assertResponseStatus(value, helper);
    return { status: value, headers: undefined };
  }

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(
      `ctx.${helper}() expected a status code or a response options object, received ` +
        `${value === null ? 'null' : typeof value}.`
    );
  }

  const options = value as ResponseOptions;
  if (options.status === undefined) return { status: fallback, headers: options.headers };

  assertResponseStatus(options.status, helper);
  return { status: options.status, headers: options.headers };
}

/**
 * @nextrush/types - the recorded outgoing response contract
 *
 * Middleware that runs after the handler needs to read and rewrite the response
 * the adapter will flush. `@nextrush/runtime` owns the implementation; this
 * package owns the symbol a context exposes it under and the structural shape a
 * middleware may rely on, so an in-repo middleware does not have to import the
 * runtime (and cannot depend on an adapter).
 *
 * The symbol is a real export, so the public-surface lock records it: changing
 * or removing it is a deliberate, reviewed edit rather than an accident. It is
 * `@internal` — no semver guarantee, and not part of the documented `Context`
 * surface. It can graduate to a documented property if a third-party middleware
 * ever needs it.
 *
 * @packageDocumentation
 */

/**
 * Well-known symbol under which a context exposes its recorded outgoing
 * response.
 *
 * @remarks
 * `Symbol.for` (global registry) matches the other contribution symbols, so
 * identity holds even across duplicate package instances.
 *
 * @internal
 */
export const OUTGOING_RESPONSE: unique symbol = Symbol.for('nextrush.outgoing.response');

/**
 * The recorded outgoing response as a middleware sees it.
 *
 * @remarks
 * Intentionally narrower than the runtime record: a middleware may inspect the
 * serialized body and the recorded headers, and may replace the body. It cannot
 * flush, change the status, or reach the transport.
 *
 * @internal
 */
export interface OutgoingResponseHandle {
  /** The status the adapter will flush. */
  readonly status: number;

  /** Whether a response method has recorded a status and body. */
  readonly committed: boolean;

  /** The serialized body; `null` when nothing has been recorded. */
  readonly body: string | Uint8Array | null;

  /** The first value recorded for a header field, case-insensitively. */
  getHeader(field: string): string | undefined;

  /** Whether a header field has at least one value. */
  hasHeader(field: string): boolean;

  /** Every recorded `Set-Cookie` value, in write order. */
  getSetCookie(): string[];

  /**
   * Replace the recorded body.
   *
   * @param body - The new serialized body, or `null` for none.
   * @param contentType - Kept only when the caller needs to change it; omitting
   *   it preserves the content type the response method recorded.
   * @returns `false` when the response was already flushed.
   */
  setBody(body: string | Uint8Array | null, contentType?: string): boolean;
}

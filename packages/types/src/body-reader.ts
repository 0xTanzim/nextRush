/**
 * @nextrush/types - Deferred request-body reader contract (RFC-047)
 *
 * @remarks
 * `@nextrush/body-parser` may defer the byte read and the parse of a request
 * body until the application calls `await ctx.readBody()` (lazy mode). The
 * context is the only object both sides share, so the parser installs this small
 * reader object on it and `Context.readBody()` delegates to it. The slot is a
 * registered symbol rather than a named property so an eager-mode context — the
 * default, and every request that does not opt in — gains no field and no hidden
 * class transition.
 *
 * `Symbol.for` (not `Symbol()`) so the parser and the runtime resolve the same
 * key even if their module graphs are duplicated (source vs build output).
 *
 * Marked `@internal`: it is a protocol between the body parser and the context,
 * not documented application surface.
 *
 * @packageDocumentation
 */

/**
 * Reader installed on a context by a body parser in lazy mode.
 *
 * @internal
 */
export interface DeferredBodyReader {
  /**
   * Read, parse, and cache the request body.
   *
   * @remarks
   * Idempotent: a completed read returns the same value, an in-flight read
   * returns the same promise so the single-consumption body source is never
   * drained twice, and a failed read re-throws the original error instead of
   * attempting a second parse.
   */
  read<T = unknown>(): Promise<T>;
}

/**
 * Context slot under which a lazy body parser installs its reader.
 *
 * @internal
 */
export const BODY_READER: unique symbol = Symbol.for('@nextrush/body-reader');

/**
 * Structural carrier for the {@link BODY_READER} slot.
 *
 * @internal
 */
export interface BodyReaderCarrier {
  [BODY_READER]?: DeferredBodyReader;
}

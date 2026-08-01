/**
 * @nextrush/stream - Errors
 *
 * @packageDocumentation
 */

/**
 * Thrown by a writer's `write()`/`consume()` once the client has disconnected.
 *
 * @remarks
 * This is a control-flow signal, not an HTTP error — the client is already gone,
 * so nothing is sent to them. `ctx.stream()`/`ctx.sse()`/`ctx.ndjson()` catch it
 * at the top-level boundary and treat it as a clean, expected shutdown: it is
 * never logged as a failure and never re-thrown to the caller.
 *
 * A handler that wants to distinguish "I was cancelled" from "something broke"
 * can catch this explicitly; a handler that does nothing special still cannot
 * produce a silently-corrupted response, because the throw happens before any
 * partial write.
 */
export class StreamAbortedError extends Error {
  override readonly name = 'StreamAbortedError';

  constructor() {
    super('Cannot write to stream: client has disconnected.');
    // Restore prototype chain for reliable `instanceof` after transpilation.
    Object.setPrototypeOf(this, StreamAbortedError.prototype);
  }
}

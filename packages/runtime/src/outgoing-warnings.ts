/**
 * @nextrush/runtime - once-per-process report for a discarded response write
 *
 * A recorded response is mutable until the adapter flushes it and immutable
 * after. A write that arrives too late cannot be honoured, and the two obvious
 * alternatives are both worse:
 *
 * - Discarding silently lets a registered middleware stop having an effect with
 *   no signal at all.
 * - Throwing unwinds the rest of the middleware chain while the request still
 *   answers normally, which is what the pre-record Node adapter did — and which
 *   `handleError` then swallowed because `ctx.responded` was already true.
 *
 * Once per process, not per request: a write after the flush is a deterministic
 * property of the code, so a per-request report would be a log storm under load.
 *
 * @packageDocumentation
 */

let warnedDiscardedWrite = false;

/**
 * Report once per process that a response write arrived after the flush.
 *
 * @param field - The discarded header field, or `body` for a body replacement,
 *   so the report names the site that needs to move its write earlier.
 *
 * @internal
 */
export function warnDiscardedWriteOnce(field: string): void {
  if (warnedDiscardedWrite) return;
  warnedDiscardedWrite = true;
  console.warn(
    `[@nextrush/runtime] discarding '${field}': the response was already flushed, so the write was ` +
      `not sent. Change the response from middleware that runs before the flush, or guard on ` +
      `ctx.responded. Later discarded writes in this process are not reported.`
  );
}

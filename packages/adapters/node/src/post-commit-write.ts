/**
 * @nextrush/adapter-node — once-per-process report for a discarded post-commit header write
 *
 * The Node adapter commits a response inside the handler, so a middleware that
 * writes a header after `await next()` reaches `res.setHeader()` past
 * `headersSent`, where the write cannot be honoured.
 *
 * Rejecting the write is not an option: the rejection escapes the middleware,
 * unwinds the rest of the stack and silently skips every outer middleware's
 * post-`next()` work, while the request still answers normally — so nothing
 * surfaces the failure. Discarding it silently is not an option either: a
 * middleware the developer registered would stop having an effect with no
 * signal at all.
 *
 * So the write is discarded and reported. The report is once per process rather
 * than per request, because a header written after commit is a deterministic
 * property of the code, not of the request — a per-request report would be a log
 * storm under load.
 *
 * @packageDocumentation
 */

let warned = false;

/**
 * Report once per process that a header written after commit was discarded.
 *
 * @param field - The discarded header field name, so the report identifies the
 * site that needs to move its write before the response is committed.
 * @internal
 */
export function warnPostCommitHeaderWriteOnce(field: string): void {
  if (warned) return;
  warned = true;
  console.warn(
    `[@nextrush/adapter-node] discarding '${field}': the response was already committed, so the ` +
      `header was not sent. Set response headers before the handler commits the response, or guard ` +
      `on ctx.responded. Later discarded writes in this process are not reported.`
  );
}

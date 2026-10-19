/**
 * @nextrush/compression - Once-per-process warning
 *
 * This middleware can only transform a response the adapter still exposes. Both
 * shipped adapter families commit the response before the chain unwinds — the
 * Node adapter writes and ends it inside the handler, the Web adapters record
 * it privately and materialise it afterwards — so a response produced with
 * `ctx.json()`/`send()`/`html()` is already gone by the time compression looks.
 *
 * A silent no-op is the worst possible outcome for a middleware a user
 * explicitly registered, so the situation is reported once per process. The
 * package README states the same limitation for readers who never see a log.
 *
 * Uses the Web-standard `console` only — no `process`/`node:*` — so the package
 * stays edge-portable.
 *
 * @packageDocumentation
 */

let warned = false;

/**
 * Warn once per process that no outgoing body was available to compress.
 *
 * @internal
 */
export function warnNoOutgoingBodyOnce(): void {
  if (warned) return;
  warned = true;
  console.warn(
    '[@nextrush/compression] no outgoing body available: a response written with ' +
      'ctx.json()/send()/html() is committed before this middleware runs, so it cannot be ' +
      'compressed. Compression applies only on adapters that expose the buffered outgoing ' +
      'body — see the "Limitations" section of the package README.'
  );
}

/** Reset the once-per-process flag. Exposed for testing. @internal */
export function resetNoOutgoingBodyWarning(): void {
  warned = false;
}

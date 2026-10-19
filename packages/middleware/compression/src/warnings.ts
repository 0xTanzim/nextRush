/**
 * @nextrush/compression - Once-per-process warning
 *
 * Compression rewrites the response the adapter is about to send. Every shipped
 * adapter records that response on the context and flushes it once the
 * middleware chain unwinds (RFC-041), so the middleware has something to act on.
 * The one case it cannot handle is an adapter that exposes no recorded response
 * at all — a third-party adapter, or a context created outside the framework.
 *
 * A silent no-op is the worst possible outcome for a middleware a user
 * explicitly registered, so that situation is reported once per process. The
 * package README states the same contract for readers who never see a log.
 *
 * Uses the Web-standard `console` only — no `process`/`node:*` — so the package
 * stays edge-portable.
 *
 * @packageDocumentation
 */

let warned = false;

/**
 * Warn once per process that no outgoing response was available to compress.
 *
 * @internal
 */
export function warnNoOutgoingBodyOnce(): void {
  if (warned) return;
  warned = true;
  console.warn(
    '[@nextrush/compression] no outgoing response available: this adapter exposes no recorded ' +
      'response for a middleware to rewrite, so nothing can be compressed. Every shipped ' +
      'NextRush adapter records one — see the "Response model" section of the package README.'
  );
}

/** Reset the once-per-process flag. Exposed for testing. @internal */
export function resetNoOutgoingBodyWarning(): void {
  warned = false;
}

# RFC 017 — BodySource limit propagation

- **Status:** Accepted
- **Date:** 2026-07-19
- **Area:** request-data
- **Related change:** `openspec/changes/body-parser-limit-and-hot-path-fixes`
- **Capabilities touched:** `node-adapter`, `web-adapters`, `runtime-adapter-contract`, `body-parser`
- **Supersedes / relates:** RFC 003 (stream), the `node-body-read-fastpath` change (event-listener drain)

## Summary

Add an optional per-read byte limit to the cross-runtime body-reading contract:

```ts
interface BodySource {
  buffer(limit?: number): Promise<Uint8Array>;
  // text(), json(), stream(), consumed, contentLength, contentType unchanged
}
```

When `limit` is supplied, it is the value enforced for both the `Content-Length` pre-check and
the incremental streaming check; when omitted, the source's construction-time `options.limit`
governs (today's behavior, unchanged).

## Motivation

The body-parser audit (`report/middleware-body-parser-review.md`, finding BP-A) found that a
parser's configured `limit` never reaches the reader. `NodeContext` builds
`new NodeBodySource(req)` with no options, so the adapter's incremental limit is always the 1 MB
`DEFAULT_BODY_LIMIT`, and `readBody` calls `buffer()` with no argument. The parser's limit is
applied only as a post-materialization length check. Consequences:

- A configured limit **> 1 MB** is silently capped at 1 MB — the stream is destroyed at 1 MB and a
  legitimate request is rejected, with an error message citing the (larger) configured limit.
- A configured limit **< 1 MB** provides no incremental protection — up to 1 MB is buffered before
  the post-read check rejects, a memory-amplification vector under concurrency.

The adapter owns the read *mechanism* (and must, per runtime); the parser owns the *policy* (the
configured limit). The only clean way to unite them is to let the policy flow to the mechanism.

## Contract

- `buffer(limit?: number)`: optional, non-negative byte count. Precedence: `limit ?? options.limit`.
- Enforcement points are unchanged (Content-Length pre-check + incremental running-total +
  `destroy` on breach); only the value they compare against changes.
- The over-limit error MUST report the limit that actually fired (the effective limit), so
  diagnostics are honest.
- Read mechanism, `consumed`/cache semantics, and stream lifecycle are unchanged.
- All implementations honor it identically: `NodeBodySource` (standalone) and `AbstractBodySource`
  (base for `WebBodySource` on Bun/Deno/Edge). Cross-adapter parity is asserted by the conformance
  suite.
- Additive and backward-compatible: existing no-argument callers and the adapter default are
  unchanged.

## Alternatives considered (rejected)

- **Construct the source with the limit in the adapter.** The context is built before routing, so
  the adapter cannot know the per-route parser limit at construction time.
- **A stateful `setLimit(n)` setter before `buffer()`.** Introduces a read-before-set ordering
  hazard and mutable per-request state for no gain over an argument.
- **Body-parser drains `stream()` and enforces the limit itself.** Reimplements the adapter's tuned
  event-listener reader in middleware, duplicating lifecycle/cleanup and risking Node/Web
  divergence — the opposite of the `BodySource` seam's purpose.

## Migration

Additive; no consumer migration required. Applications that set a body-parser `limit` will observe
it now taking real effect (larger limits honored, smaller limits enforced incrementally). Release
notes present this as a correctness/security fix, not a breaking change. Rollback is trivial:
`readBody` reverts to calling `buffer()` with no argument.

## Validation

Cross-adapter conformance test for `buffer(limit)` over-limit rejection; body-parser tests for the
> 1 MB / < 1 MB cases and honest error limit; per-package coverage ≥ 90%; POST-JSON `--profile full`
A/B shows no regression from the correctness fix.

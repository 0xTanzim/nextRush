## Why

The `body-parser-limit-and-hot-path-fixes` change closed the POST-JSON gap to ~2.6–2.9% behind
Fastify/Hono (clean pinned run) and fixed the limit-enforcement defect (BP-A). Two things remain
before the request/response hot path is genuinely best-in-class:

1. **A correctness gap surfaced during that work (BP-K):** when a *chunked* over-limit body is
   rejected mid-stream, the Node adapter calls `req.destroy()` before the `413` response flushes,
   so the client sees `ECONNRESET` instead of a clean `413`. Per-parser small limits (now enabled
   by BP-A) hit this streaming path far more often, so it matters more than before.
2. **The remaining ~23% POST overhead vs raw Node is structural** — not body parsing, but the
   per-request async layering on the read and, dominantly, response serialization (`JSON.stringify`
   vs Fastify's schema-compiled `fast-json-stringify`). This is the lever that actually separates
   Fastify on POST.

## What Changes

- **[T2 / BP-K] Graceful mid-stream over-limit rejection (correctness).** On a streaming limit
  breach, the Node adapter SHALL emit the `413` and end the response *before* tearing down the
  socket, so clients receive a proper `413`, not a transport reset. Cross-adapter parity checked.
- **[T3a] Collapse the body-read async frame (throughput, measured).** Fold `readBody` into the
  parser so the POST path drops one `async` frame / promise (`json()` → `readBody` →
  `bodySource.buffer(limit)` → inner Promise is ~3–4 frames today). Behavior-identical;
  **kept only if an allocation/A-B micro-bench shows a measurable win**, reverted otherwise.
- **[T3b] Optional schema-compiled response serialization (throughput) — RFC-gated, phased.** An
  opt-in compiled serializer for `ctx.json` on hot routes (the `fast-json-stringify` equivalent),
  the biggest remaining POST lever. **Requires a new RFC (018) before implementation** — it adds
  public API (schema registration) and is cross-adapter. This change scopes the *investigation +
  RFC*, not the implementation, unless the RFC lands.

## Capabilities

### New Capabilities
<!-- none yet — T3b may justify a `response-serialization` capability, but that decision is
     deferred to RFC 018 rather than pre-committed here. -->

### Modified Capabilities
- `node-adapter`: mid-stream over-limit rejection returns a clean `413` before socket teardown
  (BP-K). (T3a is an internal frame-collapse with no observable behavior change → tasks/design
  only. T3b response serialization is RFC-gated and not a spec delta until RFC 018 is approved.)

## Impact

- **Packages:** `@nextrush/adapter-node` (`NodeBodySource` breach path, `NodeContext` response),
  `@nextrush/body-parser` (`reader.ts` frame collapse), `packages/adapters/conformance` (413-parity),
  and — only if RFC 018 lands — `@nextrush/core`/adapters for the compiled serializer.
- **Behavior change:** a chunked over-limit request now yields `413` instead of `ECONNRESET`.
  Additive; no API break.
- **RFC prerequisite:** T3b requires `docs/RFC/request-data/018-response-serialization.md`
  approved before any serializer implementation. T2 and T3a are not RFC-gated.
- **Validation:** conformance 413-parity across adapters; POST-JSON `--profile standard`/pinned
  A/B for T3a (measured, revert-if-neutral); allocation micro-bench for the dropped frame.

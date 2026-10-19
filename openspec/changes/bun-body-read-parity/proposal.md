# Proposal

## Why

Bun POST is the largest measured runtime gap: 30.50 µs/request versus Hono's 4.02 µs (7.58×), while the same framework is faster than Hono on Node (13.98 µs vs 16.34 µs). Profiling isolates almost all of the Bun gap to `WebBodySource._buffer`: a JS `ReadableStream` reader loop plus `releaseLock` costs ~27 µs for a 1 KB body, while native `request.text()`/`arrayBuffer()` costs ~0.3–1.4 µs. Bun and Deno share this reader; Node has its own event-listener body source and is unaffected. GET on Bun is 1.0–1.39× Hono and stays within its committed budget, so the POST body-read path is the focused target.

## What Changes

- Add a native body-read fast path to `WebBodySource` when an honest `Content-Length` is present and does not exceed the effective limit.
- Keep the incremental reader loop for chunked, absent, understated, or over-limit bodies, preserving RFC-017 memory-DoS protection and the existing `BodyTooLargeError` contract.
- Preserve `BodySource` semantics exactly: consumed/cache behavior, caller-limit precedence, `rawBody` bytes, content-type handling, and cross-adapter parity.
- Record before/after profile evidence and ratchet the Bun POST budget only after the measured win lands.
- Defer Bun GET/wire allocation trims and any direct-route fast path to a separate, profile-gated change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. Observable body-parsing behavior is unchanged; this is a measured implementation optimization. The change sets `skip_specs: true` because no requirement changes.

## Impact

- `packages/runtime/src/body-source.ts` (`WebBodySource`).
- Bun and Deno adapter body-reading tests; body-parser behavior-matrix tests; cross-adapter conformance.
- `apps/benchmark/scripts/dev-check` Bun POST budget and profile evidence.
- Durable decision: an RFC and ADR are required before implementation (adapter behavior is RFC-gated). Planned as RFC-043 and ADR-0031; they record the fast-path conditions, the rejected alternatives, and the security boundary for native reads.
- No public API change, no new dependency, no schema change.

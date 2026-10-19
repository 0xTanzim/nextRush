# ADR-0031 — Native body reads for provable-length Web requests

- **Status:** `Accepted`
- **Date:** `2026-10`
- **Deciders:** NextRush maintainers
- **Governing RFC:** `docs/RFC/runtime-adapters/043-web-native-body-read.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `RFC-017`, `ADR-0029`, `ADR-0030`

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped` · `[█████████████░░░░░░░]` **Accepted** — 2 / 3

---

## Context

Bun POST measured 30.50 µs per 1 KB JSON request versus Hono's 4.02 µs (7.58×), while the same framework measured 13.98 µs versus Hono's 16.34 µs on Node. Deno, which shares the Web body source, measured 40.70 µs versus 4.65 µs. Profiling put almost the entire Bun gap in `WebBodySource._buffer`: a JS `getReader()` loop plus `releaseLock` cost 18.65 µs for 1 KB, while native `request.arrayBuffer()` cost 1.40 µs and `request.text()` cost 0.33 µs. The framework, router, validator, and response builder were each below 1% of the POST profile. Node uses a separate event-listener body source and is not affected.

RFC-017 requires the configured body limit to be enforced incrementally when the body size cannot be known up front. Any fast path must preserve that guarantee.

## Decision

**Use native `request.arrayBuffer()` in `WebBodySource._buffer` only when an honest `Content-Length` is present and is less than or equal to the effective limit; keep the incremental reader for every other body.**

Because the declared length then proves the whole body fits, a single native read cannot violate the configured memory bound. Chunked, absent, understated, and over-limit bodies stay on the existing reader loop, so RFC-017 incremental enforcement is unchanged. `AbstractBodySource.buffer(limit)` remains the only owner of the content-length pre-check, consumed/cache state, post-read length check, and error mapping. `NodeBodySource` and the public `BodySource` surface are untouched.

## Options considered

- **Native `arrayBuffer()` when the length is provable** — ✅ chosen: removes the measured Bun/Deno reader cost while preserving the limit boundary; no public API change; Node unaffected.
- **Always use native read, then check the size** — ❌ rejected: a chunked or understated body could buffer far beyond the configured limit before rejection, violating RFC-017.
- **Call `request.json()`/`request.text()` from the body parser** — ❌ rejected: bypasses `BodySource` limit/cache/`rawBody` semantics and creates a second read path outside the shared abstraction.
- **Keep the reader and optimize `releaseLock()`** — ❌ rejected: `releaseLock` alone measured ~4.4 µs and the remaining reader machinery is ~12 µs; it treats a symptom.
- **Do nothing** — ❌ rejected: Bun POST stays at 7.58× Hono and Deno at 8.76× while Node wins, leaving the largest measured runtime gap unexplained and unguarded.

## Consequences

- **Positive:** measured Bun POST 26.74 → **11.87 µs** median (ratio 6.22 → **2.65**, three CPU-pinned runs, faithful harness); Deno 48.32 → 25.24 µs on the shared source; Node control unchanged at 0.77× Hono; no public API, configuration, or dependency change.
- **Negative / cost:** `WebBodySource._buffer` gains a second branch and a larger behaviour matrix; the fast path buffers the whole body, which is acceptable only because the declared length proves it fits. The change does not address GET/wire overhead.
- **Neutral:** the body parser still decodes and parses after the read, so the floor is the native read plus `TextDecoder`/`JSON.parse`, not zero.
- **Follow-up:** wire POST is measured by `dev-check` (`wire.post.*`): Bun 9.07k → 22.06k rps (**2.43×**), throughput ratio to Hono 0.32 → 0.77 (`report/performance/bun-body-read-baseline.md` §5.7). A `request.text()` fast path was not taken because the after-profile shows `parse` and native `arrayBuffer` leading, not decode. The `inproc.post.nextrush.vs_hono` budget is ratcheted to max 3.5 / target 3.0 from the measured three-run spread.

## Compliance / enforcement

`packages/runtime/src/__tests__/body-source.test.ts`, the Bun/Deno adapter body-source tests, and `packages/middleware/body-parser/src/__tests__/limit-and-hotpath.test.ts` pin both paths and the edge cases. `packages/adapters/conformance` pins cross-adapter observable parity. The `dev-check` `inproc.post.nextrush.vs_hono` budget is ratcheted after the measured win, so a regression fails the gate rather than being reported as a warning.

---

## Checklist

- [x] One decision only.
- [x] Context states the forces/trigger without pre-empting the decision.
- [x] Decision is in the active voice with its primary reason.
- [x] Options list includes the chosen one, ≥1 alternative, and "do nothing".
- [x] Consequences include at least one real negative/cost.
- [x] Compliance/enforcement names a concrete mechanism.
- [x] Lifecycle progress bar reflects the current Status field.
- [x] Governing RFC linked.
- [x] All guidance blocks deleted; document is terse.
- [x] Registered in docs/adr/INDEX.md.

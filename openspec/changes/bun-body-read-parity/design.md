# Design

## Context

See `proposal.md` — Why. The measured facts that shape this design:

- Bun POST: 30.50 µs vs Hono 4.02 µs. Node POST: 13.98 µs vs Hono 16.34 µs (NextRush wins).
- Decomposition on Bun: no body read 3.06 µs; `WebBodySource.buffer()` only 29.89 µs; native `arrayBuffer()` only 7.61 µs; native read + parse 5.0–6.6 µs.
- Isolated primitives (1 KB): `request.text()` 0.33 µs, `request.arrayBuffer()` 1.40 µs, raw reader loop 11.83 µs, reader + `releaseLock` 16.21 µs, `WebBodySource.buffer()` 18.65 µs.
- Bun and Deno share `WebBodySource`. Node uses `NodeBodySource` (event listeners) and is out of scope.
- `AbstractBodySource.buffer(limit)` already performs the content-length pre-check, marking `_consumed`, then calls the subclass `_buffer(limit)`, then checks the resulting length and caches it.

The existing contract that must not move:

- `body-parser` enforces the configured limit incrementally for chunked / absent / understated `Content-Length` bodies (RFC-017).
- `NodeBodySource.buffer()` semantics and read mechanism stay unchanged.
- `WebBodySource` honors the same optional-limit contract across Bun/Deno/Edge.
- `rawBody`, content-type handling, `BodyConsumedError`, cached re-reads, and error mapping are unchanged.

## Goals / Non-Goals

**Goals:**

- Remove the JS `ReadableStream` reader path from the common honest-`Content-Length` Web-request case.
- Keep the incremental reader path for every case where the body size cannot be proven up front.
- Produce a measured Bun POST win with before/after profiles, without changing observable behavior.
- Keep Node performance untouched and prove Denis parity.

**Non-Goals:**

- Bun GET/wire allocation trims, drain-wrapper removal, or direct-route fast path. Separate change, profile-gated.
- Changing `NodeBodySource`, body-parser detection/validation, or the public `Context`/`BodySource` surface.
- AOT, compiled validators, or a custom JSON serializer.
- Changing streaming reads (`ctx.bodySource.stream()`).

## Decisions

### D1 — Native fast path lives in `WebBodySource._buffer`, gated on a provable length

When `contentLength !== undefined && contentLength <= limit`, call `request.arrayBuffer()` once and return `new Uint8Array(buffer)`. Otherwise keep the current reader loop.

Why: it is the smallest change that removes the measured cost, it preserves the `BodySource` contract (still returns bytes), and it leaves every unprovable case on the existing incremental path.

Alternatives rejected:

- **Always use native read, then post-check.** Rejected: a chunked or understated body could buffer far beyond the configured limit before rejection, violating RFC-017 and the body-parser requirement.
- **Change `body-parser` to call `request.json()`/`text()` directly.** Rejected: bypasses `BodySource` limit/cache/rawBody semantics and breaks parity with direct parser APIs and other adapters.
- **Keep the reader loop and optimize `releaseLock`.** Rejected: `releaseLock` alone measured ~4.4 µs, and the remaining reader machinery is still ~12 µs; it treats a symptom, not the mechanism.

### D2 — Do not add a `text()` fast path yet

`request.text()` measured faster than `arrayBuffer()` (0.33 vs 1.40 µs), but `BodySource` must return bytes for `rawBody`, urlencoded, and binary parsers. Start with `arrayBuffer()`; if the after-profile shows decode dominating, evaluate a separate text fast path in the body-parser layer as a follow-up. This keeps the first change small and behavior-neutral.

### D3 — Preserve `AbstractBodySource` as the single owner of consumption and caching

`_buffer` only chooses the platform read. `buffer(limit)` continues to own the content-length pre-check, `_consumed`, post-read length check, and cache. The fast path must not mark or cache anything itself.

### D4 — Measurement gate before and after

Before implementation, capture the current `dev-check` Bun POST number and the `inproc-nextrush-post` profile. After implementation, run the same commands on the same machine and record both. The change is accepted only if:

- Bun POST improves materially (target ~5–10 µs; expected from the native-read measurement), and
- Node and Deno do not regress, and
- the full behavior matrix and cross-adapter conformance pass.

The Bun POST budget is ratcheted only after the measured win, with headroom for run variance.

### D5 — RFC/ADR before code

The repository treats adapter behavior changes as RFC-gated. Implementation starts only after [RFC-043](../../../docs/RFC/runtime-adapters/043-web-native-body-read.md) and [ADR-0031](../../../docs/adr/ADR-0031-web-native-body-read.md) record the fast-path conditions, the security boundary, and the rejected alternatives. The change's tasks run those first.

## Risks / Trade-offs

- **Understated/lying `Content-Length`** → The fast path is only taken when the declared length is ≤ the effective limit; the platform HTTP parser and the adapter's `maxRequestBodySize` remain the outer bound. Keep the post-read length check and add a test where the declared and actual lengths disagree at the platform layer.
- **Native read buffers the whole body** → Bounded by the declared length and the effective limit; chunked/unknown-length bodies stay on the incremental reader. Document this in the RFC/ADR.
- **Bun vs Deno behavior drift** → Add the same behavior-matrix tests to both Web adapters and run cross-adapter conformance.
- **In-process win may not translate to wire** → Record a wire measurement after the change before claiming parity; if wire does not improve, do not ratchet the wire expectations.
- **`arrayBuffer()` rejection mapping changes** → Map platform read failures through the existing `BodyReadError` path; add a failing-body test.
- **Body source construction still happens eagerly for POST** → Not addressed here; it is a separate allocation trim and must be profile-justified.

## Migration Plan

Internal only. No public API, schema, or configuration change. Rollback is reverting the fast-path branch; the incremental reader remains the fallback in the same function. Ship behind the default behavior; no feature flag.

## Open Questions

- Does a `text()` fast path in the body-parser layer materially beat `arrayBuffer()` after this change? Deferrable; answer with the after-profile.
- Does the Bun wire POST path show the same win? Deferrable; measure after the in-process gate passes.

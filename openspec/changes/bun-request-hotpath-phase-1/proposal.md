# Proposal

## Why

Bun POST is still the largest measured runtime gap after RFC-043 and RFC-044. The committed in-process probe measures the current runner at **9.91–10.40 µs** for a 1 KB JSON request, while a native floor (`request.json()` + `Response.json()`) is **2.47–2.57 µs**. Three removable costs account for most of the difference:

- The JSON body is read into bytes and decoded back to text: `ctx-body-source` 6.07 µs versus `ctx-text-json` 3.81 µs.
- Every async dispatch creates a settlement promise, spins four microtasks, and races a per-request timer: `full-hybrid` 9.88 µs versus `full-callback` 7.39 µs.
- The combined JSON branch is a five-await chain around one read: the parser layer adds roughly 1.2 µs over `ctx-body-source`.

Node is already faster than Hono (13.98 µs vs 16.34 µs) and keeps its own event-listener body source. Bun, Deno, and Edge share the Web body source, so the change is scoped to the Web path and the shared JSON parser. The full evidence is in `report/performance/bun-native-gap-analysis.md` (F-01, F-02, F-03) and RFC-045.

## What Changes

- Add an internal `WebBodySource.textWithinLimit(limit)` capability and use it from `WebBodySource.text()`; it is not added to the public `BodySource` interface.
- Use one native `request.text()` read for JSON bodies when the source is UTF-8, a `Content-Length` is present at or below the limit, and neither `rawBody` nor `verify` needs bytes. Enforce the configured limit against actual UTF-8 bytes; fall back to `BodySource.buffer(limit)` for chunked/absent/understated bodies, non-UTF-8 encodings, and byte consumers.
- Add a body-parser `readText` helper and one shared `parseJsonPrechecked`/`parseJsonText`/`parseJsonBuffer` path. Route `combined()` directly to the prechecked JSON function after its single content-type detection.
- Replace the timeout settlement promise with a bounded committed-response check followed by a direct `Promise.race`; keep the 504 body, `ctx.triggerTimeout()`, the warning, and the late-committed-response behavior. Timer-skip is keyed to `ctx.responded`, matching the Node adapter's fast path; a handler that settles without committing may arm a timer that the race immediately clears.
- Keep `BodySource.buffer(limit)`, `rawBody`, `verify`, the public `BodySource` shape, Node's `NodeBodySource`, and all adapter contracts unchanged.
- Record the Phase 1 decision as RFC-045 and ADR-0033 before this change is archived. Do not include route specialization (F-05), AOT/code generation, a shared timer wheel, or Elysia 2 RC.

This change is **design-only** until review approval. No production code is written or modified by this proposal.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `body-parser` — add the limited text read and identical JSON semantics on the text and buffer paths; preserve the configured byte limit, `rawBody`, `verify`, strict mode, depth, error shapes, and `next()` ordering.
- `web-adapters` — add the internal Web limited text capability and the timeout dispatch shape; preserve the public `BodySource` contract, the shared runner, the 504/signal/late-response behavior, and cross-adapter parity.

## Impact

- `packages/runtime/src/body-source.ts` (`WebBodySource` cache/consumed state and limited text read).
- `packages/runtime/src/web-runner.ts` (`dispatchWithTimeout`).
- `packages/middleware/body-parser/src/parsers/reader.ts`, `json.ts`, `combined.ts`.
- Bun/Deno/Edge adapter tests, body-parser behavior-matrix tests, runtime runner tests, and cross-adapter conformance.
- `apps/benchmark/scripts/dev-check` Bun POST evidence and the committed budget; no budget ratchet without a measured win.
- Public API: no change. No new dependency. No schema change.
- Durable decision: RFC-045 (`docs/RFC/runtime-adapters/045-bun-request-hotpath-phase-1.md`) and ADR-0033 before archive.

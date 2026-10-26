# ADR-0033 — Bun request hot path: internal limited text reads, bounded timeout dispatch, and one shared JSON read/parse tail

- **Status:** `Accepted · Shipped`
- **Date:** `2026-10`
- **Deciders:** NextRush maintainers
- **Governing RFC:** `docs/RFC/runtime-adapters/045-bun-request-hotpath-phase-1.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0021`, `ADR-0028`, `ADR-0029`, `ADR-0030`, `ADR-0031`, `ADR-0032`, `RFC-017`, `RFC-043`, `RFC-044`, `RFC-045`

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped` · `[████████████████████]` **Shipped** — 3 / 3

---

## Context

After RFC-043 (native `arrayBuffer()` for provable-length bodies) and RFC-044 (Bun drain and address trims), the remaining Bun POST gap was inside the read, not the adapter. A 1 KB JSON body was read as bytes, decoded back to text, and parsed; the parser layer added a multi-await chain around one read, and every async dispatch paid one extra microtask hop awaiting a settlement promise the runner only used to decide between a 504 and a normal response.

Measured before the change: Bun in-process POST 9.91–10.40 µs, and — measured side by side, as headroom rather than as a before/after — `ctx-body-source` 6.07 µs versus `ctx-native-json` 3.77 µs for the same JSON, with the parser layer adding roughly 1.2 µs over the body source. The constraints were non-negotiable: the body limit is a byte limit, `rawBody` and `verify` must see the original bytes, the 504/abort/late-response contract must not move, and `@nextrush/runtime` must stay free of `node:*` and runtime-name branches.

---

## Decision

**Adopt three internal, additive changes behind the existing contracts.**

1. **Internal limited text read** — `WebBodySource.readTextIfProvenWithin(limit)` uses one native `request.text()` only when the source is UTF-8, a `Content-Length` is present, and it is at or below the limit; every other case declines _without consuming_, so the incremental byte reader keeps its turn and its error contract. The declared length is a pre-check, not proof: the post-read check compares actual UTF-8 bytes using a code-unit lower bound, a `×3` upper bound, and an exact encode only in the band between them.
2. **Bounded timeout dispatch** — `dispatchWithTimeout` keeps the `dispatch.then(...)` settlement promise as the race handle and the late-rejection guard, but no longer awaits it unconditionally: it checks `done`/`failed` after a bounded microtask window, then races the settlement against the timer. A dispatch that settles quickly arms no timer; a committed response at the deadline is still delivered instead of a 504.
3. **One shared JSON read/parse tail** — the body-parser JSON branch selects a text or byte read, then runs one shared parse/strict/depth/error path, so `bodyParser()` and standalone `json()` cannot drift.

Because the body is already text in the common JSON case, decoding it twice in framework code was pure cost; because the runner's only question is "504 or not", awaiting a settlement promise it already observes was a wasted microtask turn; because two JSON paths would eventually disagree, one tail is cheaper to keep correct than two.

---

## Options considered

- **Chosen: internal capability + bounded dispatch + shared tail** — ✅ keeps the public `BodySource` shape, enforces bytes exactly, and removes one `Uint8Array`, one decode, and one per-request microtask hop.
- **`text(limit?)` on the public `BodySource`** — ❌ rejected: an implementation may ignore the optional limit, silently accepting an over-limit body.
- **`request.clone()` plus a dual read** — ❌ rejected: doubles the platform read and buffers the body for a caller that usually never asks for bytes.
- **`Buffer.byteLength` for the exact check** — ❌ rejected: not portable to edge runtimes; `TextEncoder` is the Web-standard counterpart and only runs in the uncertain band.
- **Drop the settlement promise entirely** — ❌ rejected: it is the race handle and what keeps a late rejection observed; removing it would reintroduce an unhandled rejection path.
- **Do nothing** — ❌ rejected: the measured gap is in framework-owned work, not the platform, so it would stay unexplained and unguarded.

---

## Consequences

- **Positive:** a side-by-side probe puts the buffer-path JSON body read 2.3 µs above native `request.json()` (6.07 vs 3.77 µs) — the headroom this change targets, not a measured before/after of the shipped path; eligible reads allocate no framework-side `Uint8Array` (confirmed by the POST profile: `arrayBuffer` and `decode` no longer appear), and one microtask hop per async dispatch is gone; full in-process POST measures 8.18–9.41 µs across two close-out runs against a recorded 9.91–10.40 µs baseline (ratio versus Hono 1.9–2.15, target 3); `rawBody`/`verify` and the 504/abort contract are unchanged; no public API, option, or error code changed.
- **Negative / cost:** `WebBodySource` carries a second read path and a cache, so `text()` then `buffer()` can return canonical UTF-8 bytes rather than the original octets — acceptable because byte-sensitive callers never take the text path, and documented in `packages/runtime/ARCHITECTURE.md`. The settlement promise is still allocated on every async dispatch; only its unconditional `await` was removed.
- **Neutral:** the GET ratio warning band (target 1.3) is unchanged and pre-existing; wire numbers remain directional, not a budget.
- **Outcome (measured):** the full-request figures are recorded baselines rather than a same-invocation A/B, and two close-out runs (8.18 µs, 9.41 µs) overlap that baseline once run-to-run spread is counted — so the change rests on the isolated read probe, the removed allocation, and the removed microtask hop, not on the full-POST number. Suites green: runtime 379, body-parser 320, adapter-bun 129, adapter-deno 123, conformance 436. Full dev-check gate: `FAIL 0`, no new `KNOWN`.
- **Follow-up:** route specialization and a shared timer wheel remain separate, evidence-gated RFCs; the response-finalization and route-parameter candidates were measured and rejected (`report/performance/bun-response-finalization-phase6.md`, `report/router/route-params-profile.md`).

## Compliance / enforcement

`packages/runtime/src/__tests__/body-source-text-path.test.ts` and `body-size-guard.test.ts` pin eligibility, decline-without-consuming, exact byte rejection, and the text/buffer cache order; `web-runner-timeout-contract.test.ts` pins committed-versus-settled behavior, the 504 path, rejection before/after the deadline, `timeout: 0`, and the no-timer fast path; `web-context-base.test.ts` pins the abort reason and client-disconnect propagation; `packages/middleware/body-parser/src/__tests__/json-text-path.test.ts` and `limit-and-hotpath.test.ts` pin text/byte parity, `rawBody` byte fidelity, and incremental limit rejection on a chunked body; `@nextrush/adapter-conformance` pins cross-adapter observable parity; `apps/benchmark/scripts/dev-check` supplies the in-process gate (Bun `FAIL 0`, Node/Deno `FAIL 0`, no new `KNOWN`).

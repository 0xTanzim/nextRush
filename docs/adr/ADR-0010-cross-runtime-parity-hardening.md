# ADR-0010 — Cross-runtime observable-parity hardening (per-cell real-runtime proof + timeout/shutdown convergence)

- **Status:** `Accepted`
- **Date:** `2026-07`
- **Deciders:** Runtime Platform Architect; adapter maintainers
- **Governing RFC:** `docs/RFC/runtime-adapters/013-adapter-contract.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0007` (enforced adapter contract & serverless execution/event-format separation)

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped`  ·  `[█████████████░░░░░░░]` **Accepted** — 2 / 3

---

## Context

The runtime-platform review (`report/adapters/runtime-platform-review.md`, commit `6ab26e9`;
tracked in `docs/audits/08-runtime-compatibility-gap-analysis.md`) found the adapter layer mature
but the cross-runtime *guarantee* weaker than advertised. Three forces demand an architectural
decision before the fixes land, because each is an adapter-surface or contract change that
`013-adapter-contract.md` and repo governance (§20/§21) gate behind an ADR:

1. The full behavioral conformance contract runs only under the in-process simulation; the
   real-runtime runners (Bun/Deno/workerd) assert 3–5 basic behaviors, yet the certification
   matrix stamps one `real-runtime` badge per whole column. The "proven" claim outruns the proof.
2. Request timeout is observably different on Node (socket-level teardown, no HTTP status) vs a
   clean `504` on every other runtime — the same app fails a slow request differently per runtime.
3. Signal-wired graceful shutdown exists only on the Node adapter; Bun and Deno drain in-flight
   requests in `close()` but expose no way to trigger it from `SIGTERM`/`SIGINT`.

---

## Decision

We will treat **observable cross-runtime parity as the contract, proven per-behavior on the real
runtime**, and converge the two divergences that block a single contract. Three numbered
sub-decisions:

1. **Proof is per-cell, and `real-runtime` proof requires executing the shared suite on the real
   runtime.** The `bun`/`deno`/`workerd` runners execute the same `defineConformanceSuite` behavior
   set as the in-process suite (not a hand-written subset). The certification matrix carries a
   per-feature×runtime proof level (`real-runtime` / `simulated` / `capability-only`); `full`/green
   is reserved for `real-runtime` cells, and a feature inferred only from a `capabilitiesFor()` bit
   with no executed assertion is `capability-only`, never `proven`.
2. **The Node adapter adds a handler-level timeout → clean `504`, retaining `server.timeout`.** The
   two are complementary: the handler race yields a status-bearing `504` that client retry logic can
   key on; the socket timeout remains as the slow-client/slow-loris guard. The `504` is suppressed
   if the handler already committed the response. This is an observable behavior change (connection
   reset → `504`), with `timeout: 0` as the escape hatch to prior behavior (OQ-2 resolved:
   **on by default**, documented in the adapter README).
3. **Bun and Deno `serve()` gain the same additive `gracefulShutdown` option shape as Node**, wiring
   signals to their existing in-flight drain. The option *shape* is identical across the three
   server adapters even where the internal signal wiring differs (OQ-3 resolved: the public shape is
   shared; Deno's differing signal API is an implementation detail behind it).

Because the review found the divergences are **documented but eliminable**, not platform-forced —
and each has a concrete client-facing problem, not merely "a different design exists."

_OQ-1 resolved: the Edge default request timeout is **25 000 ms** — below the tightest common edge
wall limit (Vercel Edge 25 s), above typical handler durations — a documented named constant,
overridable, disable via `0`._

---

## Options considered

- **Per-cell proof + converge timeout/shutdown** — ✅ chosen: closes the claim-vs-proof gap and
  yields one observable contract with a concrete client-facing benefit per change.
- **Keep per-column proof, expand the hand-written real-runner subsets** — ❌ rejected: the subsets
  drift from the contract by construction (the exact failure the review names).
- **Replace Node `server.timeout` with the handler race** — ❌ rejected: drops the slow-loris guard
  (a security regression).
- **Do nothing** — ❌ rejected: the framework's core promise (build once, run anywhere) rests on a
  parity guarantee that is currently overstated and unproven on the non-Node runtimes.

---

## Consequences

- **Positive:** a runtime-specific response-translation bug on Bun/Deno/workerd can no longer ship
  undetected; the timeout and shutdown contracts become uniform; the published matrix stops
  overstating support.
- **Negative / cost:** the Node timeout `504` is an observable behavior change (mitigated by
  `timeout: 0` + README/migration note); real-runtime CI jobs run more assertions (more wall time);
  the Bun/Deno `ServeOptions` surface grows by one additive field.
- **Neutral:** no new package, no new capability, no runtime-identity branching — still
  capability-negotiated.
- **Follow-up:** real WebSocket support on the edge adapters (WebSocketPair) remains future work;
  this ADR only stops the matrix from *claiming* it.

---

## Compliance / enforcement

Kept true by: the cross-adapter conformance suite executed on real Bun/Deno/workerd runners
(a divergence fails the runtime's CI job); the `nextrush/no-runtime-identity-capability` lint rule;
the compile-time `ServerAdapter`/`FetchAdapter`/`AdapterContextFactory` guards; and the
matrix generator asserting every `full`/`proven` cell maps to an executed `real-runtime` assertion.

---

## Checklist

- [x] One decision cluster (parity-hardening), sub-decisions numbered and cohesive under it.
- [x] Context states the forces/trigger (the three review findings) without pre-empting the decision.
- [x] Decision is in the active voice with its primary reason.
- [x] Options list includes the chosen one, alternatives, and "do nothing".
- [x] Consequences include real negatives/costs.
- [x] Compliance names concrete mechanisms (conformance on real runtimes, lint, type guards).
- [x] Lifecycle progress bar reflects Status = Accepted.
- [x] Governing RFC linked (`013-adapter-contract.md`).
- [x] Guidance blocks deleted; terse.
- [x] Registered in docs/adr/INDEX.md.

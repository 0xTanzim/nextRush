# ADR-0032 — Bun request-path trims: native drain accounting and thunk-free address resolution

- **Status:** `Accepted`
- **Date:** `2026-10`
- **Deciders:** NextRush maintainers
- **Governing RFC:** `docs/RFC/runtime-adapters/044-bun-request-path-trims.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `RFC-039`, `RFC-040`, `RFC-041`, `RFC-043`, `ADR-0028`, `ADR-0029`, `ADR-0030`, `ADR-0031`

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped` · `[█████████████░░░░░░░]` **Accepted** — 2 / 3

---

## Context

Bun wire throughput measured 34,513 rps versus Hono's 42,330 (0.82×), with Elysia at 49,887 and the raw listener at 47,968 in the same run; the in-process GET ratio was 1.29 (median of three CPU-pinned runs, spread 1.26–1.31) against a target of 1.3 and max of 1.9. Profiling attributed about 70% of request-path self-time to native `Request`/`Response`/`Headers` construction and 10–13% total to the `createBunContext` tree, with the two known adapter overheads below the print threshold.

Two costs were verified in code and measured with the repository allocation protocol: an `async` wrapper around every request that existed only to maintain a JS in-flight counter for graceful drain (392.4 B/req removed), and a per-request `() => server.requestIP(request)?.address ?? ''` closure created even when `ctx.ip` is never read (56.0 B/req removed). Live probes on pinned Bun 1.4.3 showed `server.stop()` returns a promise that holds while a request is in flight and resolves after it completes, and that `server.pendingRequests` tracks the same in-flight state.

The constraints: graceful-shutdown guarantees, `ctx.ip` laziness and parity, cross-adapter conformance, no Node change, no shared-runtime change, and wire staying INFO rather than becoming a budget.

## Decision

**Adopt the two evidence-backed Bun adapter trims, and require reproducible stage evidence for any further request-path candidate.**

1. **Drain accounting** — delete the per-request `trackedHandler` wrapper and the JS counter; `drainAndClose` awaits the native `server.stop()` promise raced against the configured timeout, force-closes with `server.stop(true)` on timeout, and keeps `app.close({ timeout })` last.
2. **Client-address resolution** — `createBunContext`/`BunContext` accept an optional platform server reference and resolve `ctx.ip` on first read through a prototype getter with a memoized result; `createBunRequestRunner` no longer allocates a closure. The existing three-argument form keeps today's behaviour.
3. **Acceptance rule** — wire-path claims require same-invocation before/after medians against the recorded spread (0.05 ratio points, ≈3.9%); sub-noise trims rest on deterministic allocation evidence plus tests and conformance; anything inside the spread is parked and reverted.

Because the platform already owns the in-flight signal, the JS counter duplicated state less accurately and cost an async frame per request. Because `ctx.ip` is lazy by contract, the closure was pure overhead on the common path. Both removals are deterministic and independently revertible, and the wire stage remains an INFO instrument rather than a gate.

## Options considered

- **Native drain promise + prototype-level lazy address** — ✅ chosen: removes 448.4 B/req of deterministic allocation, keeps every contract, stays inside the adapter, no shared-runtime change.
- **Keep a cheaper drain wrapper** — ❌ rejected: any `async` or `.finally()` wrapper still allocates and still duplicates platform state.
- **Poll `server.pendingRequests`** — ❌ rejected: a metric is not a signal; polling adds a timer and a second source of truth when `stop()` already resolves on drain.
- **Eager `ctx.ip` resolution** — ❌ rejected: pays `requestIP` on requests that never read the value and breaks the documented laziness.
- **Extend the shared `ClientAddress`/`RequestInputs` type** — ❌ rejected for this change: touches the shared runtime and every adapter to remove one adapter-local closure; revisit only if another adapter needs it.
- **Do nothing** — ❌ rejected: both costs are unconditional on the slowest runtime with near-zero-variance evidence; the gap would stay unexplained and unguarded.

## Consequences

- **Positive:** 392.4 B/req (drain wrapper) and 56.0 B/req (resolver thunk) of deterministic allocation removed from every Bun request; shutdown state simplifies; behaviour, conformance, and coverage stay intact; no public API break, configuration, or dependency.
- **Negative / cost:** the drain path now depends on a verified platform promise semantic and needs real-Bun graceful-shutdown coverage plus stub support; `BunContext` gains a getter override and fields, bypassing the base `RequestInputs` memoization in platform mode, so parity tests are mandatory; one additive optional parameter broadens the exported factory slightly.
- **Neutral:** the wire gap is not closed — native Web-object churn is platform-owned and out of adapter scope; `wire` remains INFO.
- **Outcome (measured):** both trims shipped behind RED tests; allocation deltas reproduced (389.8 + 56.0 B/req). Wire 36,632 vs 34,513 rps while Hono/raw drifted in the same run, and the pinned in-process median 1.32 vs 1.29 — both inside the recorded spread, so both claims are parked and no budget changed. Conformance green on Node/Bun/Deno; Bun/Node/Deno gates FAIL 0 with no new KNOWN.
- **Follow-up:** record after-numbers and park anything inside the spread; update `packages/adapters/bun/ARCHITECTURE.md`; revisit the trust-mode closure and serve/wire-level profiling as separate evidence-gated work.

## Compliance / enforcement

`packages/adapters/bun/src/__tests__/graceful-shutdown.test.ts` pins drain behaviour (in-flight wait, bounded timeout, force-close, opt-in signals, no handlers when omitted); `packages/adapters/bun/src/__tests__/per-request-work-trim.test.ts` and `context.test.ts` pin lazy, memoized, parity-correct `ctx.ip`; `packages/adapters/conformance` pins cross-adapter observable parity; the in-tree allocation harness and `apps/benchmark/scripts/dev-check` wire/in-process stages supply the before/after evidence, with the recorded spread as the parking threshold.

---

## Checklist

- [x] One decision only (with three numbered sub-decisions of the same adoption).
- [x] Context states the forces/trigger without pre-empting the decision.
- [x] Decision is in the active voice with its primary reason.
- [x] Options list includes the chosen one, ≥1 alternative, and "do nothing".
- [x] Consequences include at least one real negative/cost.
- [x] Compliance/enforcement names a concrete mechanism.
- [x] Lifecycle progress bar reflects the current Status field.
- [x] Governing RFC linked.
- [x] All guidance blocks deleted; document is terse.
- [x] Registered in docs/adr/INDEX.md.

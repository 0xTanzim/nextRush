# ADR-0012 — Bounded, per-hook-isolated `Application.close()` teardown

- **Status:** `Accepted · Shipped`
- **Date:** `2026-07`
- **Deciders:** Reliability hardening change (`harden-framework-reliability`)
- **Governing RFC:** `docs/RFC/class-runtime/022-bounded-teardown-lifecycle.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0010` (Node timeout→504 parity — a distinct, already-decided question this ADR
  does not re-litigate), `ADR-0002` (Extension Model)

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped`  ·  `[████████████████████]` **Shipped** — 3 / 3

---

## Context

A reliability audit (`report/reliability/reliability-framework-review.md`, commit `6ab26e9`) found
`Application.close()` tears down extensions with `Promise.allSettled` (correctly isolated across
extensions) but with **no time bound**, and that the class-runtime `OnShutdown` bridge
(`packages/class/src/lifecycle/lifecycle.ts`) runs its hooks in a bare sequential `await` loop with
**no per-hook error isolation** — so one hung `destroy()` hangs the process past its shutdown
window, and one throwing `onShutdown()` strands every later service's cleanup. Separately, no
subsystem outside the extension system (stateful middleware, the WebSocket server) has a lifecycle
hook at all, so their cleanup depends on a manual, easily-forgotten call. This forces a decision
because closing these gaps requires adding public API to `Application` — RFC-gated per repo
governance (AGENTS.md §20/§21).

---

## Decision

We will make `Application.close()` accept an optional teardown `timeout`, race every teardown unit
(extension `destroy()`, class `onShutdown()`, and a new `onClose(hook)` registration) against it in
isolation, and collect — never swallow — whichever units fail or time out. We will fix the class
`OnShutdown` bridge to match the app-level isolation guarantee it currently lacks, and offer the
WebSocket server as a self-disposing Extension.

Because a bounded, uniformly-isolated teardown converts "usually shuts down cleanly" into
"deterministically shuts down within budget, with every failure visible" — the actual production
failure mode the source review named (an orchestrator `SIGKILL` after a hung teardown; a process
that never exits because of an undisposed WebSocket heartbeat) — without breaking any existing
`close()` caller, since every addition is optional.

---

## Options considered

- **Uniform teardown-unit list (extension + class hook + `onClose`), one race/isolation mechanism** —
  ✅ chosen: one implementation instead of three, so the class bridge cannot drift from the app-level
  guarantee the way it already has.
- **A separate bounding mechanism per subsystem** — ❌ rejected: repeats the exact drift that caused
  problem 2 in the first place.
- **Middleware becomes an object `{ handler, dispose }`** — ❌ rejected: breaks the "middleware is a
  function" contract (AGENTS.md §3); `app.onClose` generalizes without that cost.
- **Do nothing** — ❌ rejected: leaves a confirmed process-hang and stranded-cleanup failure mode in
  production.

---

## Consequences

- **Positive:** shutdown becomes provably bounded; a throwing teardown hook can no longer strand
  every later hook; stateful middleware and the WebSocket server gain a deterministic disposal path.
- **Negative / cost:** one new optional parameter on `close()` and one new public method
  (`onClose`) — a small, permanent addition to the public surface; a timed-out unit may still leak
  the one resource it owned (mitigated by reporting it by name, not silently).
- **Neutral:** no new package; Bun and Deno's own drain mechanics (`server.stop()`/`shutdown()`) are
  unchanged — only the budget passed into their existing `app.close()` call changes.
- **Follow-up:** structured shutdown observability (draining state, per-unit duration) is a
  companion task in the same OpenSpec change, not part of this decision's public API.

---

## Compliance / enforcement

Kept true by: unit tests asserting a hung/throwing teardown unit is bounded/isolated (in
`@nextrush/core` and `@nextrush/class`); an integration test mirroring the existing
`graceful-shutdown.integration.test.ts` pattern with a deliberately-hanging hook; and the
cross-adapter conformance suite confirming Node/Bun/Deno all pass the same budget into
`app.close()`.

---

## Checklist

- [x] One decision only (bounded/isolated teardown across extension, class, and `onClose` hooks).
- [x] Context states the forces/trigger (the source review's four findings) without pre-empting the decision.
- [x] Decision is in the active voice with its primary reason.
- [x] Options list includes the chosen one, an alternative, and "do nothing".
- [x] Consequences include a real negative/cost (a new permanent public-API surface; possible leak on timeout).
- [x] Compliance/enforcement names concrete mechanisms (tests + conformance suite).
- [x] Lifecycle progress bar reflects Status = Accepted.
- [x] Governing RFC linked (`022-bounded-teardown-lifecycle.md`).
- [x] Guidance blocks deleted; terse.
- [x] Registered in docs/adr/INDEX.md.

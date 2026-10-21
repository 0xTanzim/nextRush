# ADR-0035 — One shared timer serves the request deadline

- **Status:** `Accepted · Shipped`
- **Date:** `2026-10`
- **Deciders:** `NextRush maintainers`
- **Governing RFC:** `docs/RFC/runtime-adapters/046-json-media-type-and-response-construction.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0031`, `ADR-0033`, `RFC-045`

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped` · `[████████████████████]` **Shipped** — 3 / 3

---

## Context

The Web adapters armed one `setTimeout` per request that had not settled inside the microtask
settle window, and cleared it when the request finished. A request that waits on I/O — a body read,
a database call — is still pending when the timeout window opens, so the timer was armed for every
such request.

The cost of that timer is not uniform across runtimes. `setTimeout` plus `clearTimeout` measured
**2.151 µs on Deno**, 0.453 µs on Node, and 0.160 µs on Bun — thirteen times cheaper on Bun than on
Deno. Measured end to end against the same bundle with the race disabled, the race cost **8.28 µs
of server CPU per request on Deno POST (+29.8 %)**, 3.17 µs on Bun (+14.6 %), and 0.97 µs on Node
(+2.6 %).

The deadline itself does not need a timer per request: one timer can serve every pending deadline.

---

## Decision

**We will serve the request deadline from one shared timer per runner, and we will never cancel
that timer per request.**

Because the per-request timer was the cost, and a shared timer only stays shared if it survives a
request settling, the timer is released by the sweep that finds no pending deadline — not by the
request that finished. The timer wakes on a bounded window (≤ 100 ms) and arms the exact remaining
time once a deadline is within that window, so the deadline is honoured at the deadline and a
runner with nothing pending holds no timer.

The deadline's observable behaviour is unchanged: a handler that does not settle is answered with
`504 Gateway Timeout` and its `ctx.signal` is aborted, a handler that committed a response before
the deadline keeps that response, a rejection arriving after the deadline is observed rather than
left unhandled, and a dispatch that settles inside the settle window still arms no deadline at all.

**Because the Web runner is shared by Bun, Deno, and Edge, the change is one change for three
runtimes.** The Node adapter keeps its own race — it coordinates with the socket-level
`server.timeout` guard, which the shared scheduler does not model — so Node is unaffected by this
decision.

---

## Options considered

- **Keep one timer per request** — ❌ rejected: measured at 8.28 µs per request on Deno POST and
  3.17 µs on Bun.
- **One shared timer, cancelled when the last pending deadline goes away** — ❌ rejected on
  measurement: the pending set empties between requests on a saturated server, so the "cancel and
  re-arm" path *was* the per-request path, with the bookkeeping added on top — a 1.01 µs regression
  (3/3 pairs in the wrong direction).
- **A shared timer that is never cancelled and wakes on a bounded window** — ✅ chosen: the timer
  is created once and swept, the cost is a handful of timer operations per second, and the deadline
  stays exact.
- **Runtime-specific deadline handling** — ❌ rejected: behaviour that depends on runtime identity
  is forbidden, and one shared implementation is non-negative on every runtime.

---

## Consequences

- **Positive:** Deno POST −13.8 % and Bun POST −10.4 % of server CPU per request; one timer per
  runner instead of one per request; the GET fast path is unchanged.
- **Negative / cost:** a deadline is served by a sweep, so a deadline is observed at the next sweep
  once it falls inside the window — the window arms the exact remaining time, so the deadline is
  met, but the mechanism is a shared sweep rather than a private timer; a process holds a timer for
  up to one window after its last request.
- **Neutral:** the Node adapter's own race is unchanged, so Node keeps the per-request timer until
  that adapter adopts the shared scheduler.
- **Follow-up:** the Node adapter's race is the next candidate, and it needs the scheduler exported
  from `@nextrush/runtime` — a deliberate public-surface decision.

---

## Compliance / enforcement

How this is kept true: the runner's timeout contract test
(`packages/runtime/src/__tests__/web-runner-timeout-contract.test.ts`) pins the 504, the
cancellation, the committed-response behaviour, and the late-rejection guard; the scheduler's own
tests pin the shared-timer properties (one timer for many deadlines, no re-arm per registration,
release when nothing is pending, a callback's own deadline served); and the cross-adapter
conformance suite runs the timeout scenarios on Node, Bun, Deno, Edge, and serverless, with the
real-runtime runners on Bun, Deno, and `workerd`.

---

## Checklist

- [x] One decision only.
- [x] Context states the forces/trigger without pre-empting the decision.
- [x] Decision is in the active voice with its primary reason.
- [x] Options list includes the chosen one, alternatives, and the rejected earlier design.
- [x] Consequences include at least one real negative/cost.
- [x] Compliance/enforcement names a concrete mechanism.
- [x] Lifecycle progress bar reflects the current Status field.
- [x] Governing RFC linked.
- [x] All guidance blocks deleted; document is terse.
- [x] Registered in docs/adr/INDEX.md.

# ADR-0030 — Recorded outgoing response model

- **Status:** `Accepted · Shipped`
- **Date:** `2026-10`
- **Deciders:** NextRush maintainers
- **Governing RFC:** `docs/RFC/runtime-adapters/041-recorded-response-model.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0010`, `ADR-0028`

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped`  ·  `[████████████████████]` **Shipped** — 3 / 3

---

## Context

The two adapter families built their outgoing responses by different routes: Web adapters
materialized a `Response`, while the Node adapter wrote directly to `ServerResponse`. Middleware
such as compression and timers could therefore only act on one family, and conformance carried a
divergence flag and local workarounds (`httpServer.timeout = 5_000`) instead of one contract. The
record type existed but no adapter used it, so a change was needed to either adopt it everywhere or
delete it.

## Decision

**Adopt one shared recorded outgoing response that every adapter writes, and let Node flush it
after the middleware chain unwinds.**

Because compression, timers and response-header rewrites must behave the same on every runtime, the
record is the single place a middleware can inspect or rewrite what will be sent. The §14 gate was
then measured: Bun `inproc.nextrush.vs_hono` 1.23 (max 1.9), Node median 1.11 µs/req vs 1.01 before
(≈ +0.1 µs/req for the record plus flush), **0** body copies for an untouched response and **1** for
a rewrite, compression/timer/server-timing probes PASS on Node and Bun, conformance #29 PASS with
the divergence flag deleted, and streaming, cold-start and bundle results unchanged.

## Options considered

- **Adopt the record on both families** — ✅ chosen: one response contract; middleware works
  everywhere; measured cost ≈0.1 µs/req on Node.
- **Keep the per-family write paths** — ❌ rejected: conformance divergence and local workarounds
  persist; compression and timers stay family-specific.
- **Do nothing** — ❌ rejected: the record type exists unused, and Node's write timing keeps
  forcing workarounds.

## Consequences

- **Positive:** one place to rewrite a response; `compression-gzip`, `timer-header` and
  `server-timing-header` pass on both families; `FB-03` no longer needs a `knownFailures` entry.
- **Negative / cost:** Node's write timing changes and costs ≈0.1 µs/req; a response committed by
  the handler outlives the handler timeout, with post-commit header writes discarded and reported
  once rather than thrown.
- **Neutral:** the socket guard keeps `SOCKET_GUARD_HEADROOM_MS` behind the handler deadline.
- **Follow-up:** none open; the measurement-only follow-up paragraph was folded into §14.1.

## Compliance / enforcement

`packages/adapters/conformance` runs the same scenarios on node/bun/deno/edge/serverless/nextjs;
the record-copy test asserts 0/1 copies; `dev-check` probes cover compression and timers on both
runtimes; the `inproc.nextrush.vs_hono` budget remains the performance gate.

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

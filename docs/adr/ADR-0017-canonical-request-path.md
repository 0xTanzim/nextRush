# ADR-0017 — Canonical request-path ownership in `@nextrush/router`

- **Status:** `Proposed`
- **Date:** `2026-07`
- **Deciders:** `harden-security-boundaries change`
- **Governing RFC:** `docs/RFC/request-data/029-canonical-request-path.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0018`

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped`  ·  `[███████░░░░░░░░░░░░░]` **Proposed** — 1 / 3

---

## Context

`@nextrush/router` folds path case and collapses slashes for its own trie lookup and keeps that
result private; `ctx.path` remains the raw request target. A security audit
(`report/security-review.md`, SEC-02) found this lets `GET /ADMIN/users` bypass a path-prefix
authorization guard reading `ctx.path` while still dispatching the handler registered at
`/admin/users` — a remote, unauthenticated authorization bypass. The same divergence produces two
further findings: dot segments are never rejected (SEC-09), and CSRF's exemption-pattern matching
inherits the ambiguity (SEC-15).

## Decision

We will make `@nextrush/router` the single owner of request-path normalization via one
`canonicalizePath()` function, publish its output as `ctx.path` on every adapter (preserving the raw
target as `ctx.originalPath`), and reject dot-segment paths with 400 rather than resolving them.

Because the router already owns the per-router options (`caseSensitive`, `strict`) that parameterize
these rules, and because leaving normalization duplicated per-adapter is the exact pattern that
produced the bypass.

## Options considered

- **One `canonicalizePath()` in `@nextrush/router`, published to every consumer** — ✅ chosen: single
  source of truth, no new package, adapters already sit above the router in the hierarchy.
- **Normalize independently in each adapter** — ❌ rejected: four implementations, guaranteed to
  drift; this is the bug, not a fix for it.
- **A new `@nextrush/path` package** — ❌ rejected: RFC-gated overhead for one function with no
  boundary benefit.

## Consequences

- **Positive:** a security decision and a routing decision are now provably the same input; whole
  classes of future prefix-guard bugs become structurally impossible.
- **Negative / cost:** `ctx.path` semantics change (breaking); dot-segment rejection is a behavior
  change for any client sending relative-path targets; one additional linear scan on the routing hot
  path.
- **Neutral:** `ctx.originalPath` is a new, rarely-needed escape hatch.
- **Follow-up:** the router's `caseSensitive` default flip (`false` → `true`) is scoped in the same
  RFC but may ship in a later major — see ADR-0017's governing RFC §15 decision gate.

## Compliance / enforcement

`packages/adapters/conformance` gains security-parity scenarios asserting identical `ctx.path`,
`ctx.originalPath`, and dot-segment 400 handling across Node/Bun/Deno/Edge. A future adapter cannot
ship without passing these. Code review checklist references this ADR when a PR introduces a
path-based comparison outside the router's own matching.

---

## Checklist

- [x] One decision only.
- [x] Context states the forces/trigger without pre-empting the decision.
- [x] Decision is in the active voice with its primary reason.
- [x] Options list includes the chosen one, ≥1 alternative, and "do nothing" equivalent (normalize
  independently, i.e. keep the status quo).
- [x] Consequences include at least one real negative/cost.
- [x] Compliance/enforcement names a concrete mechanism.
- [x] Lifecycle progress bar reflects the current Status field.
- [x] Governing RFC linked.
- [x] All guidance blocks deleted; document is terse.
- [ ] Registered in `docs/adr/INDEX.md`.

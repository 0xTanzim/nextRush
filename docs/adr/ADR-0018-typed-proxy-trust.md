# ADR-0018 — Typed proxy-trust boundary replacing the boolean `proxy` option

- **Status:** `Proposed`
- **Date:** `2026-07`
- **Deciders:** `harden-security-boundaries change`
- **Governing RFC:** `docs/RFC/runtime-adapters/030-typed-proxy-trust.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0017`

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped`  ·  `[███████░░░░░░░░░░░░░]` **Proposed** — 1 / 3

---

## Context

`resolveClientIp()` (`@nextrush/runtime`) selects the leftmost `X-Forwarded-For` entry when `proxy`
is `true` — always the client-authored value, since a conforming proxy appends rather than
overwrites. `@nextrush/rate-limit` independently scans eight vendor headers with no trust gate. A
security audit (SEC-01, P1) found this lets a remote, unauthenticated attacker spoof `ctx.ip` with
one header, defeating rate limits, IP allowlists, and audit logs. The root cause is not the parsing —
it is that a boolean cannot express "how many hops are trusted," so no safe configuration exists
behind any load balancer.

## Decision

We will replace `proxy: boolean` with `proxy: false | number | string[]` — a hop count or a
trusted-peer CIDR list — and rewrite `resolveClientIp()` to walk `X-Forwarded-For` right-to-left,
stopping at the first entry outside the trust specification. `proxy: true` throws at boot.

Because the unsafe configuration must become unrepresentable, not merely better-documented — the
same pattern `@nextrush/cors` already applies to `credentials + origin:'*'`.

## Options considered

- **`false \| number \| string[]`** — ✅ chosen: covers "no proxy," "N hops," and "known peers" with
  typed values, no DSL.
- **Express-style string DSL** (`'loopback, 10.0.0.1'`) — ❌ rejected: stringly-typed in a framework
  whose stated differentiator is type safety.
- **Do nothing** — ❌ rejected: leaves a P1, single-header, unauthenticated bypass open.

## Consequences

- **Positive:** the safe configuration is now the only one the type system accepts; one shared
  resolution policy serves every adapter and `@nextrush/rate-limit`.
- **Negative / cost:** every `proxy: true` deployment fails to boot until migrated (deliberate, not
  accidental); the Edge adapter cannot verify a peer list (no direct peer address) and must refuse
  that form, leaving hop-count as its only option.
- **Neutral:** CIDR-matching logic relocates from `rate-limit` to `runtime` to be shared, rather than
  duplicated.
- **Follow-up:** `@nextrush/rate-limit`'s own eight-header scan is deleted as part of this change,
  not left as dead code.

## Compliance / enforcement

Boot-time validation throws on `proxy: true` and `proxy: 0`. `packages/adapters/conformance` gains
scenarios asserting no adapter returns a forged leftmost entry under any supported trust form.

---

## Checklist

- [x] One decision only.
- [x] Context states the forces/trigger without pre-empting the decision.
- [x] Decision is in the active voice with its primary reason.
- [x] Options list includes the chosen one, an alternative, and "do nothing."
- [x] Consequences include at least one real negative/cost.
- [x] Compliance/enforcement names a concrete mechanism.
- [x] Lifecycle progress bar reflects the current Status field.
- [x] Governing RFC linked.
- [x] All guidance blocks deleted; document is terse.
- [ ] Registered in `docs/adr/INDEX.md`.

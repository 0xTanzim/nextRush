# ADR-0020 — `@nextrush/session`: documented position, implementation deferred to a future RFC

- **Status:** `Proposed`
- **Date:** `2026-07`
- **Deciders:** `harden-security-boundaries change`
- **Governing RFC:** `docs/RFC/class-runtime/032-session-position.md`
- **Supersedes:** `—`
- **Superseded by:** `—`
- **Related:** `ADR-0019`

---

## Lifecycle progress

`Proposed ▶ Accepted ▶ Shipped`  ·  `[███████░░░░░░░░░░░░░]` **Proposed** — 1 / 3

---

## Context

A security audit (SEC-16, P3) observed that NextRush ships no session, authentication, or JWT
package — every application currently reinvents the highest-CVE-density part of web security on top
of `@nextrush/cookies`' `signedCookies`, which is a signed value, not a revocable, rotatable session.
`harden-security-boundaries` closes 19 concrete findings but cannot also design and ship a new
package inside the same change without making it unreviewable.

## Decision

We will record, as an approved architectural position, that NextRush intends to own a session
primitive per AGENTS.md §4 ("the framework owns complexity"), and that its implementation is gated
behind a separate, future, RFC-gated change — not this one. This ADR and its governing RFC ship no
code.

Because a security-hardening change should close the findings that exist, not silently absorb an
open-ended new package into its scope, and because a stated position is strictly better than a silent
gap that a future reader might mistake for "solved" or "deliberately never."

## Options considered

- **Document the position; defer implementation to a future RFC** — ✅ chosen: keeps this change
  reviewable; gives the future implementer a committed starting point.
- **Implement `@nextrush/session` inside this change** — ❌ rejected: a new package's design deserves
  its own RFC review cycle, not a subsection of a hardening change.
- **Say nothing (leave the gap silent)** — ❌ rejected: lets "security review complete" be
  misread as covering a surface it explicitly does not.

## Consequences

- **Positive:** SEC-16 is closed as what it actually is — a decision, not a code change — without
  inflating this change's scope.
- **Negative / cost:** real exposure (applications hand-rolling sessions) is unchanged by this ADR
  alone; the gap remains open in practice until the future RFC and package land.
- **Neutral:** a JWT-specific position (framework-owned vs. documented external recommendation) is
  explicitly left to the future RFC, not decided here.
- **Follow-up:** the future implementation RFC for `@nextrush/session` is the direct successor to
  this decision.

## Compliance / enforcement

A docs-site page states the position and the plan in the same language as this ADR, so the gap is
discoverable rather than silent. By review: any future PR claiming NextRush "has session support"
without the follow-up RFC/package is a documentation defect against this ADR.

---

## Checklist

- [x] One decision only.
- [x] Context states the forces/trigger without pre-empting the decision.
- [x] Decision is in the active voice with its primary reason.
- [x] Options list includes the chosen one and two alternatives.
- [x] Consequences include at least one real negative/cost.
- [x] Compliance/enforcement names a concrete mechanism (documentation + review, explicitly stated).
- [x] Lifecycle progress bar reflects the current Status field.
- [x] Governing RFC linked.
- [x] All guidance blocks deleted; document is terse.
- [ ] Registered in `docs/adr/INDEX.md`.

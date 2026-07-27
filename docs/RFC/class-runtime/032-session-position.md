# RFC-032: `@nextrush/session` position — what the framework owns and what it defers

| Field                | Value                                                                 |
| -------------------- | --------------------------------------------------------------------- |
| **Status**           | `Approved` |
| **RFC number**       | `032` |
| **Date**             | `2026-07-27` |
| **Author(s)**        | `harden-security-boundaries change` |
| **Group**            | `class-runtime` |
| **Packages touched** | `none` (documentation and position only — no code in this RFC) |
| **Framework impact** | `Internal-only` (this RFC ships no code; a future implementation RFC is required before `@nextrush/session` exists) |
| **Supersedes**       | `—` |
| **Superseded by**    | `—` |
| **Related**          | security-review SEC-16 |

---

## Progress Tracker

**Overall:** `[████░░░░░░░░░░░░░░░░]` 20% — P0 (this document) in progress. Doc status: `Draft`

| Phase | Part / deliverable                                        | Status         |
| ----- | ------------------------------------------------------------ | -------------- |
| P0    | Documented position (this RFC) + docs-site page                | 🔄 In progress  |
| P1    | Implementation RFC for `@nextrush/session` (separate, future) | ⬜ Not started  |
| P2    | `@nextrush/session` package (separate, future change)          | ⬜ Not started  |
| P3    | N/A — no adapter/docs phase distinct from P1/P2 for this position-only RFC | ➖ N/A |

---

## 0. Revision History

- **v1 (2026-07-27)** — Initial draft, extracted from `report/security-review.md` finding SEC-16.

---

## 1. Summary (TL;DR)

The security review observed that NextRush ships no session, authentication, or JWT package — every
application currently implements the highest-CVE-density part of web security itself, on top of
`@nextrush/cookies`' `signedCookies`, whose only integrity primitive is a signed value (now
name-bound and expirable per RFC-031, but still not a session abstraction: no rotation-on-privilege-
change, no revocation, no store). This RFC does not implement `@nextrush/session`. It records the
framework's position — that session management belongs in the framework per AGENTS.md's "framework
owns complexity" principle — and gates the actual implementation behind a separate, future,
RFC-gated change, so this security-hardening change does not silently grow a new package into its
scope.

---

## 1a. Terminology

`Session`
: A server-side-tracked, revocable authentication state associated with a client across multiple
  requests, distinct from a bare signed cookie (which has no server-side record and cannot be revoked
  before its natural expiry).

---

## 2. Decision Summary

- **Status:** `Draft`
- **Decision:**
  - _Record the position: NextRush will own a session primitive; it does not exist today._
  - _Defer implementation to a separate, future, RFC-gated change — not this one._
  - _Publish the position (what applications own today, what the framework will own) in the docs
    site and in package documentation, so the gap is stated rather than discovered._
- **Breaking:** `No`
- **Migration required:** `None`
- **Blast radius:** `low` for this RFC itself (documentation only); `high` for the eventual
  implementation, which is why it is not bundled here.

---

## 2a. Decision Drivers

Priority (highest → lowest):

1. Honesty over implied coverage — "security review complete" must never be claimable while this gap
   is silent.
2. Scope discipline — a security-hardening change should not grow an unrelated new package.
3. Framework philosophy — AGENTS.md §4: "when choosing between increasing framework complexity or
   increasing application complexity, always choose framework complexity."

---

## 3. Problem & Motivation

### 3.1 Current state (what exists today)

`packages/middleware/*` and `packages/extensions/*` contain no session, authentication, or JWT
package. The nearest primitive is `@nextrush/cookies`' `signedCookies`, which (per RFC-031) will be
name-bound and optionally time-boxed, but has no store, no revocation, and no rotation-on-
privilege-change semantics — it is a signed value, not a session.

### 3.2 The problems (enumerated)

1. **Highest-CVE-density surface is unowned** — session fixation, missing rotation on login, and
   absent revocation are among the most common real-world authentication defects, and every NextRush
   application currently reinvents this from scratch.
2. **No stated position** — a developer evaluating NextRush cannot tell whether "no session package"
   means "deliberately out of scope forever" or "not yet built."

### 3.3 Why now

The security review asked about sessions, authentication, and JWT explicitly and found nothing to
audit — an absence, not a finding with a fix. `harden-security-boundaries` closes the findings that
exist; it must not close this one by silently implying it is out of scope, nor by scope-creeping a
new package into an already-large change.

---

## 4. Goals & Non-Goals

### 4.1 Goals

- State, in writing, that the framework will own a session primitive (3.2.2).
- Point to a required future RFC as the gate for implementation, so the eventual `@nextrush/session`
  package is designed with the same rigor as every other RFC-gated addition.

### 4.2 Non-Goals

- Designing `@nextrush/session`'s API, storage adapters, or rotation semantics — that is the future
  implementation RFC's job, not this one's.
- Implementing any code in this RFC.
- A position on JWT specifically beyond noting it as part of the same gap — a JWT recommendation (a
  framework-owned package vs. a documented vetted-library pointer) is itself a decision for the future
  RFC to make, not to preempt here.

---

## 5. Impact

- **Affected packages:** None — this RFC changes no code.
- **Affected audiences:** Application developers evaluating or currently working around the gap;
  future implementers of `@nextrush/session`.
- **Explicitly NOT affected:** Any shipped package's behavior.

---

## 6. Proposed Solution (overview)

| # | Problem (from §3.2) | Solution (this RFC) |
| - | ---------------------- | -------------------------- |
| 1 | Unowned high-risk surface | Documented position committing the framework to eventually own it, via a required future RFC |
| 2 | No stated position         | Docs-site page + package documentation stating the gap and the plan explicitly |

---

## 6a. Trade-offs

### Benefits

- Closes SEC-16 as what it actually is — a documented decision, not a code change — without inflating
  this change's scope or review burden.
- Gives a future implementer (or the same team later) a starting reference point instead of a blank
  slate.

### Costs

- The gap remains open in practice until the future RFC and package land; this RFC does not reduce
  real exposure today, only makes it visible and committed-to.

---

## 7. Architecture

_Not applicable — this RFC is documentation/process only and has no architectural surface of its own
to diagram. The future implementation RFC will carry the architecture section for
`@nextrush/session` itself._

---

## 7a. Architecture Invariants

_Not applicable — no code changes in this RFC._

---

## 8. Detailed Design

### 8.1 Public API / surface

_Not applicable — no API is introduced by this RFC. §8 subsections below are addressed at the
"position" level only._

### 8.2–8.7

_Deferred to the future `@nextrush/session` implementation RFC in full. This RFC's only concrete
deliverable is the documentation described in §15._

---

## 9. Alternatives Considered

### 9.1 Implement `@nextrush/session` inside `harden-security-boundaries`

Rejected: bundling a new package's design, implementation, and review into a change already covering
six workstreams and four other RFCs makes the whole change unreviewable, and a new package's design
deserves its own dedicated RFC review cycle, not a subsection of a hardening change.

### 9.2 Do not address SEC-16 at all

Rejected: leaves the finding silently unresolved and lets a future reader believe "security review
complete" covers a surface it explicitly does not.

### 9.3 State the position informally in the proposal only, with no RFC

Rejected: durable architectural commitments belong in `docs/RFC/` per AGENTS.md §20-21, not only in a
change's proposal — the proposal is disposable scratch relative to git history and the RFC record;
the position needs to survive independent of this specific change's lifecycle.

---

## 10. Rejected Ideas

- **Recommending a specific third-party session library instead of a framework-owned one** —
  Considered, but deferred to the future implementation RFC's own alternatives analysis (§9 of that
  future document), not decided prematurely here.

---

## 11. Risks & Mitigations

| Risk                                                        | Mitigation                                                              | Likelihood | Impact |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------- | ------ |
| The future implementation RFC never gets written/prioritized       | This RFC's existence, plus the docs-site page, keeps the gap visible in the public surface, creating pressure to close it | Medium     | Medium |
| A reader conflates "position stated" with "problem solved"          | Docs-site language explicitly states "not yet implemented" alongside the plan | Low        | Low    |

---

## 12. Backward Compatibility & Migration

- **Compatibility:** Additive & non-breaking — no code changes.
- **Migration path:** None.

---

## 13. Cross-Cutting Concerns

- **Security:** The subject of this RFC; no security posture changes as a direct result of this
  document alone.
- **Performance:** Not applicable.
- **Runtime independence:** Not applicable.
- **Observability:** Not applicable.
- **Zero-dependency rule:** Not applicable — no code.

---

## 14. Success Metrics

_Not applicable — this RFC ships documentation, not measurable runtime behavior. The future
implementation RFC carries its own success metrics._

---

## 15. Phased Implementation Plan

| Phase | Goal                                                      | Depends on | Exit condition                                    | Status |
| ------ | -------------------------------------------------------------- | ------------ | ------------------------------------------------------ | -------------- |
| **P0** | This RFC + a docs-site page stating the position and the plan     | — | RFC approved; docs-site page published                | 🔄 In progress |
| **P1** | A separate, future implementation RFC for `@nextrush/session`     | P0 | New RFC drafted and approved (separate change)         | ⬜ Not started |
| **P2** | `@nextrush/session` package implementation                        | P1 | Package ships per its own RFC's exit conditions        | ⬜ Not started |
| **P3** | _N/A — no distinct fourth phase for a position-only RFC_            | — | — | ➖ N/A |

### 15.1 Testing strategy

_Not applicable to P0 — no code. P1/P2's future RFC defines its own testing strategy._

---

## 16. Rollback Plan

_Not applicable — this RFC ships no code to roll back._

---

## 17. Future Work

- The implementation RFC itself (P1) is the primary piece of future work this RFC exists to name.
- A JWT position (framework-owned package vs. documented vetted-library recommendation) — to be
  decided as part of, or alongside, the session implementation RFC.

---

## 18. Open Questions

- [ ] Should `@nextrush/session` be scoped to cookie-backed sessions only, or also support
  header/token-backed sessions (bearer tokens) under one abstraction? Defer to the implementation RFC.
- [ ] Does the framework take an explicit JWT position (ship `@nextrush/jwt`) or document a
  recommended external library? Defer to the implementation RFC.

---

## 19. Decisions Log

| Question                                              | Decision                                          | Rationale                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------- |
| Implement session support now, or record a position?         | Record a position; implementation is a separate RFC-gated change | Keeps `harden-security-boundaries` reviewable; matches RFC-gating for new packages |

---

## 20. References

- `report/security-review.md` — SEC-16.
- `openspec/changes/harden-security-boundaries/` — proposal, design, specs, tasks.
- `AGENTS.md` §4 ("The Framework Owns Complexity"), §20-21 (spec/RFC governance).
- `docs/adr/ADR-0020-session-position.md`.

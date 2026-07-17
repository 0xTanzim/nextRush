## Context

**T058** completes user-facing documentation for the v1.0 tag. Current state: the docs are partial (strategic docs audit 68/100), the shipped feature surface outruns the docs, and some claims risk contradicting source. Constraints that shape this change:

- The docs site is `apps/docs` (Fumadocs + Next.js/MDX) with a fixed content map (`start/ concepts/ guides/ recipes/ reference/ internals/ migrate/ performance/ production/ community/ resources/`); craft is owned by the `engineering-documentation` skill and `documentation.instructions.md`, and scope is tracked in `docs/documentation-rebuild/PLAN.md`.
- A strict gate exists: `pnpm docs:validate:strict`.
- Prior accuracy sweeps already fixed router / extension-model / shim-removal drift, so this is completion, not a from-scratch build.
- **The feature set is mid-flight.** Phase 3 enterprise features (OTel T025, metrics T027, config T035, auth/session T029/T031) are unbuilt. "Document enterprise topics" therefore cannot mean documenting features that do not exist — this is the central scoping tension.

## Goals / Non-Goals

**Goals:**
- Every public export documented at tier-appropriate depth, accurate against source.
- Shipped operational topics (graceful shutdown, health, deploy/hardening, security posture) covered.
- `pnpm docs:validate:strict` green.
- Unbuilt Phase 3 features represented honestly as roadmap.

**Non-Goals:**
- **Not** documenting unbuilt features (OTel/metrics/config/auth/session) as usable.
- **Not** performing the **T064** security audit (separate v1.0-gate blocker — see D6).
- **Not** authoring new APIs or bending behavior to make docs easier — docs follow source; a doc-surfaced API defect becomes a Finding on the owning package's task, not a fix here.
- **Not** re-teaching documentation craft (owned by the `engineering-documentation` skill).

## Decisions

### D1 — One capability, requirement-partitioned
Model T058 as a single `complete-user-documentation` capability with four requirements (reference coverage, accuracy, production guides, strict gate). **Alternative — split per content type:** rejected; the acceptance is one strict gate over one coherent body of work.

### D2 — Depth follows the ADR-0005 tier, not a uniform bar
Tier 1 (`core`/`runtime`/`router`/`di`/`class`/`types`/`errors`) full architectural treatment; Tier 2 (middleware/extensions/stream) problem → usage → options → troubleshooting; Tier 3 (adapters/tooling) lean. Matches `documentation.instructions.md` tiering and avoids over-documenting a thin adapter while under-documenting core. This is why Tranche A's T055 tier labels are a soft dependency (ADR-0005 is the underlying source either way).

### D3 — "Accurate" = no claim contradicted by source, enforced two ways
The strict gate plus a public-API-vs-source spot-check. Where doc and source disagree, source wins and the doc is fixed; a genuine *source* defect surfaced this way is logged as a Finding against the owning package's task, never silently patched by changing behavior here.

### D4 — Unbuilt Phase 3 features get roadmap treatment only (the crux)
OTel/metrics/config/auth/session are labeled "planned / not yet available" with **no runnable examples** that would fail. This is what keeps the accuracy gate honest and bounds scope away from Phase 3.

### D5 — Reference completeness is measured against the T005 public-surface snapshots
The set of "public exports that must be documented" = the locked surface (`public-surface-lock`). Coverage becomes checkable, not a vibe. **Alternative — hand-maintained export list:** rejected, it drifts.

### D6 — T064 boundary: document posture ≠ audit posture
This change writes user-facing security *guidance* (how to deploy safely; what headers, body limits, and error-leak protections exist). It does **not** produce the security *audit* (threat model; injection/ReDoS/prototype-pollution review) — that is **T064**. Both are required by the T060 freeze gate; keeping them distinct prevents them being conflated at sign-off.

## Risks / Trade-offs

- **Documenting a feature that is actually broken/partial** → docs follow source and examples are executed; a topic that cannot be made truthful signals a source Finding, not a doc workaround.
- **Scope creep into Phase 3 feature docs** → D4 scope guard; unbuilt features are roadmap-only.
- **`docs:validate:strict` green but semantically thin** → the strict gate is necessary, not sufficient; pair it with the D5 surface-coverage check and a human accuracy spot-check (engineering-documentation review checklist EDS-014/015).
- **Large surface, single maintainer** → prioritize Tier 1 → 2 → 3 so the highest-value docs land first if the long tail slips; track in `docs/documentation-rebuild/PLAN.md`.
- **Coupling to T055** → if Tranche A's tier labels are not done first, depth is ambiguous; mitigate by treating `ADR-0005` as the tier source directly.

## Migration Plan

Docs-only — no consumer migration, no runtime changeset. Sequence by tier (Tier 1 → 2 → 3) and by content type (reference coverage + accuracy first, then production guides). `pnpm docs:validate:strict` is the completion gate. On completion, update gap-checklist glyph T058 (□ → ☑) and record that T060 still needs T064. Rollback = docs revert; no runtime blast radius.

## Open Questions

- **v1.0 bar for coverage:** full public-surface reference everywhere, or Tier-1/2 complete + Tier-3 minimal-but-accurate with the long tail tracked? (Proposed: full accuracy everywhere; full reference for Tier 1/2; Tier 3 minimal-but-accurate.)
- **Authoritative scope tracker:** does `docs/documentation-rebuild/PLAN.md` remain the source of truth to reconcile against, or does T058 supersede it?
- **Security-guidance depth now vs. after T064:** how much hardening guidance ships under T058 vs. waits for T064's findings? (Proposed: document existing posture now; add audit-driven guidance when T064 lands.)

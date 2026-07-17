## Why

Documentation is a stated core feature of NextRush (AGENTS.md §13: "A feature is incomplete until documented"), and it is an explicit **v1.0 gate**: the v1.0 Definition of Done requires "docs complete & accurate (T058)", and T058's own acceptance is `pnpm docs:validate:strict` green **plus** every public API documented. Today the user docs are partial (strategic docs audit: 68/100), the feature surface outruns the docs, and some published claims risk contradicting source. This change (**T058**, P1) completes the user-facing documentation for everything that ships at v1.0 so the stable tag is not "powerful but confusing."

## What Changes

- **Public-API reference coverage.** Every public export across the ~35 published packages gains an accurate reference entry (signatures, options, types), at the depth its `ADR-0005` tier warrants: Tier 1 (`core`, `runtime`, `router`, `di`, `class`, `types`, `errors`) full architectural treatment; Tier 2 (middleware/extensions/stream) problem → usage → options → troubleshooting; Tier 3 (adapters/tooling) lean.
- **Accuracy sweep.** No doc claim is contradicted by source — every guide, example, and README is reconciled against current behavior (continuing the doc-accuracy sweeps already run for the router, extension model, and shim removal).
- **Shippable production guides.** Document the operational topics that actually ship at v1.0: graceful shutdown (T010 ☑), health/readiness probes (T011 ☑), deployment & hardening (edge/serverless deploy, security headers, body-size limits, production error-leak posture), and each network-exposed package's security posture.
- **Scope guard — document what ships, not what's planned.** Enterprise topics that do **not** ship at v1.0 — OpenTelemetry (T025), metrics (T027), typed config (T035), auth/session (T029/T031) — are Phase 3 and mostly unbuilt. They are represented as roadmap / not-yet-available, **never** as usable features. This keeps the accuracy gate honest.
- **The strict docs gate goes green:** `pnpm docs:validate:strict` passes.
- No runtime, API, packaging, or dependency change. Not breaking.

## Capabilities

### New Capabilities
- `complete-user-documentation`: complete, accurate, strict-validated user-facing documentation covering every public API and every operational topic that ships at v1.0, with unbuilt Phase 3 features represented as roadmap rather than usable features.

### Modified Capabilities
<!-- None. This is net-new documentation coverage; it changes no existing spec's requirements. It consumes T055's per-package tier labels (Tranche A / phase5-release-hygiene) and builds on prior doc-accuracy sweeps, but alters neither's requirements. -->

## Impact

- **Content:** `apps/docs` (Fumadocs/MDX; content map `start/ concepts/ guides/ recipes/ reference/ internals/ migrate/ performance/ production/ community/ resources/`) + ~35 package READMEs. Craft is governed by the `engineering-documentation` skill and `documentation.instructions.md`; scope tracked in `docs/documentation-rebuild/PLAN.md`.
- **Tooling gate:** `pnpm docs:validate:strict` must pass; spot-check every public API against source.
- **Depends on:** T055 tier labels (Tranche A) for the per-package depth convention.
- **Explicitly NOT in scope — T064 (security architecture audit).** T064 is a *separate* P1 v1.0-gate blocker. This change documents the **existing** security posture (headers, body limits, error-leak behavior) as user-facing guidance; it does **not** perform the threat-model audit. **The T060 freeze gate requires BOTH T058 and T064** — completing this change alone does not unblock the tag.
- **Bounded out:** enterprise feature docs for OTel/metrics/config/auth/session — those features are Phase 3 and mostly unbuilt.
- **Effort:** L — the largest single Phase 5 task. Docs + READMEs only; no code. On completion, update gap-checklist glyph T058 (□ → ☑).

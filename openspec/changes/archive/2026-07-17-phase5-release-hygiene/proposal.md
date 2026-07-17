## Why

Phase 5 freezes NextRush at v1.0 (gate task **T060**). Before that freeze, a small cluster of governance/metadata items must be reconciled so the stable tag does not ship with stale release bookkeeping, an unlabeled support surface, or an undocumented engine floor. These three tasks — **T054** (extension-model release mechanics), **T055** (package-tier convention), **T057** (Node engine-floor policy) — are all low-effort, parallelizable, carry **no runtime or behavior change**, and share one concern: getting the framework's *published metadata and governance* honest before the surface is locked. Batching them clears the pre-freeze P2/P3 noise in a single change.

Scope note: **T056 is deliberately excluded (banned)** — it is a decorator-dialect ADR/reflection task and is not part of this change. **T064** (security audit) is a real v1.0-gate dependency but is out of this change's scope; it is tracked in the Tranche B proposal's dependency notes.

## What Changes

- **T054 — Extension-model release mechanics (P1).** Reconcile the M8 release bookkeeping for the `Plugin → Extension` migration. The code is already done and verified: `ADR-0002` records the migration as *Shipped*, `app.extend()`/`app.ready()` ship, and the source carries **zero legacy `Plugin` contract** — the only two `Plugin` hits in `packages/*/src` are an incidental JSDoc line (`extensions/events/src/index.ts`) and a banner comment (`middleware/template/src/template.types.ts`), neither of which is the old `Plugin`/`PluginWithHooks`/`app.plugin()` type. Remaining work is bookkeeping only: confirm/land the changeset + CHANGELOG entries and reconcile any stale migration TODO checkboxes. Optionally scrub the two incidental "Plugin" word-usages so the acceptance grep is unambiguous.
- **T055 — Package-tier convention (P2).** The decision already exists (`ADR-0005` defines the tier table: Public–core / Public–middleware+registrar / Public–extensions / Public–tooling / Internal). Propagate a visible tier marker into every published package's README, and label internal symbols. Fix `ADR-0005`'s now-stale **"Deprecated (shims)"** row — `@nextrush/decorators` and `@nextrush/controllers` were removed by T053, so the row must move to a historical note rather than list live packages.
- **T057 — Node engine-floor policy (P3).** Document *why* `engines.node >= 22` (drops Node 20 LTS; `AbortSignal.any` only needs ≥20.3, so the floor is a deliberate choice, not a hard technical minimum). The floor is already uniform — `"node": ">=22.0.0"` in all 39 `package.json` files — so this is a documentation/rationale task that changes **no** floor and matches the T003 CI matrix.
- No public-API change. No packaging change. No new runtime dependency. Not breaking.

## Capabilities

### New Capabilities
- `extension-model-release-mechanics`: the `Plugin → Extension` migration's release bookkeeping (changeset + CHANGELOG present, zero legacy `Plugin` contract in source) is reconciled and verifiable.
- `package-tier-labeling`: every published package visibly declares its `ADR-0005` support tier, and internal-only symbols are labeled, so adopters can tell supported surface from plumbing.
- `node-engine-floor-policy`: the `>=22` Node engine floor is documented with rationale and matched by the CI matrix.

### Modified Capabilities
<!-- None. No existing spec's requirements change. This change interacts with `public-surface-lock` (T005) and `gap-checklist-accuracy` (glyph updates) but alters neither's requirements. -->

## Impact

- **Docs / metadata:** ~35 published package READMEs gain a tier marker (T055); the versioning/compatibility docs gain the engine-floor rationale (T057); `ADR-0005` (stale shim row) and, if scrubbed, two incidental "Plugin" comments are corrected.
- **Release bookkeeping:** changeset + CHANGELOG reconciliation for the extension model (T054). No packaging change.
- **Runtime:** none. No behavior, dependency, or public-surface change — the `public-surface-lock` (T005) snapshots must stay byte-identical.
- **Gate:** clears three pre-freeze items feeding **T060**. Updates gap-checklist glyphs T054/T055/T057 (□ → ☑) with Verified notes.

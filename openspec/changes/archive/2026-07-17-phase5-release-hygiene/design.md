## Context

This change groups three Phase 5 pre-freeze tasks (T054, T055, T057) whose **decisions already exist** — the work is propagation, documentation, and reconciliation, not new architecture. Facts verified against current source (branch `fix-router-issues-and-author-radix-rfc`):

- **T054:** `ADR-0002` records the `Plugin → Extension` migration as *Accepted · Shipped*; `app.extend()`/`app.ready()` ship. A source scan of `packages/*/src` finds **zero legacy `Plugin` contract** — the only two `Plugin` hits are incidental (a JSDoc line in `extensions/events/src/index.ts`, a banner comment in `middleware/template/src/template.types.ts`). What is unverified is the release bookkeeping (changeset/CHANGELOG/TODO reconciliation).
- **T055:** `ADR-0005` already defines the tier table (Public–core / Public–middleware+registrar / Public–extensions / Public–tooling / Internal). It is **not yet propagated** to package READMEs, and its "Deprecated (shims)" row still lists `@nextrush/decorators`/`@nextrush/controllers`, which T053 removed.
- **T057:** the engine floor is already uniform — `"node": ">=22.0.0"` in all 39 `package.json` files — but the *rationale* is undocumented.

## Goals / Non-Goals

**Goals:**
- Reconcile the extension-model release bookkeeping and make its end-state (no legacy `Plugin` contract; changeset + CHANGELOG present) verifiable.
- Give every published package a visible `ADR-0005` tier marker; label internal symbols.
- Publish a justified `>=22` engine-floor rationale that matches the CI matrix.
- Keep this change **zero-runtime, zero-packaging, zero-public-surface** — the `public-surface-lock` (T005) snapshots stay byte-identical.

**Non-Goals:**
- **Not** changing the engine floor (T057 documents it; it does not raise or lower it).
- **Not** adding runtime/lint enforcement of tiers or module encapsulation (that is T032 / future work). Tier labeling here is documentation only.
- **Not** touching the decorator dialect or the reflection seam — that is **T056, which is banned**. See D4.
- **Not** producing the security audit (T064) — tracked separately as a v1.0-gate dependency.

## Decisions

### D1 — Three capabilities, one change
The three tasks share a single concern: *publish honest metadata/governance before the freeze*. All are XS–S, none warrants its own change's ceremony, and they carry no interdependency risk. **Alternative — three separate changes:** rejected as over-fragmentation for items this small and this related.

### D2 — Tier labeling is documentation, not runtime enforcement
Each README gets a short, labeled tier line sourced from `ADR-0005`; internal-only symbols get a doc label. We deliberately do **not** add a runtime or lint gate that blocks importing "internal" packages — that would be a behavior change and could disturb the T005 surface lock. **Alternative — machine-enforced tiers:** deferred as a possible follow-up, out of scope here.

### D3 — T054 is verify-and-reconcile, not re-migrate
Because the migration code is already shipped and clean, this change **asserts the end-state** (zero legacy `Plugin` contract, changeset + CHANGELOG present) via inspection + an optional scrub of the two incidental "Plugin" comments, rather than re-doing any migration. **Alternative — re-run/rewrite the migration:** rejected as unnecessary and risky.

### D4 — Fix only ADR-0005's staleness; leave ADR-0001 alone (ban boundary)
`ADR-0005`'s "Deprecated (shims)" row is corrected to a historical note (the shims are gone). `ADR-0001`'s header **also** still names the removed `decorators`/`controllers` packages — but refreshing `ADR-0001` is literally **T056's** scope ("Refresh decorator-dialect ADR"), which is banned. To keep the ban boundary crisp, this change **does not touch `ADR-0001`**. Its staleness is noted as a T056-scoped item, deferred with T056.

### D5 — Engine-floor rationale lives with the T007 versioning/compatibility docs
It extends the already-published version/support docs rather than adding a standalone file, avoiding doc sprawl — the same pattern `module-format-policy` (T051) used to extend T007.

## Risks / Trade-offs

- **README tier labels drift from ADR-0005 over time** → treat `ADR-0005` as the single source of truth; each README mirrors it and links to it. A machine check is possible later (D2, out of scope).
- **Touching ~35 READMEs risks doc-validate breakage** → the tier marker is additive prose; run `docs:validate:strict`; no code is touched, so T005 snapshots are unaffected.
- **Scrubbing the two incidental "Plugin" comments looks like scope creep** → it is optional and clearly labeled; the acceptance criterion (no legacy `Plugin` *contract*) is already met — the scrub only makes the acceptance grep unambiguous.
- **Engine-floor doc could read as "Node 20 unsupported, full stop"** → document both the rationale *and* the "reconsider if adoption demands" escape hatch, matching T057's framing.

## Migration Plan

Docs/metadata only — no consumer migration. The sole release-impacting artifact is T054's extension-model changeset, which may already exist in an archived release; task 1.x verifies before adding. `docs:validate:strict` must stay green. On completion, update gap-checklist glyphs T054/T055/T057 (□ → ☑) with Verified notes. Rollback is a docs revert; no runtime blast radius.

## Open Questions

- **T054 changeset:** already folded into an archived release, or genuinely missing? (Resolved by inspection in tasks.md 1.x — determines XS vs. near-zero effort.)
- **Tier marker format:** a one-line `Support tier: …` + link to ADR-0005 (proposed, low ceremony) vs. a badge? Leaning to the labeled line.
- **Scrub the two incidental "Plugin" comments?** Proposed yes — trivial, removes acceptance-grep ambiguity — but strictly optional.

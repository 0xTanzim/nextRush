## Why

The re-baselined `docs/audits/03-gap-checklist.md` (2026-07-15) confirmed that `T003 → T019 →
T021` and `T007 → T060` — two of the three critical-path legs to a credible v1.0 — are now
closed. The **sole remaining leg is `T005 → T053 → T060`**: repo-wide public-API surface
snapshots. Today only 2 of 35 publishable packages (`@nextrush/class`, `@nextrush/types`) have a
surface-lock test; the other 33 have no mechanism stopping an accidental export addition/removal
from shipping silently. `T053` (removing the deprecated `@nextrush/controllers`/`@nextrush/decorators`
shims) and `T060` (the v1.0 freeze gate itself) are both explicitly blocked on T005 in the
checklist's own dependency graph — freezing a public contract that isn't even snapshotted yet is
not a real freeze.

This proposes closing T005 for all 33 remaining publishable packages, using the pattern already
proven twice in this repo (`class`'s `public-surface.test.ts` for a runtime-export-heavy package,
`types`'s for a type-only-export-heavy package) rather than inventing a new mechanism.

## What Changes

- Add a `public-surface.test.ts` to every one of the 33 remaining publishable packages that
  doesn't already have one, following the established repo pattern:
  - **Runtime-export-heavy packages** (most middleware, `core`, `errors`, `runtime`, `di`,
    `stream`, extensions, adapters, `nextrush` meta, `dev`, `create-nextrush`): lock the exact
    `Object.keys()` export list, same shape as `class`'s test.
  - **Type-only-export-heavy packages** (if any beyond `types`): lock the type surface via a
    compile-time `Surface` tuple + `expectTypeOf`, same shape as `types`'s test.
  - Packages with a genuine mix of both get both checks in one file (already the working pattern
    in `types`, which has 4 runtime exports alongside its type-only surface).
- Each new surface test is scoped to that package's own barrel (`src/index.ts`) only — no
  cross-package aggregation, no new shared tooling package. This mirrors the two existing tests
  exactly; a generalized "surface-snapshot framework" is explicitly not being built (see Design's
  Non-Goals) because two data points aren't enough to design a good abstraction, and the
  mechanical cost of 33 similar-but-not-identical test files is lower than the cost of a wrong
  abstraction frozen alongside the public API it's meant to protect.
- Do **not** implement T053 (shim removal) or T060 (the v1.0 freeze sign-off) in this change —
  both remain explicitly gated on T005 landing repo-wide plus their own separate acceptance
  criteria (a codemod + migration guide for T053; every other P0/P1 Phase 0–2 item for T060). This
  change closes T005 only; T053/T060 stay queued as their own future changes per the checklist's
  own dependency graph, which is not being re-litigated here.
- Update `docs/audits/03-gap-checklist.md`'s T005 entry from ◐ (2/35) to ☑ once all 33 packages
  are covered, with an updated "Verified:" note — following the same re-baseline discipline
  established by the `rebaseline-gap-checklist` change.

## Capabilities

### New Capabilities
- `public-surface-lock`: The requirement that every publishable NextRush package has a test
  locking its exported symbol set (runtime exports via `Object.keys()`, type-only exports via a
  compile-time surface check), so an unintended export addition, removal, or rename fails CI
  rather than shipping silently.

### Modified Capabilities
<!-- None. No existing openspec/specs/ capability's behavioral requirements change. -->

## Impact

- **Packages (modified, 33):** every publishable package except `@nextrush/class` and
  `@nextrush/types` (already covered) and `@nextrush/adapter-conformance` (private, never
  published — excluded per the same rule that excludes it from the versioning doc's 35-package
  count). Each gets exactly one new test file, no other source change.
- **Public API:** none. This is a test-only addition; no exported symbol is added, removed, or
  changed by this work. If writing a surface test reveals an export that looks unintentional
  (leaked internal, inconsistent naming), that is logged as a Finding for a separate change — this
  change locks the *current* surface as-is, it does not editorialize it.
- **CI:** each new test runs under the package's existing `vitest run` — no new CI job, no new
  tooling dependency. `pnpm verify`/`pnpm test` at the repo root already runs every package's
  tests, so these are covered automatically once added.
- **Docs:** `docs/audits/03-gap-checklist.md`'s T005 entry updated to ☑ on completion.
- **Dependencies:** none added. `vitest`'s `expectTypeOf` (already a dependency wherever it's
  used) is the only tool involved, and it's already present in every package that runs vitest.
- **Follow-up (not implemented here):** T053 (shim removal, its own codemod + migration guide) and
  T060 (v1.0 freeze sign-off, gated on many other Phase 0–2 items) remain future changes.

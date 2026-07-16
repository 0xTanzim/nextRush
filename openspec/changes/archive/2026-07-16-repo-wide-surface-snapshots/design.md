## Context

Two surface-lock tests already exist in this repo and were both independently proven to work:
`packages/class/src/__tests__/public-surface.test.ts` (pre-existing, locks ~40+ runtime exports
via `Object.keys()`) and `packages/types/src/__tests__/public-surface.test.ts` (added during the
`harden-runtime-edge-serverless`/`rebaseline-gap-checklist` work, locks 4 runtime exports plus a
much larger type-only surface via a compile-time tuple). Every other publishable package (33 of
35) has no equivalent. `docs/audits/03-gap-checklist.md`'s T005 is the last unclosed leg of the
`T005 → T053 → T060` critical path to v1.0.

The two existing tests differ in shape because the packages differ in what's exported: `class`'s
barrel is almost entirely decorators/functions (runtime-visible), `types`'s barrel is almost
entirely `export type` (invisible to `Object.keys()`). The 33 remaining packages will skew
overwhelmingly toward the `class` shape — middleware, adapters, and the core packages export
mostly functions/classes/constants, with type-only exports being a minority — but each package's
actual barrel needs to be read before deciding which shape (or a hybrid) it needs, not assumed.

## Goals / Non-Goals

**Goals:**
- Every one of the 33 remaining publishable packages gets a surface-lock test appropriate to its
  actual export shape (runtime-only, type-only, or hybrid).
- Each test is derived from reading that package's real `src/index.ts` at the time of writing —
  never copy-pasted from another package's expected list and hand-edited, which would risk
  silently missing or duplicating an export.
- The mechanism stays identical to the two proven examples — no new shared test utility, no new
  dependency, no generalized "surface snapshot framework."

**Non-Goals:**
- Not building a repo-wide code-generation tool that auto-derives the expected export list from
  the AST — that would be a more sophisticated (and differently risky) mechanism than the two
  proven examples, and two data points don't justify designing a third, more complex approach when
  the manual pattern is already working and each package only needs writing once.
- Not implementing T053 (shim removal) or T060 (v1.0 freeze) — see the proposal's explicit
  exclusion.
- Not judging or "cleaning up" any package's current export surface. If a package exports
  something that looks like it should be internal, that observation is logged as a Finding, not
  silently fixed by narrowing the export list — narrowing an export is itself a breaking change
  that needs its own changeset and migration path, which is out of scope for a test-only change.
- Not adding CI configuration — every package's existing `vitest run` script already picks up a
  new `__tests__/*.test.ts` file with zero config changes, confirmed by both prior examples.

## Decisions

**One task per package, not one task per pattern-type.** Batching "all runtime-only packages" into
one task and "all type-heavy packages" into another would look efficient on paper but means each
individual package's actual barrel still has to be read to write its expected list correctly —
the batching saves nothing real and obscures per-package verification in the tasks.md. Each
package gets its own task, its own commit-sized unit of work, matching this repo's git-workflow
steering (one logical unit per commit).

**Read the barrel fresh for every package — never infer from the package's name or its neighbors.**
Two adapter packages (e.g. `adapter-node` vs `adapter-bun`) can have different export surfaces
despite serving the same architectural role; assuming they match without reading each one risks
either missing a package-specific export or asserting one that doesn't exist. This is the same
discipline already applied when writing the `types` test (which required reading the actual
`index.ts`, not guessing from the package's README).

**A discovered "surface smell" is a Finding, not a silent fix.** If a package's export list
reveals something that looks like an internal implementation detail leaking out (matches the
`typescript.instructions.md`/`architecture.instructions.md` "no internal types leaked through the
public surface" rule), that's logged in the change's tasks.md as a Finding with the package name
and the specific export — never quietly excluded from the locked list, and never "fixed" by
removing the export, since that's an independent breaking-change decision belonging to a different
change with its own changeset.

**Ordering: lower-layer packages first, matching the package hierarchy.** `types` → `errors` →
`core` → `router` → `runtime` → `di` → `class` (already done) → adapters → middleware →
extensions → `dev`/`create-nextrush`/`testing` → `nextrush` meta. This isn't a hard dependency (a
surface test in one package doesn't block writing one in another), but working low-to-high means
if a lower package's test surfaces a real export inconsistency, that's known before writing tests
for the higher packages that consume it — cheaper to discover early than to discover last.

## Risks / Trade-offs

- **Risk:** Writing 33 near-identical-looking test files by hand is repetitive and a copy-paste
  mistake (forgetting to update the expected list for the actual package) would silently produce
  a test that passes without actually locking anything. → **Mitigation:** each package's task
  requires reading that package's real `src/index.ts` immediately before writing its test, per
  the Decisions section above — the tasks.md tracks this per-package, not as one bulk "write 33
  files" step, so each one gets independently verified (run the test, confirm it fails on a
  throwaway added export, then remove the throwaway export) rather than trusted on sight.
- **Risk:** A package with zero current tests would need its `vitest` devDependency/config
  confirmed before a new test can even run. → **Mitigation:** checked per-package as part of
  writing its test; if genuinely absent (unlikely — `pnpm test` already runs across all
  packages), that's flagged as a blocker for that specific package's task, not assumed away.
- **Trade-off:** 33 small, similar commits is more commit-log volume than one large commit, but
  matches this repo's own git-workflow steering ("prefer many small, meaningful commits… every
  commit should be independently understandable and revertible") — a single 33-file commit would
  be harder to review and impossible to partially revert if one package's expected list turns out
  wrong.

## Migration Plan

Not applicable in the breaking-change sense — no public API changes. Rollout is additive
(new test files only) and can land package-by-package without any release coordination; each
package's test is independently useful the moment it exists, with no dependency on the others
being done first.

## Open Questions

- Should T053 (shim removal) be proposed as the immediate next change once this lands, or should
  the other Phase 0/1 P0 items (T001, T002, T010, T011) go first since they don't depend on T005
  but are still required for T060's sign-off? Not decided here — flagged as the natural "what's
  next" question once this change closes, consistent with not pre-committing to work beyond this
  change's own scope.

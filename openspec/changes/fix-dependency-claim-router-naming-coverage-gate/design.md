## Context

Three independent Phase 0 gap-checklist items (T001, T002, T006) share a root cause: accuracy/
enforcement debt that accumulated while feature work took priority. None require new
architecture — each is a correction to existing docs, an internal rename, or a CI wiring gap.
Bundling them into one change is a deliberate scope decision: they're disjoint in files touched
(README/di-docs vs. router/src vs. CI config) but identical in kind (Phase 0 accuracy fix, no
behavior change, no new capability beyond documentation/enforcement), and batching keeps the
OpenSpec change count proportional to the actual review unit rather than fragmenting three
five-minute fixes into three separate change lifecycles.

Current state (verified directly against source, not carried forward from the checklist):
- `README.md` lines 16–17 state "Zero Dependencies — No external runtime dependencies in core"
  and "zero-dependency core" — true for the functional path, false for `nextrush/class`
  (`tsyringe` + `reflect-metadata`, per `project-rules.instructions.md` §6's own approved-exception
  list).
- `packages/router/src/radix-tree.ts` exists with `RadixNode` as an internal type; 23 `radix`
  references remain across `router.ts` (10), `radix-tree.ts` (7 + filename), `index.ts` (3), and
  `public-surface.test.ts` (3) — despite the router's own source header already stating it
  implements a segment trie, not a radix tree.
- `.github/workflows/ci.yml` has no `coverage` keyword anywhere — `pnpm verify` runs
  build/test/typecheck/lint with no coverage gate, despite the 90%/85% bar already stated in
  `engineering-standards.md` and `project-rules.instructions.md` §7.

## Goals / Non-Goals

**Goals:**
- Correct the README/di-docs dependency claim to be true for every supported usage path.
- Make the router package internally consistent: file name, type name, JSDoc, and package
  metadata all say "segment trie," matching the algorithm the source header already claims.
- Enforce the already-stated 90%/85% coverage bar in CI so it stops being aspirational text.

**Non-Goals:**
- Not replacing tsyringe (T050) — that's a separate, much larger change: this only documents
  the current dependency reality.
- Not changing router *behavior* or its public API — `RadixNode` is confirmed non-exported via
  the package's own `public-surface.test.ts` (T005's snapshot), so this is a pure internal rename.
- Not raising coverage on any package that's currently below threshold — T006 is about wiring
  the *gate*, not doing the remediation work to pass it. If wiring the gate surfaces a package
  currently under threshold, that's a new Finding (Section 5 of the agent's operating protocol),
  logged for separate follow-up, not silently fixed inside this change's scope.
- Not touching `docs/audits/03-gap-checklist.md` itself to flip T001/T002/T006's glyphs — that's
  a `gap-checklist-accuracy` capability concern (re-verification against source), done as a
  follow-up once this change's PR lands, not bundled into this change's own scope.

## Decisions

**D1 — README correction adds a table, not just a reworded sentence.**
A single corrected sentence ("zero-dependency functional core; class/DI depends on X") is
necessary but insufficient — a reader evaluating supply-chain risk needs to see both paths at a
glance. Alternative considered: link to `@nextrush/di`'s README instead of inlining a table in
root `README.md`. Rejected because the root README is the first (and often only) document an
evaluator reads; the false claim lives there, so the correction must be visible there too — the
di README gets the same correction as a secondary confirmation, not as the sole fix location.

**D2 — Router rename keeps `RadixNode` fully removed, no deprecated alias.**
`architecture.instructions.md` documents the router as "segment-trie routing (O(k) lookup)" —
the current `RadixNode`/`radix-tree.ts` naming is source-internal drift, not a public contract.
T005's own public-surface snapshot for `@nextrush/router` is the authoritative check: if
`RadixNode` doesn't appear in that snapshot, it's confirmed internal and the rename requires no
`@deprecated` shim (unlike T053-class removals, which is public and requires a codemod).
Alternative considered: keep a `@deprecated export { RadixNode as TrieNode }` alias for one minor
cycle out of caution. Rejected as unnecessary ceremony for a type that was never exported — the
Breaking Change Tracker's alias convention exists for public surface changes, and this task's
own acceptance criteria explicitly allow "no split... internal names" with breaking: No.

**D3 — Coverage gate wires into the existing `verify` pipeline, not a parallel job.**
`pnpm verify` already runs build/test/typecheck/lint as the existing gate developers expect to
pass before merge. Alternative considered: add `test:coverage` as a wholly separate CI job.
Rejected — a second job means a second failure surface to interpret and a second place coverage
config can drift from the `verify` script's understanding of "tests passed." Wiring it into the
same `test` step (or a `test:coverage` variant invoked in place of `test` inside CI, with the
plain `test` script left alone for fast local iteration) keeps one canonical gate.

**D4 — Threshold scope is per-touched-package, not repo-wide.**
Per `project-rules.instructions.md` §7 ("Line coverage 90%+ per package") and the Validation
Checklist's own wording ("Coverage ≥ 90% lines / 85% branches per touched package"), the gate
enforces per-package, not a single repo-wide average that could hide an under-covered package
behind well-covered ones. This also avoids the gate becoming a blocker for every unrelated
package in a ~35-package monorepo on a PR that only touches one.

## Risks / Trade-offs

- **[Risk]** Wiring the coverage gate for the first time may surface one or more packages
  currently below the 90%/85% bar, immediately failing CI on unrelated PRs.
  → **Mitigation**: Run the coverage check locally across all packages before landing the CI
  change; if any package is under threshold, either (a) it's out of scope for T006 and gets
  logged as a Finding/follow-up task with its own tracked remediation, or (b) if trivial (a
  missing edge-case test), fix it in this change since it's a direct blocker to the gate working
  at all — the line is whether the fix is a real test-writing exercise (out of scope, needs its
  own TDD cycle) vs. a config/threshold-application bug (in scope).
- **[Risk]** The router rename touches a test fixture file (`public-surface.test.ts`) that exists
  specifically to catch unintended surface changes (T005's own mechanism) — an incorrect edit
  here could silently widen or narrow the locked public surface.
  → **Mitigation**: Edit only the internal-name references inside the test file (variable names,
  comments referencing `RadixNode`); do not touch the actual exported-symbol assertions the
  snapshot test checks. Run the surface snapshot test before and after to confirm it reports an
  identical export set, not just that it passes.
- **[Risk]** npm package.json `keywords`/`description` changes for `@nextrush/router` are
  user-facing (npm search, package metadata) — a breaking rename of search terms could reduce
  discoverability for anyone searching "radix."
  → **Mitigation**: Add "segment-trie" as the primary keyword but keep "radix-tree" as a secondary
  search keyword for one release cycle (metadata-only, zero cost, aids discoverability during
  the transition) rather than a hard cutover — this is metadata, not code, so it costs nothing
  to keep both terms briefly.

## Migration Plan

No runtime migration — this is a docs correction, an internal rename, and a CI config addition.
Deploy as a normal PR:
1. Land README + di-docs correction (independently mergeable, zero risk).
2. Land router rename with before/after surface-snapshot diff confirmed empty (independently
   mergeable, zero risk — internal-only per D2).
3. Land coverage gate wiring; if it reveals an under-threshold package, either fix trivially in
   this PR or split into a follow-up task per the Risk mitigation above, and land the gate
   scoped to exclude that package temporarily with a tracked follow-up, rather than blocking this
   entire change on unrelated remediation work.

No rollback complexity: each of the three fixes reverts independently via a normal `git revert`
if it causes an unexpected CI regression.

## Open Questions

- Does any package currently sit below the 90%/85% threshold? Unknown until the coverage check
  is run repo-wide as part of implementation — this determines whether T006 lands cleanly or
  needs a scoped exclusion list for a follow-up task.
- Should "radix-tree" remain as a secondary npm keyword for one cycle (D2 mitigation) or be
  removed entirely now? Leaning toward keeping it per the mitigation above, but this is a minor
  enough call to leave to implementation-time judgment.

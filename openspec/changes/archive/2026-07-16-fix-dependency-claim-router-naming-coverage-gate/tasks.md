## 1. T001 — Correct the "Zero Dependencies" claim

- [x] 1.1 Run `pnpm why reflect-metadata tsyringe` at repo root; capture actual output to ground
      the dependency table (evidence must be real command output, not asserted).
- [x] 1.2 Edit root `README.md`: reword lines 16–17 ("Zero Dependencies — No external runtime
      dependencies in core") to state the true per-path footprint (zero-dependency functional
      core; class/DI path depends on `tsyringe` + `reflect-metadata`).
- [x] 1.3 Add a dependency footprint table to `README.md` (functional path vs. class/DI path,
      listing actual runtime dependencies per path).
- [x] 1.4 Apply the same correction to `packages/di/README.md`.
- [x] 1.5 Verify: reread both READMEs; confirm no remaining unqualified "zero dependencies"
      absolute claim; confirm the table matches step 1.1's real `pnpm why` output.

## 2. T002 — Rename segment-trie router artifacts

- [x] 2.1 Confirm `RadixNode` is not in `@nextrush/router`'s public-surface snapshot
      (`packages/router/src/__tests__/public-surface.test.ts`) before making any change — this
      is the evidence backing design.md's D2 (no `@deprecated` alias needed).
- [x] 2.2 Rename `packages/router/src/radix-tree.ts` → `packages/router/src/segment-trie.ts`.
- [x] 2.3 Rename the `RadixNode` type to `TrieNode` and update all references in
      `router.ts`, `segment-trie.ts` (formerly `radix-tree.ts`), and `index.ts`.
- [x] 2.4 Update JSDoc comments referencing "Radix tree node" / "compressed trie" to accurately
      describe the segment-trie implementation.
- [x] 2.5 Update internal-name references (variable names, comments) inside
      `public-surface.test.ts` — without touching the actual exported-symbol assertions the
      snapshot test checks.
- [x] 2.6 Update `packages/router/package.json` keywords/description: add "segment-trie" as
      primary; decide whether to retain "radix-tree" as a transitional secondary keyword per
      design.md's open question, and note the decision in the PR description.
- [x] 2.7 Verify: `grep -ri radix packages/router/src` returns zero matches (or only an
      explicitly justified exception). Run the router package's full test suite - green.
- [x] 2.8 Verify: run the public-surface snapshot test before/after and confirm the exported
      symbol set is byte-identical (proves the rename had zero public API impact).

## 3. T006 — Coverage gate in CI

- [x] 3.1 RED: identify or write a deliberately-failing fixture (a package instrumented with an
      artificially low coverage number, or a temporary threshold set above a real package's
      current coverage) to prove the gate can fail before wiring it for real.
- [x] 3.2 Run `pnpm test:coverage` (or equivalent) across all packages locally; record which
      packages, if any, currently sit below 90% lines / 85% branches — this answers design.md's
      Open Question and determines whether any package needs a scoped, tracked exclusion.
- [x] 3.3 Wire the coverage check into `.github/workflows/ci.yml` (or the `pnpm verify` script it
      invokes) with per-package thresholds (90% lines / 85% branches), running alongside the
      existing build/test/typecheck/lint steps per design.md's D3.
- [x] 3.4 GREEN: confirm the fixture from 3.1 now fails CI for the correct reason (coverage gate,
      not a build/lint/type error); confirm every real package at/above threshold passes.
- [x] 3.5 If step 3.2 found a real package below threshold: either fix it in this change (only if
      it's a trivial missing-test-case fix, not a full test-writing exercise — see design.md's
      Risk mitigation), or scope it out with a tracked follow-up task and an explicit, temporary
      per-package exclusion noted in the CI config with a comment linking the follow-up.
- [x] 3.6 Revert the temporary fixture/threshold from 3.1; confirm the gate still correctly
      passes on real, unmodified packages.
- [x] 3.7 Verify: full `pnpm verify` (or CI-equivalent) run — the new coverage gate itself passes
      cleanly against the real, unmodified repo (confirmed via `turbo run verify --continue`,
      where `check:coverage` does not appear in the failed-task list). `pnpm verify` end-to-end
      is NOT fully green: four PRE-EXISTING failures, unrelated to this task and outside its
      declared scope, block a clean run — `@nextrush/dev#lint` (405 pre-existing ESLint errors),
      `docs#lint`, `@nextrush/class#test` and `@nextrush/di#test` (both fail on the same
      pre-existing circular-dependency-detection test timeout in `@nextrush/di`'s container,
      unrelated to coverage). Confirmed pre-existing via `git status`/`git log` showing zero
      uncommitted changes and no commits from this branch touching `packages/dev`, `apps/docs`,
      or the affected DI/class test files. Logged as a Finding for separate follow-up, not
      silently worked around.

## 4. Cross-cutting verification

- [x] 4.1 Run the full repo `pnpm verify` (build + test + typecheck + lint + coverage) once with
      all three fixes applied together — confirm no interaction effects between the README edit,
      router rename, and CI config change. Ran `pnpm exec turbo run verify --continue`: 126/130
      tasks successful. `check:coverage` is NOT in the failed-task list (passes cleanly). The 4
      failures (`@nextrush/dev#lint`, `docs#lint`, `@nextrush/class#test`, `@nextrush/di#test`)
      are byte-identical to T006's own report and confirmed pre-existing via `git log` (none of
      this branch's 3 commits touch `packages/dev`, `apps/docs`, or `packages/di/src/container`).
      No new interaction effect between the README edit, router rename, and coverage gate — the
      failures are orthogonal to all three and were present before this change.
- [x] 4.2 Add a changeset for the router package if npm metadata (keywords/description) counts as
      a publishable change per this repo's changeset conventions; no changeset needed for the
      README-only or CI-only fixes (no package version impact). Decision: NO changeset added.
      `.changeset/config.json` places `@nextrush/router` in the `fixed` lockstep group; the only
      router diff is (a) an internal rename (`radix-tree.ts` -> `segment-trie.ts`, `RadixNode` ->
      `TrieNode`) with zero public-surface impact (confirmed by T002's before/after snapshot
      match) and (b) a `package.json` keywords-only addition (`"segment-trie"` added,
      `"radix-tree"` kept). Read 2 existing changesets (`harden-adapter-contract.md`,
      `remove-deprecated-controllers-decorators.md`) — both document genuine functional/API
      changes (major breaking removal, minor new type/package). A metadata-only keyword edit
      with no behavioral or API difference has nothing to changelog for a consumer and doesn't
      fit either convention. README-only and CI-only fixes confirmed to need no changeset (no
      package version impact) — reasoning is correct for this repo's conventions.
- [x] 4.3 Confirm no file outside this change's declared scope (README.md, di README,
      packages/router/src/*, CI config) was modified. Diffed against the actual branch point
      (`2654009~1`, the commit immediately preceding T001) since `main` is far behind and diffing
      against it pulls in ~1000 unrelated files from other completed work. Real diff: `README.md`,
      `packages/di/README.md`, `packages/router/package.json`, `packages/router/src/index.ts`,
      `packages/router/src/router.ts`, `packages/router/src/__tests__/public-surface.test.ts`,
      `packages/router/src/radix-tree.ts` -> `segment-trie.ts`, `scripts/check-coverage.ts`
      (new), `package.json` (root, +1 script), `turbo.json` (+task wiring), plus this `tasks.md`.
      All fall within declared scope: root `package.json`'s `verify` script is `turbo run verify`,
      and `.github/workflows/ci.yml` calls `pnpm verify` — so `package.json`, `turbo.json`, and
      `scripts/check-coverage.ts` are exactly "the `pnpm verify` script it calls," which the
      proposal explicitly names as an alternative to editing `ci.yml` directly. No file outside
      declared scope — no process violation.

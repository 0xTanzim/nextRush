## 1. Fix `nextrush dev`'s loader-path resolution bug (must land before section 3)

- [x] 1.1 RED: write a failing test in `packages/dev/src/__tests__/runtime-node-modules.test.ts`
      (extend the existing file) asserting that `resolveLoaderFromUrl` (or its replacement)
      returns a correct path when called with an `import.meta.url` matching `dist/cli.js`'s
      depth (zero directories under `dist/`), not just the existing test's assumed
      `dist/runtime/node-modules.js` depth (one directory under `dist/`).
- [x] 1.2 RED: write a failing integration-level test that spawns the real built CLI binary
      (`node packages/dev/bin/nextrush.js dev`, or equivalent) against a minimal fixture (reuse
      `examples/dev-cli-fixture` from the prior change) and asserts the dev server starts
      successfully — this is the test that would have caught the original bug, per design.md D2.
- [x] 1.3 Verify RED: run both new tests, confirm they fail for the right reason (the actual bug,
      reproducible per this proposal's diagnosis — not a test-setup mistake).
- [x] 1.4 Check whether `import.meta.resolve()` is reliably available and behaves correctly for a
      `workspace:*`-linked package across this repo's supported Node range (resolves design.md's
      Open Question) before choosing between it and the package.json-walk fallback from D1.
- [x] 1.5 GREEN: implement the depth-independent resolution fix in
      `packages/dev/src/runtime/node-modules.ts` per design.md D1 — resolve relative to the
      package root, not relative to the calling module's assumed directory depth. Leave the
      existing `!fileUrlBase.includes('/dist/')` source-mode fallback branch untouched.
- [x] 1.6 Verify GREEN: run the tests from 1.1-1.2 — both green. Run the full `@nextrush/dev`
      package test suite — zero regressions, including the existing `runtime-node-modules.test.ts`
      tests for the untouched dev-mode fallback path.
- [x] 1.7 Manually verify against the real fixture: run `nextrush dev` from
      `examples/dev-cli-fixture` (built package, not source) and confirm it starts successfully
      and serves a request — this is the exact reproduction from this session's diagnosis,
      confirming the fix closes the real-world symptom, not just the unit test.
- [x] 1.8 REFACTOR: confirm no duplicated resolution logic remains between the fixed function and
      any other call site; clean up naming if the fix changed the function's contract enough to
      warrant it (e.g. if `resolveLoaderFromUrl` no longer accurately describes what the function
      does).

## 2. T012 residual — core functional bundle size budget

- [ ] 2.1 Identify the existing edge-bundle budget CI job (`.github/workflows/runtime-conformance.yml`'s
      `bundle-budget` job, per the gap checklist's own citation) as the pattern to extend or
      parallel for the core bundle.
- [ ] 2.2 Add a CI check measuring the gzipped size of the general functional core bundle
      (`createApp`/`createRouter`/`listen` entry, independent of the edge adapter) with a stated
      KB budget, following the same measurement approach as the existing edge-bundle check.
- [ ] 2.3 Verify: deliberately add a heavy import to the core entry in a throwaway test commit,
      confirm the new CI check fails; revert.
- [ ] 2.4 Publish the measured core-bundle number (in CI output and/or a docs location consistent
      with where the edge-bundle number is already published).

## 3. T013 — end-to-end build integration test for `@nextrush/dev`

- [ ] 3.1 Confirm section 1's loader fix is committed and its tests are green before starting
      this section (per proposal.md's explicit sequencing rationale).
- [ ] 3.2 RED: write a build-integration test that runs `nextrush build` against a fixture (reuse
      or extend `examples/dev-cli-fixture`, adding whatever source shape is needed to exercise
      declaration emission — e.g. an exported type) and asserts the expected JS output file(s),
      `.d.ts` file(s), sourcemap file(s), and correct extension mapping (`.ts` → `.js`/`.d.ts`,
      not e.g. `.ts` → `.ts`) are all present.
- [ ] 3.3 Verify RED: run the test, confirm it fails for the right reason (missing test coverage,
      not because `nextrush build` is itself broken — if `build` fails for an unrelated reason,
      that's a separate bug to report, not to silently work around here).
- [ ] 3.4 GREEN: if the test reveals `nextrush build` already produces correct output (likely,
      since `build.ts` was not implicated in this session's bug diagnosis), the test should pass
      once written with no implementation change needed — confirm this explicitly rather than
      assuming it.
- [ ] 3.5 Verify: run this test as part of the multi-OS CI matrix from the prior
      `close-phase0-ci-matrix-and-metadata-preflight` change (T004) — confirm it's wired into the
      Windows/macOS jobs, not only the original Linux job, per this task's own acceptance
      criteria ("runs in the Win/macOS/Linux matrix").

## 4. Cross-cutting verification

- [ ] 4.1 Run the full repo `pnpm verify` locally with all changes applied — confirm no
      interaction effects between the loader fix, the core-bundle budget, and the build e2e test.
- [ ] 4.2 Confirm no file outside this change's declared scope (per proposal.md's Impact section)
      was modified.
- [ ] 4.3 Add a changeset for `@nextrush/dev` (this is a real bug fix — patch-level, following
      the same reasoning as the prior change's build-fail-fast changeset).
- [ ] 4.4 Update `docs/audits/03-gap-checklist.md`: mark T012 ☑ (with a note that this closes the
      previously-residual core-bundle scope, following the citation style already used for the
      edge-bundle portion) and T013 ☑, each with a Verified: note citing this change's commits.
      Recompute the Progress Dashboard's Phase 1 row and Total row. Also log the loader-resolution
      bug fix itself as a new, out-of-band entry (it wasn't a numbered task in the original
      checklist) — following the same "Out-of-band cleanup" note pattern already used elsewhere
      in the document for undocumented work, so the fix isn't lost from the record.

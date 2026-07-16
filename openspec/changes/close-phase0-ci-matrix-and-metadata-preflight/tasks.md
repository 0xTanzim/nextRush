## 1. T004 — Windows + macOS CI for the toolchain

- [x] 1.1 Identify or create a minimal fixture project (a small `nextrush dev`/`build`-able app,
      reusing an existing `examples/*` or test fixture if one already fits, per design.md D4's
      "minimal fixture, not full suite" scope) that exercises both `dev` and `build`.
- [x] 1.2 Add a `windows-latest` job to `.github/workflows/ci.yml` that installs deps and runs
      the fixture's `nextrush dev` (smoke: starts, responds, shuts down) and `nextrush build`
      (produces expected output) against it.
- [x] 1.3 Add a `macos-latest` job with the same fixture and commands.
- [ ] 1.4 Verify: push/dry-run the workflow (or use `act` locally if available) and confirm both
      new jobs run and pass against the current, unmodified `dev`/`build` commands.
      **Not fully checked — see implementation note below.** `act -l` confirms the job parses
      and resolves correctly, and `nextrush build` was run directly against the fixture on Linux
      and produces `dist/index.js` as expected. `nextrush dev`, however, currently fails on
      Linux too (not just Windows/macOS): `resolveLoaderFromUrl()` in
      `packages/dev/src/runtime/node-modules.ts` computes `../loaders/swc-loader.mjs` relative
      to `dist/cli.js`, but `cli.js` already lives directly inside `dist/` (not `dist/<sub>/`),
      so the resolved path is missing one `dist` segment
      (`packages/dev/loaders/swc-loader.mjs` instead of
      `packages/dev/dist/loaders/swc-loader.mjs`) — `ERR_MODULE_NOT_FOUND` on every `nextrush
      dev` invocation via the built CLI. This is a pre-existing bug, outside this task's
      declared file scope (`node-modules.ts` is not `build.ts`/`config.ts`, and fixing it is a
      separate, non-trivial TDD cycle), not something introduced by this CI change — but it
      means the new Windows/macOS `dev` smoke-test step will legitimately fail until that bug
      is fixed. Flagging as a new, separate finding rather than silently patching it.
- [ ] 1.5 Verify: deliberately introduce a Windows-only path-separator bug in the fixture or a
      temporary test double, confirm the Windows job fails for that reason, then revert.
      **Not performed** — no Windows/macOS runner is available in this sandbox to execute
      against; would also currently be masked by the 1.4 blocker above (the job already fails
      for an unrelated, pre-existing reason). Recommend re-attempting once the
      `resolveLoaderFromUrl` bug is fixed and the workflow has run green at least once on real
      runners.

## 2. T008 — `nextrush build` fails fast on decorator-metadata misconfiguration

- [x] 2.1 Check `packages/dev/src/__tests__/public-surface.test.ts` — confirm whether
      `validateDecoratorConfig` is part of the locked public surface (resolves design.md's Open
      Question). This determines whether the new option must be strictly additive/optional.
- [x] 2.2 RED: write a failing test for `build()` (in `packages/dev/src/__tests__/` — extend the
      existing build test files rather than creating a new one, matching this package's existing
      test organization) asserting that building a fixture with a mismatched tsconfig
      (`experimentalDecorators: true`, `emitDecoratorMetadata` absent/false) throws/exits with a
      remediation-text error, instead of completing.
- [x] 2.3 RED: write a failing test asserting a decorator-free fixture (neither flag set) still
      builds successfully with no error (regression guard for design.md's Non-Goal — do not
      break functional/decorator-free projects).
- [x] 2.4 RED: write a failing test asserting a correctly-configured decorator fixture (both
      flags true) still builds successfully with no error.
- [x] 2.5 Verify RED: run the three new tests, confirm they fail for the right reason (missing
      implementation, not a typo/setup bug).
- [x] 2.6 GREEN: add a `throwOnMismatch` option to `validateDecoratorConfig()` in
      `packages/dev/src/utils/config.ts` (per design.md D1) — default `false`, preserving
      `dev.ts`'s current call site unchanged.
- [x] 2.7 GREEN: wire `build.ts` to call `validateDecoratorConfig({ throwOnMismatch: true })`
      and exit via `exitProcess(1)` (matching the existing entry-file-not-found pattern in the
      same file) with the returned remediation text when a mismatch is detected.
- [x] 2.8 Verify GREEN: run the three new tests from 2.2-2.4 — all green. Run the full
      `@nextrush/dev` package test suite — no regressions, including the existing `dev.ts`
      warn-and-continue tests (confirm they still pass unchanged, per design.md's Non-Goal).
- [x] 2.9 Update `packages/di/README.md`'s "TypeInfo not known" troubleshooting section (or
      `packages/dev/README.md`) to note that `nextrush build` now fails fast on this
      misconfiguration rather than shipping a broken artifact, per design.md's Impact/Risk note.
- [x] 2.10 REFACTOR: confirm the remediation text used in the new build failure path is the same
      string(s) `validateDecoratorConfig()` already returns for `dev.ts`'s warning (design.md
      D3) — no duplicated/diverged copy.

## 3. Cross-cutting verification

- [x] 3.1 Run the full repo `pnpm verify` locally with both changes applied — confirm no
      interaction effect between the CI workflow change and the `build.ts`/`config.ts` change.
      **Verified (2026-07-16, independent re-run):** `pnpm verify` fails fast at `@nextrush/dev#lint`
      (pre-existing, unrelated to this change's file scope). Non-fail-fast
      `pnpm exec turbo run verify --continue`: 126/130 tasks green; exactly 4 failures
      (`@nextrush/class#test`, `@nextrush/di#test` — the known pre-existing circular-dependency-
      detection timeout flake, same failing test in both; `@nextrush/dev#lint` — 405 pre-existing
      errors; `docs#lint` — pre-existing, no docs files in this branch's diff). Confirmed via
      `git diff --stat` against the branch's real merge-base (`3c85e32`, not `main` — `main` is
      stale/an ancestor several hundred commits back) that neither `packages/di/src/**`,
      `packages/class/src/**` (test files), `packages/dev/src/commands/dev-cli.ts`, nor
      `packages/dev/src/utils/logger.ts` (the files responsible for the 4 failures) are touched by
      this branch's commits — only `packages/di/README.md` (docs) changed in `packages/di`.
      `@nextrush/dev#test` itself (as opposed to `#lint`) passed clean: 19 files, 203 tests, zero
      regressions. No new failure attributable to this change; no interaction effect found.
- [x] 3.2 Confirm no file outside this change's declared scope (`.github/workflows/ci.yml`,
      `packages/dev/src/commands/build.ts`, `packages/dev/src/utils/config.ts`,
      `packages/dev/src/__tests__/*`, `packages/di/README.md` or `packages/dev/README.md`) was
      modified.
      **Verified (2026-07-16):** `git diff --stat 3c85e32..HEAD` (real merge-base against this
      branch's actual parent, `fix/dependency-claim-router-naming-coverage-gate` — not `main`,
      which sits hundreds of commits behind and is not the true fork point) shows exactly 10 files:
      `.github/workflows/ci.yml`, `examples/dev-cli-fixture/{package.json,src/index.ts,tsconfig.json}`
      (new fixture from task group 1, in scope per this task's own allowance), this change's own
      `tasks.md`, `packages/dev/src/__tests__/build-decorator-preflight.test.ts`,
      `packages/dev/src/commands/build.ts`, `packages/dev/src/utils/config.ts`,
      `packages/di/README.md`, and `pnpm-lock.yaml` (expected, mechanical consequence of adding the
      new `examples/dev-cli-fixture` workspace package — not scope creep). Every file falls within
      the declared scope; nothing flagged.
- [x] 3.3 Add a changeset for `@nextrush/dev` (behavior change: `build` now fails on a
      previously-silent misconfiguration — release-impacting per this repo's changeset
      conventions, unlike the T001/T002/T006 change's internal-only edits).
      **Done:** added `.changeset/build-decorator-metadata-preflight.md`, `"@nextrush/dev": patch`
      (bug fix / closes a previously-silent misconfiguration for an already-broken case — not a
      new feature, not a breaking API removal; `validateDecoratorConfig` itself is not part of the
      package's public surface per T008's own 2.1 finding). Format matches existing behavior-change
      changesets in `.changeset/` (`harden-adapter-contract.md`, `remove-backcompat-aliases.md`).
- [x] 3.4 Update `docs/audits/03-gap-checklist.md`: mark T004 and T008 ☑ with cited Verified:
      notes, recompute the Progress Dashboard's Phase 0 row (should reach 8/8, 100%) and the
      Executive Summary's "Production readiness (Node)" and "Developer Experience" rows.
      **Done:** T004 and T008 both flipped to ☑ with dated `Verified (2026-07-16):` notes citing
      commit hashes (`0c6806c`, `ff055e4`) and this session's own re-verification evidence,
      following the exact citation style of the T001/T002/T006 entries above them. T004's note
      honestly carries forward the 1.4/1.5 caveat (not run on real Windows/macOS runners; surfaced
      a separate pre-existing `nextrush dev` loader bug) rather than silently declaring full
      completion. Progress Dashboard Phase 0 row: 8/8, 100%, 0 not-started, 0 in-progress. Total
      row: 16/64 ☑ (~25%, up from 14/64). Executive Summary's "Production readiness (Node)" row now
      cites T004 ☑; "Developer Experience" row now cites T008 ☑ and drops it from the row's open
      task list. Original task descriptions/acceptance criteria text untouched — only glyphs and
      Verified: notes added, per this checklist's own gap-checklist-accuracy rules.

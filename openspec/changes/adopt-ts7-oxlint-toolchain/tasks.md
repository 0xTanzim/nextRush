# Tasks

> Ordering is load-bearing: the lint engine swaps **before** the compiler bump (design D1), and the
> rule-parity map is written **before** anything is removed, so no enforcement is ever dropped
> silently. Gates (per-package ≥90% line coverage, tsc strict clean, lint clean) are checked in the
> group that could break them, not collected at the end.

## 1. Spike and rule-parity map (lint engine, still on TypeScript 6)

- [x] 1.1 Capture the current lint baseline — the full finding list and lint wall-time for the workspace — into `openspec/changes/adopt-ts7-oxlint-toolchain/evidence.md`; verify the recorded baseline reproduces by re-running lint and diffing the finding set
- [x] 1.2 Add `oxlint@1.83.0` and `oxlint-tsgolint@7.0.2002` to `catalog:tooling` and the root devDependencies; verify `pnpm install` succeeds under `minimumReleaseAge: 10080` with **no** `minimumReleaseAgeExclude` entry added, and `pnpm exec oxlint --version` matches the pinned version
- [x] 1.3 Prove the pinned pair is mutually usable before depending on it: run the type-aware command over `packages/router` and verify at least one type-aware rule produces a diagnostic (not a silent no-op or a version-mismatch error); record the exact invocation and output
- [x] 1.4 Translate the flat config with the Oxlint migration tool into a root `oxlint.config.ts`; verify the translated rule set lists every rule ID present in `eslint.config.mjs` (compare counts mechanically, not by eye)
- [x] 1.5 Write the rule-parity map (`037-rule-mapping.md`) — one row per rule in the current config, giving its Oxlint equivalent or an explicit waiver with rationale; verify every rule ID from the current config appears exactly once, and identify which of the `typescript-eslint` type-aware rules have no tsgolint implementation
- [x] 1.6 Settle the type-aware wiring under the per-package turbo invocation (root config vs command-line flag, per the documented constraint that type-aware options are honoured only in the root config); verify by running one package's lint task end-to-end and confirming type-aware diagnostics are reported, and record the chosen mechanism in the parity map
- [x] 1.7 Wire the custom rule as a JS Plugin — RED first: add a fixture asserting the plugin-exported rule flags runtime-identity capability branching, run it and confirm it fails before the export exists; then add the ESLint-plugin-shaped export and verify the new fixture passes
- [x] 1.8 Verify the ported custom rule's full existing fixture suite passes under the new harness, including `capability-exempt` suppression and multi-line disable blocks; verify the harness choice (keep the lint engine as a fixture-only devDependency, or port the fixtures) drops no coverage from the current suite
- [x] 1.9 Verify end-to-end enforcement of the custom rule: create a scratch source file under `packages/**/src` with a runtime-identity comparison, confirm the lint run reports it, confirm a `capability-exempt` annotation silences it, then delete the scratch file
- [x] 1.10 Update the RFC's success-metrics table with the baseline lint wall-time and the spike timings; verify the recorded numbers come from the commands in 1.1 and 1.3

## 2. Lint cutover (still on TypeScript 6)

- [x] 2.1 Swap the `lint`/`lint:fix` script bodies in all 21 package manifests to the Oxlint invocation, preserving each package's existing strictness posture (including the scaffolder's zero-warning stance); verify one package's lint task runs clean through `pnpm --filter <pkg> lint` and that the script text contains no lint-engine reference other than Oxlint
- [x] 2.2 Land the final root config and remove `eslint.config.mjs`; verify `pnpm lint` resolves configuration for a package run from its own directory (no "config not found" or ignored-config behaviour)
- [x] 2.3 Make config edits invalidate lint caches — add the root config file to turbo's global dependencies and to the lint task's declared inputs as needed; verify the task definition references the config file so a config-only commit cannot reuse a stale lint cache
- [x] 2.4 Remove the lint-path dependencies (`typescript-eslint`, the scoped `@typescript-eslint/*` packages, the Prettier-conflict config, the base JS config) from the root manifest, keeping the lint engine itself only if task 1.8's harness needs it; verify `pnpm install` succeeds and `pnpm lint` still runs clean afterwards
- [x] 2.5 Triage every finding delta against the baseline from task 1.1: fix new errors, and for each remaining difference (waiver, engine-specific edge case, or intentional severity change) record the decision in the parity map; verify `pnpm lint` exits zero with no unexplained diff against the baseline
- [x] 2.6 Verify existing suppression directives still work and were not mass-edited: confirm the directive count in source is unchanged and that a spot-check file still suppresses the rule its comment names
- [x] 2.7 Run the gate checks owned by this group: per-package line coverage at or above 90%, `tsc` strict clean, lint clean; verify all three pass and record the commands used
- [x] 2.8 Run the cross-adapter conformance suite and verify its results are identical to the pre-cutover run, proving the tooling change moved no runtime behaviour
- [x] 2.9 Record the post-cutover lint wall-time against the baseline in the change evidence file; verify the recorded figure comes from the same command as task 1.1

## 3. Compiler bump to TypeScript 7

- [x] 3.1 Baseline the pre-bump typecheck wall-time; verify it is recorded alongside the lint baseline in the evidence file and comes from a clean (uncached) run
> ⛔ **P2 is BLOCKED at task 3.2/3.3** — `tsup@8.5.1` vendors `rollup-plugin-dts@6.1.1`, which
> uses the legacy `ts.sys` API that TypeScript 7 no longer exports, breaking `dts: true` in 38 packages.
> Facts, the failed `overrides` experiment, and four options are recorded in `evidence.md` →
> "P2 blocker". Tasks 3.3–3.11 stay open until the declaration strategy is chosen.

- [ ] 3.2 Move `catalog:tooling.typescript` to the TypeScript 7 line and re-align `oxlint-tsgolint` to a release built for that same compiler version, documenting the lockstep rule as a catalog comment; verify the installed compiler reports the expected version and the install still respects the release-age quarantine
- [ ] 3.3 Validate the shared TypeScript configuration under the new compiler — RED first: run the typecheck and capture any configuration-level rejection (including the migration-only deprecation option the config currently carries); then resolve the configuration and verify the typecheck reports only source-level diagnostics, never configuration errors
- [ ] 3.4 Confirm the decorator compiler options the class-based DI path depends on are still accepted; verify by type-checking the package that owns decorator metadata and confirming no decorator-related error is reported
- [ ] 3.5 Fix the source-level diagnostics the new compiler surfaces, package by package; verify `pnpm typecheck` is green across the workspace, and re-run the affected package tests plus the conformance suite for each fix that touched runtime source
- [ ] 3.6 Harden the declaration pass against the new compiler distribution — RED first: add/extend an automated test that runs `nextrush build` with declarations enabled on a fixture project and asserts `.d.ts` output exists at the expected relative paths; verify it fails against a simulated resolution failure before the resolution/spawn handling is adjusted, then passes with the real compiler
- [ ] 3.7 Add or confirm the loud-failure test for an unresolvable compiler: assert a non-zero exit and a message naming the missing package and its install command, and assert no success output is printed with declarations absent; verify the test passes
- [ ] 3.8 Confirm the declaration pass ignores an unrelated compiler on `PATH` (resolution comes from the toolchain's own dependency tree); verify with an automated test or a recorded manual check that changes `PATH`
- [ ] 3.9 Verify the production build and test suites on the new compiler: `pnpm build` and `pnpm test` green across the workspace, including decorator-metadata build conformance — record the commands and outcomes
- [ ] 3.10 Re-run the gate checks owned by this group (per-package ≥90% coverage, tsc strict clean, lint clean) and the cross-adapter conformance suite; verify identical conformance results and green gates
- [ ] 3.11 Record the post-bump typecheck wall-time against task 3.1's baseline in the evidence file; verify the figure comes from the same uncached command

### 3b. Bundler migration — `tsup` → `tsdown` (D9; required for 3.9)

- [ ] 3.12 RED: pin the bundler failure to its mechanism before changing anything — reproduce the `pnpm build` crash on TypeScript 7, show it originates inside the bundler's vendored declaration plugin (not our source), show that a dependency override does **not** reach it, and record that no newer release of the current bundler exists; verify all four facts are reproducible and are recorded in the evidence file
- [ ] 3.13 Capture the pre-migration build contract for every package that publishes something: the `dist/` file list, the resolved `types`/`exports` entry paths, and a working import of each published entry — so the migration is judged on output, not on exit codes
- [ ] 3.14 Migrate the 38 build configs with the official migration tool on the last tsup-compatible release (v0.22.14); verify every config is converted, the toolchain dependency is declared as a catalog entry (not a loose version), and `tsup` no longer appears in any manifest or config file
- [ ] 3.15 Resolve every deprecation warning the migration release emits (moved options such as the external-dependency list, and unsupported ones such as `splitting: false`); verify a full workspace build emits **zero** deprecation warnings
- [ ] 3.16 Re-verify the captured contract of 3.13 against the migrated build: identical `dist/` file lists, identical resolved entry paths, and every published entry still importable — investigate and resolve any difference rather than accepting it
- [ ] 3.17 Only after 3.15 is warning-free, move the toolchain catalog to the current release line and re-verify: still zero warnings, output unchanged from the previous step, and the tool's compiler peer satisfied — proving no option was silently dropped
- [ ] 3.18 Handle the packages with non-default build needs individually (the dev CLI's declaration tree and loader copy, its post-build hook, the scaffolder, and any package using platform/tree-shaking settings); verify each builds and its own tests pass
- [ ] 3.19 Verify the full workspace on TypeScript 7: `pnpm build`, `pnpm typecheck`, `pnpm test` green, and the cross-adapter conformance suite identical to the task 2.8 baseline

## 4. Generated-project toolchain (project-scaffolding delta)

- [x] 4.1 RED: add the acceptance tests this delta requires — (a) every package imported by an emitted lint configuration is declared in the generated manifest, (b) the emitted lint script exits zero on a generated project, (c) the emitted editor recommendation names the configured linter, (d) the emitted compiler range is on the framework's current compiler major; verify all four fail against the current generator output
- [x] 4.2 Emit an Oxlint configuration from the production preset instead of the ESLint one, and declare the packages that configuration needs in the generated manifest; verify 4.1(a) and 4.1(c) pass
- [x] 4.3 Point the emitted editor recommendation at the configured linter's extension; verify 4.1(c) passes and no stale linter recommendation remains in any preset file
- [x] 4.4 Single-source the generated compiler range onto the framework's current compiler major (including the offline fallback path, which must not keep a hardcoded older line); verify 4.1(d) passes for generated projects and for the offline/no-registry path
- [x] 4.5 Make the generated lint script and generated docs consistent with the emitted configuration; verify the documented command in the generated project documentation runs as written
- [x] 4.6 Run the generate-then-install matrix for a production-preset project on at least one runtime and verify 4.1(b): install, lint, then build all exit zero with no unresolved-module error
- [ ] 4.7 Update the package's README/architecture documentation for the emitted toolchain, and any recipe that named the previous linter; verify no quoted command or dependency list contradicts the generator's actual output
- [ ] 4.8 Run the gate checks owned by this group — per-package ≥90% line coverage for the scaffolder, tsc strict clean, lint clean — and verify they pass

## 5. Website lint and contributor documentation

- [x] 5.1 Decide the website app's linter on evidence: compare the rule set the site currently enforces against what the Oxlint Next plugin provides; verify the decision is recorded in the parity map, and if coverage is incomplete, scope the existing linter to that one app and document why
- [x] 5.2 Apply 5.1's outcome so the website's lint task passes; verify the site's lint command exits zero and, if a linter remains scoped there, that its config is isolated to that app
- [ ] 5.3 Update contributor documentation for the new toolchain — the unchanged `pnpm lint` / `pnpm verify` commands, the editor extension to install, and how to run a single package's lint; verify every command shown in the documentation runs as written
- [ ] 5.4 Update the repo's editor recommendation file and any contributor-facing guidance that referenced the previous linter; verify a repository-wide search of non-historical documentation finds no instruction to install or configure the previous linter
- [x] 5.5 Correct the capability-list drift found during planning: `openspec/config.yaml`'s fixed capability list omits capabilities that exist in `openspec/specs/` and the registry README (including the two this change targets); verify the list matches the directories on disk
- [x] 5.6 Align the capability registry README with disk as part of 5.5; verify its stated capability count and table rows match `openspec/specs/` exactly

## 6. Integration verification and close-out

- [ ] 6.1 Run the full `verify` task from a clean checkout state (uncached) and verify it exits zero end-to-end: build, test, typecheck, and lint
- [ ] 6.2 Verify end-to-end that the previous linter is gone from the lint path — no lint task, config, or dependency in the workspace causes the previous engine to be invoked — while the repo rule and typed rules are still enforced (spot-check one finding of each kind)
- [ ] 6.3 Run the generate-then-install matrix and the cross-adapter conformance suite together and verify both pass unchanged, proving the generated-project contract and runtime behaviour are intact
- [ ] 6.4 Verify the §14-style metrics recorded in the evidence file are complete: baseline and post-change lint and typecheck timings, rule-parity coverage, and the custom-rule fixture outcome
- [ ] 6.5 Promote the durable decisions to an ADR from the ADR template — the repository's linter choice and the compiler/type-aware-engine version lockstep — and verify the ADR exists, is linked from the RFC, and states the lockstep rule concretely
- [ ] 6.6 Update the RFC's progress tracker, phase statuses, and status field to reflect the shipped outcome, and mark the plan's checkboxes complete; verify the tracker and the phase table agree
- [ ] 6.7 Verify the change's own artifacts are internally consistent before archive: proposal capability list matches the delta files on disk, every requirement has at least one scenario, and the validation command passes


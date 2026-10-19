# Tasks

## 1. Land the completed work

- [x] 1.1 Commit only this change's planning artifacts (`proposal.md`, `design.md`, `tasks.md`, `.openspec.yaml`); verify `git status --short` still lists the pre-existing unrelated edits (`.github/copilot-instructions.md`, `AGENTS.md`, `.changeset/pre.json`, `reports/**`) as unstaged and none of them in `git diff --cached`.
- [x] 1.2 Verify the branch before proposing it: `turbo run build`, `turbo run test`, `turbo run lint`, `turbo run typecheck`, then `dev-check all` on Bun and Node; verify the only test failure is the pre-existing `@nextrush/dev` missing-fixture case, and record the raw tails of each command.
- [ ] 1.3 Open the pull request from `feat/rfc-039-precompile-tax` to `main` describing the archived `fix-request-path-and-response-contract`; verify the PR exists and merging leaves `git log main..HEAD --oneline` empty. CI is not run in this session (the toolchain action's stale pnpm pin is fixed in this change; the user waived the CI gate).
- [ ] 1.4 Create the working branch for the rest of this change from the merged `main`; verify `git merge-base --is-ancestor main HEAD` succeeds and the branch starts even with `main` (`git rev-list --count main..HEAD` is 0).

## 2. Reconcile the RFC record

- [ ] 2.1 Update RFC-039's progress tracker: P1 (lazy context fill / const-header skip) is shipped, P0 has Bun hello-world only; verify every changed row names the commit or test that proves it.
- [ ] 2.2 Update RFC-040's progress tracker: P0, P1, and P2 (Web footprint) are shipped, P3/P4 unchanged; verify the stated fraction equals the rows and that the P2 row names the lazy-header, lazy-IP, runner, and gate evidence.
- [ ] 2.3 Update RFC-029: confirm P0 (`canonicalizePath` + dot-segment rejection), P1 (`ctx.path` folded / `ctx.originalPath` raw), and P2 (prefix/mount canonicalization) against `packages/router/src/dispatch.ts`, `canonicalize.ts`, and their tests; mark P3 (`caseSensitive` default flip) explicitly not shipped; verify each status has a file:line or test anchor, and that the spec's "default remains false" statement matches.
- [ ] 2.4 Align each RFC's own status line with its `docs/RFC/INDEX.md` row (029 file/index disagree today); verify a diff of the two rendered status strings reports no mismatch for 029, 039, 040, 041.
- [ ] 2.5 Record in RFC-041 §14 the number this baseline supplies and the fact that the before-state is now measured on both runtimes; verify §14 points at the recorded table rather than an unquantified claim.

## 3. Extend the profiling harness (tests first)

- [ ] 3.1 RED — add `apps/benchmark/scripts/dev-check/lib/__tests__/profile-entries.test.mjs` asserting: every profiling entry is listed in the dev-check README's entry table; each entry bundles and emits a `US=` line under Bun and Node at `N=2000`; the parsed and unparsed POST entries perform identical handler work. Run `pnpm --filter nextrush-benchmark test` and verify it fails for the missing entries.
- [ ] 3.2 Add `inproc-nextrush-post.ts` (POST `/echo`, `bodyParser()`, ~1 KB JSON, env `N`/`HEADERS`/`BODY_BYTES`) and verify the new test covers it on both runtimes.
- [ ] 3.3 Add `inproc-nextrush-post-unparsed.ts` (same response and body, no `bodyParser()`) and verify the parity assertion proves parsed vs unparsed do identical handler work.
- [ ] 3.4 Add `inproc-nextrush-mw.ts` (five middleware that set a header/state value around a JSON handler) and verify the test covers it; its output names the middleware count so a profile run is self-describing.
- [ ] 3.5 Document the four entries and their env contract in `apps/benchmark/scripts/dev-check/README.md`; verify `pnpm --filter nextrush-benchmark test` is green.

## 4. Measure Bun and Node

- [ ] 4.1 Load the `framework-profiling` and `framework-audit-profiling` skills and follow their measurement procedure; verify the recorded notes name the skill file and the step used.
- [ ] 4.2 Run Bun profiles for `inproc-nextrush`, `inproc-nextrush-post`, `inproc-nextrush-post-unparsed`, and `inproc-nextrush-mw` at `HEADERS=4` and `HEADERS=12`; verify each run writes a profile file and prints top self-time rows, and keep each run short (no full publishable suite).
- [ ] 4.3 Run the same four profiles on Node; verify `.cpuprofile` parsing succeeds via `cpuprofile-top.mjs` and the top rows are printed.
- [ ] 4.4 Record the attribution table in RFC-039 §3.7/§3.8 with provenance for every row: runtime and exact version, entry, env, `N`, command, date, run-to-run spread, and machine-load note; verify no row carries a number without those fields.
- [ ] 4.5 Record allocation and layout evidence: deterministic per-request object counts for the hot path, and property-order/shape stability of the request context objects; label any cache-line or branch-prediction statement as inference with its basis, and verify no claim asserts a measurement that does not exist.
- [ ] 4.6 Repeat one profile run and compare the top three rows; verify the record states whether they were stable or drifted, rather than presenting one sample as the profile.

## 5. Triage findings

- [ ] 5.1 Build the findings table from §4: measured cost and source anchor, impact, counter-evidence, trade-off, and a validation criterion; verify every row has all six fields and that rows without a validation criterion were dropped.
- [ ] 5.2 Classify each finding as `fix-now` (behaviour-preserving, above the noise floor, one module, no public API), `rfc` (architectural or observable), or `no-action`; verify no `rfc` item has a code task and the counts match the table.
- [ ] 5.3 Record every `rfc`-class finding in the governing RFC with its evidence; verify each names the measurement, the suspected cause, and what would confirm it.

## 6. Fix only what measurement justifies

- [ ] 6.1 For each `fix-now` finding, write the failing test or deterministic allocation assertion first and verify it fails for the stated reason. If the table is empty, record that outcome in the findings table and skip 6.2–6.4.
- [ ] 6.2 Implement the minimal change that makes that test pass; verify the touched package's suite is green and no unrelated file changed.
- [ ] 6.3 A/B the affected scenario with best-of-three, CPU-pinned where available; verify the reported win exceeds the run-to-run spread and that `dev-check inproc` does not regress.
- [ ] 6.4 Refactor for clarity with tests green, then re-run the A/B; verify the numbers still hold and the diff remains behaviour-preserving (no status/header/body/ordering change).
- [ ] 6.5 If a candidate fix turns out to change observable behaviour, stop, reclassify it as `rfc`, and verify no such diff is present in the change.

## 7. Record the verdict and the next move

- [ ] 7.1 Write the RFC-039 P0 verdict: whether P2 (compiled request validator) and P3 (compiled response serializer) are justified, with the measured evidence for and against, including the standalone-schema-library caveat; verify the verdict cites specific rows from §4.
- [ ] 7.2 Record the Node baseline implication for RFC-041 §14: the before-number, the shapes it covers, and the note that §14.2's "zero copies when untouched" needs a deterministic copy counter rather than heap sampling; verify §14 now contains a checkable measurement procedure.
- [ ] 7.3 Write the next change's scope note (the RFC-041 §14 gate measurement) in RFC-041, naming the exact probes and the before/after comparison; verify it requires no code change to the response model.

## 8. Gates and hygiene

- [ ] 8.1 Run `dev-check all` on Bun and Node; verify the recorded verdict shows no new FAIL and that `knownFailures` still contains exactly `{FB-03: "*"}` (the exemption may only be deleted by the change that fixes the behaviour).
- [ ] 8.2 Run `turbo run test`, `turbo run lint`, and `turbo run typecheck`; verify 35/35 clean and that no touched package's coverage decreased against the recorded baseline.
- [ ] 8.3 Run the `hygiene` and `bookkeeping` stages; verify no source comment added by this change points at a planning artifact, and no known-failure id became an orphan.
- [ ] 8.4 If any adapter was touched, run the conformance suite; verify in-process plus real Bun/Deno/workerd runs stay green. If none was touched, record that fact instead of running it.
- [ ] 8.5 Verify commit hygiene: one commit per completed group, conventional-commit subjects, no pre-existing unrelated edits staged, and `git status --short` clean apart from the pre-existing files noted in 1.1.

## Workflow follow-up

- Archive this change with `openspec archive` after apply; `skip_specs` means there is no delta to sync.
- Then propose the next change for the RFC-041 §14 gate measurement — this change supplies its baseline, not its implementation.

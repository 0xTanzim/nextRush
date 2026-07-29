## 1. Pre-flight

- [x] 1.1 Run `pnpm test` (`node --test scripts/lib/__tests__/*.test.js`) and record the baseline
      pass count — this is the regression floor for every task below.
- [x] 1.2 Confirm every file this change plans to move or delete matches design.md's Context section
      exactly: re-run the `grep -l "from '\.\./run\|from '\.\./bench-exec"` check across the 12 alloc
      files (expect zero matches) and re-confirm `results/2026-07-29T03-36-30/`,
      `results/2026-07-28T10-58-17/`, and `scripts/results/cpuprof-server-c128/` still contain only
      what design.md recorded (evidence may have changed since that session).

## 2. Structural cleanup — moves and deletions, zero behavior change (land before any fix)

- [x] 2.1 Create `apps/benchmark/scripts/alloc/`. `git mv` the 19 allocation-suite files (18
      `*-alloc.js`/`*-alloc-child.js` pairs plus `check-alloc-regression.js`) from
      `scripts/` into it.
- [x] 2.2 Update every moved file's relative imports (`./lib/...` → `../lib/...`,
      `./utils.js` → `../utils.js`, any `../config/...` path adjusted for the new depth).
- [x] 2.3 Update `apps/benchmark/package.json`'s 9 `bench:alloc*` script paths and
      `check-alloc-regression.js`'s own invocation path (if wired anywhere in CI or docs) to
      `scripts/alloc/<name>.js`.
- [x] 2.4 Delete `apps/benchmark/scripts/report.js`. Remove its 4 `package.json` scripts (`report`,
      `report:latest`, `report:list`, `report:trend`).
- [x] 2.5 Delete `apps/benchmark/results/2026-07-29T03-36-30/`,
      `apps/benchmark/results/2026-07-28T10-58-17/`, and
      `apps/benchmark/scripts/results/` (the stray `.cpuprofile` and its parent dir). Add
      `scripts/results/` to `.gitignore` per design.md's Open Question resolution.
- [x] 2.6 Verify: run every `bench:alloc:*` script once and confirm each exits 0; run
      `node --test scripts/lib/__tests__/alloc-regression.test.js` and confirm it still passes;
      `grep -rn "scripts/report\.js\|scripts/compose-alloc\|scripts/handler-alloc\|scripts/context-alloc\|scripts/context-raw-alloc\|scripts/context-state-alloc\|scripts/dispatch-alloc\|scripts/param-match-alloc\|scripts/router-match-alloc\|scripts/web-context-alloc\|scripts/check-alloc-regression" apps/benchmark/package.json apps/benchmark/README.md .github/`
      and confirm every remaining hit already has the `alloc/` segment — no missed repoint.
- [x] 2.7 Run the full `pnpm test` suite — confirm the pre-flight's baseline count still passes with
      zero regressions from the moves/deletions alone.

## 3. Documentation corrections (same commit as the structural cleanup they describe)

- [x] 3.1 Update `apps/benchmark/README.md`'s Directory Structure tree: move the 12 `*-alloc.js`
      lines under a new `scripts/alloc/` subtree entry; remove the `report.js` line.
- [x] 3.2 Update `apps/benchmark/README.md`'s "View Results" section: replace the
      `node scripts/report.js --list`/`--id` usage block with the `generate-report.js`
      equivalent (`pnpm report:generate -- --id <run-id>`, `pnpm report:regenerate-all` for
      listing/history).
- [x] 3.3 Fix `apps/benchmark/README.md`'s Methodology section line 6 ("the 8 core scenarios return
      byte-identical responses") to state the current derived count (10 like-for-like of 13 total),
      matching the correction already applied elsewhere in the same document.
- [x] 3.4 Update the `## Allocation Harnesses` section's `scripts/*-alloc.js` reference to
      `scripts/alloc/*-alloc.js`.

## 4. D3 — Backlog disclosure in the Load Configuration table (P2-001, disclosure half)

- [x] 4.1 RED: add a failing test asserting the Load Configuration table (or metadata section)
      renders a backlog row stating the OS-read value and the override note, when
      `configuration.parity.validated` is true and an OS-read backlog value was recorded.
- [x] 4.2 GREEN: implement the row in the relevant `sections-*.js` module, reading the value from
      `configuration.parity` (already populated by `fix-benchmark-harness-integrity`'s D5).
- [x] 4.3 RED→GREEN: add a test asserting the table states the value was not verified when parity
      was skipped or not run, rather than fabricating or omitting the row.
- [x] 4.4 Verify: run `pnpm bench:verify --rotate` and inspect the generated `REPORT.md`'s Load
      Configuration table for the new row and correct wording in both the validated and
      `--no-validate` cases.

## 5. D4 — Rank-aggregate excludes c1; noise-tie splits points (P2-003)

- [x] 5.1 RED: add a failing test asserting `buildScoreboard`'s `overall.likeForLike`/`overall.all`
      point totals are computed over `connections.filter((c) => c > 1)`, using a fixture with a c1
      level and at least one higher level, confirming c1's ranking does not contribute to the total.
- [x] 5.2 GREEN: implement the connection-list filter in `scoreboard.js#buildScoreboard` before
      calling `buildOverall`; confirm `pointsPerConnection` (already per-connection) is unaffected.
- [x] 5.3 RED: add a failing test asserting two entries whose RPS gap is smaller than their combined
      stddev receive the same rank and split the combined points for those rank positions evenly.
- [x] 5.4 GREEN: implement the noise-tie rank-sharing and point-split in `rankEntries`.
- [x] 5.5 REFACTOR: run the full suite; confirm no regression to existing
      `report-scoreboard.test.js` assertions about `points`/`rank` for non-tied, non-c1 cases.
- [x] 5.6 Verify: run `pnpm bench:verify --rotate` with a scenario/framework combination expected to
      produce a close result at one concurrency level; inspect the scoreboard for a shared rank and
      split points.

## 6. D5 — `rankEntries` stops mutating inputs; derives points from `POINTS_FOR_LAST_PLACE` (P3-003)

- [x] 6.1 RED: add a failing test asserting `rankEntries` does not add or modify any property on the
      objects in its *input* array (compare the input array's own objects before/after the call,
      not the returned copies).
- [x] 6.2 GREEN: replace the `entry.__rank = rank` mutation with a local rank-tracking structure that
      does not touch the input objects.
- [x] 6.3 RED→GREEN: add a test asserting `rankEntries`'s point calculation is expressed in terms of
      `POINTS_FOR_LAST_PLACE` (e.g. changing the constant in a test-local copy of the function's
      logic changes the computed points), not an inline literal disconnected from the exported
      constant.
- [x] 6.4 GREEN: implement the `pointsForRank` helper per design.md D5.
- [x] 6.5 Verify: `report-scoreboard.test.js`'s existing `POINTS_FOR_LAST_PLACE` assertion
      (`assert.equal(POINTS_FOR_LAST_PLACE, 1)`) and every points-value assertion in that file still
      pass unchanged (D5 is a no-op at the current constant value by design).

## 7. D6 — Charts omit missing cells instead of zero-filling (P2-004)

- [ ] 7.1 RED: add a failing test asserting `concurrencyScalingChart` omits a data point (rather than
      emitting `0`) for a series value of `null` in its input, and that the chart's caption mentions
      the omitted cell.
- [ ] 7.2 GREEN: implement the omission in `concurrencyScalingChart`.
- [ ] 7.3 RED→GREEN: repeat for `scenarioProfileRadar`.
- [ ] 7.4 Verify: render a chart from a fixture with one missing cell and visually confirm (or assert
      against the generated Mermaid source) that no data point renders at value 0 for that cell.

## 8. D7 — Documentation and capture-completeness fixes (P3-005, 007, 008, 010)

- [ ] 8.1 Add `ss` (iproute2) to `apps/benchmark/README.md`'s Prerequisites section; state
      `--no-validate` as the documented fallback when it is unavailable.
- [ ] 8.2 RED: add a failing test asserting a run's artifact records a `warmupFailures` array
      (or equivalent field) when a warmup request throws, in addition to the existing log line.
- [ ] 8.3 GREEN: implement in `bench-exec.js#warmupUrl` and thread the field into the persisted
      per-framework result.
- [ ] 8.4 Add the `--max-old-space-size=512` uniform-value-not-uniform-effect caveat to
      `constants.js`'s `NODE_SERVER_FLAGS` doc comment and to the Load Configuration table's note.
- [ ] 8.5 RED: add a failing test asserting `captureNextRushEffectiveOptions`'s generalized
      equivalent captures effective timeout/keep-alive values for every framework exposing them,
      recording `null` with a stated reason for frameworks with no equivalent introspection point.
- [ ] 8.6 GREEN: implement the generalized capture in `provenance.js`.

## 9. D3 (test process fix) — P3-006

- [ ] 9.1 Rewrite `warmup-provenance.test.js` to spawn `run.js` against a real ephemeral test server
      and assert the recorded provenance field's value, replacing the regex-against-source-text
      assertions. Confirm the rewritten test still fails if warmup provenance recording is broken
      (mutate the implementation locally, confirm RED, revert).

## 10. Exit gate

- [ ] 10.1 Run `pnpm test` — 0 failures, including every new test added in tasks 2–9.
- [ ] 10.2 Run `pnpm bench:validate` — still passes for all 6 default frameworks (confirms the
      structural moves and behavioral fixes didn't regress fairness).
- [ ] 10.3 Run `pnpm bench:verify` (default + `--rotate`) end to end; manually inspect the generated
      `REPORT.md` for: the new backlog disclosure row, correct c1-excluded headline totals, correct
      shared-rank/split-points rendering if a near-tie occurs in the sample data, and no chart
      rendering a zero for a missing cell.
- [ ] 10.4 Confirm zero backwards-compatibility shims exist anywhere in the diff: no forwarding stub
      left at `scripts/report.js`'s old path, no `@deprecated` marker, no dual codepath preserving
      the old rank-scoring or chart-zero-fill behavior behind a flag.
- [ ] 10.5 Independent re-verification in a fresh session/context, same discipline as
      `fix-benchmark-harness-integrity`'s task 4.4/11.5.
- [ ] 10.6 Commit as atomic, single-concern commits: (a) structural moves + doc updates, (b) D3
      backlog disclosure, (c) D4 rank-aggregate + noise-tie, (d) D5 rankEntries mutation/points, (e)
      D6 chart omission, (f) D7 + P3-006 batch — per `kiro-git.md`.

## 11. Change closeout

- [ ] 11.1 Confirm every scenario in the delta spec (`specs/performance-gate/spec.md`) is satisfied
      by a passing test or a manually verified run recorded in this tasks file.
- [ ] 11.2 Run `openspec validate cleanup-benchmark-harness-structure --strict` — must pass.
- [ ] 11.3 Sync the delta into `openspec/specs/performance-gate/spec.md` once the change is merged.
- [ ] 11.4 Confirm no audit finding from `report/benchmark/benchmark-engineering-audit-review.md`
      remains untracked: cross-check the full P0–P3 list against this change's tasks plus
      `fix-benchmark-harness-integrity`'s Deferred Items list, and note in this file's final state
      which items are closed by code, which are closed by explicit, named deferral, and confirm none
      are simply absent from both.

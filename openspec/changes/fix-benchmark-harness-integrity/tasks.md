## 0. Pre-flight (both flights)

- [x] 0.1 Read `report/benchmark/benchmark-engineering-audit-review.md` §4 (Findings) end to end and
      confirm the file line numbers cited in this tasks list against current `apps/benchmark`
      source (source may have shifted since the audit ran) before starting Flight 1.
- [x] 0.2 Confirm `node --test scripts/lib/__tests__/*.test.js` passes on the current branch
      (baseline: 136/136 per the audit) before any change, so a later failure is attributable to
      this change's own edits.

---

# FLIGHT 1 — BLOCKING (P0-001 + P1-001). Nothing in Flight 2 starts until every task here is
# done, verified, and independently re-checked in a fresh session per loop-engineering.md's
# generator≠verifier rule.

## 1. D4 — Verification profile (built first so Flight 1's own fixes have something to verify against)

- [x] 1.1 RED: add a failing test in `scripts/lib/__tests__/run-options.test.js` (or a new
      `profiles.test.js`) asserting `PROFILES.verify` exists with `runs: 3`,
      `connections.length >= 2`, `duration` parsing to `>= 10` seconds, and `publishable: false`.
- [x] 1.2 GREEN: add the `verify` profile to `apps/benchmark/config/profiles.js` per design.md D4
      (duration `10s`, connections `[64, 256]`, runs `3`, `publishable: false`, descriptive text).
      Do not modify `quick`, `standard`, `full`, or `stress`.
- [x] 1.3 Add `bench:verify` to `apps/benchmark/package.json` scripts:
      `node scripts/run.js --profile verify --rotate --compare --scenario hello-world`. Confirm the
      script also accepts an explicit `--scenario`/`--frameworks` override for targeted use in later
      tasks (already supported by `run.js`'s existing CLI — verify, don't reimplement).
- [x] 1.4 REFACTOR: run `pnpm bench:verify` once against the default scenario/framework set and
      confirm it completes in single-digit minutes; record the observed wall time in this task's
      completion note for future reference.

## 2. D2 — wrk POST body fidelity (P0-001)

- [x] 2.1 RED: add a failing unit test asserting that the wrk-invocation path for a POST scenario
      derives its request body from `scenario.body` (e.g. a test that stubs/inspects the generated
      script or the constructed `wrk` invocation and asserts the body matches
      `getScenario('large-post').body`, not `getScenario('post-json').body`).
- [x] 2.2 GREEN: modify `scripts/bench-exec.js#runBenchmark`'s wrk branch to generate the Lua
      script's body from `opts.scenario.body` at invocation time (temp file under
      `results/<run-id>/` per design.md's risk mitigation, or an env-var-driven shared script — pick
      one and document the choice in a code comment referencing this change, not the audit's
      finding ID per `comments.instructions.md`).
- [x] 2.3 Delete `apps/benchmark/wrk/post-json.lua`; delete any references to it in
      `bench-exec.js`/`bench-exec-single.js`/`bench-rotation.js`.
- [x] 2.4 Verify temp-script cleanup happens in the same `finally` block that already stops the
      server process (no orphaned temp files after a crashed run) — add a test or manual check.
- [x] 2.5 GREEN: extend `scripts/validate-parity.js` to assert request-body fidelity — for
      `large-post`, assert the server's parsed `itemCount` in the response matches the scenario's
      known declared item count (computable from `LARGE_POST_BODY`'s construction); for `post-json`,
      confirm the normalized response still round-trips the sent name/email.
- [x] 2.6 REFACTOR: run `pnpm bench:validate` and confirm it still passes for all 6 frameworks with
      the new request-body assertions active.
- [x] 2.7 Verify: run `pnpm bench:verify --scenario large-post` (or the equivalent override) and
      confirm every framework's `itemCount` in the run's raw per-framework JSON reflects the full
      declared body's item count, not `0`.

## 3. D3 — Rotation as a publishability criterion (P1-001)

- [x] 3.1 RED: add a failing test in `scripts/lib/__tests__/publishable.test.js` — a config with
      `frameworkCount > 1` (or an equivalent `results` shape implying multiple frameworks) and
      `positionControl: 'fixed'` must yield `publishable: false` with a reason mentioning position
      control.
- [x] 3.2 RED: add a failing test for `positionControl: undefined`/`null` with multiple frameworks —
      same rejection, distinct from "fixed" only in that the field is absent, not explicitly set.
- [x] 3.3 RED: add a failing test confirming a single-framework run (`Object.keys(results).length
      === 1`) is NOT rejected on this criterion regardless of `positionControl`.
- [x] 3.4 RED: add a failing test confirming `positionControl: 'rotated'` with multiple frameworks is
      NOT rejected on this criterion (other criteria still apply independently).
- [x] 3.5 GREEN: implement the new branch in `scripts/lib/publishable.js#derivePublishable` per
      design.md D3. Determine framework count from `Object.keys(results).length` (excluding entries
      with `.error`, matching existing exclusion patterns elsewhere in the codebase).
- [x] 3.6 RED: add a failing test for `rotate()` in a new
      `scripts/lib/__tests__/bench-rotation.test.js` — assert exact position balance when
      `runs % frameworks.length === 0` and ±1 balance otherwise (design.md's stated property).
- [x] 3.7 GREEN: confirm `rotate()` in `bench-rotation.js` already satisfies 3.6 (it should — this is
      a missing-test gap, not a missing-implementation gap per the audit's P2-007). If it does not,
      fix it.
- [x] 3.8 GREEN: update `scripts/lib/report/sections-scoreboard.js`'s guard from
      `positionControl === 'fixed'` to `(positionControl ?? scoreboard.configuration?.order) !==
      'rotated' && scoreboard.frameworks.length > 1` — matching `sections-metadata.js`'s existing
      fallback resolution exactly, per design.md D3.
- [x] 3.9 RED→GREEN: add/extend a test in `scripts/lib/__tests__/report-scoreboard.test.js`
      confirming the "not a ranking" warning renders for `positionControl: null` (not only
      `'fixed'`), and does NOT render for a single-framework report regardless of position control.
- [x] 3.10 REFACTOR: run the full `scripts/lib/__tests__/*.test.js` suite; confirm 0 failures,
      including the pre-existing 136.
- [x] 3.11 Verify: run `pnpm bench:verify` (fixed order, i.e. omit `--rotate`) against 2+ frameworks
      and confirm the resulting `results.json` has `publishable: false` with the new position-control
      reason. Run again with `--rotate` and confirm that specific rejection no longer fires (other
      criteria may still apply since `verify` is unconditionally non-publishable per D4 — confirm the
      REASON changes, not necessarily the boolean).

## 4. Flight 1 exit gate

- [x] 4.1 Run `pnpm test` (or `node --test scripts/lib/__tests__/*.test.js`) — 0 failures.
- [x] 4.2 Run `pnpm bench:validate` — parity OK for all 6 default frameworks.
- [x] 4.3 Run `pnpm bench:verify` end to end (default + `--rotate`) and manually inspect the
      generated `REPORT.md` for the run: confirm the scoreboard section and the "not a ranking"
      warning behave as expected for both the rotated and non-rotated invocation.
- [x] 4.4 Independent re-verification: in a fresh session/context (per `loop-engineering.md`'s
      generator≠verifier rule and this agent's own Section 6 Validator separation), re-run tasks
      4.1–4.3 from raw tool output with zero trust in this flight's own self-report before
      committing.
- [x] 4.5 Commit Flight 1 as its own atomic commit(s) — `fix(benchmark): derive wrk POST body from
      scenario config, not a static literal` and `fix(benchmark): require rotation for a
      cross-framework publishable ranking` (or combined if genuinely one logical unit — see
      `kiro-git.md`). Do not bundle Flight 2 changes into this commit.

---

# FLIGHT 2 — after Flight 1 is merged and independently re-verified.

## 5. D5 — Persist publishability/parity verdict into results.json (P1-002)

- [x] 5.1 RED: add a failing test asserting `run.js`'s report-building logic calls
      `withRecomputedPublishable` (or equivalent) on its own freshly assembled report object before
      `saveResults(..., 'results.json', report)` — inspect via a test that constructs a report with
      a known-non-publishable shape and asserts the object passed to `saveResults` already has the
      corrected fields.
- [x] 5.2 GREEN: wire the call in `scripts/run.js` per design.md D5.
- [x] 5.3 RED: add a failing test for a new `configuration.parity` field shape:
      `{ validated: boolean, skippedReason: string | null, failures: string[] }`.
- [x] 5.4 GREEN: populate `configuration.parity` in `run.js` from `runParityCheck`'s existing `{ ok,
      failures }` return value (currently discarded after the exit-code decision) and from the
      `--no-validate`/single-framework skip conditions already present in `run.js`.
- [x] 5.5 GREEN: update `scripts/check-regression.js` to call the recomputation function on both
      `baseline` and `latest` reports instead of reading `report.publishable` directly.
- [x] 5.6 REFACTOR: run the full test suite; confirm no regression to existing
      `publishable.test.js` / `run-collision.test.js` assertions.

## 6. D6 — Tool-agnostic timeout accounting (P1-003)

- [x] 6.1 RED: add a failing test in `scripts/lib/tools/__tests__/autocannon.test.js` (create if
      absent) asserting `runAutocannon`'s resolved result includes `errors.timeout` (singular) equal
      to `errors.timeouts`.
- [x] 6.2 GREEN: add the `timeout` key alongside `timeouts` in
      `scripts/lib/tools/autocannon.js#runAutocannon`'s return shape.
- [x] 6.3 RED→GREEN: add/extend a test in `scripts/lib/__tests__/publishable.test.js` confirming
      `countSocketTimeouts` correctly sums timeouts from an autocannon-shaped results tree (currently
      only wrk-shaped trees are exercised, per the audit's finding).
- [x] 6.4 Verify: no existing reader of `errors.timeouts` (plural) breaks —
      `grep -rn "errors.timeouts" scripts/` and confirm every call site still resolves.

## 7. D7 — static-file scenario reclassification (P1-004)

- [x] 7.1 GREEN: change `static-file`'s `identicalWork` field from `true` to `false` in
      `apps/benchmark/config/scenarios.js`; update its `description` to state why (header-set
      divergence across frameworks' own static-serving mechanisms, verified by direct measurement).
- [x] 7.2 RED→GREEN: extend `scripts/lib/__tests__/report-scoreboard.test.js` (or equivalent) to
      assert `static-file` now appears in the "all scenarios" table and not in the "like-for-like"
      table's `likeForLikeScenarioIds`.
- [x] 7.3 Verify: run `pnpm bench:verify --scenario static-file --compare` and confirm the generated
      report's headline like-for-like score excludes it while the "all scenarios" table still shows
      it, tagged idiomatic like `middleware-stack`/`error-handling`.
- [x] 7.4 Confirm no other scenario's classification, ranking, or points changed as a side effect
      (design.md's fairness check on the fix itself) — diff `overall.likeForLike.rows` for every
      OTHER scenario's points between a pre- and post-change verify run with identical raw inputs
      (or reason through `buildScoreboard`'s logic if a live diff isn't practical, and record the
      reasoning).

## 8. D8 — Report claims derived from run state (P1-005)

- [x] 8.1 RED: add a failing test asserting `methodologySection`'s parity line differs between a
      run with `configuration.parity.validated: true`, one with `validated: false, skippedReason:
      '...'`, and one with a recorded failure — three distinct rendered strings, not one constant.
- [x] 8.2 GREEN: implement the parity-claim derivation in
      `scripts/lib/report/sections-detail.js#methodologySection`, consuming the `configuration.parity`
      field added in task 5.4. Add a fallback string for legacy artifacts with no `parity` field
      (pre-Flight-2 runs), explicitly distinguishable from a validated result.
- [x] 8.3 RED→GREEN: add a failing→passing test asserting the "N scenarios do byte-identical work"
      sentence's `N` and excluded-scenario names are read from `scoreboard.likeForLikeScenarioIds`
      and `scoreboard.scenarios`, not a literal — run against a `quick`-profile-shaped scoreboard
      (4 scenarios) and confirm the rendered count is 4-derived, not "8".
- [x] 8.4 GREEN: implement in `sections-detail.js#methodologySection`.
- [x] 8.5 RED→GREEN: add a failing→passing test asserting `resourcesSection`'s sampling-interval
      sentence reads `METRICS_INTERVAL_MS` from `config/constants.js` rather than a hardcoded
      "once per second".
- [x] 8.6 GREEN: implement in `sections-detail.js#resourcesSection`, importing the constant.
- [x] 8.7 RED→GREEN: add a failing→passing test asserting `headerSection` renders
      `scoreboard.publishableReason` verbatim when present, falling back to the existing generic
      sentence only when absent.
- [x] 8.8 GREEN: implement in `sections-detail.js#headerSection`.
- [x] 8.9 Verify: run `pnpm bench:verify` with a deliberately reduced scenario subset via
      `--scenario`, inspect the generated `REPORT.md`, and manually confirm the scenario-fairness
      sentence's count matches the actual subset size — not "8".

## 9. D9 — Efficiency ratio window mismatch (P1-006)

- [x] 9.1 RED: add a failing test asserting `bench-rotation.js#averageMetric` computes `Math.max`
      for the `rssPeak` key specifically, while still computing the arithmetic mean for every other
      metrics key.
- [x] 9.2 GREEN: implement the `rssPeak`-specific branch in `averageMetric`.
- [x] 9.3 GREEN: update `sections-detail.js#efficiencySection`'s heading and explanatory text per
      design.md D9 — state plainly that CPU/RSS are whole-run aggregates, not scoped to the named
      scenario.
- [x] 9.4 Verify: run `pnpm bench:verify --rotate` with 2+ frameworks (so rotation produces multiple
      passes per framework) and confirm the reported `rssPeak` in the resulting report equals the
      true maximum across passes — cross-check against the per-pass raw values if instrumentable, or
      reason from the per-framework JSON's structure.

## 10. Secondary correctness items called out in the proposal's scope

- [x] 10.1 Fix the backlog invariant (audit P2-001): pass `LISTEN_BACKLOG` explicitly in
      `apps/benchmark/servers/nextrush-v3.js` and `nextrush-v3-class.js`'s `listen()` calls (or
      confirm `@nextrush/adapter-node`'s `listen()` accepts a backlog option and wire it), so the
      comment's claim in `config/constants.js` ("every server now passes this same value explicitly")
      becomes true rather than false for 2 of 7 servers.
- [x] 10.2 Correct the README scenario-count claims (audit P2-008): update root `README.md` and
      `apps/benchmark/README.md` to state scenario counts that match `config/scenarios.js`'s actual
      13 scenarios / 11 `identicalWork: true` (10 after task 7.1's reclassification), rather than
      the current "10 scenarios" / "8 scenarios do byte-identical work" literals.

## 11. Flight 2 exit gate

- [x] 11.1 Run `pnpm test` — 0 failures, including every new test added in tasks 5–10.
- [x] 11.2 Run `pnpm bench:validate` — still passes for all 6 default frameworks (confirms tasks 7
      and 10.1 didn't regress fairness).
- [x] 11.3 Run `pnpm bench:verify` (default + `--rotate`) end to end; manually inspect the generated
      `REPORT.md` for: a correctly stated parity claim, a correct scenario-fairness count, a correct
      sampling-interval sentence, a correctly labeled Efficiency section, and `static-file` appearing
      in the "all scenarios" table rather than the like-for-like headline.
- [x] 11.4 Confirm zero backwards-compatibility shims exist anywhere in the diff: `git diff` across
      both flights should show no new CLI flag whose only purpose is toggling old-vs-new behavior, no
      `@deprecated` marker, and no dual code path retaining the pre-fix logic behind a condition.
- [x] 11.5 Independent re-verification in a fresh session/context, same discipline as task 4.4.
- [x] 11.6 Commit Flight 2 as atomic, single-concern commits per fix (D5, D6, D7, D8, D9, then the
      two secondary items), per `kiro-git.md`.

## 12. Change closeout

- [x] 12.1 Confirm every scenario in both delta spec files (`specs/performance-gate/spec.md`) is
      satisfied by a passing test or a manually verified run recorded in this tasks file.
- [x] 12.2 Run `openspec validate fix-benchmark-harness-integrity --strict` — passes.
- [x] 12.3 Sync the delta into `openspec/specs/performance-gate/spec.md` (via the
      `openspec-sync-specs` skill) once both flights are merged, so the living spec reflects the new
      requirements before this change is archived.
- [x] 12.4 Note in the archived change (or in a follow-up backlog item, per design.md's Open
      Questions) that producing a new `results/baseline/` from a real `--profile full` run, and the
      P2-002 CPU-pinning/thermal-capture work, remain explicitly deferred — not silently dropped.

### Deferred items (explicitly out of this change's scope, not silently dropped)

- **A new `results/baseline/` from a real `--profile full` run** (audit P2-006) — requires a clean,
  pinned, hours-long campaign; explicitly a Non-Goal in design.md. Follow-up change once such an
  environment is available.
- **CPU pinning / thermal-state capture** (audit P2-002) — environment-control concern, separate
  from harness logic; explicitly a Non-Goal in design.md.
- **Quantifying the static-registration asymmetry's effect size** (audit §5.2) — the mechanism is
  code-verified (NextRush/Koa register static as a route, Express/Hono as middleware), but the
  throughput impact is unmeasured; requires a dedicated measurement campaign.
- **Full-header-set parity checking in `validate-parity.js`** — D7 reclassified `static-file` as
  not-like-for-like rather than building this stronger check, per design.md's stated cost/benefit;
  building it would let `static-file` be re-promoted to `identicalWork: true` later.
- **The cross-package backlog-invariant fix** (audit P2-001, scope-corrected during task 10.1) —
  `@nextrush/adapter-node`'s `listen()`/`serve()` accept no `backlog` option; adding one is an
  RFC-gated public-API change to a different package, out of this benchmark-only change's authorized
  scope. The currently-true equality is test-pinned instead (`backlog-invariant.test.js`).
- **`cpuAvgPct` rendering unrounded floating point in reports** — a pre-existing cosmetic bug spotted
  during D9's live verification, not one of the audit's findings; noted for a future cosmetic pass.
- **Retiring the legacy `scripts/report.js` viewer / splitting `run.js` under 300 lines** (audit
  P3-001/P3-004) — structural cleanup, not integrity-affecting; explicitly a Non-Goal in design.md
  to keep this change's diff atomic and reviewable.

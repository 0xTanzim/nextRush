## Context

`report/benchmark/benchmark-engineering-audit-review.md` independently reproduced every statistical
cell, ranking, and CSV row in the benchmark harness's stored artifacts with zero mismatches — the
*arithmetic* is sound. The defects are in the layers around the arithmetic: the load generator
doesn't always send what a scenario declares (P0-001), the publishability gate is missing a
criterion the harness's own rotation feature exists to satisfy (P1-001), one artifact self-corrects
while its raw source doesn't (P1-002), one tool's timeout accounting is silently inert (P1-003), one
scenario claims equivalence it doesn't have (P1-004), and the generated report asserts things about
the run instead of reading them off the run (P1-005, P1-006).

Constraints for this change specifically, from the user's own framing and from repo steering:

- **Dev/agentic time budget.** `--profile full` takes 5-10 hours (5 runs × 4 concurrency levels ×
  13 scenarios × 6+ frameworks). A dev/agentic verification loop cannot wait on that per fix. Every
  fix in this change must be verifiable in minutes, not hours — but the verification method must
  still be methodologically honest (multi-run, multi-level, rotated) rather than a single unrotated
  smoke run, or the fix would be validated by exactly the kind of run the audit flagged as
  unpublishable.
- **No legacy/back-compat shims.** `AGENTS.md` §15 requires breaking changes go through a
  deprecation window with a migration path — but that applies to the framework's *public* API.
  `apps/benchmark` is internal tooling with no external consumers of its CLI or module surface (the
  audit found none). Introducing a dual codepath ("old body-selection logic behind a flag, new logic
  default") here would be pure debt with no compatibility benefit, and violates
  `engineering-standards.md`'s YAGNI/no-hidden-coupling rules. Every fix therefore replaces its
  buggy predecessor outright — one code path, no flag, no fallback branch preserving the old
  (wrong) behavior.
- **Fairness is the point.** Every fix must make the harness measure real, equivalent work more
  faithfully than before — never introduce a new asymmetry while removing an old one (e.g. the
  `static-file` fix must not silently favor NextRush or any other single server).

## Goals / Non-Goals

**Goals:**

- Fix P0-001 (wrk POST body fidelity) and P1-001 (rotation as a publishability criterion) as the
  first, blocking flight — nothing else in this change lands ahead of them, and no further
  measurement should be trusted until they do.
- Fix P1-002 through P1-006 and the P2 items called out in the proposal as the second flight.
- Provide a **verification profile** that is honest by the harness's own publishability criteria
  (≥3 runs, ≥2 concurrency levels, ≥10s duration, rotated, zero timeouts) but completes in minutes —
  by scaling scenario count and concurrency breadth down, not by scaling out the controls that make
  a run trustworthy.
- Leave the existing `full`/`standard`/`stress`/`quick` profiles and their semantics untouched;
  add one profile, don't repurpose an existing one out from under other callers (`check-regression.js`
  scripts, CI, docs already reference `standard`/`full` by name).
- Zero backwards-compatibility shims: no added CLI flag that toggles between old-wrong and new-right
  behavior, no dual code path, no `@deprecated` marker on anything (there is nothing public to
  deprecate here).

**Non-Goals:**

- Running the actual multi-hour `full` profile as part of this change's own verification. The
  `bench:check` / `results/baseline/` gap (audit P2-006) is real but is explicitly deferred — it
  requires a clean, pinned, hours-long campaign that is out of scope for a dev-session fix-and-verify
  loop, and the proposal's Impact section already scopes this change to correctness fixes, not to
  producing new publishable numbers.
- CPU pinning / thermal-state capture (audit P2-002). Real finding, separate concern (environment
  control, not harness logic), deferred to its own change.
- The registration-asymmetry disclosure for static-file middleware ordering (audit §5.2's
  unquantified finding) beyond what P1-004's `identicalWork: false` reclassification already
  achieves. Quantifying the effect size requires a dedicated measurement campaign, not a code fix.
- Rewriting `computeStats` to add confidence intervals (audit P3/long-term item) — out of scope; the
  statistics are already independently verified correct, just not as rich as they could be.
- Retiring the legacy `scripts/report.js` viewer or splitting `run.js` under 300 lines (audit
  P3-001/P3-004) — cosmetic/structural cleanup, not integrity-affecting; tracked as follow-up, not
  bundled into an integrity fix to keep this change's diff reviewable and atomic per
  `kiro-git.md`.

## Decisions

### D1 — Two flights, gated in sequence, not one big-bang change

**Decision:** Flight 1 = P0-001 + P1-001 only. Flight 2 = everything else (P1-002…006, P2-001,
P2-003…008). Flight 1 must be merged and independently re-verified (fresh agent/session per
`loop-engineering.md`'s "generator ≠ verifier" rule) before Flight 2 tasks begin.

**Why:** P0-001 and P1-001 are the two findings the audit's Final Verdict calls "conversation-ending
under hostile review" and "what must be fixed first." They are also the two with the widest blast
radius — P0-001 corrupts a measurement silently on every future wrk run; P1-001 has already produced
two published-looking artifacts with no caveat. Everything else is a real defect but none of them
corrupt a number that has already shipped. Splitting the flights lets Flight 1 land fast and be
independently validated before the lower-urgency fixes add diff surface to review.

**Alternative rejected:** one combined change. Rejected because `kiro-git.md` requires atomic,
single-concern commits, and bundling six unrelated fixes (body-fidelity, rotation-gating, artifact
persistence, error-schema normalization, scenario classification, report-claim derivation) into one
diff makes independent review of the P0 item slower, not faster.

### D2 — Fix the wrk POST body by deriving the Lua script's body from `config/scenarios.js` at run time, not by adding a second static `.lua` file

**Decision:** `bench-exec.js`'s wrk branch writes a temporary `.lua` script per scenario (or injects
the scenario's `body` string via an environment variable the shared Lua script reads) immediately
before invoking `wrk`, sourced directly from `scenario.body` — the same value `runAutocannon`
already forwards. `wrk/post-json.lua` is deleted; no second static file is added for `large-post`.

**Why:** The root cause (per the audit) is that `post-json.lua`'s body is a *hand-copied literal*
that duplicates `scenarios.js`'s `body` field — exactly the drift class `_shared/payloads.js` exists
to prevent on the server side. Adding a second static `large-post.lua` literal would fix today's
symptom while reintroducing the identical duplication hazard for the next POST scenario. Generating
the script body from the single source of truth closes the class of bug, not just the instance.

**Alternative rejected:** a static `.lua` file per scenario (`post-json.lua`, `large-post.lua`, …).
Rejected because it is the same duplication-prone pattern the current bug is a symptom of — it would
require a human to remember to add a matching `.lua` literal every time a new POST scenario is
added, and nothing enforces that they match.

**Verification:** extend `validate-parity.js` (already the fairness integrity gate, already probes
every scenario) to also assert, for wrk runs, that the request body **sent** matches
`scenario.body` byte-for-byte — logged from the wrk script itself via a debug echo route, or
verified indirectly by asserting the server-side parsed item count for `large-post` matches the
scenario's known item count. This generalizes P0-001's fix into a standing gate so a future
request-side divergence (any tool, any scenario) cannot be silently invisible again, per the
proposal's stated intent.

### D3 — Publishability requires `positionControl === 'rotated'` when more than one framework is compared; a missing/legacy value is unverified, not passing

**Decision:** `derivePublishable(config, results)` gains one more rejection branch:

```
if ((frameworkCount ?? 0) > 1 && config.positionControl !== 'rotated') {
  return { publishable: false, reason: `position control was "${config.positionControl ?? 'not recorded'}" — a
    cross-framework ranking requires rotation (see run.js --rotate)` };
}
```

`sections-scoreboard.js`'s "Not a ranking" guard changes from `positionControl === 'fixed'` to
`positionControl !== 'rotated'` (single-framework runs are exempted — there's nothing to rank), so
it uses the *same* fallback logic as `sections-metadata.js`'s `orNotRecorded(config.positionControl
?? config.order)` rather than a narrower check that only catches one of the two field names.

**Why:** The audit's exact defect is that three independent code paths disagree about what makes a
ranking valid. Fixing only `derivePublishable` (the machine-readable gate) without also fixing the
scoreboard section's *rendering* guard would leave the human-readable report still printing a
"🥇 Raw Node.js" line for a run the machine-readable artifact now correctly calls unpublishable —
reintroducing the exact human/machine disagreement this fix exists to close. Both must move together.

**Alternative rejected:** only fixing `derivePublishable` and leaving the scoreboard-rendering
decision as-is. Rejected because `2026-07-27T15-42-50/results.json` already demonstrates that
`positionControl: null` (not `'fixed'`) slips past the current narrower check — the render-side
fallback (`?? order`) already exists specifically because the gate-side one doesn't have it, and
leaving that asymmetry would leave the bug's actual reproduction case (`null`, not `'fixed'`)
unfixed.

**Verification (the dev/agentic-scale profile — see D4):** run the new verification profile with
`--rotate` explicitly omitted (fixed order) and confirm `publishable: false` with the new reason
string; run it again with `--rotate` and confirm `publishable` becomes reachable (subject to the
other three existing criteria). Both runs complete in the profile's target minutes, not hours.

### D4 — Add one new profile, `verify`, for time-bounded but methodologically honest fix verification; do not touch `quick`/`standard`/`full`/`stress`

**Decision:** add to `config/profiles.js`:

```js
verify: {
  duration: '10s',
  connections: [64, 256],   // 2 levels — satisfies MIN_CONCURRENCY_LEVELS
  threads: Math.min(cpuThreads, 4),
  runs: 3,                  // satisfies MIN_RUNS
  warmupDuration: '5s',
  scenarioWarmupDuration: '2s',
  cooldownMs: 2000,
  pauseBetweenTestsMs: 1000,
  publishable: false,       // never a substitute for `full`'s hardware-controlled numbers
  description: 'Time-bounded but methodologically complete verification (3 rotated runs, ' +
               '2 concurrency levels, ~10s/cell) — for validating harness fixes, not for publishing numbers',
}
```

Run against a **small scenario subset** (`hello-world`, `post-json`, `large-post`, `static-file`,
`middleware-stack` — one from each fairness-relevant category this change touches) rather than all
13, and with `--rotate` forced on regardless of the `publishable` flag (rotation is what's being
verified, so it must run even though the profile is intentionally marked non-publishable for
numbers). Total wall time: 5 scenarios × 2 levels × 3 runs × ~10s + warmup/cooldown ≈ 6-9 minutes —
two to three orders of magnitude faster than `full`'s 5-10 hours.

**Why `publishable: false` even though it satisfies `derivePublishable`'s numeric criteria:** the
profile's *numbers* (10s duration on a shared, unpinned dev machine) are not meant to leave this
change's own verification — only the *harness behavior* (does the gate reject a fixed-order run? does
the parity check catch a body mismatch? does the report render the right claim?) is what's being
validated. Marking it `publishable: false` unconditionally, independent of `derivePublishable`'s
other criteria, prevents a future contributor from mistaking a 10-second dev run for a hardware-
controlled release figure — which is exactly the confusion `quick`'s existing `publishable: false`
already prevents for its own purpose.

**Alternative rejected:** reuse `quick` (already exists, already fast) for verification. Rejected
because `quick`'s `runs: 1` cannot exercise D3's rotation fix at all — rotation requires `runs > 1`
by `run.js`'s own `useRotation` condition — and `quick`'s single concurrency-level-pair choice
(64+128) wasn't designed with "exercise every fairness gate this change touches" in mind. A profile
whose explicit purpose is fix verification should say so in its `description`, not overload `quick`'s
existing "fast dev iteration" meaning.

**Alternative rejected:** lower `full`'s thresholds temporarily via CLI overrides
(`--connections --time --runs`, all of which `run.js` already supports) instead of adding a named
profile. Rejected because the *point* of this decision is a **repeatable, named, documented**
verification recipe that any future harness change can reuse — an ad hoc CLI incantation typed once
during this change and not written down anywhere is exactly the kind of undocumented methodology the
audit criticizes reports for.

### D5 — Persist recomputed `publishable`/`parity` into `results.json` via a small migration function, not a new file format

**Decision:** `withRecomputedPublishable` (already exists, already pure, already tested) gets a
sibling call site: `run.js` itself calls it on its own freshly-built report object immediately
before `saveResults(resultsDir, 'results.json', report)`, so the *first* write of `results.json`
already carries the correct value — closing the gap where only `generate-report.js`'s *later*,
optional regeneration self-corrects. A new `parity: { validated: bool, skippedReason: string|null,
failures: [] }` field is added to the report object in `run.js`, populated from `runParityCheck`'s
existing return value (`{ ok, failures }`), which today is discarded after the process-exit decision.

**Why not a new file:** `results.json` is already the documented single source of truth
(`generate-report.js`'s own header comment: "results.json is the source of truth and every artifact
here is a pure derivation of it"). Adding a second file that also claims to be authoritative about
the same run would violate that existing, working convention and create a new
which-file-wins ambiguity the audit never found because it doesn't exist yet — no reason to invent
it now.

**Migration for already-stored runs:** none. Old artifacts under `results/2026-07-*` keep their
stale `publishable: true` where wrong; `generate-report.js`'s existing `withRecomputedPublishable`
call already corrects *rendered* views of them on demand, which is the existing, sufficient
remediation path for historical data. This change fixes new runs going forward; it does not rewrite
history.

### D6 — Normalize load-generator error shape at the tool-adapter boundary, inside `lib/tools/{wrk,autocannon}.js`, not inside `publishable.js`

**Decision:** `runAutocannon`'s returned `errors` object gains a `timeout` key (singular) alongside
the existing `timeouts` (plural), both pointing at the same count, at the point where the adapter
already shapes its return value. `publishable.js#countSocketTimeouts` is left reading `errors.timeout`
unchanged — it becomes correct for both tools because both tools now agree on the key.

**Why fix it at the adapter, not the reader:** `wrk.js` and `autocannon.js` are the only two places
that know which underlying library produced which key spelling. Making `publishable.js` (or any
future reader) understand both spellings pushes tool-specific knowledge into a tool-agnostic
consumer, and the next tool-specific reader (a report section, a regression check) would have to
duplicate that same both-spellings tolerance. One normalization point, at the boundary, is simpler
and matches how `parseWrkOutput`/`runAutocannon` already normalize `rps`/`latency`/`transferPerSec`
into one shared shape.

### D7 — `static-file` becomes `identicalWork: false`, scored alongside `middleware-stack`/`error-handling`, until a full-header-parity check exists

**Decision:** flip `config/scenarios.js`'s `static-file` entry to `identicalWork: false` with a
description explaining why (each framework's own static-serving mechanism emits a different header
set — verified by direct measurement in the audit, 163-292 bytes across six servers). This
immediately removes it from the headline like-for-like score without requiring
`validate-parity.js` to grow full-header-set comparison in this same change.

**Why not fix `validate-parity.js` to compare full header sets instead:** that is the *stronger*
fix (audit's option (b)) but has real design cost — some headers are legitimately dynamic per-server
(`ETag`, `Last-Modified` values differ even when the *mechanism* is fair) and building a check that
distinguishes "different value, same mechanism" from "different mechanism, unfair work" is itself a
small design problem, not a one-line fix. Reclassifying now stops the scenario from silently biasing
the headline score today; strengthening the parity check to allow re-promoting it to
`identicalWork: true` later is legitimate, well-scoped follow-up work, not a blocker for this
correctness fix.

**Fairness check on the fix itself:** reclassifying does not favor any single server — the audit
found `nextrush-v3` (284 B) is *not* the smallest header set (raw-node's 163 B is), so removing this
scenario from the headline score does not systematically help or hurt NextRush relative to any
specific competitor; it removes a scenario that was measuring header-emission mechanism differences
under a same-work label, for every server equally.

### D8 — Report sections read facts off the run's own recorded state; no new state is invented to make them derivable

**Decision:**

- The parity claim in `sections-detail.js#methodologySection` reads the new `configuration.parity`
  field from D5 (`"Parity: validated (N frameworks)"` / `"Parity: skipped — <reason>"` /
  `"Parity: FAILED — see failures"`) instead of a hardcoded sentence.
- The "N scenarios do byte-identical work" sentence is derived from
  `scoreboard.likeForLikeScenarioIds.length` and lists the excluded scenario names from
  `scoreboard.scenarios.filter(s => !s.identicalWork)`, both already computed and already available
  in `sections-scoreboard.js`'s scope — no new field, just reading data that already exists instead
  of a literal.
- `resourcesSection`'s "once per second" becomes `` `${METRICS_INTERVAL_MS / 1000}s` ``, imported
  from `config/constants.js` (already the single source for that value — `sections-detail.js`
  currently just doesn't import it).
- `headerSection`'s fixed non-publishable explanation is replaced by rendering
  `scoreboard.publishableReason` verbatim when present, falling back to the existing generic
  sentence only when a legacy artifact has no reason recorded (`generate-report.js` already runs
  `withRecomputedPublishable` on load, so every *rendered* report will have a reason from D5
  onward — the fallback exists only for artifacts predating this change).

**Why no new state:** every one of these is a report-generation bug, not a missing-data bug — the
correct value was already computed and sitting in scope (`scoreboard.likeForLikeScenarioIds`,
`METRICS_INTERVAL_MS`, `scoreboard.publishableReason`) except for the parity field, which D5 already
adds for its own reason (persistence), not invented solely for this decision.

### D9 — `Efficiency` section: fix `averageMetric`'s `rssPeak` handling to `max`, relabel the heading as a whole-sweep aggregate

**Decision:** two independent, small fixes rather than a redesign:

1. `bench-rotation.js#averageMetric` special-cases `rssPeak` (and only that key) to take
   `Math.max(...values)` across passes instead of the arithmetic mean every other metric key uses.
   "Peak" already means "the maximum observed," so averaging maxima was internally inconsistent with
   the field's own name — this is a bug fix, not a design change.
2. `sections-detail.js#efficiencySection`'s heading changes from `Efficiency — <first scenario name>
   @ <N> connections` to `Efficiency — whole-run average (CPU/RSS sampled across all scenarios)`,
   and the explanatory paragraph gains one sentence stating the RPS numerator is one scenario's cell
   while the CPU/RSS denominator spans the entire run — matching what the code actually measures
   instead of implying a scenario-scoped ratio.

**Why not re-architect sampling to be per-scenario-cell:** that would require restructuring
`startMetricsSampling`'s lifecycle (currently one sampler per framework per pass, spanning the whole
scenario loop) into a per-cell start/stop, which changes the timing semantics of every existing
memory/CPU number in every historical artifact's *comparison basis* — a much larger blast radius for
a report-labeling correctness fix. Relabeling honestly is the minimal fix that makes the claim match
the measurement; re-architecting the sampling granularity is legitimate future work, not required to
stop the report from asserting something false.

## Risks / Trade-offs

- **[Risk] D2's per-scenario wrk script generation adds a temp-file-write step to the wrk code path,
  which could itself introduce a new flakiness source (write races, cleanup on crash).**
  → Mitigation: write the generated script to a path derived from the run id (already unique,
  already used for `results/<run-id>/`) so concurrent invocations can't collide, and clean it up in
  the same `finally` block that already stops the server process — no new resource-lifecycle
  category is introduced, it reuses the existing per-run temp-artifact pattern.

- **[Risk] D3's stricter `derivePublishable` will retroactively make every currently-`publishable:
  true`, fixed-order historical artifact evaluate as unpublishable the next time `generate-report.js
  --all` is run, which could look like new breakage to someone unfamiliar with this change.**
  → Mitigation: this is the *intended* effect (it's the fix), and D5 explicitly does not rewrite
  historical `results.json` files — only newly generated *report renderings* of old runs change,
  which is `generate-report.js`'s documented, expected behavior (pure re-derivation). Call this out
  explicitly in the PR description and in `tasks.md`'s verification step so it isn't mistaken for a
  regression.

- **[Risk] D4's new `verify` profile could bit-rot the same way `results/baseline/` (audit P2-006)
  did — defined but never exercised — if nothing forces its use.**
  → Mitigation: `tasks.md`'s verification steps for every fix in both flights explicitly invoke
  `pnpm bench:verify` (a new `package.json` script wrapping `node scripts/run.js --profile verify
  --rotate --compare`) rather than ad hoc flags, and add a note in the harness's own
  `apps/benchmark/README.md` describing when to use `verify` vs `quick` vs `full`, so future
  contributors have one obvious command per repo convention (`AGENTS.md` §2, "one obvious golden
  path").

- **[Risk] D6's normalization touches `lib/tools/autocannon.js`, which is also read by anything
  outside this change that consumes its return shape directly.**
  → Mitigation: the change is additive (a new `timeout` key alongside the existing `timeouts`), so
  no existing reader of `errors.timeouts` breaks; grep confirms `publishable.js` is the only current
  reader of a singular `timeout` key, and it is also the only intended consumer of the new field.

- **[Risk] D7's reclassification changes `overall.likeForLike.maxPoints` for any future run that
  includes `static-file` in its `configuration.scenarios`, which changes the headline points scale
  going forward — a discontinuity between old and new reports' point totals.**
  → Mitigation: this is the correct behavior (the audit's own recommendation), and `maxPoints` is
  already run-relative and displayed alongside the points total in every report (`X/maxPoints pts`)
  — readers already compare ratios, not absolute point counts, across runs with different scenario
  sets (e.g. `quick`'s 4-scenario runs already coexist with `full`'s 13-scenario runs in the
  repository today).

## Migration Plan

1. **Flight 1** (blocking): implement D2 + D3 + the parity-body-fidelity gate extension. Verify with
   `pnpm bench:verify` (D4's profile) both with and without `--rotate`. Independently re-verify in a
   fresh session/context per `loop-engineering.md`'s generator≠verifier rule before merging.
2. **Flight 2** (after Flight 1 merges): implement D5, D6, D7, D8, D9 plus the P2 items in the
   proposal's scope (backlog-invariant truth, README scenario-count correction). Verify each with
   `pnpm bench:verify`. No flight-2 task depends on running `--profile full`.
3. **No rollback complexity**: every fix is a pure function/module correction with no new schema
   migration for existing data (D5 is additive-only) and no feature flag to unwind — reverting any
   commit in either flight is a plain `git revert`, consistent with `kiro-git.md`'s "every non-trivial
   change should be independently revertible."
4. **Not in this migration**: producing a new `results/baseline/` from a real `--profile full` run.
   That is explicitly deferred (see Non-Goals) and is its own future change once a clean, pinned
   environment is available — this change only makes the harness capable of producing a trustworthy
   baseline when that measurement eventually happens.

## Open Questions

- Should the new `parity` field (D5) also record the OS-read TCP backlog values collected during the
  pre-flight check, closing audit P2-001's disclosure gap in the same change, or is that cleanly
  separable follow-up? Current lean: separable — P2-001 is about the *backlog invariant being false*
  for `nextrush-v3`'s implicit default, which is a one-line fix (`nextrush-v3.js` passing
  `LISTEN_BACKLOG` explicitly) independent of whether the report discloses it, and bundling it here
  would pull an unrelated `packages/adapters/node` question about default-import discipline into a
  benchmark-only change. Recommend a follow-up change scoped to `apps/benchmark/servers/nextrush-v3*.js`
  + a one-line disclosure addition once this change's report-rendering plumbing (D8) exists to hang
  it on.
- D4's `verify` profile scenario subset (5 of 13) is a judgment call balancing wall-time against
  coverage of exactly the scenarios this change's fixes touch. If Flight 2 review finds a fix whose
  scenario isn't in that subset, extend the subset rather than adding a second profile.

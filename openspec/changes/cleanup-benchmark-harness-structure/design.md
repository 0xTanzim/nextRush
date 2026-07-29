## Context

`fix-benchmark-harness-integrity` closed every P0/P1 finding from
`report/benchmark/benchmark-engineering-audit-review.md`. Its own `tasks.md` closeout explicitly
deferred 3 items (new baseline campaign, CPU pinning, static-registration effect-size measurement —
all genuine future-campaign work, correctly out of scope for a code-only change) but left 4 more
findings untouched with **no tracking anywhere** — not in that change's Deferred Items list, not in
a follow-up ticket: P2-001's report-disclosure half, P2-003, P2-004, and six P3 items (003, 005–010).
Separately, `apps/benchmark/scripts/` accumulated 34 files flat in one directory across two prior
change cycles (the throughput harness and, independently, a 12-file allocation/GC micro-benchmark
suite), and one report viewer (`scripts/report.js`) survived the exact stale-publishable-flag class
of bug (P1-002) that every *other* report path in the repo was just fixed against.

Verified directly against source before drafting this design (not assumed from the audit text
alone):

- `scripts/report.js` — confirmed zero references to `publishable`/`withRecomputedPublishable`
  anywhere in the file (`grep`). It reads `results.json`'s stored `.publishable` verbatim, the exact
  defect P1-002 fixed in every other reader.
- `scoreboard.js#rankEntries` — confirmed `entry.__rank = rank` mutates its input array's objects in
  place and returns `{ ...entry, rank, points, withinNoiseOfNext }`, leaking the internal `__rank`
  property onto the *original* input objects (not the returned copies) as a side effect.
  `withinNoiseOfNext` is computed and returned but never read by `sumPoints`/`buildOverall` —
  confirmed by tracing every caller.
- `POINTS_FOR_LAST_PLACE` — confirmed NOT fully dead as the audit's phrasing implied: it is imported
  and asserted by `report-scoreboard.test.js:86`. It is, however, never referenced by
  `rankEntries`'s actual scoring logic (`count - (rank - 1)`, an inline literal) — so the constant
  documents an invariant that production code doesn't derive from it, meaning the test would pass
  even if `rankEntries` diverged from `POINTS_FOR_LAST_PLACE`'s stated value. This is narrower than
  "delete a dead export"; the real fix is making `rankEntries` compute from the constant.
- `apps/benchmark/package.json` — confirmed all 12 `bench:alloc*` scripts and 4 `report:*` scripts
  currently used are real, wired, tested (`alloc-regression.test.js`) entry points, not dead code —
  only `report.js`'s 4 scripts are correctly removable.
- `results/2026-07-29T03-36-30/`, `results/2026-07-28T10-58-17/` — confirmed 0 files each via
  `find -type f`. `scripts/results/cpuprof-server-c128/` — confirmed its only content is one 20 KB
  `.cpuprofile`, not a parallel results tree.

## Goals / Non-Goals

**Goals:**

- Delete confirmed-dead code and confirmed-empty disk debris; move confirmed-live-but-flat files
  into concern-based subfolders with every reference repointed — zero behavior change from these
  moves/deletions.
- Close the 4 audit findings that fell through both flights of `fix-benchmark-harness-integrity`
  with no tracking: P2-001 (disclosure half), P2-003, P2-004, and the P3 batch (003, 005–010).
- Leave every already-shipped fix from `fix-benchmark-harness-integrity` untouched — this change
  extends that work, it does not revisit or re-verify it.
- Zero backwards-compatibility shims: a moved file has its callers repointed, not a forwarding stub
  left at the old path; a deleted script has its `package.json` entry removed, not deprecated.

**Non-Goals:**

- Re-opening any P0/P1 finding — all 7 are closed and verified; out of scope here.
- The 3 items `fix-benchmark-harness-integrity`'s `tasks.md` already deferred by name (new baseline
  campaign, CPU pinning/thermal capture, static-registration effect-size measurement) — those remain
  correctly deferred; restating them here would duplicate that change's own closeout record.
- Confidence intervals in `computeStats` (audit's long-term item) — a statistics-richness
  enhancement, not a correctness or structure fix; separate scope.
- Re-architecting `/proc` sampling to be per-scenario-cell (the audit's stronger alternative for
  P1-006, already explicitly rejected in `fix-benchmark-harness-integrity`'s design.md D9 as too
  large a blast radius) — not reopened here.

## Decisions

### D1 — `scripts/` reorganization: move the allocation suite out, leave the throughput harness in place

**Decision:** create `scripts/alloc/` and move exactly the 12 files that are the allocation/GC
micro-benchmark family: `compose-alloc.js`, `compose-alloc-child.js`, `handler-alloc.js`,
`handler-alloc-child.js`, `web-context-alloc.js`, `web-context-alloc-child.js`,
`web-context-microtrims-alloc.js`, `router-match-alloc.js`, `router-match-alloc-child.js`,
`param-match-alloc.js`, `param-match-alloc-child.js`, `dispatch-alloc.js`,
`dispatch-alloc-child.js`, `context-state-alloc.js`, `context-state-alloc-child.js`,
`context-raw-alloc.js`, `context-raw-alloc-child.js`, `context-alloc.js`, `context-alloc-child.js`,
plus `check-alloc-regression.js` (their shared CI gate). Everything else (`run.js`, `bench-*.js`,
`validate-parity.js`, `check-regression.js`, `generate-report.js`, `report-md.js`,
`registration-cost.js` + its child, `profile.js`, `smoke-test.js`, `utils.js`, `lib/`) stays at
`scripts/` top level.

**Why this split and not another:** the allocation suite is a genuinely separate concern from the
throughput harness — different measurement technique (deterministic heap-delta in an isolated
`--expose-gc` child, not wrk/autocannon load generation), different consumers
(`.github/workflows/performance-gate.yml`'s tight-tolerance gate vs. the loose-tolerance throughput
gate), and it already has its own doc section (`## Allocation Harnesses`) and its own test file
(`alloc-regression.test.js`) — the boundary already exists conceptually, this decision just gives it
a folder. `registration-cost.js`/`profile.js`/`smoke-test.js` stay at top level because they are
one-off diagnostic tools for the *throughput* harness specifically (class-path boot cost, CPU/heap
profiling of a scenario, server smoke-check) — moving them would split the throughput harness's own
tooling across two folders for no boundary that exists yet.

**Alternative rejected:** a deeper reorg (`scripts/harness/`, `scripts/report/`, `scripts/alloc/`,
`scripts/tools/`) splitting the throughput harness itself into subfolders too. Rejected — the
throughput harness's own files (`run.js` orchestrating `bench-exec*.js` orchestrating `lib/*`) are
already at a reasonable count (~13 files) for one folder per `code-structure.md`'s ~7-sibling
threshold being a soft guideline, not a hard trigger at every count past 7; splitting it further
would scatter tightly-coupled orchestration files (`run.js` imports `bench-exec.js` imports
`bench-exec-single.js`/`bench-rotation.js`) across folders for a boundary that doesn't reduce real
coupling, only file-browser clutter. The allocation suite is the one sub-concern with a real,
pre-existing conceptual boundary (own doc section, own test file, own CI gate, zero import
relationship to `run.js`/`bench-exec*.js`) — confirmed via `grep -l "from '\.\./run\|from '\.\./bench-exec"` across the alloc files returning zero matches.

**Mechanics:** every moved file's own relative imports (`./lib/...`, `../config/...`) shift by one
directory level and must be updated; every `package.json` `bench:alloc*` script path updates from
`scripts/<name>.js` to `scripts/alloc/<name>.js`; `apps/benchmark/README.md`'s Directory Structure
tree and the `## Allocation Harnesses` section's any bare `scripts/*-alloc.js` glob reference update
to `scripts/alloc/*-alloc.js`.

### D2 — Delete `scripts/report.js` outright; do not deprecate it

**Decision:** delete the file and its 4 `package.json` scripts. Update
`apps/benchmark/README.md`'s "View Results" section (currently `node scripts/report.js --list` /
`--id`) to show the `generate-report.js`-based equivalent instead.

**Why deletion, not a deprecation warning:** `AGENTS.md` §15's deprecation-before-removal rule
governs the framework's *public* API; `apps/benchmark` is internal tooling with confirmed zero
external consumers (the original audit already established this, `fix-benchmark-harness-integrity`
relied on the same fact for D2/D6's "no shim" decisions). A deprecation warning here would be
ceremony with no compatibility benefit, and it would keep the stale-publishable-flag defect alive
for however long the warning period lasts — the opposite of this change's purpose. `report.js`'s
`--trend` mode has no direct `generate-report.js` equivalent; that capability is not re-implemented
because `buildHistory`/`results/HISTORY.md` (already wired through `generate-report.js --history`)
already covers cross-run trend viewing — confirmed by reading `report.js#showTrend`'s output shape
against `history.js`'s and finding no capability gap.

### D3 — P2-001 disclosure: render the backlog invariant in the Load Configuration table, not a new section

**Decision:** `sections-detail.js` (or the metadata-table module it already composes) gains one row
in the existing Load Configuration table: effective TCP accept-queue backlog value, sourced from
`configuration.parity`'s already-recorded OS-read value (added by `fix-benchmark-harness-integrity`
D5) when parity was validated, with a note that this value overrides each competitor framework's own
native default.

**Why extend the existing table, not add a new report section:** the value already exists in the
recorded run state (parity validation reads it via `ss` and already stores pass/fail); adding a new
top-level section for one row would be disproportionate ceremony for what is fundamentally one more
fact about the run's configuration, alongside the table that already lists Node flags, `NODE_ENV`,
port, and pipelining settings.

### D4 — P2-003: exclude the single-connection level from the headline aggregate; make `withinNoiseOfNext` split points, not merely annotate

**Decision:** two independent changes to `scoreboard.js#buildOverall`:

1. `buildOverall`'s caller (`buildScoreboard`) computes `overall.likeForLike` and `overall.all` over
   `connections.filter((c) => c > 1)` instead of the full `connections` array. `pointsPerConnection`
   (already per-connection) is untouched — a reader who specifically wants the single-connection
   latency regime's own ranking still has it, just not folded into the headline.
2. `rankEntries` changes tied-and-within-noise handling: when `entry.withinNoiseOfNext` is true, the
   entry and its next-ranked neighbor share the *same* rank and split the combined points
   (`(pointsForRank(r) + pointsForRank(r+1)) / 2`, rounded to the nearest 0.5) rather than each
   keeping their own full-rank points while merely carrying an informational flag.

**Why exclude c1 from the aggregate rather than reweight it:** `methodologySection` already
documents, in its own words, that the lowest concurrency level "measures per-request latency, not
throughput" — the harness's own stated methodology already treats it as a different regime, the
scoring just didn't follow that statement. Reweighting (e.g. giving c1 a fractional weight) would
invent a new, undocumented constant with no principled value; exclusion matches what the harness
already asserts about what c1 measures.

**Why split points on a noise-tie rather than merely keep the flag informational:** the audit's
exact complaint is that "a statistical tie scores as a tie" was recommended but never wired —
`withinNoiseOfNext` already correctly identifies the condition; the gap is purely that nothing
consumes it. Splitting points is the direct implementation of the audit's own recommendation, not a
novel scoring scheme.

**Alternative rejected:** keep all connection levels in the aggregate and only add a caveat sentence
noting that c1 "may not reflect throughput." Rejected — the audit's Risk Assessment already flags
that this kind of aggregate blending "can be decided by gaps the harness has already flagged as
statistically meaningless"; a caveat sentence doesn't change which framework wins the headline, it
only asks the reader to discount a number that is already wrong for the stated purpose.

### D5 — `rankEntries` derives its per-rank point value from `POINTS_FOR_LAST_PLACE`; stops mutating input; stops leaking `__rank`

**Decision:** replace the inline `count - (rank - 1)` with a helper
`pointsForRank(rank, count) = count - (rank - 1) + (POINTS_FOR_LAST_PLACE - 1)` (algebraically
identical when `POINTS_FOR_LAST_PLACE === 1`, so this is a no-op today and only changes behavior if
the constant is ever tuned — which is the entire point of having a named constant instead of a bare
literal). Rank tracking moves from a mutated `entry.__rank` property to a local `Map<object, rank>`
keyed by array position, computed once and read by the `.map()` callback without touching the input
objects. The returned entries carry `rank` (public) only — no `__rank` leaks onto the input.

**Why fix the mutation instead of leaving `[...entries]` (already a shallow copy) as sufficient:**
the shallow copy protects the *array*, not the *objects it contains* — `entry.__rank = rank` mutates
the same object references the caller passed in, which is exactly the "mutates its inputs" defect
P3-003 names. A `Map` keyed by array index (computed against the already-sorted `sorted` array,
read back inside the `.map()` over `sorted`) removes the mutation without changing the function's
return shape or its callers' expectations.

### D6 — Charts: a missing measurement breaks the series, never renders as `0`

**Decision:** `charts.js#concurrencyScalingChart` and `#scenarioProfileRadar` change their
missing-value handling from `v === null ? 0 : ...` to omitting that point from the series entirely
(Mermaid `xychart`/`radar` both tolerate a shorter data array than the axis category list — verified
against the mermaid skill's `xychart`/`radar` reference before committing to this as the mechanism,
not assumed) and appending one line to the chart's caption noting which framework/scenario cell was
absent and why (`"N/A"` in the underlying report table already states why — the chart caption reuses
that reason).

**Why omission over a distinct sentinel value (e.g. plotting -1 or a dashed line):** Mermaid's
native chart types don't support a rendered "gap" marker distinct from the line simply not extending
there — omitting the data point is the correct primitive the library actually offers, confirmed by
reading the mermaid skill's chart-type references rather than inventing a rendering trick the
renderer doesn't support.

### D7 — P3-005 through P3-010: documentation and small capture-completeness fixes, no architectural decision needed

**Decision:** these six items are each a single, independent, small fix with no design tradeoff:

- **P3-005** — add `ss` (iproute2) to `apps/benchmark/README.md`'s Prerequisites section, alongside
  the existing Node-version note; state that `--no-validate` is the documented escape hatch when
  it's unavailable (already true in code, just undocumented).
- **P3-006** — rewrite `warmup-provenance.test.js` to invoke `run.js`'s actual warmup behavior
  (spawn against a real ephemeral test server, assert the recorded provenance field's *value*)
  instead of regex-matching `run.js`'s source text.
- **P3-007** — `bench-exec.js#warmupUrl`'s caught error is recorded into the run's artifact (a
  `warmupFailures: string[]` field alongside the existing per-framework result, populated when a
  warmup request errors) in addition to the existing log line, so a cold-start measurement is
  detectable after the fact from the artifact alone, not only from a console log nobody kept.
- **P3-008** — one sentence added to `constants.js`'s `NODE_SERVER_FLAGS` doc comment and to the
  report's Load Configuration table note, stating the uniform `--max-old-space-size=512` value does
  not guarantee a uniform effect across frameworks with different baseline heap usage.
- **P3-010** — `provenance.js#captureNextRushEffectiveOptions` is generalized to capture the same
  effective timeout/keep-alive values for every framework that exposes them via its own server
  object (each of the 6 servers already has one), not only NextRush; frameworks with no equivalent
  introspection point record `null` with a stated reason rather than being silently omitted.

None of these need a Decisions-style alternative comparison — each is the single reasonable fix for
its finding, matching how `fix-benchmark-harness-integrity`'s D6/D7 treated their own
single-reasonable-fix items.

## Risks / Trade-offs

- **[Risk] D1's file moves touch every relative import inside the 12+1 moved files and every
  `package.json` script path — a missed path silently breaks a `bench:alloc:*` command with no test
  coverage catching it until someone runs it.**
  → Mitigation: after the move, run every `bench:alloc:*` script once (they are fast, deterministic,
  child-process-isolated micro-benchmarks — seconds each) and confirm each exits 0, in addition to
  `node --test` for `alloc-regression.test.js`. Grep for any remaining `scripts/<moved-file>` bare
  reference across `package.json`, `README.md`, and `.github/workflows/` after the move to catch a
  missed repoint mechanically rather than relying on manual review alone.

- **[Risk] D4's aggregate-scoring change retroactively changes the headline ranking's meaning for
  every future report — a discontinuity between reports generated before and after this change,
  similar to the discontinuity `fix-benchmark-harness-integrity`'s D7 already accepted for
  `static-file`'s reclassification.**
  → Mitigation: same accepted trade-off, same justification — `maxPoints`/`connectionCount` are
  already displayed alongside the points total in every report, so a reader already compares ratios
  across runs with different scopes, not raw point counts. State this explicitly in the PR
  description, matching `fix-benchmark-harness-integrity`'s own risk-acceptance precedent.

- **[Risk] D5's point-splitting on a noise-tie could, in a run with many closely-matched frameworks,
  produce a long chain of half-point ties that makes the headline ranking harder to read than a
  clean integer ordering.**
  → Mitigation: this is the audit's own explicit recommendation (P2-003's "award a shared rank when
  the gap is inside the combined stddev, so a statistical tie scores as a tie") — a harder-to-read
  but *honest* ranking is the stated goal, not a side effect to minimize. If it proves genuinely
  unreadable in practice once implemented, that is feedback for a follow-up presentation change
  (e.g. rendering `≈` between tied rows, which `README.md`'s methodology section already documents
  as a convention for near-ties), not a reason to keep full-point splits over a statistically
  meaningless gap.

- **[Risk] D2's deletion of `report.js` removes its `--trend` mode's specific text-table rendering,
  which may differ cosmetically from `--history`'s rendering even though the underlying data
  (`buildHistory`) is the same.**
  → Mitigation: confirmed acceptable — no finding in the audit or either change treats `report.js`'s
  specific text formatting as a requirement; `generate-report.js --history`'s rendering is already
  the documented, tested path (unlike `report.js`, which recomputes nothing).

## Migration Plan

1. **File moves and deletions first** (D1, D2's move+delete half), verified by running every
   affected `package.json` script once and the full `node --test` suite, before any behavioral fix
   lands — isolates "did the reorg break anything" from "did the fix work," matching
   `fix-benchmark-harness-integrity`'s own two-flight, one-concern-at-a-time precedent.
2. **Documentation corrections** (README usage block, Methodology section, Directory Structure tree)
   land in the same commit as the file moves they describe, so the tree is never briefly
   undocumented mid-change.
3. **Behavioral fixes** (D3 backlog disclosure, D4 aggregate scoring, D5 rankEntries mutation/point
   derivation, D6 chart omission, D7's six independent small fixes) each land as their own atomic
   commit, verified individually via `pnpm test` + a targeted `pnpm bench:verify` run where the fix
   is report-rendering-visible (D3, D4, D6), per `kiro-git.md`.
4. **No rollback complexity**: every file move is a plain `git mv` (trivially revertible), every
   deletion is content already superseded elsewhere (revertible via `git revert`), every behavioral
   fix is a pure function correction with no schema migration.

## Open Questions

- Should `scripts/results/` (the stray `.cpuprofile` directory) get a `.gitignore` entry added
  proactively, or is deleting the one existing stray file sufficient since the directory isn't
  tracked and nothing currently writes to it in a way that would recreate the drift? Current lean:
  add a narrow `.gitignore` entry (`scripts/results/`) alongside the deletion — `profile.js` is a
  live, documented tool and could produce this same debris again on a future manual invocation;
  ignoring the directory costs nothing and prevents the exact recurrence this change is cleaning up.

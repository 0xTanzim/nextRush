## Why

`fix-benchmark-harness-integrity` closed every P0/P1 finding in
`report/benchmark/benchmark-engineering-audit-review.md`, but left four classes of debt behind:
(1) four audit findings (P2-001's report-disclosure half, P2-003, P2-004, and six P3 items) were
never scoped into either flight and are tracked nowhere; (2) `apps/benchmark/scripts/` is 34 files
flat in one directory — `code-structure.md`'s "no flat folders past ~7 siblings" rule, violated by
a wide margin; (3) `scripts/report.js` is a second report viewer that reads raw `results.json`
without recomputing publishability — the exact stale-flag bug (P1-002) already fixed everywhere
else, just not here; (4) both READMEs still carry stale claims (`scripts/report.js` presented as
the way to inspect runs; the Methodology section still says "8 core scenarios" against the current
13/10 split) and disk-only debris (2 empty aborted run dirs, 1 stray `.cpuprofile`) sits untracked.

## What Changes

- Delete `scripts/report.js` and its 4 `package.json` scripts (`report`, `report:latest`,
  `report:list`, `report:trend`) — confirmed dead: every capability it has (`--latest`, `--list`,
  `--trend`) has a correct, already-wired equivalent through `generate-report.js`/`report-md.js`,
  and unlike them it never calls `withRecomputedPublishable`, so it can still render a stale verdict.
- Reorganize `scripts/` from one 34-file flat directory into concern-based subfolders: the core
  measurement/reporting harness stays at `scripts/` top level; the 12 allocation/GC micro-benchmark
  files (`*-alloc.js` + `*-alloc-child.js`) move to `scripts/alloc/`; every `package.json` script
  path, README reference, and intra-file relative import updates to match. No file's behavior
  changes — this is a pure move-and-repoint.
- Delete confirmed-empty disk debris: `results/2026-07-29T03-36-30/`, `results/2026-07-28T10-58-17/`
  (both 0 files, gitignored, aborted runs) and `scripts/results/` (a stray 20 KB `.cpuprofile` left
  by a manual `profile.js` invocation, not a real second results tree).
- Correct both READMEs: replace the `scripts/report.js --list`/`--id` usage block with the
  `generate-report.js` equivalent; fix the Methodology section's "8 core scenarios" line to match
  the already-corrected 13-scenario/10-like-for-like count; update the Directory Structure tree
  listing for the `scripts/alloc/` move; add the disclosed-but-untracked backlog-override note
  (closing P2-001's report-disclosure half) to the Load Configuration section.
- Address the four remaining audit findings that were never scoped into either flight of
  `fix-benchmark-harness-integrity`:
  - **P2-001 (disclosure half)** — render the effective TCP accept-queue backlog and the
    "overrides framework defaults" note in the generated report's Load Configuration table (the
    *invariant* was already test-pinned by the prior change; only the *disclosure* was missing).
  - **P2-003** — exclude the lowest concurrency level (single-connection, latency-only) from the
    headline rank-points aggregate, and make `withinNoiseOfNext` consequential: a gap inside the
    two frameworks' combined stddev awards a shared rank instead of a full point split.
  - **P2-004** — chart builders stop plotting a missing measurement as `0`; a missing cell breaks
    the line / is omitted from the series instead of rendering as a collapsed server.
  - **P3-003, P3-005, P3-006, P3-007, P3-008, P3-010** — `rankEntries` stops mutating its input and
    stops leaking `__rank`; the dead `POINTS_FOR_LAST_PLACE` export is removed; `ss`/iproute2 is
    documented as a prerequisite; `warmup-provenance.test.js` is rewritten to assert behavior, not
    source text; `warmupUrl`'s swallowed failures are recorded in the run artifact instead of only
    logged; the `--max-old-space-size=512` uniform-value-not-uniform-effect caveat is disclosed;
    every framework's effective timeout/keep-alive values are captured, not only NextRush's.
- No backwards-compatibility shim, deprecated flag, or dual codepath anywhere in this change —
  every fixed function replaces its prior behavior outright, and every moved file's callers are
  repointed, not left with a forwarding stub.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `performance-gate`: this change corrects remaining disclosure/aggregation/chart-fidelity gaps in
  the same generated-report and scoreboard-scoring surface `fix-benchmark-harness-integrity`
  already modified (backlog disclosure, rank-points aggregation excluding the latency-only level,
  chart missing-data fidelity) — an extension of that change's own requirements, not a new
  capability. The internal `scripts/` reorganization and dead-file removal touch no requirement in
  `performance-gate`'s spec (folder layout and file count are implementation detail, not a
  documented behavior); listed here only because the backlog-disclosure and rank-aggregation items
  are genuine requirement-level additions.

## Impact

- **Code**: `apps/benchmark/scripts/report.js` (deleted); `apps/benchmark/scripts/*-alloc.js` +
  `*-alloc-child.js` (12 files, moved to `scripts/alloc/`); `apps/benchmark/package.json` (4 scripts
  removed, ~9 `bench:alloc*` script paths updated); `apps/benchmark/scripts/lib/report/
  {scoreboard.js,charts.js,sections-detail.js}`; `apps/benchmark/scripts/lib/warmup-provenance
  .test.js` (rewritten); `apps/benchmark/scripts/bench-exec.js` (`warmupUrl` failure recording);
  `apps/benchmark/scripts/lib/provenance.js` (per-framework effective-option capture).
- **Data**: `results/2026-07-29T03-36-30/`, `results/2026-07-28T10-58-17/`,
  `scripts/results/cpuprof-server-c128/` deleted (all gitignored, zero commit impact).
- **Docs**: `apps/benchmark/README.md` (usage block, Methodology section, Directory Structure tree,
  new backlog-disclosure note); root `README.md` unaffected (its scenario counts were already
  corrected by the prior change; this change touches no root-README claim).
- **No RFC required**: internal tooling correctness/structure fixes to an existing capability's
  already-specified methodology contract — no public API, package, or breaking change.

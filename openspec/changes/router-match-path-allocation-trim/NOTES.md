# Implementation notes — router-match-path-allocation-trim

Baselines and per-trim outcomes captured during implementation (feeds task 6.4 → RFC 015).

## Phase 1 baseline (pre-change matcher, branch `opt/core`)

- **Router test suite:** 212 tests passing.
- **Coverage (router `src`):** 94.18% stmts / 85.6% branch / 96.02% lines
  (all-files 94.98 / 85.45 / 96.62). Line coverage well above the 90% floor.
- **Public-surface snapshot:** `public-surface.test.ts` green (runtime + type-only surface locked).
- **Allocation micro-bench** (`bench:alloc:router`, 5 runs × 200k matches, `--expose-gc`):
  - Static-route hit: **92.8 B/op** (cv 0.19%)
  - Param-route hit: **169.4 B/op** (cv 1.1%)
  - Pinned baseline: `apps/benchmark/results/router-alloc-baseline.json`.
- **Differential/characterization golden:** 66 probes across 9 route sets
  (`src/__tests__/fixtures/match-golden.json`), captured from the pre-change matcher.
  Regenerate only for an understood delta: `GEN_GOLDEN=1 pnpm --filter @nextrush/router test match-differential`.

## Benchmark honesty note

`pnpm bench:compare --profile full` (5-run, CPU-pinned) RPS A/Bs require a clean, CPU-pinned
host — the repo itself withdrew published RPS numbers pending such a run (README §Performance).
Correctness here is gated deterministically by the differential golden + full suite; allocation
reductions are proven by the deterministic micro-bench. Final Route-Params RPS confirmation for
the HP-11 keep/park decision (task 5.6) is deferred to CPU-pinned hardware and recorded below when run.

## Per-trim outcomes

- HP-10 (single RouteMatch): _pending_
- HP-9 (method-nested static map): _pending_
- HP-12 (unicode-correct normalize fast-path): _pending_
- HP-11 + HP-13 (param-walk rewrite): _pending_

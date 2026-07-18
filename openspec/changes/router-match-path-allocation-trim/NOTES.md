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

## Allocation-measurement finding (important)

A caller-side (black-box) allocation micro-bench measures only NET-RETAINED per-op
heap. HP-9 (`staticKey` string), HP-10 (wrapper object), HP-11 (per-segment tuple
arrays), and HP-13 (`Object.keys` array) all remove *transient* garbage that is never
returned to the caller — so it never contributes to retained heap and cannot be seen
by this bench. Verified by a controlled in-process A/B: one-object vs two-object result
construction retained 120.0 vs 120.2 B/op (Δ0.1), i.e. the removed wrapper is pure GC
churn, not retained heap. A GC-churn proxy (minor-GC count/time) is defeated by V8
escape analysis and heuristic GC scheduling — also unreliable.

Consequence: transient-garbage removal is verified STRUCTURALLY (code) + by DETERMINISTIC
spy tests (the specific allocating op is no longer invoked on the match path), not by a
heap delta. The micro-bench is retained as a retained-heap regression guard and a
throughput smoke check; its cross-process numbers are drift-sensitive and are NOT used to
claim transient-garbage reductions.

## Per-trim outcomes

- HP-10 (single RouteMatch): DONE. `matchRoute` returns the full `RouteMatch` (incl.
  `middleware`) in one allocation; `resolveMatch` is a thin delegator (no wrapper object).
  Verified: `match-single-alloc.test.ts` (single-object contract) + differential golden
  unchanged + full suite green. Structural fact: 2 result objects → 1.
- HP-9 (method-nested static map): _pending_
- HP-12 (unicode-correct normalize fast-path): _pending_
- HP-11 + HP-13 (param-walk rewrite): _pending_

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
- HP-9 (method-nested static map): DONE. `staticRoutes` is now
  `Map<HttpMethod, Map<string, HandlerEntry>>` across segment-trie.ts (new
  `StaticRouteMap` type), registration.ts, match-route.ts, state.ts, router.ts,
  middleware-adapter.ts. Lookup selects the inner map by method then probes by the
  trailing-slash-normalized path — no `${method} ${path}` concat. `reset()` clears
  the outer map (drops all inner maps). Verified: differential golden byte-identical,
  `static-map-reset.test.ts` (full-clear/no-ghost), full suite green. `staticKey`
  string removal is a transient-garbage elimination — proven structurally (the
  concat is gone from source), not by the net-retained micro-bench (see finding above).
- HP-12 (unicode-correct normalize fast-path): _pending_
- HP-12 (unicode-correct normalize fast-path): DONE. matching.ts gains
  `isProvablyLowerAscii` (false on any `A`–`Z` or any byte `> 0x7F`) and
  `collapseAndStrip`; `normalizePathForMatch` skips `toLowerCase()` only when
  provably case-stable (byte-identical to always folding — non-ASCII uppercase
  still folds). `matchRoute` decides case-stability ONCE and, when stable, skips
  both the fold allocation AND the second original-case normalize pass (extracts
  param values from `normalized`, which equals the original-case structure).
  Verified: `match-normalize-fastpath.test.ts` (toLowerCase not invoked on stable
  paths incl. a full param match; byte-identity for ASCII + non-ASCII uppercase),
  differential golden byte-identical, full suite green.
- HP-11 + HP-13 (param-walk rewrite): DONE — kept in full (D6 decision below).
  matching.ts: `matchNodeIndexed` is now an ITERATIVE explicit-stack DFS (frame
  stage-machine 0=extract+static, 1=param, 2=wildcard/backtrack), closing the
  latent stack-overflow DoS with NO behavior-changing segment cap. Param/wildcard
  bindings are DEFERRED onto caller-owned parallel stacks (`bindNames`/`bindValues`,
  pushed on descent, popped on backtrack), so matchRoute materializes params ONCE
  on the accepted terminal on a null-prototype object (D8) — removing the eager
  bind + backtrack `Reflect.deleteProperty` (V8 hidden-class deopt) and the
  `Object.keys` post-loop (HP-13; bind count drives the EMPTY_PARAMS decision).
  `decodeParam` stays strictly post-split (D9). `extractSegment` (tuple) removed;
  scalar `segmentAt` replaces its one remaining use.
  Verified: 66-probe differential golden BYTE-IDENTICAL; `match-safety.test.ts`
  (15 scenarios) green — null-proto params + `__proto__`/`constructor` own-key
  binding with no global pollution; `%2F`/`%2E` never re-segment; 60k-segment
  match resolves + 60k miss, both without stack overflow (was RangeError before);
  concurrency isolation; clean-null miss / 405 / compiled-executor; and
  DETERMINISTIC spies proving `Object.keys` and `Reflect.deleteProperty` are no
  longer invoked on the match path. 240 router tests, typecheck + lint clean.

### D6 decision gate (task 5.6)

HP-11 is KEPT in full. The null-proto (D8), traversal-safe decode (D9), and
iterative/DoS hardening are mandated on correctness/safety grounds regardless of
RPS, and they are INSEPARABLE from the same rewrite — you cannot revert the
"perf" mechanism (deferred materialize) while keeping the null-proto/DoS
properties, because they are the same code path. The perf mechanism removes real
work (the `Object.keys` post-loop, the `Reflect.deleteProperty` deopt, the second
original-case extraction) with zero correctness regression (golden byte-identical).
Per the established measurement finding, the net-retained micro-bench cannot
observe this transient-garbage delta; removal is proven by the deterministic
spies. The final Route-Params RPS A/B (`--profile full`, CPU-pinned) is deferred
to clean hardware — the same stance the repo takes on all published RPS numbers —
and is the one gate not runnable here; it does not affect the keep decision since
the hardening is mandatory. Recorded for RFC 015 (task 6.4).

# NextRush v3 — Performance Engineering Investigation: Executive Summary

**Investigation ID:** `2026-07-28_10-17-34_nextrush-performance-engineering-agent`
**Date:** 2026-07-28
**Methodology:** `docs/playbooks/performance-review-playbook.md` (all 8 parts, executed in order)
**Framework under review:** NextRush v3 (core line `3.1.0`), workspace HEAD `5f77df1`
**Primary evidence:** `apps/benchmark/results/2026-07-27T15-42-50/` — wrk, `standard` profile, 3 runs
per cell, 6 frameworks × 10 scenarios × 3 concurrency levels, Node v26.4.0, Intel i5-8300H
**Workspace mode:** read-only audit workspace; no benchmarks, profilers, or builds were executed

---

## 1. What the benchmark actually says

NextRush ranks **4th of 6** on the aggregate scoreboard (90/144) behind Raw Node.js (139),
Fastify (112) and Hono (91), ahead of Koa (45) and Express (27).

That ranking hides the finding that matters. NextRush is the **fastest framework in the suite at
concurrency 1** — it wins 5 scenarios outright there, including beating the raw `node:http`
baseline on Hello World (27,318 vs 25,586 rps), JSON Serialization, Query Strings, Deep Route and
Large JSON. It then falls to 4th place in almost every scenario at 64 and 256 connections.

The mechanism is visible in the scaling ratios. Measuring how much throughput each framework
*gains* when concurrency rises from 1 to 64 connections:

| Framework | Hello World c1 → c64 | Route Params c1 → c64 | Middleware c1 → c64 |
| --------- | -------------------- | --------------------- | ------------------- |
| Fastify | **×1.43** | ×1.39 | ×1.35 |
| Raw Node.js | ×1.42 | ×1.35 | ×1.31 |
| Hono | ×1.25 | ×1.25 | ×1.28 |
| Koa | ×1.24 | ×1.25 | ×1.22 |
| Express | ×1.20 | ×1.15 | ×1.15 |
| **NextRush v3** | **×1.11** | **×1.01** | **×1.01** |

NextRush has the **worst concurrency scaling of all six servers — worse than Express** — while
having the best single-connection latency. On Route Parameters and Middleware Stack it gains
essentially *nothing* from 64× more offered load, meaning it is already CPU-saturated at
concurrency 1.

This is the signature of a framework whose per-request *socket write path* is efficient (which is
what concurrency-1 latency measures) but whose per-request *CPU and allocation cost* is high
(which is what saturated throughput measures). Section 01 develops this; Section 04 attributes it.

## 2. Where the cost actually is

Converting throughput at 256 connections into microseconds of CPU per request
(`µs/req = 1e6 / rps`) and subtracting each framework's own **empty-response floor** isolates
what each subsystem costs, independent of the fixed overhead:

| Cost component | NextRush | Fastify | Raw Node | NextRush penalty vs Fastify |
| -------------- | -------- | ------- | -------- | --------------------------- |
| **Fixed per-request floor** (204, no body) | 30.30 µs | 24.75 µs | 22.71 µs | **+5.55 µs** |
| **Param extraction** (route-params − hello) | 7.30 µs | 2.07 µs | 1.44 µs | **+5.23 µs (3.5×)** |
| **Middleware dispatch** (per layer, 5 layers) | 2.09 µs | 0.87 µs | 1.04 µs | **+1.22 µs/layer (2.4×)** |
| JSON serialization (large-json − hello) | 17.51 µs | 17.80 µs | 17.90 µs | −0.29 µs (**parity**) |
| Body parsing (post-json − hello) | 21.26 µs | 21.35 µs | 11.36 µs | −0.09 µs (**parity**) |
| Query parsing (query-string − hello) | 9.40 µs | 8.68 µs | 8.23 µs | +0.72 µs (near parity) |
| Error path (error − hello) | 21.09 µs | 21.12 µs | 12.68 µs | −0.03 µs (**parity**) |

**The entire competitive gap lives in three mechanisms.** Serialization, body parsing, query
parsing and the error path are already at Fastify parity and must not be optimized — doing so
would spend effort where there is nothing to win. This is a deliberate negative finding, detailed
in `01-benchmark-analysis.md` §5.

## 3. The five findings

| ID | Finding | Severity | Confidence | Effort |
| --- | ------- | -------- | ---------- | ------ |
| **P-01** | Unconditional per-request `Promise.race` + `setTimeout(30 s)` + `Symbol()` in the Node adapter's request handler — ~6–8 heap allocations, one timer insert/clear, and ~3 extra microtask hops on 100% of requests | **Critical** | Confirmed (code) / Strong (attribution) | Small–Medium |
| **P-02** | Route-parameter matching allocates 5 objects per request and is the framework's widest like-for-like gap (−25.5% vs Fastify at 256 conn) | **Critical** | Confirmed | Medium |
| **P-03** | `compileExecutor` does not compile — for routes with middleware it rebuilds a recursive dispatch chain at request time although the middleware array is fully known at registration time | **High** | Confirmed | Medium |
| **P-04** | Eager `ctx.ip` resolution in the Context constructor for a property most handlers never read | **Medium** | Confirmed | Small |
| **P-05** | Static-file middleware performs an uncached filesystem `stat` on every request; no stat/ETag/negative cache | **Medium** | Hypothesis (no benchmark coverage) | Medium |

P-01 is the headline. It was introduced by commit `d97734e3` (2026-07-22), a **cross-runtime
parity fix** (audit finding F-04) that added a handler-level timeout race to the Node adapter so
it would behave identically to the Bun/Deno/Edge adapters. The parity goal is correct and must be
preserved. What was not done was measuring the cost of the mechanism chosen to achieve it. It
landed five days before the benchmark run analysed here, so the measured numbers include it, and
it is the only un-trimmed structure remaining on a hot path that the team had otherwise optimised
exhaustively.

## 4. Verification of the prior investigation

Per the multi-agent rule, the previous review (`report/core/performance-review.md`, baseline
`1878042`) was independently re-verified against HEAD rather than trusted:

- Its **#1 finding (NF-1, three nested async frames)** — **now shipped and confirmed fixed.**
  `createRoutesMiddleware` forwards the executor promise directly; `compileExecutor`'s zero-middleware
  path calls the handler without an async frame.
- Its **#3 finding (NF-2, eager `ctx.state = {}`)** — **now shipped and confirmed fixed.** `state`
  is a getter on `NodeContext`; the constructor no longer allocates it.
- Its **#2 finding (NF-3, route-params is the widest gap and an unvalidated allocation claim)** —
  **confirmed and worsened.** The gap vs Fastify moved from −20.6% to **−25.5%** in the newer run.
- Its **meta-finding (no CPU-pinned profile, no allocation profile ever run)** — **still true.**
  No CPU profile, flamegraph, heap snapshot, allocation profile, GC trace, or event-loop-delay
  measurement exists anywhere in this workspace. The run analysed here still has CPU pinning off.

The prior review's baseline predates `d97734e3`, so it could not have seen P-01. P-01 is therefore
a genuinely new finding, and it lands on precisely the hot path that review spent its effort
flattening: NF-1 removed one async frame and one microtask hop; F-04 then added roughly five
promise allocations, a timer object, and three microtask hops to the frame directly above it.

## 5. Expected upside

If the three addressable mechanisms are closed to Fastify parity, the arithmetic on the measured
`µs/req` figures (Section 05 shows the derivation and its assumptions) gives:

| Scenario @ 256 conn | Measured | Projected at parity | Upside |
| ------------------- | -------- | ------------------- | ------ |
| Hello World | 28,917 rps | ~34,400 rps | **+19%** |
| Route Parameters | 23,878 rps | ~32,000 rps | **+34%** |
| Middleware Stack | 22,217 rps | ~29,800 rps | **+34%** |

These are **projections from a cost decomposition, not measurements.** They are stated as an
upper bound on what the three findings are worth, to size the work — not as a promised result.
Every one requires the validation protocol in `06-validation-regression.md` before it may be
claimed.

## 6. The most important recommendation is not a code change

The single highest-leverage next action is **not** implementing P-01 through P-05. It is closing
the evidence gap, because this investigation — like the one before it — had to reason about CPU
and allocation behaviour from throughput arithmetic and source reading, with **zero profiler
data**.

Specifically required before the roadmap's Phase 2:

1. A CPU profile / flamegraph of the `hello-world` and `route-params` scenarios under load.
2. An allocation profile (or a run of the repo's existing `bench:alloc:*` harnesses) capturing
   bytes/request for the adapter handler path — the harnesses exist in `apps/benchmark/scripts/`
   and have produced trustworthy numbers before (`832.1 → 56.1 B/req, cv≈0`), but no result
   artifact for the current code is stored.
3. A **pinned baseline** committed to `apps/benchmark/results/baseline/`. Today `/results/*` is
   gitignored with no `baseline/` present, so no pre-`d97734e3` run is recoverable and P-01 cannot
   be A/B'd against its own introduction. This is why P-01's *magnitude* is a hypothesis even
   though its *existence* is confirmed in code.

## 7. Document map

| Report | Contents |
| ------ | -------- |
| `01-benchmark-analysis.md` | Playbook Part 2 — full gap tables, scaling analysis, cost decomposition, parity/fairness assessment, negative findings |
| `02-runtime-profiling.md` | Playbook Part 3 — evidence inventory, confidence classification, and the explicit statement of what profiling does not exist |
| `03-subsystem-analysis/` | Playbook Part 4 — one file per subsystem: router, middleware, context, request, response, body-parser, serializer, static-files |
| `04-root-cause-analysis.md` | Playbook Part 5 — root causes, classification, impact, prioritisation |
| `05-solution-engineering.md` | Playbook Part 6 — solutions with alternatives, trade-offs, risk, implementation strategy |
| `06-validation-regression.md` | Playbook Part 7 — validation criteria, benchmark protocol, regression and scalability gates |
| `07-optimization-roadmap.md` | Playbook Part 8 — phased roadmap, effort estimates, validation milestones, final recommendations |
| `appendix/investigation-checklist.md` | Per-phase completion record against the playbook |
| `appendix/benchmark-notes.md` | Harness configuration, artifact integrity issues, reproduction notes |
| `appendix/open-questions.md` | Unresolved anomalies and required future investigation |

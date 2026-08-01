# Validation & Regression (Canonical)

**Playbook phase:** Part 7 — Validation & Regression. **Status: Not run.** This report defines the
canonical validation matrix that any future experiment or optimization from this investigation must
satisfy — it is a specification of the gate, not a record of a gate that has been passed. **This
investigation itself executes none of the validation described below** — no shell, benchmark,
profiler, or test was run to produce this document.

Related: [`05-solution-engineering.md`](./05-solution-engineering.md) (the conditional alternatives
this matrix would validate) · [`07-optimization-roadmap.md`](./07-optimization-roadmap.md)
(sequencing) · [`02-runtime-profiling.md`](./02-runtime-profiling.md) (the evidence gate this
matrix's own inputs depend on).

## 1. Validation criteria (playbook §7.1) — defined, not yet met

Per the playbook, validation criteria must be defined *before* testing. For any future experiment
produced by this investigation's roadmap:

| Criterion | Applies to |
| --- | --- |
| Higher throughput (RPS) at the targeted concurrency level(s) | All experiments |
| No latency regression (p50/p99) | All experiments |
| No increase in CPU utilization disproportionate to the throughput gain | All experiments |
| Reduced or unchanged allocation count/bytes-per-request for the targeted path | Allocation-focused experiments (adapter, router, body) |
| No increase in GC pause count/duration relative to baseline | All experiments |
| Stable event-loop delay / ELU under load | All experiments |
| Preserved observable behavior (semantics) — no functional regression | All experiments, mandatory |

## 2. The full validation matrix

Every future experiment arising from this investigation must be checked against **all** of the
following before being considered validated — omitting any row is itself a process violation per
this repo's `tdd-workflow.md` ("Every runtime-touching change runs the conformance suite... observable
behavior must stay identical across adapters"):

| Dimension | Method | Notes |
| --- | --- | --- |
| **Targeted semantics** | Unit/integration tests for the specific behavior touched (e.g. timeout 504 behavior, route precedence, body size limits) | Must exist *before* the change, per RED-GREEN-REFACTOR (`tdd-workflow.md`, repo and global) |
| **Cross-adapter conformance** | `packages/adapters/conformance` suite | Mandatory whenever adapter-layer code changes (Hypothesis #1); required by `architecture.instructions.md`'s runtime-independence mandate |
| **Full like-for-like benchmark re-run** | `apps/benchmark` `standard` or `full` profile, under pinned/provenanced conditions (commit SHA recorded, config recorded) | Must fix the provenance gaps identified in `01-benchmark-analysis.md` §1 — this is itself part of what makes a future run trustworthy where this one is not |
| **Throughput** | RPS at 1c/64c/256c | Compare against this investigation's baseline table (`01-benchmark-analysis.md` §3–§5) |
| **Latency** | p50, p99 | Same |
| **Variability** | CV across repeats | Same; must be noise-aware (non-overlapping confidence, not single-run point estimates) per the decision thresholds in `05-solution-engineering.md` §7 |
| **Error rate** | Request error/failure count during the benchmark | New criterion not present in the current publishable artifact's reported fields — should be captured going forward |
| **Allocated bytes/request** | Heap-profile delta for the targeted scenario | Required for any allocation-focused experiment (#1, #2, #3) |
| **GC count/pause/heap growth** | GC trace for the targeted scenario | Required — the current artifact's gap here is exactly what this investigation could not close |
| **Event-loop delay / ELU** | Event-loop monitoring during the benchmark | Required — same reason |
| **RSS** | Process memory during the benchmark | Should be captured per-scenario, not only as a suite-wide aggregate (see the aggregation limitation in `01-benchmark-analysis.md` §7) |
| **Rollback plan** | Documented, tested revert path | Mandatory before any production-facing change per this repo's git/change discipline |

## 3. Regression analysis requirements (playbook §7.4–§7.5)

Any confirmed optimization must additionally be checked for:
- **Cross-scenario regression:** does improving one scenario (e.g. Hello, if the adapter timeout
  path is optimized) degrade another (e.g. does removing timeout overhead change behavior for a
  slow/hung-handler scenario, which none of the current 10 benchmark scenarios exercise)?
- **Cross-concurrency regression:** does the improvement hold at 1c, 64c, *and* 256c, or does it
  only appear at one level? A change that helps at 256c but regresses 1c latency needs explicit
  discussion, not silent acceptance.
- **Startup/long-running stability:** the playbook explicitly calls for reviewing startup
  performance and long-running stability — neither is covered by the current 30-second-per-
  measurement benchmark design, and any future experiment should note this as a residual gap if
  not separately tested.

## 4. Acceptance criteria (playbook §7, Section C)

An optimization arising from this investigation is considered complete only if **all** of the
following hold — this is a conjunction, not a majority:
1. Performance improvement is measurable and meets the decision threshold in
   `05-solution-engineering.md` §7 (≥5% shared-path / ≥3% scenario-specific, noise-aware).
2. No critical regression is introduced (functional or performance) per §2's matrix.
3. Runtime behavior remains correct — verified by the targeted semantics tests and cross-adapter
   conformance suite, not by benchmark numbers alone.
4. Validation results (not just the change) are documented, matching this matrix.
5. Remaining limitations are documented rather than implied to be resolved.

An experiment that fails any of these should be revised, rejected, or returned to the investigation
phase — **not shipped with a partial pass** framed as sufficient.

## 5. Explicit non-claim

**This investigation does not claim any experiment has passed this matrix.** No experiment has been
run. This report exists so that when P0/P1 experiments in
[`07-optimization-roadmap.md`](./07-optimization-roadmap.md) do run, they have a pre-agreed,
complete checklist to be measured against — preventing a future report from inventing a narrower
ad hoc validation standard under time pressure.

## 6. Playbook cross-reference

This report satisfies Part 7 (§7.1 Define Validation Criteria) of
`docs/playbooks/performance-review-playbook.md` at the specification level. §7.2–§7.6 (execute
benchmarks, verify runtime behavior, regression analysis, document results) are **Blocked** —
they require experiments that have not been run, per the evidence gate in
[`02-runtime-profiling.md`](./02-runtime-profiling.md).

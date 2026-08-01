# Runtime Profiling & Evidence Gate (Canonical)

**Playbook phase:** Part 3 — Runtime Profiling & Evidence. **Status: Blocked.** This is the
canonical evidence-gate register for the investigation — every subsystem file and the root-cause
report link here rather than re-describing gate status.

Related: [`01-benchmark-analysis.md`](./01-benchmark-analysis.md) (the gap this evidence would
explain) · [`04-root-cause-analysis.md`](./04-root-cause-analysis.md) (hypotheses this evidence
would promote or reject) · [`appendix/open-questions.md`](./appendix/open-questions.md) (who owns
unblocking this).

## 1. Gate statement

Per `docs/playbooks/performance-review-playbook.md` Part 3, Section C (§3.7–§3.8), a performance
investigation must not draw causal conclusions before CPU profiling, memory profiling, GC analysis,
and event-loop analysis are complete. **None of the four are complete for the current codebase.**
This gate is **explicitly blocked**, not silently skipped, per this investigation's governance.

## 2. Required evidence inventory

| Evidence type | Playbook ref | Status | Notes |
| --- | --- | --- | --- |
| CPU flamegraph / profile | §3.3 | **Missing** | No `.cpuprofile` in approved audit/benchmark trees |
| Allocation profile / heap snapshot | §3.4 | **Missing** | No `.heapprofile` / heap snapshot in approved trees |
| GC frequency / pause / heap growth | §3.5 | **Missing** | No GC trace exists; benchmark run did not trace GC (§7, `01-benchmark-analysis.md`) |
| Event-loop delay / ELU | §3.6 | **Missing** | No event-loop-delay or ELU artifact exists |
| Request lifecycle trace | §3.2 (Runtime) | **Missing** | No async/runtime trace artifact exists |

**Absence is not evidence of absence of a problem.** A missing GC trace does not mean GC pressure
is zero or negligible — it means the question is unanswered. This distinction is stated explicitly
because it is easy to misread "no GC data" as "no GC," which the benchmark artifact itself does not
support (§7, `01-benchmark-analysis.md`).

## 3. Historical artifacts cited by prior reports (non-authoritative for this investigation)

A prior report (`report/router/route-params-profile.md`) cites the following raw artifacts as its
evidentiary basis:

| Cited artifact | Current status |
| --- | --- |
| `apps/benchmark/results/param-match-alloc-2026-07-18T14-13-26/param-match-alloc.json` | **Absent** from current workspace |
| `apps/benchmark/results/heapprof-server/nextrush-route-params.heapprofile` | **Absent** |
| `apps/benchmark/results/cpuprof-server/nextrush-route-params.cpuprofile` | **Absent** |
| `apps/benchmark/results/route-params-ab-2026-07-18T14-26-18/route-params-ab.json` | **Absent** |

**Why these are treated as secondary, not adopted as current fact:**
1. The raw artifacts the prior report's numbers are computed from no longer exist in this
   workspace — its conclusions (e.g. matcher ≈4% CPU, ≈0.34% sampled heap) are **non-reproducible**
   under this investigation's evidence rules.
2. The current adapter and router source inspected in this investigation (commit
   `5f77df1fcedcf62923ce08361e45e07bc9e9772c`) appears structurally newer than the code the prior
   report describes profiling, and the prior report does not pin a commit SHA either — exact
   source provenance for the historical claim is missing on both sides.
3. Per this investigation's governance, "prior reports are secondary until independently verified,"
   and independent verification requires re-running the profile against current source under a
   pinned commit — which this documentation-only investigation is not permitted to do (no shell,
   no profiler execution).

The historical numbers are recorded here for context and are **not** carried into
[`04-root-cause-analysis.md`](./04-root-cause-analysis.md) as Confirmed or Strong Evidence. Any
hypothesis they might support remains a Hypothesis, sourced from current structural reading of
source, not from the historical numbers.

## 4. What would unblock this gate

To promote any hypothesis in `04-root-cause-analysis.md` beyond Hypothesis/Unknown, the following
new evidence is required (see [`07-optimization-roadmap.md`](./07-optimization-roadmap.md) P0 for
sequencing and [`06-validation-regression.md`](./06-validation-regression.md) for the full
methodology each experiment must follow):

1. **Exact commit/config provenance** for any future benchmark run (commit SHA, `NODE_ENV`, adapter
   options, Node flags) — the current run lacks this (§1, `01-benchmark-analysis.md`).
2. **Current CPU profiles** for Hello, Empty, Route Params, and POST JSON scenarios, taken against
   the pinned commit under load, comparable to the methodology the absent historical artifacts
   describe (`--cpu-prof` + `wrk` against the running server).
3. **Current allocation profiles** for the same four scenarios (`--heap-prof` + `wrk`).
4. **GC count, pause duration, and heap growth** for the same four scenarios.
5. **Event-loop delay / ELU** measurement under the same load.
6. **A controlled default-timeout-vs-`timeout=0` A/B** — one variable changed (adapter `timeout`
   option), all else held constant, to test the F-ADAPTER-01 hypothesis in
   [`04-root-cause-analysis.md`](./04-root-cause-analysis.md) directly.

## 5. Evidence confidence scale used throughout this investigation

Per playbook §3.7, every claim in this investigation is labeled with one of:

| Label | Meaning |
| --- | --- |
| **Confirmed** | Directly observed in the approved benchmark artifact or current source, with a specific citation. |
| **Strong Evidence** | Multiple independent, current, reproducible measurements agree. *(Not reached by any causal claim in this investigation — the runtime gate is blocked.)* |
| **Moderate Evidence** | A single current measurement supports the claim but lacks independent corroboration. *(Not reached by any causal claim in this investigation.)* |
| **Hypothesis** | A plausible, structurally-motivated explanation that has not been measured against current code. |
| **Unknown** | No evidence exists either way; not investigated or not measurable with current artifacts. |

No causal performance-attribution statement in this investigation is labeled Confirmed or Strong
Evidence. Statements about *what the benchmark data shows* or *what the source code structurally
does* may be Confirmed — those are different claims from *why the benchmark data looks that way*.

## 6. Finding F-GATE-01 — current runtime evidence is insufficient for causal attribution

**Status/confidence:** Confirmed evidence absence; causal attribution is Unknown and the playbook
gate is Blocked.  
**Priority:** P0 — this is the root blocker for every optimization decision in this investigation.  
**Current situation/evidence:** Approved artifact trees contain no current CPU profile or flamegraph,
allocation profile, heap snapshot/profile, GC count/pause/heap-growth trace, event-loop-delay trace,
ELU measurement, or request lifecycle trace. Historical reports cite four raw profiling artifacts
that are now absent and do not pin the profiled source revision. The inspected current revision is
not proven to be the benchmarked revision.  
**Present-design benefits:** The retained standard benchmark still identifies scenario and
concurrency patterns without profiler perturbation, and prior reports preserve historical questions
worth retesting. Refusing to elevate those reports without raw artifacts protects the investigation
from false precision.  
**Root cause:** The evidence gap results from absent current profile capture/retention and incomplete
source/config provenance. It is not evidence of a runtime defect and cannot identify the runtime
root cause of the measured throughput gap.  
**Runtime/performance impact:** Until this gate closes, CPU ownership, bytes allocated per request,
GC contribution, heap growth, event-loop utilization, and event-loop delay are Unknown. Selecting a
source optimization now could spend engineering effort on a minor path, hide a contract regression,
or improve one scenario while moving cost elsewhere.  
**Recommendation:** On a pinned clean revision, capture CPU and allocation profiles plus GC/heap and
ELU/event-loop-delay evidence for Hello, Empty, Route Params, and POST JSON. In the same controlled
environment, run a one-variable default-timeout-versus-`timeout=0` diagnostic. Retain raw artifacts,
commands/configuration, symbols, and immutable run metadata.  
**Alternatives:** Production sampling can reveal real traffic distributions, and focused
microbenchmarks can isolate individual primitives. Both are useful corroboration, but neither alone
replaces controlled end-to-end profiles tied to the benchmark gaps.  
**Trade-offs:** Profilers perturb execution, consume storage, and add analysis time. Production
sampling is more representative but less controlled and may involve operational/privacy constraints;
synthetic profiles are controlled but may miss production workload shape.  
**Risks:** Unmatched warmup, load, symbols, or source revision can make profiles incomparable.
Aggregating scenarios can hide ownership, profiler overhead can reorder small hotspots, and a
timeout-disabled diagnostic can be misrepresented as a production-default recommendation unless it
remains explicitly diagnostic.  
**Expected improvement:** Direct runtime improvement is Unknown and none is claimed; evidence capture
is a decision-enabling step. Any later experiment must establish its own measured gain against the
gates in [`06-validation-regression.md`](./06-validation-regression.md).  
**Migration difficulty:** Low for laboratory evidence capture; Medium if production observability is
added. No framework public behavior should change while closing this gate.  
**Validation:** Verify every raw artifact names the exact revision/configuration and scenario, profiles
symbolize against that revision, GC/heap/ELU windows align with timed load, timeout A/B differs by one
option only, repeated sessions reproduce direction within declared noise, and all artifacts remain
available for independent recomputation.

## 7. Playbook cross-reference

This report documents Part 3 (§3.1–§3.8) of `docs/playbooks/performance-review-playbook.md` as
**Blocked**, per the mandatory phase ordering — subsystem analysis (Part 4, see
[`03-subsystem-analysis/`](./03-subsystem-analysis/)) proceeds only at the structural level this
gate permits, and root-cause analysis (Part 5, see
[`04-root-cause-analysis.md`](./04-root-cause-analysis.md)) is correspondingly bounded to
Hypothesis/Unknown for causal attribution.

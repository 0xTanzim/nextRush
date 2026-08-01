# Appendix — Investigation Checklist

Completion record against every checklist the Performance Review Playbook defines. Items that could
not be completed are marked ⚠️ or ❌ with the reason and a pointer to what is required, per the
playbook's rule that missing evidence is documented rather than skipped.

---

## Part 0 — Investigation Preparation (§0.5)

| Item | Status | Note |
| ---- | ------ | ---- |
| Investigation objective defined | ✅ | Full evidence-driven performance review of NextRush v3 per the playbook |
| Investigation scope established | ✅ | Runtime behaviour only; §1.4 exclusions applied (style, naming, docs, features) |
| Benchmark reports reviewed | ✅ | `results/2026-07-27T15-42-50/` — CSV, README-TABLES, scoreboard |
| Existing engineering evidence identified | ✅ | Inventoried in `02-runtime-profiling.md` §2 |
| Previous investigation reports reviewed | ✅ | `report/core/*`, `report/router/*`, `report/adapters/*`, `report/reliability/*` — verified, not trusted |
| Required documentation located | ✅ | Playbook only, per the knowledge-loading policy; no repository-wide doc discovery performed |
| Missing evidence documented | ✅ | `02-runtime-profiling.md` §1 and §5 |
| Investigation ready to begin | ✅ | Proceeded with a declared substitute method and confidence ceiling |

**Prohibited actions honoured:** no dependency install, no build, no benchmark execution, no profiler
execution, no regeneration of existing artifacts, no repository configuration changes. The workspace was
treated as read-only apart from this new report directory.

---

## Part 2 — Benchmark Assessment (§2.6)

| Item | Status | Note |
| ---- | ------ | ---- |
| Benchmark results reviewed | ✅ | All 180 cells; CV assessed before drawing conclusions |
| Performance gaps identified | ✅ | `01-benchmark-analysis.md` §3 — every scenario, three baselines |
| Investigation questions defined | ✅ | §7 — five questions carried into Parts 3–5 |
| Relevant subsystems identified | ✅ | §7 priority table; four subsystems explicitly scoped **out** for lack of a measured gap |
| Investigation priority assigned | ✅ | P0–P3 in §7 |

Additional work beyond the checklist: data-quality assessment (§1), fairness/parity review (§6), and an
explicit negative-findings section (§5) so that future effort is not spent on subsystems already at
parity.

---

## Part 3 — Runtime Profiling & Evidence (§3.8)

| Item | Status | Note |
| ---- | ------ | ---- |
| CPU profiling completed | ❌ | **No CPU profile or flamegraph exists in the workspace.** Required: `02-runtime-profiling.md` §5 item 1 |
| Memory profiling completed | ❌ | **No heap snapshot exists.** Required: §5 item 6 |
| Allocation analysis completed | ⚠️ | Harnesses exist; no result artifact for current code. Historical numbers reused but predate `d97734e3`. Required: §5 items 2–3 |
| Garbage collection reviewed | ❌ | **No GC trace exists.** Partially substituted by p99/p50 tail analysis (§3), which *weakened* the GC-pause hypothesis |
| Event loop analyzed | ❌ | **No event-loop-delay or ELU data exists.** Substituted by latency percentiles |
| Required runtime evidence collected | ⚠️ | Substitute method declared in §4 with an explicit confidence ceiling |

**Phase declared PARTIALLY BLOCKED.** Per the execution policy, profilers must not be run in this
workspace. The investigation continued on a declared substitute (static hot-path enumeration validated
against the throughput decomposition) with the rule that **no finding may be labelled Confirmed for its
magnitude.** All six missing items, with the exact command or harness that produces each, are listed in
`02-runtime-profiling.md` §5.

---

## Part 4 — Subsystem Analysis

Every subsystem analysed with the full §4.1–4.10 methodology: purpose, architecture, request-lifecycle
participation, performance characteristics, runtime behaviour, bottleneck analysis, root-cause
candidates, optimisation opportunities, edge cases, investigation summary.

| §  | Subsystem | Report | Finding | Evidence |
| -- | --------- | ------ | ------- | -------- |
| 4.11 | Request Lifecycle | `context.md` | **P-01 Critical** | Measured floor + source + git attribution |
| 4.12 | Router | `router.md` | **P-02 Critical** | Measured gap + source |
| 4.13 | Middleware | `middleware.md` | **P-03 High** | Measured per-layer cost + source |
| 4.14 | Context | `context.md` | **P-01, P-04** | Measured floor + source |
| 4.15 | Request | `request.md` | None — parity | Measured |
| 4.16 | Response | `response.md` | **P-06 Medium** | Source; magnitude unmeasured |
| 4.17 | Body Parser | `body-parser.md` | None — parity | Measured |
| 4.18 | Serialization | `serializer.md` | None — parity | Measured |
| 4.19 | Error Handling | `01-benchmark-analysis.md` §5; `context.md` §9 | None — parity | Measured (21.09 vs Fastify 21.12 µs) |
| 4.20 | Static File Serving | `static-files.md` | **P-05 Medium** | Source only — **no benchmark coverage** |
| 4.21 | Internal Utilities | `router.md` §5, `request.md` §2, `body-parser.md` §6 | None | `collapseAndStrip`, `parseQueryString`, `concatBuffers`, `decoderFor` reviewed |
| 4.22 | Cross-Subsystem | `04-root-cause-analysis.md` §2 | **Master symptom** | Flat scaling attributed to fixed cost, not to any single subsystem |

§4.19 has no dedicated file because the mandated report structure defines none, and the error path was
measured at parity — so a dedicated file would contain only a negative finding already recorded in two
places.

---

## Part 5 — Root Cause Analysis

| Item | Status |
| ---- | ------ |
| Root cause identified per issue (§5.1) | ✅ 7 of 7 |
| Symptom vs. cause separated | ✅ `04-root-cause-analysis.md` §1 |
| Issue classified (§5.2) | ✅ Async Overhead, Memory Allocation, Data Structure, Architectural, I/O, Configuration/process |
| Impact measured (§5.3) | ✅ where measurable; ❌ stated for P-05/P-06 |
| Optimisation opportunities identified (§5.4) | ✅ §9 |
| Trade-offs evaluated (§5.5) | ✅ per solution in `05-solution-engineering.md` |
| Findings prioritised (§5.6) | ✅ §10 |
| Confidence level recorded (Section C) | ✅ every finding |

One hypothesis was **rejected on evidence** and recorded as rejected (concurrency-dependent cost
growth, refuted by the p99/p50 tail shape). Two prior-review findings were confirmed **shipped**, one
confirmed and **worsened**.

---

## Part 6 — Solution Engineering

| Item | Status |
| ---- | ------ |
| Optimisation goal defined (§6.1) | ✅ per solution |
| Alternatives explored (§6.2) | ✅ 2–5 per solution, with rejections reasoned |
| Trade-offs evaluated (§6.3) | ✅ performance, complexity, maintainability, API, memory, cross-runtime parity |
| Expected impact estimated (§6.4) | ✅ **labelled measured / derived / estimated** |
| Risk assessed (§6.5) | ✅ with mitigations |
| Implementation strategy defined (§6.6) | ✅ target files, ordering, rollback |
| Optimisation summary (Section C) | ✅ §S-summary table |

Two alternatives were explicitly **rejected on non-performance grounds**: making the timeout opt-in
(removes a cross-runtime parity guarantee) and `new Function` chain generation (breaks CSP/edge
runtimes). One solution (S-03/C1) had its own claimed benefit **revised downward** during analysis after
finding the mechanism cannot remove per-layer closures.

---

## Part 7 — Validation & Regression

| Item | Status |
| ---- | ------ |
| Validation criteria defined (§7.1) | ✅ universal gates + per-solution targets |
| Validation benchmarks executed (§7.2) | ❌ **Not executed** — audit workspace; protocol defined instead |
| Runtime behaviour verification defined (§7.3) | ✅ enumerated per solution, mandatory items marked |
| Regression detection defined (§7.4) | ✅ full matrix + scenario watch list |
| Scalability validation defined (§7.5) | ✅ 1/64/256 + 512/1024 for S-01 + soak with `--trace-gc` |
| Results documented (§7.6) | ⚠️ **Nothing to document** — no optimisation implemented |
| Acceptance criteria (Section C) | ✅ 8-point gate |

Two validations are **BLOCKED** on missing benchmark coverage and say so: V-05 (no static-file scenario)
and V-06 (no `send(object)` scenario). V-07 was added to test this report's own master hypothesis, with
an explicit falsification condition.

---

## Part 8 — Optimization Roadmap

| Item | Status |
| ---- | ------ |
| Findings prioritised (§8.1) | ✅ |
| Effort estimated (§8.2) | ✅ Small/Medium per §8.2 scale |
| Implementation phases defined (§8.3) | ✅ 4 phases with blocking dependencies |
| Validation milestones defined (§8.4) | ✅ per phase |
| Review summary (§8.5) | ✅ |
| Recommendations (§8.6) | ✅ implement now / after instrumentation / postpone / research / **do not change** |
| Continuous improvement (§8.7) | ✅ 6 practices |

---

## Report-requirement compliance

| Requirement | Status |
| ----------- | ------ |
| Every finding has Severity | ✅ |
| Every finding has Evidence | ✅ |
| Every finding has Root Cause | ✅ |
| Every finding has Runtime Impact | ✅ |
| Every finding has Recommendation | ✅ |
| Every finding has Trade-offs | ✅ |
| Every finding has Validation Plan | ✅ |
| Every finding has Expected Improvement | ✅ or explicitly "unmeasured / cannot be projected" |
| Confirmed vs. hypothesis distinguished | ✅ five-level scale, applied per finding |
| Reports independently readable | ✅ |
| Cross-referenced without bulk duplication | ✅ |
| Prior reports verified, not copied | ✅ 2 confirmed shipped, 1 confirmed worsened, 1 still open |
| Unknowns documented | ✅ `open-questions.md` |
| Future investigation identified | ✅ `02-runtime-profiling.md` §5, Phase 4, open questions |

---

## Honest statement of limits

1. **No profiler was run.** Every magnitude claim is derived from throughput arithmetic and source
   reading. Two commands (`--cpu-prof`, an existing alloc harness) would settle what this report can only
   bound.
2. **No optimisation was implemented or measured.** Part 7 is a protocol; Part 8's projections are upper
   bounds for sizing, not forecasts.
3. **Three findings (P-05, P-06, and the large-POST gap) rest on source structure alone** because no
   benchmark covers those paths. They are rated Hypothesis and ranked below measured findings
   deliberately.
4. **One run backs the quantitative analysis.** It is a 3-run `standard` profile with low CV, but with
   CPU pinning off and no independent second run — the two same-day result directories are duplicates of
   one run, not two samples.
5. **The measured gaps are a lower bound.** The harness mounts a single root router, which is the most
   favourable configuration for NextRush's `compose` fast path. A realistic multi-`use()` application
   would show wider gaps.

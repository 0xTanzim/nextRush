# Optimization Roadmap (Canonical)

**Playbook phase:** Part 8 — Optimization Roadmap. **Status: Sequencing defined; no phase beyond P0
has started.** This is the canonical sequencing document for the investigation.

Related: [`00-executive-summary.md`](./00-executive-summary.md) (headline recommendation) ·
[`02-runtime-profiling.md`](./02-runtime-profiling.md) (why P0 exists) ·
[`04-root-cause-analysis.md`](./04-root-cause-analysis.md) (hypothesis ranking that determines
P1's internal order) · [`05-solution-engineering.md`](./05-solution-engineering.md) (what each
conditional phase would evaluate) · [`appendix/open-questions.md`](./appendix/open-questions.md)
(data owners for P0).

## 1. Priority classification (playbook §8.1)

| Priority | Playbook definition | Applied here |
| --- | --- | --- |
| Critical | Significantly impacts throughput/latency/scalability | **P0 — measurement/provenance itself**, because no critical finding can be confirmed without it; this reframes "Critical" as "the prerequisite to identifying Critical findings," which is the correct framing given the blocked evidence gate |
| High | Measurable performance impact, lower urgency | P1 conditional experiments (adapter, then router/body) |
| Medium | Efficiency improvements unlikely to produce substantial gains | P2 middleware/context/response, only if profiles point there |
| Low | Limited measurable impact / long-term maintenance value | P3 static-file benchmark addition |

## 2. Phase 0 — Measurement & provenance (do first, unconditionally)

**Nothing in P1–P3 can start meaningfully before this phase**, because every hypothesis in
`04-root-cause-analysis.md` depends on evidence this phase produces.

1. **Establish exact commit/config provenance** for the next benchmark run: record the git commit
   SHA, `NODE_ENV`, adapter options (explicitly, not defaulted), Node flags, and hardware/pinning
   state. This closes the gap identified in `01-benchmark-analysis.md` §1.
2. **Capture current CPU profiles** for Hello, Empty, Route Params, and POST JSON against the
   pinned commit, under load (`wrk` + `--cpu-prof` or equivalent).
3. **Capture current allocation profiles** for the same four scenarios.
4. **Capture GC count/pause/heap growth** for the same four scenarios.
5. **Capture event-loop delay/ELU** under the same load.
6. **Run the controlled default-timeout-vs-`timeout=0` A/B** (one variable: the adapter `timeout`
   option), holding everything else constant, per `03-subsystem-analysis/request.md` (F-ADAPTER-01).

**Effort:** Medium (playbook §8.2) — primarily tooling/process work (profiler invocation,
provenance recording), not source-code complexity. **Validation milestone (playbook §8.4):**
profiles and A/B results exist, are provenance-tagged, and are checked into the approved
benchmark/audit artifact tree so future investigations do not repeat this gap.

## 3. Phase 1 — Conditional adapter experiment, then conditional router/body experiments

**Gated on Phase 0 producing evidence that meets the decision thresholds in
`05-solution-engineering.md` §7.**

1. **If** the P0 timeout A/B shows a reproducible, threshold-meeting difference: proceed to design
   (not implement) the behavior-preserving alternative described in `05-solution-engineering.md`
   §2, and open the RFC required for any adapter default/contract change.
2. **If** the P0 CPU/allocation profiles for Route Params/Deep Route show a reproducible,
   threshold-meeting share of cost in the matcher: proceed to the conditional router alternatives
   in `05-solution-engineering.md` §3.
3. **If** the P0 CPU/allocation profile for POST JSON shows a reproducible, threshold-meeting share
   of cost in buffering/parsing: proceed to the conditional body alternatives in
   `05-solution-engineering.md` §4.

**Order within Phase 1** follows the ranking in `04-root-cause-analysis.md` (adapter first, then
router, then body) **only for which profile to act on first if multiple clear**. If Phase 0's
evidence contradicts the ranking (e.g. profiling shows the router is the dominant cost and the
adapter timeout path is negligible), the roadmap follows the evidence, not the a priori ranking —
this ranking is a starting order for investigation effort, not a fixed conclusion.

**Effort:** Medium to Large depending on which hypothesis is confirmed (adapter: Medium, behavior-
preserving state machine touches a security-relevant timeout guarantee; router: Large if it
extends to a structural rewrite, Medium if it's a targeted allocation reduction; body: Small to
Medium). **Validation milestone:** each experiment independently passes the full matrix in
`06-validation-regression.md` before its RFC (if any) proceeds.

## 4. Phase 2 — Middleware/context/response investigation

**Gated on Phase 0/1 profiles surfacing one of these subsystems as a meaningful contributor** — not
scheduled unconditionally, because §4–§5 of `04-root-cause-analysis.md` explicitly found no current
evidence singling any of them out. If a P0 profile of Hello/Empty (which necessarily also exercises
context and response, even though it was captured to test the adapter hypothesis) shows a
disproportionate context- or response-construction frame, promote that finding into a dedicated
subsystem investigation using the same methodology as `03-subsystem-analysis/*`.

**Effort:** Unknown until triggered. **Validation milestone:** a dedicated finding exists with all
required decision fields, matching the standard used in this investigation's subsystem files.

## 5. Phase 3 — Static file serving benchmark

**Unconditional, but ordered last** because it is a prerequisite-adding phase, not an optimization
phase: add a static-file-serving scenario to `apps/benchmark` (varying file size, cached-vs-
uncached conditional requests, range requests) **before** any profiling or optimization work on
`03-subsystem-analysis/static-files.md` (F-STATIC-01) can begin, since that subsystem currently has
zero benchmark representation.

**Effort:** Small to Medium (benchmark-harness work, not source-code work). **Validation milestone:**
the new scenario runs cleanly alongside the existing 10 scenarios in a `standard` or `full` profile
and produces its own baseline numbers.

## 6. What this roadmap explicitly does not do

- It does not commit to implementing any specific optimization — every phase beyond P0 is
  conditional on evidence P0 produces.
- It does not forecast an expected aggregate improvement for the framework. Per this
  investigation's constraints, expected improvement for every unrun experiment is `Unknown`; the
  thresholds in `05-solution-engineering.md` §7 are go/no-go gates, not promised gains.
- It does not treat the historical, now-secondary report's conclusions (route-params matcher ≈4%
  CPU) as a shortcut past Phase 0 — those numbers are inadmissible for the reasons in
  `02-runtime-profiling.md` §3, and Phase 0 must re-establish current evidence rather than inherit
  the old conclusion.

## 7. Playbook cross-reference

This report satisfies Part 8 (§8.1 Prioritize Findings, §8.2 Estimate Effort, §8.3 Define
Implementation Phases, §8.4 Define Validation Milestones) of
`docs/playbooks/performance-review-playbook.md`. §8.5–§8.7 (final review summary, recommendations,
continuous improvement) are addressed at the investigation level in
[`00-executive-summary.md`](./00-executive-summary.md) and are not repeated here to avoid
duplication.

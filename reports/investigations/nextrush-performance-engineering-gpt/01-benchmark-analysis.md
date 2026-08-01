# Benchmark Analysis (Canonical)

**Playbook phase:** Part 2 — Benchmark Assessment & Investigation Planning. **Status: Completed.**
This is the canonical benchmark table and gap analysis referenced by every other report in this
investigation — do not copy these numbers elsewhere; link here.

Related: [`00-executive-summary.md`](./00-executive-summary.md) ·
[`appendix/benchmark-notes.md`](./appendix/benchmark-notes.md) (provenance/duplicate/`latest/`
handling) · [`04-root-cause-analysis.md`](./04-root-cause-analysis.md) (hypotheses derived from
these gaps).

## 1. Run identification

| Field | Value |
| --- | --- |
| Run ID | `2026-07-27T15-42-50` |
| Profile | `standard` (3 runs/configuration) |
| Load generator | wrk 4.2.0, 4 wrk threads, pipelining disabled |
| Runtime | Node v26.4.0 |
| Hardware | Intel i5-8300H, 8 logical cores |
| Duration | 30s per measurement |
| Connections tested | 1, 64, 256 |
| Ordering | Fixed order (not randomized) |
| CPU/client pinning | Off |
| Total timed measurements | 540 (6 frameworks × 10 scenarios × 3 connection levels × 3 repeats) |
| Benchmark commit SHA | **Absent** — not recorded by the artifact |

**Provenance caveat (Confirmed — absence of data):** the artifact does not record which NextRush
commit was benchmarked. The `feat/dev @ 5f77df1fcedcf62923ce08361e45e07bc9e9772c` baseline used for
source reading in this investigation is therefore a *current* baseline, not a *proven-benchmarked*
one. See [`appendix/benchmark-notes.md`](./appendix/benchmark-notes.md) for the full provenance
discussion, including the duplicate-directory and `latest/` handling.

**Warmup provenance inconsistency (Confirmed — internal contradiction in the artifact):** the load
table records framework warmup, per-scenario warmup, cooldown, pause, and GC tracing as `not
recorded`, while a later prose methodology paragraph in the same artifact states warmup occurred.
This investigation documents both statements rather than silently picking one — see
`appendix/benchmark-notes.md`. Framework version strings were captured at report-generation time,
not at run time, which is a related but distinct provenance gap.

## 2. Like-for-like score

| Framework | Score (like-for-like) |
| --- | --- |
| Raw Node.js | 139 / 144 |
| Fastify | 112 |
| Hono | 91 |
| **NextRush** | **90** |
| Koa | 45 |
| Express | 27 |

NextRush wins 5/10 probes at 1 connection (including the idiomatic-count probe), 0/10 at 64
connections, 0/10 at 256 connections. `middleware-stack` and `error-handling` are **idiomatic, not
like-for-like** (each framework uses its own mechanism) and are excluded from the like-for-like
score and from any cross-framework causal conclusion in this investigation.

## 3. NextRush at 256 connections (the scaling regime)

| Scenario | RPS | vs. raw Node | p99 |
| --- | --- | --- | --- |
| Hello | 28,917 | −18.1% | 11.15ms |
| JSON | 28,388 | −19.5% | 11.20ms |
| Route Params | 23,878 | −28.9% | 13.95ms |
| Query | 22,739 | −16.9% | 13.63ms |
| POST JSON | 17,909 | −28.9% | 16.36ms |
| Deep Route | 25,913 | −22.4% | 11.22ms |
| Middleware (idiomatic) | 22,217 | −25.5% | 14.20ms |
| Error (idiomatic) | 17,965 | −26.3% | 16.76ms |
| Large JSON | 19,198 | −11.3% | 15.90ms |
| Empty | 32,999 | −25.1% | 10.23ms |

## 4. NextRush at 64 connections (like-for-like scenarios only)

| Scenario | Gap vs. raw (approx.) |
| --- | --- |
| Hello | −16.6% |
| JSON | −18.6% |
| Route Params | −29.5% |
| Query | −18.0% |
| POST JSON | −29.5% |
| Deep Route | −22.4% |
| Large JSON | −10.0% |
| Empty | −25.4% |

**Confirmed pattern:** comparing §3 and §4, the gap is **already largely established by 64
connections** — it does not grow substantially from 64c to 256c for most scenarios (e.g. Hello
−16.6% → −18.1%; Route Params −29.5% → −28.9%, effectively flat; Empty −25.4% → −25.1%, flat). This
is evidence of a **scaling pattern that saturates by 64c**, not evidence of *which mechanism*
produces it — no CPU/allocation/event-loop data exists to name the mechanism (see
[`02-runtime-profiling.md`](./02-runtime-profiling.md)).

**Confirmed pattern:** Hello (−18.1%) and Empty (−25.1%) are both minimal-payload scenarios and show
similarly large gaps, while Large JSON narrows to −11.3%. This is consistent with a **fixed,
per-request, shared cost that occupies a larger fraction of the (small) total request cost when the
payload is small**, and a proportionally smaller fraction once the response body itself grows large.
This supports investigating shared per-request lifecycle overhead (adapter, router, context) ahead
of scenario-specific work like serialization — it does **not** identify a function or line.

## 5. NextRush at 1 connection (latency probe, high-variance regime)

At 1 connection, NextRush is **ahead** of raw Node.js in Hello, JSON, and (with high CV, a
near-tie) Query, and near-tie in Deep Route and Large JSON. NextRush is **behind** raw Node.js in
Route Params, POST JSON, and Empty. **This must be read as a latency probe under near-zero
contention, not a throughput signal** — its ranking direction does not need to agree with the 64c/256c
regime, and per the artifact, within-run CVs are not uniformly low at 1c the way they are at 256c.
Treating a 1c win as evidence NextRush "is faster" in general would misrepresent the artifact.

## 6. Within-run repeatability vs. cross-session trend

Within-run coefficients of variation (CV) are generally low at 256 connections, which supports
**repeatability inside this one benchmark session** — the 3 repeats per configuration agree with
each other reasonably well. This is **not** the same claim as a trend across independent sessions:
there is exactly one publishable session (`2026-07-27T15-42-50`); no second independent run exists
to compare against (the `2026-07-27T15-42-22` directory is a mislabeled duplicate of the same run,
not a second data point — see `appendix/benchmark-notes.md`).

## 7. Resource aggregates (suite-wide, not per-scenario)

| Framework | RSS peak / avg (MB) | CPU avg / peak (%) |
| --- | --- | --- |
| NextRush | 162.8 / 152.0 | 23.1 / 90 |
| Raw Node.js | 150.6 / 138.5 | 21.6 / 86.3 |
| Fastify | 159.6 / 145.5 | 22.2 / 89.2 |

**Evidence status: Confirmed as reported, but not attributable.** These are `/proc`-sampled
aggregates across the *entire* benchmark suite run (all scenarios, all connection levels), not
per-scenario measurements. They cannot be used to attribute cost to Hello vs. Route Params vs. POST
JSON, or to any specific subsystem. GC activity was not traced during this run; the absence of a GC
number in this table is an absence of instrumentation, not evidence that no GC occurred — this
distinction is load-bearing for [`02-runtime-profiling.md`](./02-runtime-profiling.md)'s gate.

## 8. What this benchmark data can and cannot support

**Can support (Confirmed, benchmark-data level):**
- The relative ranking and RPS/latency numbers as recorded, for this one session, under the stated
  configuration.
- The scaling-saturation pattern (§4 vs §3) and the payload-size pattern (§3, Hello/Empty vs. Large
  JSON) as *patterns in the data*.

**Cannot support (would require the blocked runtime-evidence gate — see `02-runtime-profiling.md`):**
- Which function, subsystem, or line of code causes any gap.
- Whether GC, event-loop delay, or allocation pressure contributes materially to any scenario.
- Whether the adapter's default handler-timeout machinery, the router's dynamic-match allocations,
  or the body-parser's listener/buffer machinery is the dominant, a minor, or a negligible
  contributor. All three remain **Hypothesis** pending profiling (`04-root-cause-analysis.md`).

## 9. Finding F-BENCH-01 — benchmark provenance prevents trend and code-to-result attribution

**Status/confidence:** Confirmed for the metadata and artifact limitations; runtime causes remain
Unknown.  
**Priority:** P0 — close before treating another benchmark as a regression baseline.  
**Current situation/evidence:** The only publishable session is run
`2026-07-27T15-42-50`. It has three repeats per configuration and generally low 256c CVs, but no
benchmark commit SHA, run-time package-version capture, or recorded warmup/cooldown/pause values.
Its load table and later methodology prose disagree about whether warmup occurred. Directory
`2026-07-27T15-42-22` contains the same embedded run ID and retained content, so it is a duplicate,
not an independent session; `latest/` is raw-Node-only, one-second, one-repeat, and explicitly
non-publishable.  
**Present-design benefits:** The standard profile still supplies 540 timed, 30-second measurements,
three within-session repeats, parity-checked scenarios, RPS/latency/error reporting, and useful
within-session CVs. Those properties make it a credible point-in-time signal on this machine.  
**Root cause:** The provenance gap is caused by the result schema/report pipeline not retaining the
exact source revision and all effective run controls. This finding does not identify the root cause
of NextRush's runtime deficit.  
**Runtime/performance impact:** The metadata defect does not itself consume request-path CPU. It
prevents code-to-result attribution, independent-session trend analysis, and confident regression
or improvement claims; optimizing against an unpinned result could target stale code or session
noise.  
**Recommendation:** Before the next measurement, capture commit SHA and dirty state, exact package
versions and lockfile identity, Node flags/environment, effective adapter options, every warmup and
pause control, framework order, pinning state, and runtime tool versions in the immutable result.
Give each physical session one canonical directory/run ID and collect multiple independent sessions
with randomized or counterbalanced framework order.  
**Alternatives:** Attach a manually signed run manifest, or identify an immutable container/image
plus source revision. Both improve provenance, but manual manifests drift and an image digest alone
does not record every effective benchmark option.  
**Trade-offs:** Stronger capture adds harness/report-schema work and independent sessions increase
machine time. Pinning and isolation improve repeatability but describe a more controlled environment
than some deployments.  
**Risks:** A partial fix can create false confidence if displayed metadata differs from effective
runtime values. Randomization without recording order can make diagnosis harder, and duplicate
artifact aliases can still be mistaken for independent evidence unless generation rejects them.  
**Expected improvement:** Runtime throughput improvement is Unknown and none is claimed; this is a
measurement-integrity change. Its expected outcome is attributable, reproducible evidence rather
than an RPS gain.  
**Migration difficulty:** Low to Medium — benchmark harness/result schema/report generator only; no
framework public API should change.  
**Validation:** Regenerate a result from a pinned clean revision and verify the immutable artifact
contains every effective field, its directory and embedded run ID agree, package versions are
captured at run time, duplicate IDs are rejected, and at least two independently executed sessions
can be compared without relying on post-hoc workspace state.

## 10. Playbook cross-reference

This report satisfies Part 2 (§2.1 Review Benchmark Results, §2.2 Identify Performance Gaps, §2.3
Prioritize Investigation Areas) of `docs/playbooks/performance-review-playbook.md`. Investigation
questions and scope definition (§2.4–§2.6) are carried forward into
[`04-root-cause-analysis.md`](./04-root-cause-analysis.md) and the subsystem files under
[`03-subsystem-analysis/`](./03-subsystem-analysis/).

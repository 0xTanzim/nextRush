# performance-gate

## Purpose

NextRush's CI performance-regression defense and its benchmark methodology: a fast, low-sample
"smoke" gate that runs on performance-sensitive PRs without becoming a merge bottleneck (distinct
from the slow multi-run profile used for publishable figures), plus a reproducible, fairness-
validated benchmark that measures the class/DI path's registration/boot cost at multiple
controller-count scales and its per-request overhead relative to the functional path.

## Requirements

### Requirement: The per-PR performance gate is fast enough to run routinely
The CI performance gate SHALL use a fast, low-sample "smoke" benchmark profile distinct from the
slower, multi-run profile used for publishable figures, so it can run on relevant PRs without
becoming a merge bottleneck.

#### Scenario: The CI gate completes within a reasonable time budget
- **WHEN** the performance-gate job runs on a PR
- **THEN** it completes using the smoke profile, not the full multi-run publishable profile

#### Scenario: The gate's tolerance accounts for CI environment noise
- **WHEN** the gate's regression tolerance is configured
- **THEN** it is set loosely enough to avoid failing on normal CI runner jitter, while still
  catching a gross regression, with the chosen value documented alongside the CI job

### Requirement: A reproducible benchmark measures class-path overhead against the functional path
A benchmark SHALL exist that measures and publishes: (a) registration/boot cost of the class/DI
path at multiple controller-count scales, and (b) per-request overhead of the class path relative
to the functional path, using the existing benchmark harness's fairness-validated methodology.

#### Scenario: The class-path server passes the harness's fairness check
- **WHEN** the class-path benchmark server and the existing functional benchmark server are
  compared via the harness's fairness validation (byte-identical response bodies/statuses)
- **THEN** both pass, confirming the comparison is apples-to-apples

#### Scenario: Registration cost is measured at multiple controller-count scales
- **WHEN** the class-path registration-cost benchmark runs
- **THEN** it reports boot time at more than one controller count (e.g. a small and a large N),
  revealing whether registration cost scales linearly or worse

#### Scenario: Published numbers include statistical confidence
- **WHEN** the class-path benchmark's numbers are published
- **THEN** they are produced via the harness's multi-run ("standard" or "full") profile and
  reported with mean ± stddev, per this repo's existing benchmark-publishing convention

### Requirement: CI fails a pull request on a significant performance regression
CI SHALL run the existing regression-checker tool against a stored baseline for
performance-sensitive changes, failing the pull request when a scenario regresses beyond the
configured tolerance.

#### Scenario: A deliberate regression fails the gate
- **WHEN** a pull request introduces a change that measurably slows a benchmarked scenario
  beyond the configured tolerance
- **THEN** the CI performance-gate job fails, using the existing `check-regression.js` tool

#### Scenario: A non-regressing change passes the gate
- **WHEN** a pull request's benchmark run shows no scenario regressing beyond tolerance
- **THEN** the CI performance-gate job passes

#### Scenario: The gate is scoped to performance-sensitive paths
- **WHEN** a pull request touches only paths unrelated to performance-sensitive code (per the
  scoping decided in design.md's Non-Goals)
- **THEN** the performance-gate job does not run, avoiding unnecessary CI cost

### Requirement: The param match path has a deterministic transient-allocation profiler

The benchmark harness SHALL provide a deterministic profiler that measures the **total** (transient
included) per-match allocation of the **real, built** `@nextrush/router` matcher — not net-retained
heap — so the allocation the net-retained micro-bench cannot see is measurable. It SHALL report a
static-hit baseline, a depth-2 param match, and a depth-8 deep-param match, so per-segment scaling
is visible, and SHALL be reproducible (low variance).

#### Scenario: Gross per-match allocation is measured for static, depth-2, and depth-8
- **WHEN** the param-match allocation profiler runs against the built matcher
- **THEN** it reports total bytes-per-match for a static hit, `/users/:id`, and a deep 3-param route, each as a mean over multiple runs

#### Scenario: The measurement captures transient garbage
- **WHEN** the profiler measures a param match that allocates objects the caller discards (frames, bind arrays, the params object)
- **THEN** those allocations are counted (the young generation is sized so no scavenge fires during the measured loop, making the `heapUsed` delta the total allocated), unlike the net-retained micro-bench

#### Scenario: The measurement is deterministic
- **WHEN** the profiler is run repeatedly
- **THEN** its per-match figures are stable across runs (low coefficient of variation), and a run in which GC fired during the measured window is rejected rather than reported

### Requirement: The route-params gap is attributed to call sites and to CPU

The route-params gap SHALL be attributed to concrete cost sources using allocation sampling
(`--heap-prof`) and CPU sampling (`--cpu-prof`) of the real matcher under the route-params load, so
the diagnosis distinguishes per-match allocation from per-segment `Map.get`/walk CPU — not
allocation alone. The allocation-sampling and gross-allocation methods SHALL agree on the dominant
allocation term before it is reported as the culprit.

#### Scenario: Allocation is attributed to specific call sites
- **WHEN** the matcher is profiled with allocation sampling under the route-params load
- **THEN** the per-match bytes are attributed to specific sources (e.g. walk-frame objects, the bind arrays, the params materialization, decode/segment slices), and the dominant term is confirmed by the deterministic gross-allocation profiler as well

#### Scenario: CPU is attributed, separating allocation from Map.get walk cost
- **WHEN** the matcher is CPU-profiled under the route-params load
- **THEN** the gap is split into allocation/GC pressure versus per-segment `Map.get`/walk CPU versus decode/normalize, so a CPU-dominated gap (which favors a data-structure change) is distinguished from an allocation-dominated one

### Requirement: A defensible route-params RPS number is established

A route-params RPS comparison (NextRush vs Fastify vs raw Node) SHALL be produced with a multi-run
and/or CPU-pinned method, so the gap is not asserted from a single unpinned run. The result SHALL
be labeled with its confidence level and SHALL NOT be presented as the publishable 5-run
CPU-pinned figure unless produced that way.

#### Scenario: The route-params gap is measured with reduced noise
- **WHEN** the route-params scenario is benchmarked
- **THEN** it uses a multi-run profile and/or a pinned run (not a single unpinned `quick` run), and reports the NextRush-vs-Fastify delta with its variance

#### Scenario: The confidence level is stated honestly
- **WHEN** the route-params number is recorded
- **THEN** it is labeled as directional/defensible or publishable according to how it was produced, never overstated

### Requirement: A decision artifact gates any route-params optimization

A decision report SHALL exist that names the dominant route-params cost with cited profile
evidence, gives the defensible RPS delta, recommends the follow-up path (segment-trie
allocation/CPU trim vs advancing the radix router), and settles the deferred HP-11 keep/park
verdict — and its durable conclusions SHALL be recorded into the radix RFC (T017). No route-params
matcher optimization SHALL be committed before this gate is cleared.

#### Scenario: The report names the dominant cost with evidence
- **WHEN** the decision report is complete
- **THEN** it states which cost term dominates (allocation term, or CPU/`Map.get`) with the profile data supporting it, not a hypothesis

#### Scenario: The report recommends trim vs radix on the evidence
- **WHEN** the dominant cost is identified
- **THEN** the report recommends a segment-trie trim if the cost is per-match allocation or shallow-path CPU a trim can cut, or advancing radix (RFC 015) if the cost is per-segment node-chasing only prefix-compression fixes — with the reasoning stated

#### Scenario: The HP-11 keep/park verdict is settled
- **WHEN** the report addresses HP-11
- **THEN** it records whether HP-11's allocation story was net-positive, neutral, or a regression on real evidence (its safety properties are kept regardless), resolving the deferred `router-match-path-allocation-trim` decision, and this is written into RFC 015 §7/T017

#### Scenario: The gate blocks a blind optimization
- **WHEN** a route-params matcher optimization is proposed
- **THEN** it must cite this report's diagnosis as its justification, so no matcher rewrite ships on structural reasoning alone

### Requirement: Dev-quick benchmarking can isolate server CPU from client CPU on one machine

The benchmark harness SHALL provide a core-pinned (`taskset`) quick-benchmark path that assigns the
load generator and the target server to disjoint CPU core sets on the same machine, so a
concurrency sweep is not confounded by the client and server competing for the same cores. This
path SHALL remain dev-quick (single run, seconds to low minutes) and SHALL NOT be presented as a
substitute for the pinned multi-run `full` profile on dedicated hardware.

#### Scenario: Client and server are pinned to disjoint cores
- **WHEN** the core-pinned quick benchmark runs
- **THEN** the load generator (`wrk`) and the target server process are each pinned via `taskset` to non-overlapping CPU core sets

#### Scenario: The pinned path stays dev-quick
- **WHEN** the core-pinned benchmark is run
- **THEN** it completes in a single run within a comparable time budget to the existing `bench:compare:quick` (not the multi-run, multi-minute `full` profile)

#### Scenario: Pinned results are not presented as publishable
- **WHEN** a result from the core-pinned quick path is reported
- **THEN** it is labeled directional/dev-only, distinct from the publishable 5-run CPU-pinned `full`-profile figure

### Requirement: The accept-queue theory is tested with a falsifiable re-test, not assumed

After a benchmark run implicates the TCP accept queue as a suspected bottleneck (throughput
collapse with rising idle time at high concurrency), the harness's re-test procedure SHALL: (a)
apply the backlog fix under test, (b) re-run the same concurrency sweep that showed the collapse,
and (c) report whether the collapse point moved. Both a confirming and a refuting result SHALL be
recorded as a complete, valid finding — the procedure MUST NOT be used only when it is expected to
confirm the hypothesis.

#### Scenario: A confirming result is recorded
- **WHEN** the same concurrency sweep is re-run after the backlog fix and the previous collapse point no longer reproduces at the same concurrency
- **THEN** the finding is recorded as confirming the accept-queue theory, with the new observed ceiling

#### Scenario: A refuting result is recorded
- **WHEN** the same concurrency sweep is re-run after the backlog fix and the collapse still occurs at the same concurrency
- **THEN** the finding is recorded as refuting (or not supporting) the accept-queue theory as the dominant cause, and the investigation is redirected rather than repeated unchanged

### Requirement: OS-level queue evidence replaces pattern-based inference

A suspected accept-queue bottleneck SHALL be confirmed or refuted with a direct operating-system
observation of the listening socket's queue state during a live load run (e.g. `ss -lt` or
equivalent), not solely inferred from the throughput/idle-time pattern.

#### Scenario: A growing queue during the run is captured
- **WHEN** a queue-suspected run is repeated with OS-level queue-state sampling active
- **THEN** the sampled queue depth on the listening socket is recorded for the duration of the run, showing whether it grows, saturates, or stays near empty

#### Scenario: An empty queue during a collapse redirects the investigation
- **WHEN** the sampled queue stays near empty throughout a run that still shows the throughput collapse
- **THEN** the accept queue is ruled out as the dominant cause for that run, and the finding records that some other factor (e.g. client/loopback contention) is the more likely explanation

## ADDED Requirements

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

## Why

The second hot-path review (`report/performance-review.md`, finding **NF-3**, the report's sole
**P0-validation** item) established that route-parameter matching is simultaneously:

- **NextRush's widest real competitive gap** — in the latest run (`2026-07-18T13-14-58`, post
  dispatch-de-async + lazy-state) Route Params is **26,315 RPS vs Fastify's 30,551 (−13.9%)**,
  the widest gap in the suite, while Hello World has closed to a tie. The gap is real and it
  persisted after every shipped optimization.
- **The heaviest allocator** — the team's own micro-bench reports a param match at **~339.87 B/op
  vs ~64.24 B/op for a static hit (5.3×)**.
- **Never actually profiled or RPS-tested.** Worse, the shipped `router-match-path-allocation-trim`
  (HP-11/12/13) recorded param allocation going **169.4 → 339.87 B/op** — a *doubling* — which its
  own `NOTES.md` **discounted as "unmeasurable transient garbage"** the net-retained micro-bench
  cannot see, and the team's note further states GC-churn proxies are "defeated by V8 escape
  analysis." The **Route-Params RPS A/B was deferred to CPU-pinned hardware that never
  materialized** — which is exactly the **T017 gate** the radix RFC
  (`docs/RFC/runtime-adapters/015-router-radix.md` §3/§7) defers to, and the same measurement the
  first report (`report/core-hot-path-performance-review.md`) says decides whether **HP-11 is kept
  or parked**.

So the framework's single largest remaining gap has been optimized twice on **structural reasoning
alone**, with no tool that can actually see the transient garbage a matcher produces, and no
defensible RPS number. A third round of "optimize the matcher" would repeat that mistake. Per
`AGENTS.md` §11 ("measure before optimizing") and §16 ("every abstraction must justify its
existence"), the correct next step is **measurement, not a rewrite**: build the profiler that has
been missing, produce a decision-quality diagnosis, and let evidence choose the fix. The audit's
own isolated `WalkFrame` experiment was **inconclusive** (V8 escape analysis elided the frames in a
small loop), so the culprit behind the 340 B/op is genuinely unknown and must be measured on the
real matcher, not asserted.

## What Changes

This is a **measurement + decision-gate** change. It adds no matcher code and changes no observable
behavior; it produces the evidence that unblocks (and correctly scopes) the follow-up fix.

- **A transient-allocation profiler for the real param matcher** (`apps/benchmark`): a deterministic
  *gross*-allocation micro-bench that runs the built `@nextrush/router` matcher N times with the
  young generation enlarged (`--max-semi-space-size`) so no scavenge fires mid-loop — making the
  `heapUsed` delta the **total** bytes allocated per match, transient included. This is precisely
  the measurement the net-retained bench (per the team's `NOTES.md`) could not make. Measured for
  **depth-2** (`/users/:id`) and **depth-8** (`/api/v1/orgs/:o/teams/:t/members/:m`) plus a static
  baseline, so depth-scaling is visible.
- **Per-call-site allocation attribution** via `node --heap-prof` (allocation sampling by stack) on
  the matcher under the route-params `wrk` load, to name which term dominates: the per-node
  `WalkFrame` objects + frame-stack array, the `bindNames`/`bindValues` arrays, the per-match
  null-prototype `params` object, or the `decodeParam`/`segmentAt` slices.
- **A CPU profile** (`node --cpu-prof`) of the same load, to separate allocation cost from
  per-segment `Map.get` chasing (the segment-trie-vs-radix constant factor the report and RFC 015
  both flag) — so the diagnosis isn't allocation-only.
- **A defensible route-params RPS number:** a `bench:standard` (3-run) and/or `taskset`-pinned
  `bench:compare:quick` A/B (NextRush vs Fastify vs raw Node), so "−13.9%" stops being single-run,
  unpinned noise. (The fully-publishable `--profile full`, 5-run CPU-pinned, remains the one global
  gate on clean hardware.)
- **A decision report** (`report/route-params-profile.md`) that: (a) states the dominant cost term
  with profile evidence; (b) gives the defensible RPS delta; (c) **recommends the follow-up path** —
  a segment-trie allocation trim (e.g. a bounded backtrack-point stack instead of a frame-per-node,
  reused bind arrays, or fewer `Map.get`s) **or** advancing the radix router (RFC 015); and (d)
  **settles the deferred HP-11 keep/park verdict** on real evidence.
- **BREAKING**: None. No package code, public API, `Context`, or matcher-behavior change — the
  matcher differential golden is untouched. This change only adds harness scripts + a report.

## Capabilities

### New Capabilities

- None. This extends the existing benchmark methodology with a route-params allocation/CPU profiler
  and a decision-gate artifact — a natural addition to what `performance-gate` already owns.

### Modified Capabilities

- **`performance-gate`** — ADD the requirement that the param match path has a **deterministic
  transient-allocation profiler** (gross allocation of the real matcher at multiple depths, capable
  of seeing transient garbage the net-retained bench cannot), a **call-site + CPU attribution** of
  the route-params gap, a **defensible (multi-run / pinned) route-params number**, and a **decision
  artifact** that names the dominant cost and recommends trim-vs-radix — the evidence gate any
  route-params optimization MUST clear before it is committed.

## Impact

- **Affected code:** `apps/benchmark/scripts/` — a new `param-match-alloc.js` (+ child) gross-alloc
  profiler and its `bench:alloc:param-match` script; profiling is otherwise via Node flags
  (`--heap-prof`, `--cpu-prof`) during implementation. No `packages/**` change.
- **New artifact:** `report/route-params-profile.md` (the decision report).
- **Docs/RFC:** the findings + HP-11 verdict + trim-vs-radix recommendation are recorded back into
  `docs/RFC/runtime-adapters/015-router-radix.md` (§7/T017) — the durable home — before this change
  is archived.
- **Public API / types / dependencies:** none.
- **Cross-adapter:** none (measurement of the shared router; no behavior change).

### Explicit non-goals (deferred, decided by this change's findings)

- **The matcher rewrite itself** (segment-trie allocation trim) — the gated follow-up; not specced
  until this profile names the dominant term. Committing it now would repeat the HP-11 "optimize on
  a guess" pattern this change exists to stop.
- **Building `@nextrush/router-radix`** — remains RFC-015-gated on a confirmed driver + T017; this
  change *produces* the T017 evidence but does not itself green-light the package.
- **The fully-publishable `--profile full` CPU-pinned A/B** — best-effort defensible number here
  (standard/pinned-quick); the 5-run clean-hardware A/B stays the one global deferred gate.

### Durable decision for docs/RFC/

This change is measurement-only and **not** RFC-gated, but it *executes* RFC 015's T017 gate. Its
durable output — what dominates the param-path cost, the HP-11 keep/park verdict, and the
trim-vs-radix recommendation — MUST be written into RFC 015 (§7 / the T017 note) before archiving,
so the decision that steers the follow-up lives in the curated RFC set, not only in a prunable
change.

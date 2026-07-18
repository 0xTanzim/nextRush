## Context

Route Params is NextRush's widest real gap (latest run **−13.9% vs Fastify**) and heaviest
allocator (**~340 B/op vs ~64 static**), yet it has been optimized twice (HP-11/12/13) with **no
tool that can see what it allocates**. The team's own `router-match-path-allocation-trim/NOTES.md`
documents the exact instrument gap:

- The caller-side (black-box) micro-bench measures **net-retained** heap — it is blind to the
  transient garbage a matcher produces (a matched `RouteMatch`/`params` is discarded by the caller,
  so it never shows up as retained).
- A minor-GC count/time proxy is **"defeated by V8 escape analysis and heuristic GC scheduling."**

So the recorded param figure (169.4 → 339.87 B/op, a doubling) is neither trustworthy nor
actionable, the HP-11 keep/park verdict is unresolved, and my own isolated `WalkFrame` experiment
was **inconclusive** (escape analysis elided the frames in a toy loop). This change builds the
missing instruments and produces a diagnosis + decision — it does **not** touch the matcher.

## Goals / Non-Goals

**Goals:** (1) a deterministic profiler that actually measures the real matcher's *total* per-match
allocation (transient included) at depth-2 and depth-8; (2) call-site + CPU attribution of the
route-params gap; (3) a defensible (multi-run / pinned) route-params RPS number; (4) a decision
report that names the dominant cost, recommends trim-vs-radix, and settles the HP-11 verdict.

**Non-Goals:** any matcher/`router` code change; building the radix package (RFC-015-gated); the
fully-publishable 5-run CPU-pinned A/B (clean-hardware only). The matcher differential golden and
all router behavior are untouched.

## Decisions

### D1 — Gross-allocation profiling: enlarge the young gen so no GC fires mid-loop

The net-retained bench is the wrong tool (see Context). Instead, measure **gross** allocation: run
the **real built matcher** (`@nextrush/router` dist, imported by a child exactly like the existing
`router-match-alloc-child.js`) `N` times with `node --max-semi-space-size=<large>` so **no
scavenge fires during the measured loop** — then `heapUsed_after − heapUsed_before` divided by `N`
is the **total bytes allocated per match, transient included**. Calibrate `N` and the semi-space
size with a `--trace-gc` run confirming zero GC during the measured window (if GC fires, the number
under-counts and the run is rejected). Measure three cases against each other:

- static hit (`/`) — the ~64 B/op floor,
- depth-2 param (`/users/:id`),
- depth-8 deep param (`/api/v1/orgs/:o/teams/:t/members/:m`),

so the per-segment scaling of frames/bind-arrays/`Map.get` is visible. This is deterministic
(target cv < 1%), reproducible, and — unlike the net-retained bench — sees the transient garbage.

### D2 — Call-site attribution via `--heap-prof` on the real matcher

Run `node --heap-prof` (V8 allocation sampling — samples *all* allocations by stack, including
collected ones) against the route-params path under sustained load, and read the `.heapprofile` to
attribute the bytes to concrete call sites: `matchNodeIndexed` `WalkFrame` pushes, the frame-stack
array, `bindNames`/`bindValues`, the `Object.create(null)` params materialization, and
`decodeParam`/`segmentAt` slices. **Two independent methods (D1 gross-alloc + D2 sampling) must
agree on the dominant term** before it is reported as the culprit — guarding against either tool's
artifacts.

### D3 — CPU attribution via `--cpu-prof`, so the diagnosis is not allocation-only

The report and RFC 015 both flag the segment trie's **per-segment `Map.get`** as a constant-factor
suspect independent of allocation. Run `node --cpu-prof` under the route-params `wrk` load and read
the flamegraph to split the gap into (a) allocation/GC pressure vs (b) `Map.get`/walk CPU vs (c)
`decodeParam`/normalize. A finding that the gap is **CPU, not allocation** is a valid, important
outcome — it would point at radix (fewer nodes on shared prefixes) over an allocation trim.

### D4 — A defensible RPS number, honestly bounded

Establish route-params RPS with `bench:standard` (3 runs, mean ± stddev) and/or a `taskset`-pinned
`bench:compare:quick`, on an otherwise-idle machine, for NextRush / Fastify / raw Node. This is
**directionally defensible** — far better than the current single unpinned run — but it is **not**
the publishable figure; the 5-run CPU-pinned `--profile full` remains the one global gate on clean
hardware (README §Performance). The report states which it is, never overclaiming.

### D5 — The decision gate (falsifiable done-condition)

This change is **done** only when the report answers all four, each with cited evidence — never a
vibe:
1. **Dominant term named** — e.g. "frame-stack + bind arrays account for X% of the Y B/op (D1+D2
   agree)", or "the gap is Z% CPU in `Map.get`, not allocation (D3)".
2. **Defensible RPS delta** — the multi-run/pinned NextRush-vs-Fastify route-params number (D4).
3. **Trim-vs-radix recommendation** — decision rule: recommend a **segment-trie allocation/CPU
   trim** if the dominant cost is per-match allocation OR shallow-path `Map.get` that a trim can
   cut without changing the data structure; recommend **advancing radix (RFC 015)** if the cost is
   dominated by per-segment node-chasing that only prefix-compression fixes, or if a trim is
   projected to close < a meaningful fraction of the −13.9% gap.
4. **HP-11 keep/park verdict** — on the evidence: keep (its DoS/pollution/deopt-safety are
   mandatory regardless), but state whether its *allocation* story was net-positive, neutral, or a
   regression, resolving the deferred `router-match-path-allocation-trim` D6 gate and the first
   report's HP-11 park clause.

### D6 — No matcher change; measurement only

No file under `packages/**` is edited. The router differential golden and all suites are run only
to confirm the profiler harness didn't perturb them (it imports the dist read-only). The follow-up
change (trim or radix) is where matcher code changes, gated on D5.

## Risks / Trade-offs

- **[Risk] Escape analysis elides transient allocation in the profiler too**, hiding the real cost
  (as it did in my toy loop). → **Mitigation:** profile the **real, warmed, built** matcher (a
  large function with `Map.get`s + `decodeParam` that resists scalar replacement), not a
  reconstruction; cross-check D1 (gross heapUsed delta) against D2 (`--heap-prof` sampling) — if
  they disagree, escape analysis is in play and that itself is the finding (the transient cost is
  smaller than 340 B/op suggests, and the gap is elsewhere — pivot to D3/CPU).
- **[Risk] GC fires during the gross-alloc loop**, under-counting. → **Mitigation:** `--trace-gc`
  calibration asserting zero GC in the measured window; reject and re-tune otherwise.
- **[Risk] The pinned RPS number is still not fully publishable** on this hardware. → **Accepted &
  labeled:** it is directional-defensible (multi-run/pinned), explicitly not the 5-run clean-host
  figure; the report says so.
- **[Risk] The profile shows the gap is NOT what NF-3 hypothesized** (e.g. mostly CPU, or the
  340 B/op barely affects RPS). → **This is a feature, not a failure:** it is exactly why we
  profile instead of rewriting blind; D5's recommendation follows the evidence wherever it leads,
  including "the trim isn't worth it — the gap is structural, go radix" or "park HP-11."
- **[Trade-off] A measurement-only change ships no perf gain.** → Correct and intended: it converts
  the largest gap from "optimized on a guess, twice" to "diagnosed", which is the prerequisite for
  a *real* win and the direct remedy for NF-3 being a validation gap.

## Migration Plan

No runtime migration, no consumer-facing change. Ship the profiler script + the decision report,
fold the durable findings into RFC 015 §7/T017, then open the follow-up (trim or radix) the report
recommends.

## Open Questions

- Does `--heap-prof` sampling resolution suffice to separate `WalkFrame` from bind-array
  allocation, or is a targeted instrumented count needed for the tie-break? Resolve during
  implementation from the first sampling run.
- Is `taskset`-pinned `quick` stable enough to call the RPS delta, or is `bench:standard` (3-run)
  required? Default: run both, report the tighter.

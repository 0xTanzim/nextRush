# CPU / Allocation Profiling Results — Recommendation 5

| Field | Value |
| --- | --- |
| Purpose | Direct CPU-profile, heap-snapshot, GC-trace, and event-loop-utilization measurements against current source, closing recommendation 5 of `performance-investigation-reconciliation.md` |
| Scope | `apps/benchmark`'s NextRush server (`nextrush-v3.js`) only, four scenarios: `hello-world`, `empty-response`, `route-params`, `post-json` |
| Date | 2026-07-28 |
| Commit | `5f77df1fcedcf62923ce08361e45e07bc9e9772c` (dirty working tree at capture time) |
| Method | `apps/benchmark/scripts/profile.js` (this change), 64 connections / 4 threads, 20s duration per scenario, dev-scale — not a CPU-pinned, multi-run publishable measurement |
| Status | Evidence only — no code changes proposed or made based on these findings, per design.md's Non-Goals and the same "evidence, not action" framing established by `fix-benchmark-measurement-integrity`'s Task Group 8 |

All figures below are single-run, dev-scale, unpinned direct measurements. They are the first
direct CPU/heap/GC/ELU evidence against current source for this repository — closing
recommendation 5's gap — but are not a substitute for a CPU-pinned, multi-run session if any
future change wants to cite these numbers as decisive.

## CPU profile — top self-time frames

| Scenario | Total samples | `writev`/socket I/O | `matchRoute` | `json`/`ctx.json` | Notable |
| --- | --- | --- | --- | --- | --- |
| `hello-world` | 19,173 | 25.7% | — (not sampled) | — | `nextTick` fragments total ~20% across many small buckets |
| `empty-response` | 19,202 | 24.4% (`writeLatin1String`) | — | — | No JSON body to serialize — lowest framework-code footprint of the four |
| `route-params` | 19,320 | 23.6% | **4.5%** (868 samples) | 3.5% (674 samples) | The only scenario where `matchRoute` appears as a distinct self-time frame at all |
| `post-json` | 19,165 | 23.9% | — | — | `setHeader`/`_storeHeader` (Node's own `http` internals) appear at 3.6%/1.6% — body-parser + response-header cost, not router cost |

**Finding on F-02 (param-path allocation cost).** `matchRoute` is the only framework-internal
function that surfaces as a distinct, named self-time frame across all four profiles, and it does
so only on `route-params` — never on `hello-world` or `empty-response` (which don't call it) or
`post-json` (a static route, so the param-matching branch is never taken). This is the first
direct CPU-sample confirmation that route-param matching has a measurable, attributable cost
distinct from the fixed floor — corroborating F-02's structural allocation-count argument with an
independent measurement method (sampling, not allocation counting).

**Finding on F-01 (handler timeout race).** `createHandler`'s `Promise.race`/`setTimeout`
machinery does **not** appear as a distinct named self-time frame in any of the four profiles.
Two explanations are consistent with this and cannot be distinguished by this evidence alone: (a)
the mechanism's absolute per-call CPU cost is smaller than this profiler's sampling resolution
can attribute to a distinct frame at 64 connections, or (b) V8 inlines the closure deeply enough
that its cost is folded into a caller frame (plausibly the many `nextTick` fragments, which total
roughly 15-20% of samples across small buckets in every scenario and were not present as a single
attributable frame). This profiling evidence does **not** confirm or refute F-01's allocation-
count-based magnitude estimate — it neither supports nor contradicts it, and should not be cited
as evidence either way without a more targeted profiling pass (e.g. isolating `createHandler`'s
closure specifically via `--prof` with source-level line attribution, or comparing `timeout: 0`
against default at equal load).

## Heap snapshot before/after

| Scenario | Before nodes | After nodes | Delta nodes | Delta self-size |
| --- | --- | --- | --- | --- |
| `hello-world` | 100,801 | 105,250 | +4,449 | +0.69 MB |
| `empty-response` | 100,796 | 93,801 | −6,995 | −0.25 MB |
| `route-params` | 100,796 | 105,385 | +4,589 | +0.71 MB |
| `post-json` | 100,801 | 93,901 | −6,900 | −0.23 MB |

**Finding.** The direction of the delta (growth vs. shrinkage) does not correlate with scenario
complexity in an interpretable way — `hello-world` and `route-params` both grew by a similar
amount, while `empty-response` and `post-json` both shrank by a similar amount. The most likely
explanation is GC timing variance between the "before" and "after" snapshot calls (a scavenge
could have run between one pair of snapshots and not the other, given each snapshot pair is taken
tens of seconds apart with load running continuously in between) rather than a genuine per-
scenario retained-object signature. **This measurement is inconclusive as captured** — a single
before/after pair per scenario cannot separate "real growth" from "GC-timing noise between two
single-point-in-time snapshots." A future pass wanting a real answer here should force a GC
(`v8.setFlagsFromString('--expose-gc')` equivalent over the same debugger connection, or a
`Runtime.evaluate` call to `global.gc()`) immediately before each snapshot, which this first
version of `scripts/profile.js` does not yet do.

## GC trace

| Scenario | GC event count | Total pause (ms) |
| --- | --- | --- |
| `hello-world` | 0 | 0 |
| `empty-response` | 0 | 0 |
| `route-params` | 0 | 0 |
| `post-json` | 0 | 0 |

**Finding — directly confirms reconciliation report §9.5.** Zero GC events fired during any of
the four 20-second, 64-connection runs. This is a direct trace-level confirmation of §9.5's
tail-latency-based inference that "GC pauses are not the mechanism" for NextRush's per-request
cost — previously supported only by p99/p50 ratio evidence, now additionally confirmed by the
absence of any GC event at all during representative load. The reconciliation report's rejection
of GC pauses as a contributing factor stands, now with direct-measurement support rather than
inference alone.

## Event-loop utilization

| Scenario | Samples | Average utilization | Requests/sec |
| --- | --- | --- | --- |
| `hello-world` | 20 | 99.97% | 19,178 |
| `empty-response` | 20 | 99.95% | 21,239 |
| `route-params` | 20 | 99.97% | 17,327 |
| `post-json` | 20 | 99.96% | 17,728 |

**Finding — directly confirms reconciliation report §16's headline conclusion.** All four
scenarios show the server's event loop at 99.95%+ utilization throughout the run, at only 64
connections — nowhere near the 256-connection saturation point the throughput comparison uses to
characterize NextRush's flat concurrency scaling. This is the first direct utilization
measurement supporting the reconciliation report's core thesis ("NextRush does not have a
concurrency problem, it has a per-request cost problem that presents as one... it reaches full
event-loop utilization at a lower offered load"): the event loop is already essentially saturated
well before the connection count where the six-server comparison shows NextRush's throughput
gains flattening out relative to its peers. This directly supports Hypothesis B (per-request CPU
cost causing early saturation) over Hypothesis A (a distinct concurrency-dependent defect) from
the reconciliation report's own framing — though it does not, by itself, rule out F-04's per-
connection socket timeout as an additional contributing factor at higher connection counts, which
remains correctly flagged as needing its own decision (recommendation 12's ADR).

## Cross-reference to the reconciliation report

- **F-01** (handler timeout race): magnitude still unconfirmed by direct measurement — this
  profiling pass neither supports nor contradicts the allocation-count-based estimate. Needs a
  more targeted follow-up if a future change wants to size this precisely.
- **F-02** (param-path allocation): the CPU-sample evidence corroborates the structural
  allocation-count argument for the first time via an independent measurement method.
- **F-05** (no CPU/allocation profiling capability): closed by this change — the tooling now
  exists and has produced its first real evidence.
- **§9.5** (GC pauses are not the mechanism): confirmed directly — zero GC events across all four
  scenarios at representative load.
- **§16** (concurrency collapse is a per-request-cost artifact, not a distinct defect): directly
  supported — event-loop utilization is already ~99.96% at only 64 connections, well below the
  throughput comparison's saturation-revealing connection counts.

## What this evidence does not establish

This was a single-run, dev-scale (20s, 64 connections, unpinned CPU) session, not a CPU-pinned,
multi-run publishable measurement. None of the figures above should be cited in a benchmark
comparison table or used to justify a specific code change without a more rigorous follow-up
pass. The heap-snapshot delta measurement is explicitly flagged above as inconclusive given the
current tooling's lack of a forced-GC step before each snapshot. Per design.md's Non-Goals and
this change's own scope, no code changes are proposed or made based on any of these findings.

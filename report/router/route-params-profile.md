# Route-Params Profile & Decision Gate

> **Status:** decided (measurement-only). **Change:** `router-param-path-profile-gate`.
> **Scope:** no `packages/**` change — this report profiles the shipped matcher and decides the
> follow-up (trim vs radix) and the deferred HP-11 verdict on evidence. It is the gate any
> route-params matcher optimization MUST cite before it is committed (spec `performance-gate`).

This closes `report/performance-review.md` **NF-3** — the report's sole **P0-validation** item:
route-parameter matching was NextRush's widest competitive gap and heaviest allocator, yet had been
optimized twice (HP-11/12/13) on structural reasoning alone, with no instrument that can see what a
matcher actually allocates and no defensible RPS number. This report supplies both.

---

## 1. Executive summary

The evidence overturns the NF-3 hypothesis in the most useful way: **route-parameter matching is
neither allocation-bound nor the dominant cost of a route-params request.** Three independent
measurements agree:

- The param match *can* allocate ~442 B/op **gross** (transient included) in a micro-loop that
  forces the result to escape — but **~98% of that is eliminated by V8 escape analysis** the moment
  the result is not retained (discard floor ~3–9 B/op), and in the **real server under load the
  matcher's allocation is ~0.3% of heap traffic** and its transient frame/bind arrays never sample
  at all.
- On **CPU**, the whole matcher is **~4%** of a route-params request; GC is ~1%. The request is
  dominated by the response write (`writev` ~33%) and JSON serialization (~4.8%) — both shared with
  every framework.
- The gap itself, measured **pinned over 5 runs**, is **−7.4% vs Fastify** — not the −13.9% the
  single unpinned run reported. **Roughly half the headline gap was measurement noise.**

**Decision:** do **not** commit a segment-trie allocation trim (it targets ~1% of cost that is
already escape-elided), and do **not** green-light the radix rewrite on route-params grounds (it
targets only the ~1.5% `matchNodeIndexed` `Map.get` walk — far less than the remaining gap). **HP-11
is kept** (its DoS/pollution/deopt hardening is mandatory) and its **allocation story is
net-neutral in production**: the transient it added is real in a micro-bench but does not
materialize under load. The route-params gap that remains is **not in the matcher** — it is spread
across shared HTTP-layer work and small per-request framework overhead (context/dispatch), and the
next lever, if one is taken, is there, not in routing.

---

## 2. Method & artifacts

All figures below are reproducible; every claim cites an artifact.

| ID | Instrument | Command | Artifact |
|----|-----------|---------|----------|
| D1 | Gross-allocation micro-bench (the missing instrument) | `node scripts/param-match-alloc.js --runs 5 --n 200000 --semi 512` | `apps/benchmark/scripts/param-match-alloc.js` + `-child.js`; `apps/benchmark/results/param-match-alloc-2026-07-18T14-13-26/param-match-alloc.json` |
| D2 | Allocation sampling of the **real server** | `node --heap-prof --heap-prof-interval=16384 servers/nextrush-v3.js` + `wrk -t4 -c64 -d12s /users/12345` | `apps/benchmark/results/heapprof-server/nextrush-route-params.heapprofile` |
| D3 | CPU sampling of the **real server** | `node --cpu-prof --cpu-prof-interval=100 servers/nextrush-v3.js` + `wrk -t4 -c64 -d15s /users/12345` | `apps/benchmark/results/cpuprof-server/nextrush-route-params.cpuprofile` |
| D4 | Pinned multi-run RPS A/B | `taskset -c 0-1 node servers/<fw>.js` + `taskset -c 2-5 wrk -t4 -c64 -d10s /users/12345`, 5 runs each | `apps/benchmark/results/route-params-ab-2026-07-18T14-26-18/route-params-ab.json` |

Environment: Node v26.4.0, 8-core Linux, `NODE_ENV=production`. The matcher differential golden
(`match-differential` + `find-node-differential`, 37 tests) is **green** and no `packages/**` file
was touched — the profiler imports the built `@nextrush/router` dist read-only.

### 2.1 Why the gross-allocation instrument was needed (and what it does)

The existing `router-match-alloc.js` measures **net-retained** heap: it retains every match result
in a small young generation, so mid-loop scavenges reclaim the transient garbage (the per-node
`WalkFrame` objects in `matchNodeIndexed`, the `bindNames`/`bindValues` stacks in `matchRoute`) — it
is structurally blind to them. `NOTES.md` for `router-match-path-allocation-trim` documents this and
notes that GC-churn proxies are "defeated by V8 escape analysis."

`param-match-alloc.js` measures **gross** allocation instead: it runs the real built matcher N times
under an enlarged young generation (`--max-semi-space-size`) so that **no scavenge fires during the
measured window** — making `heapUsed_after − heapUsed_before ÷ N` the *total* bytes allocated per
match, transient included. A `perf_hooks` GC observer counts any in-window GC and the run is
**rejected** if `gcCount > 0` (a scavenge would under-count); `--trace-gc` window markers give an
independent calibration path. It reports two modes per depth: `retain` (result forced to escape, as
`ctx.params` does in production) and `discard` (result dropped, so V8 may scalar-replace) — the
gap between them *is* the escape-analysis measurement.

---

## 3. Findings

### D1 — Gross allocation: the transient the net-retained bench couldn't see (and its escape-analysis ceiling)

`results/param-match-alloc-2026-07-18T14-13-26/param-match-alloc.json`, 5 runs, `--n 200000 --semi
512`, zero GC-rejected runs, all cv < 1%:

| Variant | Gross (retain) B/op | cv | Discard floor B/op | Net-retained (old bench) |
|---|---|---|---|---|
| Static hit (`/users/list`) | 58.1 | 0% | 2.6 | 64.2 |
| Depth-2 param (`/users/:id`) | **442.3** | 0.1% | 2.9 | 340.1 |
| Depth-8 param (3-param) | 505.2 | 0.05% | 9.2 | — |

Two facts, both new:

1. **The net-retained bench undercounted by ~102 B/op.** Gross depth-2 (442.3) − net-retained
   (340.1) ≈ **102 B/op of transient garbage** — the `WalkFrame` stack + frame objects + the
   `bindNames`/`bindValues` arrays — that mid-loop GC reclaimed and the old bench never saw. Depth
   scaling is **~10.5 B/op per added segment** (depth-2 → depth-8). So the instrument works: it sees
   what the old one was blind to.
2. **~98% of the whole param-match allocation is escape-analysis-eligible.** The `discard` floor is
   ~3–9 B/op across every depth. When the caller does not retain the result, V8 scalar-replaces the
   `RouteMatch`, the `params` object, and the frame/bind arrays almost entirely. The 340–442 B/op
   only materializes because the result is *kept alive*.

This immediately flags that the "340 B/op" is not a fixed per-request tax — it is contingent on how
the result is consumed. D2 tests what actually happens in the server.

### D2 — Allocation attribution on the real server: the matcher is ~0.3% of heap traffic

`results/heapprof-server/nextrush-route-params.heapprofile` (real server, `wrk` route-params load,
16 KB sampling). Self-size attributed by function:

- **`matchRoute` = 0.34%** of total sampled heap (16.5 KB of 4.85 MB). It is the **only** matcher
  frame with any sampled allocation.
- **`matchNodeIndexed`, the `WalkFrame` stack, `bindNames`/`bindValues`, `decodeParam`, `segmentAt`
  = zero sampled allocation.** The transient ~102 B/op D1 measured does **not** appear under real
  load — V8 elides it exactly as the `discard` floor predicted.
- Heap traffic is dominated by one-time startup (`compileForInternalLoader` 26%, undici `__require`
  8.6%) and **unavoidable per-request HTTP-layer allocation** (`internal/encoding` decode 5.1%, the
  HTTP parser, writable-stream `onwrite` ~3%).

**Cross-check verdict (design D2 / task 3.3): D1 and D2 disagree, and that disagreement is the
finding.** The micro-bench's 442 B/op does not translate into a dominant allocation term in the
real server; escape analysis is in play. Per the design's own decision rule, the diagnosis pivots
to CPU (D3) rather than naming an allocation culprit.

### D3 — CPU attribution: the whole matcher is ~4%; the request is I/O- and serialize-bound

`results/cpuprof-server/nextrush-route-params.cpuprofile` (104,252 samples). Self-time by function:

| Cost area | Self-time | Notes |
|---|---|---|
| Response write (`writev` 28.45% + `writevGeneric` 2.18% + `createWriteWrap`/`_storeHeader` ~2%) | **~33%** | kernel/libuv socket write — shared by all frameworks |
| `(idle)` | 23.95% | server is **not** CPU-saturated at ~22K RPS |
| `(program)` / V8 unattributed | 8.91% | |
| JSON serialize (`ctx.json`) | 4.82% | shared work |
| **Whole router matcher** | **4.03%** | breakdown below |
| GC (`(garbage collector)`) | ~1.0% | |
| Context + dispatch (`NodeContext` 0.79% + `composedSingle` 0.50%) | ~1.3% | per-request framework overhead |

Matcher breakdown (design D3 categories):

- **(a) allocation/GC:** GC ~1.0%; matcher-attributable allocation negligible (D2). 
- **(b) per-segment `Map.get`/walk:** `matchNodeIndexed` **1.44%** (the trie walk —
  `children.get(seg)` + `handlers.get(method)` per segment) + `matchRoute` orchestration/params
  **1.87%**.
- **(c) decode/normalize:** `collapseAndStrip` 0.30% + `isProvablyLowerAscii` 0.29% + `decodeParam`
  0.07% ≈ 0.66%.

The **largest matcher-specific term is the per-segment `Map.get` walk (`matchNodeIndexed`, 1.44%)** —
precisely the term a radix/prefix-compressed tree collapses on shared prefixes. But the entire
matcher is only ~4% of CPU, and the route-params-*specific* excess over a static hit is a fraction
of that.

### D4 — Defensible RPS: −7.4%, not −13.9%

`results/route-params-ab-2026-07-18T14-26-18/route-params-ab.json`, `taskset`-pinned (server cores
0–1, wrk cores 2–5), `wrk -t4 -c64 -d10s`, 5 runs each:

| Server | RPS (mean ± stddev) | cv | vs NextRush |
|---|---|---|---|
| NextRush | **23,670 ± 481** | 2.0% | — |
| Fastify | 25,567 ± 476 | 1.9% | NextRush **−7.4%** |
| raw-node | 25,446 ± 828 | 3.3% | NextRush −7.0% |

The single-run unpinned figure recorded in NF-3 was **−13.9%** (NextRush 26,315 vs Fastify 30,551,
`results/2026-07-18T13-14-58`). Pinned and averaged, the gap is **−7.4%** — roughly **half** the
headline gap was single-run/unpinned noise (a separate 3-run round measured −10.2%, so the honest
pinned range is ~−7 to −10%). Note also that Fastify ≈ raw-node here (within noise): **NextRush is
~7% behind raw Node itself**, so this is per-request framework overhead, not a routing-algorithm
deficit specific to Fastify.

**Confidence:** directional/defensible only. Absolute RPS is depressed by 2-core pinning; only the
*delta* is defensible. This is **not** the publishable 5-run clean-host figure — that A/B remains
the one deferred global gate (README §Performance).

---

## 4. The decision gate (D5 — all four answered with evidence)

**1. Dominant cost term.** *Not allocation.* In the real server the matcher's allocation is ~0.34%
of heap traffic (D2) and ~98% escape-analysis-eligible (D1 discard floor); GC is ~1% CPU (D3). The
whole matcher is ~4% of CPU, of which the largest term is the per-segment `Map.get` walk
(`matchNodeIndexed`, 1.44%). The route-params request is dominated by the response `writev` (~33%)
and JSON serialization (~4.8%) — work shared with every framework (D3).

**2. Defensible RPS delta.** **−7.4% vs Fastify** (pinned, 5-run, cv 2.0%), down from the −13.9%
single-run figure (D4). NextRush is ~7% behind raw Node too.

**3. Trim vs radix — recommend NEITHER as a route-params RPS lever.** Applying the design's
decision rule to the evidence:
   - A **segment-trie allocation trim** (bounded backtrack stack instead of a frame-per-node, reused
     bind arrays) would target allocation/GC — but that is ~1% of cost and already escape-elided in
     production (D2/D3). Projected RPS gain: **≈ 0**. **Do not commit it.**
   - **Advancing radix (RFC 015)** would target `matchNodeIndexed`'s per-segment `Map.get` walk —
     but that is only **1.44%** of CPU, so even eliminating it entirely closes **far less than the
     ~7% gap** (decision rule: "recommend radix… if a trim is projected to close < a meaningful
     fraction of the gap" — here *both* levers do). Radix should stay **RFC-015-deferred**: it needs
     a driver beyond route-params RPS (very large route tables, deep shared prefixes), which this
     workload does not supply. **Do not green-light it on route-params grounds.**
   - The remaining ~7% gap is **not in the matcher.** It is spread across shared HTTP-layer work and
     small per-request framework overhead (`NodeContext` creation 0.79%, `composedSingle` dispatch
     0.50%, the adapter response path). That is where a future lever lives — see §6.

**4. HP-11 keep/park verdict — KEEP; allocation story net-neutral in production.** HP-11's
iterative explicit-stack DFS is **kept unconditionally** on correctness grounds: it closed a real
stack-overflow DoS on pathological segment counts, a `__proto__`-param prototype-pollution vector,
and the `Reflect.deleteProperty` hidden-class deopt (pinned by the 37-test differential golden +
safety scenarios). On the *allocation* question NF-3 left open: the "doubling" NF-3 recorded
(169 → 340 B/op net-retained) was **net-retained-bench noise, not a real RPS regression.** The gross
bench confirms the iterative walk does add ~102 B/op of transient frame/bind allocation (D1) — but
D2/D3 show that transient is **escape-analysis-elided under real load** and GC is only ~1% of CPU,
so its RPS cost is **negligible**. **Verdict: HP-11's allocation story is net-neutral in
production; keep it.** This resolves the deferred `router-match-path-allocation-trim` D6 gate and
the first report's HP-11 park clause.

---

## 5. What this gate blocks

Per the `performance-gate` spec, **no route-params matcher optimization may be committed without
citing this report's diagnosis.** Given the findings, a proposed segment-trie allocation trim is
**rejected** (near-zero projected RPS), and a radix build is **not justified on route-params
grounds** (stays RFC-015-deferred on a separate driver). Any future proposal must show, against §3's
data, that it targets a cost term that actually dominates.

## 6. Concrete next change (task 6.3)

The follow-up is **not** a matcher rewrite. In priority order:

1. **Confirm the gap is real before spending on it.** Run the deferred **publishable 5-run
   CPU-pinned `--profile full` A/B on a clean host** — the one global gate. This report's −7.4% is
   directional; if the clean-host figure lands near the noise floor, NF-3 is substantially closed by
   measurement alone.
2. **If a real gap remains, target per-request framework overhead, not routing.** The profile
   (§3, D3) points at context creation (`NodeContext`) and dispatch (`composedSingle`) as the only
   NextRush-specific CPU terms outside the shared response/serialize path — a far better lever than
   the ~1.5% matcher walk.
3. **Keep radix RFC-015-deferred.** No route-params driver exists; revisit only under a large-table
   / deep-prefix workload with its own T017 evidence.
4. **Keep the gross-allocation profiler** (`bench:alloc:param-match`) as the standing instrument for
   any future matcher allocation claim — it is the tool NF-3 said was missing.

---

## 7. Limitations (honest scope)

- The RPS delta is **directional** (2-core pinned on an active dev host), not the publishable
  clean-host figure. Only the *delta* is defensible; absolute RPS is depressed by pinning.
- The gross micro-bench (D1) forces the result to escape via retention, which is realistic
  (`ctx.params` is consumed) but is still a micro-loop; D2 (real server) is the authority on what
  actually allocates under load, and it governs the conclusion where the two differ.
- CPU sampling at 100 µs attributes ~4% to the matcher with sampling error of a few tenths of a
  percent; the qualitative conclusion (matcher is a small minority of route-params cost) is robust
  to that error.

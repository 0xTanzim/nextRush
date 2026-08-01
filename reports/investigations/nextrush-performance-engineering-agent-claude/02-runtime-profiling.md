# 02 — Runtime Profiling & Evidence

**Playbook phase:** Part 3 — Runtime Profiling & Evidence (§3.1–3.8)

The playbook requires that this phase be completed before subsystem analysis, and requires that
missing evidence be documented explicitly rather than skipped (Part 0 §0.4, Part 3 §3.8). This
report does both: it inventories the evidence that exists, states plainly what does not exist, and
declares the substitute method used along with the confidence ceiling that substitution imposes.

---

## 1. PHASE STATUS: PARTIALLY BLOCKED

Playbook §3.8 requires six items before subsystem analysis begins. Actual status:

| §3.8 requirement | Status | Note |
| ---------------- | ------ | ---- |
| CPU profiling completed | ❌ **Not available** | No CPU profile, `.cpuprofile`, or flamegraph artifact exists in the workspace |
| Memory profiling completed | ❌ **Not available** | No heap snapshot artifact exists |
| Allocation analysis completed | ⚠️ **Partial** | Harnesses exist and have produced numbers historically; no result artifact for current code |
| Garbage collection reviewed | ❌ **Not available** | No GC trace, `--trace-gc` log, or pause-duration data exists |
| Event loop analyzed | ❌ **Not available** | No event-loop-delay or ELU measurement exists |
| Required runtime evidence collected | ⚠️ **Substituted** | See §4 |

**This phase cannot be completed as specified.** Per the execution policy governing this
investigation, profilers and benchmarks must not be run, and per the playbook, missing evidence
must be declared rather than assumed. The investigation therefore continues on a **declared
substitute method** with a **declared confidence ceiling**, and §5 states exactly what must be
collected to lift it.

This is the same gap the previous investigation reported as its "overarching meta-finding"
(`report/core/performance-review.md`): *"the two measurements that would actually confirm it — a
CPU-pinned `--profile full` RPS A/B and a transient-allocation profile of the hot path — have never
been run."* **Independently re-verified as still true at HEAD.** It has now persisted across at
least two investigations and is the single most consequential process gap in the performance
program.

---

## 2. Evidence that does exist (§3.2)

| Category | Artifact | Usable? |
| -------- | -------- | ------- |
| Throughput | `results/2026-07-27T15-42-50/results.csv` — 180 cells, mean/stddev/CV, 3 runs each | ✅ Primary evidence |
| Latency | Same file — p50 and p99 per cell | ✅ Used in §3 |
| Aggregate scoring | `scoreboard.json`, `README-TABLES.md` | ✅ |
| Non-2xx accounting | `non_2xx` column | ✅ Used to confirm the error scenario behaved as designed and that no other scenario was silently erroring |
| Source at benchmarked revision | Workspace HEAD `5f77df1`; `d97734e3` (2026-07-22) predates the run | ✅ Static analysis is against the code that was measured |
| Change attribution | Git history of `packages/adapters/node/src/adapter.ts` | ✅ Used in §04 |
| Static complexity metrics | `codebase-memory-mcp` per-symbol cyclomatic/cognitive/loop-depth/allocation-in-loop | ✅ Structural evidence only |
| Prior investigations | `report/core/{performance-review, core-hot-path-performance-review, context-review, request-pipeline-review}.md`, `report/router/*`, `report/adapters/*` | ✅ Verified, not trusted |
| Historical allocation measurements | Quoted in prior reports: `bench:alloc:dispatch` 832.1 → 56.1 B/req (cv≈0); lazy-`raw` 47.6 → 8.1 B/req; param match 339.87 B/op vs static 64.24 B/op | ⚠️ Second-hand, and predate `d97734e3` |
| Allocation harnesses | `apps/benchmark/scripts/{dispatch,compose,context,context-state,context-raw,router-match,param-match,web-context}-alloc.js` | ✅ Ready to run — this is why §5 is cheap |

## 3. Latency evidence (§3.6 proxy)

No event-loop-delay instrumentation exists, but the stored p50/p99 latency at fixed concurrency is
a usable proxy for queueing behaviour, because at fixed connection count latency and throughput are
linked by Little's Law.

| Scenario @ 256 conn | NextRush p50 / p99 | Fastify p50 / p99 | Raw Node p50 / p99 |
| ------------------- | ------------------ | ----------------- | ------------------ |
| Hello World | 8.69 / 11.15 ms | 7.29 / 9.57 ms | 7.10 / 9.81 ms |
| Route Parameters | 10.60 / 13.95 ms | 7.93 / 9.91 ms | 7.50 / 9.83 ms |
| Middleware Stack | 11.36 / 14.20 ms | 8.57 / 10.22 ms | 8.59 / 10.52 ms |
| POST JSON | 14.19 / 16.36 ms | 12.91 / 13.87 ms | 10.10 / 11.39 ms |

**Two observations:**

1. **The p99/p50 ratio is not elevated.** NextRush sits at 1.28–1.32 on these cells; Fastify at
   1.19–1.31; raw Node at 1.13–1.38. If long GC pauses or blocking synchronous work were the
   mechanism, NextRush's tail would be disproportionately worse than its median. It is not. This
   **weakens** any hypothesis of stop-the-world pauses or event-loop stalls, and **strengthens** the
   hypothesis of a uniformly higher per-request cost — every request pays the same extra work.
   Recorded as *Moderate evidence* because latency percentiles are a coarse instrument for this.
2. Latency scales in proportion to the throughput deficit throughout, exactly as expected for a
   saturated single-threaded server at fixed concurrency. No cell shows latency and throughput
   moving independently, which would have indicated a concurrency-limit or backpressure artifact
   rather than a CPU cost.

---

## 4. Substitute method and its confidence ceiling

**Method used in place of profiling:** static hot-path enumeration. Every function on the
per-request path was read at HEAD via the code graph, and its per-request allocations, closure
creations, promise creations, microtask boundaries and timer interactions were counted from source.
The counts are then checked for consistency against the measured `µs/req` decomposition in
`01-benchmark-analysis.md` §4.

**What this method can establish:**
- That a given piece of work *is* performed on every request (a source-level fact).
- That an allocation *is* created per request (a source-level fact).
- Which of several candidate mechanisms is *consistent* with the measured cost distribution.

**What it cannot establish:**
- How many nanoseconds any individual mechanism costs.
- Whether V8 escape analysis elides a given allocation in the real optimised code. The previous
  investigation was explicitly burned by this: it reported that an isolated test of the matcher's
  per-node `WalkFrame` objects was *inconclusive* because escape analysis elided them in a small
  loop, and it correctly refused to claim frame allocation as the culprit. The same discipline
  applies here.
- The share of CPU attributable to each mechanism — only a profile can rank them.

**Confidence ceiling: no finding in this investigation may be labelled "Confirmed" for its
magnitude.** Existence of a mechanism can be Confirmed (source is authoritative); its cost is at
best Strong evidence.

### 4.1 Per-request work inventory (static count, `hello-world` shape)

Derived by reading `createHandler` → `Application.callback` → `compose` (len=1 fast path) →
`createRoutesMiddleware` → `compileExecutor` (len=0 fast path) → `NodeContext.json`.

| # | Work performed per request | Site | Avoidable? |
| - | -------------------------- | ---- | ---------- |
| 1 | `NodeContext` instance | `createNodeContext` | No — necessary |
| 2 | `getRuntime()` call | Context ctor | Already cached (4-line accessor) |
| 3 | `req.method.toUpperCase()` | Context ctor | Prior review measured 0 B for uppercase input — **not** an issue |
| 4 | `getClientIp()` → `req.socket.remoteAddress` string | Context ctor | **Yes — P-04**, lazy getter |
| 5 | 2 closures: `finalizeSuccess`, `finalizeError` | `createHandler` | Partially |
| 6 | **`Symbol('timeout')`** | `createHandler` | **Yes — trivially hoistable** |
| 7 | **`setTimeout(…, 30000)` → a `Timeout` object, inserted into the timer list** | `createHandler` | **Yes — P-01** |
| 8 | **Array literal `[p1, p2]` for `Promise.race`** | `createHandler` | **Yes — P-01** |
| 9 | **`handlerPromise.then(…)` derived promise + its closure** | `createHandler` | **Yes — P-01** |
| 10 | **`new Promise(...)` for the timer + its executor closure** | `createHandler` | **Yes — P-01** |
| 11 | **`Promise.race(...)` result promise** | `createHandler` | **Yes — P-01** |
| 12 | **`.then(...)` + `.catch(...)` derived promises + 2 closures** | `createHandler` | **Yes — P-01** |
| 13 | **`clearTimeout()`** — timer list removal | `createHandler` | **Yes — P-01** |
| 14 | `async` frame for `callback()`'s arrow + its `try/catch` | `Application.callback` | Partially |
| 15 | `called` flag + `nextFn` closure | `compose` len=1 path | Minor |
| 16 | `ctx.setNext(nextFn)` call | `compose` | Minor |
| 17 | `canonicalizePath()` result object `{rejected, path}` | `createRoutesMiddleware` | **Yes — P-02** |
| 18 | `RouteMatch` object literal `{handler, params, middleware, executor}` | `matchRoute` | **Yes — P-02** |
| 19 | `Promise.resolve(handler(...))` | `compileExecutor` len=0 | Minor |
| 20 | `JSON.stringify(data)` string | `ctx.json` | No — necessary |
| 21 | Header object literal for `writeHead` | `ctx.json` | Minor |

Items **6–13 are a single mechanism** (the F-04 timeout race) contributing roughly six heap
allocations, four closures, one timer object, one timer-list insert, one timer-list remove, and
approximately three additional microtask boundaries — on every request, whether or not any timeout
is configured, because `DEFAULT_TIMEOUT_MS = 30_000` makes the race the default path.

For the `route-params` shape, add: `bindNames` array, `bindValues` array, `params` null-prototype
object (items in P-02). For the 5-layer middleware shape, add one `dispatch` closure plus five
`next` closures plus six `Promise.resolve` wrappers (P-03).

### 4.2 Consistency check against measurement

The static inventory predicts the fixed floor is inflated by a mechanism that is (a) present on
100% of requests, (b) allocation-heavy, and (c) adds microtask hops. The measured floor penalty is
+5.55 µs vs Fastify with no elevated p99/p50 ratio — i.e. uniform extra work, not pauses. These
agree.

The inventory also predicts param routes add three allocations beyond the base; measurement shows
+5.23 µs marginal vs Fastify. Agreement is directional, not quantitative.

**One prediction the static method got wrong, recorded for honesty:** a per-request timer plus a
promise graph proportional to in-flight requests would plausibly produce *superlinear* degradation
with concurrency and a fat tail. The measured tail is **not** fat (§3). So the flat-scaling
mechanism is most likely *uniform per-request CPU cost saturating the loop early*, not
concurrency-dependent cost growth. `04-root-cause-analysis.md` §2 adopts the narrower claim, and
the broader one is demoted to a hypothesis requiring a concurrency-swept allocation profile.

---

## 5. Required evidence to lift the confidence ceiling (§3.2)

Ordered by value per unit of effort. None of these require new tooling — items 2 and 3 use
harnesses already in the repository.

| # | Evidence needed | How | Answers |
| - | --------------- | --- | ------- |
| 1 | **CPU profile / flamegraph** of `hello-world` and `route-params` at 64 conn | `node --cpu-prof` on the NextRush benchmark server during a wrk run | Ranks P-01/P-02/P-03 against each other; confirms or refutes the timer/promise scaffolding appearing in the profile at all |
| 2 | **Allocation A/B of the adapter handler** | Extend the existing `bench:alloc:dispatch` harness to cover `createHandler` with and without the timeout race | Turns P-01's magnitude from Strong evidence to Confirmed |
| 3 | **Param-path allocation profile** | Existing `param-match-alloc.js` / `router-match-alloc.js` at current HEAD | Settles the prior review's unresolved claim that the param allocation number *doubled* (169.4 → 339.87 B/op) after the router trim |
| 4 | **Pinned baseline committed** to `apps/benchmark/results/baseline/` | The path is already whitelisted in `apps/benchmark/.gitignore` (`!/results/baseline/`) but is empty | Makes every future change A/B-able; would have made P-01 measurable rather than inferable |
| 5 | **CPU-pinned `--profile full` (5-run) re-measurement** | `pnpm bench:compare --profile full` with pinning enabled | Removes the scheduler-noise caveat; required before any figure is published |
| 6 | **GC trace + event-loop delay** at 64 and 256 conn | `--trace-gc` plus `perf_hooks.monitorEventLoopDelay` | Confirms or refutes the demoted concurrency-dependent hypothesis in §4.2 |

**Item 4 is the process fix, not a measurement.** Because `/results/*` is gitignored and no
`baseline/` directory exists, the pre-`d97734e3` run is unrecoverable — the regression introduced by
a parity fix cannot be quantified after the fact. Every future performance-affecting change has the
same exposure until a baseline is pinned.

---

## 6. Confidence classification used throughout (§3.7)

| Label | Meaning in this investigation |
| ----- | ----------------------------- |
| **Confirmed** | Read directly in source at the benchmarked revision, or read directly from the stored measurement. Not inferred. |
| **Strong evidence** | Measured effect plus an identified source-level mechanism that fully accounts for it, with no competing explanation found. |
| **Moderate evidence** | Measured effect with a plausible identified mechanism, but alternatives not excluded. |
| **Hypothesis** | Mechanism identified in source; no measurement covers it. |
| **Unknown** | Observed but unexplained; logged in `appendix/open-questions.md`. |

Continues in `03-subsystem-analysis/`.

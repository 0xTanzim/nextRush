# 04 — Root Cause Analysis

**Playbook phase:** Part 5 — Root Cause Analysis (§5.1–5.6, Sections A–C)

This report separates symptoms from causes. The benchmark produced one dominant symptom; subsystem
analysis produced five causes; and one of the five is a *process* cause rather than a code cause,
which is the finding most likely to matter twelve months from now.

---

## 1. Symptom vs. cause

| Observed symptom | Is it a root cause? |
| ---------------- | ------------------- |
| NextRush ranks 4th of 6 (90/144) | **No** — an aggregate of everything below |
| NextRush is −15.8% to −25.5% behind Fastify on like-for-like scenarios | **No** — the composite of three mechanisms |
| **NextRush has the worst concurrency scaling in the suite (×1.01–×1.24 vs peers' ×1.18–×1.53)** | **No — this is the master symptom** (§2) |
| NextRush beats raw `node:http` at concurrency 1 | **No** — a property of an efficient write path, not a defect (see `response.md` §4.2) |
| Fixed per-request floor is +7.59 µs above raw Node, 3.7× Fastify's overhead | **Partly** — a cause of the gap, itself caused by P-01 |
| Route Parameters is the widest like-for-like gap | **Partly** — caused by P-02 |
| Large JSON / POST JSON / Error Handling gaps | **No** — inherited from the floor; the subsystems themselves are at parity |

---

## 2. The master symptom: flat concurrency scaling (§5.1)

**What it is.** NextRush gains ~1–11% throughput moving from 1 to 64 connections on seven of ten
scenarios. Every peer, including Express, gains 12–43%.

**Why it happens.** Two explanations were considered and one was rejected on evidence.

*Hypothesis A (rejected): cost that grows with in-flight concurrency.* The per-request timer object
and promise graph in P-01 are live for the request's duration, so at 256 connections ~256 `Timeout`
objects and ~1,300 promise objects are simultaneously live. That would plausibly produce superlinear
degradation and a fat latency tail from GC pressure.

**Rejected because the tail is not fat.** NextRush's p99/p50 ratio is 1.28–1.32 on the affected
cells, versus Fastify's 1.19–1.31 and raw Node's 1.13–1.38 (`02-runtime-profiling.md` §3). If GC
pauses or event-loop stalls were the mechanism, NextRush's tail would be disproportionately worse
than its median. It is not. Hypothesis A is demoted to an open question requiring a
concurrency-swept allocation and GC profile (OQ-3).

*Hypothesis B (adopted): a uniformly higher per-request CPU cost that saturates the event loop at
low concurrency.* Because NextRush's cost per request is ~5.5–12 µs higher than Fastify's, it reaches
100% event-loop utilisation with far fewer concurrent requests. Once saturated, additional offered
load cannot increase throughput — it only lengthens the queue, which is exactly what the latency
figures show (latency rises in proportion to the throughput deficit, with a normal tail shape).

**Adopted because it explains every observation without exception**, including the two anomalies:

- NextRush's *best* scaling ratios are `post-json` (×1.24) and `error-handling` (×1.20) — the two
  scenarios where per-request cost is dominated by something outside the framework pipeline (body
  I/O event handling; V8 `Error` construction). When the bottleneck is elsewhere, NextRush scales
  like its peers.
- NextRush's *worst* ratios are `route-params`, `deep-route` and `middleware-stack` (all ×1.01–×1.02)
  — precisely the scenarios that add framework pipeline work on top of the floor.

**Conclusion:** the flat scaling is not a distinct defect requiring its own fix. It is the visible
consequence of high fixed per-request CPU cost. Fixing P-01, P-02 and P-03 should restore normal
scaling as a side effect. **This is a falsifiable prediction** and is written into the validation
protocol (`06-validation-regression.md` V-07): if per-request cost drops but the scaling ratio stays
flat, Hypothesis B is wrong and Hypothesis A must be re-opened.

**Confidence: Strong evidence.**

---

## 3. Root cause P-01 — per-request timeout race (Critical)

| Field | Content |
| ----- | ------- |
| **Description** | The Node adapter's per-request handler unconditionally builds a `Promise.race` between the handler promise and a `setTimeout(30_000)`, allocating a fresh `Symbol`, ~5 promises, 4 closures, an array and a Node `Timeout` object, and adding ~3 microtask boundaries — on 100% of requests. |
| **Evidence** | `createHandler` read at HEAD (`packages/adapters/node/src/adapter.ts:194–291`); `DEFAULT_TIMEOUT_MS = 30_000` (`packages/runtime/src/constants.ts:30`) with `serve()` defaulting to it, so the race is the default path; benchmark server calls `listen(app, PORT)` with no options; fixed floor measured at 30.30 µs/req vs Fastify 24.75 and raw Node 22.71. |
| **Classification (§5.2)** | **Async Overhead** + **Memory Allocation**; secondarily **Architectural** (an exception-path mechanism paid on the happy path) |
| **Where** | `packages/adapters/node/src/adapter.ts`, per-request closure returned by `createHandler` |
| **Why** | Introduced by `d97734e3` (2026-07-22) to satisfy prior audit finding **F-04** — cross-runtime parity, so Node would produce a handler-level `504` like the Bun/Deno/Edge/Serverless adapters instead of relying only on socket-level `server.timeout`. Confirmed via `git log -S 'TIMEOUT_SENTINEL'`. The parity requirement is legitimate; the mechanism's cost was never measured. |
| **Reproducible** | Yes — deterministically present on every request; the `timeout <= 0` branch provides a built-in A/B control |
| **Implementation-specific or architectural** | **Implementation-specific.** The parity contract can be satisfied by a cheaper mechanism (see S-01), so nothing architectural must change. |
| **Impact (§5.3)** | Throughput: largest single contributor to the fixed floor, which accounts for essentially the entire Hello World gap vs Fastify (5.55 µs of a 5.46 µs measured gap). Latency: +5.55 µs/request. Allocation: ~11 objects/request. GC: young-generation churn proportional to request rate. Scalability: the primary driver of the master symptom in §2. |
| **Confidence** | **Confirmed** — mechanism, default-on status, allocation inventory, commit attribution. **Strong evidence** — that it is a material share of the floor. **Not Confirmed** — its exact share, which requires `02-runtime-profiling.md` §5 evidence item 2. |

**Why this is the most important finding.** Every other structure on this path has already been
optimised — HP-1, HP-4, HP-5, HP-9, HP-11, HP-12, HP-13, HP-14, NF-1 and NF-2 are all verified
present at HEAD. P-01 is the one un-trimmed mechanism remaining, and it was added *after* that
program completed, by a change whose motivation had nothing to do with performance.

---

## 4. Root cause P-02 — per-request container allocation in the param path (Critical)

| Field | Content |
| ----- | ------- |
| **Description** | Matching a `:param` route allocates five short-lived containers per request: `bindNames[]`, `bindValues[]`, the `params` object, the `RouteMatch` object literal, and `canonicalizePath`'s `{rejected, path}` result (the last on *all* requests, static included). |
| **Evidence** | `matchRoute` and `createRoutesMiddleware` read at HEAD; Route Parameters −25.5% vs Fastify / −28.9% vs raw Node @256; marginal param cost 7.30 µs vs Fastify 2.07 (**3.5×**); scaling ratio ×1.01 |
| **Classification (§5.2)** | **Memory Allocation** + **Data Structure** |
| **Why** | A container is allocated per function boundary to transport matched data upward (`matchNodeIndexed` → `matchRoute` → `createRoutesMiddleware`). Fastify's `find-my-way` writes into a reused structure and returns a cached record. |
| **Reproducible** | Yes |
| **Implementation-specific or architectural** | **Implementation-specific.** The trie algorithm is sound — depth measurements confirm route-count and depth independence. Only the data transport is wasteful. |
| **Impact (§5.3)** | +5.23 µs/request on param routes vs Fastify; +1 allocation/request on **all** routes from `canonicalizePath`. Param routes are the dominant shape in real REST APIs, so real-world impact exceeds the benchmark's. |
| **Confidence** | **Confirmed** (inventory) / **Strong evidence** (attribution) / **Hypothesis** (per-item magnitude) |

**Unresolved contradiction carried forward.** The previous investigation recorded that the team's own
micro-benchmark showed param-match allocation *rising* from 169.4 to 339.87 B/op after the router
allocation trim shipped, and that this was dismissed as unmeasurable transient garbage. That
regression has never been explained and is fully consistent with the five-container inventory. It is
the strongest single argument for running evidence item 3.

---

## 5. Root cause P-03 — request-time middleware chain construction (High)

| Field | Content |
| ----- | ------- |
| **Description** | `compileExecutor` does not compile for routes with middleware. It returns a closure that rebuilds a recursive `dispatch` chain at request time, allocating 1 `dispatch` closure + 1 `next` closure per layer + 1 `Promise.resolve` per layer — although the middleware array is fully known at registration time. |
| **Evidence** | `compileExecutor` read at HEAD (`packages/router/src/segment-trie.ts:78–146`); per-layer marginal cost 2.09 µs vs Fastify 0.87, raw Node's plain-callback chain 1.04, Koa 1.06; Middleware Stack −25.6% vs Fastify; scaling ratio ×1.01 |
| **Classification (§5.2)** | **Architectural** (request-time work that belongs at registration time) + **Async Overhead** |
| **Why** | The chain's linkage is expressed as `next = () => dispatch(i + 1)`, which closes over the loop index rather than over the already-built successor. Building backwards at registration time would capture the successor directly. |
| **Reproducible** | Yes |
| **Implementation-specific or architectural** | **Architectural in expression, implementation-specific in fix.** No public API changes. |
| **Impact (§5.3)** | +1.22 µs per layer per request vs Fastify, scaling linearly with stack depth. **The benchmark understates this**: the harness mounts a single root router, giving `compose` its `len === 1` fast path. A realistic app with three `app.use()` layers takes the general recursive path on every request. |
| **Confidence** | **Confirmed** (mechanism) / **Strong evidence** (attribution) |

---

## 6. Root cause P-04 — eager `ctx.ip` (Medium) and P-06 — `send()` dispatch order (Medium)

| | P-04 | P-06 |
| --- | ---- | ---- |
| **Description** | `ctx.ip` is resolved in the Context constructor for a property most handlers never read | `ctx.send(obj)` traverses seven failed type tests before the object branch, in a 142-line function with cyclomatic complexity 22 |
| **Evidence** | Constructor read at HEAD; contrast with `ctx.raw` / `ctx.state` / `ctx.signal`, all already lazy | `send()` dispatch order read at HEAD |
| **Classification** | Unnecessary work (eager materialisation) | Data structure / dispatch strategy |
| **Why not already fixed** | HP-1 optimised the *content* of `getClientIp` (short-circuit for `proxy: false`) but not its *timing* | Tests are ordered by specificity, and cannot be naively reordered because `Buffer` is a `Uint8Array` is an `object` |
| **Impact** | One socket getter + one retained string per request | Unmeasured — no benchmark calls `send(object)` |
| **Confidence** | Confirmed (mechanism) / Hypothesis (magnitude — likely sub-microsecond) | Confirmed (structure) / Hypothesis (magnitude) |

## 7. Root cause P-05 — uncached static-file `stat` (Medium, Hypothesis)

Fully analysed in `03-subsystem-analysis/static-files.md`. Classification: **I/O**. The mechanism is
Confirmed in source; the impact is entirely unmeasured because no benchmark scenario serves a static
file. Deliberately ranked Medium rather than High: promoting an unmeasured finding above measured ones
would invert the playbook's own prioritisation rule (§2.3).

---

## 8. Root cause P-00 — the process gap (Critical, and the durable one)

This is not a code defect, and it is the finding most likely to still matter after every item above
is fixed.

| Field | Content |
| ----- | ------- |
| **Description** | No mechanism exists to prevent a non-performance change from silently regressing the hot path, and no mechanism exists to measure such a regression after the fact. |
| **Evidence** | (a) `apps/benchmark/.gitignore` ignores `/results/*` and whitelists `!/results/baseline/`, but **no `baseline/` directory exists** — so no pre-`d97734e3` run is recoverable and P-01 cannot be A/B'd against its own introduction. (b) `d97734e3`, a parity fix, added ~11 per-request allocations to the hot path with no accompanying performance validation. (c) No CPU profile, flamegraph, heap snapshot, allocation profile, GC trace or event-loop measurement exists anywhere in the workspace. (d) The previous investigation reported this same gap as its "overarching meta-finding" and it remains unclosed. |
| **Classification (§5.2)** | **Configuration / process** |
| **Why** | The repository *has* the tooling — `check-regression.js`, eight `*-alloc.js` harnesses, a `bench:validate` parity gate, and a whitelisted baseline path. It is unwired, not missing. |
| **Impact (§5.3)** | Unbounded. Every future correctness, security or parity fix touching the request path carries the same exposure. P-01 is the demonstrated instance, not the only possible one. |
| **Confidence** | **Confirmed** |

**This is why `07-optimization-roadmap.md` places baseline pinning and a CI allocation gate in Phase 1
alongside the code fixes, not after them.** Fixing P-01 without closing P-00 means the next parity fix
can reintroduce an equivalent cost, and nobody will know until the next manual investigation.

---

## 9. Optimisation opportunities by root cause (§5.4)

| Root cause | Approach | Class of change |
| ---------- | -------- | --------------- |
| P-01 | Hoist the sentinel; replace `Promise.race` with flag-and-callback; move to one shared coarse timer; de-async the `callback()` wrapper | Reduce allocations, reduce async overhead, simplify execution path |
| P-02 | Reuse bind stacks per router; eliminate the `RouteMatch` and `canonicalizePath` containers; single-pass param materialisation | Reduce allocations, improve data structures |
| P-03 | Compile the chain backwards at registration time; conditionally elide `Promise.resolve` | Move request-time work to registration time |
| P-04 | Lazy `ctx.ip` getter | Lazy evaluation |
| P-05 | Bounded LRU metadata + negative cache (after a benchmark exists) | Caching |
| P-06 | Two-level `typeof` dispatch; split into per-kind helpers | Simplify execution path |
| P-00 | Pin a baseline; wire `check-regression.js` and the alloc harnesses into CI | Process |

## 10. Prioritisation (§5.6)

Ranked by measured impact × execution frequency, then by risk and effort. Trade-offs are in
`05-solution-engineering.md`; sequencing in `07-optimization-roadmap.md`.

| Rank | ID | Impact | Frequency | Effort | Risk | Confidence |
| ---- | -- | ------ | --------- | ------ | ---- | ---------- |
| 1 | **P-00** | Unbounded (prevents recurrence) | n/a | Small | **None** | Confirmed |
| 2 | **P-01** | +5.55 µs/req vs Fastify | **100% of requests** | Small–Medium | Medium (cross-adapter contract) | Confirmed / Strong |
| 3 | **P-02** | +5.23 µs/req on param routes | Most REST traffic | Medium | Medium (mutable reuse) | Confirmed / Strong |
| 4 | **P-03** | +1.22 µs/layer | Every app with middleware | Medium | Medium (8 semantics to preserve) | Confirmed / Strong |
| 5 | **P-04** | Sub-µs | 100% of requests | Small | Low | Confirmed / Hypothesis |
| 6 | **P-05** | Unmeasured, structurally large | Static-serving apps only | Medium | **High** (staleness + security) | Hypothesis |
| 7 | **P-06** | Unmeasured | `send(object)` users only | Small | Low | Confirmed / Hypothesis |

**P-00 is ranked first deliberately.** It is the cheapest item, it has zero risk, and it is the
prerequisite for validating everything below it. Implementing P-01 before a baseline exists would mean
measuring the fix against a moving target.

Continues in `05-solution-engineering.md`.

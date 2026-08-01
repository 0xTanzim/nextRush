# 01 — Benchmark Analysis: separating the floor from the work

**Artifact:** `apps/benchmark/results/2026-07-31T05-36-51` — profile `standard`, wrk 4.2.0, CPU-pinned
cores 2-7, 3 valid runs per cell, `non_2xx = 0` everywhere, Intel i5-8300H, Node v26.5.1.
All figures **[M]** unless marked.

---

## 1. Why the scoreboard misleads

The generated scoreboard reads:

| Rank | Framework | Score | Wins |
| ---- | --------- | ----- | ---- |
| 🥇 | Raw Node.js | 98.0 / 108 | 18 |
| 🥈 | Fastify | 95 / 108 | 13 |
| 🥉 | Hono | 66.1 / 108 | 4 |
| **4** | **NextRush v3** | **64.7 / 108** | **5** |
| 5 | Koa | 34.9 / 108 | 0 |
| 6 | Express | 19.9 / 108 | 0 |

A rank-4 finish invites the conclusion that the router, serializer or response pipeline is slow.
**Per-scenario RPS refutes that.** The correct decomposition, mandated by PERF-001 §2.3 ("never
optimize based on a single benchmark") and §2.6 (identify what executes most frequently), is:

```
   cost(scenario) = FLOOR  +  MARGINAL(scenario)
                    ▲          ▲
                    │          └─ the work the scenario actually asks for
                    └─ everything the framework does on EVERY request
```

`empty-response` (`ctx.status = 204; ctx.send()`) asks for the least work of any scenario, so it is
the closest available estimator of FLOOR. Subtracting each framework's **own** empty-response cost
from its other scenarios isolates MARGINAL, and lets NextRush's *work* be compared to Fastify's
*work* independently of the constant each carries.

---

## 2. Absolute per-request cost (µs = 1e6 / rps)

### @256 connections (saturated)

| Scenario | NextRush | Fastify | Raw Node | NR − Fastify | NR cv |
| -------- | -------- | ------- | -------- | ------------ | ----- |
| hello-world | 30.99 | 30.33 | 27.66 | **+0.66** | 0.8% |
| json-serialize | 32.67 | 29.85 | 28.00 | +2.82 | 1.4% |
| route-params | 39.88 | 32.92 | 31.72 | **+6.96** | 1.9% |
| query-string | 41.69 | 36.74 | 38.27 | +4.96 | 0.5% |
| post-json | 53.55 | 49.00 | 41.31 | +4.56 | 2.7% |
| deep-route | 36.05 | 31.96 | 32.60 | +4.09 | 1.9% |
| middleware-stack | 42.04 | 32.24 | 33.87 | **+9.80** | 2.9% |
| error-handling | 52.37 | 46.56 | 41.92 | +5.81 | 2.3% |
| large-json | 49.55 | 45.44 | 45.58 | +4.11 | 1.1% |
| **empty-response** | **30.48** | **24.89** | **24.22** | **+5.59** | 3.8% |
| send-object | 33.07 | 31.27 | 29.99 | +1.80 | 3.6% |
| static-file | 111.76 | 93.73 | 70.14 | **+18.04** | 1.1% |

### The floor, across the concurrency ladder

| | @1 | @64 | @256 |
| --- | --- | --- | --- |
| NextRush | 36.98 | 28.04 | 30.48 |
| Fastify | 34.45 | 24.37 | 24.89 |
| Raw Node | 31.40 | 23.67 | 24.22 |
| **Excess vs Fastify** | **+2.53** | **+3.68** | **+5.59** |
| **Excess vs Raw Node** | +5.58 | +4.38 | +6.26 |

**The floor excess grows 2.2× from 1 → 256 connections.** A constant-work overhead would stay flat in
µs/req. Growth under concurrency points at per-request state that scales with the number of in-flight
requests — which is exactly the profile of the per-request timer established in report `02`.

---

## 3. Marginal cost — the decisive table

MARGINAL = scenario µs − that framework's own empty-response µs.

### @256 connections

| Scenario | NR marginal | Fastify marginal | Raw marginal | **NR excess vs Fastify** |
| -------- | ----------- | ---------------- | ------------ | ------------------------ |
| hello-world | 0.51 | 5.45 | 3.44 | **−4.93** ✅ |
| json-serialize | 2.19 | 4.97 | 3.79 | **−2.78** ✅ |
| send-object | 2.60 | 6.38 | 5.78 | **−3.79** ✅ |
| deep-route | 5.57 | 7.07 | 8.39 | −1.50 ✅ |
| query-string | 11.21 | 11.85 | 14.05 | −0.63 ✅ |
| post-json | 23.08 | 24.11 | 17.09 | −1.03 ✅ |
| large-json | 19.07 | 20.55 | 21.36 | −1.48 ✅ |
| error-handling | 21.89 | 21.67 | 17.71 | +0.22 |
| route-params | 9.40 | 8.03 | 7.51 | **+1.37** ⚠️ |
| middleware-stack | 11.56 | 7.35 | 9.65 | **+4.21** ⚠️ |
| static-file | 81.28 | 68.84 | 45.93 | **+12.44** ⚠️ |

### @1 connection (no queueing — cleanest per-request work measurement)

| Scenario | NR marginal | Fastify marginal | **NR excess** |
| -------- | ----------- | ---------------- | ------------- |
| query-string | 10.28 | 13.65 | **−3.37** ✅ |
| post-json | 26.91 | 27.44 | −0.53 ✅ |
| large-json | 22.08 | 23.46 | −1.38 ✅ |
| hello-world | 4.71 | 2.81 | +1.90 |
| json-serialize | 6.22 | 3.94 | +2.28 |
| send-object | 7.15 | 4.40 | +2.75 |
| deep-route | 8.82 | 5.27 | +3.54 |
| **route-params** | **9.34** | **4.93** | **+4.41** ⚠️ |
| error-handling | 28.41 | 23.15 | +5.27 ⚠️ |
| **middleware-stack** | **12.74** | **7.52** | **+5.22** ⚠️ |
| **static-file** | **133.71** | **100.13** | **+33.58** ⚠️ |

**Reading the two tables together.** At @1 the picture is less flattering than at @256 — NextRush's
marginal costs are mostly *worse* at low concurrency and mostly *better* at saturation. That is not a
contradiction: at @1 the request path is latency-bound and every extra `await`/microtask boundary is
visible; at @256 the event loop is busy and NextRush's cheaper per-response work dominates. The
scenarios that are worse at **both** concurrency levels are the real, load-independent deficits:

> **route-params, middleware-stack, static-file.** These three, and nothing else.

Everything else is floor.

---

## 4. Correlation: which subsystem owns which deficit

| Deficit | Owner | Attributed in |
| ------- | ----- | ------------- |
| Floor (+2.53 → +5.59 µs, all 12 scenarios) | `adapters/node` — timeout race + drain wrapper (≈2.65 µs of it) | `02` |
| route-params (+4.41 @1 / +1.37 @256) | `router` — params container is a dictionary-mode object; 1-param match allocates 5.1× a static match | `03` |
| query-string — **NextRush already wins** | n/a. `parseQueryString`'s missing `%` fast-path is real but NextRush is 3.37 µs *ahead* of Fastify here. **Deprioritized to P3** | `03` §6 |
| middleware-stack (+5.22 @1 / +4.21 @256) | `router/segment-trie.compileExecutor` per-layer closure + `setNext` + `Promise.resolve` | `05` |
| static-file (+33.58 @1 / +12.44 @256) | `middleware/static` — ≥5 fs ops, zero caching, per-request `toUTCString()` + ETag build | `05` |
| error-handling (+5.27 @1) | `core/error-handler` + `HttpError` construction. **Not investigated** — listed as a gap | `06` §4 |

---

## 5. Latency distribution — ruling out GC pauses

| empty-response @256 | RPS | p50 | p99 |
| ------------------- | --- | --- | --- |
| Raw Node | 41,296 | 5.65 ms | 8.25 ms |
| Fastify | 40,182 | 6.08 ms | 10.11 ms |
| Hono | 35,191 | 6.82 ms | 11.63 ms |
| **NextRush** | **32,810** | **7.24 ms** | **11.73 ms** |

NextRush's p50 is 19% above Fastify's and its p99 is 16% above — **elevated proportionally, not
tail-heavy**. On hello-world NextRush's p99 (9.08 ms) is actually *lower* than Fastify's (11.85 ms)
despite lower throughput.

**Conclusion:** the floor is uniformly-distributed extra *work*, not GC pause spikes or event-loop
stalls. That matters for remediation — it means the fix is removing per-request operations, not
tuning heap/GC flags. It is also consistent with the timer-per-request mechanism in report `02`
(a timer insert/remove is deterministic work, not a pause).

---

## 6. Two benchmark-integrity observations

1. **The tie grouping is generous.** In `query-string @256`, raw-node (26,132), NextRush (23,985) and
   Fastify (27,221) are all reported `rank 1` — a 13.5% spread declared a tie while per-cell cv is
   0.5%. A 13.5% difference at 0.5% variance is not noise. The tie threshold should be derived from
   measured variance, not a fixed band, or the scoreboard will keep hiding real gaps. **[S] — the
   exact rule lives in `scripts/generate-report.js`; not read in this investigation.**
2. **`large-post` has no @64/@256 rows** and no scoreboard entry (`—` in the winners table), so the
   largest-payload path is measured only at @1 (where NextRush is +919 µs / +15% behind Fastify —
   the single largest relative deficit in the whole matrix, and unexamined). Listed as a gap in `06`.

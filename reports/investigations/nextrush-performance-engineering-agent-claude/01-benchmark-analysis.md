# 01 — Benchmark Analysis

**Playbook phase:** Part 2 — Performance Investigation, Sections A & B (§2.1–2.6)
**Evidence:** `apps/benchmark/results/2026-07-27T15-42-50/{results.csv, README-TABLES.md, scoreboard.json}`
**Harness:** wrk 4.2.0, `standard` profile (3 runs per cell, mean ± stddev reported),
Node v26.4.0, Intel i5-8300H @ 2.30 GHz, **CPU pinning off**
**Scope:** 6 servers × 10 scenarios × {1, 64, 256} connections

No benchmarks were executed for this investigation. All figures below are read from, or derived
arithmetically from, the stored run above. Derivations are shown so they can be re-checked.

---

## 1. Data quality assessment (§2.1)

Before drawing conclusions, the run's own reliability was checked.

**Run-to-run variance is low enough to trust.** Coefficient of variation across the 180 measured
cells is ≤ 2.5% for all but four cells. The four exceptions are all at concurrency 1 on the
`query-string` scenario (NextRush 6.44%, Express 6.16%, Fastify 6.34%, Hono 5.38%, Raw Node 5.18%)
— every framework shows it on the same cell, so it is a property of that workload at c=1, not of
any one server. At 64 and 256 connections, where all conclusions in this report are drawn, CV is
typically 0.2–1.7%. Differences of 5% or more at those levels are therefore signal.

**Three caveats that bound the conclusions:**

1. **CPU pinning is off** (`README-TABLES.md` footer). The benchmark's own README states only the
   `standard` (3-run) and `full` (5-run) profiles may back published figures, so a 3-run
   `standard` profile is admissible — but without pinning, cross-framework comparisons carry
   scheduler noise that the CV does not fully capture, because wrk and the server share the same
   4-core/8-thread machine.
2. **Two result directories, one run.** `results/2026-07-27T15-42-22/` and
   `results/2026-07-27T15-42-50/` contain byte-identical file sizes, and the CSV inside *both*
   carries `run_id = 2026-07-27T15-42-50`. These are not two independent samples; treating them as
   such would double-count. See `appendix/benchmark-notes.md`.
3. **`results/latest/` is a partial run.** It contains only `raw-node.json` (dated later,
   2026-07-28) with a 7 KB report versus the full run's 52 KB. It is a single-framework run and is
   not comparable; it was excluded from all analysis.

---

## 2. Overall standing (§2.1)

From `README-TABLES.md`, over 8 like-for-like scenarios × 3 concurrency levels × 6 frameworks
(a scenario win = 6 points, last = 1):

| Rank | Framework | Score | Scenario wins |
| ---- | --------- | ----- | ------------- |
| 1 | Raw Node.js | 139 / 144 | 19 |
| 2 | Fastify | 112 / 144 | 0 |
| 3 | Hono | 91 / 144 | 0 |
| **4** | **NextRush v3** | **90 / 144** | **5** |
| 5 | Koa | 45 / 144 | 0 |
| 6 | Express | 27 / 144 | 0 |

The 90-vs-91 separation from Hono is within noise and should not be read as a ranking. The
informative anomaly is the **wins column**: NextRush is the only framework other than the raw
baseline to win any scenario outright, yet it scores below Hono which won none. A framework that
wins scenarios but scores low is winning them all in one regime and losing everywhere else.

All five NextRush wins are at **concurrency 1**.

---

## 3. Performance gaps (§2.2)

### 3.1 Throughput at 256 connections (saturated regime)

Requests/sec, mean of 3 runs. `Δ` columns are NextRush relative to that framework.

| Scenario | NextRush | Raw Node | Δ raw | Fastify | Δ Fastify | Hono | Δ Hono |
| -------- | -------- | -------- | ----- | ------- | --------- | ---- | ------ |
| Empty Response | 32,999 | 44,043 | **−25.1%** | 40,407 | −18.3% | — ¹ | — |
| Hello World | 28,917 | 35,316 | **−18.1%** | 34,342 | −15.8% | 30,715 | −5.9% |
| JSON Serialization | 28,388 | 35,281 | **−19.5%** | 33,850 | −16.1% | 30,381 | −6.6% |
| Deep Route | 25,913 | 33,408 | **−22.4%** | 31,681 | −18.2% | 28,251 | −8.3% |
| **Route Parameters** | 23,878 | 33,607 | **−28.9%** | 32,056 | **−25.5%** | 28,027 | **−14.8%** |
| Query Strings | 22,739 | 27,363 | −16.9% | 26,456 | −14.1% | 23,618 | −3.7% |
| **Middleware Stack** ² | 22,217 | 29,815 | **−25.5%** | 29,869 | **−25.6%** | 23,651 | −6.1% |
| Large JSON | 19,198 | 21,636 | −11.3% | 21,312 | −9.9% | 19,641 | −2.3% |
| Error Handling ² | 17,965 | 24,391 | −26.3% | 19,903 | −9.7% | 19,886 | −9.7% |
| POST JSON | 17,909 | 25,201 | **−28.9%** | 19,813 | −9.6% | 19,970 | −10.3% |

¹ Hono's Empty Response @256 cell was not captured in this pass; its @64 value is 37,143.
Immaterial to any conclusion — see `appendix/open-questions.md`.
² Labelled *idiomatic, not like-for-like* by the harness; excluded from the scoreboard. Each
framework uses its own middleware/error mechanism. Still analysable because each server's own
`hello-world` provides an internal control (§4.2).

**Widest like-for-like gaps vs Fastify:** Route Parameters (−25.5%), Deep Route (−18.2%),
Empty Response (−18.3%), JSON Serialization (−16.1%), Hello World (−15.8%).

Route Parameters is the widest, and it is wider than Hello World — which means parameter handling
carries a cost *above* the framework's fixed overhead, not merely inherits it. Note also that
POST JSON and Error Handling look catastrophic against raw Node (−28.9%, −26.3%) but are close to
Fastify (−9.6%, −9.7%): raw Node's naive string-concat body read and local `try/catch` are simply
much cheaper than what any real framework does. Those two gaps are **not** NextRush-specific and
are not investigation items.

### 3.2 The concurrency-1 inversion

| Scenario @ 1 conn | NextRush | Raw Node | Fastify | Hono | NextRush rank |
| ----------------- | -------- | -------- | ------- | ---- | ------------- |
| Hello World | **27,318** | 25,586 | 24,616 | 24,507 | **1st** |
| JSON Serialization | **27,182** | 25,652 | 24,099 | 24,069 | **1st** |
| Query Strings | **22,156** | 21,677 | 19,878 | 19,617 | **1st** |
| Deep Route | **25,643** | 25,201 | 23,898 | 22,878 | **1st** |
| Large JSON | **18,653** | 18,307 | 17,184 | 17,111 | **1st** |
| Route Parameters | 23,989 | 25,451 | 23,588 | 22,997 | 2nd |
| Empty Response | 27,740 | 29,658 | 29,556 | 27,623 | 3rd |

NextRush beats the zero-framework `node:http` baseline on five scenarios at concurrency 1. A
framework cannot do less work than the baseline it wraps, so this is **not** evidence of lower CPU
cost. At concurrency 1 the measurement is latency-bound — ~36–39 µs per round trip is dominated by
loopback and syscall latency, not by JavaScript execution — so it primarily reflects how many
socket writes and what TCP behaviour each server produces per response, and the raw-node server's
`writeHead()` + `end()` pair is not automatically optimal.

The correct reading: **NextRush's response write path is at least as efficient as raw
`node:http`'s, and its per-request CPU cost is materially higher.** The first property dominates
at c=1; the second dominates once the event loop saturates. Section 03's `response.md` supports
the first half (`ctx.json` was already trimmed to a single `writeHead` + `end`, HP-14); Sections
03/04 establish the second.

### 3.3 Scaling ratio — the primary finding

Throughput multiplier from 1 → 64 connections. A healthy server gains substantially; a
CPU-saturated one does not.

| Scenario | NextRush | Fastify | Raw Node | Hono | Koa | Express |
| -------- | -------- | ------- | -------- | ---- | --- | ------- |
| Hello World | **×1.11** | ×1.43 | ×1.42 | ×1.25 | ×1.25 | ×1.20 |
| JSON Serialization | **×1.07** | ×1.42 | ×1.40 | ×1.29 | ×1.26 | ×1.18 |
| Route Parameters | **×1.01** | ×1.39 | ×1.35 | ×1.25 | ×1.25 | ×1.15 |
| Deep Route | **×1.02** | ×1.40 | ×1.34 | ×1.27 | ×1.23 | ×1.15 |
| Middleware Stack | **×1.01** | ×1.35 | ×1.31 | ×1.28 | ×1.22 | ×1.15 |
| Query Strings | **×1.04** | ×1.35 | ×1.30 | ×1.26 | ×1.25 | ×1.13 |
| Large JSON | **×1.05** | ×1.26 | ×1.19 | ×1.18 | ×1.17 | ×1.12 |
| Empty Response | ×1.22 | ×1.36 | ×1.53 | ×1.35 | ×1.36 | ×1.26 |
| POST JSON | ×1.24 | ×1.21 | ×1.33 | ×1.25 | ×1.20 | ×1.16 |
| Error Handling | ×1.20 | ×1.23 | ×1.24 | ×1.09 | ×1.13 | ×1.02 |

**NextRush has the worst concurrency scaling in the suite on seven of ten scenarios — behind
Express.** On Route Parameters, Deep Route and Middleware Stack it gains ~1%, meaning 64× more
offered load produces no additional throughput at all: the server is already at its CPU ceiling
with a single connection in flight.

The two scenarios where it scales *normally* (POST JSON ×1.24, Error Handling ×1.20) are the two
where per-request work is dominated by something other than the framework pipeline — body I/O
event handling and exception construction respectively. That contrast is itself evidence: when the
bottleneck is elsewhere, NextRush scales like its peers; when the bottleneck is the framework
pipeline, it does not.

**Confidence: Confirmed** (directly measured, consistent across scenarios, low CV, same pattern in
all three comparison baselines).

---

## 4. Cost decomposition (§2.3 input)

### 4.1 Method

Throughput at saturation is converted to CPU time per request: `µs/req = 1,000,000 / rps`. At 256
connections the event loop is saturated and Node is single-threaded, so this is a good proxy for
per-request CPU cost. It is *not* a direct CPU measurement — it also absorbs kernel and syscall
time, which is why the resulting figures are used for **comparison between frameworks on the same
scenario**, never as absolute CPU numbers.

| Scenario @256 | Raw Node | Fastify | Hono | NextRush | Koa | Express |
| ------------- | -------- | ------- | ---- | -------- | --- | ------- |
| Empty Response | 22.71 | 24.75 | — | **30.30** | 34.15 | 31.98 |
| Hello World | 28.32 | 29.12 | 32.56 | **34.58** | 42.08 | 51.96 |
| JSON Serialization | 28.34 | 29.54 | 32.92 | **35.23** | 41.65 | 52.08 |
| Deep Route | 29.93 | 31.57 | 35.40 | **38.59** | 44.39 | 55.23 |
| Route Parameters | 29.76 | 31.19 | 35.68 | **41.88** | 44.70 | 54.94 |
| Query Strings | 36.55 | 37.80 | 42.34 | **43.98** | 51.51 | 61.56 |
| Middleware Stack | 33.54 | 33.48 | 42.28 | **45.01** | 47.39 | 57.04 |
| Large JSON | 46.22 | 46.92 | 50.91 | **52.09** | 59.48 | 78.23 |
| Error Handling | 41.00 | 50.24 | 50.29 | **55.67** | 61.75 | 71.87 |
| POST JSON | 39.68 | 50.47 | 50.08 | **55.84** | 63.50 | 73.91 |

### 4.2 Isolating each subsystem

Subtracting each framework's **own** floor removes fixed overhead and isolates the marginal cost
of the feature under test. Using each server as its own control makes even the "idiomatic"
scenarios comparable, because the mechanism difference is bounded by the delta, not the absolute.

**Fixed per-request floor** (Empty Response: 204, no body, no params, no serialization):

| | Raw Node | Fastify | NextRush |
| --- | --- | --- | --- |
| Floor | 22.71 µs | 24.75 µs | **30.30 µs** |
| Overhead vs raw | — | +2.04 µs | **+7.59 µs** |
| Overhead vs Fastify | — | — | **+5.55 µs** |

**Marginal cost by subsystem** (`scenario µs/req − that framework's own floor`):

| Subsystem (isolation) | NextRush | Fastify | Raw Node | Hono | Verdict |
| --------------------- | -------- | ------- | -------- | ---- | ------- |
| JSON of small object (hello − floor) | 4.28 | 4.37 | 5.61 | — | **Parity / best** |
| JSON of user object (json-ser − floor) | 4.93 | 4.79 | 5.63 | — | **Parity** |
| Param extraction (route-params − hello) | **7.30** | 2.07 | 1.44 | 3.12 | **3.5× Fastify** |
| Deep param extraction (deep-route − hello) | **4.01** | 2.45 | 1.61 | 2.84 | 1.6× Fastify |
| Query parsing (query-string − hello) | 9.40 | 8.68 | 8.23 | 9.78 | Near parity |
| Middleware, 5 layers (mw − hello) | **10.43** | 4.36 | 5.22 | 9.72 | **2.4× Fastify** |
| ⤷ per layer | **2.09** | 0.87 | 1.04 | 1.94 | |
| Large JSON body (large − hello) | 17.51 | 17.80 | 17.90 | 18.35 | **Parity** |
| Body parse + JSON.parse (post − hello) | 21.26 | 21.35 | 11.36 | 17.52 | **Parity w/ Fastify** |
| Error path (error − hello) | 21.09 | 21.12 | 12.68 | 17.73 | **Parity w/ Fastify** |

### 4.3 What this says

The competitive gap resolves into exactly **three** addressable components:

| Component | NextRush penalty vs Fastify | Where it shows up |
| --------- | --------------------------- | ----------------- |
| Fixed per-request floor | **+5.55 µs** | Every scenario, 100% of requests |
| Param extraction | **+5.23 µs** | route-params, deep-route |
| Middleware dispatch | **+1.22 µs × layers** | any app with `use()`/per-route middleware |

Summed for the widest scenario: on route-params, `5.55 + 5.23 = 10.78 µs` of the measured 10.69 µs
gap vs Fastify (`41.88 − 31.19`) is accounted for. The decomposition closes the gap essentially
completely, which is strong evidence that these three mechanisms are the whole story and nothing
significant is unaccounted for.

---

## 5. Negative findings — do not optimise these (§2.3)

Stating these explicitly is as valuable as the positive findings, because each represents effort
that would produce no measurable gain:

- **JSON serialization is at parity or better.** `large-json − hello` is 17.51 µs for NextRush vs
  17.80 µs Fastify and 17.90 µs raw Node. All three are paying the same `JSON.stringify`. There is
  no schema-compiled-serializer gap to close here (Fastify's `fast-json-stringify` is not engaged
  in this harness, so this comparison does not rule out a *future* advantage from
  compiled serialization — it only rules out a *current* deficit).
- **Body parsing is at parity with Fastify** (21.26 vs 21.35 µs). The 2× gap against raw Node is
  the cost of a real, limit-enforcing, cross-runtime parser versus a string concatenation with no
  content-type negotiation. That gap is a correctness feature, not a defect.
- **Query-string parsing is within 0.7 µs of Fastify** and within 1.2 µs of raw Node's
  `URLSearchParams`. Not an investigation item.
- **The error path is at parity with Fastify** (21.09 vs 21.12 µs). The `setErrorHandler` design
  correctly imposes zero per-request cost when nothing throws — visible in the fact that
  `hello-world` is unaffected. The absolute cost is dominated by V8 `Error` construction and stack
  capture, which is a Node-level cost, not a framework one.
- **The `deep-route` scenario is *not* worse than `route-params` for NextRush** — it is 8.5%
  *better* (25,913 vs 23,878 rps), despite three parameters and eight path segments versus one and
  two. NextRush is the only framework showing this inversion (raw Node and Fastify are marginally
  faster on `route-params`). The segment trie therefore scales well with depth; the problem is a
  fixed per-param-match cost, not depth. The inversion itself is unexplained and is logged as an
  open question.

---

## 6. Fairness and parity assessment

The harness's fairness posture was reviewed rather than assumed, since unfair benchmarks produce
findings that evaporate on correction.

**Verified sound:**
- Response bodies come from one shared module (`servers/_shared/payloads.js`) imported by all six
  servers, so serialization input is byte-identical.
- `pnpm bench:validate` exists and asserts byte-identical bodies, statuses and middleware headers
  across all six servers before timing (`apps/benchmark/README.md`).
- The raw-node baseline is deliberately *not* strawmanned: its middleware scenario runs a genuine
  5-layer function chain with a real `next()`, and it enforces a 1 MB body cap on POST, so it pays
  comparable dispatch and safety costs.
- The NextRush server uses `app.setErrorHandler` rather than a per-request `try/catch` middleware,
  matching Fastify/Express/Hono's dedicated handlers — so NextRush is not penalised on the eight
  scenarios that never throw.
- Both labelled-unfair scenarios (middleware, error) are excluded from the scoreboard.

**One structural caveat worth recording:** the NextRush server mounts a single router at the root
(`app.route('/', router)`), which hits the root-mount fast path and produces a
**one-entry middleware stack**. That is the most favourable possible shape for NextRush's
`compose()` (it takes the `len === 1` fast path). The measured gaps are therefore a
**lower bound** — a realistic application with several `app.use()` layers would take the general
recursive dispatch path and widen the gap. This does not invalidate anything; it means the
findings understate rather than overstate.

---

## 7. Investigation priorities (§2.3) and questions (§2.4)

| Priority | Investigation item | Driven by | Target subsystem |
| -------- | ------------------ | --------- | ---------------- |
| **P0** | Why is the fixed per-request floor +5.55 µs above Fastify, and why does throughput not scale with concurrency? | §3.3, §4.2 | Node adapter handler, Context |
| **P0** | Why does param extraction cost 3.5× Fastify's? | §4.2 | Router (`matchRoute`) |
| **P1** | Why does each middleware layer cost 2.4× Fastify's? | §4.2 | `compose`, `compileExecutor` |
| **P2** | Is any per-request work performed for properties handlers never read? | §4.2 floor | Context construction |
| **P3** | Are there hot paths with no benchmark coverage at all? | coverage gap | Static files |

**Investigation questions carried into Part 3/4:**

1. What work does NextRush perform on 100% of requests that Fastify does not?
2. Does any per-request structure grow in cost or live-object count with in-flight concurrency —
   which would explain flat scaling specifically rather than merely a high fixed cost?
3. Which allocations occur per request in the param path, and can they move to registration time?
4. Is the per-layer middleware cost closure allocation, promise allocation, or microtask hops?
5. Is any of this attributable to a specific, datable change?

**Scope excluded** per §2.5 (no measured gap): serializer internals, body-parser internals, query
parser, error-handling pipeline.

Continues in `02-runtime-profiling.md`.

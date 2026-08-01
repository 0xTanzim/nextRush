# Subsystem Analysis — Request (Adapter Handler / Lifecycle)

**Playbook phase:** Part 4 §4.11, §4.15 (Request Lifecycle, Request). **Status: Structural analysis
Completed; performance-contribution analysis Blocked** (see [`../02-runtime-profiling.md`](../02-runtime-profiling.md)).

Related canonical reports: [`../01-benchmark-analysis.md`](../01-benchmark-analysis.md) (scaling
pattern established by 64c) · [`../04-root-cause-analysis.md`](../04-root-cause-analysis.md)
(Hypothesis priority 1 — the highest-ranked hypothesis in this investigation) ·
[`../05-solution-engineering.md`](../05-solution-engineering.md) (conditional adapter experiment).

This file covers the request's entry point through the Node adapter — the handler-timeout and
lifecycle machinery that wraps every request before router/middleware dispatch — because this is
where the investigation's single highest-priority hypothesis lives.

## Purpose

The adapter's `serve`/`createHandler` path is the boundary between Node's raw HTTP server and the
framework's Context/router/middleware pipeline. It is responsible for constructing the per-request
`NodeContext`, invoking the composed application callback, and enforcing a request-level timeout so
a hung handler cannot hold a connection open indefinitely.

## Present design

**Confirmed (structure and configuration):**
- `apps/benchmark/servers/nextrush-v3.js` calls `listen(app, PORT)` with **no options**.
- The adapter's `serve` function **defaults `timeout` to `DEFAULT_TIMEOUT_MS` (30,000ms)** when no
  option is passed, and passes that value to `createHandler`.
- **Therefore the benchmark configuration definitely exercises the enabled timeout-handling code
  path on every request** — this is a configuration fact, not an inference.
- `createHandler` allocates a `NodeContext` plus `finalizeSuccess`/`finalizeError` closures per
  request, regardless of timeout setting.
- When timeout is enabled (as it is here), the handler path additionally involves: a `Symbol`, a
  handler promise, a `Promise.race` array and race, a "follower" `.then`, a separate timeout
  `Promise`, a `setTimeout` call, and the executor/callback closures and `.then`/`.catch` chains
  that wire all of the above together.
- A `timeout <= 0` **fast path already exists** in the adapter, structurally distinct from the
  enabled-timeout path described above — meaning the codebase already has the mechanism needed to
  isolate this variable for an A/B test.
- `Application.callback` composes middleware once at boot; each request then awaits the composed
  chain and handles errors at the top level (see [`middleware.md`](./middleware.md) for the compose
  internals).

## Benefits of the present design

- A request-level timeout is a documented, deliberate safety property: without it, a hung
  handler (application bug, stalled upstream call) can hold a connection and its associated
  resources open indefinitely — a real production-hardening concern, not incidental complexity.
- `Promise.race` is a standard, well-understood pattern for implementing "whichever finishes
  first" semantics (handler completion vs. timeout), and using it preserves clear, auditable
  timeout/rejection/cleanup behavior rather than a bespoke state machine that would need its own
  correctness argument.
- The existing `timeout <= 0` fast path shows the design already anticipated that some deployments
  or benchmarks might want to disable this cost, which is precisely what makes a clean A/B
  possible without any source change (see [`../07-optimization-roadmap.md`](../07-optimization-roadmap.md) P0).

## Structural costs

The enabled-timeout path allocates strictly more objects (Symbol, handler promise, race array,
follower `.then`, timeout Promise, setTimeout handle, executor/callback closures, then/catch
chains) than the disabled path, on **every single request** in this benchmark, because the
benchmark server never opts out of the default. This is the largest concentration of structurally
distinct, request-scoped allocation-and-scheduling machinery identified anywhere in the current
source reading — which is why it is ranked the #1 hypothesis, not because its cost has been
measured.

## Evidence status

| Claim | Status |
| --- | --- |
| Benchmark server calls `listen(app, PORT)` with no options | **Confirmed** (source reading of `apps/benchmark/servers/nextrush-v3.js`) |
| Adapter default `timeout` is `DEFAULT_TIMEOUT_MS` = 30,000ms, applied when unspecified | **Confirmed** (source reading) |
| Benchmark therefore exercises the enabled-timeout code path on every request | **Confirmed** (follows directly from the two facts above — configuration fact, not inference about cost) |
| `createHandler` allocates `NodeContext` + two closures unconditionally | **Confirmed** (source structure) |
| Enabled path adds Symbol/promise/race/timer/closure machinery on top | **Confirmed** (source structure) |
| A `timeout <= 0` fast path exists | **Confirmed** (source structure) |
| This machinery is a *measurable* contributor to the RPS gap, at any magnitude | **Hypothesis** — exact cost is explicitly unmeasured per the evidence ledger; no profile or A/B exists yet |

## Finding

### F-ADAPTER-01 — Benchmark exercises the adapter's default enabled-timeout machinery on every request; magnitude of its contribution to the RPS gap is unmeasured

- **Status/confidence:** Configuration and structure Confirmed; performance impact Hypothesis.
- **Priority:** P1 — **highest-ranked hypothesis in this investigation** (see
  [`../04-root-cause-analysis.md`](../04-root-cause-analysis.md)), because it is the only candidate
  that is (a) confirmed to execute on literally every benchmarked request, and (b) has an existing,
  low-risk, one-variable diagnostic path (`timeout <= 0`) already built into the code.
- **Current situation/evidence:** See "Present design" above. The scaling pattern in
  [`../01-benchmark-analysis.md`](../01-benchmark-analysis.md) §4 (gap established by 64c, roughly
  flat to 256c) is consistent with a fixed per-request cost that does not itself scale
  pathologically with concurrency, which is compatible with — but does not prove — a
  per-request Promise/timer allocation cost rather than, say, a lock-contention or queueing
  problem that would worsen disproportionately at higher concurrency.
- **Present-design benefits:** documented production safety property (hang protection); standard,
  auditable `Promise.race` pattern; existing fast-path escape hatch.
- **Root cause:** Unknown — pending the P0 timeout=0 A/B in
  [`../07-optimization-roadmap.md`](../07-optimization-roadmap.md).
- **Runtime/performance impact:** Unknown; explicitly not to be estimated or forecast per this
  investigation's constraints.
- **Recommendation:** Run the diagnostic `timeout=0` vs. default-timeout A/B as one-variable
  evidence gathering (P0). This is **not** a recommendation to disable timeouts in production or to
  tune for benchmark optics — it is measurement only.
- **Alternatives:** If the A/B shows the timeout path is causal, evaluate (not implement) a
  behavior-preserving single-settlement state machine as an alternative to `Promise.race`, subject
  to preserving: clean 504 on timeout, late-settlement suppression (the loser of the race must not
  leak a result or throw unhandled), rejection handling, socket-timeout independence (HTTP-level
  timeout vs. TCP/socket timeout are distinct concerns and must stay so), clean shutdown behavior,
  and cross-adapter parity (`adapters/conformance`). Any default or contract change here is
  RFC/ADR-gated per `tdd-workflow.md` (repo) and `AGENTS.md` §20 — this investigation does not
  propose or draft that RFC.
- **Trade-offs:** Not assessed at solution level — no solution is proposed, only a diagnostic
  experiment. See [`../05-solution-engineering.md`](../05-solution-engineering.md) for the full
  alternatives/trade-off framing that would apply *if* the A/B is causal.
- **Risks:** Treating the diagnostic A/B's result as a production recommendation without the
  RFC/ADR/migration-analysis step; conflating "faster with timeout disabled" with "safe to disable
  by default."
- **Expected improvement:** Unknown — this investigation states a decision threshold, not a
  forecast (see [`../07-optimization-roadmap.md`](../07-optimization-roadmap.md) and
  [`../06-validation-regression.md`](../06-validation-regression.md)): reproducible ≥5% RPS
  improvement at 64c and 256c, non-overlapping/noise-aware evidence, lower bytes/request, no
  p99/semantic regression, before this hypothesis is treated as go for solution engineering.
- **Migration difficulty:** Not assessed — no change proposed, only measurement.
- **Validation:** Full matrix in [`../06-validation-regression.md`](../06-validation-regression.md).

## Edge cases (playbook §4.9)

Client disconnects mid-request, slow/stalled handlers that legitimately need the timeout to fire,
and interaction between the adapter timeout and a downstream socket-level timeout are all
correctness-relevant to any future change here and are explicitly called out as properties that
must not regress (see Recommendation above). None are separately benchmarked; their behavior is
otherwise Unknown in the current data.

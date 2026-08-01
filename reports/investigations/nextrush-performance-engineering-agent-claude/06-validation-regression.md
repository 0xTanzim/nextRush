# 06 — Validation & Regression

**Playbook phase:** Part 7 — Validation & Regression (§7.1–7.6, Sections A–C)

Nothing in `05-solution-engineering.md` may be called successful without passing the gate defined
here. Because no optimisation has been implemented — this is an audit workspace, and the execution
policy forbids running benchmarks or builds — **every validation below is a protocol to execute, not
a result.** That distinction is stated explicitly per playbook §7.6.

---

## 0. Validation preconditions

Two things must exist before any validation is meaningful. Both are missing today.

| Precondition | Status | Consequence if skipped |
| ------------ | ------ | ---------------------- |
| A **pinned baseline** in `apps/benchmark/results/baseline/` | ❌ Missing (path whitelisted in `.gitignore`, directory empty) | Every "improvement" is measured against a re-measured, differently-noisy control. This is exactly why P-01's magnitude is unquantifiable today. |
| A **CPU-pinned environment** | ❌ Current run has pinning off | Cross-framework deltas below ~5% are not separable from scheduler noise |

**S-00 must land first.** Validating S-01 against an unpinned, unstored baseline would produce a number
nobody should trust.

## 1. Validation criteria (§7.1)

Universal gates — every optimisation must satisfy all of them:

| Gate | Threshold | Rationale |
| ---- | --------- | --------- |
| **Correctness** | 100% of the touched package's suite passes | Non-negotiable (playbook §1.6) |
| **Cross-adapter parity** | `packages/adapters/conformance` fully green | Observable behaviour must stay identical across Node/Bun/Deno/Edge/Serverless |
| **No throughput regression** | No scenario at any concurrency drops >2% (mean of 3+ runs) | 2% is above the observed CV (≤1.7% at 64/256 conn) and below a real regression |
| **No allocation regression** | Bytes/request non-increasing on the relevant `bench:alloc:*` harness | These harnesses are deterministic (`cv≈0`), so any increase is real |
| **No latency-tail regression** | p99/p50 ratio does not worsen by >5% | Guards against trading throughput for jitter |
| **Public API unchanged** | No `ServeOptions`/`Context`/`Middleware` surface change | Every solution in S-01…S-06 is internal by design; a surface change would make it RFC-gated |

Per-solution criteria follow. Each names the **specific measurement** that would show the fix worked,
and — importantly — the measurement that would show the report's *reasoning* was wrong.

---

## 2. V-01 — S-01, timeout race (Critical)

**Success criteria:**

| Metric | Baseline (measured) | Target | Instrument |
| ------ | ------------------- | ------ | ---------- |
| Empty Response @256 | 32,999 rps (30.30 µs/req) | ≥ 35,000 rps | `bench:compare --profile full` |
| Hello World @256 | 28,917 rps | ≥ 30,500 rps | same |
| Fixed floor vs Fastify | +5.55 µs | ≤ +3.5 µs | derived from Empty Response |
| Allocations in `createHandler` | unmeasured | ≥ 50% reduction | **new** `bench:alloc:handler` harness |
| Scaling ratio, Hello World c1→c64 | ×1.11 | ≥ ×1.20 | derived |

**Behavioural verification (§7.3) — all mandatory:**

1. Handler exceeding `timeout` → `504` with the documented JSON body.
2. `ctx.triggerTimeout()` fires and `ctx.signal` aborts, so cooperative handlers cancel.
3. Timeout does **not** clobber a response the handler already committed
   (`!ctx.responded && !res.headersSent` guard intact).
4. **Handler rejecting *after* the timeout responded produces no `unhandledRejection`.** Assert on the
   process event, not just absence of a crash — this is the single most likely regression.
5. `timeout: 0` behaves exactly as today (fast path preserved).
6. `timeout` still settable per `serve()`/`listen()` call.
7. Socket-level `server.timeout` still set and still independent — the two guards are complementary by
   design (F-04) and removing one is out of scope.
8. **`packages/adapters/conformance` fully green.** Non-negotiable: this code exists to satisfy a
   cross-adapter contract.

**Falsification test — what would prove this report wrong:** if allocations in `createHandler` drop by
half and Empty Response throughput moves by **less than 1%**, then P-01 was not a material share of the
floor, the floor's cause lies elsewhere, and §3 of `04-root-cause-analysis.md` must be re-opened. Record
this outcome if it occurs rather than attributing the gain elsewhere.

**Regression sweep (§7.4):** all 10 scenarios × 3 concurrency levels. Particular attention to POST JSON
and Error Handling — both traverse the modified adapter path and both are currently at Fastify parity, so
they are where a regression would be most damaging.

---

## 3. V-02 — S-02, param path containers (Critical)

| Metric | Baseline (measured) | Target | Instrument |
| ------ | ------------------- | ------ | ---------- |
| Route Parameters @256 | 23,878 rps (41.88 µs/req) | ≥ 27,000 rps | `bench:compare --profile full` |
| Param marginal cost vs Fastify | +5.23 µs | ≤ +2.5 µs | derived (route-params − hello) |
| Param match allocation | 339.87 B/op (prior report, unverified at HEAD) | ≤ 170 B/op | `bench:alloc:param-match` |
| Static match allocation | 64.24 B/op (prior report) | Non-increasing | `bench:alloc:router-match` |
| Scaling ratio, route-params c1→c64 | ×1.01 | ≥ ×1.20 | derived |

**Behavioural verification — all mandatory:**

1. **Param named `__proto__` / `constructor` / `prototype` binds as an own key with no prototype
   mutation.** The security guarantee that constrains the whole design.
2. Dot-segment path → `400` and the chain **stops** (does not fall through to 404, which would leak the
   un-normalised target via `ctx.path`).
3. Case-insensitive matching still extracts **original-case** param values.
4. Trailing-slash behaviour unchanged under both `strict` settings.
5. Percent-encoded params still decoded when `decode: true`.
6. `ctx.originalPath` still set correctly.
7. **Concurrency-interleaving test (specific to B1/B3a):** drive many simultaneous requests across
   several distinct param routes and assert no request ever observes another's params. This is the test
   that protects the synchronous-consumption invariant the reused bind stacks depend on.

**Additional required step:** run `bench:alloc:param-match` **before** any change, at current HEAD. The
prior review recorded param allocation rising 169.4 → 339.87 B/op after the router trim and dismissed it
as transient garbage. That number has never been confirmed at HEAD. Establishing the true current
baseline is a prerequisite, not an afterthought.

---

## 4. V-03 — S-03, middleware compilation (High)

| Metric | Baseline (measured) | Target | Instrument |
| ------ | ------------------- | ------ | ---------- |
| Middleware Stack @256 | 22,217 rps (45.01 µs/req) | ≥ 25,000 rps | `bench:compare --profile full` |
| Per-layer cost | 2.09 µs | ≤ 1.4 µs | derived ((mw − hello) / 5) |
| Dispatch allocation | 56.1 B/req (prior gate) | Non-increasing | `bench:alloc:dispatch` |
| Compose allocation | — | Non-increasing | `bench:alloc:compose` |

**Target is deliberately 1.4 µs, not Fastify's 0.87 µs.** As `05-solution-engineering.md` S-03 states
honestly, C1 does not remove the per-layer `next` closures — those need per-request state. Setting the
target at parity would be setting up a claim the mechanism cannot deliver.

**Behavioural verification — the eight semantics from `03-subsystem-analysis/middleware.md` §9, each as
its own test:**

1. Double `next()` → rejects with `next() called multiple times`.
2. `ctx.next()` advances the same chain as the `next` argument.
3. Synchronous throw → rejection, not a sync throw.
4. Non-`Error` throw → wrapped in `new Error(String(err))`.
5. Non-promise **thenable** return → adopted and awaited (this is why `Promise.resolve` exists; C2 must
   not break it).
6. **Handler calling `ctx.next()` is a safe no-op and does *not* leak into app-level middleware mounted
   after the router** (`NOOP_NEXT` termination, NF-4a). Highest-risk semantic in the change.
7. Layer responding without calling next terminates the chain.
8. Concurrent requests through the same compiled route never share mutable state.

**Coverage gap to close first:** the benchmark's single-root-router shape gives `compose` its
`len === 1` fast path, so the **general recursive path is never benchmarked**. Add a scenario with 2–3
`app.use()` layers *before* validating S-03, or the change's main beneficiary stays unmeasured.

---

## 5. V-04 — S-04, lazy `ctx.ip` (Medium)

| Metric | Baseline | Target |
| ------ | -------- | ------ |
| Context allocation, `ip` unread | — | Reduced | `bench:alloc:context` |
| Empty Response @256 | 32,999 rps | Non-decreasing |
| **`NodeContext` remains monomorphic** | — | **No hidden-class regression** |

The hidden-class check is the real gate. Removing a constructor assignment changes the object's shape;
if `ip` becomes a prototype getter while other code paths still assign it, `NodeContext` could go
polymorphic and cost more than the assignment saved. Verify with `--allow-natives-syntax` and
`%HaveSameMap()` across two instances, or by confirming `bench:alloc:context` and Empty Response
throughput both move the right way. **If throughput does not improve, revert** — this optimisation is
worth nothing if it introduces a deopt.

**Behavioural:** `ctx.ip` returns the same value as today for `proxy: false` and for every configured
`proxy` trust setting; policy precedence still matches Bun/Deno/Edge.

---

## 6. V-05 — S-05, static-file cache (Medium) — BLOCKED

**This validation cannot be defined yet, and that is the finding.** There is no static-file benchmark
scenario, so there is no baseline against which a cache could be validated.

**Required before S-05 may be implemented at all:**

1. Add scenarios: cached hit (small file), cache miss (404), large file (≥1 MB), and a
   `?v=` cache-busting variant.
2. Establish baseline rps and syscall count per request (`strace -c -f` counting `stat`/`lstat`/`open`).
3. Then define targets, e.g. "syscalls per repeat hit: N → 1" and "cached-hit rps ≥ X".

**Behavioural verification (mandatory whenever it is implemented) — these are security tests, not
performance tests:**

1. `..` traversal still rejected — screens run **before** cache lookup.
2. Null byte still rejected.
3. **Symlink escaping the root still rejected even when the path is cached.** The cache must never store
   the safety verdict; assert by creating a symlink escape *after* a legitimate cache entry exists for
   the same path.
4. File replaced on disk is re-served within the configured TTL bound.
5. **File deleted after caching → graceful failure, not a 200 followed by an open error.**
6. Dotfile policy still enforced on cache hits.
7. Negative cache is bounded and cannot be grown without limit by requesting unique missing paths.

---

## 7. V-06 — S-06, `send()` dispatch (Medium) — BLOCKED

No scenario calls `ctx.send(object)`, so the current cost is unmeasured and an improvement would be
unmeasurable. **Add a `send(object)` scenario first.**

**Behavioural verification:**
1. `send(Buffer)` → `application/octet-stream`, **not** JSON-serialised. The constraint that forbids a
   naive reorder.
2. `send(Uint8Array)`, `send(ArrayBuffer)` → binary.
3. `send(nodeStream)`, `send(webStream)` → streamed, with backpressure and disconnect handling intact.
4. `send(plainObject)` → identical output to `json(plainObject)`.
5. `send(null)` / `send(undefined)` → bare `end()`.
6. `send(42)` / `send(true)` → `text/plain` via `String(data)`.
7. HEAD/204/304 body suppression unchanged across every branch.

---

## 8. Regression analysis (§7.4) and scalability (§7.5)

**Cross-scenario sweep after *every* change**, not only the targeted one. Required matrix:

| Axis | Values |
| ---- | ------ |
| Scenarios | all 10 |
| Concurrency | 1, 64, 256 |
| Runs | ≥3 (`standard`), ≥5 (`full`) for any published figure |
| Tools | wrk **and** autocannon — a change that helps under one load generator and hurts under the other is a red flag |

**Scenario-specific watch list:**

| Watch | Why |
| ----- | --- |
| **Concurrency 1** | NextRush currently *wins* five scenarios here. A change that improves saturated throughput while losing the c=1 advantage is a **trade, not a win**, and must be reported as such. This is the most likely unnoticed regression across S-01…S-03. |
| POST JSON, Error Handling | Currently at Fastify parity; both traverse the adapter path modified by S-01 |
| Large JSON | Should improve by the **same absolute µs** as Hello World when S-01 lands. If it does not, the floor attribution in this report is wrong (see `serializer.md` §10). |
| Deep Route vs Route Parameters | The unexplained inversion (OQ-1) may change under S-02; record it either way |

**Scalability (§7.5):** measure at 1, 64, 256 and add **512 and 1024** connections for S-01, since the
per-request-timer hypothesis (Hypothesis A in `04-root-cause-analysis.md` §2) predicts effects that only
appear at high in-flight counts. Also run a **sustained soak** (≥10 minutes at 256 conn) with
`--trace-gc` to confirm no heap growth — mandatory for S-02 (reused mutable state) and S-05 (caches).

---

## 9. V-07 — Validate the master hypothesis

This is the validation the playbook's §7.3 spirit demands but that a per-solution list would miss: the
*reasoning* in this report is itself a claim to be tested.

**Claim (`04-root-cause-analysis.md` §2, Hypothesis B):** flat concurrency scaling is a consequence of
high fixed per-request CPU cost, not of a concurrency-dependent mechanism.

**Prediction:** as S-01/S-02/S-03 reduce per-request cost, scaling ratios should rise toward peer values
(×1.25–×1.40) **as a side effect**, with no work targeting scaling directly.

**Falsification:** if per-request cost drops measurably but the c1→c64 ratio stays at ×1.01–×1.11,
Hypothesis B is **wrong**. Hypothesis A (concurrency-dependent cost — timer-list pressure, promise-graph
GC) must then be re-opened and investigated with a concurrency-swept allocation and GC profile.

**Record the outcome either way.** A rejected hypothesis that was clearly stated in advance is a
successful investigation; a quietly abandoned one is not.

---

## 10. Documentation of results (§7.6) and acceptance (Section C)

For each optimisation, record: baseline metrics (with run ID, profile, and pinning state), post-change
metrics, measured delta with stddev and CV, observed regressions, behavioural verification outcome,
conformance-suite result, and remaining concerns. Store under
`apps/benchmark/results/<run-id>/` and reference the run ID in the commit message so any figure is
traceable to the measurement that produced it.

**An optimisation is accepted only when all of the following hold:**

- [ ] Improvement is measurable against the **pinned** baseline, at ≥3 runs, above CV.
- [ ] No scenario regressed >2% at any concurrency, **including concurrency 1**.
- [ ] All behavioural checks for that solution pass.
- [ ] `packages/adapters/conformance` green.
- [ ] Allocation gate non-increasing.
- [ ] Soak test shows no heap growth (S-02, S-05).
- [ ] Public API unchanged.
- [ ] Results documented with a traceable run ID.

**Failing any gate → revise, or return to investigation.** Not "merge and note the caveat."

Continues in `07-optimization-roadmap.md`.

# 07 — Optimization Roadmap

**Playbook phase:** Part 8 — Optimization Roadmap (§8.1–8.7, Sections A–C)

---

## 1. Prioritisation (§8.1) and effort (§8.2)

| ID | Finding | Priority | Effort | Risk | Confidence | Measured impact |
| -- | ------- | -------- | ------ | ---- | ---------- | --------------- |
| **P-00** | No baseline, no CI performance gate | **Critical** | Small | None | Confirmed | Enables everything else |
| **P-01** | Per-request timeout race on 100% of requests | **Critical** | Small→Medium | Medium | Confirmed / Strong | +5.55 µs floor vs Fastify |
| **P-02** | 5 per-request containers in the param path | **Critical** | Medium | Medium | Confirmed / Strong | +5.23 µs on param routes |
| **P-03** | Request-time middleware chain construction | **High** | Medium | Medium | Confirmed / Strong | +1.22 µs per layer |
| **P-04** | Eager `ctx.ip` | **Medium** | Small | Low | Confirmed / Hypothesis | Sub-µs (est.) |
| **P-05** | Uncached static-file `stat` | **Medium** | Medium | **High** | Hypothesis | Unmeasured |
| **P-06** | `send()` dispatch order | **Medium** | Small | Low | Confirmed / Hypothesis | Unmeasured |

Effort scale per §8.2: Small = under a day; Medium = a few days including tests; Large = a week-plus;
Architectural = RFC-gated.

---

## 2. Phase 1 — Instrument, then take the free wins

**Goal:** make the hot path measurable and defended, and land only changes that cannot plausibly break
anything. **Nothing in Phase 2 should start before Phase 1's instrumentation is green**, because
otherwise every subsequent gain is measured against a moving control.

| # | Work | Solution | Effort |
| - | ---- | -------- | ------ |
| 1.1 | Run `bench:compare --profile full` on a **CPU-pinned** machine; commit to `apps/benchmark/results/baseline/` | S-00 | Small |
| 1.2 | Wire `check-regression.js` into CI against that baseline (loose gate, ~10% throughput) | S-00 | Small |
| 1.3 | Add `bench:alloc:handler` covering `createHandler` — the uncovered path that let P-01 land | S-00 | Small |
| 1.4 | Wire all `bench:alloc:*` harnesses as a **tight** CI gate (they are `cv≈0`, so any increase is real) | S-00 | Small |
| 1.5 | Capture a CPU profile + flamegraph of `hello-world` and `route-params` at 64 conn | evidence item 1 | Small |
| 1.6 | Run `bench:alloc:param-match` at HEAD to settle the unexplained 169.4 → 339.87 B/op regression | evidence item 3 | Small |
| 1.7 | **Hoist `TIMEOUT_SENTINEL` to module scope** | S-01/A1 | Trivial |
| 1.8 | Add benchmark scenarios currently missing: 2–3 `app.use()` layers, `send(object)`, static file, large POST body | coverage | Medium |

**Validation milestone (§8.4):** baseline committed and referenced by CI; a CPU profile exists;
allocation gate green; scenario coverage extended. Item 1.7 validated by `bench:alloc:handler`
showing a reduction with zero behavioural change.

**Why 1.5 and 1.6 sit here rather than later:** they are the only things that can convert P-01's and
P-02's *magnitude* from Strong evidence to Confirmed. If the CPU profile shows the timeout scaffolding
is negligible, Phase 2 should be re-planned rather than executed.

---

## 3. Phase 2 — High-impact optimisations

**Goal:** close the fixed per-request floor and the param-path gap — the two Critical findings, worth
roughly 10.8 µs of the 10.69 µs route-params gap versus Fastify.

| # | Work | Solution | Effort | Gate |
| - | ---- | -------- | ------ | ---- |
| 2.1 | Replace `Promise.race` with flag-and-callback in `createHandler` | S-01/A2 | Small | V-01 |
| 2.2 | Remove `canonicalizePath`'s result object (helps **all** requests, static included) | S-02/B2 | Small | V-02 |
| 2.3 | Reuse bind stacks per router instance, with invariant comment + interleaving test | S-02/B1 | Medium | V-02 |
| 2.4 | Remove the `RouteMatch` container — `matchRoute` writes `ctx.params`, returns the executor | S-02/B3b | Medium | V-02 |
| 2.5 | Shared coarse timer replacing per-request `setTimeout` — **only if 2.1's measured gain justifies the added component** | S-01/A3 | Medium | V-01 |
| 2.6 | Make `ctx.ip` a memoised getter; verify `NodeContext` stays monomorphic | S-04 | Small | V-04 |

**Sequencing rules:**
- 2.1 before 2.5. A3 is a new component; it must be justified by A2's measured result, not assumed.
- 2.2 before 2.3 before 2.4 — ascending risk, and each independently revertible.
- **Every step is its own commit.** Bundling S-01 and S-02 would make an unexpected result
  unattributable.
- `packages/adapters/conformance` runs on 2.1 and 2.5 without exception.

**Validation milestone (§8.4):** V-01 and V-02 fully satisfied, including the concurrency-1 watch
(NextRush currently *wins* five scenarios at c=1; losing that while gaining at 256 is a trade to report,
not a win to claim). Then re-run V-07 to test the master hypothesis.

**Projected outcome** — derived from the cost decomposition, **not** measured:

| Scenario @256 | Now | Projected | Basis |
| ------------- | --- | --------- | ----- |
| Empty Response | 32,999 | ~35,000–36,500 | floor −2 to −3.5 µs |
| Hello World | 28,917 | ~30,500–32,000 | same absolute µs |
| Route Parameters | 23,878 | ~27,000–29,000 | floor + param containers |
| Large JSON | 19,198 | ~19,900–20,300 | inherits floor only |

Deliberately narrower than the executive summary's parity upper bound: those figures assume *full*
parity on all three mechanisms, which Phase 2 does not attempt.

---

## 4. Phase 3 — Structural improvements

**Goal:** move work from request time to registration time, and address the unmeasured subsystems once
they are measurable.

| # | Work | Solution | Effort | Gate |
| - | ---- | -------- | ------ | ---- |
| 3.1 | Conditionally elide `Promise.resolve` for synchronous middleware returns | S-03/C2 | Small | V-03 |
| 3.2 | Backward chain compilation in `compileExecutor` | S-03/C1 | Medium | V-03 |
| 3.3 | Unify `compose` and `compileExecutor` on one chain builder | S-03/C4 | Medium | V-03 |
| 3.4 | De-async `Application.callback()`'s wrapper (apply the NF-1 technique one frame up) | S-01 §8 item 5 | Small | V-01 sweep |
| 3.5 | `send()` two-level `typeof` dispatch + split into per-kind helpers | S-06 | Small | V-06 |
| 3.6 | Static-file metadata + negative cache, opt-in, metadata-only | S-05 | Medium | V-05 |

**Blocking dependencies:** 3.1–3.3 require the multi-`app.use()` scenario from 1.8, or the change's main
beneficiary stays unmeasured. 3.5 requires the `send(object)` scenario. **3.6 requires the static-file
scenario and must not be started without it** — it carries the highest risk in this report (a cache that
memoises a symlink-safety verdict is a TOCTOU vulnerability), so it is the one item where "measure first"
is a hard gate rather than good practice.

**Validation milestone:** V-03, V-05, V-06 satisfied; soak test with `--trace-gc` clean for 3.6.

---

## 5. Phase 4 — Research and deferred items

Not scheduled. Recorded so each decision is explicit rather than accidental.

| Item | Why deferred |
| ---- | ------------ |
| **Schema-compiled JSON serialization** | Potentially worth ~8.8 µs/req on Large JSON (34% of that scenario's cost), which is larger than P-01. But it is a **feature**, RFC-gated, needs a response-schema public surface, and adds a code-generation attack surface. Building it while the framework still pays +7.59 µs on its floor is the wrong order. Revisit after Phase 2 re-measurement. See `serializer.md` §8. |
| **Zero-copy static file transfer** | Node exposes no portable `sendfile(2)` for `http.ServerResponse`. A runtime limitation, not an implementation defect. |
| **Single-pass param materialisation (S-02/B4)** | Risks reintroducing the eager-bind + `Reflect.deleteProperty` backtrack pattern that HP-11 removed. Only worth revisiting if profiling shows the copy loop is significant — unlikely at 1–3 params. |
| **Zero-closure middleware dispatch** | Requires holding double-`next` guard state on the Context rather than in closures. Larger change, interacts with `ctx.setNext`; reconsider after 3.2 is measured. |
| **Boot-time static manifest** | Highest static-serving performance, but files added after boot become invisible — a deployment-semantics change needing its own opt-in and documentation. |
| **Reverse-proxy guidance instead of a static cache** | Should be evaluated seriously *before* 3.6: most production static serving belongs in front of Node, and documenting that may be a better answer than building a cache. |

---

## 6. Review summary (§8.5)

| | |
| --- | --- |
| Findings identified | **7** (P-00 … P-06) |
| Critical | 3 — P-00 (process), P-01 (timeout race), P-02 (param containers) |
| High | 1 — P-03 (middleware construction) |
| Medium | 3 — P-04, P-05, P-06 |
| Root causes confirmed in source | 6 of 7 (P-05's mechanism confirmed, impact unmeasured) |
| Subsystems found **at parity** — no action | 4 — serializer, body-parser, request/query, error path |
| Prior findings independently verified as **shipped** | 2 — NF-1 (nested async frames), NF-2 (eager `ctx.state`) |
| Prior findings **confirmed and worsened** | 1 — NF-3 (route-params gap, −20.6% → −25.5% vs Fastify) |
| Prior findings **still open** | 1 — the profiling/evidence meta-finding |
| Evidence gaps documented | 6 (`02-runtime-profiling.md` §5) |
| Open questions | 5 (`appendix/open-questions.md`) |

**Total addressable, if all three mechanisms reached Fastify parity:** +19% on Hello World, +34% on
Route Parameters, +34% on Middleware Stack. Stated as an **upper bound to size the work**, not a promise.

---

## 7. Final recommendations (§8.6)

### Implement immediately

1. **Pin a baseline and wire the CI gates (P-00).** Cheapest, zero-risk, and the prerequisite for
   trusting any number that follows. Without it, the next parity fix can reintroduce a P-01-class
   regression and nobody will know until the next manual investigation.
2. **Hoist `TIMEOUT_SENTINEL`.** One line, zero behavioural change, removes a per-request allocation.
3. **Capture one CPU profile and one allocation profile.** Two commands. They convert this report's
   two Critical findings from "Strong evidence" to "Confirmed" — or refute them, which is equally
   valuable and much cheaper to discover now than after Phase 2 is built.

### Implement after instrumentation

4. **S-01/A2** — flag-and-callback replacing `Promise.race`. Highest leverage: 100% of requests.
5. **S-02/B2 then B1 then B3b** — the param-path containers, ascending risk, one commit each.

### Postpone

6. **S-03 (middleware compilation)** until the multi-`app.use()` scenario exists. The benchmark's
   single-root-router shape gives `compose` its `len === 1` fast path, so today the change's principal
   beneficiary is invisible to measurement.
7. **S-01/A3 (shared timer wheel)** until A2's measured result justifies a new component.
8. **S-05 (static cache)** until a static-file scenario exists. Highest-risk item in the report.

### Requires more research before any decision

9. **Schema-compiled serialization.** Larger potential than any finding here, but it is a feature, is
   RFC-gated, and should be evaluated only after the floor is fixed and re-measured.
10. **The Deep-Route-faster-than-Route-Params inversion (OQ-1).** Unexplained, NextRush-specific, and
    directly adjacent to P-02. Worth a focused micro-benchmark before S-02 is designed in detail — it may
    reveal a second param-path mechanism this report did not find.

### Do not change

11. **`ctx.json()` / serialization.** At parity or better. Optimising it would produce no measurable
    movement.
12. **Body parser.** At parity with Fastify. The gap versus raw Node is the price of a correct,
    limit-enforcing, cross-runtime parser and is shared by every framework in the suite.
13. **Query and header handling.** Within 0.72 µs of Fastify; zero-copy headers; correctly avoids
    `new URL()`.
14. **The default `timeout` value (S-01/A4).** Do not make the handler timeout opt-in to win a
    benchmark. It would silently remove a cross-runtime parity guarantee and weaken a security-relevant
    default on Node only.
15. **`Object.create(null)` for params.** A prototype-pollution control, not overhead. No pooling
    proposal may replace it with a plain object.
16. **`setNext(NOOP_NEXT)` termination in `compileExecutor`.** Documented as load-bearing (NF-4a); the
    most likely casualty of a careless chain rewrite.

---

## 8. Continuous performance improvement (§8.7)

The durable lesson of this investigation is not any single allocation. It is that **a rigorous
optimisation program (HP-1…HP-18, NF-1…NF-4) was measurably undone on one hot path by a
correctness-motivated change four days after it completed, and nothing detected it.**

Practices to adopt so this does not recur:

1. **A pinned baseline lives in the repository**, refreshed on a documented schedule.
2. **Allocation gates run per PR** — deterministic (`cv≈0`), unlike throughput on shared runners.
3. **Any change to `packages/{core,router,adapters/*}/src` on the request path carries a benchmark
   note** — even when the change's motivation is correctness, parity, or security. Especially then:
   P-01 arrived through a parity fix, and every finding in this report about *code* is smaller than that
   one fact about *process*.
4. **Re-run the full suite each release**, comparing to the previous baseline, and archive the run ID
   with the release.
5. **New scenarios accompany new hot paths.** Four subsystems in this report were unmeasurable —
   static files, `send(object)`, large POST bodies, and multi-layer `app.use()` — which is why three
   findings could only be rated Hypothesis.
6. **Repeat this review at each major release**, starting from the pinned baseline rather than from
   scratch.

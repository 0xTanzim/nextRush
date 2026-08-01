# 00 — Executive Summary

| Field | Value |
| ----- | ----- |
| **Report type** | Performance + HTTP compliance |
| **Governed by** | `docs/playbooks/PERF-001-performance-engineering-playbook.md` |
| **Scope** | Root-cause attribution of the measured NextRush deficits in the pinned `standard` run `2026-07-31T05-36-51` |
| **Date** | 2026-07-31 |
| **Commit / ref** | `feat/dev` @ `700549cbd89496c989e7ca342d353bc6907d3007` |
| **Primary artifact** | `apps/benchmark/results/2026-07-31T05-36-51` — profile `standard`, wrk 4.2.0, **CPU-pinned cores 2-7**, 3 valid runs/cell, cv 0.5–3.8% |
| **Status** | Final |
| **Supersedes** | `reports/investigations/post-audit-invariant-erosion-review.md` §3 ("no benchmark exposed this") — a pinned run now exists |
| **Resolves** | `performance-investigation-reconciliation.md` **Rec 4 / P-01** (open since 2026-07-28) |

**Evidence labels:** **[M]** measured here · **[D]** derived arithmetic · **[S]** source-read, cost
unmeasured · **[R]** hypothesised then refuted.

---

## 1. The headline: NextRush's problem is a fixed floor, not its work

NextRush ranks **4th of 6** (64.7/108), behind Hono (66.1), Fastify (95) and raw Node (98). The
naive reading of that scoreboard — "the router/serializer/response path is slow" — is **wrong**, and
the pinned data says so unambiguously.

Converting RPS to µs/request and subtracting each framework's **own** empty-response cost isolates
fixed overhead from real work. At 256 connections [M]:

| Scenario | NextRush marginal | Fastify marginal | NextRush excess |
| -------- | ----------------- | ---------------- | --------------- |
| hello-world | **0.51 µs** | 5.45 µs | **−4.93 µs (NextRush better)** |
| send-object | **2.60 µs** | 6.38 µs | **−3.79 µs (NextRush better)** |
| json-serialize | **2.19 µs** | 4.97 µs | **−2.78 µs (NextRush better)** |
| large-json | 19.07 µs | 20.55 µs | −1.48 µs (better) |
| query-string | 11.21 µs | 11.85 µs | −0.63 µs (better) |
| post-json | 23.08 µs | 24.11 µs | −1.03 µs (better) |
| route-params | 9.40 µs | 8.03 µs | +1.37 µs |
| middleware-stack | 11.56 µs | 7.35 µs | **+4.21 µs** |
| static-file | 81.28 µs | 68.84 µs | **+12.44 µs** |

**Seven of nine like-for-like scenarios have a *better* marginal cost than Fastify.** NextRush's
JSON path, response writing and body parsing are not the problem — they are competitive or ahead.

What NextRush loses on is the floor:

| Floor (empty-response, µs/req) | @1 conn | @64 conn | @256 conn |
| ------------------------------ | ------- | -------- | --------- |
| NextRush | 36.98 | 28.04 | 30.48 |
| Fastify | 34.45 | 24.37 | 24.89 |
| Raw Node | 31.40 | 23.67 | 24.22 |
| **NextRush excess vs Fastify** | **+2.53** | **+3.68** | **+5.59** |

The floor excess **more than doubles from 1 → 256 connections**. And the diagnostic detail that
makes this concrete: **NextRush costs almost exactly as much to send nothing (30.48 µs) as to
serialize and send JSON (30.99 µs)** — a 0.51 µs difference. Fastify's empty response is 5.44 µs
cheaper than its hello-world. NextRush's fixed floor is large enough to swallow its own excellent
marginal costs.

This is why the user's instinct — "parameter and empty object are doing bad" — is correct, and why
the *reason* is not what it looks like. `empty-response` looks worst (−18.3% vs Fastify) precisely
because it is the purest measurement of the floor, with no work to amortize it against.

---

## 2. Findings, by severity

| ID | Finding | Severity | Evidence | Report |
| -- | ------- | -------- | -------- | ------ |
| **C-1** | **`HEAD` returns 404 on every `GET` route.** Fastify, Express, Koa and Hono all return 200; NextRush matches only the router-less raw-Node baseline | **Critical (correctness)** | [M] | `04` |
| **F-1** | Per-request `setTimeout(30_000)` handler race costs **3.36% throughput** — measured pinned, interleaved, 2×2 factorial, n=11, t=2.71 | **Critical** | [M] | `02` |
| **F-2** | `ctx.params` and `ctx.query` are **V8 dictionary-mode objects** — never inline-cacheable. `Object.create(null)` costs **184 B/op vs 32 B** and **65 ns vs 5.96 ns** against a design that keeps the identical security property | **Critical** | [M] | `03` |
| **F-3** | The `serve()` drain wrapper adds **+2.31%** throughput cost (t=2.05, not significant alone; **+5.67% combined with F-1, t=3.35, significant**) | **High** | [M] | `02` |
| **F-4** | A one-param route match allocates **5.1× a static match** (285.78 vs 56.11 B/op); 64% of that is the params container from F-2 | **High** | [M] | `03` |
| **F-5** | Static file serving does **≥5 filesystem operations and zero caching** per request, plus a per-request `toUTCString()` and ETag string build. The benchmark file is **36 bytes**, so the −37.2% vs raw Node is pure overhead — **Express beats NextRush here** | **High** | [S]+[M] | `05` |
| **F-6** | Middleware costs **~+1.04 µs per layer** more than Fastify; two separate middleware-dispatch implementations (`compose` and `compileExecutor`) must be optimized twice | **High** | [M] | `05` |
| **F-7** | Prefix-mount dispatch is **O(mount count)** — 4.0× at 10 mounts — and is **structurally unbenchmarked** | **Critical (unbenchmarked)** | [M] | prior report |

**Refuted [R]** (carried from the prior report, retested): the `ctx.originalPath` property addition
costs **no** measurable allocation (1064.15 vs 1064.13 B/req, cv 0.0%), and its inline-cache impact
is **bounded at 2 maps**, not broad. It remains a real hidden-class transition and a false documented
invariant, but it is **not** a throughput item.

---

## 3. What the floor is made of

The 2×2 factorial experiment (report `02`) attributes **2.65 µs/req — roughly half the 5.59 µs floor
excess vs Fastify** — to two mechanisms that are pure overhead on every request:

```
   floor excess vs Fastify @256 = 5.59 µs [M]
   ├── 2.65 µs  ATTRIBUTED [M, pinned, n=11, p<0.05]
   │   ├── ~1.6 µs  handler timeout race  (setTimeout(30_000) per request)
   │   └── ~1.1 µs  serve() writeHead drain wrapper
   └── ~2.9 µs  UNATTRIBUTED — candidates, in descending [S] plausibility:
       ├── NodeContext construction + eager ip resolution
       ├── canonicalizePath running twice per request (4 string passes each)
       ├── compose() + executor promise/closure chain
       └── ctx.originalPath map transition (measured non-allocating, cost unquantified)
```

Both attributed mechanisms exist for good reasons — F-1 is ADR-0010's cross-runtime 504 parity
contract, F-3 is F-05's graceful-drain correctness — and **both can be kept while removing the
per-request cost** (report `02` §5, report `06`).

---

## 4. Recommended order

| Phase | Items | Why first |
| ----- | ----- | --------- |
| **0 — correctness** | **C-1** (auto-register HEAD for GET) | PERF-001 §1.4: correctness is non-negotiable and outranks every perf item here. Also a live production defect for anyone using CDNs, health probes or `curl -I` |
| **1 — the floor** | **F-1** (timer wheel or lazy arm), **F-3** (drain flag instead of wrapper) | Measured 5.67% combined, significant, on 100% of requests, no behaviour change |
| **2 — the containers** | **F-2** + **F-4** (`new NullBag()` params/query container) | 11× / 5.75× measured, security property preserved *and proven by test*, ~5 lines in 2 files. Fixes the scenario the user flagged |
| **3 — the outliers** | **F-5** (static caching), **F-6** (middleware layer cost) | Largest remaining scenario-specific gaps |
| **4 — the unbenchmarked** | **F-7** + a prefix-mount benchmark arm | Cannot regress-test what the suite cannot see |
| **5 — prevention** | the invariant gate from the prior report §8.1 | Stops the next round of erosion |

**Expected aggregate effect if Phases 1–2 land [D, hypothesis]:** the floor excess falls from
5.59 µs to ~2.9 µs and the param path loses ~150 B/req and its dictionary-mode read penalty. That
would move `empty-response` from −18.3% to roughly −8% vs Fastify and `route-params` from −17.5%
toward −10%. **This is a projection from component measurements, not a measured end-to-end result** —
it must be validated by re-running the pinned `standard` profile (report `06` §3).

---

## 5. Method and honesty notes

- The published run is **pinned and multi-run** (cores 2-7, 3 runs, cv 0.5–3.8%), so the scenario
  deltas in §1 are trustworthy at that scale. It is the ruler the corpus said was missing.
- My own experiments ran on the **same machine while it was not idle** (load avg ~1.4) with servers
  pinned to cores 2-5 and the wrk client to 6-7. Absolute RPS is therefore *lower* than the published
  run (~21k vs ~32k on hello-world); only **within-round paired comparisons** are used, which is the
  design the corpus's own cautionary datum demands.
- Allocation and `%HasFastProperties` results are **deterministic** (cv 0.0–0.2%) and do not depend
  on machine state.
- One measurement attempt **failed and is reported as failed**: a `strace` per-request syscall count
  for the static path did not produce interpretable attribution (46 opens/request, unexplainable by
  the code path) and is excluded. F-5's syscall count is `[S]` source-read, with the syscall
  measurement listed as required further evidence.

Full per-report evidence: `01` benchmark decomposition · `02` floor attribution · `03` params/query
containers · `04` HEAD compliance · `05` static + middleware · `06` recommendations and validation.

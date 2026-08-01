# Appendix — Benchmark Notes

Harness configuration, artifact-integrity observations, and reproduction notes for the evidence
underpinning this investigation. No benchmark was executed; everything here is read from stored
artifacts and harness source.

---

## 1. The run used as primary evidence

| Property | Value |
| -------- | ----- |
| Run ID | `2026-07-27T15-42-50` |
| Profile | `standard` — **3 runs per cell**, mean ± stddev, CV reported |
| Load generator | wrk 4.2.0 (C-based, process-isolated) |
| Frameworks | Raw Node.js, NextRush v3, Fastify, Hono, Koa, Express |
| Scenarios | 10 (8 like-for-like, 2 labelled idiomatic) |
| Concurrency levels | 1, 64, 256 |
| Total cells | 180 |
| Runtime | Node v26.4.0 |
| Hardware | Intel Core i5-8300H @ 2.30 GHz (4C/8T), Linux |
| **CPU pinning** | **Off** |
| Wall-clock span | ~16:31 → 20:31 (frameworks measured sequentially, ~48 min apart) |

**Sequential measurement caveat.** Per-framework JSON files are timestamped 48 minutes apart
(`raw-node` 16:31 → `express` 20:31). Frameworks were therefore measured in different four-hour windows
on a machine whose thermal and background-load state may have drifted. With pinning off this is a real
confounder for cross-framework comparison. Two mitigations make the data usable anyway:

1. CV within each cell is low (≤1.7% at 64/256 conn), so per-cell measurement is stable.
2. The analysis in `01-benchmark-analysis.md` relies primarily on **within-framework** deltas (each
   framework's own `empty-response` floor as its control), which are immune to drift between windows.

Absolute cross-framework figures should still be treated as ±5% until a CPU-pinned `--profile full` run
exists.

---

## 2. Artifact-integrity observations

### 2.1 Two directories, one run — do not double-count

| Directory | `run_id` inside `results.csv` | `results.json` size |
| --------- | ----------------------------- | ------------------- |
| `results/2026-07-27T15-42-22/` | **`2026-07-27T15-42-50`** | 700,547 B |
| `results/2026-07-27T15-42-50/` | `2026-07-27T15-42-50` | 700,547 B |

Both directories contain byte-identical file sizes and both CSVs carry the same `run_id`. The
`README-TABLES.md` in the `15-42-22` directory also declares `Run 2026-07-27T15-42-50`. These are **one
run written to two locations**, not two independent samples — most likely two harness invocations 28
seconds apart whose report generation both resolved to the same aggregate.

**Consequence:** any analysis treating these as two runs would double its apparent sample size. This
investigation used the `15-42-50` directory only. Recommend deleting or clearly marking the duplicate.

### 2.2 `results/latest/` is a partial run and is not comparable

| File | Present | Note |
| ---- | ------- | ---- |
| `raw-node.json` | ✅ | Only framework present |
| `results.json` | ✅ 7,151 B | vs the full run's 700,547 B |
| `REPORT.md` | ✅ 7,068 B | vs the full run's 52,861 B |
| `nextrush-v3.json`, `fastify.json`, `hono.json`, `koa.json`, `express.json` | ❌ | Absent |

Dated 2026-07-28, i.e. *after* the full run. A single-framework run — excluded from all analysis.
`latest/` being a partial run is a mild trap for anyone reading the newest artifact first.

### 2.3 No baseline exists

```
apps/benchmark/.gitignore:
  /results/*
  !/results/baseline/
```

The `baseline/` path is explicitly whitelisted for committing, and **the directory does not exist**.
`git ls-files apps/benchmark/results` returns nothing — no result set has ever been committed.

**This is the mechanical reason P-01's magnitude is unquantifiable.** The commit that introduced it
(`d97734e3`, 2026-07-22) cannot be A/B'd, because no pre-change measurement survives. It is finding
**P-00** in `04-root-cause-analysis.md` §8 and item 1.1 of the roadmap.

---

## 3. Fairness posture (verified from harness source)

| Control | Verified | Where |
| ------- | -------- | ----- |
| Shared response payloads across all six servers | ✅ | `servers/_shared/payloads.js`, imported by every server |
| Parity gate asserting byte-identical bodies, statuses and middleware headers before timing | ✅ | `pnpm bench:validate`; `scripts/validate-parity.js` |
| Raw-node baseline not strawmanned — real 5-layer function chain with a real `next()` | ✅ | `servers/raw-node.js` → `runChain` |
| Raw-node baseline enforces a 1 MB body cap | ✅ | `MAX_BODY_BYTES` |
| Raw-node `Content-Type` includes `charset=utf-8` to match framework headers | ✅ | `JSON_HEADERS` |
| NextRush uses `app.setErrorHandler`, not a per-request `try/catch` middleware | ✅ | `servers/nextrush-v3.js`; zero per-request cost on the 8 non-throwing scenarios |
| NextRush body parser mounted on the POST route only, not globally | ✅ | `router.post('/users', json(), …)` |
| Idiomatic scenarios excluded from the scoreboard | ✅ | `identical_work=false` on middleware + error |
| Multi-run requirement for publishable figures | ✅ | `standard` = 3 runs, `full` = 5 runs |

**Assessment: the harness is unusually honest for a framework's own benchmark suite.** It ships a raw
baseline it cannot beat, labels its own unfair scenarios, and validates response parity before timing.
Findings derived from it are not artefacts of a rigged setup.

---

## 4. One structural bias, and it works against NextRush

The NextRush server mounts a single router at the root:

```js
app.route('/', router);   // root-mount fast path → middlewareStack = [router.routes()]
```

This produces a **one-entry middleware stack**, which takes `compose()`'s `len === 1` fast path — the
cheapest configuration NextRush supports. The general recursive dispatch path in `compose` is therefore
**never exercised by any benchmark scenario**.

A realistic application (`app.use(helmet())`, `app.use(cors())`, `app.use(json())`) would take that
general path on every request, adding per-layer cost the suite does not measure. **The measured gaps are
a lower bound**, and P-03's real-world impact exceeds what the Middleware Stack scenario shows.

Recommendation: add a scenario with 2–3 application-level `app.use()` layers (roadmap item 1.8).

---

## 5. Benchmark coverage gaps

Paths with **no** scenario, and therefore no measurement:

| Uncovered path | Consequence for this report |
| -------------- | --------------------------- |
| Static file serving | P-05 could only be rated **Hypothesis** |
| `ctx.send(object)` | P-06's magnitude is unknown |
| Large POST body (≥1 MB) | Buffer-growth behaviour entirely unmeasured |
| Multi-layer `app.use()` | `compose`'s general path unmeasured; P-03 understated |
| Concurrency above 256 | Hypothesis A in `04-root-cause-analysis.md` §2 cannot be tested |
| Sustained soak / heap growth | No long-run stability evidence |
| Cold start / boot time | `project-rules` targets a <30 ms cold start; nothing measures it |
| Memory footprint under load | `project-rules` targets <200 KB; nothing measures it |

The last two are notable: the repository's own steering declares numeric targets for cold start and
memory footprint that no artifact in the workspace measures.

---

## 6. Existing tooling that is ready but unused

Everything needed to close the evidence gap already exists. It is unwired, not missing.

| Tool | Location | Purpose |
| ---- | -------- | ------- |
| `check-regression.js` | `apps/benchmark/scripts/` | Compares a run to a baseline — has no baseline to compare against |
| `dispatch-alloc.js` | `apps/benchmark/scripts/` | Bytes/req for dispatch — produced `832.1 → 56.1 B/req, cv≈0` historically |
| `compose-alloc.js` | " | Bytes/req for `compose` |
| `context-alloc.js`, `context-raw-alloc.js`, `context-state-alloc.js` | " | Context allocation, including the lazy-`raw`/`state` paths |
| `router-match-alloc.js`, `param-match-alloc.js` | " | Static vs param match allocation — would settle the unexplained 169.4 → 339.87 B/op regression |
| `web-context-alloc.js`, `web-context-microtrims-alloc.js` | " | Fetch-family adapter allocation |
| `validate-parity.js` | " | The fairness gate |
| `registration-cost.js` | " | Boot-time route registration cost |
| **No `handler-alloc.js`** | — | **The gap that let P-01 land uncovered** |

These harnesses are deterministic (`cv≈0` in published results), which makes bytes-per-request a far
better CI signal than throughput on shared runners.

---

## 7. Reproduction

Commands are recorded for the team to run; **none were executed by this investigation.**

```bash
cd apps/benchmark

pnpm bench:validate                        # fairness gate — run first, always
pnpm bench:compare --profile full          # 5 runs; the only profile for published figures
pnpm bench:alloc:dispatch                  # deterministic allocation gates
pnpm bench:alloc:param-match
pnpm bench:alloc:context
```

For a CPU-pinned run (removes the §1 caveat), pin both the server and wrk to disjoint physical cores —
on a 4C/8T i5-8300H, e.g. cores 0–1 for the server and 2–3 for the load generator — and confirm the
harness reports pinning as on in `README-TABLES.md`.

For the missing profiles:

```bash
node --cpu-prof --cpu-prof-dir=./prof servers/nextrush-v3.js   # then drive with wrk
node --trace-gc servers/nextrush-v3.js 2> gc.log               # GC frequency and pause duration
```

---

## 8. Derived-figure method

Every µs/req figure in this investigation is `1,000,000 / rps_mean` from `results.csv`, and every
marginal cost is `scenario µs/req − that framework's own control scenario µs/req`. Controls used:
`empty-response` for the fixed floor, `hello-world` for per-feature marginal costs.

This is a **throughput-derived proxy for CPU time**, valid for comparing frameworks on the same scenario
at saturation, and **not** a substitute for a CPU profile. It absorbs kernel and syscall time and cannot
attribute cost within a request. Its use is declared in `02-runtime-profiling.md` §4 along with the
confidence ceiling it imposes.

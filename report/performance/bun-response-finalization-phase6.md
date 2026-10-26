# Bun Response Finalization and Adapter Submission — Phase 6

**Scope:** find and implement one optimization in response finalization or adapter response
handling, if the evidence supports it.

**Authorization:** investigation, isolated experiments, and a change only if a candidate clears
the acceptance bar. No production file was modified. The Phase 1 body fast path, the timeout
design, the JSON parser, the public API, and `budgets.json` are untouched. Nothing committed.

**Outcome in one line:** **no candidate passed.** The entire framework-controlled response path
is 1.28 µs, 3.0–4.7% of per-request time. Even making finalization free cannot reach the 5%
target, and the best real candidate is worth 1.38% only if it relies on undocumented copy
semantics of `new Response`.

---

## 0. Result summary

| Question | Answer | Confidence |
|---|---|---|
| What is the full finalize path cost? | **1.28 µs** per response (builder + `json()` + `getResponse()`) | High — direct measurement of the real code |
| What share of a request is that? | **3.0–4.7%** (27.6–40.0 µs requests) | High |
| Does the adapter add work after finalize? | No. `createBunRequestRunner` returns the `Response` straight to `Bun.serve` | High — source |
| Candidate 1 (remove `Headers` materialization) | −109 ns plain-object init (0.40%); −378 ns only with a shared cached `Headers` (1.38%) | Medium — spreads 21–39% |
| Candidate 2 (pre-encoded bytes) | −20 ns versus candidate 1's best, i.e. **neutral to worse** | Medium |
| Absolute ceiling of any header-path change | **1.69%** (drop the content-type header entirely, which is not permissible) | High |
| Acceptance (≥5% or clearly above noise) | **Not met** | High |

---

## 1. Method

Matched real-socket harness (the Phase 5 harness, copied to `/tmp/opencode/probe-finalize` and
given a `core` batch). Identical routes, identical response bodies, one process per arm, all arms
alive simultaneously and run back-to-back within each cell, arm order reversed on alternate reps.

| Item | Value |
| --- | --- |
| Runtime | Bun `1.4.3`, Linux x64, 8 cores |
| Load | `wrk 4.2.0`, keep-alive, `-t2`, 2 s warm-up + 5 s measured, 2 reps |
| Arms | `raw` (Bun floor), `hono` 4.13.0, `nextrush-30s`, `nextrush-nodl` (`timeout: 0`) |
| Routes | `GET /get` (immediate JSON), `POST /post1k` (1 KB JSON, parsed) |
| Levels | c = 32, 128 |
| Command | `bun run run-load.ts --routes get,post1k --levels 32,128 --reps 2 --duration 5 --warmup 2 --batch core` |

A note on the runner, because it produced a false alarm during this phase. Running the suites with
`bun test` reported 26 failures; this repository uses **vitest**, and the same files pass 377/377
and 129/129 under `vitest`. The `bun test` numbers were invalid evidence, not a regression, and
are recorded here only so the mistake is not repeated.

---

## 2. Measured baseline on this tree

Mean µs = `1e6 / mean_rps`.

Two-rep means, shown as `rps → µs per request`:

| Shape | c | raw | hono | NextRush 30 s | NextRush `timeout: 0` |
| --- | --- | --- | --- | --- | --- |
| GET | 32 | 53919 → 18.55 | 42382 → 23.60 | 33330 → 30.00 | 36268 → 27.57 |
| GET | 128 | 55293 → 18.09 | 40982 → 24.40 | 32706 → 30.58 | 34265 → 29.19 |
| POST 1 KB | 32 | 53063 → 18.85 | 27086 → 36.92 | 21463 → 46.59 | 24989 → 40.02 |
| POST 1 KB | 128 | 53144 → 18.82 | 26861 → 37.23 | 21315 → 46.92 | 23139 → 43.22 |

Deadline cost on this run: GET 2.43 µs (c=32) and 1.39 µs (c=128); POST 1 KB 6.57 µs (c=32) and
3.70 µs (c=128). That is 1.4–6.6 µs against Phase 5's 1.3–5.8 µs on the same harness; the
difference is rep-to-rep noise, so the harness and the tree are behaving as before.

Latency (µs) and CPU, second rep, 5 s window:

| Shape | c | Arm | p50 | p90 | p99 | CPU |
| --- | --- | --- | --- | --- | --- | --- |
| GET | 32 | 30 s | 970 | 1300 | 3020 | 78.1% |
| GET | 32 | `timeout: 0` | 870 | 1130 | 1940 | 77.3% |
| GET | 32 | hono | 767 | 1010 | 1690 | 74.9% |
| GET | 32 | raw | 585 | 790 | 1360 | 70.2% |
| POST 1 KB | 32 | 30 s | 1440 | 1920 | 3220 | 84.9% |
| POST 1 KB | 32 | `timeout: 0` | 1280 | 1700 | 2810 | 83.1% |
| POST 1 KB | 32 | hono | 1080 | 1590 | 3640 | 80.1% |

Server CPU at 77–85% of one core and the raw floor at 52–54k rps confirm the framework arms are
server-bound, so per-request µs derived from throughput is the right unit for comparing against
in-process measurements.

Run-to-run variation, same arm and cell across the two reps: **0.3–8.0%, median 2.5%** (narrowest
`post1k c=32 hono` at 0.3%, widest `get c=128 hono` at 8.0%). The response-path deltas in §4 are
0.4–1.4%, i.e. **below** the noise this harness produces.

---

## 3. The path, traced

Handler settlement to transport for a `ctx.json({ ok: true })` handler:

| Stage | Code | Cost |
| --- | --- | --- |
| `ctx.json(data)` | `serializeJson` → `JSON.stringify` | 133 ns |
| | `record.setBody(body, contentType)` | ~55 ns |
| Context construction (outside this scope) | `new OutgoingResponse()` + builder | 86 ns |
| Finalize | `getResponse()` → cache check → `flush(cb)` | 117 ns (flush) + ~60 ns |
| Response materialization | `buildResponse()`: `isBodylessResponse` → HEAD check → `new Headers()` → append loop → `has('Content-Type')` → `set(...)` → `new Response(body, { status, headers })` | **1.05–1.18 µs** |
| Adapter submission | `createBunRequestRunner` returns the `Response` to `Bun.serve` | 0 |

Two things this settles, both from source rather than inference:

- **`isBodylessResponse` is negligible** — a method comparison plus three numeric comparisons.
- **Adapter submission has no framework work at all.** `createBunRequestRunner`
  (`packages/adapters/bun/src/adapter.ts:198`) builds `createWebRunner` and nothing else; the
  runner's `return ctx.getResponse()` is the value Bun receives. There is no wrapping, cloning,
  or header mutation after finalize. The "adapter response handling" half of the objective has
  **zero** headroom on the framework side.

So the whole target is `buildResponse`, and within it the only non-trivial work is the `Headers`
object that carries exactly one `content-type`.

The hot case is worth stating precisely, because it is what makes the cost odd: for a typical JSON
response `record.extraHeaders()` returns the shared frozen `NO_HEADERS`, so the append loop runs
zero times — and `buildResponse` still allocates a `Headers`, calls `has('Content-Type')`, calls
`set(...)`, and hands it to `new Response`, which copies it into the response's own list. One
header, four operations and two objects.

---

## 4. Candidates

### 4.1 Candidate 1 — remove the per-request `Headers` materialization

- **Work eliminated:** the `Headers` allocation, the `has`/`set` pair, and the copy into the
  `Response` — replaced by the header init the response is constructed with.
- **Expected semantic impact:** identical for ASCII header names and values. A plain object init
  cannot express duplicate header names the way `append` can, so any change must keep the
  `Headers` path whenever `extraHeaders()` is non-empty (multi-value headers, `set-cookie`). That
  restriction keeps the change confined to the zero-extra-header case.
- **Measured benefit** (150k iterations, 7 interleaved samples, medians):

| Variant | ns | vs current | Gain at 27.3 µs |
| --- | --- | --- | --- |
| Current: `new Headers()` + `set` + `Response` | 1050.1 | — | — |
| Plain object init | 941.3 | −108.8 | **0.40%** |
| Module-level cached `Headers` | 672.3 | −377.9 | **1.38%** |
| Pre-encoded bytes + cached `Headers` (candidate 2) | 692.1 | −358.0 | 1.31% |
| Encode per request + `Response` | 841.3 | −208.9 | 0.77% |
| Floor: `Response` with no headers | 588.9 | −461.2 | **1.69%** |

The gap between the two candidate-1 variants is the important result: most of the removable cost
is `new Headers({...})` construction, not the `Response` copy. **The safe version is worth 0.40%.
The 1.38% version requires a shared, mutable `Headers` instance reused across concurrent
responses.**

### 4.2 Why the 1.38% variant is still rejected

Bun currently copies the init (`response.headers !== headers`, verified), so a shared instance
would work today. That is an undocumented implementation detail, not a contract. If any runtime
version retains the reference, two concurrent responses share one header list, and a header set on
one leaks into the other — a cross-request data leak in a framework whose adapters must behave
identically across Bun, Deno, Edge, and Node. Trading that risk for 1.38% — a quarter of the
target, below the harness noise — is not defensible.

### 4.3 Candidate 2 — hand Bun pre-encoded bytes

- **Work eliminated (hypothesis):** Bun's internal string→UTF-8 encoding for a string body.
- **Measured benefit:** none. With the cached-`Headers` baseline held constant, bytes cost
  692.1 ns against 672.3 ns for the string — **20 ns slower**, because the encoder work simply
  moves into the framework plus an extra `Uint8Array` allocation. Encoding per request (the
  realistic form, since bodies are not pre-encoded) is 841.3 ns, worse than the current shape.
- **Expected semantic impact:** would change the body type handed to `Response`, and interacts with
  `Content-Length` derivation.
- **Verdict:** rejected. The hypothesis is falsified.

### 4.4 The ceiling

The full finalize path is **1284.6 ns** measured on the real builder, against **27.57 µs** per
request at c=32 for `timeout: 0`:

```
1284.6 ns / 27570 ns = 4.66%
```

At c=128 (29.19 µs) it is 4.40%; on POST 1 KB (40.02 µs) it is 3.21%. **Deleting finalization
entirely — which is impossible, since something must produce a `Response` — would yield at most
4.7% on the best shape.** No optimization confined to this path can satisfy a 5% target, and the
best defensible one is an order of magnitude below the harness noise floor.

---

## 5. Decision

**No change implemented.** Both candidates fail the acceptance criteria:

| Candidate | Best measured gain | Bar | Verdict |
| --- | --- | --- | --- |
| 1 — plain-object header init | 0.40% | ≥5% or clearly above noise | Reject — below noise |
| 1′ — shared cached `Headers` | 1.38% | same | Reject — below noise, and depends on undocumented copy semantics |
| 2 — pre-encoded bytes | −20 ns vs candidate 1 | same | Reject — falsified |

Per the task's own instruction, the investigation stops here rather than launching another phase
or manufacturing a benchmark win.

---

## 6. Verification of the unchanged baseline

```
pnpm --filter @nextrush/runtime test -- --pool=forks --poolOptions.forks.maxForks=2
  → 30 files, 377 tests passed
pnpm --filter @nextrush/adapter-bun test -- --pool=forks --poolOptions.forks.maxForks=2
  → 9 files, 129 tests passed
node apps/benchmark/scripts/dev-check/check.mjs inproc
  → PASS 2, WARN 1, KNOWN 0, FAIL 0
```

Both suite counts match the Phase 1 baseline (377 and 129). The gate's single WARN is
`inproc.nextrush.vs_hono` at 1.58 against a 1.3 target and a 1.9 maximum — pre-existing, and
unchanged by this phase in either direction.

Budgets, public APIs, timeout behaviour, and the Phase 1 body fast path are untouched. The same 9
modified production files are present with an unchanged `204 insertions(+), 64 deletions(-)`, and
the only file this phase added is this report.

One tree change is **not** from this phase and is recorded here rather than silently included:
`pnpm-workspace.yaml` gained dependency-catalog bumps during the session (zod, oxlint,
oxlint-tsgolint, and vitest `^4.1.10` → `^5.0.5`; mtime `2026-10-21 00:51:43`). This task ran no
installer and no command capable of editing that file — the only pnpm invocation was
`--filter … test`, which reads catalogs and does not write them. The change was left in place
because discarding another author's work is not this phase's call. Note that the suites above ran
on vitest `4.1.10`, the currently installed version, not the catalog's `5.0.5`.

---

## 7. Limitations

- In-process micro-benchmarks had spreads of 21–39% across samples. The medians were stable across
  two independent probe runs (current shape 1177 ns then 1050 ns; plain-object init 944 ns then
  941 ns), which is why the ordering is trusted, but the absolute deltas are ±30%.
- The throughput-to-cost mapping assumes the server stays CPU-bound, which holds at 77–85% of one
  core but not if a future change shifts work to Bun's I/O threads.
- A 1.4% effect could in principle be resolved with many more reps and paired differencing. It was
  not pursued: even a perfect measurement would not make the change worth its semantic surface.
- This phase did not re-examine context construction, JSON parsing, middleware composition, or
  timeout scheduling, per the task's scope.

---

## 8. Conclusion

The response path is not where the remaining per-request cost lives. Finalization is 1.28 µs — 3–5%
of a request — and roughly a third of that is the unavoidable `new Response`. The only removable
part is the single-header `Headers` object, worth 0.40% safely. The framework does nothing at all
between finalize and `Bun.serve`, so adapter submission cannot be optimized on our side without a
Bun-only pipeline, which the task forbids and the architecture rules out.

The honest next step, if the gap is to be closed further, is the non-deadline request path
(context construction and body delivery), not the response path. This phase closes the response
question with a measured ceiling rather than an opinion.

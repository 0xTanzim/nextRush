# 06 — Recommendations, Roadmap, Validation, and Gaps

Priority classes follow PERF-001 §5.2 (P0 architectural → P3 micro). Severity follows §4.10
(Critical/High/Medium/Low). Acceptance follows §4.11 — **measurable improvement or reject/revert**.

---

## 1. Priority matrix

**Status as of 2026-07-31: Phase 0, 1 and 2 are shipped.** `✅` = shipped and verified; `⬜` = open.

| ID | Item | Status | Severity | PERF-001 class | Measured basis | Effort | Risk | Report |
| -- | ---- | ------ | -------- | -------------- | -------------- | ------ | ---- | ------ |
| **C-1** | Auto-register HEAD for GET routes | **✅** | **Critical (correctness)** | — (compliance) | 404 vs 200 on 4 competing frameworks | S | Low-Med | `04` |
| **F-2** | Fast-property params/query container | **✅** | **Critical** | P0 (memory layout) | −131.4 B/op param match (−44.8%) | S | Low-Med | `03` |
| **F-1** | Remove the per-request timeout timer | **✅** | **Critical** | P1 | −137.09 B/req; throughput **unverified** | M | Med | `02` |
| **F-3** | Replace the drain wrapper with a flag read | **✅** | **High** | P2 | −152.23 B/req (79.2% of wrapper cost) | S | Low | `02` |
| **F-5** | Static derived-metadata cache | ⬜ | **High** | P1 | +33.58 µs marginal @1c | M | Low-Med | `05A` |
| **F-6** | Unify the two middleware dispatchers | ⬜ | **High** | **P0 (architectural)** | +1.04 µs/layer, consistent across ladder | L | Med | `05B` |
| **F-7** | Prefix-mount canonicalization is O(mounts) | **✅** | **Critical** | P0 | slope 557 → ~177 ns/mount (−68%) | M | Med-High | prior report |
| **G-1** | Benchmark arms: HEAD, prefix-mount, `large-post` @64/@256 | **✅** | **High (measurement)** | §5.5 | 2 gaps closed; the third was already answered | M | None | §4 |
| **G-2** | Invariant gates (fast-properties, map stability, lazy fields) | **◐** | **High (prevention)** | §5.5 | fast-properties gate shipped; map/lazy still open | M | None | prior report §8.1 |
| F-4 | Router param-match allocation | **✅** | High | P2 | subsumed by F-2 | — | — | `03` |
| F-8 | Query `%`-decode fast path | **✅** | Low | P3 | 4.6–4.9×, on a scenario NextRush already wins | XS | None | `03` §6 |
| F-9 | `ctx.originalPath` declared field | **✅** | Low | P3 | `%HaveSameMap` false → true | XS | None | prior report |

### What "shipped" rests on, and what it does not

> ### G-1 outcome (2026-07-31) — two gaps closed, one was never a gap
>
> 1. **HEAD probe — closed.** `scripts/validate-parity.js` now issues a `HEAD` for every `GET`
>    scenario and fails when its status differs from the `GET` status (RFC 9110 §9.3.2). `raw-node` is
>    exempt and says why: it is a hand-written baseline with no route table to derive HEAD from.
>    Confirmed live by inverting the assertion — it fires on all five non-reference frameworks,
>    including `nextrush-v3 · static-file`, the exact route where the original 404 was found.
> 2. **Prefix-mount arm — closed**, as `scripts/alloc/mount-scaling.js`
>    (`pnpm bench:mount-scaling`) rather than a comparison-suite scenario: mounts are a NextRush-shaped
>    concern, so a cross-framework arm would compare unlike things, and the sibling report's §8.1 asked
>    for a promoted harness anyway. It reproduced F-7 independently (557 ns/mount) before the fix, then
>    verified it (~177 ns/mount).
> 3. **`large-post` @64/@256 — not a gap.** The harness already answered this and documented why:
>    `maxConnections: 8`, because a 1.5 MiB body queues past wrk's 2 s socket timeout (measured 17–25
>    timeouts in 5 s at 64 connections on **every** framework) and one timeout voids publishability. At
>    that size the cell is bandwidth/`JSON.parse`-bound anyway. This report asked for an arm the
>    harness had already measured and deliberately rejected — recording it so it is not re-raised.


Every ✅ above is backed by a **deterministic** measurement (allocation at cv ≤0.1%, or a structural
assertion like `%HasFastProperties` / `%HaveSameMap` / timer count) plus 1,292 passing tests across
`router`, `runtime`, `adapters/node`, `adapters/conformance`, `core`, `class` and `openapi`.

**No end-to-end throughput improvement has been verified.** The `02` §7 factorial re-run was
underpowered (host load ≈2.6, n=9, and it could not reproduce the original effect either), so
`empty-response` 30.48 → ~27.8 µs/req and `route-params` 39.88 → ~38 µs/req both remain **predictions**.
Re-running the pinned `standard` profile on an idle host is the single highest-value outstanding
measurement — see §5.



---

## 2. Phased roadmap

### Phase 0 — Correctness (ship first, independently)

**C-1 only.** PERF-001 §1.4: correctness outranks performance. It is a live spec violation affecting
CDNs, health probes and monitors, it is registration-time-only so it costs the hot path nothing, and it
must not be bundled with anything that changes timing — otherwise the compliance fix and a perf change
become jointly unattributable.

### Phase 1 — The floor (the biggest measured aggregate)

**F-3** then **F-1**, as two separate changes.

F-3 first because it is smaller, lower-risk, same-package, and deterministic. F-1 second, starting with
the **lazy-arm** design (`02` §5 option B) rather than the timer wheel: it captures most of the
measured 3.36% at a fraction of the risk, and the wheel can follow if measurement justifies it.

Gate: re-run the 2×2 factorial. If `both ≈ none` afterwards, the cost is gone. Predicted floor
30.48 → ~27.8 µs/req.

### Phase 2 — The containers

**F-2**, with the tests enumerated in `03` §7 — particularly the pollution test (`__proto__` as a param
name must still bind as an own key) and the **multi-param fast-mode check**, which is the one thing not
yet measured. Fold in F-8 while in the same file.

### Phase 3 — The scenario outliers

**F-5** (static metadata cache), then **F-6** (dispatcher unification). F-6 is RFC-gated per
AGENTS.md §21 — it touches the middleware pipeline, which is explicitly on the RFC list. Note F-6 is
P0-architectural and only sits in Phase 3 because it is the largest and needs a design doc first; if
the RFC lands early, it can move up.

### Phase 4 — Measurement and prevention

**G-1** and **G-2**. Arguably these belong *first*: without G-1, three deficits stay invisible; without
G-2, everything fixed here can silently regress. They are placed last only because they block nothing.

---

## 3. Validation strategy (PERF-001 §4.9, §2.11)

### The ruler

`apps/benchmark/results/2026-07-31T05-36-51` (profile `standard`, pinned cores 2-7, 3 runs, cv 0.5–3.8%)
is the **baseline of record**. Every claim below is measured against it.

```bash
# dev-loop / agent iteration — ALWAYS publishable:false, never a table entry
cd apps/benchmark && node scripts/run.js --compare --connections 256 --time 5 --runs 1

# targeted single-scenario check while iterating
node scripts/run.js --scenario empty-response --frameworks nextrush-v3,fastify \
  --connections 256 --time 5 --runs 3 --pin 2-5 --client-pin 6-7

# the real gate — deliberate, human-scheduled, hours
node scripts/run.js --compare --profile standard --pin 2-7 --client-pin 0-1
```

**Never** combine `--profile full`/`standard` with dev-scale overrides — that is the exact defect
`fix-benchmark-measurement-integrity` exists to prevent.

### Per-item acceptance gates

| Item | Functional gate | Performance gate | Predicted |
| ---- | --------------- | ---------------- | --------- |
| C-1 | HEAD==GET status/headers/no-body across static+param+wildcard; explicit `head()` wins both orders; guards run on HEAD; no duplicate OpenAPI ops; conformance across 4 adapters | new `head-request` scenario ≥ Fastify parity | n/a (correctness) |
| F-1 | conformance 504/abort parity; graceful-shutdown suite | **2×2 factorial: `both ≈ none`**; `bench:alloc:handler` down not up | floor 30.48 → ~27.8 µs |
| F-3 | graceful-shutdown `Connection: close` during drain | included in the 2×2 above | −171 B/req |
| F-2 | pollution tests; `EMPTY_PARAMS` identity; `getPrototypeOf` change documented; conformance | `bench:alloc:router` −~150 B/op; **new `%HasFastProperties` assertion** | route-params 39.88 → ~38 µs (small end-to-end; big in handler read cost) |
| F-5 | range/conditional/dotfile/symlink/304 unchanged; mtime invalidation; HEAD paths now live | `static-file` scenario | 111.76 → ~95 µs |
| F-6 | double-next tests; ordering; both `next()` forms | `bench:alloc:compose` general variant | middleware 42.04 → ~37 µs |
| F-7 | RFC-029 security tests + a new stale-memo test | **new prefix-mount arm** | O(1) in mount count |

**Every "predicted" figure is `[D]` arithmetic on component measurements, not a measured end-to-end
result.** PERF-001 §2.11 applies literally: if a change does not move its own declared metric, reject or
revert it. F-9 is exempt because it declares no performance metric.

### Aggregate projection, stated as a hypothesis

If Phases 1–2 land, the floor excess falls from 5.59 µs to ~2.9 µs, which would move `empty-response`
from −18.3% to roughly −8% vs Fastify and lift NextRush past Hono in the overall score. **This is a
projection. It is not a promise, and it must not be quoted as a result.**

---

## 4. Gaps — what this investigation did NOT do

Recorded so the next pass does not assume coverage.

| Gap | Why it matters | What would close it |
| --- | -------------- | ------------------- |
| **`error-handling` (+5.27 µs marginal @1)** not investigated | 4th-largest marginal excess; `HttpError` construction and stack capture are the obvious suspects | Read `core/error-handler.ts` + `errors/http.ts`; measure `new HttpError()` with/without stack capture |
| **`large-post` has no @64/@256 data** and no scoreboard row | At @1 it is **+919 µs / +15% behind Fastify** — the largest relative deficit in the matrix, entirely unexamined | Add the missing concurrency rungs; then investigate `body-source.ts` buffering |
| **`post-json` −22.9% vs raw Node** | Marginal cost beats Fastify, so the gap is floor + body read — but raw Node is far ahead | Isolate `NodeBodySource.buffer()`'s `for await` |
| **Static syscall count unverified** | The `strace` attempt failed; A.2's table is source-read | `strace -c` with idle-baseline subtraction, or `perf trace` |
| **Multi-param fast-mode not tested** | F-2 measured 1 key only; 3–10 keys may transition to dictionary anyway | Extend the candidate bench to deep-route shape **before shipping F-2** |
| **No CPU profile / flamegraph taken** | PERF-001 §2.7 lists these as required evidence; this investigation used RPS decomposition, targeted A/B, allocation and V8 introspection instead | `scripts/profile.js` on `empty-response` and `route-params` — would independently confirm the floor attribution and find the ~2.9 µs still unattributed |
| **Bun/Deno/Edge unmeasured** | Findings F-2 and F-9 are cross-adapter; the wrk suite drives Node only | Run the allocation harnesses per adapter, as `bench:alloc:web` already does |
| **Tie-grouping rule not read** | `query-string` reports a 13.5% spread as `rank 1` at cv 0.5%, which may hide real gaps | Read `scripts/generate-report.js`'s tie logic; derive the band from measured variance |

The largest single gap is the **CPU profile**. Roughly **2.9 µs of the 5.59 µs floor remains
unattributed** (`00` §3), and a flamegraph on `empty-response` is the direct way to close it rather
than continuing to reason from source.

---

## 5. Final engineering verdict

NextRush is **not** a slow framework with a slow router. On seven of nine like-for-like scenarios its
marginal cost per unit of work is **better than Fastify's**, including JSON serialization, object
response writing and body parsing. That is a genuinely strong result and it is invisible in the
scoreboard.

What it has is:

1. **A fixed per-request floor** ~5.6 µs above Fastify's, half of it now attributed to two mechanisms
   that implement process-lifetime concerns with per-request machinery — both fixable without changing
   any contract.
2. **One data-structure choice** (`Object.create(null)`) that puts every `ctx.params` and `ctx.query`
   access in V8 dictionary mode, exporting a permanent deoptimization into user handler code, for a
   security property that a cheaper primitive satisfies identically.
3. **Two subsystems that re-derive per request what is stable** — static file metadata, and the
   double/triple canonicalization on the mount path.
4. **One duplicated abstraction** — two hand-synchronised middleware dispatchers — which is the
   architectural cause of the per-layer cost, not merely correlated with it.
5. **One correctness defect** — HEAD 404s — that no benchmark could have caught because
   `validate-parity.js` does not probe HEAD.

Every one of the five is fixable without weakening a security property, breaking an API, or adding
configuration. Three of them (C-1, F-2, F-3) are small and measured. The framework's problem is not its
design; it is that a handful of individually-reasonable local decisions each added a constant to the
hot path, and the floor they sum to is now large enough to mask how good the rest of it is.

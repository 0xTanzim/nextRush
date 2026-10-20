# Bun POST Hot Path — Phase 1

Scope: reduce Bun JSON POST latency toward 6 µs without changing public API,
timeout semantics, size limits, or the benchmark budget. One optimization
retained (A), one rejected on evidence (B), one deferred (D).

Environment: Bun 1.4.3, Node v26.12.0, Intel i5-8300H (4C/8T, 2.3 GHz), 8 logical
cores. All figures are in-process, per request, on this host. The host is
thermally noisy: observed run-to-run spread is up to ±1 µs on a 4 µs measurement,
so single-run deltas below ~1 µs are not treated as evidence.

## 1. Baseline

Command: `node apps/benchmark/scripts/dev-check/check.mjs inproc`
(the gate runs best-of-three internally, 18 000 POST requests per arm).

| Metric | Before | After (median of 4 runs) |
| --- | --- | --- |
| POST NextRush | 10.96 µs | **8.32 µs** (7.92 / 7.96 / 8.68 / 9.78) |
| POST Hono | 4.19 µs | 4.13 µs (3.85 / 4.07 / 4.10 / 4.39) |
| POST ratio vs Hono | 2.62 (session range 2.62–2.80) | **2.09** (1.95 / 2.06 / 2.12 / 2.23) |
| GET NextRush | 4.389 µs | 4.861 µs (4.576 / 4.633 / 4.977 / 4.861) |
| GET ratio vs Hono | 1.52 | 1.48 (1.42 / 1.48 / 1.52 / 1.48) |
| Raw Bun floor | 2.18 µs | 2.21 µs |
| Budget status | — | 1 PASS / 2 WARN / 0 FAIL, budgets unchanged |

The pre-change and post-change POST ranges do not overlap (10.20–11.58 vs
7.92–9.78), so the improvement is real. Its magnitude is **−2.6 µs (−25%)**
by median, with roughly ±0.7 µs uncertainty. The GET WARN predates this work:
it is the cost of the committed-but-unsettled timeout fix, not of the body path.

## 2. Cost map (POST, 1 KB JSON)

Component figures come from matched A/B probes, not by summing sub-benchmarks.
They are a budget, not an addition table.

| Stage | Cost | Evidence | Scales with |
| --- | --- | --- | --- |
| Raw Bun handler | 2.2 µs | gate floor | body size |
| Timeout deadline | ~1.0–1.9 µs | matched probe; see §5 | fixed |
| Body read (`buffer` + decode) | ~1.0 µs | isolated A/B, §3.1 | body size |
| JSON parse + depth check | ~0.5–1.0 µs | parser-dispatch probe | body size |
| Router + middleware chain | ~1.1 µs | prior report, h12 row | route count |
| Context + response build | ~2.0 µs | prior report | header count |
| **Observed total** | **8.3 µs** | gate | |

## 3. Candidate A — CL-gated native text body read (RETAINED)

### 3.1 Hypothesis and change

The JSON parser only needs a string, but every request materialised a byte
buffer first: `arrayBuffer()` → `new Uint8Array(view)` → cache → `TextDecoder`.
For a body whose transport-proven length fits the limit, `request.text()` gives
the same string without the second copy or the explicit decode.

Implementation:

- `WebBodySource.readTextIfProvenWithin(limit)` — internal. Takes the text path
  only when `Content-Length` is present, at or below `limit`, and the source is
  configured for UTF-8. Returns `undefined` (body untouched) otherwise.
- `body-size-guard.ts` — `exceedsUtf8Limit(text, limit)`. `text.length` is a lower
  bound on UTF-8 bytes, `text.length * 3` an upper bound; the exact encoding runs
  only in the band between them.
- `readBodyText(ctx, limit)` in the parser — probes the capability structurally,
  so `@nextrush/body-parser` keeps its only dependency on `@nextrush/types`.
- `json.ts` — takes the text path only when neither `rawBody` nor `verify` needs
  bytes; the depth guard uses the `3×` upper bound so a multi-byte body cannot
  skip a walk it should have run.

### 3.2 Security basis (measured, Bun 1.4.3, real `Bun.serve`)

| Case | Observed |
| --- | --- |
| `Content-Length` 2 MiB, cap 1 MiB | handler never invoked |
| Declared 10, sent 50 | `text()` returned **exactly 10 bytes** |
| Chunked 1.5 MiB | `text()` threw `Request body exceeded maxRequestBodySize` |
| Declared length exactly 1 MiB | read in full |

HTTP framing truncates to the declared length, so the read cannot exceed it on
any runtime. Bun also caps server-side, but Deno and edge runtimes do not, which
is why the gate requires a present, in-limit `Content-Length` rather than relying
on a server cap. Chunked and absent-length bodies keep the incremental reader and
are never buffered to be checked afterwards.

### 3.3 Measurement

Isolated A/B — identical middleware in both arms, only the read differs,
alternating arm order, first two rounds discarded (7 rounds × 2 500 requests):

```
old median 7.195 µs   new median 6.153 µs   delta -1.042 µs
```

Full pipeline — the gate, four runs before and four after: table in §1,
**−2.6 µs median**, non-overlapping ranges.

The recorded −1.04 µs is the causally attributed part; the larger gate delta is
the reproducible end-to-end result but its size cannot be fully explained on this
noisy host.

### 3.4 Tests

| Surface | Result |
| --- | --- |
| `body-size-guard.test.ts` (bounds: ASCII, 2/3-byte, surrogate, exact boundary) | 9 pass |
| `body-source-text-path.test.ts` (§3.5 contract) | 9 pass |
| `json-text-path.test.ts` (read selection) | 9 pass |
| `@nextrush/runtime` | 377 pass |
| `@nextrush/body-parser` | 314 pass |
| Bun adapter | 129 pass |
| Node adapter | 301 pass |
| Conformance | 436 pass |
| Typecheck (runtime, body-parser) | clean |

### 3.5 Contract pinned

- Eligibility: present `Content-Length` ≤ limit, UTF-8 source. Otherwise
  `undefined` and the body is **not** consumed, so the byte reader still runs.
- Limits: over-limit declared length rejected before any read; over-limit actual
  bytes rejected after the read.
- Caching: `buffer()` after a text read encodes the cached text and returns the
  same bytes; `text()` returns the same string. A second read of a consumed
  source throws `BodyConsumedError`.
- `rawBody` and `verify` always take the byte path and receive the raw payload.
- Empty body continues the chain; malformed JSON and depth violations keep their
  existing error shapes; a text-path size failure maps to `ENTITY_TOO_LARGE`.

### 3.6 Defect found and fixed during review

The first implementation cached the decoded text **before** the size check, so
after an over-limit rejection a later `buffer()` would have returned the
oversized body from the cache. The cache is now written only after the check
passes, and the test asserts that `buffer()` after a rejected read throws
`BodyConsumedError` instead of handing the body back.

## 4. Candidate B — JSON parser composition (REJECTED)

Measured the only cost composition could remove: `bodyParser()`'s content-type
dispatch versus calling `json()` directly, identical elsewhere.

```
combined median 8.028 µs   direct median 8.464 µs   delta -0.435 µs
```

The combined parser is not slower than the direct call; the delta is inside the
noise floor (individual rounds ranged 5.23–14.97 in both arms). There is no
duplicated read, no repeated conversion, and no redundant async boundary left on
the text path. Flattening would be unproven churn, so it is rejected rather than
deferred.

## 5. Candidate C — timeout (CORRECTNESS FIX KEPT, PERF CHANGE PARKED)

Kept: every dispatch is bounded by the deadline, including one that already
committed a response. Commitment is not settlement. Cost: GET +0.686 µs,
POST +0.106 µs (matched A/B).

Parked: removing the settlement promise or the microtask turn window. Five
shapes were measured in the real pipeline, interleaved:

| Shape | Median |
| --- | --- |
| no timeout (floor) | 9.517 µs |
| current | **11.364 µs** |
| race dispatch directly, 4 turns | 12.826 µs |
| race dispatch directly, 0 turns | 12.148 µs |
| no observer promise, 4 turns | 11.950 µs |
| shared deadline wheel, 4 turns | 11.753 µs |

Primitives: timer arm+clear 0.294, race on a resolved promise 0.578, race with a
timer 1.267, 4 turns + race + timer 2.048 µs. The tax is the primitive cost of
bounding an untrusted async chain, not the wrapper's shape.

**Discrepancy, resolved:** the isolated helper measures ~2.0 µs, a matched
full-pipeline comparison measures 1.85 µs, and the gate's own `no-timeout` row
reported 0.57 / 0.20 / 1.02 / 0.92 µs across four runs of unchanged code. The
gate figure varies by 0.8 µs on its own, so it is below its noise floor and cannot
adjudicate; the matched 1.85 µs is consistent with the 2.05 µs isolated cost and
is the figure this report uses. Not claimed solved beyond that.

Do not raise `SETTLE_TURNS` to win the in-process gate: real GET settles at
microtask turn 3 and real POST at turn 8, but a socket body read costs a
macrotask, so a turn count tuned to the in-process harness would not transfer.

## 6. Candidate D — allocation and routing (DEFERRED)

Not attempted. The remaining ~2.3 µs to the 6 µs target sits in context/response
construction (~2.0 µs) and routing (~1.1 µs), which are larger changes than this
phase's budget allows to validate properly. Route specialization and any
Bun-only execution path stay out of scope: the evidence does not yet show a
maintainable advantage, and NextRush's routing semantics (case-insensitive,
non-strict, dot-segment rejection, 405 + `Allow`, mounts) do not map onto Bun's
native route table.

## 7. Changes

Retained: A (text body path), C-correctness (bounded committed wait).
Rejected: B (parser composition — no measurable cost to remove), C-performance
(all five shapes lost).
Deferred: D (context/response and routing), archive of the OpenSpec change.

Files: `packages/runtime/src/body-source.ts`, `body-size-guard.ts` (new),
`packages/middleware/body-parser/src/parsers/{reader,json}.ts`, and four test
files.

Semantic changes: none to the public API. Two internal facts: a text-first read
caches a string and encodes lazily for `buffer()`; an over-limit text read leaves
the source consumed but uncached, matching the byte path's behaviour.

## 8. Findings (out of scope, not fixed)

- `packages/runtime/src/body-source.ts` was 408 lines before this work and 456
  after — over the 300-line cap by a margin that predates the change. Suggested
  split: `WebBodySource` and `AbstractBodySource`/errors into separate modules.
  Deferred because moving the class would invalidate the A/B in this phase.

## 9. Recommended next experiment

| Rank | Experiment | Expected | Confidence | Cost | Risk |
| --- | --- | --- | --- | --- | --- |
| 1 | Context/response construction: reuse the builder's header array, avoid per-request option objects | 0.8–1.5 µs | Medium | Medium | Medium (touches all adapters) |
| 2 | Router: flatten the matched-route call path, avoid the per-request params object when no params | 0.4–0.8 µs | Medium | Low | Low |
| 3 | Timeout: per-server deadline scheduler with a shared timer if profiling shows timer cost dominates on the target deployment | 0.3–0.8 µs | Low | High | High (lifecycle) |

## 10. Reproduction

```
node apps/benchmark/scripts/dev-check/check.mjs inproc
pnpm --filter @nextrush/runtime build
pnpm --filter @nextrush/body-parser build
(cd packages/runtime && pnpm vitest run)
(cd packages/middleware/body-parser && pnpm vitest run)
(cd packages/adapters/bun && pnpm vitest run)
(cd packages/adapters/node && pnpm vitest run)
(cd packages/adapters/conformance && pnpm vitest run)
```

Probes: `/tmp/opencode/probe-bun-body/` (`body-read-ab.ts`,
`parser-dispatch.ts`, `size-guarantees.ts`, `timeout-shapes.ts`,
`committed-fix-cost.ts`).

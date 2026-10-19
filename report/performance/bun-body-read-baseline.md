# Bun body-read baseline — `bun-body-read-parity`

Before/after record for `openspec/changes/bun-body-read-parity` (RFC-043 / ADR-0031). Machine: Intel Core i5-8300H (8 threads), Linux 7.2.10, shared. Runtime: Bun 1.4.3 (latest stable at the time of writing), Deno 2.9.3, Node v26.12.0, wrk 4.2.0.

## Harness fidelity fix (must read before comparing numbers)

The in-proc POST arms originally built `new Request(url, { method: 'POST', body })` **without** `Content-Length`. A real HTTP/1.1 request with a body always carries one, so the harness measured a request shape no server produces — and never reached a length-provable read path. `entries/_inproc-adapter.ts` now adds `content-length` whenever a body is present, for both arms (NextRush and Hono).

Consequence: pre-fix POST numbers captured before this change (29.78–33.65 µs) used the unfaithful shape. The **before** numbers below were re-measured after the fidelity fix by temporarily restoring the pre-change `body-source.ts` (HEAD) and rebuilding, so both sides use the same harness.

## 2.1–2.3 Baseline (before), Bun POST

Command: `taskset -c 0-3 node apps/benchmark/scripts/dev-check/check.mjs inproc --rt bun` (three runs; pre-change `body-source.ts`, faithful harness)

| run | `inproc.post.nextrush.us` | `inproc.post.nextrush.vs_hono` |
| ---: | ---: | ---: |
| 1 | 26.74 µs | 6.22 |
| 2 | 28.92 µs | 7.19 |
| 3 | 26.67 µs | 5.93 |

min 26.67 · median **26.74 µs / 6.22×** · max 28.92 / 7.19 · spread 1.26 ratio points.

Before profile (`profile --entry inproc-nextrush-post --rt bun`): `onRSDefaultControllerStartFulfilled` **39.8%**, `Request` 8.9%, `releaseLock` 6.7%, `async _buffer` 3.1%, `decode` 2.6%, `Response` 2.4%, `drain` 2.4%. The JavaScript `ReadableStream` controller plus lock machinery dominates, exactly as RFC-043 predicted.

## 3.x–4.x RED → GREEN

- New `WebBodySource` tests (native-read selection, fallback, pre-read reject, post-read size check, cache/consumption) were RED before the change (reader path used; `arrayBuffer` never called) and GREEN after: `packages/runtime/src/__tests__/body-source.test.ts`, 40/40.
- Implementation: `WebBodySource._buffer` reads natively when `contentLength !== undefined && contentLength <= limit`; every unprovable body keeps the incremental reader. `AbstractBodySource.buffer(limit)` still owns the pre-check, `_consumed`, post-read check, and cache.
- Follow-on micro-trim: the shared utf-8 `TextDecoder` is reused instead of constructed per `text()` call (measured 0.589 → 0.427 µs/op for a 1 KB decode; ~0.16 µs saved per body read).

## 5.5–5.6 After, Bun POST

Command (same protocol as §2.3): `taskset -c 0-3 node apps/benchmark/scripts/dev-check/check.mjs inproc --rt bun`

| run | `inproc.post.nextrush.us` | `inproc.post.nextrush.vs_hono` |
| ---: | ---: | ---: |
| 1 | 11.87 µs | 2.82 |
| 2 | 12.10 µs | 2.65 |
| 3 | 11.39 µs | 2.62 |

min 11.39 · median **11.87 µs / 2.65×** · max 12.10 / 2.82 · spread 0.20 ratio points.

Median win: **−55.6% µs, ratio 6.22 → 2.65** — far beyond the recorded 1.26 spread.

After profile: `Request` 12.6%, `parse` 9.0%, `arrayBuffer` 6.2%, `encode` 4.9%, `setTimeout` 4.1%, `Response` 4.0%, `decode` 3.2%, `checkJsonDepth` 2.8%, `WebContextBase` 2.0%. The stream controller disappeared; what remains is native request construction, JSON parse, the native read, and the per-request timeout race (`setTimeout` + `race`).

## 2.2 Other runtimes

- **Deno (shares `WebBodySource`):** pre-fix observed 48.32 µs (old harness); after the fast path with the faithful harness: **25.24 µs** (`inproc.post.hono.us` 4.87; ratio 5.18, not gated). Deno's before value was not re-measured with the faithful harness (the pre-fix Deno run predates the harness fix), so its before/after is indicative, not a clean A/B. The direction matches Bun and the mechanism is shared.
- **Node (control, `NodeBodySource` unchanged):** 14.46 µs vs Hono 18.81 → 0.77× (NextRush still wins; the row is not gated).

## 5.7 Wire POST

Scenario added to `dev-check`: `wire` now starts `serve-nextrush-post` and `serve-hono-post`, requires one raw POST to answer `200 {"ok":true}`, then runs `wrk -t2 -c64 -d3s` with a 1 KB JSON body (`lib/wrk.mjs`), median of three runs. Both entries use the same adapter path as their GET counterparts.

A/B against `ee1769e7` (pre-fast-path) with the new scenario copied into a worktree, Bun, alternating arms on the same machine. Ratio is NextRush ÷ Hono **throughput**:

| arm | run | `wire.post.nextrush.rps` | `wire.post.hono.rps` | ratio |
| --- | ---: | ---: | ---: | ---: |
| before | 1 | 9,013 | 27,581 | 0.33 |
| after | 1 | 21,504 | 30,066 | 0.72 |
| after | 2 | 22,608 | 27,985 | 0.81 |
| before | 2 | 9,133 | 28,433 | 0.32 |

The native read translates to the socket path: median POST throughput 9,073 → 22,056 rps (**2.43×**), and the ratio to Hono moves from 0.32–0.33 to 0.72–0.81. Hono stayed within 27.6–30.1k rps across all four runs, so the change is far outside machine drift. NextRush still serves fewer POSTs/second than Hono on Bun; the change closes most, not all, of the gap.

On Node the same scenario reports `wire.post.nextrush.vs_hono` 1.00 (16,359 vs 16,398 rps, one run), consistent with `NodeBodySource` being unchanged.

## 5.8 Budget ratchet

`apps/benchmark/scripts/dev-check/budgets.json` → `inproc.post.nextrush.vs_hono` (Bun only):

- before: `max: 9.0`, `target: 1.3`
- after: **`max: 3.5`, `target: 3.0`** (measured median 2.65, spread 0.20 → ~0.85 ratio points of headroom below max)

## Verification

- `packages/runtime` 350/350 (body-source 40/40), `@nextrush/body-parser` green, `@nextrush/adapter-bun` 127/127, `@nextrush/adapter-deno` 121/121.
- Conformance: Node suite 436/436; real Bun 56/56; real Deno 56/56; real Edge via
  `workerd 2026-10-11`: 15/15 probes INFO, 0 FAIL.
- Lint + `tsc --noEmit` clean for touched packages.
- Not done in this pass: body-parser-specific fast-path integration tests (task 3.4).

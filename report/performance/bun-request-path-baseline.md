# Bun request-path baseline — `reduce-bun-request-path-cost`

Baseline and attribution captured for `openspec/changes/reduce-bun-request-path-cost` (tasks 1.1–1.5), before any implementation.

- Machine: Intel Core i5-8300H (8 threads), Linux 7.2.10 (Fedora), shared
- Runtime: Bun 1.4.3 (pinned), Node v26.12.0, wrk 4.2.0
- Date: 2026-10-19

All numbers below are from this machine on the same day, run sequentially. The machine is shared, so the reported spreads are real and are the parking threshold for group 5.

## 1.1 Wire stage (before)

Command: `node apps/benchmark/scripts/dev-check/check.mjs wire --rt bun` (median of three `wrk` runs; min–max range in parentheses)

| row | rps (median) | range |
| --- | --- | --- |
| `wire.nextrush.rps` | 34,513 | 33,985–35,381 |
| `wire.nextrush.no-timeout.rps` | 36,825 | 36,801–36,865 |
| `wire.hono.rps` | 42,330 | 40,224–43,156 |
| `wire.elysia.rps` | 49,887 | 48,843–49,925 |
| `wire.raw.rps` | 47,968 | 47,241–51,331 (floor, client may saturate) |

Stage result: `PASS 0 WARN 0 KNOWN 0 FAIL 0 INFO 5` — all rows INFO by design (dev-check README: wire is never a budget row). Delta vs the previous wire run on this machine: NextRush −6.4%, consistent with shared-machine drift.

NextRush/Hono ratio: 34,513 / 42,330 ≈ **0.82×** (the mate row `wire.nextrush.no-timeout.rps` gives 36,825 / 42,330 ≈ **0.87×**; the two NextRush rows differ only in the timeout-race configuration of the wire app).

## 1.2 In-process stage (before)

Command: `node apps/benchmark/scripts/dev-check/check.mjs inproc --rt bun` (best of three)

| row | value |
| --- | --- |
| `inproc.nextrush.us` | 3.98 µs/req (adapter-bun on bun) |
| `inproc.nextrush.web.us` | 4.03 µs/req (control, same runtime) |
| `inproc.nextrush.no-timeout.us` | 4.18 µs/req |
| `inproc.raw.us` | 2.38 µs/req (floor) |
| `inproc.hono.us` | 3.10 µs/req |
| `inproc.nextrush.vs_hono` | **1.29** — committed budget `target 1.3`, `max 1.9` → PASS |
| `inproc.nextrush.h12.us` | 5.89 µs/req |
| `inproc.hono.h12.us` | 5.17 µs/req |
| `inproc.nextrush.vs_hono.h12` | **1.14** — target 1.3 → PASS |
| `inproc.post.nextrush.us` | 30.85 µs/req — `inproc.post.nextrush.vs_hono` 6.85, target 1.3 → WARN |
| `inproc.post.hono.us` | 4.50 µs/req |

Stage result: `PASS 2 WARN 1 KNOWN 0 FAIL 0 INFO 9`. The GET gate row sits just below its 1.3 target (1.29, −7.2% vs the previous run), within its recent 1.29–1.39 band. The POST WARN belongs to the sibling change `bun-body-read-parity` and is recorded here only for run context; it is not this change's target and no POST work is planned here.

## 1.3 Request-path profiles (before)

Commands: `node apps/benchmark/scripts/dev-check/check.mjs profile --entry inproc-nextrush --rt bun` and `--entry inproc-nextrush-web --rt bun` (full reports: `apps/benchmark/scripts/dev-check/.out/prof/CPU.20261019.230254.690097.0.001.md`, `CPU.20261019.230255.690136.0.001.md`)

Ranked self-time, `inproc-nextrush`:

| rank | function | self% | location |
| ---: | --- | ---: | --- |
| 1 | `Request` | 36.1% | `[native code]` |
| 2 | `Response` | 20.7% | `[native code]` |
| 3 | `Headers` | 5.1% | `[native code]` |
| 4 | `set` | 3.6% | `[native code]` (Headers.set) |
| 5 | `stringify` | 3.3% | `[native code]` (JSON) |
| 6 | `requestTargetFromUrl` | 2.4% | bundle `prof-inproc-nextrush.bun.js:2876` |
| 7 | `has` | 1.8% | `[native code]` (Headers.has) |
| 8 | `(anonymous)` | 1.5% / 10.2% total | bundle `:708` |
| 9 | `WebContextBase` | 1.5% | bundle `:3178` |
| 10 | `async (anonymous)` | 1.5% / 24.3% total | bundle `:2867` |

`inproc-nextrush-web` has the same shape (`Request` 39.8%, `Response` 19.2%, `stringify` 4.0%, `Headers` 3.5%, `set` 2.9%, …; top pipeline frame `async (anonymous)` at `:2873`, 28.4% total).

Attribution across adapter/runner/dispatch/response:

- **Runtime boundary (~70% self-time):** native `Request`/`Response`/`Headers` construction plus header and JSON work dominate. This is Bun's platform object churn around the Web-standard boundary, not adapter code.
- **Context/runner tree:** `createBunContext` 10.4% total (`inproc-nextrush`) and 13.3% total (`inproc-nextrush-web`); `BunContext` frames 8.7–11.6% total. This is the adapter + context construction + dispatch tree, and it contains both named candidates.
- **Named candidates below threshold:** neither `trackedHandler` nor the `requestIP` thunk surfaces at the profile's print threshold (grep of the full reports finds `BunContext`/`createBunContext` frames only). Their cost is invisible here by design of the print cutoff and is measured directly in §1.4.
- **Limitation (recorded, not guessed):** the dev-check `profile` stage has no serve/wire entry, so wire-stage attribution relies on the in-proc profile plus the wire-vs-in-proc delta. Bundle line numbers are minified artifacts (esbuild of the harness entries); functions are attributed by symbol name.

## 1.4 Candidate measurements (before)

Harness added for this change: `apps/benchmark/scripts/alloc/bun-request-path-alloc.js` + `bun-request-path-alloc-child.js` (house allocation protocol: 5 runs per variant, isolated `--expose-gc` child, `heapUsed` delta ÷ 200,000 retained ops; shapes replicated 1:1 from `packages/adapters/bun/src/adapter.ts` — `trackedHandler` in `serve()`, `makeContext` in `createBunRequestRunner`). Raw artifact: `apps/benchmark/results/bun-request-path-alloc-2026-10-19T17-07-41/bun-request-path-alloc.json`.

Command (from `apps/benchmark`): `node scripts/alloc/bun-request-path-alloc.js`

| candidate | current path | post-trim path | removed per request |
| --- | --- | --- | --- |
| drain accounting (`trackedHandler` async wrapper + counter) | 448.5 B/req ± 4.0 (cv 0.88%) | 56.1 B/req ± 0.0 (cv 0%) | **392.4 B/req** |
| client-address resolver thunk (`() => server.requestIP(request)?.address ?? ''`) | 64.1 B/req ± 0.0 (cv 0%) | 8.1 B/req ± 0.01 (cv 0.08%) | **56.0 B/req** |

Interpretation: both candidates have a deterministic, near-zero-cv allocation signal. The drain wrapper removes one async frame (fresh promise + async execution context) plus two counter mutations per request; the resolver thunk removes one closure per request. Method limits: measured under the harness's Node/V8 child (house protocol) with replicated shapes — the removed work is structural, so direction and order of magnitude carry to JSC even though absolute bytes differ; the `direct` floor (56.1 B/req) is the unchanged base handler's own promise, and the `refs` floor (8.1 B/req) is measurement overhead.

Platform facts (pinned Bun 1.4.3, probed live — these feed the RFC mechanism):

- `server.pendingRequests` reports 1 while a request is in flight and 0 after it settles.
- `server.stop(closeActiveConnections?: boolean): Promise<void>`; the returned promise does **not** resolve while an in-flight request is pending and resolves after it completes — the platform promise itself is a drain wait, with no counter and no polling.
- `server.stop()` on an idle server and `server.stop(true)` both return a promise; force-close semantics are unchanged.

## 1.5 CPU-pinned noise floor

Command (three runs): `taskset -c 0-3 node apps/benchmark/scripts/dev-check/check.mjs inproc --rt bun`

| run | `inproc.nextrush.us` | `inproc.nextrush.vs_hono` | `inproc.nextrush.vs_hono.h12` |
| ---: | ---: | ---: | ---: |
| 1 | 4.148 µs | 1.29 (PASS) | 1.19 |
| 2 | 4.064 µs | 1.31 (WARN) | 1.24 |
| 3 | 4.042 µs | 1.26 (PASS) | 1.18 |

- `inproc.nextrush.vs_hono`: min **1.26**, median **1.29**, max **1.31**.
- **Spread = 0.05 ratio points (max − min), ≈ 3.9% of the median — this is the group-5 parking threshold.** A candidate whose after median does not exceed its before median by more than this spread is parked, per the `web-adapters` spec delta.
- The committed target (1.3) sits *inside* the spread: single runs cross it in both directions (1.31 WARN, 1.26 PASS). Any task 5.8 ratchet therefore needs repeated-run evidence with headroom beyond the spread, never a single lucky run.
- h12 ratios in the same runs: 1.19 / 1.24 / 1.18 (min 1.18, median 1.19, max 1.24).
- Raw absolute times spread ≈ 2.6% (4.042–4.148 µs); the ratio spread is wider because it is a quotient of two independently noisy means.

## 1.6 Accepted candidate list (RFC-044)

Accepted: **drain wrapper deletion** (392.4 B/req) and **resolver-thunk deletion** (56.0 B/req) — both behaviour-preserving, both inside `packages/adapters/bun`, both accepted on deterministic allocation evidence per the `web-adapters` spec delta.

**No additional candidates** (task 3.5): the profile attributes no further adapter/runner-owned site above threshold — the remaining self-time is native `Request`/`Response`/`Headers` construction plus the inherent context tree, and `wire` remains INFO with no budget row.

---

# After — implementation complete

Same machine, same commands, same pinned Bun 1.4.3. Raw artifacts: `apps/benchmark/results/bun-request-path-alloc-2026-10-19T17-23-34/`, `.out/prof/CPU.20261019.232230.702380.0.001.md`, `.out/prof/CPU.20261019.232231.702453.0.001.md`.

## 5.5 Wire (after)

Command (identical to §1.1): `node apps/benchmark/scripts/dev-check/check.mjs wire --rt bun`

| row | before | after |
| --- | --- | --- |
| `wire.nextrush.rps` | 34,513 (33,985–35,381) | **36,632** (35,199–37,726) |
| `wire.nextrush.no-timeout.rps` | 36,825 (36,801–36,865) | 36,030 (35,736–36,224) |
| `wire.hono.rps` | 42,330 (40,224–43,156) | 40,043 (39,255–40,489) |
| `wire.elysia.rps` | 49,887 (48,843–49,925) | 48,710 (48,011–50,238) |
| `wire.raw.rps` | 47,968 (47,241–51,331) | 50,358 (48,891–50,695) |

**Verdict: wire claim parked.** NextRush moved +6.1% against the previous run, but Hono moved −5.4%, Elysia −2.4%, and the raw floor +5.0% in the same invocation — the machine drifted. The before/after sample ranges touch (35,199 vs 35,381), and the recorded drift band on this machine is ~6.4% (§1.1 delta). The measured movement does not exceed that band, so no wire improvement is claimed and no wire budget row is added. The NextRush/Hono ratio moved 0.82× → 0.91×, but both sides moved independently; recorded, not claimed.

## 5.6 In-process, profile, allocation (after)

Command (identical to §1.2): `node apps/benchmark/scripts/dev-check/check.mjs inproc --rt bun`

| metric | before | after |
| --- | --- | --- |
| `inproc.nextrush.us` | 3.98 µs | 4.295 µs |
| `inproc.nextrush.vs_hono` | 1.29 | 1.28 (inside spread) |
| `inproc.nextrush.vs_hono.h12` | 1.14 | 1.22 |
| `inproc.raw.us` / `inproc.hono.us` | 2.38 / 3.10 µs | 2.50 / 3.35 µs |

The control rows moved the same way (raw +5%, Hono +8%), so the absolute shift is machine state, not the trims. Profiles (identical commands) keep the same shape — `Request` 37.9%, `Response` 15.5%, `stringify` 4.6%, `Headers` 3.9%, `requestTargetFromUrl` 3.6%, `WebContextBase` 1.6% self — and still show no adapter-owned site above threshold.

Allocation harness rerun: drain wrapper **389.8 B/req** removed (445.9 → 56.1, cv ≤0.47%), resolver thunk **56.0 B/req** removed (64.1 → 8.1, cv ≤0.07%) — reproduces §1.4 within 0.7%.

## 5.7 CPU-pinned A/B (after)

Command (identical protocol to §1.5): `taskset -c 0-3 node apps/benchmark/scripts/dev-check/check.mjs inproc --rt bun` ×3

| run | `inproc.nextrush.vs_hono` |
| ---: | ---: |
| 1 | 1.32 |
| 2 | 1.27 |
| 3 | 1.40 |

min 1.27, median **1.32**, max 1.40. Before median was 1.29. Delta +0.03 → **inside the 0.05 parking threshold**. The after spread widened to 0.13 because the gate runs shared the machine with the other verification stages. **Verdict: parked** — no in-process win claimed and no target ratchet.

## 5.8 Budgets

`apps/benchmark/scripts/dev-check/budgets.json` is unchanged. 5.6–5.7 did not produce a win beyond the spread, and `wire` never gains a budget row. `bookkeeping` passes on Bun/Node/Deno.

## 5.9 Full gate

| runtime | result |
| --- | --- |
| Bun (`bundle cold inproc probe bookkeeping`) | PASS 26 · WARN 1 (POST ratio, sibling change) · KNOWN 0 · FAIL 0 |
| Node (same stages) | PASS 23 · WARN 0 · KNOWN 0 · FAIL 0 |
| Deno (same stages) | PASS 17 · WARN 1 · KNOWN 1 (pre-existing FB-03 gzip exemption) · FAIL 0 |

No new KNOWN results; zero FAIL.

## 5.10 Parity

`pnpm bench:validate` → "Parity OK — 6 servers agree on bodies, content types, statuses, and middleware headers" (raw Node, NextRush, Fastify, Hono, Koa, Express; accept-queue backlog equal at 1024).

## 5.11 Tests, conformance, static checks, coverage

- `@nextrush/adapter-bun` tests: **127 / 127** across 9 files (RED → GREEN recorded for the two new drain assertions and three new address assertions).
- Conformance Node suite: **436 / 436** (13 files). Real Bun runner: **56 pass / 0 fail** (54 recorded proofs, 54 satisfied over a real socket). Real Deno runner: **56 passed / 0 failed**. Edge/workerd runner not executable locally (no `workerd` binary) — Edge handler parity is covered by the Node conformance drivers.
- Lint: clean (`oxlint src`). Strict typecheck: clean (`tsc --noEmit`).
- Coverage (`vitest --coverage`): `context.ts` **100% lines** (90.9% branches); `adapter.ts` 82.53% lines; package **86.58% lines / 82.81% branches** — above the package's recorded exempt baseline (58.06% / 50.72% when it was added to `KNOWN_BELOW_THRESHOLD`), so no decrease. The package remains on the repo's pre-existing exemption list.

## Kept / parked

- **Kept:** drain-wrapper removal (389.8–392.4 B/req) and resolver-thunk removal (56.0 B/req) — both accepted on deterministic allocation evidence plus the package tests and conformance, per the spec delta.
- **Parked:** the wire improvement claim and any in-process ratio claim/ratchet — both inside the recorded spread. No code was parked; both trims are kept and independently revertible.

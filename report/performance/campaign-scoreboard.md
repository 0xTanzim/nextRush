# Performance campaign scoreboard — workloads × runtimes

| Field            | Value                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| **Report type**  | `Performance`                                                         |
| **Scope**        | The NextRush request-path cost campaign: every workload, every runtime |
| **Date**         | `2026-10-21`                                                          |
| **Machine**      | Intel Core i5-8300H, 4C/8T, **shared**. SMT siblings 0↔4, 1↔5, 2↔6, 3↔7 |
| **Runtimes**     | Bun 1.4.3 · Node v26.12.0 · Deno 2.9.7 · Hono 4.13.0 (comparison baseline) |
| **Status**       | `Live` — updated as each cycle lands                                   |

## 1. The measurement protocol (the only one that resolves here)

Wall-clock throughput on this box swings ~40 % between runs of the *same* binary, so it resolves
nothing at the 1–2 % level. The protocol that does:

- **Server pinned to physical core 0** (sibling 4 idle). **`wrk` on physical cores 1 and 3**
  (siblings 5 and 7 idle) — the load generator never shares a core with the server.
- 3 s warmup (discarded) + 8 s measurement per arm; **arms alternate, and the order flips every
  pair**, so slow drift cannot favour one arm.
- **Primary metric: the server's own CPU per request** — `(utime + stime)` from `/proc/<pid>/stat`
  ÷ the request count `wrk` reports. Secondary: rps.
- **The reported statistic is the paired delta per pair**, not the difference of two medians. The
  paired delta cancels the drift that separates two separately-measured arms, and it is the only
  statistic that separates a real effect from noise on this machine.
- Bundles are built from **source** through `apps/benchmark/scripts/dev-check/lib/build.ts`, which
  aliases `@nextrush/*` to `packages/**/src/index.ts`. A "before" arm restores the changed source
  files to their `HEAD` content for the build only — never a stash, reset, or checkout.

Harness and raw data: `/tmp/opencode/ab/` — `ab.mjs` (paired runner), `compose-arm.mjs` (per-change
arms), `build-bundles.sh` (before/after bundles), `paired.mjs` (paired-delta statistic),
`res-*.json` (every run's per-pair rows).

## 2. Scoreboard

`CPU/req` is the server's CPU microseconds per request. Ratios are **NextRush ÷ Hono** for the same
workload on the same runtime, measured in the same session — the campaign's committed question is
"what does the framework cost over the baseline", not "who is faster in absolute terms".

| Workload | Runtime | CPU/req (now) | vs Hono | Quality | Major remaining costs | Constraints | Status |
| --- | --- | ---: | ---: | --- | --- | --- | --- |
| Minimal GET | Deno | 11.07 µs | 1.21× | Good — was 1.51× at HEAD | context construction, dispatch scaffolding, Deno's native header handling | Deno's `Response` fast path needs an exact media type | ✅ improved this cycle |
| Minimal GET | Bun | 12.98 µs | 1.16× | Good | context construction, dispatch scaffolding | Bun's `Headers` is cheap, so this class of work barely exists there | ✅ improved this cycle |
| Minimal GET | Node | 22.92 µs | not measured this cycle | Fair | Node's own HTTP + `writeHead` path dominates | Node is not the campaign's target runtime | ⬜ unchanged |
| JSON POST (1 KB) | Deno | 38.66 µs | 1.54× | Weak | body reading dominates; the response path is no longer the bottleneck | body-read parity across runtimes | ⬜ open — the next target |
| JSON POST (1 KB) | Bun | 27.13 µs | not measured this cycle | Fair | body reading | — | ⬜ unchanged |
| JSON POST (1 KB) | Node | 42.15 µs | not measured this cycle | Fair | body reading | — | ⬜ unchanged |
| Static GET | — | not measured | — | Unknown | — | — | ⬜ not investigated |
| Dynamic-route GET | — | not measured | — | Unknown | — | — | ⬜ not investigated |
| GET with middleware | — | not measured | — | Unknown | — | — | ⬜ not investigated |
| Raw-body POST | — | not measured | — | Unknown | — | — | ⬜ not investigated |
| Extra headers / multiple `Set-Cookie` | — | not measured | — | Unknown | — | — | ⬜ not investigated |
| Streaming / compression / error paths | — | not measured | — | Unknown | — | — | ⬜ not investigated |

The unmeasured rows are **unknown, not good**. The mission's workload matrix names them; the
campaign has not yet produced numbers for them, and this report does not pretend otherwise.

## 3. Candidate backlog

| # | Candidate | Mechanism | Evidence | Status |
| --- | --- | --- | --- | --- |
| 1 | Response built from a plain init record | No per-response `Headers` allocation; Deno's static fast path needs the plain-object shape | Deno GET −16.6 % CPU/req (4/4 pairs); Bun −5.3 %; Node neutral. Construction priced in isolation: 1.019 µs → 0.230 µs | ✅ **implemented, verified** |
| 2 | JSON media type `application/json` | Deno's fast path accepts only that exact value; RFC 8259 §8.1 defines no `charset` for it | Isolated: 0.674 µs → 0.230 µs for the same shape. End-to-end it is worth ~0.1 µs alone, and it is **required** for #1 to pay off | ✅ **implemented, verified** (breaking) |
| 3 | `declare` on the context's constructor-assigned fields | `useDefineForClassFields` emitted a per-instance define the constructor overwrote | Below the measurement floor (Deno median +0.33 µs, 1/3 pairs faster). Kept on the structural argument, not a speed claim | ✅ **implemented** — effect unmeasurable |
| 4 | Compiled dispatch plan | Remaining dispatch scaffolding ≈ 0.57 µs self | ≤ 3 % of the request; would risk the middleware/`next()`/timeout contracts | ❌ **rejected** |
| 5 | Sync-vs-promise return refactor | Avoid a promise hop per dispatch | No consistent signal across 5 pairs | ❌ **rejected** |
| 6 | Native `indexOf` URL scan instead of the `charCodeAt` loop | Native string search | 6 ns, **and** a semantic defect: the native form parses `http://h/p#f?x=1` as path `/p#f` + search `?x=1` | ❌ **rejected** |
| 7 | `pairs` response construction (`[['content-type', v]]`) | The archived spike's best Bun allocation shape (−10.9 B) | Not a plain object, so it cannot enter Deno's fast path; Node's worst `default` shape (+127 B) | ❌ **rejected** |
| 8 | Runtime-branching construction | Each runtime takes its cheapest shape | Forbidden by AGENTS.md §4 | ❌ **rejected** |
| 9 | Fixed-key JSON serializer | `JSON.stringify` is 88 % of the large-response profile | Byte-identical prototype measured **4.4× slower** (RFC-042) | ❌ **rejected** |
| 10 | POST body read on Deno | Body reading dominates the POST path (1.54× Hono) | Not yet investigated against the current code | ⬜ **open — next** |
| 11 | Context construction (`WebContextBase`) | 0.479 µs/req self time in the Deno profile | Partly addressed by #3; the rest is method normalisation, target derivation, query parse, body-source selection | ⬜ **open** |
| 12 | `requestTargetFromUrl` (0.235 µs/req) | Manual `charCodeAt` scan of the URL | The native alternative has a semantic defect (#6); the scan itself is a correctness-preserving cost | ⬜ **open — needs a different idea** |
| 13 | Dispatch/timeout micro-task turns | `dispatchWithTimeout` 0.146 µs/req self | Partly addressed by RFC-045's bounded timeout dispatch | ⬜ **open** |

## 4. Cross-runtime status of the completed cycle

| Workload | Deno | Bun | Node | Conformance |
| --- | --- | --- | --- | --- |
| GET — server CPU/req | **14.74 → 12.29 µs (−16.6 %)**, 4/4 pairs faster | 14.13 → 13.37 µs (−5.3 %), 3/4 | 23.13 → 22.92 µs (noise, 2/4) | 436/436 in-process; 56/56 real Bun; 56/56 real Deno; 16/16 real workerd |
| POST — server CPU/req | **44.06 → 40.50 µs (−8.1 %)**, 4/4 pairs faster | 27.36 → 27.13 µs (−0.8 %), 4/4 | 42.81 → 42.15 µs (−1.5 %), 3/4 | same suites |
| Gap to Hono (GET) | **1.51× → 1.21×** | 1.16× | not measured | — |
| Gap to Hono (POST) | 1.54× | not measured | not measured | — |

## 5. Remaining work, by benefit and confidence

1. **POST body reading on Deno** — benefit: the largest measured gap (1.54× Hono); confidence:
   medium (the mechanism is known from the Bun body-read work, but the Deno path is a different
   implementation). Next cycle.
2. **Context construction** — benefit: 0.479 µs/req self time, the largest remaining framework-side
   item; confidence: medium, because each piece is 15–45 ns and no single item clears the noise
   floor. Needs a structural idea, not a micro-trim.
3. **The unmeasured workloads** (static GET, dynamic route, middleware, raw-body POST, extra
   headers, streaming/compression/error) — benefit: unknown until measured, and the mission names
   them; confidence: high that measuring them is worthwhile. Cheap: they reuse this harness.
4. **The raw-response profile** — benefit: the `requestTargetFromUrl` and dispatch items are visible
   in a profile, but the profile itself costs a rebuild of the Deno profiling harness. Confidence:
   medium.

## 6. Findings

- **F-01 — The changeset baseline validator parses zero packages.** `scripts/validate-changeset-baselines.ts`
  matches `/^"([^"]+)":\s*(patch|minor|major)\s*$/` — **double quotes only** — while every changeset
  in the repository uses single quotes. The validator therefore reports "0 package(s) across 8
  changeset file(s)" and passes vacuously. The packages in this cycle's changeset were verified
  independently against the npm registry instead (all 13 have published history). *Not fixed here*:
  the script is outside this change's scope, and its fix would touch release tooling.
- **F-02 — Two conformance runners cannot load under the root vitest config.**
  `bun-runner/conformance.bun.test.ts` and `deno-runner/conformance.deno.test.ts` import `bun:test`
  and use the `Deno` global. The conformance package's own vitest config excludes them
  (`include: ['src/**/*.test.ts']`), and they pass when run natively (`bun test`,
  `deno task conformance`). Pre-existing, not a regression; recorded so nobody reads the root-config
  failure as one.
- **F-03 — The static-file MIME table still maps `.json` to `application/json; charset=utf-8`.**
  `packages/middleware/static/src/utils.ts` is a different surface from a framework-generated
  response, so it was deliberately left alone — but the framework now has two JSON media types in
  two places, which is worth a decision.

## 7. Reproduction

See §1 for the harness layout and
[`json-media-type-and-response-construction.md`](json-media-type-and-response-construction.md) §10
for the exact commands of the completed cycle. The Hono comparison bundles are built from
`apps/benchmark/scripts/dev-check/entries/serve-hono.ts` (the repository's own entry, so the
workload is identical) and from `/tmp/opencode/ab/hono-web.ts` for the Bun/Deno arms, which omits
`@hono/node-server` so the same bundle runs on all three runtimes.

## 8. Update — 2026-10-21: the Deno POST deadline, and the JSON media type re-examined

Source: [`deno-post-timeout-and-json-media-type.md`](deno-post-timeout-and-json-media-type.md).
Governing change: `openspec/changes/shared-request-deadline-scheduler/`.

### 8.1 The Deno POST gap, resolved

| Workload | Runtime | Before | After | Paired Δ | Δ% |
| --- | --- | ---: | ---: | ---: | ---: |
| JSON POST | Deno | 35.02 µs | **30.17 µs** | **−4.84 µs** | **−13.8 %** (3/3) |
| JSON POST | Bun | 25.90 µs | **23.20 µs** | **−2.71 µs** | **−10.4 %** (3/3) |
| JSON POST | Node | 41.92 µs | 40.84 µs | −1.07 µs | −2.6 % (noise; the Node adapter keeps its own race) |
| Minimal GET | Deno | 13.73 µs | 13.47 µs | −0.26 µs | −1.9 % (noise — no regression) |

The dominant cost was the **per-request timeout timer**: 19.5 % of Deno's busy time, and 8.28 µs per
request measured end to end with the race disabled. One shared timer per runner replaces it. The
Deno POST gap to Hono: **1.54× → 1.20×**.

### 8.2 The JSON media type, re-decided with direct evidence

Preserving `application/json; charset=utf-8` is **not** comparably fast: it costs 1.04 µs per
request (−7.3 %) on Deno GET, because that value is not one of the three literals Deno's
`Response` constructor accepts for its static fast path. The bare value is kept; the RFC-046 §12
alternatives and their numbers are recorded. The static-file MIME table is deliberately unchanged.

### 8.3 Candidate status updates

| # | Candidate | Status |
| --- | --- | --- |
| 10 | POST body read on Deno | ⬜ **open** — the profile shows Deno's own stream machinery at ≈ 8.7 % of busy; the framework's share of the POST path is now the JSON parser closure (10.00 %) and context construction (4.07 %) |
| 11 | Context construction | ⬜ open — 4.07 % of Deno POST busy time |
| 12 | `requestTargetFromUrl` | ⬜ open — 1.67 %; the native alternative has a semantic defect, so it needs a different idea |
| 14 | Node adapter's own timeout race | ⬜ **new, open** — Node still pays ≈ 0.97 µs per POST for a per-request timer; applying the shared scheduler there needs the scheduler exported (a deliberate public-surface change) and coordination with the `server.timeout` socket guard |
| 15 | `matchContentType` (1.67 %) | ⬜ open — the JSON parser's content-type detection on every POST |

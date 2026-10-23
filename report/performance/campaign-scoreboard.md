# Performance campaign scoreboard — workloads × runtimes

| Field           | Value                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| **Report type** | `Performance`                                                              |
| **Scope**       | The NextRush request-path cost campaign: every workload, every runtime     |
| **Date**        | `2026-10-23`                                                               |
| **Machine**     | Intel Core i5-8300H, 4C/8T, **shared**. SMT siblings 0↔4, 1↔5, 2↔6, 3↔7    |
| **Runtimes**    | Bun 1.4.4 · Node v26.12.0 · Deno 2.9.7 · Hono 4.13.0 (comparison baseline) |
| **Status**      | `Live` — updated as each cycle lands                                       |

## 1. The measurement protocol (the only one that resolves here)

Wall-clock throughput on this box swings ~40 % between runs of the _same_ binary, so it resolves
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

Harness and raw data: `report/performance/raw/` on the measurement machine — `ab2.mjs` (paired
runner), `recompute.mjs` (recomputes the paired summary from a recorded file), and `res-*.json`
(every run's per-pair rows). Raw benchmark output is **gitignored and never committed**; it is
reproducible evidence, not repository history. Earlier cycles used throwaway scripts under
`/tmp/opencode/ab/`; those are gone and superseded by `raw/`.

## 2. Scoreboard

`CPU/req` is the server's CPU microseconds per request. Ratios are **NextRush ÷ Hono** for the same
workload on the same runtime, measured in the same session — the campaign's committed question is
"what does the framework cost over the baseline", not "who is faster in absolute terms".

| Workload                              | Runtime | CPU/req (now) |                 vs Hono | Quality                               | Major remaining costs                                                                                                       | Constraints                                                                | Status                                                                                |
| ------------------------------------- | ------- | ------------: | ----------------------: | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Minimal GET                           | Deno    |      11.10 µs |      1.21× (2026-10-21) | Good — was 1.51× at HEAD              | context construction, dispatch scaffolding, Deno's native header handling                                                   | Deno's `Response` fast path needs an exact media type                      | ✅ improved this cycle (§10)                                                          |
| Minimal GET                           | Bun     |      11.58 µs |               **1.10×** | Good — was 1.16×                      | context construction, dispatch scaffolding                                                                                  | Bun's `Headers` is cheap, so this class of work barely exists there        | ✅ improved this cycle (§10)                                                          |
| Minimal GET                           | Node    |      23.83 µs | not measured this cycle | Fair                                  | Node's own HTTP + `writeHead` path dominates; the sync fast path cannot apply (callback runner)                             | Node is not the campaign's target runtime                                  | ⬜ unchanged — no regression                                                          |
| JSON POST (1 KB)                      | Deno    |      34.08 µs |      1.54× (2026-10-21) | Weak                                  | body reading dominates; the response path is no longer the bottleneck                                                       | body-read parity across runtimes                                           | ⬜ open — the next target                                                             |
| JSON POST (1 KB)                      | Bun     |  **26.47 µs** |  **1.23×** (2026-10-23) | Weak — still the largest measured gap | body reading through `bodyParser`; the settle window is now skipped for body-bearing requests, the remainder is parser work | body-read parity across runtimes                                           | 🔶 partly improved this cycle (§11)                                                   |
| JSON POST (1 KB)                      | Node    |      40.12 µs | not measured this cycle | Fair                                  | body reading                                                                                                                | —                                                                          | ⬜ unchanged — −3.0 % (3/3) from the shared resolved dispatch                         |
| Static GET                            | Node    |     126.04 µs |                       — | Poor — 2.7× a `readFile`+`send` floor | `lstat` for symlink policy, `open`/`read`/`close`, one extra read inside `readFile`                                         | `serveStatic` is Node-only, so there is no cross-runtime parity to protect | ⚠️ measured — was 143.59 µs, now −13.6 %; range/large-file streams still drop headers |
| Dynamic-route GET                     | —       |  not measured |                       — | Unknown                               | —                                                                                                                           | —                                                                          | ⬜ not investigated                                                                   |
| GET with middleware                   | —       |  not measured |                       — | Unknown                               | —                                                                                                                           | —                                                                          | ⬜ not investigated                                                                   |
| Raw-body POST                         | —       |  not measured |                       — | Unknown                               | —                                                                                                                           | —                                                                          | ⬜ not investigated                                                                   |
| Extra headers / multiple `Set-Cookie` | —       |  not measured |                       — | Unknown                               | —                                                                                                                           | —                                                                          | ⬜ not investigated                                                                   |
| Streaming / compression / error paths | —       |  not measured |                       — | Unknown                               | —                                                                                                                           | —                                                                          | ⬜ not investigated                                                                   |

The unmeasured rows are **unknown, not good**. The mission's workload matrix names them; the
campaign has not yet produced numbers for them, and this report does not pretend otherwise.

The Bun POST row was refreshed in §11's window. Its `CPU/req` is not comparable to the §10 rows
measured in a different window — only its same-run ratio to Hono is.

The rows refreshed on 2026-10-23 come from §10. Every ratio in the `vs Hono` column is computed
from two arms measured **minutes apart on the same box in the same session**, never across
sessions: this machine's absolutes drift ~40 % between windows, so a cross-session ratio would be
noise dressed as a number. `CPU/req` and the ratio for a row are taken from the same run when a
Hono arm was measured in that run; where it was not, the ratio cell carries its measurement date.

## 3. Candidate backlog

| #   | Candidate                                                            | Mechanism                                                                                                                                                        | Evidence                                                                                                                                                                                                                                                                                                                                                                                        | Status                                                                            |
| --- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | Response built from a plain init record                              | No per-response `Headers` allocation; Deno's static fast path needs the plain-object shape                                                                       | Deno GET −16.6 % CPU/req (4/4 pairs); Bun −5.3 %; Node neutral. Construction priced in isolation: 1.019 µs → 0.230 µs                                                                                                                                                                                                                                                                           | ✅ **implemented, verified**                                                      |
| 2   | JSON media type `application/json`                                   | Deno's fast path accepts only that exact value; RFC 8259 §8.1 defines no `charset` for it                                                                        | Isolated: 0.674 µs → 0.230 µs for the same shape. End-to-end it is worth ~0.1 µs alone, and it is **required** for #1 to pay off                                                                                                                                                                                                                                                                | ✅ **implemented, verified** (breaking)                                           |
| 3   | `declare` on the context's constructor-assigned fields               | `useDefineForClassFields` emitted a per-instance define the constructor overwrote                                                                                | Below the measurement floor (Deno median +0.33 µs, 1/3 pairs faster). Kept on the structural argument, not a speed claim                                                                                                                                                                                                                                                                        | ✅ **implemented** — effect unmeasurable                                          |
| 4   | Compiled dispatch plan                                               | Remaining dispatch scaffolding ≈ 0.57 µs self                                                                                                                    | ≤ 3 % of the request; would risk the middleware/`next()`/timeout contracts                                                                                                                                                                                                                                                                                                                      | ❌ **rejected**                                                                   |
| 5   | Synchronous dispatch fast path                                       | Return a bare `Response` when the whole chain provably settled synchronously — not "avoid a promise" _inside_ the async runner                                   | The earlier rejection measured a **different implementation**: dropping the race inside an await-returning runner gave +2.4 % (2/5). Measuring the mechanism's ceiling — a runner that returns a `Response` for a sync handler — gave **−8.2 % (4/5)**. Shipped: Bun GET **−13.6 % (4/5)** and **−11.7 % (5/5)** in two independent windows, Deno GET **−10.9 % (5/5)**, p50 **1170 → 1020 µs** | ✅ **implemented, verified** (§10) — rejection reversed by the ceiling experiment |
| 6   | Native `indexOf` URL scan instead of the `charCodeAt` loop           | Native string search                                                                                                                                             | 6 ns, **and** a semantic defect: the native form parses `http://h/p#f?x=1` as path `/p#f` + search `?x=1`                                                                                                                                                                                                                                                                                       | ❌ **rejected**                                                                   |
| 7   | `pairs` response construction (`[['content-type', v]]`)              | The archived spike's best Bun allocation shape (−10.9 B)                                                                                                         | Not a plain object, so it cannot enter Deno's fast path; Node's worst `default` shape (+127 B)                                                                                                                                                                                                                                                                                                  | ❌ **rejected**                                                                   |
| 8   | Runtime-branching construction                                       | Each runtime takes its cheapest shape                                                                                                                            | Forbidden by AGENTS.md §4                                                                                                                                                                                                                                                                                                                                                                       | ❌ **rejected**                                                                   |
| 9   | Fixed-key JSON serializer                                            | `JSON.stringify` is 88 % of the large-response profile                                                                                                           | Byte-identical prototype measured **4.4× slower** (RFC-042)                                                                                                                                                                                                                                                                                                                                     | ❌ **rejected**                                                                   |
| 10  | POST body read on Bun and Deno                                       | Body reading dominates the POST path (Bun **1.31×** Hono, Deno 1.54× Hono); §10's dispatch win cannot apply because `bodyParser` makes the chain genuinely async | Timeout settle window removed for body-bearing requests: Bun POST **−2.7 % paired CPU (4/5)**, level medians 28.08 → 26.47 µs; ratio **1.31× → 1.23×**. The whole race is now at most ~1.8 µs of a ~26 µs request, so the remainder is parser work                                                                                                                                              | 🔶 **partly landed (§11)** — parser work is the remainder                         |
| 11  | Context construction (`WebContextBase`)                              | 0.479 µs/req self time in the Deno profile                                                                                                                       | Partly addressed by #3; the rest is method normalisation, target derivation, query parse, body-source selection                                                                                                                                                                                                                                                                                 | ⬜ **open**                                                                       |
| 12  | `requestTargetFromUrl` (0.235 µs/req)                                | Manual `charCodeAt` scan of the URL                                                                                                                              | The native alternative has a semantic defect (#6); the scan itself is a correctness-preserving cost                                                                                                                                                                                                                                                                                             | ⬜ **open — needs a different idea**                                              |
| 13  | Dispatch/timeout micro-task turns                                    | `dispatchWithTimeout` 0.146 µs/req self                                                                                                                          | Partly addressed by RFC-045's bounded timeout dispatch                                                                                                                                                                                                                                                                                                                                          | ⬜ **open**                                                                       |
| 14  | Text media type `text/plain;charset=UTF-8`                           | Deno's `Response` fast path accepts only that exact literal                                                                                                      | Isolated: 612 ns → 197 ns per text `Response`. End-to-end Deno text workload: median −2.3 % over 7 pairs, mean −4.3 %, 5/7 faster                                                                                                                                                                                                                                                               | ✅ **implemented, verified**                                                      |
| 15  | Static: body through the context, drop the redundant `handle.stat()` | Recorded headers only reach the socket on the adapter flush; `handle.stat()` re-fstat'd a descriptor `readFile` had already stat'd                               | **143.59 → 126.04 µs (−13.6 %, 3/3 pairs)**, and the response gained `Content-Type`/`ETag`/`Last-Modified`/`Accept-Ranges`/`nosniff`                                                                                                                                                                                                                                                            | ✅ **implemented, verified**                                                      |
| 16  | Static: `lstat` for the symlink policy → `O_NOFOLLOW`                | One syscall per request; also closes the lstat→open race                                                                                                         | ~15 µs/req in the profile (6.8 % of samples), but it changes `followSymlinks: true` to a second open and needs its own error mapping                                                                                                                                                                                                                                                            | ⬜ **open — needs a security review**                                             |
| 17  | Static: `readFile()`'s second read to reach EOF                      | Node reads `size + 1`, then reads again for EOF                                                                                                                  | ~5 µs/req (4.6 % of samples). Fixing it means a hand-rolled exact-size read with a grow-detection fallback                                                                                                                                                                                                                                                                                      | ⬜ **open**                                                                       |
| 18  | Static: range/large-file streams still drop recorded headers         | `streamToResponse()` pipes to `ctx.raw.res`, bypassing the record                                                                                                | Observed: a `206` carries no `Content-Type`/`ETag`. Needs an adapter "flush head, then stream" hook — a public-surface decision                                                                                                                                                                                                                                                                 | ⬜ **open — blocked on an API decision**                                          |

## 4. Cross-runtime status of the completed cycle

| Workload              | Deno                                             | Bun                            | Node                           | Conformance                                                             |
| --------------------- | ------------------------------------------------ | ------------------------------ | ------------------------------ | ----------------------------------------------------------------------- |
| GET — server CPU/req  | **14.74 → 12.29 µs (−16.6 %)**, 4/4 pairs faster | 14.13 → 13.37 µs (−5.3 %), 3/4 | 23.13 → 22.92 µs (noise, 2/4)  | 436/436 in-process; 56/56 real Bun; 56/56 real Deno; 16/16 real workerd |
| POST — server CPU/req | **44.06 → 40.50 µs (−8.1 %)**, 4/4 pairs faster  | 27.36 → 27.13 µs (−0.8 %), 4/4 | 42.81 → 42.15 µs (−1.5 %), 3/4 | same suites                                                             |
| Gap to Hono (GET)     | **1.51× → 1.21×**                                | 1.16×                          | not measured                   | —                                                                       |
| Gap to Hono (POST)    | 1.54×                                            | not measured                   | not measured                   | —                                                                       |

## 5. Remaining work, by benefit and confidence

1. **POST body reading on both target runtimes** — benefit: the largest measured gap (Bun **1.31×**
   Hono, Deno 1.54× Hono) and the only place where the campaign is now decisively behind. Confidence:
   medium — the mechanism is partly known from the Bun body-read work, but `bodyParser` composes an
   application middleware, which is also what stops §10's fast path from applying, so the two
   interact and need one design rather than two patches. Next cycle.
2. **Context construction** — benefit: the largest remaining framework-side item on GET now that the
   dispatch promise hop is gone (§10); confidence: medium, because each piece is 15–45 ns and no
   single item clears the noise floor. Needs a structural idea, not a micro-trim.
3. **The unmeasured workloads** (dynamic route, middleware, raw-body POST, extra headers,
   streaming/compression/error) — benefit: unknown until measured, and the mission names them;
   confidence: high that measuring them is worthwhile. Cheap: they reuse this harness.
4. **The raw-response profile** — benefit: the `requestTargetFromUrl` and dispatch items are visible
   in a profile, but the profile itself costs a rebuild of the Deno profiling harness. Confidence:
   medium.

## 6. Findings

- **F-01 — The changeset baseline validator parses zero packages.** `scripts/validate-changeset-baselines.ts`
  matches `/^"([^"]+)":\s*(patch|minor|major)\s*$/` — **double quotes only** — while every changeset
  in the repository uses single quotes. The validator therefore reports "0 package(s) across 8
  changeset file(s)" and passes vacuously. The packages in this cycle's changeset were verified
  independently against the npm registry instead (all 13 have published history). _Not fixed here_:
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
for the exact commands of that cycle. Every arm in §10 of this document is built from the
repository's own entries — `apps/benchmark/scripts/dev-check/entries/serve-nextrush.ts`,
`serve-nextrush-post.ts`, `serve-hono.ts`, `serve-hono-post.ts`, `serve-raw.ts` — so the workload is
identical across arms and across runtimes. Those entries already dispatch on `Bun`/`Deno`/`node` at
runtime, so one bundle serves all three runtimes and no hand-written per-runtime variant is needed
(the `/tmp/opencode/ab/hono-web.ts` file named by earlier cycles is gone and superseded).

§10's harness and its raw output live under `report/performance/raw/` on the measurement machine —
`ab2.mjs` (the paired runner), `recompute.mjs` (recomputes the summary from a raw file), and one
`res-*.json` per measured comparison. That directory is gitignored and never committed.

## 8. Update — 2026-10-21: the Deno POST deadline, and the JSON media type re-examined

Source: [`deno-post-timeout-and-json-media-type.md`](deno-post-timeout-and-json-media-type.md).
Governing change: `openspec/changes/shared-request-deadline-scheduler/`.

### 8.1 The Deno POST gap, resolved

| Workload    | Runtime |   Before |        After |     Paired Δ |                                                  Δ% |
| ----------- | ------- | -------: | -----------: | -----------: | --------------------------------------------------: |
| JSON POST   | Deno    | 35.02 µs | **30.17 µs** | **−4.84 µs** |                                   **−13.8 %** (3/3) |
| JSON POST   | Bun     | 25.90 µs | **23.20 µs** | **−2.71 µs** |                                   **−10.4 %** (3/3) |
| JSON POST   | Node    | 41.92 µs |     40.84 µs |     −1.07 µs | −2.6 % (noise; the Node adapter keeps its own race) |
| Minimal GET | Deno    | 13.73 µs |     13.47 µs |     −0.26 µs |                      −1.9 % (noise — no regression) |

The dominant cost was the **per-request timeout timer**: 19.5 % of Deno's busy time, and 8.28 µs per
request measured end to end with the race disabled. One shared timer per runner replaces it. The
Deno POST gap to Hono: **1.54× → 1.20×**.

### 8.2 The JSON media type, re-decided with direct evidence

Preserving `application/json; charset=utf-8` is **not** comparably fast: it costs 1.04 µs per
request (−7.3 %) on Deno GET, because that value is not one of the three literals Deno's
`Response` constructor accepts for its static fast path. The bare value is kept; the RFC-046 §12
alternatives and their numbers are recorded. The static-file MIME table is deliberately unchanged.

### 8.3 Candidate status updates

| #   | Candidate                       | Status                                                                                                                                                                                                                                       |
| --- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10  | POST body read on Deno          | ⬜ **open** — the profile shows Deno's own stream machinery at ≈ 8.7 % of busy; the framework's share of the POST path is now the JSON parser closure (10.00 %) and context construction (4.07 %)                                            |
| 11  | Context construction            | ⬜ open — 4.07 % of Deno POST busy time                                                                                                                                                                                                      |
| 12  | `requestTargetFromUrl`          | ⬜ open — 1.67 %; the native alternative has a semantic defect, so it needs a different idea                                                                                                                                                 |
| 14  | Node adapter's own timeout race | ⬜ **new, open** — Node still pays ≈ 0.97 µs per POST for a per-request timer; applying the shared scheduler there needs the scheduler exported (a deliberate public-surface change) and coordination with the `server.timeout` socket guard |
| 15  | `matchContentType` (1.67 %)     | ⬜ open — the JSON parser's content-type detection on every POST                                                                                                                                                                             |

## 9. Update — 2026-10-22: the text media type, and the static row measured

Two changes landed this cycle. Neither touched routing, middleware ordering, request parsing, or a
public API.

### 9.1 `text/plain` joins the Deno fast path

Deno's `Response` constructor has a static fast path for a small set of exact media-type literals.
`application/json` was corrected in an earlier cycle; `text/plain; charset=utf-8` — the conventional
spelling — is **not** on the list. Priced in isolation on Deno 2.9.7, constructing the response:

| Header value                | Cost per `new Response()` |
| --------------------------- | ------------------------: |
| `application/json`          |                    290 ns |
| `text/plain; charset=utf-8` |                **612 ns** |
| `text/plain;charset=UTF-8`  |                **197 ns** |
| `text/plain`                |                    194 ns |
| `text/html; charset=utf-8`  |                    622 ns |
| `text/html;charset=UTF-8`   |                    602 ns |
| no `content-type` at all    |                    148 ns |

`text/html` has no spelling that enters the fast path, so it was deliberately left alone: changing it
would be wire churn with nothing behind it. RFC 9110 §5.6.1 makes the space around `;` and the case of
the charset value insignificant, so the comparison is the same media type either way.

End to end on a text workload (`ctx.send('hello world')`), paired A/B on server CPU per request:

| Runtime | A (before) |    B (after) |                     Paired median | Pairs favouring B |
| ------- | ---------: | -----------: | --------------------------------: | ----------------: |
| Deno    |   12.66 µs | **12.07 µs** | **−2.3 %** (7 pairs, mean −4.3 %) |               5/7 |
| Bun     |   14.57 µs |     14.60 µs |                            +0.1 % |               2/4 |
| Node    |   25.88 µs |     26.12 µs |                            +0.8 % |               1/2 |

The deterministic half of the evidence is the isolated table above (−415 ns per text response); the
end-to-end delta is direction-consistent but partly inside this box's run-to-run spread, and is
reported that way.

### 9.2 Static GET: 3× the floor, and why

The static row had never been measured. Against a hand-rolled `readFile` + `ctx.send` handler for the
same 36-byte file, on the Node adapter:

| Arm                                 |  CPU/req |    rps |
| ----------------------------------- | -------: | -----: |
| `serveStatic()` (before this cycle) | 139.9 µs |  6.6 k |
| `readFile` + `ctx.send` floor       |  46.0 µs | 19.0 k |

**3.04× the floor**, 0/3 pairs. A CPU profile (58.8 % busy, ~53 k requests) put it in syscalls, not
JavaScript:

| Symbol           | Share of all samples | ≈ µs/req |
| ---------------- | -------------------: | -------: |
| `fstat`          |                9.7 % |       21 |
| `lstat`          |                6.8 % |       15 |
| `close`          |                6.4 % |       14 |
| `openFileHandle` |                6.3 % |       14 |
| `writev`         |                5.7 % |       12 |
| `read`           |                4.6 % |       10 |
| `(program)`      |                5.9 % |       13 |
| `(idle)`         |               41.2 % |        — |

Three `fstat`s and two `read`s per 36-byte file where one of each is needed. The third `fstat` came
from `handle.stat()`, called on a descriptor `readFile()` had already stat'd — and its only consumer
was a `ctx.set('Content-Length', …)` that this branch never sent.

Measuring it exposed a defect with a wider blast radius than the cost: the branch wrote the body with
`ctx.raw.res.end(content)` while every header went into the adapter's outgoing record. **The recorded
headers never reached the socket.**

```
# before
HTTP/1.1 200 OK
Date: …            Connection: keep-alive      Keep-Alive: timeout=5
Content-Length: 36

# after
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
X-Content-Type-Options: nosniff
Last-Modified: Wed, 29 Jul 2026 00:53:41 GMT
ETag: W/"cf7791d8"
Accept-Ranges: bytes
Content-Length: 36
```

A matching `If-None-Match` also returned `200` with an empty body, because `ctx.status = 304` never
reached `res.statusCode` on that path. Both are fixed by committing the response through `ctx.send()`
— the path every other response takes — and the redundant `handle.stat()` is gone.

| Arm             |       CPU/req | Paired median | Pairs favouring B |
| --------------- | ------------: | ------------: | ----------------: |
| before (`HEAD`) |     143.59 µs |             — |                 — |
| after           | **126.04 µs** |   **−13.6 %** |               3/3 |

Repeated at −12.4 % (3/3) before the `304` change. The response gained six headers and got 13 %
cheaper in the same run.

**What the number means.** `serveStatic()` is now 2.7× a `readFile` + `send` handler for this file,
not 3.0×. The remainder is the `lstat` the symlink policy needs (≈ 15 µs/req, candidate #16) and the
second `read` `readFile()` issues to reach EOF (≈ 5 µs/req, #17). Range (`206`) and large-file
streamed responses still bypass the record and still drop their headers (#18) — that one needs an
adapter-level "flush head, then stream" hook, which is a public-surface decision, not a middleware fix.

### 9.3 Findings

- **F-04 — `serveStatic()` dropped every header it set** (fixed for the buffered and `304` paths,
  see §9.2). It went unnoticed because the package's unit tests use a mock context whose `set()` writes
  to a local map and whose `send()` writes eagerly: a mock cannot observe a bypass of the adapter's
  flush. The new regression test asserts the response is _committed through the context_, which is the
  property that was actually broken.
- **F-05 — Conditional GET returned `200` with an empty body** (fixed, see §9.2). Unreachable before
  F-04 was fixed, because no `ETag` ever reached a client, so no client could send `If-None-Match`.
- **F-06 — The framework's text media type exists in three places.** `response-body.ts`,
  `response-builder.ts`, and `adapter-node/src/context.ts` each define it, and `@nextrush/stream`
  defines a fourth (deliberately untouched: streamed responses cannot enter the static fast path).
  They agree today by hand. A shared constant would need a home in `@nextrush/types`, which is a
  public-surface change.
- **F-07 — The timeout race is no longer worth pursuing.** Ablating it (`TIMEOUT=0`) moved Deno's
  median by +0.3 % (1/3 pairs faster) after the shared-scheduler work. Recorded so the next cycle
  does not re-open it.
- **F-08 — `304` responses still carry `Content-Type`.** Harmless (RFC 9110 requires only that a 304
  carry the validators; caches ignore entity headers they cannot update), but omitting it would need
  validator-only header emission split out of `setFileHeaders()`. Left alone rather than duplicating
  that logic.

### 9.4 Reproduction

```bash
# static, paired
cd /tmp/opencode/ab
bun lib/build.ts entries/nr-static.ts out/static.after.mjs node --no-minify
git -C ~/project/framework/nextrush show HEAD:packages/middleware/static/src/send-file.ts > base/send-file.ts
bun lib/build.ts entries/nr-static.ts out/static.before.mjs node --no-minify \
  --override ~/project/framework/nextrush/packages/middleware/static/src/send-file.ts base/send-file.ts
node ab.mjs --runtime node --path /bench.txt --a out/static.before.mjs --b out/static.after.mjs --pairs 3

# text, paired
node ab.mjs --runtime deno --a out/text.before.node.mjs --b out/text.after.node.mjs --pairs 4

# what the client actually receives
curl -s --noproxy '*' -D- -o /dev/null http://127.0.0.1:4430/bench.txt
curl -s --noproxy '*' -D- -o /dev/null -H 'If-None-Match: W/"cf7791d8"' http://127.0.0.1:4430/bench.txt
```

## 10. Update — 2026-10-23: the synchronous dispatch fast path (candidate #5, reversed)

Detailed measurement record for this cycle:
[`synchronous-dispatch-fast-path.md`](synchronous-dispatch-fast-path.md). The section below is the
scoreboard's summary.

### 10.1 What the gap actually was

NextRush answered every request through a promise the runtime never needed. A handler that returned
synchronously still cost a chain of microtask turns, because the runner always produced a
`Promise<Response>`: `hono.fetch` returns a `Response` directly for a synchronous handler, and that
single structural difference was the entire Bun GET gap — not slower code inside the request.

The turn count was measured directly, 2000 requests each, by wrapping the returned value and
counting `await`s:

| Arm                                 | Turns to settle                     |
| ----------------------------------- | ----------------------------------- |
| `hono.fetch`, sync handler          | **0** (a bare `Response`)           |
| NextRush, GET route                 | 4 (1999/2000 requests), 10 (1/2000) |
| NextRush, POST route (`bodyParser`) | 13/2000                             |

The mechanism's ceiling was then measured before any production code was written: a throwaway runner
that returned a bare `Response` for a sync handler, everything else unchanged, gave **−8.2 %
(4/5 pairs)**. That number decided the cycle's direction.

**The earlier rejection of #5 measured a different implementation.** The earlier attempt removed the
timeout race _inside_ an await-returning runner and found no signal (+2.4 %, 2/5). That experiment
was correct about what it tested and wrong about what it implied: as long as the runner is declared
`async`, the promise is still at the boundary, so removing interior work cannot help. The lesson is
recorded as F-10.

### 10.2 The change, and the invariant that makes it safe

Four pieces, each with one job:

| Layer                  | Change                                                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@nextrush/types`      | `DISPATCH_SETTLED_SYNC` — a `Symbol.for` marker — plus `DispatchMarkerCarrier`                                                                                                                          |
| `@nextrush/router`     | `compileExecutor`'s no-per-route-middleware branch sets the marker when the handler returned a non-promise, and returns one shared resolved sentinel instead of allocating `Promise.resolve(undefined)` |
| `@nextrush/core`       | `Application.syncDispatchSafe` — true only when the middleware stack is **exactly one entry** and that entry is the router mounted at the root                                                          |
| `@nextrush/runtime`    | `createWebRunner` returns `Response \| Promise<Response>`; when the marker is set it builds the response and returns it directly                                                                        |
| adapters bun/deno/edge | `createHandler` / `createFetchHandler` / Cloudflare `fetch` widen their return types to match                                                                                                           |

The safety argument is a one-line invariant: **a middleware registered ahead of the router can resume
after `next()` and mutate the response, so a stack of two or more entries never takes the path** even
when every middleware in it happens to be synchronous. The root-mounted router's dispatch returns the
executor's promise directly and never resumes after the handler, so once the handler returns there is
nothing left that could touch the response. The executor sets the marker only when the handler
returned a non-promise; a throw produces a rejection and clears the way to the existing error path.
The Node adapter is untouched: it owns a callback-based runner, so it never had this promise to begin
with.

Consequence, stated plainly: **any application middleware disables the fast path** — `bodyParser`,
`cors`, `logger`. That is deliberate conservatism, and it is why Bun POST does not move.

### 10.3 Measurements

`before` is a pristine `HEAD` (`8e321121`) in a detached worktree; `after` is the working tree. Both
arms are built from the same repository entry (`serve-nextrush.ts` / `serve-nextrush-post.ts`) by
`scripts/dev-check/lib/build.ts`, so the only difference between them is source. Server pinned to
core 0, `wrk -t2 -c64` on cores 1 and 3, 3 s warmup + 8 s measured, pairs order-flipped, CPU per
request from `/proc/<pid>/stat`.

| Workload       | Runtime |   before |        after | paired median | pairs favouring after |            p50 |            p99 |
| -------------- | ------- | -------: | -----------: | ------------: | --------------------: | -------------: | -------------: |
| Minimal GET    | Bun     | 14.82 µs | **12.90 µs** |   **−13.6 %** |                   4/5 | 1170 → 1020 µs | 2480 → 2430 µs |
| Minimal GET    | Deno    | 12.62 µs | **11.10 µs** |   **−10.9 %** |                   5/5 |  1060 → 940 µs | 1970 → 1840 µs |
| Minimal GET    | Node    | 24.12 µs |     23.83 µs |        −1.9 % |                   2/3 | 1790 → 1770 µs | 3400 → 3410 µs |
| JSON POST 1 KB | Bun     | 21.45 µs |     21.19 µs |        −1.3 % |                   4/5 | 1650 → 1620 µs | 2590 → 2710 µs |
| JSON POST 1 KB | Deno    | 34.38 µs |     34.08 µs |        −0.9 % |                   2/3 | 2390 → 2390 µs | 5460 → 5120 µs |
| JSON POST 1 KB | Node    | 41.28 µs |     40.12 µs |        −3.0 % |                   3/3 | 2840 → 2790 µs | 5840 → 5380 µs |

An independent earlier window in the same session reproduced the two headline rows before the harness
was rebuilt — Bun GET 14.86 → 13.20 µs (**−11.7 %**, 5/5) and Deno GET 12.75 → 11.44 µs (−6.8 %, 3/3).
Two windows, same direction, same magnitude class: the effect is real and not a single lucky run.

The Bun and Deno POST rows are the control group. They are the correct result, not a miss: the app in
those rows registers `bodyParser`, so its chain is genuinely asynchronous and the path does not apply.

**Deno's 3-pair run is worth keeping visible.** The first Deno GET measurement gave +2.6 % (1/3);
the same two bundles re-measured at 5 pairs gave −10.9 % (5/5). On this box a 3-pair result on a
~1 µs difference can invert. That is why the decisive rows are 5 pairs and why the campaign reports
the consistency count next to every delta.

### 10.4 Where the two runtimes now stand

Measured in the same session, minutes apart, ratios computed within one run:

| Comparison                 | NextRush | Comparator |     Ratio |           Consistency |
| -------------------------- | -------: | ---------: | --------: | --------------------: |
| Bun GET vs Hono 4.13.0     | 11.58 µs |   10.51 µs | **1.10×** | 5/5 pairs Hono faster |
| Bun POST 1 KB vs Hono      | 24.55 µs |   18.79 µs | **1.31×** | 5/5 pairs Hono faster |
| Bun GET vs raw `Bun.serve` | 12.80 µs |   10.20 µs |     1.25× |  3/3 pairs raw faster |

The campaign opened at **~1.24×** Hono on Bun GET (13.20 vs 11.86 µs, earlier window). It is now
**1.10×**. The remaining GET distance to the floor is context construction and dispatch scaffolding;
the POST distance is body reading, and it is now the largest measured gap in the campaign.

The repository's canonical gate agrees. `node scripts/dev-check/check.mjs wire --rt bun` reports
`wire.hono.rps` 63815 against `wire.nextrush.rps` 56469 (0.885, i.e. NextRush 13 % behind), and
`wire.post.nextrush.vs_hono` 0.77 — which is the same story the CPU ratios tell (1/0.885 ≈ 1.13, and
1/0.77 ≈ 1.30). Those rps figures come from an unpinned, client-saturated harness and are not used
for decisions here; they are cited only because they corroborate the direction independently.

### 10.5 Verification

| Gate            | Result                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| New unit tests  | `executor-settled-sync.test.ts` (4), `sync-dispatch-safe.test.ts` (3), `web-runner-sync-response.test.ts` (4) — all authored failing first |
| Package suites  | types 21 · router 434 · core 208 · runtime 396                                                                                             |
| Adapter suites  | bun 129 · deno 123 · edge 134 · node 301                                                                                                   |
| Conformance     | 436                                                                                                                                        |
| Typecheck       | clean for types, router, core, runtime, and all four adapters                                                                              |
| Lint            | clean for every touched package                                                                                                            |
| Response parity | GET/POST status, body, and `Content-Type`/`Content-Length`/`Date` byte-identical before vs after                                           |

### 10.6 Reproduction

```bash
# both arms, from the same repository entries; `before` is HEAD in a throwaway worktree
cd ~/project/framework/nextrush
git worktree add --detach /tmp/opencode/before HEAD
(cd /tmp/opencode/before/apps/benchmark && bun scripts/dev-check/lib/build.ts \
   scripts/dev-check/entries/serve-nextrush.ts /tmp/opencode/ab2/nr-get-before.js bun --no-minify)
cd apps/benchmark && bun scripts/dev-check/lib/build.ts \
   scripts/dev-check/entries/serve-nextrush.ts /tmp/opencode/ab2/nr-get-after.js bun --no-minify

# paired, order-flipped; CPU/req from /proc, p50/p99 from wrk --latency
cd ~/project/framework/nextrush/report/performance/raw
node ab2.mjs --runtime bun --workload get --a /tmp/opencode/ab2/nr-get-before.js \
  --b /tmp/opencode/ab2/nr-get-after.js --pairs 5 --label bun-get-ba
node recompute.mjs res-bun-get-ba-*.json
```

Raw output for every row above is written to `report/performance/raw/` (gitignored, not committed).

### 10.7 Findings

- **F-09 — "No consistent signal" can describe an implementation, not a mechanism.** The earlier
  rejection of #5 was recorded as a verdict on the idea. It was a verdict on one way of expressing
  it. Measuring the mechanism's ceiling (throwaway code, no tests, no API) costs about twenty
  minutes and would have avoided a full cycle's detour. Reversed here with the evidence in §10.1.
- **F-10 — The shared resolved sentinel also helps Node.** Node POST moved −3.0 % (3/3) although the
  Node adapter never takes the fast path: the executor no longer allocates a fresh
  `Promise.resolve(undefined)` per dispatch. Small, consistent, and worth keeping.
- **F-11 — `bodyParser` is now the single largest obstacle on POST, and it disables the dispatch
  fast path by existing.** The two are coupled: any design for POST must decide whether the body read
  composes as application middleware (blocking the fast path) or becomes a per-route concern that
  can settle synchronously. That is a design question, not a trim — candidate #10.

## 11. Update — 2026-10-23: the POST settle window (candidate #10, part 1)

Detailed measurement record: [`post-body-settle-window.md`](post-body-settle-window.md). This section
is the scoreboard's summary.

### 11.1 What changed and why the old decision expired

The Web runner gave every dispatch four microtask turns before arming its deadline. That window was
measured when each request armed its own timer; F-02 and RFC 045 therefore said not to tune it. The
shared scheduler (`53e2529b`, later the same day) made register + cancel ~0.2–0.3 µs, while four
turns cost ~1.5 µs of Bun POST CPU — and a request that declares a body waits on I/O (a macrotask),
so the turns could never let it settle.

`WebContextBase` now exposes `bodyLength`, the `content-length` its body source already parses, and
`settleTurnsFor()` returns zero turns for a declared, non-empty body. Bodyless methods,
`content-length: 0`, and chunked bodies keep `SETTLE_TURNS`; `timeout: 0` still disables the race;
the Node adapter is untouched. `request.body` was rejected as the signal: touching it costs more
(+0.6–0.8 µs on Bun) than the window saves.

### 11.2 Measurements

Bun 1.4.4, 1 KB JSON POST through `bodyParser`, three arms, 5 interleaved rounds, CPU/req from
`/proc`, `wrk -t2 -c64`, server pinned:

| Arm                     | CPU/req (median) | rps (median) | Ratio to Hono |
| ----------------------- | ---------------: | -----------: | ------------: |
| `settleTurnsFor` (this) |     **26.47 µs** |   **31,064** |     **1.23×** |
| `SETTLE_TURNS = 4`      |         28.08 µs |       29,912 |         1.31× |
| Hono 4.13.0             |         21.45 µs |       37,391 |             — |

Paired per round: −14.2 %, −2.5 %, +3.9 %, −2.7 %, −6.6 % CPU → **paired median −2.7 % (4/5)**;
paired rps median +2.3 % (4/5). An earlier same-bundle window with only the constant patched
measured 27.05 → 25.51 µs and 30.5 → 32.5 k rps (5/5), also 1.23× Hono. Disabling the entire race
(`timeout: 0`) is worth 26.8 → 31.1 k rps (5/5) — the upper bound, not this change.

GET is unchanged by construction: `bodyLength` is 0, so the window stays. Always-arming an async GET
was re-measured at ~0.6 µs / ~3.5 %, which is why the rule is shape-scoped rather than global.

### 11.3 Verification

| Gate                              | Result                                                          |
| --------------------------------- | --------------------------------------------------------------- |
| `@nextrush/runtime`               | 32 files, 402 tests — pass                                      |
| Adapters bun / deno / edge / node | 129 / 123 / 134 / 301 tests — pass                              |
| Conformance                       | 436 tests — pass                                                |
| dev-check `probe` (real sockets)  | Bun 16/16 PASS; Node 15/15 PASS                                 |
| Typecheck runtime + 4 adapters    | clean; conformance has a pre-existing `web-driver.ts:174` error |
| Lint runtime                      | 0 errors; one pre-existing warning at `response-builder.ts:181` |

### 11.4 Reproduction

Build `serve-nextrush-post.ts` and `serve-hono-post.ts` from the working tree (and the NextRush entry
from a `HEAD` worktree for the baseline), run each pinned with the same 1 KB POST script, and compute
CPU/req from `/proc/<pid>/stat` ticks ÷ requests. §5 and §8 of the detailed record carry the exact
commands.

### 11.5 Findings

- **F-12 — A measured decision expires when its premise changes.** F-02's prohibition was correct for
  per-request timers and became stale when the shared scheduler changed the cost of the alternative
  by ~10×. Re-read the premise when the infrastructure under a decision moves.
- **F-13 — Use a signal the request path already computed.** `request.body` costs more than the
  window saves; `content-length` was already parsed for the size guard.
- **F-14 — Shape-scoped, not global.** A global zero-turn rule would have cost GET ~3.5 % to buy
  POST ~3–6 %.
- **F-15 — The remaining POST gap is body work, not timeout machinery.** At most ~1.8 µs of a
  ~26 µs request is the race; candidate #10 continues at content-type detection, the JSON parse, and
  the body-source read.

## 12. Independent verification — 2026-10-23 (second session, same box)

§10 and §11 were recorded by the session that made the changes. This section re-measured the shipped
commits from a clean checkout, with the harness rebuilt from scratch, and re-ran every gate. The point
is not to re-derive the same numbers — it is to check that a reader who only has the repository can
land in the same place.

Both arms were built from detached worktrees at the two commits, so `d21a4534` is the only difference
between them:

```bash
git worktree add --detach /tmp/opencode/ab2/wt-before acdbe184
git worktree add --detach /tmp/opencode/ab2/wt-after  d21a4534
# each arm built from apps/benchmark/scripts/dev-check/entries/serve-nextrush[-post].ts
node report/performance/raw/ab2.mjs --runtime bun --workload post \
  --a /tmp/opencode/ab2/post-before.js --b /tmp/opencode/ab2/post-after.js --pairs 5 --label verify-post
```

| Comparison | Before | After | Paired median | Pairs | Verdict |
| --- | ---: | ---: | ---: | ---: | --- |
| Bun POST 1 KB, `acdbe184` → `d21a4534` | 21.26 µs | **20.76 µs** | **−1.8 %** | 4/5 | **Confirmed** — same direction and consistency as §11, magnitude smaller |
| Bun GET control, same two commits | 12.43 µs | 11.92 µs | −4.1 % | 2/5 | **No effect** — `settleTurnsFor(false)` returns `SETTLE_TURNS`, so GET runs identical code; one pair swung +21.8 %, which is this box, not the change |
| Bun POST vs Hono 4.13.0 | 23.12 µs | 20.93 µs | **1.15×** (median per-pair ratio) | 4/5 | Ratio narrowed from 1.31×; window only good to ~±10 % |

The replication of §11 is **−1.8 % against the recorded −2.7 %**, both at 4/5 pairs. The conservative
statement of this change is therefore "about 2 % of POST CPU, consistently, a few percent of rps",
not "2.7 %". The Hono ratio moved from 1.31× (before this commit, measured in §10's window) to
1.15× here and 1.23× in §11's window: the direction is solid, the absolute ratio is not resolvable
below roughly ±10 % in one 5-pair window, because Hono's own CPU/req moved 18.79 → 23.12 µs between
windows on identical code.

Gates re-run on the working tree at `d21a4534` plus the uncommitted text-media/static work:

| Gate | Result |
| --- | --- |
| Package suites | types 21 · router 434 · core 208 · **runtime 402** |
| Adapter suites | bun 129 · deno 123 · edge 134 · node 301 |
| Conformance | 436/436 |
| Typecheck | clean — runtime, bun, deno, edge, node |

### 12.1 Findings

- **F-16 — The scoreboard's `Runtimes` field is stale.** The header says `Bun 1.4.3`; `bun --version`
  on this machine is **1.4.4**, and §11 states 1.4.4 for its own window. Every row measured after the
  upgrade is therefore attributed to the wrong runtime in the one field a reader checks first. Fix:
  state the version per section (as §11 does) or split the header field by date; do not silently
  rewrite older rows.
- **F-17 — `post-body-settle-window.md` §5.2 computes one row's delta with the opposite convention.**
  The `timeout: 0` row's levels (31.1k vs 26.8k rps, 26.13 vs 27.98 µs) say the race-disabled arm
  wins; the Δ cells say `+16.0 % rps` and `−6.6 % CPU`, which is `(baseline − change) / change` — the
  inverse of the row directly above it, and it turns a −13.8 % rps drop into a +16.0 % gain. The
  prose conclusion ("the upper bound for removing the race entirely") is correct; the two cells are
  not, and any reader who checks the arithmetic will land on the opposite sign.
- **F-18 — A single 5-pair window cannot pin a POST/Hono ratio.** Hono's own CPU per request moved
  from 18.79 µs to 23.12 µs across two windows measuring identical Hono code. Campaign reporting
  should therefore quote the ratio with its window's spread, as §11 does with its baseline/"change"
  pair, rather than as a headline multiplier.

### 12.2 Untracked scratch to clear before any commit

15 `_x-*.ts` probe entries under `apps/benchmark/scripts/dev-check/entries/` remain from the §11
session, plus the two `.changeset/` files that belong to the earlier text-media and static work.
None of them are referenced by a committed report. `report/performance/raw/` is gitignored by design
and holds the harness and raw output for §10–§12.

---

## 13. Candidate #10 part 2 — the JSON POST content-type/body/parse path (no change shipped)

Scope: the one connected path a JSON POST runs after the router — `content-type` detection,
body read/decoding, and `JSON.parse` — on Bun 1.4.4, branch `perf/bun-body-read-parity`
(`d21a4534` + the working tree's unrelated text-media work). Three candidate optimizations were
built, tested green, and **all three were reverted**: each measured below what any instrument on
this machine can resolve. The durable result is the decomposition below, which says where the
remaining per-request CPU actually is and therefore what not to optimise next.

### 13.1 Instruments

| Instrument | File | What it resolves |
| --- | --- | --- |
| Paired wire A/B | `raw/ab2.mjs` (unchanged) | Order-flipped pairs, server CPU/req from `/proc/<pid>/stat`. Decision-grade *within* a window only. |
| In-process dispatch | `raw/c10-inproc.ts` (new) | `createHandler()` against a fresh 1 KB `Request`, modes `req`/`ctx`/`noparser`/`full`/`notimeout`, 3 internal rounds, min per mode. Removes the socket and the load generator. |
| Parser decomposition | `raw/c10-parser.ts` (new) | `WebBodySource` → proven text → `bodyParser()` → depth-check ablation, interleaved rounds, min per mode. |
| Pure op costs | `raw/c10-micro.ts` (new) | 2M-iteration measurements of one call each. |
| CPU profile | `raw/c10-prof-post.ts` + `raw/c10-prof-analyze.mjs` | Bun `--cpu-prof`. Needs a graceful exit: the profiler does not flush on SIGINT/SIGTERM, so the entry carries a `/__stop` route. |

### 13.2 Where a 1 KB JSON POST's CPU goes

In-process, one process, min of 3 rounds (Bun 1.4.4, `taskset -c 2`). Every row builds a fresh
`Request`, so Request construction is a constant in each row; the control row is what to
subtract.

| Mode | ns/op | Δ over control |
| --- | ---: | ---: |
| `req` — Request construction (control) | 1149.8 | — |
| `ctx` — `new BunContext(request, ip)` | 362.2 | — |
| `noparser` — dispatch, no `bodyParser()` | 3079.3 | +1929.5 |
| `full` — `bodyParser()` + JSON + `ctx.json()` | 5927.4 | +4777.6 |
| `notimeout` — same, `timeout: 0` | 5078.6 | +3928.8 |

- **Framework JS per POST ≈ 4.78 µs.** Against the 20.8–26.0 µs wire CPU/req this window and §12's
  measured, that is 18–23 % of the request; the rest is Bun's HTTP server, socket write, and GC.
- **Parser path = `full` − `noparser` = 2.85 µs.**
- **Deadline machinery = `full` − `notimeout` = 0.85 µs** (14 % of in-process dispatch, ~4 % of wire
  CPU). This is the largest single NextRush-owned item left, and it is promise machinery required to
  bound a dispatch: a handler that never settles must still release the connection, so the race
  cannot be removed — only shaved.
- **Context construction = 0.36 µs**, already small.

Parser path decomposed (separate harness, 4 interleaved rounds, min):

| Stage | ns over control |
| --- | ---: |
| `new WebBodySource(request)` — two native header reads | 318.6 |
| `request.text()` — proven-length fast path | 596.1 |
| `JSON.parse(1 KB)` | 406.0 |
| `checkJsonDepth` (1-key object) | 145.9 |
| middleware glue, `content-type` match, depth-bytes test, error envelope, `next()` | ≈ 378 |

62 % of the parser path is native decode + parse. The framework's share of the whole POST request
is small and flat: no single stage exceeds 0.6 µs.

### 13.3 Candidates measured and rejected

| Candidate | Measured | Verdict |
| --- | --- | --- |
| Allocation-free `matchContentType` (in-place base-type compare, no `slice`/`trim`/`toLowerCase`) | `application/json; charset=utf-8`: **−60.5 ns**; bare `application/json`: **+14.0 ns**; `Application/JSON`: +5.5 ns | **Rejected** — the benchmark sends the bare type, where the rewrite is slower. Bun's `toLowerCase()` on an already-lowercase literal is free, so the allocations it removed were not costing anything. |
| `RequestInputs.get` without `toLowerCase()` | 63.3 ns vs 52.0 ns for a hoisted literal; folding an already-lowercase literal measures ~0 | **Rejected** — the "saving" was the literal, not the fold. |
| Reuse `bodySource.contentType` instead of the parser's third `Headers.get` | 59.2 ns per lookup = **0.28 %** of a 20.8 µs request | **Rejected as unverifiable** — below the in-process resolution and far below the wire floor; it buys a new coupling between parser and body source for 0.28 %. |
| Drop `checkJsonDepth` | 145.9 ns direct | **Rejected** — 0.7 % of the request for the only guard against a stack-depth DoS. |
| `request.json()` instead of `request.text()` + `JSON.parse` | native `json()` ≈ **+250 ns** | **Rejected** — the current composition is already the faster one. |
| `bodySource.json()` (arrayBuffer + `TextDecoder`) instead of the proven-text path | **+1075 ns** | **Rejected** — confirms `readTextIfProvenWithin` is the right path. |

All three implemented candidates passed their gates — body-parser 320/320, runtime 402/402 — and
were then reverted on measurement, not on doubt. The tree is unchanged: 21 modified and 17 untracked
files, all present before this cycle.

### 13.4 Fresh window (this session)

| Comparison | A | B | Median Δ | Pairs |
| --- | ---: | ---: | ---: | ---: |
| NextRush POST vs Hono POST | 25.51 µs | 19.67 µs | **1.30× (5/5)** | 5 |
| **Control: this tree vs §12's bundle** | 26.01 µs | 26.00 µs | **+0.0 % (2/5)** | 5 |

The control is the important one: the bundle built from this tree and §12's bundle are the same code
and the same cost, so nothing in this cycle changed the POST path. It also shows the cross-window
problem in its plainest form — that identical bundle measured **20.76 µs in §12's window and
26.0 µs in this one** (+25 %), while Hono has read 18.79, 23.12, and 19.67 µs on identical Hono
code. The 1.15× of §12 and the 1.30× of this window describe the same two programs.

### 13.5 Findings

- **F-19 — Bun's sampler misattributes small functions by an order of magnitude.** `--cpu-prof`
  reported `WebResponseBuilder`'s constructor at 14.55 % self time (2042 ms ≈ 5.5 µs/request), which
  would make a trivial constructor the single largest line of framework code. Isolated measurement:
  **76 ns**. The profiler remains useful for inclusive shape and for finding which *stage* to
  instrument, but no per-frame self-time from it should be quoted as a cost.
- **F-20 — Sequential in-process modes attribute JIT compile cost to whichever mode runs first.**
  A non-interleaved harness reported the depth walk at 909 ns; interleaved rounds with a per-mode
  minimum put it at 146 ns (and at 8 ns in the `maxDepth: Infinity` ablation). Any future in-process
  harness must interleave modes and take per-mode minima, not measure modes in sequence.
- **F-21 — Cross-window absolutes drift ~25 % on identical bundles, so a cross-framework ratio is
  only meaningful inside one window.** Same bundle: 20.76 µs (§12) → 26.0 µs (here). Consequence:
  1.15× and 1.30× are not a regression or an improvement, they are the box. Report the ratio with
  the window's own baseline/control pair (as §12 does) and never compare a ratio across windows.
- **F-22 — The conformance typecheck failure at `web-driver.ts:174` is real, pre-existing, and
  attributable.** `pnpm --filter @nextrush/conformance typecheck` fails with TS2345: the driver's
  `WebInvoke` (`web-driver.ts:33`) requires `Promise<Response>`, but `createBunHandler` now returns
  `Response | Promise<Response>` after `a701579e` added the synchronous dispatch fast path. The file
  was not touched by this cycle. Suggested fix: widen `WebInvoke`'s return type to
  `Response | Promise<Response>` and let `toResult` await it (or `await` the bun driver's call).
  Not applied: `suite.ts` in that package is modified by a concurrent session.
- **F-23 — The duplicate `content-type` read is real but immaterial:** the body source reads the
  header at context construction and the combined parser reads it again (59.2 ns). Recorded as a
  deferred micro-optimization, not a candidate, because it cannot be verified end-to-end on this
  machine.

### 13.6 Reproduction

```bash
# in-process dispatch decomposition (control-relative, load-insensitive)
cd apps/benchmark
bun scripts/dev-check/lib/build.ts ../../report/performance/raw/c10-inproc.ts /tmp/c10-inproc.js bun --no-minify
taskset -c 2 bun /tmp/c10-inproc.js

# parser decomposition
bun scripts/dev-check/lib/build.ts ../../report/performance/raw/c10-parser.ts /tmp/c10-parser.js bun --no-minify
taskset -c 2 bun /tmp/c10-parser.js

# paired wire baseline (5 pairs, order-flipped)
cd /tmp/opencode/ab2
node ab2.mjs --runtime bun --workload post --a /tmp/opencode/ab3/nr-post-clean.js \
  --b /tmp/opencode/ab3/hono-post-clean.js --pairs 5 --label c10-nr-vs-hono-post
```

Raw output: `report/performance/raw/res-c10-nr-vs-hono-post-bun-post-*.json` and
`res-c10-new-vs-old-nr-post-bun-post-*.json`. Both bundles were built with
`entries/serve-nextrush-post.ts` and `entries/serve-hono-post.ts` through
`scripts/dev-check/lib/build.ts`.

### 13.7 Verdict

No change shipped. The JSON POST path is at its practical floor for anything this box can
distinguish: 4.78 µs of framework JS on a 20.8–26.0 µs request, of which 2.85 µs is the parser
(62 % native decode and parse) and 0.85 µs is required promise machinery for a bounded dispatch.
Every remaining NextRush-owned stage is under 0.6 µs, and the only one above that — the timeout
race — trades correctness for its cost. Further work on this path should wait for either a
measurement environment that can resolve sub-1 % deltas (pinned CPU frequency, exclusive core) or a
change that removes a whole stage rather than shaving one.

---

## 14. Update — 2026-10-23: the wire/JS gap examined, framing eliminated, the eager-parse decision

Third session on the same tree, same box. §13 concluded the JSON POST path was at its floor. This
cycle asked the question §13 could not answer with in-process numbers: **why is the wire gap to Hono
(25.51 vs 19.67 µs, §13) larger than the JS gap the in-process harness measures (4.78 µs total)?**
A ~3 µs discrepancy cannot be explained by trimming a 60 ns operation, so the cycle looked for a
structural difference in how the two programs use the runtime, not a faster operation.

### 14.1 State verified before touching anything

| Claimed | Verified |
| --- | --- |
| Branch `perf/bun-body-read-parity`, HEAD `d21a4534` | yes (`git log`) |
| 21 modified / 17 untracked, nothing committed by the previous session | yes (`git status --porcelain`) |
| `web-driver.ts:174` TS2345 still present | yes, reproduced with `tsc --noEmit` |
| `bun --version` = 1.4.4, scoreboard header said 1.4.3 | yes → **F-16 fixed in this file's header** |
| `report/performance/post-body-settle-window.md` still dirty | **no** — it is clean, so **F-17 is now actionable by its owner** (needs no coordination) |

The two uncommitted changesets in the tree (`text-media-type-deno-fast-path`,
`static-responses-emit-headers`) were verified rather than assumed: runtime 402/402, static 139/139,
bun 129/129, deno 123/123, edge 134/134, node 301/301, conformance 436/436, conformance typecheck
clean after the fix below. All of it is now committed (14.3).

### 14.2 Framing was the one structural hypothesis that could have explained 3 µs — it is eliminated

**Hypothesis.** If NextRush answered with a `Response` carrying no `Content-Length` for a string body,
Bun would frame HTTP/1.1 responses with `Transfer-Encoding: chunked` while Hono's would carry a
length. Chunked framing is per-chunk work on every response and would be invisible to an in-process
`Response`-construction measurement — exactly the shape of the discrepancy.

**Test.** Raw `POST /` on a socket, `Connection: close`, headers printed verbatim for both servers.

```
NextRush: HTTP/1.1 200 OK · Content-Type: application/json · Date: … · Content-Length: 11
Hono:     HTTP/1.1 200 OK · Content-Type: application/json · Date: … · Content-Length: 11
```

Identical, byte for byte, including the length Bun computes itself for a string body.
**Hypothesis rejected.** No response-framing stage exists to remove.

### 14.3 The remaining 2.85 µs is work the contract owes, and the benchmark owes it too

§13's decomposition stands: the parser stage is 2.85 µs of the 4.78 µs of framework JS, and 62 % of
it is native (`request.text()` + `JSON.parse`). The benchmark's handler never reads `ctx.body`, so it
is tempting to make `bodyParser()` parse lazily on first access and delete the whole stage.

**Rejected, and this is the important part of the cycle.** Laziness is not a pure refactor here:

- `bodyParser()` today answers malformed JSON with a 400 and an oversized body with a 413 **before the
  handler runs**. Making the parse lazy moves both to first access, so a handler that ignores the body
  would answer 200 to a payload the framework currently rejects. That is a public-contract change, not
  an optimization.
- The comparison would also stop being symmetric: Hono's arm calls `await c.req.json()` explicitly, so
  a lazily-parsing NextRush arm would skip work the Hono arm performs. The "win" would be the
  benchmark shape, not the framework.

Per the campaign's own rule — never trade an API guarantee for a benchmark scenario — the eager parse
stays. Making it lazy is an RFC-level decision (a documented `bodyParser({ lazy: true })` opt-in is the
defensible form), and it is the largest single win available: **~2.85 µs, ~60 % of framework JS, on
this workload**.

### 14.4 A correctness defect fixed while verifying (F-22)

`createBunHandler()` has returned `Response | Promise<Response>` since the synchronous dispatch fast
path (`a701579e`), but the conformance driver's `WebInvoke` still demanded a promise. Widened the
contract to the union and made the one `.catch()` call site adopt the result with `Promise.resolve()`,
so a synchronously answered dispatch is safe there too. `tsc --noEmit` is clean; conformance 436/436.

### 14.5 Commits made from this tree (classification per the task's commit policy)

| Commit | Contents |
| --- | --- |
| `0185397a` | `.gitignore` — `.qoder/` (comment restored) |
| `6973163e` | `package.json`, `pnpm-lock.yaml` — pnpm 12.14.0 (pnpm self-artifacts only, no third-party changes) |
| `81211bc6` | text media type `text/plain;charset=UTF-8` across runtime + node + conformance + docs + changeset |
| `1f1a0fe5` | static: buffered file body and 304 committed through `ctx.send()`, plus docs + changeset |
| `61cd13e7` | conformance `WebInvoke` union (F-22) |
| *(this file)* | §14 + F-16 header correction |

Not committed: `report/performance/raw/**` (gitignored reproduction artifacts, preserved by design).

### 14.6 Scratch removed from the repository

The 15 `_x-*.ts` probes that accumulated in `apps/benchmark/scripts/dev-check/entries/` were the
campaign's throwaway instruments. Their reproducibility value is preserved outside the product tree at
`/tmp/nextrush-performance/preserved-probes/`, and they are deleted from the repository. New
experiments live under `/tmp/nextrush-performance/<experiment>/` and import built packages by absolute
path — never a `_x-*` file in the repo.

### 14.7 Where the next cycle should look

Ranked by expected size, not by novelty:

1. **Lazy body parsing as an opt-in** (`bodyParser({ lazy: true })`, or a separate `bodyParser.lazy()`)
   — ~2.85 µs on this workload, ~60 % of framework JS. Requires an RFC because the 400/413 timing
   moves; do not ship it as an implicit default.
2. **The middleware hop itself (~1 µs of the parser stage).** *Superseded by §15.1: there is no such hop; the dispatch machinery is ≈185 ns and the parser stage's glue was already counted.* The original text follows. A POST grammar runs two app middlewares
   (`bodyParser` → root router), which takes `compose()`'s general path: one `dispatch` closure, one
   `next` closure per layer, and its recursion. §13 did not attribute this; this cycle could not
   attribute it either without an instrument that the box cannot currently stabilise. Attribute it
   first, then decide — a `len === 2` fast path would duplicate the composer's semantics for ~100 ns
   and is not worth it on its own.
3. **A measurement rig, before any of the above.** Every candidate ranked 3 or lower is smaller than
   this box's cross-window drift. Pinned CPU frequency (`cpupower frequency-set -g performance` or a
   fixed `scaling_setspeed`), no SMT sibling for the server, and exclusive cores would make ±0.5 %
   claims meaningful; nothing here can currently resolve them.
4. Node/edge/serverless remain untouched by this cycle. The Node adapter's own `context.ts` is a
   separate 858-line response implementation — a duplicated stage worth auditing on its own merits,
   but not a Bun win and not something to change for symmetry.

### 14.8 Reproduction

```bash
# F-22 verification
cd packages/adapters/conformance && pnpm exec tsc --noEmit

# framing test (raw headers, both servers)
PORT=3101 bun /tmp/nextrush-performance/probe/nr.ts &
PORT=3102 bun apps/benchmark/scripts/dev-check/entries/serve-hono-post.ts &
node /tmp/nextrush-performance/probe/head.mjs 3101
node /tmp/nextrush-performance/probe/head.mjs 3102

# the affected suites committed above
pnpm --filter @nextrush/runtime test -- --maxWorkers=2
pnpm --filter @nextrush/static test -- --maxWorkers=2
pnpm --filter @nextrush/adapter-conformance test -- --maxWorkers=2
```

---

## 15. Update — 2026-10-23: the middleware hop attributed, native Bun routing evaluated and rejected, a lazy-parse RFC

Branch `perf/bun-body-read-parity`, HEAD `1bcf665c`, clean tree, Bun 1.4.4, Node v26.12.0,
Deno 2.9.7. **No product source changed in this cycle.** Both candidates were measured, one was
refuted, one was rejected, and the one direction with a real mechanism became an RFC.

### 15.0 State reconciliation

§14.5 lists six commits plus a row marked *(this file)* — seven in total, and `git log
d21a4534..HEAD` reports seven. The earlier chat summary said "6"; the tracked table was correct.
`apps/benchmark/scripts/dev-check/entries/` holds zero `_x-*.ts` files; all fifteen are preserved
at `/tmp/nextrush-performance/preserved-probes/`. The conformance typecheck still exits 0
(`cd packages/adapters/conformance && pnpm exec tsc --noEmit`), so F-22 remains fixed.

### 15.1 Candidate A — the "~1 µs middleware hop" does not exist

§14.7 ranked a ~1 µs middleware hop as the second-largest remaining item. It was a subtraction
artifact: `full` − `noparser` − (native text) − (`JSON.parse`) was read as "hop", but the parser
stage's own glue was already inside that difference and §13.2 had measured it (378 ns). The
decomposition closes exactly:

| Parser-stage component | ns |
| --- | ---: |
| `new WebBodySource(request)` | 318.6 |
| `request.text()` | 596.1 |
| `JSON.parse(1 KB)` | 406.0 |
| `checkJsonDepth` | 145.9 |
| glue: content-type, depth-bytes test, envelope, `next()` | 378.0 |
| **total** | **1 844.6** |

No remainder, so no hidden hop. Measuring the dispatch machinery directly confirms it.

**Instrument** (`/tmp/nextrush-performance/c11/attrib.ts`): one pre-built `BunContext` and one
route handler shared by every mode, interleaved rounds, min per mode, `taskset -c 2`, N = 200 000,
Bun 1.4.4. Every mode is a real public entry point.

| Mode | ns/op |
| --- | ---: |
| `handler` — the user handler alone | 78.4 |
| `exec0` — compiled executor | 84.5 |
| `canon` — `canonicalizePath('/')` | 93.8 |
| `match` — `router.match('POST','/')` | 133.0 |
| `routes` — `router.routes()(ctx)` (canon + match + executor) | 151.0 |
| `c1` — `compose([routes])` | 176.3 |
| `cb1` — `app.callback()`, one middleware | 213.8 |
| `c2` — `compose([noop, routes])` | 219.9 |
| `c3` — `compose([noop, noop, routes])` | 254.7 |
| `cb2` — `app.callback()`, two middlewares | 263.4 |

Marginal costs between modes with identical setup and identical contexts:

| Marginal | ns | Required by the contract? |
| --- | ---: | --- |
| executor entry over the bare handler | 6.1 | yes |
| canonicalize + match inside the routes middleware | 66.5 | yes (canonical path is public behaviour) |
| single-middleware wrapper | 25.3 | yes (the middleware API is a `next` argument) |
| general composer + one `noop` layer | 43.6 | yes |
| one more middleware layer | 34.8 | yes |
| `callback()`'s `.then` (rejection → error envelope) | 37.5–43.5 | yes — without it a thrown handler reaches the adapter's generic 500 instead of the framework envelope |

The whole dispatch machinery for this app shape is **≈185 ns**, not ≈1 µs. Nothing in the table
is removable without changing observable behaviour: the `.then` is the error-envelope route, the
closures are the middleware contract, and canonicalization is documented behaviour.

Two rows must not be added or subtracted: `match` standalone (133.0 ns) is *larger* than the
route stage measured inside the middleware (66.5 ns) because a standalone call's `RouteMatch`
escapes into the loop while the in-middleware one is consumed locally. Only same-shape marginal
pairs are valid, which is how the table above is built.

**Dynamic routes cost more, and that is the only shape worth discussing.**

| Route shape | route stage (`routes` − `exec0`) |
| --- | ---: |
| static `/users` | 85.7 ns |
| dynamic `/users/:id` | 282.5 ns |

(separate run, N = 300 000, same instrument shape)

### 15.2 Candidate B — Bun's native route table: measured, then rejected

Bun 1.4.4 exposes `Bun.serve({ routes })` with static paths, `:params`, `*` wildcards and
per-method maps, plus a `fetch` fallback for anything unmatched. Probed behaviour from this
install: `/static/`, `//`, `/./` and `/%2F` all miss the table (no normalization), params are
percent-decoded identically to NextRush (`%2F` → `/`, `%20` → space, `+` untouched), optional
params and precedence agree on the cases tested (static beats param, static beats wildcard), and
NextRush's trie additionally rejects conflicting param names at the same position.

**Prototype.** `/tmp/nextrush-performance/c11/arm-native.ts` registers the one static POST route
in Bun's table and runs the same middleware stack with the compiled executor as the terminal
step, so the canonicalize + match stage is gone and nothing else changes. The `fetch` fallback is
the unmodified NextRush handler, so misses, other methods, trailing slashes, case variants and
encoded paths are answered by the real router.

**Equivalence matrix** — 23 requests covering valid/charset/empty/malformed/deep JSON, no content
type, text and form bodies, query strings, arrays, `GET`/`PUT`/`DELETE`/`OPTIONS`/`HEAD` on the
POST route, a miss, a second route, a method mismatch, `//`, `/./`, `/%2F`, and a case variant.
**23/23 identical** in status, `content-type`, `content-length` and body bytes
(`/tmp/nextrush-performance/c11/matrix.mjs`).

**Wire comparison** (`report/performance/raw/ab2.mjs`, 5 order-flipped pairs, `taskset` core 0 /
client cores 1,3):

| Pair | order | baseline CPU/req | native CPU/req | Δ |
| --- | --- | ---: | ---: | ---: |
| 1 | A→B | 23.16 µs | 22.04 µs | −4.9 % |
| 2 | B→A | 23.04 µs | 22.94 µs | −0.4 % |
| 3 | A→B | 23.63 µs | 23.34 µs | −1.2 % |
| 4 | B→A | 24.88 µs | 24.16 µs | −2.9 % |
| 5 | A→B | 24.24 µs | 24.43 µs | +0.8 % |
| **median** | | **23.63 µs** | **23.34 µs** | **−1.2 %** (4/5) |

**Null control, same harness, both sides the same bundle:** median **+1.6 %**, pairs +1.9 %,
−2.5 %, +5.7 %, −0.1 %, +1.6 % (2/5). The harness can report ±1.6 % between identical binaries,
so the native-route result is **inside the noise floor**.

Arithmetic agrees with the control: removing 66.5 ns (static) is 0.28 % of 23.6 µs CPU/req and
1.4 % of the 4.78 µs of framework JS. Only the dynamic shape (282.5 ns ≈ 1.2 %) is even
nominally resolvable, and it cannot be resolved on this box either.

**Verdict: rejected.** The benefit is 0.28–1.2 % of CPU/req at best, unverifiable here, against a
permanent cost: a route compiler inside the Bun adapter that must mirror every NextRush pattern
form, duplicate path spellings for `strict: false`, `server.reload()` on late registration,
precedence parity between two different routers for every overlap, a second application instance
per server (the prototype already trips the "different Application booted" guard), and a
fallback path that makes an unmatched method cost *two* dispatches. None of that is justified by
a stage that measures 66.5 ns.

### 15.3 The eager-parse decision becomes RFC-047

§14.3 deferred lazy body parsing because it moves 400/413 timing into the handler's call stack.
That decision stands for the default. `docs/RFC/047-lazy-body-parsing.md` specifies the opt-in
form: `bodyParser({ lazy: true })`, `await ctx.readBody()` available in both modes, `ctx.body`
throwing when unread in lazy mode, no implicit trigger anywhere, the transport cap still
unconditional, single-consumption memoisation, abort and deadline coverage, and a benchmark
disclosure rule (an unread-body workload is not a parser-speed comparison). No prototype: the
RFC has to be accepted before code, per the repo's RFC-before-implementation rule.

### 15.4 Node context/response audit (separate, read-only)

`report/core/context-review.md` already audited this surface; its conclusions still hold at HEAD
on source inspection, and Node is ahead of Bun on one point rather than behind:

| Concern | Node | Bun |
| --- | --- | --- |
| body source | lazy, memoised getter, no allocation for bodyless methods | **eager `new WebBodySource(request)` in the constructor** (318.6 ns) |
| `raw` / `state` / signal | lazy `??=` | lazy |
| response | `_outgoing` recorded response; a string body goes to `res.end` unchanged, no intermediate bytes | `WebResponseBuilder`, plain init record |
| URL/query | `indexOf('?')` + `slice` | `requestTargetFromUrl` scan, no `URL` |

No duplicated stage was found. The Bun-side eagerness is not a removable cost for this workload —
the parser reads the body source on the next line anyway, and `ctx.bodyLength` (the runner's
settle-window input) is derived from it. Recorded as a finding, not a change. The 858-line
`context.ts` is a structural observation (HTTP + stream + SSE + NDJSON + flush in one class), not
a performance one; splitting it is out of scope for this campaign and would be an unrelated
refactor.

### 15.5 Verification

No product source changed, so the suites are a regression check rather than a gate on new code:

| Check | Result |
| --- | --- |
| conformance typecheck (`tsc --noEmit`) | exit 0 |
| perf gate — `bundle probe bookkeeping hygiene` | 23 PASS, 0 FAIL |
| `_x-*.ts` in the repo | 0 |
| scratch outside the repo | `/tmp/nextrush-performance/c11/` (8 files) |

### 15.6 Reproduction

```bash
# Candidate A — dispatch attribution (one ctx, one handler, marginal only)
taskset -c 2 bun /tmp/nextrush-performance/c11/attrib.ts

# Candidate A — dynamic vs static route stage
taskset -c 2 bun /tmp/nextrush-performance/c11/dyn.ts

# Candidate B — semantic equivalence (23 cases, both arms)
taskset -c 2 node /tmp/nextrush-performance/c11/matrix.mjs

# Candidate B — paired, order-flipped wire comparison
node report/performance/raw/ab2.mjs --runtime bun --workload post \
  --a /tmp/nextrush-performance/c11/base.js \
  --b /tmp/nextrush-performance/c11/native.js --pairs 5 --label c11-native-routes
```

### 15.7 Where the next cycle should look

§14.7 items 1 and 2 are now closed (an RFC, and a refutation). Ranked by mechanism size:

1. **A measurement rig, still.** Every remaining candidate is smaller than the ±1.6 % median drift
   between two identical binaries measured here. Pinned frequency, no SMT sibling, exclusive
   cores. Until then only stage removals ≥1 % are worth attempting.
2. **Lazy body parsing, if RFC-047 is accepted** — the only remaining stage-removal of ~2.85 µs.
3. **Dynamic-route matching (282.5 ns)** — the largest single routing cost, and the only place
   native routing had a resolvable mechanism. Needs the rig before any claim.
4. **Nothing below ~1 %.** The composer, executor, `.then`, canonicalizer and depth guard are each
   measured, contract-bound and below this box's resolution.

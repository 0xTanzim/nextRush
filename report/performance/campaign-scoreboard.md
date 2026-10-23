# Performance campaign scoreboard — workloads × runtimes

| Field           | Value                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| **Report type** | `Performance`                                                              |
| **Scope**       | The NextRush request-path cost campaign: every workload, every runtime     |
| **Date**        | `2026-10-23`                                                               |
| **Machine**     | Intel Core i5-8300H, 4C/8T, **shared**. SMT siblings 0↔4, 1↔5, 2↔6, 3↔7    |
| **Runtimes**    | Bun 1.4.3 · Node v26.12.0 · Deno 2.9.7 · Hono 4.13.0 (comparison baseline) |
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

| Workload                              | Runtime | CPU/req (now) |                 vs Hono | Quality                               | Major remaining costs                                                                             | Constraints                                                                | Status                                                                                |
| ------------------------------------- | ------- | ------------: | ----------------------: | ------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Minimal GET                           | Deno    |      11.10 µs |      1.21× (2026-10-21) | Good — was 1.51× at HEAD              | context construction, dispatch scaffolding, Deno's native header handling                         | Deno's `Response` fast path needs an exact media type                      | ✅ improved this cycle (§10)                                                          |
| Minimal GET                           | Bun     |      11.58 µs |               **1.10×** | Good — was 1.16×                      | context construction, dispatch scaffolding                                                        | Bun's `Headers` is cheap, so this class of work barely exists there        | ✅ improved this cycle (§10)                                                          |
| Minimal GET                           | Node    |      23.83 µs | not measured this cycle | Fair                                  | Node's own HTTP + `writeHead` path dominates; the sync fast path cannot apply (callback runner)   | Node is not the campaign's target runtime                                  | ⬜ unchanged — no regression                                                          |
| JSON POST (1 KB)                      | Deno    |      34.08 µs |      1.54× (2026-10-21) | Weak                                  | body reading dominates; the response path is no longer the bottleneck                             | body-read parity across runtimes                                           | ⬜ open — the next target                                                             |
| JSON POST (1 KB)                      | Bun     |      24.55 µs |               **1.31×** | Weak — now the largest measured gap   | body reading through `bodyParser`; the chain is genuinely async there, so §10's path cannot apply | body-read parity across runtimes                                           | ⬜ open — the next target                                                             |
| JSON POST (1 KB)                      | Node    |      40.12 µs | not measured this cycle | Fair                                  | body reading                                                                                      | —                                                                          | ⬜ unchanged — −3.0 % (3/3) from the shared resolved dispatch                         |
| Static GET                            | Node    |     126.04 µs |                       — | Poor — 2.7× a `readFile`+`send` floor | `lstat` for symlink policy, `open`/`read`/`close`, one extra read inside `readFile`               | `serveStatic` is Node-only, so there is no cross-runtime parity to protect | ⚠️ measured — was 143.59 µs, now −13.6 %; range/large-file streams still drop headers |
| Dynamic-route GET                     | —       |  not measured |                       — | Unknown                               | —                                                                                                 | —                                                                          | ⬜ not investigated                                                                   |
| GET with middleware                   | —       |  not measured |                       — | Unknown                               | —                                                                                                 | —                                                                          | ⬜ not investigated                                                                   |
| Raw-body POST                         | —       |  not measured |                       — | Unknown                               | —                                                                                                 | —                                                                          | ⬜ not investigated                                                                   |
| Extra headers / multiple `Set-Cookie` | —       |  not measured |                       — | Unknown                               | —                                                                                                 | —                                                                          | ⬜ not investigated                                                                   |
| Streaming / compression / error paths | —       |  not measured |                       — | Unknown                               | —                                                                                                 | —                                                                          | ⬜ not investigated                                                                   |

The unmeasured rows are **unknown, not good**. The mission's workload matrix names them; the
campaign has not yet produced numbers for them, and this report does not pretend otherwise.

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
| 10  | POST body read on Bun and Deno                                       | Body reading dominates the POST path (Bun **1.31×** Hono, Deno 1.54× Hono); §10's dispatch win cannot apply because `bodyParser` makes the chain genuinely async | Not yet investigated against the current code                                                                                                                                                                                                                                                                                                                                                   | ⬜ **open — next**                                                                |
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

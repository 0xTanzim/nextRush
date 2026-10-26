# NextRush Performance Reality Check

**Date:** 2026-10-21
**Revision measured:** `d484412f` (`perf/bun-body-read-parity`), working tree **dirty** — see §2.3.
**Question answered:** where NextRush actually stands on GET and POST across Bun, Node, and Deno; what
the recent Bun work really changed; and whether any of it blocks a release.

**Read this first:** every number below was produced by the repository's own harness on this machine in
this session. Any cell that could not be measured says **not measured**. No value was carried over from
another machine, runtime version, concurrency, or payload.

---

## 1. Executive summary

1. **Current Bun GET is 40.0k rps and Bun POST 23.3k rps** through a real socket (`wrk`, 64 connections,
   3-run median). In-process, that is 4.40 µs and 8.19 µs per request.
2. **The recent Bun work is a real code improvement whose end-to-end effect is not statistically
   established.** The `Uint8Array` + decode work is gone from the POST profile, and one microtask hop
   left the dispatch path. But full POST measured 8.18 µs and 9.41 µs against a recorded 9.91–10.40 µs
   baseline — ranges that overlap. The widely quoted **`6.07 → 3.77 µs` is not a before/after of this
   change**: it compares two different probe variants, and those variants are **not in the repository**
   (§4.2).
3. **Deno is the weak runtime and the only clear performance gap that survives scrutiny:** 0.63× Hono on
   GET and 0.69× on POST over a real socket, with POST p50 about twice Hono's. It is consistent across
   three runs.
4. **Node is fine.** Over a real socket NextRush is **8% faster than Hono on GET** and 6% slower on POST.
   The alarming in-process Node ratio (0.11) is an artifact: the NextRush arm takes a native
   `IncomingMessage` while the Hono arm takes a Web `Request`. The harness itself refuses to gate it.
5. **Serverless and edge targets are correct and deploy-verified, but not performance-measured at all.**
   No platform cold start, no warm-invocation latency, no per-target bundle budget.
6. **One correctness defect is live on Deno:** compression returns a **200 with an empty body**
   (`bytes=0`, no `content-encoding`). It passes on Bun, Node, and workerd. It is registered as known
   failure FB-03, so CI stays green.
7. **No performance blocker exists for release.** There is a blocked *claim*: nothing supports a
   "fast on Deno" or "fast on serverless" statement today.
8. **Stop optimizing.** The remaining gaps need measurement first, not code: one Deno body-read A/B and
   one platform-level latency probe would decide more than another optimization pass.

---

## 2. Tested state and method

### 2.1 Environment

| Item | Value |
| --- | --- |
| CPU | Intel i5-8300H, 8 logical cores, shared development box |
| OS / kernel | Linux x86_64 |
| Bun | 1.4.3 |
| Node | v26.12.0 |
| Deno | 2.9.3 (stable) |
| Hono | 4.13.0 |
| Load generator | wrk 4.2.0, client pinned to cores 4–7 |

### 2.2 What each instrument measures

| Instrument | Measures | Repetition |
| --- | --- | --- |
| `inproc` | framework work per request, no network, Web request objects pre-built | **best of 3 runs** |
| `wire` | real HTTP throughput through the runtime's own listener | **median of 3 wrk runs**, `-t2 -c64 -d3s` |
| `wrk --latency` (manual, §2.4) | throughput **and** p50/p75/p90/p99 | 3 runs, same flags |
| `cold` | process start to first response | median of 7 fresh processes |
| `bundle` | hello-world bundle size | single build |
| `probe` | correctness over a real socket | once |
| `profile` | CPU attribution | one capped profile |

### 2.3 Tree state — what is and is not mine

HEAD is `d484412f`. The working tree is **dirty**, and the measurement runs executed the working tree,
not a clean checkout. Uncommitted, unrelated to this audit:

- Vitest 4 → 5 migration: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
  `packages/{class,di,testing}/vitest.config.ts`, `packages/create-nextrush/package.json`,
  `packages/middleware/cookies/src/__tests__/security.test.ts`, `apps/website/package.json`,
  `.github/actions/setup-toolchain/action.yml`.
- An Elysia reference arm in the benchmark harness: `apps/benchmark/scripts/dev-check/README.md`,
  `lib/stages/measure.mjs`, `lib/__tests__/wire-post-entries.test.mjs`, and the new
  `entries/serve-elysia-post.ts`.

**Elysia rows are therefore excluded from every conclusion in this report.** They are labelled
`(Bun-only)` in the harness output and their arm is uncommitted.

### 2.4 One measured addition, no code change

`wire` prints throughput only. Latency percentiles were captured by running the **same built artifacts**
the harness builds, with the **same** `wrk -t2 -c64 -d3s` invocation plus `--latency`. This added no
harness code. It is a measurement, not a modification.

Because `c=64` is far above the service time, these percentiles are **queueing-dominated**: they describe
behaviour at 64 concurrent connections, not single-request latency.

---

## 3. Current GET and POST results

### 3.1 In-process per-request cost (µs/req)

| Runtime | Raw floor | Hono GET | NextRush GET | NR/Hono | Hono POST | NextRush POST | NR/Hono |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Bun | 2.05 | 2.86 | **4.40** | 1.54 | 3.93 | **8.19** | 2.09 |
| Node | 9.69 | 11.21 | **1.18** ⚠ | 0.11 ⚠ | 16.40 | **13.63** | 0.83 |
| Deno | 5.57 | 6.70 | **10.83** | 1.62 | 4.39 | **18.85** | 4.29 |

⚠ **The Node GET row is not a framework comparison and must not be quoted as one.** The NextRush Node
arm dispatches through the native `IncomingMessage`; the Hono arm builds a Web `Request`. The harness
prints `not gated: arms use different request models — see inproc.*.web.us` for exactly this reason.
The Web-request control on Node measures 13.67 µs. Trust §3.2 for Node.

POST is a parsed 1 KB JSON body, 18,000 requests. GET is 300,000 iterations after 30,000 warm-up.
Bun's inside-budget rows: POST ratio 2.09 (target 3.0, max 3.5) PASS; GET ratio 1.54 (target 1.3,
max 1.9) WARN — pre-existing and unchanged.

### 3.2 Real HTTP throughput (rps, median of 3 × 3 s, 64 connections)

| Runtime | Raw floor | Hono GET | NextRush GET | NR/Hono | Hono POST | NextRush POST | NR/Hono |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Bun | 54,455 | 47,144 | **40,042** | 0.85 | 29,930 | **23,347** | 0.78 |
| Node | 28,055 | 25,491 | **27,562** | **1.08** | 16,443 | **15,519** | 0.94 |
| Deno | 54,850 | 48,498 | **30,307** | **0.63** | 12,012 | **8,248** | **0.69** |

Reading the floor: on Bun the load generator reaches 54.5k rps against the raw server, so NextRush's
40.0k (73% of floor) and Hono's 47.1k (86%) are both below client saturation. On Deno the floor is
54.9k while Hono reaches 48.5k and NextRush 30.3k — the Deno gap is not a harness ceiling.

Bun `TIMEOUT=0` measures 40,879 rps versus 40,042 with the default timeout race: about 2% throughput.

### 3.3 Latency at 64 connections (3 runs; min–max across runs)

| Runtime | Workload | p50 | p75 | p90 | p99 |
| --- | --- | ---: | ---: | ---: | ---: |
| Bun | NextRush GET | 1.43–1.79 ms | 1.90–2.13 | 2.23–2.45 | 2.98–3.27 |
| Bun | Hono GET | 1.17–1.49 ms | 1.56–1.69 | 1.74–1.98 | 2.69–2.83 |
| Bun | NextRush POST | 2.42–2.80 ms | 2.98–3.29 | 3.43–3.62 | 4.50–4.61 |
| Bun | Hono POST | 1.96–2.30 ms | 2.48–2.77 | 2.85–3.03 | 3.59–3.82 |
| Node | NextRush GET | 2.04–2.43 ms | 2.60–2.91 | 3.05–3.29 | 3.65–29.1* |
| Node | Hono GET | 2.44–2.91 ms | 3.02–3.26 | 3.32–3.49 | 3.89–43.8* |
| Node | NextRush POST | 3.49–4.25 ms | 4.20–4.78 | 4.65–5.39 | 5.32–39.0* |
| Node | Hono POST | 3.49–4.11 ms | 4.06–4.71 | 4.55–5.30 | 5.61–27.1* |
| Deno | NextRush GET | 1.77–1.85 ms | 2.31–2.41 | 2.70–2.78 | 3.10–3.27 |
| Deno | Hono GET | 1.14–1.24 ms | 1.53–1.55 | 1.63–1.71 | 1.95–2.05 |
| Deno | NextRush POST | 7.88–9.64 ms | 9.41–10.36 | 10.34–10.88 | 11.0–14.1 |
| Deno | Hono POST | 3.80–4.34 ms | 5.01–6.92 | 6.40–8.01 | 8.09–9.24 |

\* One run in each Node leg contains a single p99 spike (29–44 ms) that does not appear in the other two
runs. That is a JIT/GC or host-scheduling tail on a shared box, not a framework property. The Deno gap
has no such outlier: all three runs agree.

### 3.4 Cold start (startup, serverless-adjacent)

| Runtime | Routes | NextRush | Hono | Ratio (max) | RSS |
| --- | ---: | ---: | ---: | ---: | --- |
| Bun | 25 | 11.0 ms | 9.3 ms | 1.18 (1.6) PASS | 21.6 MB |
| Bun | 1000 | 16.4 ms | 33.9 ms | **0.49** (1.2) PASS | 29.9 MB |
| Node | 25 | 78.5 ms | 81.7 ms | 0.96 (1.6) PASS | 63.6 MB |
| Node | 1000 | 86.5 ms | 150.6 ms | **0.57** (1.2) PASS | 67.8 MB |

Route registration scales better than Hono's; the 25-route Bun case is 1.7 ms slower.

---

## 4. What the recent Bun work actually changed

Four claims, deliberately separated.

### 4.1 Claim 1 — a code change was implemented: **TRUE**

Six implementation/doc commits on top of the RFC-043 work:

| Commit | Change |
| --- | --- |
| `33f1ac17` | Native `request.text()` when `Content-Length` proves the body fits; exact UTF-8 byte count in `BodyTooLargeError.received`; text cache with one-time re-encode for `buffer()` |
| `3e1ff026` | `dispatchWithTimeout` no longer awaits the settlement promise unconditionally; the promise stays as the race handle |
| `ee1e673a` | JSON branch reads eligible bodies as text and runs one shared parse/strict/depth/error tail; `rawBody`/`verify` keep the byte path |
| `809369dc` | Bun adapter README documents the real timeout contract; two new contract tests |
| `a801a2b8` | RFC-045 → `Shipped`, ADR-0033, reconciled task state, runtime ARCHITECTURE |
| `3912dcb9`, `d484412f` | Investigation reports + router reproduction addendum |

Suites recorded earlier in this session at this revision (the tree already carried the unrelated Vitest 4→5 migration): runtime 379, body-parser 320, adapter-bun 129, adapter-deno 123, conformance 436 — all passing; `tsc --noEmit` clean on the four touched packages. Documentation edits since then cannot change them.

### 4.2 Claim 2 — an isolated operation improved: **PARTLY, and not as documented**

**What is true.** A fresh POST profile at this revision (`profile --entry inproc-nextrush-post --rt bun`)
no longer shows the byte-materialisation work:

| Function | Pre-change profile (report) | This revision |
| --- | ---: | ---: |
| `arrayBuffer` | 6.2% | absent from top 10 |
| `decode` (TextDecoder) | 3.2% | absent from top 10 |
| `Request` | 12.6% | 21.9% |
| `Response` | 4.0% | 10.6% |
| `parse` | 9.0% | 9.8% |
| `encode` | 4.9% | 6.9% |
| `setTimeout` | 4.1% | 1.8% |
| `async dispatchWithTimeout` | not listed | 3.7% |

That is mechanistic evidence, not a timing claim: the `Uint8Array` + decode stage is gone from the path.

**What is not true as written.** RFC-045 §3.2/§14.1 and ADR-0033 present `6.07 → 3.77 µs` as the
change's measured result. It is not:

- `6.07` is `ctx-body-source` — context + `bodySource.json()` on the **buffer** path.
- `3.77` is `ctx-native-json` — context + native `request.json()` + `ctx.json`.
- They are **two different probe variants measured side by side**, i.e. a *headroom* estimate, not a
  before/after of one code path.
- Neither variant exists in the repository. `git log -S "ctx-native-json"` finds only the documentation
  commits that quote the number; no entry file was ever committed. The probe is **not reproducible from
  this tree**.
- The shipped path is `request.text()` + `JSON.parse`, which was **never measured in isolation**.

So `3.77` is a reference point for what the read *could* cost, not a measurement of what it does cost.
RFC-045 and ADR-0033 have been corrected to say this (§9).

### 4.3 Claim 3 — the complete request improved: **NOT ESTABLISHED**

| Measurement | Recorded before | Close-out runs |
| --- | ---: | ---: |
| Bun in-process POST | 9.91–10.40 µs | **8.18 µs**, **9.41 µs** |
| Bun wire POST | 22,800 rps (harness-stored previous run) | **23,347 rps** (+2.3%) |

The in-process ranges **overlap**: a 9.41 µs run sits inside a 9.91–10.40 µs baseline band, and the
harness itself moves ±10–15% run to run on this box. The wire figure moves 2.3%, which is inside noise.
On current evidence the honest statement is: *the complete POST path is at or slightly below its previous
cost, and this measurement cannot resolve how much of that is the change.*

For contrast, the earlier RFC-043 body-read change **does** have a clean before/after in the committed
record: 26.74 → 11.87 µs in-process and 9,073 → 22,056 rps on the wire, measured in its own session.
That is where the visible Bun progress came from; the RFC-045 work on top of it is smaller.

### 4.4 Claim 4 — repeatable under controlled conditions: **NO**

A same-invocation A/B is impossible at this revision because the change is already committed and the
pre-change code is not in the tree. Task 9.5 (CPU-pinned per-phase A/B) and task 9.7 (JSON-path
allocation harness) remain **open**, correctly, and archiving (10.2) stays blocked behind them. Nothing
in this audit fabricates their results.

---

## 5. Runtime coverage matrix

| Capability | Bun | Node | Deno |
| --- | --- | --- | --- |
| Adapter implemented | Yes (`Bun.serve`) | Yes (`node:http`) | Yes (`Deno.serve`) |
| GET benchmark exists | Yes — inproc + wire, gated | Yes — inproc + wire (inproc ratio not gated, different request models) | Yes — inproc + wire, rows are INFO (not gated) |
| POST benchmark exists | Yes — 1 KB JSON, inproc + wire | Yes — 1 KB JSON, inproc + wire | Yes — 1 KB JSON, inproc + wire |
| Native baseline exists | Yes — raw inproc 2.05 µs, raw wire 54.5k rps | Yes — raw inproc 9.69 µs, raw wire 28.1k rps | Yes — raw inproc 5.57 µs, raw wire 54.9k rps |
| Conformance / parity passes | Yes — in-process driver + **real-socket** `bun-runner` in CI | Yes — in-process driver; **no real-socket Node runner** | Yes — in-process driver + **real-socket** `deno-runner` in CI |
| Known performance gaps | GET 0.85× Hono, POST 0.78× Hono; GET inproc WARN band | None observed; GET faster than Hono | **GET 0.63×, POST 0.69×; POST p50 ~2× Hono** |
| Known correctness gaps | None in probes (16/16) | None in probes (15/15) | **FB-03: compression → 200 with 0-byte body** |
| Evidence-backed optimization needed | Not until the POST delta is measured properly | No | **Yes — attribution first (§8, item A3)** |

**Did the recent changes regress Node or Deno?** Unknown, not "no". No pre-change Node/Deno arm exists to
compare against, and both runtimes share the changed code: `WebBodySource` is used by Deno and the Web
edge/serverless path, and `body-parser` is runtime-agnostic. What can be said:

- Deno wire results today (0.63×/0.69× Hono) are consistent across three runs and are **not** explained
  by the body change alone — Deno's *GET* path, which touches no body code, is equally behind (0.63×).
- Node's wire results are at or above Hono, so no regression is visible there.

**Deno compression (FB-03), verified this session.** `probe --rt deno` reports
`KNOWN probe.compression-gzip content-encoding=undefined bytes=0`. The same probe **passes** on Bun
(`content-encoding=gzip bytes=1990`), on Node (same), and on workerd (`bytes=1267`). So this is a
Deno-only, body-destroying response bug, tracked as a known failure so the gate stays green.

- It is **independent of the performance milestone** — it is a correctness issue, and fixing it is not a
  performance change.
- It **does** block any "compression works on Deno" statement, and it would be a production incident for
  a Deno user who enables the compression middleware.

---

## 6. Serverless and edge support

Which targets actually exist (source: `packages/adapters/{serverless,edge,nextjs}`, and
`packages/adapters/conformance/deploy-verification/README.md`):

| Target | Adapter | Correctness evidence | Real deploy | Performance evidence | Release blocker? |
| --- | --- | --- | --- | --- | --- |
| Cloudflare Workers | `adapter-edge` | workerd real-isolate conformance (CI) + `edge` stage (15/15) | nightly + on-demand (skipped without secrets) | **none** | No — blocks a perf claim only |
| Vercel Edge | `adapter-edge` | same edge engine | nightly + on-demand | **none** | No |
| AWS Lambda | `adapter-serverless` (`lambda.ts`, `lambda-streaming.ts`) | in-process serverless driver on Node (its real runtime) | nightly + on-demand | **none** | No |
| Google Cloud Functions | `adapter-serverless` (`google.ts`) | mapper/bridge tests + in-process driver | nightly + on-demand | **none** | No |
| Azure Functions | `adapter-serverless` (`azure.ts`) | mapper/bridge tests + in-process driver | **app exists, NOT wired into CI** | **none** | No, but unverified in cloud |
| Next.js App Router | `adapter-nextjs` | 4 test files; deploy-verification apps for Next 14/15/16 | app-level verification | **none** | No |
| API Gateway (event mapping) | `adapter-serverless` | event-mapper fixtures | via Lambda path | **none** | No |

Three properties kept separate, as required:

- **Correctness:** proven for Cloudflare, Vercel, Lambda, GCF via conformance and/or deploy smoke tests.
  Azure is proven in unit/mapper tests but its deploy app is not scheduled.
- **Compatibility:** Next.js is App-Router-only; serverless adapters are buffered-event models
  (`transportAbortFiresSignal: false`, `teardownOnShutdown: false`).
- **Performance:** **not measured for any serverless or edge target.** The `cold` stage measures a local
  Bun/Node process, which is a *proxy* for platform cold start, not the platform. Bundle budgets cover
  `hello-nextrush-root|bun|node` only — not a worker or Lambda bundle.

No cloud resources were deployed or consumed for this audit.

---

## 7. Hono comparison, and whether it is fair

Comparability audit of the harness (all checks pass unless noted):

| Requirement | Status |
| --- | --- |
| Same machine / OS | Yes — one box, one session |
| Same runtime and version | Yes — both arms in the same process/socket per runtime |
| Same HTTP server and mode | Yes — `Bun.serve`/`Deno.serve`/`@hono/node-server` vs the NextRush counterpart, same listener |
| Same payload and response | Yes — GET `/` → `{"hello":"world"}`; POST `/` with a 1,013-byte JSON body → `{"ok":true}` |
| Same route type and method | Yes — static `/` for both |
| Same middleware work | GET: none. POST: NextRush `bodyParser()` vs Hono `c.req.json()` — equivalent parse work |
| Same warm-up and duration | Yes — 3 × 3 s, median; both arms in the same stage |
| Same client / methodology | Yes — `wrk -t2 -c64`, pinned to cores 4–7 |
| Known mismatch | **In-process Node GET**: different request models (native vs Web). Not used for any conclusion |

### 7.1 Results

| Workload | Runtime | Native baseline | Hono | NextRush | Relative difference | Confidence |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| GET `/` | Bun | 54.5k rps | 47.1k | 40.0k | NR 15% slower (40.0/47.1 = 0.85) | High (3-run median, same run) |
| GET `/` | Node | 28.1k rps | 25.5k (22.3–26.5k) | 27.6k (23.3–27.9k) | NR **8% faster** (1.08) | Medium — the 3-run bands overlap, though both medians and my three manual runs agree on the direction |
| GET `/` | Deno | 54.9k rps | 48.5k | 30.3k | NR **37% slower** (0.63) | High (3 runs agree) |
| POST 1 KB JSON | Bun | not measured (raw entry is GET-only) | 29.9k | 23.3k | NR 22% slower (0.78) | High |
| POST 1 KB JSON | Node | not measured | 16.4k | 15.5k | NR 6% slower (0.94) | Medium — inside noise band |
| POST 1 KB JSON | Deno | not measured | 12.0k | 8.2k | NR **31% slower** (0.69) | High |

Throughput: higher is better; `relative difference = NextRush ÷ Hono`. Latency: lower is better
(§3.3, Deno POST p50 7.88–9.64 ms vs 3.80–4.34 ms).

What this does **not** say: it does not compare Bun-NextRush to Node-Hono, does not treat one run as a
winner, and does not compare bare GET to JSON-parsing POST. Bun-NextRush 40.0k and Deno-NextRush 30.3k
are different runtimes and are never ranked against each other.

### 7.2 Is the harness trustworthy?

Yes for the rows above, with two caveats: `wire` has no budget row (deliberately — it is noisy), and the
in-process Node GET ratio is explicitly invalid. No correction is required to use these results. The only
missing piece is a raw **POST** floor, which would separate framework cost from server cost on the POST
path. That is a small, additive benchmark entry, not a rewrite — see §8, item B2.

---

## 8. What remains

### A. Required before release

| ID | Item | Evidence | Blocks release? |
| --- | --- | --- | --- |
| A1 | **FB-03 Deno compression returns an empty body** | `probe --rt deno`: `content-encoding=undefined bytes=0`; passes on Bun/Node/workerd | Blocks a Deno-production claim. Correctness, not perf. Smallest action: reproduce with `compression()` on a Deno response, fix the response path, delete the `knownFailures` entry in the same change. |
| A2 | Azure deploy app not wired into nightly CI | `deploy-verification/README.md` warning | No — but Azure is unverified in cloud |

Nothing else is a release blocker. The audit found no correctness regression on Bun, Node, or workerd.

### B. Required before making a performance claim

| ID | Item | Evidence | Blocks what |
| --- | --- | --- | --- |
| B1 | **Same-invocation A/B for RFC-045** (task 9.5) | full POST 8.18/9.41 vs 9.91–10.40 — overlapping | Blocks "the recent work made POST N% faster". Needs the pre-change code in a worktree, not a revert of user work |
| B2 | Raw **POST** floor | raw entry is GET-only | Blocks "framework cost vs server cost" on POST |
| B3 | Deno body-read A/B (`text()` vs `arrayBuffer()`) | Deno POST 0.69× Hono, GET 0.63×; body code shared with Bun | Blocks "Deno POST gap is caused by the text read" — currently a hypothesis, not a finding |
| B4 | Any serverless/edge latency or cold-start measurement | none exists | Blocks every "fast on serverless/edge" statement |

### C. Valuable, not release-blocking

| ID | Item | Evidence |
| --- | --- | --- |
| C1 | Dynamic-route GET over HTTP | Router cost is only measured in a micro-benchmark (379 ns matcher delta, 88% trie walk, 2% params bag). No HTTP row isolates it |
| C2 | GET with a 5-middleware stack | `inproc-nextrush-mw.ts` exists but **no stage measures it** |
| C3 | POST bodies larger than 1 KB | `BODY_BYTES` env exists; no row uses it |
| C4 | Latency percentiles in the gate | `wire` records throughput only; percentiles required a manual `--latency` run |
| C5 | Real-socket conformance for Node | `runtime-parity` covers Bun, Deno, workerd — not Node |
| C6 | Task 9.7 allocation harness | No JSON-path allocation variant exists; the literal "no settlement promise is allocated" claim is false (the promise remains as the race handle) |

### D. Rejected, obsolete, or out of scope

| Item | Why it stays closed |
| --- | --- |
| Response finalization optimizations (Phase 6) | Best safe variant 1.69%, hard ceiling, below noise |
| Router param trim / radix rewrite | 379 ns delta, 88% is the trie walk; trim projected ≈ 0; radix remains RFC-015-deferred |
| Sharing/caching `Headers` across requests | Rejected — correctness hazard |
| Pre-encoded body bytes | Rejected — measurable cost moved elsewhere, no net win |
| Elysia parity work (uncommitted) | Out of scope for this audit; excluded from all conclusions |
| Bun-specific tricks in shared `runtime` | Would violate runtime independence for no measured win |

### 8.1 Status of tasks 9.5, 9.7, 10.2 — resolved without fabrication

- **9.5 — open, and not performable as written.** The change is committed; a CPU-pinned per-phase A/B
  requires the pre-change arm. Reverting user work is forbidden. The correct next step is a dedicated
  worktree at `b5387bde` (the parent of `33f1ac17`) running the same `inproc` protocol, then comparing.
  Until that exists, the claim stays unproven.
- **9.7 — open, and the literal claim is wrong.** No JSON-path allocation instrument exists. `dispatch.then`
  always allocates the settlement promise; it is retained deliberately as the race handle. The
  `Uint8Array`-free claim *is* pinned by path-selection tests (`bufferLimit` stays `undefined`). Task text
  needs rewording by a human, not a checkbox.
- **10.2 — blocked** behind 9.5, as the change's own gate requires.

---

## 9. Corrections made during this audit

Two documentation claims did not match the evidence and were fixed (docs only, no code):

1. **RFC-045 §3.2 and §14.1, and ADR-0033** presented `6.07 → 3.77 µs` as the change's measured result
   and as a "committed probe". Corrected to: a side-by-side *variant headroom* comparison between
   `bodySource.json()` and native `request.json()`, not a before/after, with the variants absent from the
   repository and the shipped `text()` + `JSON.parse` path never isolated-measured.
2. **Timeout race cost** was reported as "0.18 µs and ≈0 µs … below this harness's resolution". Today's
   staged run measures **0.76 µs** (`inproc.nextrush.us` 4.40 vs `no-timeout` 3.64). Corrected to a
   measured spread of 0.15–0.76 µs across runs, i.e. resolvable but unstable.

No budget was changed. No implementation code was touched.

---

## 10. Reproduction

```bash
# Exact revision + tree state
git rev-parse HEAD; git status --short --branch

# In-process GET/POST per runtime (best of 3)
node apps/benchmark/scripts/dev-check/check.mjs inproc --rt bun
node apps/benchmark/scripts/dev-check/check.mjs inproc --rt node
node apps/benchmark/scripts/dev-check/check.mjs inproc --rt deno

# Real HTTP throughput (median of 3, needs wrk)
node apps/benchmark/scripts/dev-check/check.mjs wire --rt bun
node apps/benchmark/scripts/dev-check/check.mjs wire --rt node
node apps/benchmark/scripts/dev-check/check.mjs wire --rt deno

# Cold start (median of 7 processes)
node apps/benchmark/scripts/dev-check/check.mjs cold --rt bun
node apps/benchmark/scripts/dev-check/check.mjs cold --rt node

# Correctness + known failures (FB-03 shows as KNOWN on Deno)
node apps/benchmark/scripts/dev-check/check.mjs probe --rt bun
node apps/benchmark/scripts/dev-check/check.mjs probe --rt deno
node apps/benchmark/scripts/dev-check/check.mjs edge

# CPU attribution for the POST path
node apps/benchmark/scripts/dev-check/check.mjs profile --entry inproc-nextrush-post --rt bun

# Full gate (bundle + cold + inproc + probe + bookkeeping + hygiene)
node apps/benchmark/scripts/dev-check/check.mjs
```

Latency percentiles (the manual step in §2.4) — build the same artifacts the harness builds, then:

```bash
bun apps/benchmark/scripts/dev-check/lib/build.ts \
  apps/benchmark/scripts/dev-check/entries/serve-nextrush.ts /tmp/nr.js bun
PORT=4510 bun /tmp/nr.js &
taskset -c 4-7 wrk --latency -t2 -c64 -d3s http://127.0.0.1:4510/
```

Supporting artifacts: `report/performance/{bun-native-gap-analysis,bun-body-read-baseline,
bun-request-path-baseline,bun-context-response-phase2,bun-body-parse-phase3,bun-async-dispatch-phase4,
bun-response-finalization-phase6,perf-program-closure}.md`, `report/router/route-params-profile.md`,
`docs/RFC/runtime-adapters/045-*.md`, `docs/adr/ADR-0033-*.md`,
`apps/benchmark/scripts/dev-check/budgets.json`, `.github/workflows/ci.yml`.

---

## 11. Limitations — what this audit did not establish

- **One machine, one session.** A shared 8-core laptop-class host. Absolute rps is host-specific; only
  the *ratios measured in the same run* are defensible.
- **Server processes were not CPU-pinned** (only the `wrk` client was, to cores 4–7). Background load can
  move absolute numbers several percent; that is why every claim rests on median/best-of-3 and why a 2–6%
  delta is called noise.
- **`c=64` latency percentiles are queueing percentiles,** not single-request service times.
- **No platform-level serverless/edge measurement.** The `edge` stage proves behaviour in `workerd`, not
  latency or cold start of a deployed function.
- **No same-invocation A/B for RFC-045.** Its effect on the complete POST path is not established.
- **No POST raw floor,** so POST framework-vs-server cost cannot be separated.
- **The tree is dirty.** Vitest 5 and the Elysia arm are uncommitted; the runs used the working tree.
- **Deno's gap is attributed only by elimination** (its GET path, which touches no body code, is equally
  behind). The body-read hypothesis is untested.

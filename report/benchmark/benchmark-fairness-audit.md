# Benchmark Fairness & Methodology Audit — NextRush v3 Suite

**Scope:** `apps/benchmark` — all 7 server implementations, 13 scenarios, the orchestrator, the
parity gate, the load-tool adapters, and the scoring/publishability logic.
**Question asked:** is every framework measured under identical workload and runtime conditions?
**Date:** 2026-07-30 · **Commit:** `7b76ac0` (`feat/dev`) · **Auditor stance:** adversarial, evidence-first.

This is a fairness audit, not a performance report. No framework was optimized and no benchmark
number here is a performance claim.

---

## 0. Remediation Status (added 2026-07-30, after the audit)

The blocking findings were fixed in the same session and re-verified live. Findings below are kept in
full — the evidence is what justifies each fix — with status prefixed.

| Finding | Status | Verification |
| --- | --- | --- |
| F-01 Express ETag | **FIXED** — `app.set('etag', false)` | Live probe: no `etag` header on any scenario; parity gate green |
| F-02 `large-post` breaks the publishability gate | **FIXED** — `maxConnections: 8` on the scenario, applied in both measurement loops and in warmup | Rotated 6-framework run at c[1,64], 10s, 3 runs: **0 socket timeouts, `publishable: true`** |
| F-03 Fastify 72s keep-alive | **FIXED** — `KEEP_ALIVE_TIMEOUT_MS = 5000` passed explicitly by all six servers | Live: `Keep-Alive: timeout=5` everywhere; idle-close probe now ~6s on all six (was 9s+ for Fastify) |
| F-06 Hono bypassed `c.json()` | **FIXED** — `c.json(obj, status, JSON_HEADERS)` restores the real helper while keeping charset parity | Bodies still byte-identical to raw-node on all like-for-like scenarios |
| F-08 Listen address family split | **FIXED** — `LISTEN_HOST = '127.0.0.1'` bound by all six and targeted by the load generator and readiness poll | `ss -tln`: `127.0.0.1:8080` for all six, backlog 1024 |
| **New control** — full response-header-set parity | **ADDED** — `checkHeaderSetParity` wired into the gate for every `identicalWork` scenario | 7 unit tests; would have caught F-01 and F-03 automatically |
| F-04 `nextrush-v3-class` missing 3 endpoints | **OPEN** — deliberately deferred; the class server is not in `DEFAULT_FRAMEWORKS`, so `--compare` never runs it | — |
| F-05 route-registration order · F-07 scenario weighting · F-09..F-15 | **OPEN** | — |

Also still open by deliberate choice: **NextRush's per-request timeout race and `server.timeout = 30_000`
were left enabled.** Disabling them would equalize conditions but would remove a real cost from the
one framework under test — i.e. it would bias in NextRush's favour. It stays, and stays disclosed.

Full unit suite after the changes: **213/213 pass.**

---

## 1. Executive Summary

The harness is **materially more rigorous than most published HTTP framework benchmarks**: it has a
real pre-flight parity gate that boots every server and compares response bytes, a shared payload
module that makes body drift structurally impossible, position-rotation to counterbalance a measured
order effect, computed (not declared) publishability, and invalid-run exclusion. Those are not
cosmetic — they are the controls most public benchmarks omit entirely.

It is still **not publishable today**, for four reasons found by direct measurement rather than code
reading:

1. **Express does strictly more work than every other server on every like-for-like scenario.** It
   emits an `ETag` header — SHA-1 over the full response body, per request — that no other server
   emits. Measured cost on this host: **−12% to −16% RPS** on `/json` and `/large-json`. The parity
   gate cannot see it, because it compares `Content-Type` and `Content-Length` but never the full
   header set.
2. **No run can currently be stamped publishable at all.** The `large-post` scenario saturates past
   `wrk`'s 2 s default socket timeout at c ≥ 64 on *every* framework (measured: 17–25 timeouts in
   5 s), and `derivePublishable` fails any run with a single socket timeout. `standard` and `full`
   both include `large-post` and c = 64+. The gate is currently unsatisfiable by construction.
3. **Fastify runs with a 14× longer keep-alive timeout than every other server** (72 000 ms vs
   5 000 ms) — Fastify's own default, never equalized, never disclosed, and not covered by the parity
   gate, which checks only the TCP accept-queue backlog.
4. **`nextrush-v3-class` is missing 3 of 13 endpoints.** `/send-object`, `/static/bench.txt`, and
   `/large-post` return 404. The README documents a class-vs-functional comparison workflow that
   cannot pass the suite's own parity gate.

Two structural issues also limit interpretation even after those are fixed: `large-post` is
bandwidth/`JSON.parse`-bound (~230 MB/s of loopback ingest, framework overhead is noise) yet carries
the same ranking weight as `hello-world`; and Express/Koa use linear router layer scans, so a
scenario's cost inside those two frameworks depends on where its route sits in the registration
order — which differs from raw-node's `if`-chain order.

**Anti-cheating result: clean.** I searched for framework detection, benchmark-only branches, cached
or precomputed responses, and skipped work. There is none. Every server serializes per request from a
shared frozen payload module. The per-framework special-casing that exists is the *equalizing* kind.
The problems in this suite are **omissions in the checkers**, not manipulations in the servers.

**Prior work:** `report/benchmark/benchmark-engineering-audit-review.md` already covers the
`static-file` header divergence, backlog inheritance, position control, and asymmetric keep-alive
*disclosure*. Findings F-01, F-02, F-03, F-04, F-06, F-07 and F-08 below are new; F-05 and F-09
extend existing entries with measurement.

---

## 2. How This Was Verified

Nothing below is inferred from file similarity. Three independent evidence sources:

| Method | What it produced |
| --- | --- |
| Source read of all 7 servers, 4 config files, 12 harness modules | Declared behavior, route registration order, parser limits |
| **Live probe** — booted each server under the harness's own flags/env, then `ss -tln` + all 13 endpoints captured (status, full header set, body SHA-256, byte count) + a raw-socket idle-close timer | Actual listen address, effective backlog, real header sets, real bodies, real keep-alive behavior |
| **Two `wrk` A/B measurements** on this host | ETag cost magnitude; `large-post` timeout behavior and RSS |
| Graph queries (`codebase-memory-mcp`) into `@nextrush/adapter-node` | NextRush's own server construction and per-request timeout mechanism |

Probe scripts are at `/tmp/nr-bench-audit/` (`probe.mjs`, `analyze.mjs`, `etag-ab.mjs`) and are
re-runnable. Host: Intel i5-8300H (4C/8T mobile), Node v26.5.1, wrk 4.2.0, unpinned.

### Explicitly NOT verified

State these as unknown rather than assumed:

- **Magnitude** of the Fastify keep-alive divergence under sustained load — not measured.
- **Magnitude** of the IPv4-vs-dual-stack listen-socket difference — not measured.
- **Magnitude** of the Express/Koa route-position effect — not measured.
- **Rotation's actual efficacy** at cancelling the documented position bias — I did not re-run the A/B
  that motivated it.
- **The autocannon path** — every measurement here used `wrk`. autocannon's in-process behavior is
  untested by this audit.
- **A full `standard`/`full` profile run** (~6–27 h) was not executed. All timing figures here are
  short, single-box, indicative — never publishable.
- **CPU governor, turbo state, thermal state, load average** — not captured by the harness and not
  captured by me.

---

## 3. Request Pipeline — What Each Framework Actually Does

```mermaid
sequenceDiagram
    participant W as wrk (C process)
    participant K as Kernel (loopback, backlog 1024)
    participant S as Server process (node --expose-gc --max-old-space-size=512, NODE_ENV=production)
    W->>K: TCP connect + HTTP/1.1 request (pipelining=1)
    K->>S: accept
    Note over S: Route match — tree (Fastify/Hono/NextRush) vs linear layer scan (Express/Koa) vs if-chain (raw-node)
    Note over S: Middleware — only on /middleware (5 layers); body parser only on POST routes
    Note over S: Handler → shared frozen payload from servers/_shared/payloads.js
    Note over S: Serialize — JSON.stringify per request (no schema serializers anywhere)
    S->>W: Response
    Note over S: Express additionally: SHA-1(body) → ETag  ← unequal work
    Note over S: NextRush additionally: setTimeout(30s) + clearTimeout per request  ← unequal work
```

Verified equal at every stage except the two annotated ones and the per-framework mechanisms the
suite already discloses (`middleware-stack`, `error-handling`, `static-file`).

---

## 4. Payload Fairness

**Request side: clean.** All 13 scenarios are declared once in `config/scenarios.js` and the wrk Lua
script is *generated from that declaration* (`buildWrkPostScript`), so the sent body cannot drift from
the declared body — this closes the prior audit's P0-001. Verified: `large-post`'s generated script is
1 742 654 bytes, and every server's response reports `itemCount: 16969`, i.e. the full 1.5 MiB body
arrived and was parsed. `checkRequestBodyFidelity` enforces this mechanically.

**Response side: one real divergence.** Body SHA-256 across all 7 servers, from the live probe:

| Scenario | Bytes | Bodies identical? |
| --- | --- | --- |
| hello-world | 25 | ✅ all 7 |
| json-serialize | 86 | ✅ all 7 |
| route-params | 66 | ✅ all 7 |
| query-string | 506 | ✅ all 7 |
| post-json | 117–119 | ✅ all 7 (after normalizing the random id / timestamp; length varies only by the id's digit count, declared via `variableLength`) |
| deep-route | 47 | ✅ all 7 |
| middleware-stack | 30 | ✅ all 7 |
| large-json | 4 416 | ✅ all 7 |
| empty-response | 0 | ✅ all 7 |
| send-object | 33 | ✅ 6 · ❌ nextrush-v3-class (404) |
| large-post | 35 | ✅ 6 · ❌ nextrush-v3-class (404) |
| error-handling | 33 vs **21** | ❌ Koa returns `Internal Server Error` as `text/plain` (disclosed, `identicalWork:false`) |
| static-file | 36 body / 199–328 total | ❌ header sets diverge (disclosed) |

**Response headers are NOT identical, and the gate does not check them.** `validate-parity.js`
compares body, `Content-Type`, `Content-Length`/framing, the five middleware headers, and backlog.
It never diffs the full header set. That blind spot is what hides F-01.

Probe output, `hello-world` (representative of all 10 like-for-like scenarios):

```
hello-world · express     EXTRA:   etag
hello-world · fastify     VALUE:   keep-alive: "timeout=72" vs ref "timeout=5"
```

**Not exercised at all** (coverage gap, not unfairness): cookies, `application/x-www-form-urlencoded`,
`multipart/form-data`, `text/plain` request bodies, binary bodies, compressed
request/response bodies, custom request headers beyond `Content-Type`, and query strings with
repeated/nested/array keys. The suite tests JSON and one static text file. Any claim about
"body parsing" is a claim about JSON parsing only.

---

## 5. Endpoint Parity

All 13 scenario endpoints exist on all six default frameworks with the correct status — verified live,
not assumed. Two findings.

**`nextrush-v3-class` exposes 10 of 13** (F-04). Live status matrix:

```
send-object    raw-node 200  nextrush-v3 200  fastify 200  express 200  koa 200  hono 200  class 404
static-file    ...                                                                        class 404
large-post     ...                                                                        class 404
```

The class server never imports `SEND_OBJECT_BODY` or `largePostResponse`, and registers no static
route. It also emits `content-type: text/plain; charset=utf-8` on the 204 `/empty` response, which the
functional path does not.

**Route-table shape differs in ways the gate ignores** (F-06/F-07):

| Server | Static route form | Extra routes present |
| --- | --- | --- |
| raw-node | exact string `=== '/static/bench.txt'` | — |
| nextrush-v3 | `router.get('/static/*')` — wildcard in the radix tree | `/__elu-sample` (diagnostic; excluded from scenarios and from the parity probe) |
| fastify | `@fastify/static` at prefix `/` → **`GET /*` catch-all**, plus `exposeHeadRoutes:true` registers a HEAD route per GET | HEAD routes double the table |
| express | `app.use('/static', …)` — a **middleware layer**, registered *before* `/middleware`, `/error`, `/empty` | — |
| koa | `router.get('/static/*filepath')` | — |
| hono | `app.use('/static/*', …)` — middleware layer | — |

The prior audit already noted the middleware-vs-route split. New here: Fastify's catch-all wildcard
and doubled HEAD table, NextRush's extra diagnostic route in the tree, and the *ordering* consequence
below.

---

## 6. Sync vs Async Consistency

Verified per scenario. All six default servers use a synchronous handler for the eight simple JSON
scenarios; every middleware layer is deliberately written in sync form with an in-source rationale
(Koa: "the async form allocates an extra promise + state machine per layer"; Fastify: sync
`done`-callback hook rather than an `async` hook; Hono: same). This is careful work and it is correct.

Divergences that remain:

- **NextRush wraps every request in a timeout race.** `createHandler` defaults `timeout` to
  `DEFAULT_TIMEOUT_MS = 30_000`, so unless `timeout <= 0` it allocates a `setTimeout` per request and
  `clearTimeout`s it on settle. `serve()` additionally sets `server.timeout = 30_000`. **No other
  server sets `server.timeout`** — Node's default is `0` (disabled). NextRush is therefore measured
  with a request-deadline feature enabled that its competitors do not have at all. This *handicaps*
  NextRush, so it is not a bias in NextRush's favor — but it is an unequal runtime condition, and the
  generated report discloses only NextRush's keep-alive value while never mentioning that the
  timeout mechanism is unique to it.
- **Body-parsing async paths differ by mechanism** (idiomatic, but not identical work): raw-node
  accumulates with `body += chunk` (string rope, no Buffer.concat) and byte-counts against a manual
  cap; Express/Koa/NextRush use their parser middleware with a 5 MB limit; Fastify parses pre-handler
  with `bodyLimit: 5 MB`; **Hono calls `await c.req.json()` with no size limit at all**, so it is the
  only server that skips limit accounting.
- **No scenario exercises** timers, async fs beyond the static file, crypto, a database mock, or
  compression. The audit checklist's async matrix is largely untested — again a coverage gap.

---

## 7. Middleware Fairness

Genuinely well controlled, and honestly labelled. `MIDDLEWARE_HEADERS` is a single frozen array of
five headers shared by every server; `X-Framework` is deliberately the constant `'bench'` rather than
the framework name so header bytes cannot differ; one layer is dynamic (`Date.now()`, same 13-char
width everywhere). The parity gate asserts all five headers are present with matching values —
verified passing live on all 7 servers.

Mechanisms differ by design and this is disclosed in `scenarios.js`, in the README, and in the
generated `REPORT.md`: Koa/Express/Hono/NextRush middleware chains, Fastify `onRequest` hooks,
raw-node a real 5-function chain (not five inline `setHeader` calls — a genuinely fair choice for a
baseline), and the class path 5 stacked `UseInterceptor` classes. `middleware-stack` is
`identicalWork: false` and excluded from the headline score. **Correct as built.**

**No framework carries unnecessary middleware.** Verified absent everywhere: compression, CORS,
logger (`logger:false`, `app.silent`), cookie parser, request-id, helmet, validation, schema
serializers. Body parsers are attached per-POST-route only, so GET routes pay nothing —
`FAIR-04`'s fix holds. Express's `x-powered-by` is explicitly disabled.

That last point is what makes F-01 a policy inconsistency rather than an oversight: the suite already
accepted the principle of disabling a framework's default response header for byte parity, then
disabled the *cheap* one (`X-Powered-By`, a constant string) and left the *expensive* one (`ETag`, a
SHA-1 over the body) in place.

---

## 8. Runtime & Server Configuration

Equal, verified: Node binary (one spawner, `node` from PATH), V8 flags
(`--expose-gc --max-old-space-size=512`), `NODE_ENV=production`, port 8080, no clustering or worker
threads anywhere, pipelining = 1, no HTTPS/HTTP2, no compression, `maxHeadersCount` untouched
(Node default 2000) everywhere.

**TCP accept-queue backlog: equal and verified from the OS.** `ss -tln` Send-Q = 1024 for all seven
servers. Five pass `LISTEN_BACKLOG` explicitly; the two NextRush servers inherit
`adapter.ts` `DEFAULT_LISTEN_BACKLOG = 1024`, an equality pinned by
`backlog-invariant.test.js` and re-verified live by the gate. This is a genuinely good control — an
unequal backlog is invisible to every response-level check.

**Unequal, and not covered by any gate:**

| Parameter | raw-node | nextrush-v3 | fastify | express | koa | hono |
| --- | --- | --- | --- | --- | --- | --- |
| `keepAliveTimeout` | 5 000 (Node default) | 5 000 (explicit) | **72 000** | 5 000 | 5 000 | 5 000 |
| `server.timeout` | 0 (disabled) | **30 000** | 0 | 0 | 0 | 0 |
| Per-request timeout race | no | **yes** | no | no | no | no |
| Listen address | `*:8080` (dual-stack) | `0.0.0.0` | `0.0.0.0` | `*:8080` | `*:8080` | `*:8080` |
| POST body limit | 5 MiB manual | 5 mb | 5 MiB | 5 mb | 5 mb | **none** |
| Response ETag | no | no | no | **yes** | no | no |

Evidence for the keep-alive row is doubled: the `Keep-Alive: timeout=72` response header on every
Fastify response, and an idle-socket probe — Fastify still open at the 9 s cap while all others closed
at ~6 s. Source confirmation: `fastify/lib/config-validator.js:1265`
`defaultInitOptions = {…"keepAliveTimeout":72000…}`, applied at `lib/server.js:339`.

---

## 9. Serialization

**No framework gets a serialization shortcut.** Verified: no `fast-json-stringify` schemas on Fastify
(so it uses `JSON.stringify`), no precomputed response strings, no cached bodies. `LARGE_JSON` is a
frozen array built once at module load but `JSON.stringify`d per request in all six — I confirmed each
server's response path. Content types were normalized to `application/json; charset=utf-8`
everywhere, including a deliberate fix for Hono's charset-less default, and the gate enforces it.

Two findings:

- **Express serializes and then hashes.** `res.json` → `send` → `etag` package →
  `crypto.createHash('sha1').update(body).digest('base64')`. Confirmed in
  `etag@1.8.1/index.js:39-47` and `express@5/lib/application.js:95` (`this.set('etag', 'weak')`).
- **Hono's own serializer is never exercised.** Every Hono response goes through a hand-written
  `jsonRes(c, obj)` = `c.header(...)` + `c.body(JSON.stringify(obj))`, bypassing `c.json()`. The
  stated reason (charset parity) is legitimate, but the consequence is not: the `send-object`
  scenario exists specifically to measure *"each framework's own response-serialization helper (not a
  pre-serialized string)"*, and for Hono it measures a benchmark-authored helper instead. Hono's
  charset can be preserved *and* the helper kept via `c.json(obj, 200, { 'Content-Type': … })`.

---

## 10. Benchmark Script Audit

**Per-framework parameter symmetry is provably exact** — this is the strongest part of the harness.
Every framework in a run receives the same `passOpts` object: same tool, same connections ladder, same
`-t min(threads, connections)`, same duration, same warmup (framework-level on `/` **plus**
per-scenario warmup on the scenario's own URL and method), same `pauseBetweenTestsMs`, same
`cooldownMs`, same `pipelining=1`, same generated POST script. Output parsing is one function per
tool. Statistics are Bessel-corrected, latency is aggregated as the median of each percentile across
runs, and invalid runs are excluded from the mean rather than merely flagged.

`derivePublishable` computing publishability from what the run *actually did* — rather than trusting
the profile's declaration — is better practice than most benchmark suites have, and rotation being
*required* for a cross-framework ranking is a correct, unusually honest gate.

Three defects at the suite level (not per-framework asymmetries):

1. **The publishability gate is currently unsatisfiable** (F-02, detail in Findings).
2. **A socket timeout invalidates the whole run's publishability but not the cell it occurred in.**
   `isInvalidRun` checks only `errors.nonOk`; a cell with 25 timeouts is still averaged, ranked, and
   awarded points. So the timed-out `large-post` number is reported and scored while simultaneously
   being the reason the run is unpublishable.
3. **Ranking weights every scenario equally regardless of discriminating power.** `large-post` at
   ~140–165 RPS is dominated by 1.5 MiB of loopback transfer plus `JSON.parse`; framework dispatch
   overhead is a rounding error in that cell, yet it contributes the same point spread as
   `hello-world`, where dispatch is nearly the whole cost. `rankEntries`'s `≈` noise-tie rule
   mitigates this only when stddevs are large.

`wrk`'s socket timeout is left at its 2 s default and `--timeout` is never passed — identical for all
frameworks, so not a bias, but it is the threshold that makes defect 1 bite.

---

## 11. Feature Parity

Comparable abstractions, verified: every framework's router is used through its own public API
(`fastify.get`, `app.get`, `router.get`, `app.get`), every parameter is extracted through the
framework's own accessor (`req.params` / `ctx.params` / `c.req.param()`), every query through its own
query accessor. No framework is being driven at a lower level than another — except raw-node, which
*is* the point of a baseline.

One caveat the reports should state and don't: **`identicalWork: true` means identical response
bytes, not identical internal work.** raw-node has no route table, no context object, and no
parameter-parsing infrastructure; its `/users/:id` is `url.startsWith('/users/')`. "Overhead vs raw
Node" is therefore an upper bound on framework cost, not a like-for-like mechanism comparison. The
prior audit made this point; it still is not in the generated report.

**Route registration position is an unequalized confound for the two linear-scan routers** (F-07).
Express and koa-router walk their layer arrays in registration order; Fastify, Hono and NextRush use
prefix trees where order is irrelevant; raw-node uses a hand-written `if`-chain. The orders differ:

| Scenario | Express layer index | raw-node comparison index |
| --- | --- | --- |
| hello-world | 1st | 1st |
| empty-response | ~13th (after the `/static` mount) | 4th |
| query-string | 5th | ~10th |
| deep-route | 6th | ~11th (last) |

So `empty-response` — described in `scenarios.js` as "absolute minimum" — is Express's and Koa's
*most expensive* route to match, while it is raw-node's fourth-cheapest. Cross-framework comparison
within one scenario is still apples-to-apples; **cross-scenario** comparison inside Express/Koa, and
any "which scenario is cheapest" narrative, is confounded. Magnitude unmeasured.

---

## 12. Build Configuration & Dependency Versions

**Build: no asymmetry, by design.** Every server is a plain `.js` ESM file executed directly by
`node` — no TypeScript compilation, no bundling, no minification, no source maps, no transpilation, on
any arm. `type: "module"` throughout; the only CJS is inside the dependencies themselves. NextRush is
consumed as a workspace package (built `dist`), which is the correct comparison target since that is
what a user installs.

The one build-adjacent oddity is documented at length in `nextrush-v3-class.js`: because the harness
has no compile step, TS decorator syntax cannot be used, so the file applies the decorator functions
by hand in the order TS's legacy transform would. The reasoning is sound and the file explains it.
It does not affect fairness — but it is a maintenance hazard, since the hand-applied order must track
TS's transform semantics forever with no compiler to check it.

**Versions: current and pinned exactly** (no `^`/`~`): fastify 5.10.0, express 5.2.1, koa 3.2.1 +
koa-router 14.0.0 + koa-bodyparser 4.4.1 + koa-static 5.0.0, hono 4.12.30 + @hono/node-server 2.0.10,
@fastify/static 10.1.2, autocannon 8.0.0. All are current majors; nothing outdated. `engines.node >= 22`.
NextRush resolves to `4.0.0-beta.0 (workspace)` — note the framework table calls it "v3" while the
recorded version is 4.0.0-beta; cosmetic, but a reader comparing artifacts will trip on it.

One provenance gap: the stored run records `Node v26.4.0` while this host now runs v26.5.1. The
harness records the version, which is the right behavior — but it means stored artifacts are not
comparable to a re-run today without noting the runtime changed.

---

## 13. Fairness Scores (0–10)

Scored against "is this framework measured under the same conditions as the others", not against
performance. **Benchmark-Script Fairness is a suite-level constant** — the parameters are provably
identical per framework, so it is the same score for everyone; the deduction is for the three
suite-level validity defects in §10, and inflating per-framework variance there would be fiction.

| Framework | Payload | Middleware | Runtime | Endpoint | Config | Serialization | Bench Script |
| --- | --: | --: | --: | --: | --: | --: | --: |
| raw-node | 10 | 8 | 10 | 8 | 8 | 10 | 7 |
| nextrush-v3 | 10 | 9 | **6** | 8 | 8 | 10 | 7 |
| fastify | 10 | 8 | **5** | 7 | **5** | 10 | 7 |
| express | 10 | 9 | 9 | 7 | **5** | **5** | 7 |
| koa | 9 | 9 | 9 | 8 | 9 | 8 | 7 |
| hono | 9 | 9 | 9 | 8 | 8 | **5** | 7 |
| nextrush-v3-class | 7 | 9 | 6 | **2** | 7 | 9 | 7 |

**Justifications**

- **raw-node** — Payload 10 (it is the reference; bodies verified identical). Middleware 8: a real
  5-function chain is a fair baseline, but it is a hand-rolled mechanism, correctly labelled
  non-like-for-like. Endpoint 8: all 13 present, but exact-string matching in an `if`-order that
  differs from every other server, and static serving is `readFile` with no `stat`. Config 8:
  dual-stack listen socket. Serialization 10: explicit `Content-Length` + charset, per-request
  `stringify`.
- **nextrush-v3** — Runtime **6**: the only server with `server.timeout` enabled *and* a per-request
  `setTimeout`/`clearTimeout` race; a real, unequal, undisclosed per-request cost (against itself).
  Endpoint 8: wildcard static route plus an extra `/__elu-sample` route in its tree that no competitor
  has (excluded from scenarios and from the probe — verified). Config 8: backlog inherited implicitly
  rather than passed, and an IPv4-only bind while four others are dual-stack.
- **fastify** — Runtime/Config **5**: `keepAliveTimeout` 72 000 vs 5 000 everywhere else, measured two
  ways, uncontrolled and undisclosed. Endpoint 7: `@fastify/static` at prefix `/` installs a `GET /*`
  catch-all and `exposeHeadRoutes` doubles the route table. Serialization 10: no schema serializers,
  plain `JSON.stringify`, correct charset.
- **express** — Serialization **5** and Config **5**: SHA-1 ETag over every response body, measured at
  −12% to −16% RPS, while the far cheaper `X-Powered-By` default *was* disabled for byte parity. The
  inconsistency of that policy is the finding. Endpoint 7: static as a middleware layer positioned
  ahead of three scenario routes, in a linear-scan router.
- **koa** — Payload 9 / Serialization 8: identical on all 10 like-for-like scenarios, but its
  `error-handling` response is 21 bytes of `text/plain` versus 33 bytes of JSON, i.e. **zero
  serialization work** — correctly declared `identicalWork:false` and excluded from the headline, so
  the deduction is small. Endpoint 8: linear-scan ordering, same as Express.
- **hono** — Serialization **5**: `c.json()` is never exercised; a benchmark-authored helper stands in,
  which directly contradicts `send-object`'s stated purpose. Payload 9: the only server with no
  request body-size limit, so it alone skips limit accounting on both POST scenarios.
- **nextrush-v3-class** — Endpoint **2**: 3 of 13 endpoints 404. It cannot pass the suite's own parity
  gate, so the class-vs-functional axis is currently unmeasurable as documented.

---

## 14. Findings by Severity

### CRITICAL

#### F-01 — Express emits an ETag (SHA-1 over the body) on every like-for-like response; measured −12% to −16% RPS

**Current situation.** `express@5` defaults to `etag: 'weak'`
(`lib/application.js:95`). `res.json` → `send` → `etag@1.8.1` →
`crypto.createHash('sha1').update(body,'utf8').digest('base64')`. No other server emits `ETag` on any
JSON scenario. The benchmark explicitly disables `x-powered-by` for byte parity but leaves `etag` on.

**Evidence.** Live probe, `EXTRA: etag` on express for hello-world, json-serialize, route-params,
query-string, post-json, deep-route, middleware-stack, error-handling, large-json, send-object,
large-post. A/B on this host (5 s, c64, t4, two interleaved reps, warmed):

| Route | ETag ON | ETag OFF | Cost |
| --- | --: | --: | --: |
| `/json` (86 B) | 18 481 / 18 301 | 22 002 / 20 749 | **−14.0%** mean |
| `/large-json` (4 416 B) | 13 293 / 12 963 | 15 644 / 14 774 | **−13.7%** mean |

p99 also degrades (4.55→3.72 ms; 7.17→5.06 ms). Indicative magnitude, single box, not publishable.

**Impact.** Express is handicapped by roughly the size of the gap that separates mid-field frameworks,
in **every** scenario that feeds the headline like-for-like score. The parity gate cannot detect it
because it compares only `Content-Type` and `Content-Length`. Every published Express ranking from
this suite is biased downward by an amount larger than the suite's own noise threshold.

**Recommendation.** Either (a) `app.set('etag', false)` — consistent with the existing
`x-powered-by` decision, and the option this auditor recommends; or (b) keep it and have every other
server emit an equivalent ETag; or (c) keep it, and have `validate-parity.js` **fail** on any
full-header-set divergence for an `identicalWork` scenario, forcing the choice to be explicit. Do not
leave it silent. Extending the gate to diff the full header set is required regardless of which option
is chosen — it is the control that was missing.

**Priority:** fix before any Express number is published. **Migration difficulty:** one line + one gate
extension.

#### F-02 — The publishability gate is unsatisfiable: `large-post` produces socket timeouts on every framework at c ≥ 64

**Current situation.** `derivePublishable` returns `publishable: false` if **any** cell recorded a
single socket timeout. `wrk`'s socket timeout is left at its 2 s default. `large-post` sends a
1.5 MiB body; `standard` = c[1,64,256] and `full` = c[1,64,256,512] both include it.

**Evidence.** `wrk -c64 -t4 -d5s` with the suite's own generated 1.74 MB Lua script:

| Server | RPS | Non-2xx | Socket timeouts | RSS after |
| --- | --: | --: | --: | --: |
| raw-node | 164.6 | 0 | **17** | 262 MB |
| express | 153.6 | 0 | **25** | 254 MB |
| fastify | 140.4 | 0 | **18** | 257 MB |
| nextrush-v3 | 128.6 | 0 | **22** | 255 MB |

**Impact.** Any `standard`/`full` run will be stamped NOT publishable for a reason unrelated to
framework quality. Combined with the README's claim that those profiles *are* publishable, the likely
operator response is to bypass the gate — which is worse than not having it. Secondary impact: RSS
reaches ~255 MB of the 512 MB `--max-old-space-size` cap at only c=64, so at c=256/512 this scenario
will measure GC and allocator behavior under heap pressure, unequally across frameworks with different
baseline heaps (a risk `constants.js` already flags in the abstract).

**Recommendation.** Decide what `large-post` is *for*. Options, in preference order: (1) restrict it to
low concurrency (c ≤ 8) where 1.5 MiB bodies do not queue past 2 s, and exclude it from the headline
score as a bandwidth-bound probe; (2) pass an explicit `wrk --timeout` sized for the scenario and treat
its timeouts separately from the global gate; (3) shrink the body to ~1 MiB + 1 byte, which still tests
"above the 1 MB default" without 230 MB/s of loopback ingest. Also make timeouts invalidate the *cell*
they occur in (`isInvalidRun`), not just the run's publishability flag.

**Priority:** highest — nothing can be published until this is resolved. **Difficulty:** config-level.

### MAJOR

#### F-03 — Fastify's keep-alive timeout is 14× everyone else's, uncontrolled and undisclosed

**Evidence.** `Keep-Alive: timeout=72` on every Fastify response vs `timeout=5` on all others;
idle-socket probe: Fastify still open at the 9 s cap, all others closed at ~6 s;
`fastify/lib/config-validator.js:1265` `keepAliveTimeout: 72000`.
**Impact.** Under any load pattern where a socket idles longer than 5 s — inter-run gaps, queueing at
high concurrency, the tail of a saturated run — the five 5 s servers close and force reconnects while
Fastify reuses. Magnitude unmeasured; direction favors Fastify. Also one extra response byte per
request. The generated report discloses *NextRush's* effective keep-alive and not the competitors', so
the one server whose value is published is the one that is not the outlier.
**Recommendation.** Add `keepAliveTimeout` to the equalized set in `constants.js`, pass it explicitly
in all six servers, read it back per server, and add it to the parity gate alongside the backlog
check. Replace `captureNextRushEffectiveOptions` with the already-written, framework-agnostic
`captureEffectiveServerOptions` for all servers.

#### F-04 — `nextrush-v3-class` is missing 3 of 13 endpoints, so its documented workflow cannot pass the gate

**Evidence.** Live 404 on `/send-object`, `/static/bench.txt`, `/large-post`; the file imports neither
`SEND_OBJECT_BODY` nor `largePostResponse`; extra `content-type` on its 204.
**Impact.** `pnpm bench:validate nextrush-v3 nextrush-v3-class`, documented in the README, will abort.
The gate behaving correctly is good; the README advertising a broken workflow is not. The class-vs-
functional overhead axis — the one NextRush publishes about its own DI path — is currently unmeasurable
as documented.
**Recommendation.** Add the three routes through the class path's idiomatic mechanisms, and drop the
stray 204 content-type. Add a test asserting that every framework in `FRAMEWORKS` answers every
scenario in `SCENARIOS`, so a missing endpoint fails at `pnpm test` rather than at benchmark time.

#### F-05 — Route-registration position confounds cross-scenario comparison in the two linear-scan routers

**Evidence.** Registration order read from `express.js` and `koa.js` vs `raw-node.js`'s `if`-chain;
`empty-response` is ~13th in Express (behind the `/static` mount) and 4th in raw-node.
**Impact.** Within-scenario cross-framework comparison is unaffected. Cross-scenario claims inside
Express/Koa, and any "cheapest scenario" narrative, are confounded by an arbitrary harness choice.
**Recommendation.** Register routes in the same order in every server, derived from `SCENARIOS` order,
and put the static mount last. Then state in the report that Express/Koa are linear-scan routers so
per-scenario cost still varies with position, and that the position is now equalized.

#### F-06 — Hono's own serializer is never measured, contradicting `send-object`'s stated purpose

**Evidence.** `servers/hono.js` `jsonRes()` replaces `c.json()` on all 11 JSON routes, including
`/send-object`, whose declared purpose is to dispatch "through each framework's own
response-serialization helper (not a pre-serialized string)".
**Impact.** For Hono, `send-object` measures benchmark-authored code. Direction of bias unknown
(`c.json()` does roughly the same work), which is precisely why it should not be guessed.
**Recommendation.** Use `c.json(obj, status, { 'Content-Type': 'application/json; charset=utf-8' })` to
keep both charset parity and the real helper path; verify the resulting bytes with the existing gate.

#### F-07 — `large-post` and `large-json` carry full ranking weight while measuring transfer, not framework overhead

**Evidence.** `large-post` at ~140–165 RPS × 1.5 MiB ≈ 230 MB/s of loopback ingest; the four servers
land within 28% of each other with `JSON.parse` dominating. `buildOverall` awards identical point
spreads per scenario per level regardless.
**Impact.** The headline like-for-like score is diluted by cells that cannot discriminate the thing it
claims to rank. **Recommendation.** Either weight scenarios by discriminating power, or split the
headline score into "dispatch-bound" and "payload-bound" groups and publish both.

### MINOR

- **F-08 — Listen address family is not equalized.** `ss -tln`: `nextrush-v3`, `nextrush-v3-class`,
  `fastify` bind `0.0.0.0` (AF_INET); `raw-node`, `express`, `koa`, `hono` bind `*` (AF_INET6
  dual-stack). Magnitude unmeasured but nonzero; more importantly it is a reproducibility landmine —
  on a host whose resolver returns `::1` first for `localhost`, the three IPv4-only servers become
  unreachable and the run fails at startup. Fix: bind `127.0.0.1` in all servers and target
  `127.0.0.1` in `BASE_URL`/`buildUrl`.
- **F-09 — Hono has no request body-size limit** while the other five cap at 5 MB, so it alone skips
  limit accounting on both POST scenarios.
- **F-10 — raw-node accumulates POST bodies as a string** (`body += chunk`), a different algorithm from
  every framework parser's Buffer path, at 1.5 MiB. It measured *fastest*, so this is a disclosure item
  rather than a handicap.
- **F-11 — `X-Timestamp` is regenerated per request** in all servers (correct), but `Date.now()`
  produces a 13-character value only until the year 2286 — the parity gate's byte-equality assumption
  is safe, worth a comment, not a change.
- **F-12 — README internal inconsistency.** "Byte-identical bodies — for the **8** identical-work
  scenarios" contradicts "**10** are like-for-like" and `scenarios.js` (10 `identicalWork:true`).
- **F-13 — README references files that do not exist**: `BENCHMARK_AUDIT_REPORT.md` "in this folder",
  `reports/investigations/cpu-allocation-profiling-results.md`, `results/HISTORY.md`,
  `results/baseline/`. The real audit lives at repo root `report/benchmark/`.
- **F-14 — Framework label vs recorded version.** Table says "NextRush v3"; provenance records
  `4.0.0-beta.0`.
- **F-15 — Stale artifacts.** `results/latest` is a `quick`, 1-run, single-level (c512), 5 s,
  `positionControl: "fixed"` run — correctly stamped `publishable: false`, and the README correctly
  withdraws published numbers. No action beyond not citing it.

### SUGGESTIONS

1. **Extend `validate-parity.js` to diff the full response header set** for every `identicalWork`
   scenario, with an explicit allow-list for headers a framework is permitted to add. This single
   change would have caught F-01 and F-03 automatically, and is the highest-leverage item in this
   report.
2. **Add a server-construction parity check** beside the backlog one: keep-alive timeout,
   `server.timeout`, `headersTimeout`, `requestTimeout`, and listen address family, read back from the
   live server rather than trusted from source.
3. **Add a scenario-coverage test** asserting every `FRAMEWORKS` entry answers every `SCENARIOS` entry
   (catches F-04 at `pnpm test`).
4. **Record environment health** in `getSystemInfo()`: load average, CPU governor, thermal/turbo state.
   On a mobile i5-8300H these dominate the variance the suite is trying to measure.
5. **Broaden coverage honestly**: either add urlencoded / multipart / cookie / compressed / async-IO
   scenarios, or state in the README that the suite measures JSON request/response paths and one static
   text file, so no reader over-generalizes "body parsing".
6. **Disclose the raw-node caveat in the generated report**, not only in the audit: `identicalWork`
   means identical response bytes, not identical internal work, so "% overhead vs raw Node" is an upper
   bound.
7. **Disclose NextRush's per-request timeout race** in the generated report's framework-configuration
   table — it is a feature no competitor has enabled, and saying so is both more honest and favorable
   to NextRush.

---

## 15. Final Verdict

**Are these benchmarks fair?** The *harness* is close to fair and better engineered than most public
framework benchmarks — the parity gate, the shared payload module, generated POST scripts, rotation,
computed publishability, and invalid-run exclusion are real controls, and the anti-cheating audit came
back clean. But three unequalized work/config differences survive it (F-01, F-03, F-06) and one of
them is measured at 12–16% RPS. So: **not fair today, fairly cheap to make fair.**

**Can they be published publicly?** No — and not only for the reasons above. As built, no
`standard`/`full` run can even earn `publishable: true` (F-02). The repository has already withdrawn
its published figures pending clean re-measurement, which was the correct call and should stand until
F-01, F-02, F-03 are closed.

**Would an experienced performance engineer trust these results?** They would trust the *methodology*
more than they trust most published comparisons, and they would reject the *current numbers* on
environment grounds before reaching the parity issues: a 4-core/8-thread mobile CPU with turbo and
thermal variability, client and server sharing all 8 logical cores unpinned, and the retained artifact
being a single 5 s run at one concurrency level. Fix the parity issues, then re-measure pinned
(`--pin` / `--client-pin` already exist) with `full` + rotation before showing anyone a ranking.

**Are there hidden sources of bias?** Yes, six, all now measured or located: Express's ETag
(quantified, −12 to −16%); Fastify's 72 s keep-alive (confirmed, magnitude unknown); route-position
effects in Express/Koa (located, magnitude unknown); NextRush's per-request timeout timer (confirmed,
biases *against* NextRush); listen address-family split (confirmed, magnitude unknown); and the
equal ranking weight given to bandwidth-bound scenarios (structural).

**Which benchmark should be fixed first?** `large-post` — because until its timeouts stop failing the
publishability gate, no amount of other fixing produces a publishable run. Then `json-serialize` and
every other like-for-like scenario, via the one-line Express ETag decision plus the header-set gate
extension.

**What changes are required before publishing?**

1. Resolve the Express ETag divergence and extend the parity gate to diff full header sets. (F-01)
2. Make the `large-post`/timeout interaction coherent; make timeouts invalidate their own cell. (F-02)
3. Equalize and verify `keepAliveTimeout` (and `server.timeout`) across all servers. (F-03)
4. Complete `nextrush-v3-class` or remove its documented workflow from the README. (F-04)
5. Equalize route registration order and listen address family. (F-05, F-08)
6. Restore Hono's own `c.json()` path. (F-06)
7. Re-measure with `--profile full --rotate --pin --client-pin` on an idle host, and publish only what
   `derivePublishable` stamps `true`.

Items 1–3 are the gate to publication. Items 4–7 are the gate to the suite being trustworthy for the
next reader who does not have this report in hand.

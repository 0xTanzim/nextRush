# Bun Async and Middleware Overhead — Phase 4

**Scope:** explain the ~2.5 µs residual between isolated body-read/parser costs and full
body-bearing dispatch, then adjudicate the two Phase 3 correctness findings against the
documented contract.

**Authorization:** investigation, tracing, and isolated experiments only. No production file was
modified, no middleware semantics changed, no budget touched. The Phase 1 working tree is
preserved byte-for-byte (verified at the end of this phase).

**Outcome in one line:** the residual is not promise overhead and not middleware dispatch. It is
the per-request timeout race (2–6.5 µs on a real socket) plus transport body delivery (11.0–11.5 µs
of the POST−GET gap over TCP). Neither is reachable from middleware composition, so the
recommendation is **A** for dispatch and a separately-scoped RFC for the race.

---

## 0. Outcome summary

| Question | Answer | Confidence |
|---|---|---|
| Is middleware dispatch the residual? | No. One layer costs 0.3–0.6 µs; resumption after `next()` is below measurement resolution | High |
| Is it promise/microtask overhead? | Not per `await`. The cost is concentrated in one place: the runner's settlement window and the timer it arms | High |
| Where does the 2.5 µs go? | ~1.0–2.3 µs timer path in-process, 3.0–6.5 µs on a socket; ~0.5–0.9 µs read inflation; ~0.5–1.2 µs parse/guard/assign; ~0.3–0.5 µs middleware layer | Medium-high |
| Is it removable at the middleware level? | No. Every measured component is either mandatory or native | High |
| Does raising `SETTLE_TURNS` help real traffic? | No. A socket body read is a macrotask, so no microtask window avoids the timer | High (Phase 1 + independent confirmation here) |
| Phase 3 finding 1 (generic message on repeated read) | **False positive. Retracted.** The specific text is preserved in `cause`, by design and non-enumerably | High |
| Phase 3 finding 2 (`encoding` ignored in the UTF-8 fallback) | **Not a contract mismatch.** No JSON/body-parser API promises it, and JSON is UTF-8 by RFC 8259 | High |

---

## 1. Method and controls

Same machine, same Bun (`1.4.3`), 1 KB JSON body, 1 MiB limit, in-process dispatch through
`createHandler(app)` unless stated otherwise. Every configuration was measured at least twice with
different harness shapes, because this machine's POST arms move between runs.

Five harnesses, each answering one question:

| Harness | Shape | Purpose |
|---|---|---|
| **A — ladder** | per-arm bulk, 6 reps × 10 000, request pool per arm | establish the arm-to-arm shape |
| **B — settle** | 6 reps × 8 000, no forced GC | turn counts and race on/off |
| **C — settle, GC-forced** | 8 reps × 8 000, `Bun.gc(true)` before each arm | isolate GC sensitivity (absolutes rejected, see §3.2) |
| **D — paired** | 250-request blocks × 48, both arms back-to-back off one pool | drift-resistant deltas |
| **E — socket** | pipelined keep-alive, 100-request batches, identical client bytes | real-transport confirmation |

### 1.1 Exact middleware configurations

| Arm | Composition |
|---|---|
| raw handler | `async () => new Response('ok')` — no framework |
| GET no mw | `app.get('/echo')`, zero `app.use` |
| GET 1 noop mw | one `async (ctx, next) => { await next() }` |
| POST unread | `app.post('/echo')`, body never touched, zero middleware |
| POST read-only | one probe middleware: `readBodyText(ctx, limit)` then `await next()` — **same layer topology as `json()`** |
| POST parse-only | one probe middleware: `JSON.parse(constantString)` then `await next()` — isolates parse from read at equal depth |
| POST `json()` | the real parser |
| POST `json({ rawBody: true })` | the real parser, byte path |
| POST `bodyParser()` | the real combined parser (`prechecked` delegation) |

The two probe middlewares exist so the pipeline delta can be split into read and parse **without
subtracting across differently-composed runs**. They are equivalent to `json()` in layer count,
detection, and `next()` handling; they differ only in the operation performed.

### 1.2 Stated uncertainty

- Run-to-run drift is large and asymmetric: in-process POST `json()` measured 7.23, 8.01, 8.83,
  10.22 and 15.25 µs across harnesses for the *same* configuration. GET moved 2.58–3.86. POST is
  roughly 3× more drift-prone than GET.
- Harness C proves why (§3.2): forcing GC before a POST arm inflates it to 12.3 µs. Heap state
  is a first-order variable for POST. Absolutes are therefore reported as ranges across harnesses,
  and conclusions rest on **paired deltas measured inside one harness**.
- Nothing below is a cross-session comparison.

---

## 2. The ladder: what the residual looks like

In-process, 1 KB, medians in µs (harness A, 6 reps × 10 000):

| Arm | median | min | max |
|---|---:|---:|---:|
| raw handler | 0.707 | 0.418 | 0.882 |
| GET no mw | 3.198 | 2.453 | 5.314 |
| GET `bodyParser()` | 3.838 | 3.244 | 4.658 |
| POST unread, no mw | 3.657 | 3.261 | 4.598 |
| POST read-only mw | 6.400 | 5.145 | 8.549 |
| POST parse-only mw | 5.753 | 5.093 | 6.060 |
| POST `json()` | 8.832 | 6.530 | 11.193 |
| POST `json({ rawBody })` | 10.632 | 9.526 | 11.816 |
| POST `bodyParser()` | 7.351 | 7.103 | 9.254 |

Three things this establishes, all of which held in every harness:

1. **A body-bearing request is not more expensive than a bodyless one until the body is touched.**
   POST unread (3.657) ≈ GET no mw (3.198) within drift.
2. **Read and parse each cost far more in the pipeline than in isolation.** Read-only adds +2.74,
   parse-only +2.10, while isolated they cost 0.53 and 1.0 (§5). Both inflate ~3×, so this is not
   a property of either operation.
3. **`json()` vs `bodyParser()` flips sign between phases** (Phase 3: 8.010 vs 8.333; here: 8.832
   vs 7.351). That is a drift artifact, not a finding. It is the reason this phase relies on
   paired measurement.

---

## 3. Tracing the lifecycle

A probe-local replica of `json()` stamps 11 points per request. Two controls run in the same
interleaved session: the real `json()`, and the same replica with stamping compiled out.

### 3.1 Tracing cost is measurable and large

| Arm | median µs/req |
|---|---:|
| replica + 9 stamps | 10.368 |
| replica, no stamps | 6.891 |
| real `json()` | 7.770 |

**Stamping costs 3.48 µs for 9 calls — ~0.39 µs per `Bun.nanoseconds()`.** That is 50% of the
request. Any traced absolute must be corrected, and the replica is validated: no-stamp replica
6.891 vs real `json()` 7.770, a 0.88 µs gap that is within this machine's arm drift.

`Bun.nanoseconds()` being ~0.39 µs is itself a constraint on future work: any per-request
instrumentation at this call count invalidates what it measures. Use it in discovery only.

### 3.2 Segment map (p50 µs)

Raw values include one stamp per boundary (~0.39); corrected values subtract it.

| Segment | raw p50 | corrected | What it contains |
|---|---:|---:|---|
| dispatch start → mw entry | 1.497 | ~1.11 | adapter entry, context construction, composer setup |
| detection (method + content-type) | 0.263 | ~0.00 | `BODYLESS_METHODS.has`, header read, `isJsonContentType` |
| **body read (settle)** | **1.460** | **~1.07** | `readBodyText` → `readTextIfProvenWithin` → `request.text()` |
| **JSON.parse** | **0.779** | **~0.39** | native parse of 1 023 chars |
| strict + depth guard | 0.243 | ~0.00 | `typeof`, `checkJsonDepth` |
| assign → handler entry | 0.458 | ~0.07 | `ctx.body = parsed`, composer advance |
| handler | 0.301 | ~0.00 | `ctx.json({ ok: true })` |
| handler exit → mw resume | 0.353 | ~0.00 | handler return, `await next()` resumption |
| **mw resume → dispatch settle** | **2.993** | **2.99** | composer unwind, response build, timeout race |
| sum | 8.347 | ~5.6 | matches the 6.9 no-stamp total within loop overhead |

Two conclusions:

- **Resumption is free.** Handler exit → middleware resume is 0.35 raw, which is exactly one
  stamp. The "each `await` costs a turn" model is not supported at this resolution. What costs
  is not the number of `await` statements but whether the dispatch is still pending when the
  runner finishes its settle window (§4).
- **The finalize segment is the only large block** (2.99 µs, no stamp inside it, so it is not
  inflation), and it is where the timeout race lives. Segment 1 (1.11 µs) is the second largest
  and is adapter/context work, already measured near-zero for context construction in Phase 2 —
  so it is entry plumbing, not allocation.

### 3.3 Allocation and retention

3 000 JSON POSTs with 1 KB bodies, no retained pool:

| Measure | Value |
|---|---:|
| live heap growth before GC | +44 KiB |
| retained after forced GC | +29 KiB (~10 B/request) |
| transient at sample point | ~5 B/request |

Retention is negligible — no per-request leak. Allocation *volume* is not measurable without a
heap profile, so it is not claimed. The GC effect is established indirectly and strongly by
harness C: `Bun.gc(true)` before a POST arm moved the identical configuration from 7.2 to 12.3 µs
(§4.2). POST timing is GC-mediated; treat any single POST number as conditional on heap state.

---

## 4. The settlement window

`dispatchWithTimeout` gives an already-resolving dispatch `SETTLE_TURNS = 4` microtask turns
before arming `setTimeout` and racing it. That is a **cliff**, not a slope.

### 4.1 Turn counts

Measured in the runner's own currency (`await Promise.resolve()` iterations until the settlement
callback observes completion, which is one turn later than the dispatch itself — the same offset
the runner sees):

| Arm | turns, race on | turns, race off |
|---|---:|---:|
| GET no mw | 4 | 3 |
| GET 1 noop mw | **5** | 4 |
| GET 4 noop mw | 10 | 7 |
| GET 8 noop mw | 14 | 11 |
| POST unread | 4 | 3 |
| POST read-only | **11** | 8 |
| POST `json()` | **11** | 8 |

GET sits **exactly on the boundary** at 4. One middleware pushes it to 5 and arms a timer. POST
always crosses at 11.

This independently reproduces Phase 1's recorded finding ("real GET settles at microtask turn 3
and real POST at turn 8") with a one-turn observation offset.

### 4.2 Race on/off (harness B, in-process)

| Arm | race on | race off | delta | turns |
|---|---:|---:|---:|---|
| GET no mw | 3.864 | 3.068 | **0.796** | 4/3 |
| GET 1 noop mw | 4.461 | 2.893 | **1.568** | 5/4 |
| GET 4 noop mw | 5.497 | 4.058 | 1.439 | 10/7 |
| GET 8 noop mw | 6.536 | 4.498 | 2.039 | 14/11 |
| POST unread | 3.847 | 3.216 | 0.630 | 4/3 |
| POST read-only | 5.614 | 4.633 | 0.981 | 11/8 |
| POST `json()` | 7.229 | 5.398 | **1.831** | 11/8 |

Read this as two separate costs:

- **The window costs ~0.6–0.8 µs even when it never arms a timer** (GET no mw, POST unread: both 4
  turns, both ~0.7). That is four real microtask turns of the runner's own frame plus the
  `dispatch.then(...)` observer promise.
- **Crossing the cliff adds ~0.5–1.1 µs more** (GET 1 noop vs GET no mw: 1.568 vs 0.796), which is
  the `setTimeout`/`clearTimeout` pair.

Phase 1 measured the same primitive at **2.048 µs** (timer 1.267; "4 turns + race + timer" 2.048).
Harness B's POST delta of 1.831 and harness D's 2.344 and harness C's 2.090 bracket that number
across three independent harness shapes. **This is the most reproducible measurement in the
phase.** It is also the largest single removable component in the in-process path.

Harness C's absolutes are rejected (GET 2.583 is 2× lower than harness B's 3.864 while POST jumped
to 12.31), but its race deltas — 0.473 / 0.658 / 0.528 / 1.818 / 2.090 — agree with harness B.

### 4.3 Paired confirmation (harness D)

250-request blocks, both arms alternating off one pool, no forced GC:

| Pair | A | B | A−B | A>B blocks | Verdict |
|---|---:|---:|---:|---:|---|
| POST `json()` race on/off | 15.247 | 11.375 | **+2.344** | 29/48 | noisy, same sign and size as B |
| POST read-only race on/off | 9.253 | 7.294 | +1.314 | 27/48 | noisy, same sign |
| GET no mw race on/off | 3.600 | 2.464 | **+0.757** | **41/48** | consistent |
| GET no mw vs 1 noop mw | 3.024 | 4.284 | −0.497 | **7/48** | consistent: one layer is slower |
| GET no mw vs POST unread | 2.719 | 2.736 | −0.003 | 24/48 | identical |
| POST `json()` vs read-only | 9.872 | 10.145 | −1.121 | 22/48 | **noise — do not use** |

Two arms from this harness are reported as invalid and excluded: an `await`-burner arm whose
factory was passed to `app.use` instead of being invoked, so the handler never ran
(`GET +8 await turns` at 1.955 µs, faster than doing nothing — impossible). The bug was found and
the arm discarded rather than reinterpreted.

`POST json() vs read-only` at 22/48 is the important negative: the difference between read+parse
and read-alone is **not resolvable** by this harness, which means the parse cost (0.39–1.0 µs) is
at the noise floor of a 10 µs request on this machine. Any claim that parse "costs 3 µs in the
pipeline" is unsupported — the ladder's apparent +2.4 was composition drift.

---

## 5. Real socket: the residual is transport, and the race is bigger

Pipelined keep-alive over one TCP connection, batches of 100, identical request/response bytes
across arms. Three runs; one app instance shared by both handlers in runs 2–3 so no second
`Application` boots.

| Run | GET on | GET off | Δ | POST on | POST off | Δ | POST−GET off |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 (two apps) | 20.852 | 18.722 | 2.130 | 33.132 | 30.159 | 2.973 | 11.437 |
| 2 (one app) | 19.829 | 17.951 | 1.878 | 34.518 | 28.959 | 5.559 | 11.007 |
| 3 (one app, 11 reps) | 20.918 | 19.194 | 1.725 | 37.132 | 30.663 | 6.469 | 11.470 |

Three findings:

1. **POST−GET over a socket is 11.0–11.5 µs**, remarkably stable across all runs. Phase 3 measured
   the socket read alone at 4.83 µs and `JSON.parse` at ~1.0. So ~6 µs of the wire gap is body
   delivery plus the scheduling hops that follow it, and the remainder is the same read/parse/
   guard/assign the in-process harness sees at ~2 µs. In-process decomposition explains at most
   one fifth of the wire cost.
2. **The race costs 1.7–2.1 µs for GET on the wire** — 2–3× its in-process cost — because the
   dispatch never settles inside four microtask turns once a real socket is involved. GET crosses
   the cliff too, which the in-process harness cannot show.
3. **The race costs 3.0–6.5 µs for POST on the wire**, and this is the unstable number in the
   phase: 2.97, 5.56, 6.47 across three runs with `race on` spread of ±4 µs. The discontinuity is
   real (every run is far above GET); its magnitude under load is not tightly bounded. Arming a
   timer while a macrotask is in flight is more expensive than arming it in a microtask-only path.

This is the confirmation Phase 1 predicted: **a turn count tuned to the in-process harness cannot
transfer to a socket, because the body read is a macrotask.** Raising `SETTLE_TURNS` cannot remove
the timer from real POST traffic. It can only make the window longer before the same timer arms.

---

## 6. CPU profile

`bun --cpu-prof --cpu-prof-md`, 30 000 POST `json()`, 397 ms, 1 ms sampling (316 samples — low
resolution, indicative only), 9.05 µs/req.

| Self % | Function | Note |
|---:|---|---|
| 16.2 | `Request` (native) | harness artifact — the probe constructs the request inside the loop |
| 9.3 | `parse` (native) | `JSON.parse` |
| 7.9 | `Response` (native) | response construction |
| 3.9 | `text` (native) | `request.text()` |
| 3.4 | `application.ts` anonymous | app dispatch |
| 3.3 | `get` (native) | header/property reads |
| 3.0 | `WebBodySource` | 5.3% total |
| **3.0** | **`setTimeout` (native)** | timer arming |
| **2.9** | **`Symbol` (native)** | `const TIMEOUT = Symbol('timeout')`, per non-settled request |
| 2.2 | `has` (native) | `BODYLESS_METHODS.has`, `Headers.has` |
| **2.1** | **`race` (native)** | `Promise.race` |
| 1.7 | `WebContextBase` | 3.2% total |
| 1.5 | `resolve` (native) | promise resolution |
| 1.3 | `checkJsonDepth` | JS |
| 1.3 | `dispatchWithTimeout` | JS |
| 1.3 | `stringify` (native) | `ctx.json` |
| 1.2 | `set` (native) | `Headers.set` |

**There is no fat JavaScript layer.** The largest JS self-time is `application.ts` at 3.4%, and the
whole framework's JS is a minority of the profile. The timeout cluster — `setTimeout` + `race` +
`resolve` + `Symbol` + `dispatchWithTimeout` — is ~10.8% of sampled CPU (≈1.0 µs/req), and its
measured wall-clock cost is larger (2–6.5 µs) because most of it is host scheduling, not JS
execution. `parse` at 9.3% (≈0.84 µs) confirms the isolated parse measurement.

`Symbol` at 2.9% is a real per-request allocation on the timer path — the `TIMEOUT` sentinel is
constructed inside the not-settled branch. Hoisting it to a module constant is semantics-free but
saves well under 0.1 µs; noted, not proposed.

---

## 7. Removable work, candidate by candidate

| # | Cost | Evidence | Mandatory for | Smallest optimization | Component cost | Full-pipeline A/B | Confidence |
|---|---|---|---|---|---|---|---|
| 1 | Settle window (4 turns) | §4.2: 0.63–0.80 µs even at 4 turns | timeout deadline, error propagation | lower `SETTLE_TURNS` | 0.6–0.8 µs | not tested — lowering makes *more* requests arm the timer | High cost, high risk |
| 2 | Timer arm/clear | §4.2 cliff, §5 socket | timeout deadline | raise `SETTLE_TURNS` | 0.5–1.1 in-process, 1–6.5 socket | **would not help**: socket POST always crosses; GET crosses too | High that it fails |
| 3 | Replace the race primitive | Phase 1: 5 shapes, all lost in the real pipeline (best 11.753 vs 12.826 baseline) | timeout deadline | shared deadline wheel | 1.07 µs in one micro-shape | negative in the pipeline | Low |
| 4 | Body read in pipeline | §3.2: 1.07 µs; Phase 3 socket: 4.83 | reading the body | none left — Phase 3 closed 7 candidates | 1.0 in-process, 4.8 socket | — | High |
| 5 | `JSON.parse` | §3.2 0.39; §6 9.3% CPU | parsing | none — native | 0.4–0.8 | — | High |
| 6 | Depth guard | Phase 3: total reducible arithmetic 0.2 µs | depth safety limit | none — Phase 3 closed | 0.1–0.25 | — | High |
| 7 | Middleware layer | §4.2, §4.3: +0.33–0.64 per layer | ordering, `next()` contract | none proposed | 0.3–0.6 | — | High |
| 8 | `Symbol('timeout')` per timer path | §6: 2.9% CPU | nothing (sentinel only) | module constant | <0.1 | not worth measuring | Medium |

Nothing in rows 4–7 has a measurable, semantics-preserving win left; rows 1–3 are the timeout race,
and every variant of it that Phase 1 measured lost in the real pipeline.

---

## 8. Architecture decision

### A. Keep the current composition — **recommended**

The residual is explained and it is not in the dispatch path. Middleware dispatch contributes
0.3–0.6 µs per layer and its resumption is below measurement resolution (§3.2, §4.3). The
remaining cost is (i) the timeout race, which exists to satisfy a stated contract, and (ii)
transport body delivery, which no middleware change can touch. A composed-middleware design would
target the smallest identified component and leave the largest one in place.

### B. Narrow optimization to existing dispatch — **rejected**

The only dispatch-adjacent lever is the settlement window, and it is now proven not to transfer to
real traffic: on a socket, GET needs more than four turns and POST needs far more, because the
body read is a macrotask (§5). Any turn count that removes the timer in the in-process harness still
arms it in production, so the change would move a benchmark number without moving a real one. That
is precisely the outcome this phase's rules forbid.

### C. Composed-middleware experiment — **not justified on performance grounds**

Expected benefit is bounded by the per-layer cost (0.3–0.6 µs) times the layers removed — for a
two-layer JSON pipeline, 0.6–1.2 µs in-process, less over a socket where the request is 30 µs. The
costs are real: `next()` semantics, error propagation, cancellation, ordering, per-route
composition, and a second dispatch implementation to keep in conformance with the Node adapter.
The benefit does not clear that bar while 3–6.5 µs of timer cost and 11 µs of transport cost sit
untouched.

### The one finding worth an RFC, and it is not middleware

The per-request timeout race costs **1.7–2.1 µs for GET and 3.0–6.5 µs for POST on a real socket**
(§5), and 0.6–2.3 µs in-process (§4). It is the largest removable component in the request path,
it is entirely inside `web-runner`/`dispatchWithTimeout`, and it is orthogonal to middleware
composition. Phase 1 already measured five replacement shapes that all lost, so a sixth attempt
needs a different design class — a shared deadline structure amortised across requests, or lazy
arming keyed to a cheap monotonic check — evaluated **on socket-level evidence**, not the
in-process harness, because that is where the cost actually is.

This is a recommendation, not an implementation. It requires separate approval, its own RFC, and
its own compatibility analysis (timeout precision, cancellation, per-request `AbortSignal`
semantics).

---

## 9. Correctness findings from Phase 3

Both were investigated against the documented contract before any code was considered. **Neither
is a contract mismatch, so no code was changed and no regression test was added.**

### 9.1 Finding 1 — "repeated read maps `BodyConsumedError` to a generic message": false positive, retracted

Evidence, produced by driving a real context through the adapter:

```text
BodyParserError {
  name:    "BodyParserError",
  message: "Error reading request body",
  code:    "BODY_READ_ERROR",
  status:  400,
  cause:   "Body has already been consumed",
  causeEnumerable: false,
  json:    {"name":"BodyParserError","message":"Error reading request body",
            "status":400,"code":"BODY_READ_ERROR"}
}
```

The mapping works exactly as designed:

- `BodyConsumedError` sets `this.name = 'BodyConsumedError'` (`packages/runtime/src/body-source.ts`),
  so `readBodyText`'s `err.name === 'BodyConsumedError'` branch fires.
- `Errors.bodyReadError(original)` returns
  `new BodyParserError('Error reading request body', 400, 'BODY_READ_ERROR', original)`, and the
  fourth argument is attached to `Error`'s `cause` slot. The constructor's own JSDoc states this is
  deliberate: the message stays client-safe, the detail stays server-side, and `cause` is
  non-enumerable so it cannot reach `toJSON()` or a response.
- Confirmed at runtime: `cause` carries the specific text, `Object.keys(error)` does not include
  it, and `JSON.stringify(error)` omits it.

A repeated read is also **not an error at all** on the text path: with Phase 1's caching,
`ctx.bodySource.text()` twice returns the same 1 023-character string. The `BODY_READ_ERROR` path
is reached only when the body was consumed through a source that cannot replay it (the byte path).
Both behaviours are intended.

Phase 3 recorded this as a finding because the probe inspected `err.message` and not `err.cause`.
The finding is withdrawn.

### 9.2 Finding 2 — "non-UTF-8 fallback ignores `options.encoding`": no contract promises it

- `readBodyText` is **not exported** from the package surface; `packages/middleware/body-parser/src/index.ts`
  exports `readBody` only. It is internal.
- No body-parser or JSON option exposes `encoding`. The JSON parser's public options (limit,
  verify, strict, rawBody) do not include it. The text parser derives its charset from
  `Content-Type` (`text.ts` → `normalizeCharset`), which is a different parser with a different
  contract.
- `encoding` exists on `BodySourceOptions` (`packages/types/src/runtime.ts`), i.e. it configures
  **how a body source decodes itself as text**, not how the JSON parser parses. Phase 1's fast path
  correctly declines when the source is not UTF-8; the fallback then decodes UTF-8, which is the
  only encoding JSON permits (RFC 8259 §8.1).

Honouring `options.encoding` inside the JSON parser would therefore *add* non-UTF-8 behaviour the
API never promised — explicitly excluded by this phase's instructions. If the team wants body
sources to be decoded per `options.encoding` for non-JSON consumers, that is a separate decision
about the runtime body-source contract, not a JSON-parser fix.

---

## 10. What was not done

- No production file was modified. No middleware, router, runner, adapter, or public type changed.
- No benchmark budget changed; `apps/benchmark` was read-only reference.
- No commit, no OpenSpec archive.
- The composition experiment (C) was not built, by design: the decision gate is reached before
  implementation, and the estimate does not justify it.
- Allocation *volume* was not measured (needs a heap profile); only retention and GC sensitivity.
- The timer's behaviour under sustained load (queueing of 30 k timers/sec) was not measured. The
  3.0–6.5 µs range for POST includes load sensitivity that is not separated from timer cost.

---

## 11. Reproduction

All probes are read-only and live in `/tmp/opencode/probe-bun-body/`.

```bash
# 1. Controlled ladder: raw / GET / POST unread / read-only / parse-only / json / bodyParser
nice -n 10 bun run phase4-ladder.ts

# 2. Lifecycle trace + tracing-overhead control + replica validation
nice -n 10 bun run phase4-trace.ts

# 3. Turn counts and race on/off (no forced GC — use these absolutes)
nice -n 10 bun run phase4-settle.ts

# 4. GC sensitivity (absolutes invalid; deltas valid)
nice -n 10 bun run phase4-settle2.ts

# 5. Paired block-alternated deltas (drift-resistant; per-arm absolutes are not)
nice -n 10 bun run phase4-paired.ts

# 6. Real socket, pipelined keep-alive, race on/off in one app instance
nice -n 10 bun run phase4-socket2.ts

# 7. Contract evidence + allocation retention
nice -n 10 bun run phase4-contract.ts

# 8. CPU profile
nice -n 10 bun --cpu-prof --cpu-prof-md --cpu-prof-dir=prof run phase4-cpu.ts
```

Reading the probes correctly matters more than running them:

- `phase4-settle2.ts` and `phase4-paired.ts` change heap state between arms. Use their **deltas**,
  never their absolutes.
- `phase4-trace.ts` adds ~0.39 µs per `Bun.nanoseconds()`. Subtract one stamp per boundary before
  comparing to untraced totals.
- Any middleware arm must be registered as the middleware, not the factory: `app.use(readOnly())`,
  not `app.use(readOnly)`. A factory registered as middleware silently skips the handler, which
  produces impossible "faster with more work" numbers.

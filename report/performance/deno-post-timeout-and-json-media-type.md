# Deno POST — the per-request timeout timer, and the JSON media type decision

| Field            | Value                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| **Report type**  | `Performance`                                                         |
| **Scope**        | The Deno POST path, the shared request deadline, the JSON media type |
| **Date**         | `2026-10-21`                                                          |
| **Machine**      | Intel Core i5-8300H, 4C/8T, shared. SMT siblings 0↔4, 1↔5, 2↔6, 3↔7 |
| **Runtimes**     | Bun 1.4.3 · Node v26.12.0 · Deno 2.9.7 · Hono 4.13.0                 |
| **Status**       | `Final` — one change implemented, one decision made, one design rejected |

Measurement protocol throughout: server pinned to physical core 0, `wrk` on physical cores 1 and 3,
3 s warmup + 8 s measurement per arm, arms alternating with the order flipped every pair, primary
metric = the server's CPU time per request from `/proc/<pid>/stat`, reported as the **paired delta**
per pair. Harness and raw data: `/tmp/opencode/ab/` (`ab.mjs`, `prof-run.sh`, `prof-analyze.mjs`,
`compose-charset-arm.mjs`, `res-*.json`).

---

## 1. The question

NextRush's Deno POST path cost 38.66 µs of server CPU per request against Hono 4.13.0's 25.13 µs
for the same work — a 1.54× gap, the largest the campaign had measured. What is the dominant cost,
and is it avoidable without changing what the framework promises?

## 2. The profile (Deno, real HTTP POST, 186 825 requests in 8 s)

Busy time 4213.6 ms. Self time by function:

| Self time | Share | Site |
| ---: | ---: | --- |
| 483.79 ms | 11.48 % | `Timeout` (Deno's timer object) |
| 421.39 ms | 10.00 % | the JSON parser's middleware closure |
| 281.10 ms | 6.67 % | `dispatchWithTimeout` |
| 228.99 ms | 5.43 % | `async_op_3` (Deno's async op) |
| 211.26 ms | 5.01 % | `Timeout.<computed>` |
| 171.45 ms | 4.07 % | `WebContextBase` (context construction) |
| 156.18 ms | 3.71 % | `readableStreamForRid` (Deno's body read) |
| 117.05 ms | 2.78 % | `get headerList` (Deno's request headers) |
| 103.67 ms | 2.46 % | `trySetServeFastStaticResponse` ← Deno's fast path, **engaged** |
| 96.96 ms | 2.30 % | `serializeJson` |
| 86.43 ms | 2.05 % | `setTimeout` |
| 70.43 ms | 1.67 % | `matchContentType` |
| 70.25 ms | 1.67 % | `requestTargetFromUrl` |
| 66.59 ms | 1.58 % | `AbstractBodySource` |
| 39.67 ms | 0.94 % | `clearTimeout` |

**The timeout machinery is the largest framework-controlled cost**: `Timeout` + `Timeout.<computed>` +
`setTimeout` + `clearTimeout` = 820 ms, **19.5 % of the server's busy time**, before
`dispatchWithTimeout`'s own 6.67 %. The body read (Deno's own stream machinery, ≈ 8.7 %) is
comparable, but it is the platform's cost for the same read Hono performs.

### Why the timer is armed at all on a POST

The runner gives a dispatch four microtask turns to settle before it arms a deadline
(`SETTLE_TURNS`). A GET handler settles inside that window — no timer. A POST handler is waiting on
the body read, which is I/O, so it is still pending and **the timer is armed for every POST**.

### The cost of the primitives, isolated

| Primitive | Deno | Bun | Node |
| --- | ---: | ---: | ---: |
| `setTimeout` + `clearTimeout` | **2.151 µs** | 0.160 µs | 0.453 µs |
| `Promise.race` (two promises) | 0.583 µs | 0.124 µs | 0.755 µs |
| 4 × `await Promise.resolve()` | 0.273 µs | 0.248 µs | 0.881 µs |
| `promise.then(onFulfilled)` | 0.062 µs | 0.044 µs | 0.063 µs |

Deno's timer is **13× Bun's**. That is the root cause: a per-request timer is cheap everywhere
except the runtime where the framework was furthest behind.

### The same measurement, end to end

The identical bundle, run with the handler race disabled (`TIMEOUT=0`) and with the default 30 s
timeout, paired:

| Runtime | no race | with race | Δ | Δ% | pairs faster |
| --- | ---: | ---: | ---: | ---: | ---: |
| Deno POST | 27.74 µs | 36.02 µs | **+8.28 µs** | **+29.8 %** | 3/3 (the race is the cost) |
| Bun POST | 21.68 µs | 24.85 µs | **+3.17 µs** | **+14.6 %** | 3/3 |
| Node POST | 38.18 µs | 39.15 µs | +0.97 µs | +2.6 % | 3/3 |

Without the race, NextRush's Deno POST (27.74 µs) is close to Hono's 25.13 µs. The gap was the
timeout race, not the body read.

## 3. The change — one shared deadline timer

`packages/runtime/src/deadline-scheduler.ts` (new) and `packages/runtime/src/web-runner.ts`.

A request registers a deadline; **one timer serves every pending deadline**. The scheduler is
created per runner (one per adapter instance), so there is no module-level state.

Two properties make the timer genuinely shared — both of them learned the hard way (§4):

- **The timer is never cancelled per request.** Cancelling it when the last pending deadline goes
  away would make the next request re-arm it: the per-request cost in a different hat.
- **The timer wakes on a short window** (≤ 100 ms) instead of sleeping until a far-off deadline.
  The sweep re-arms it a few times a second, so a process with no pending deadline holds no timer,
  and the deadline is still honoured exactly — once the deadline is within the window, the timer is
  armed for the exact remaining time.

The race itself also lost a promise: `Promise.race` over two promises became one deferred promise
that whichever of the dispatch and the deadline settles first resolves. The dispatch's rejection is
still observed, so a rejection arriving after the deadline is not left unhandled.

The behaviour that is preserved, unchanged: a handler that never settles still gets a 504 and an
aborted `ctx.signal`; a handler that commits a response before the deadline still keeps that
response; a late rejection is still swallowed rather than crashing the process; a dispatch that
settles inside the microtask window still arms no deadline at all.

### Results (paired, same protocol)

| Runtime | Workload | Before | After | Paired Δ | Δ% | pairs faster |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Deno | POST | 35.02 µs | **30.17 µs** | **−4.84 µs** | **−13.8 %** | 3/3 |
| Bun | POST | 25.90 µs | **23.20 µs** | **−2.71 µs** | **−10.4 %** | 3/3 |
| Node | POST | 41.92 µs | 40.84 µs | −1.07 µs | −2.6 % | 2/3 (noise) |
| Deno | GET | 13.73 µs | 13.47 µs | −0.26 µs | −1.9 % | 2/3 (noise) |

Deno's POST recovers 5.85 µs of the 8.28 µs the race cost — the rest is the race machinery itself
(the `.then` wrapper, the deferred, the four microtask turns, the map operations), not the timer.

**Node is not touched by this change**: the Node adapter owns a separate race (its own
`setTimeout`, plus the `server.timeout` socket guard), so its numbers are unchanged within the
run-to-run variation. Applying the shared scheduler there is the obvious next step and is listed in
§7. **Bun, Deno and Edge** all run the shared web runner, so all three get the change.

## 4. The design that was tried and rejected

The first version cancelled the shared timer when the pending set emptied, and re-armed it on the
next registration. Measured: **+1.01 µs per request (+2.9 %) on Deno POST — 3/3 pairs in the wrong
direction.** The profile showed why: `setTimeout` was still at 0.66 µs per request, i.e. the timer
was still being created per request. The pending set empties between requests on this workload, so
the "clear and re-arm" path *was* the per-request path, with the map and promise overhead added on
top. The window design removes it: the timer is created once and swept, so the cost is a handful
of timer operations per second instead of one per request.

## 5. The JSON media type decision, re-examined

The previous cycle changed the framework's JSON media type from `application/json; charset=utf-8`
to `application/json` — a breaking wire change — because Deno's `Response` constructor only takes
its static fast path for the exact literal `application/json`. The question the review asked is
whether the charset can be kept and the benefit retained.

Measured directly, with everything else equal (the same bundles, the same session, the plain init
record and the shared scheduler in both arms):

| Arm (Deno GET) | CPU/req | vs the other arm |
| --- | ---: | ---: |
| plain init record + `application/json; charset=utf-8` | 14.26 µs | — |
| plain init record + `application/json` | **13.22 µs** | **−1.04 µs (−7.3 %)** |

And with the charset kept, against `HEAD`:

| Comparison (Deno) | Paired Δ | Δ% |
| --- | ---: | ---: |
| HEAD → charset, keeping the plain init record and the shared scheduler (GET) | −1.75 µs | **−10.9 %** |
| HEAD → charset, keeping the plain init record and the shared scheduler (POST) | −9.35 µs | **−21.0 %** |
| HEAD → bare media type (GET) | ≈ −2.8 µs | ≈ −18 % |

**Decision: keep the bare media type.** Preserving the charset is *not* comparably fast — it
forfeits 1.04 µs per request (−7.3 %) on the runtime where the framework is furthest from the
baseline, because `application/json; charset=utf-8` is not one of the three literals Deno accepts
and the response therefore never reaches the static fast path (the profile shows
`trySetServeFastStaticResponse` engaged with the bare value and absent with the charset). The bare
value is also the one RFC 8259 §8.1 defines, and the one Hono 4.13.0 (`c.json()`) and Express 5.2.1
(`res.json()`) already send. The alternatives tested, and their numbers, are recorded in
RFC-046 §12 and ADR-0034.

**Deliberately not changed:** `packages/middleware/static/src/utils.ts` still maps `.json` to
`application/json; charset=utf-8`. That is a served file's media type, not a generated response —
a different surface, widened only with its own evidence.

## 6. Verification

- `packages/runtime` 391/391; the full touched-package set **1605/1605 across 121 files**.
- Conformance: 436/436 in-process; **real Bun 56/56, real Deno 56/56, real `workerd` 16/16**.
- Lint clean (one pre-existing warning, unchanged from `HEAD`); `tsc --noEmit` clean for
  `runtime`, `adapter-bun`, `adapter-deno`, `adapter-edge`, `adapter-node`, `adapter-conformance`.
- New unit tests: `packages/runtime/src/__tests__/deadline-scheduler.test.ts` (8 cases — fires when
  due, does not fire when cancelled, one timer for many deadlines, re-arms for an earlier deadline,
  releases the timer when the sweep finds nothing pending, a throwing callback does not stop the
  others).
- The runner's own timeout contract test (`web-runner-timeout-contract.test.ts`) is unchanged and
  green.

## 7. Remaining work, by benefit and confidence

1. **Apply the shared scheduler to the Node adapter's race** — Node still pays ~0.97 µs per POST for
   its own timer, and the Node adapter's race has the same shape. Confidence: medium (the Node race
   also coordinates with the `server.timeout` socket guard, which the shared scheduler does not
   model). Needs the scheduler exported from `@nextrush/runtime`, which is a public-surface change
   and therefore a deliberate decision.
2. **The remaining Deno POST gap** — at 30.17 µs against Hono's 25.13 µs (1.20×, down from 1.54×).
   The next items in the profile are the JSON parser's middleware closure (10.00 % of busy) and the
   context construction (4.07 %).
3. **The unmeasured workloads** — static GET, dynamic route, middleware, raw-body POST, extra
   headers, streaming/compression/error — still unknown.
4. **`requestTargetFromUrl`** (1.67 %) — the native alternative has a semantic defect (it parses
   `http://h/p#f?x=1` as path `/p#f` + search `?x=1`); it needs a different idea, not a swap.

## 8. Reproduction

```bash
# paired CPU-per-request measurement
node /tmp/opencode/ab/ab.mjs --rt deno --before <bundle> --after <bundle> \
  --pairs 3 --duration 8 --warmup 3 --post --timeout-before 30000 --timeout-after 30000

# the Deno POST profile
bash /tmp/opencode/ab/prof-run.sh <bundle> /tmp/opencode/ab/prof-dir 18302 22000 post

# the primitive costs
deno run --allow-all --quiet /tmp/opencode/ab/timer-cost.ts

# the charset-preserving arm
node /tmp/opencode/ab/compose-charset-arm.mjs serve-nextrush charset
```

Raw data: `/tmp/opencode/ab/res-*.json` (every run's per-pair rows), `/tmp/opencode/ab/prof-*/`
(profiles), and the bundles themselves.

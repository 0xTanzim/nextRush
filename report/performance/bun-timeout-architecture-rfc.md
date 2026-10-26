# Runtime — Request Deadline Enforcement RFC Investigation

| Field            | Value                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| **Report type**  | `Performance` + `Architecture`                                        |
| **Scope**        | `packages/runtime/src/web-runner.ts` deadline path, as driven by `@nextrush/adapter-bun` |
| **Date**         | 2026-10-20                                                            |
| **Reviewer**     | Performance investigation (Phase 5)                                   |
| **Commit / ref** | branch `perf/bun-body-read-parity`, uncommitted Phase 1 tree          |
| **Status**       | Final — investigation only                                            |
| **Related**      | `report/performance/bun-post-hotpath-phase1.md`, `bun-context-response-phase2.md`, `bun-body-parse-phase3.md`, `bun-async-dispatch-phase4.md`; `docs/RFC/runtime-adapters/045-bun-request-hotpath-phase-1.md` |

**Authorization:** investigation, tracing, and isolated experiments. No production file was
modified, no timeout contract changed, no budget touched, nothing committed or archived. Every
server used for measurement lives in `/tmp/opencode/probe-deadline/` and imports the repository
read-only.

**Outcome in one line:** the deadline costs 1.3–5.8 µs per request on a real socket and is
25–65% of the remaining NextRush-vs-Hono per-request gap; every alternative that removes work
was measured or shown to be semantics-incompatible, and the best one is strictly worse.
Recommendation: **retain the current design, authorize no prototype.**

---

## Progress Tracker

**Remediation:** `[░░░░░░░░░░░░░░░░░░░░]` 0% — 0 / 2 recommendations resolved

| Rec | Addresses | Priority | Status |
| --- | --------- | -------- | ------ |
| 1   | F-01      | P1       | ⬜ Open — decision: retain, no change |
| 2   | F-05      | P2       | ⬜ Open — document the contract gaps |

---

## 1. Executive Summary

Phase 4 attributed the residual body-bearing dispatch cost to deadline coordination rather than
middleware composition, but it measured a single concurrency level and could not say whether the
cost was a fixed per-request charge or a scaling pathology. This phase answers that with real
Bun sockets at four concurrency levels, and asks whether a different deadline design removes work
without weakening the contract.

Four things are now established:

1. **The deadline is a real, measurable per-request cost.** Disabling it improves throughput in
   15 of 16 measured cells, by 3.1–17.3%. Expressed as server time per request, that is
   1.3–5.8 µs depending on shape.
2. **The cost is a constant, not a scaling problem.** It does not grow from c=32 to c=512. That
   removes the only justification for a shared deadline scheduler (design class C).
3. **The settlement window still earns its place.** An always-arm design — the obvious way to
   "remove work" — costs 3.7–5.0 µs on GET versus 2.4–3.3 µs for the current window-plus-timer.
   The window makes roughly 40–50% of requests avoid arming a timer, and that saving exceeds the
   window's own cost. Design class B is worse, not better.
4. **The adapter-native escape hatch does not exist.** Bun's `server.timeout()` is an idle
   socket timeout that closes the connection; it cannot return a 504 or abort `ctx.signal`.

The deadline is therefore not an implementation defect to optimize away. It is the measured
price of a guarantee Hono does not offer, and the cheapest design available for that guarantee
among the ones examined. It is nevertheless the largest single identifiable component of the
framework's remaining gap, so it should be documented as a known cost, not silently carried.

---

## 2. System Understanding

### 2.1 Where the deadline sits

Per request the runner performs, in order:

1. `options.makeContext(request, extra)` — context construction. **Outside** the deadline.
2. `handler ??= await boot.ensure()` — first request only. **Outside** the deadline.
3. `const dispatch = handler(ctx)` — the handler chain is invoked synchronously here.
4. `dispatchWithTimeout(dispatch, options.timeout, onTimeout)` — starts the deadline machinery.
5. Finalize (`ctx.responded` check, 404 body) — **outside** the deadline.
6. Response write, adapter-level. **Outside** the deadline.

So the deadline covers the whole dispatch — body read, every middleware layer, the handler — and
nothing else. Boot latency and response serialization are not bounded by it.

### 2.2 The mechanism

`dispatchWithTimeout` (`packages/runtime/src/web-runner.ts:117`) does four things:

- attaches a settlement observer, `dispatch.then(...)`, that records `done`/`failed` into a
  holder object (`outcome`) and never rejects unobserved;
- polls that holder for at most `SETTLE_TURNS = 4` microtask turns (`web-runner.ts:98,143`);
- if still unsettled, allocates a `Symbol('timeout')`, a `setTimeout`, and a `Promise.race`
  between the settlement and the timer;
- clears the timer in `finally`.

On a win by the timer it calls `onTimeout()` → `ctx.triggerTimeout()`, which lazily builds the
combined abort signal and aborts it with `new Error('Request timeout')`
(`web-context-base.ts:273`, `request-signal.ts`).

### 2.3 The contract, precisely

Derived from source and confirmed live (§7). A candidate design is invalid if it changes any row.

| Question | Answer | Evidence |
| --- | --- | --- |
| When does the deadline start? | After context construction and the boot barrier, immediately before `handler(ctx)` | `web-runner.ts:214–222` |
| Does it cover body consumption? | Yes — the body read happens inside the dispatch | live: POST that reads a body then hangs → 504 at 122 ms |
| Does it cover middleware? | Yes, every layer | live: 4-layer app → 504 |
| Does it cover handler execution? | Yes | live: never-settling handler → 504 at 121 ms for a 120 ms budget |
| When does `ctx.signal` abort? | On **either** the deadline or client disconnect; the signal combines `Request.signal` with an adapter-owned controller | `request-signal.ts`; live: `timeout: 0` still recorded one abort with reason `The connection was closed.` |
| What reason does a deadline abort carry? | `Error('Request timeout')` | `web-context-base.ts:273` |
| What happens after a response is committed? | The committed response is delivered; no 504, no timeout warning | `web-runner.ts:232`; live: 200 + `{"ok":true,"committed":true}` at 121 ms |
| Synchronous error from the handler? | Thrown out of `handler(ctx)` inside the outer `try`, answered 500 (or `onError`) | live: 500 |
| Asynchronous error before the deadline? | Rejection of `dispatch` → recorded in `outcome` → rethrown after the race → 500 | live: 500 |
| Asynchronous error **after** the deadline? | Observed by the settlement observer, so no unhandled rejection; the 504 or committed response already sent is unaffected | live: 504, server alive, rejecting handler observed running past the deadline |
| What does `timeout: 0` mean? | Enforcement off: `await handler(ctx)` directly. No race, no timer, no deadline abort. Client disconnect still aborts `ctx.signal` | `web-runner.ts:245–247`; live: request never answered, zero deadline-reason aborts |
| Cleanup? | `clearTimeout` in `finally`, on both the settle and the timeout path | `web-runner.ts:174`; live: 2000-request burst, server healthy |
| Multiple concurrent deadlines? | Independent per request | live: 50 concurrent, 50 × 504, 50 aborts, no crash |
| Client disconnect before the deadline? | Request is abandoned; the remaining path still completes without crashing | live: 20 ms client abort, subsequent request 200 |

---

## 3. Architecture Overview

The deadline is one of three independent cancellation sources converging on a single per-request
commitment:

```
Request.signal (client disconnect) ─┐
                                    ├─► combineAbortSignal ──► ctx.signal  (lazy, only on first read)
adapter timeout controller ─────────┘                              │
        ▲                                                          ▼
        │ triggerTimeout()                             handler / middleware cooperate
        │                                                          │
setTimeout ◄── Promise.race ◄── settlement observer ◄── dispatch(ctx) ┘
```

Two properties of this shape matter for the measurement and for every candidate:

- **Lazy signal.** `ctx.signal` is created on first access, so a request that never reads it pays
  no `AbortController` or `AbortSignal.any` allocation. Only the timeout path forces creation.
- **Commitment is not settlement.** The race bounds the dispatch even for a handler that already
  published its response, which is what stops a post-`next()` middleware or an unclosed body from
  holding a connection for the life of the process.

---

## 4. Data Flow

Dispatch lifecycle, with the cost attribution this phase measured:

| Stage | Bounded by deadline | Per-request cost | Source |
| --- | --- | --- | --- |
| Context construction | No | ~1.1 µs (Phase 4) | `web-runner.ts:210` |
| Boot barrier | No | one await on first request only | `web-runner.ts:214` |
| Settlement window | Is the deadline | 0.7 µs (Phase 1/4, in-process) | `SETTLE_TURNS` loop |
| Timer arm + race | Is the deadline | 0.67 µs saturated; see §5.1 caveat | `web-runner.ts:156–166` |
| `clearTimeout` | — | included above | `web-runner.ts:174` |
| Handler chain | Yes | unchanged | — |
| Finalize + write | No | ~3.0 µs (Phase 4) | `web-runner.ts:250+` |

---

## 5. Method and Measurements

### 5.1 What was measured, and how

| Item | Value |
| --- | --- |
| Runtime | Bun `1.4.3` (Linux x64, 8 cores) |
| Load generator | `wrk 4.2.0`, keep-alive connections, `-t2` (or `-t1` at c=1) |
| Duration | 2 s warm-up + 5 s measured, 2 independent reps per cell |
| Interleaving | All arms run as separate long-lived processes; within each (route, concurrency, rep) cell the arms run back-to-back, in reversed order on alternate reps |
| Server CPU | `/proc/<pid>/stat` utime+stime delta over the measured window |
| Client ceiling | 55.0k rps (`raw` Bun handler: 54963 at c=128, 52705 at c=512), so 33–42k framework figures are server-bound, not client-bound |
| Reproducing | `bun run run-load.ts --routes get,post1k --levels 1,32,128,512 --reps 2`; `--batch body` for 64 KB; `--batch raw` for the ceiling |

Arms:

| Arm | Meaning |
| --- | --- |
| `nextrush-30s` | Current design, default 30 s deadline |
| `nextrush-nodl` | `timeout: 0` — enforcement disabled |
| `hono` | Hono 4.13.0, no deadline |
| `hono-race` | Hono with a `Promise.race` + `Promise.finally` deadline wrapper — an **always-arm** approximation |
| `nextrush-mw-*` | Same two NextRush arms with 3 extra no-op middleware layers |

**Deliberate limitations, stated rather than hidden.**

- `wrk` reports p50/p75/p90/p99. **It does not emit p95.** Tables below give p50/p90/p99 and omit
  p95 rather than interpolating one.
- `hono-race` is an approximation of "always arm": it adds a `Promise.finally` derived promise the
  real design would not need, so it slightly *overstates* always-arm cost. The margin it produces
  (§5.4) is larger than that artifact.
- In-process primitive costs measured in a saturated loop (`probe-native.ts`): await of a resolved
  promise **87 ns**, `setTimeout + clearTimeout` **303 ns**, `setTimeout + race + clear` **666 ns**,
  manual promise + `then` **286 ns**. These are same-tick operations. In a real request the timer is
  armed in one event-loop turn and cleared in a later one, so these figures understate the socket
  cost. They are used only to compare shapes, never as the cost estimate.
- The two "never answers" shapes (exceeded deadline, committed-then-unsettled) hold connections
  open and are not throughput workloads. They are verified for correctness in §7, not placed in the
  throughput matrix.
- The in-process gate was **not** used as evidence here and was not re-tuned.

### 5.2 Server time per request (µs) and deadline on/off delta

Mean µs = `1e6 / mean_rps`. Δ is deadline-enabled minus deadline-disabled; positive means the
deadline costs that much.

| Shape | c | 30 s (µs) | `timeout: 0` (µs) | Δ µs | Δ % throughput |
| --- | --- | --- | --- | --- | --- |
| GET, 1 layer | 1 | 57.0 | 56.3 | 0.7 | 1.4 (noise) |
| GET, 1 layer | 32 | 29.7 | 27.3 | **2.4** | 7.2 |
| GET, 1 layer | 128 | 30.7 | 27.4 | **3.3** | 11.3 |
| GET, 1 layer | 512 | 29.5 | 29.7 | −0.2 | 1.7 (noise) |
| GET + 3 middleware | 1 | 57.4 | 53.1 | 4.3 | 6.8 |
| GET + 3 middleware | 32 | 32.5 | 28.8 | **3.7** | 12.3 |
| GET + 3 middleware | 128 | 35.7 | 30.5 | **5.2** | 17.3 |
| GET + 3 middleware | 512 | 34.1 | 30.6 | **3.5** | 11.5 |
| POST 1 KB | 1 | 73.5 | 67.8 | 5.7 | 8.4 |
| POST 1 KB | 32 | 45.8 | 40.1 | **5.7** | 14.2 |
| POST 1 KB | 128 | 45.5 | 44.2 | 1.3 | 3.1 |
| POST 1 KB | 512 | 45.4 | 39.6 | **5.8** | 14.8 |
| POST 64 KB | 1 | 142.2 | 134.2 | 8.0 | 6.0 |
| POST 64 KB | 32 | 100.0 | 96.3 | 3.7 | 3.9 |
| POST 64 KB | 128 | 99.4 | 94.1 | **5.3** | 5.6 |
| POST 64 KB | 512 | 94.8 | 91.2 | 3.6 | 4.0 |

Direction is consistent (deadline on is slower) in 15 of 16 cells; the exception is GET at c=512,
where the two arms differ by 0.2 µs and swap order between reps. Percentage deltas are larger at
c=128 for large-body shapes because the base time is larger; the µs column is the honest measure.

### 5.3 Latency (p50 / p90 / p99, µs)

| Shape | c | Arm | p50 | p90 | p99 |
| --- | --- | --- | --- | --- | --- |
| GET | 32 | 30 s | 920 | 1290 | 2620 |
| GET | 32 | `timeout: 0` | 818 | 1140 | 1960 |
| GET | 32 | hono | 771 | 1030 | 1710 |
| GET | 128 | 30 s | 4010 | 4990 | 5700 |
| GET | 128 | `timeout: 0` | 3320 | 4160 | 4900 |
| GET | 128 | hono | 2860 | 3640 | 4490 |
| GET | 512 | 30 s | 14330 | 17190 | 20090 |
| GET | 512 | `timeout: 0` | 14800 | 17530 | 20440 |
| POST 1 KB | 32 | 30 s | 1395 | 1900 | 2790 |
| POST 1 KB | 32 | `timeout: 0` | 1200 | 1640 | 2500 |
| POST 1 KB | 128 | 30 s | 5725 | 7310 | 9110 |
| POST 1 KB | 128 | `timeout: 0` | 5660 | 7180 | 8890 |
| POST 64 KB | 128 | 30 s | 12415 | 14610 | 16750 |
| POST 64 KB | 128 | `timeout: 0` | 11735 | 13590 | 15360 |
| POST 64 KB | 128 | hono | 11035 | 13000 | 14480 |

Latency tails track throughput: the shapes that lose throughput also queue longer. At c=512 GET
the ordering inverts, matching the noise-floor result in §5.2 — that cell is a load-generator
artifact, not a framework difference.

### 5.4 The always-arm alternative, measured

`hono-race` versus `hono` isolates the cost of arming a timer for **every** request, with no
settlement window. Compared in µs against NextRush's window-plus-timer on the same shapes:

| Shape | c | hono → hono-race | NextRush 30 s → nodl |
| --- | --- | --- | --- |
| GET | 32 | 23.9 → 27.6 = **+3.7 µs** | 29.7 → 27.3 = **+2.4 µs** |
| GET | 128 | 24.0 → 29.0 = **+5.0 µs** | 30.7 → 27.4 = **+3.3 µs** |
| GET | 512 | 25.1 → 29.5 = **+4.4 µs** | 29.5 → 29.7 = **−0.2 µs** |
| POST 1 KB | 32 | 37.0 → 39.0 = +2.0 µs | 45.8 → 40.1 = +5.7 µs |
| POST 64 KB | 128 | 88.0 → 92.0 = +4.0 µs | 99.4 → 94.1 = +5.3 µs |

On GET — the shape where the window has the best chance of success — always-arm is 1.1–1.7 µs
*worse* than the current design. Solving `0.7 + f·3.7 = 2.4` puts the window's success rate on
the wire at roughly **f ≈ 0.45**: about half of real GET requests settle inside the four turns
and never arm a timer. The window is not dead weight; it is doing about as much as a microtask
heuristic can.

### 5.5 CPU utilization

| Shape | c | 30 s | `timeout: 0` | hono | raw |
| --- | --- | --- | --- | --- | --- |
| GET | 32 | 78% | 77% | 75% | 70% |
| GET | 128 | 78% | 76% | 74% | 70% |
| POST 1 KB | 32 | 85% | 84% | 81% | — |
| POST 64 KB | 32 | 101% | 101% | 100% | — |

GET and 1 KB shapes run at 74–85% of one core, so the framework is CPU-bound on a single thread
and throughput ratios are valid per-request measurements. The 64 KB arm exceeds 100%, indicating
Bun's auxiliary I/O threads, so its throughput is not a pure single-core cost and its µs column
should be read as indicative only.

### 5.6 Run-to-run variation

Two reps per cell. Absolute spread between reps:

- GET, all arms: 0.5–10.8%, median ≈ 6%.
- POST 1 KB: 0.0–9.6%, median ≈ 2%.
- POST 64 KB: 0.8–7.1%, median ≈ 3%.

The deadline deltas in §5.2 (2.4–5.8 µs) are 4–12% of per-request time, which is the same order
as the spread. Confidence is therefore:
**high** on the sign (15/16 cells agree, and the ordering reproduces across two independent
harness shapes), **medium** on the magnitude (±50% per cell), and **low** on any single cell's
exact number. No conclusion in this report rests on a single cell.

---

## 6. Candidate Design Comparison

### 6.1 Class A — current settlement window + timer race (retained candidate)

- **Work performed:** one settlement observer, ≤4 microtask turns, and — for requests that do not
  settle in the window, about half of them — one `Symbol`, one `setTimeout`, one `Promise`, one
  race, one `clearTimeout`.
- **Measured cost:** 2.4–3.3 µs on GET at c=32–128; 5.7–5.8 µs on POST 1 KB; 3.6–5.3 µs on
  POST 64 KB; 3.5–5.2 µs on the 4-layer shape.
- **Contract:** exactly the table in §2.3.

### 6.2 Class B — single-request alternative with a concrete work-elimination mechanism

The only mechanism that removes work without changing semantics is **deleting the window and
arming the timer unconditionally**, so the settlement observer alone decides the outcome. Work
that disappears: 4 `await Promise.resolve()` turns plus the holder polling. Work that appears:
a timer for the ~45% of requests that currently never arm one.

- **Expected saving:** negative. Measured proxy (§5.4) puts always-arm at 3.7–5.0 µs versus
  2.4–3.3 µs for the current design on GET.
- **Confidence:** high on sign; the proxy overstates always-arm cost slightly (extra derived
  promise), which makes the true penalty smaller but not negative.
- **Behaviour risk:** none — this variant is semantics-preserving.
- **Test requirements:** the full §7 gate set, plus a new test asserting the timer is armed before
  the first dispatch turn (an internal-sequencing assertion, which the repo's own test conventions
  disfavour).
- **Real-socket benefit at each concurrency level:** none; negative at c=32, 128, 512.
- **Survives the full path?** No.

A second B-shaped variant — a per-request manual promise resolved by either the dispatch or the
timer, replacing `Promise.race` — was measured as a primitive at 286 ns against 666 ns for
race-plus-timer. That is a 0.4 µs saving on the armed half of requests, i.e. ≈0.2 µs average,
which is below this harness's noise floor (§5.6). It also re-implements settlement observation
that the runtime already has, for no measurable gain. Not recommended.

### 6.3 Class C — shared deadline scheduler

Worth building only if timer management or scheduling contention is a measurable scaling cost.

- **Work it removes:** N `setTimeout`/`clearTimeout` pairs, replaced by a heap push/pop and one
  timer per scheduler tick.
- **The test the measurement had to pass:** the cost must **grow with concurrency**. It does not.
  GET: 2.4 µs (c=32) → 3.3 µs (c=128) → −0.2 µs (c=512). POST 1 KB: 5.7 → 1.3 → 5.8. That is a
  flat per-request constant with no trend, over a 16× concurrency range.
- **Added cost if built anyway:** O(log n) work on every request including GET, plus one live
  entry per outstanding request. At the measured 36k rps and a 30 s default deadline that is
  ≈1.08M concurrent entries and, at ~40 B/entry, ≈43 MB of deadline state — to remove a constant
  that is already only 2–5 µs.
- **Verdict:** rejected on evidence. Revisit only if a future profile shows deadline state in the
  top allocation or CPU site, which `phase4-cpu.ts` did not.

### 6.4 Adapter-native facility (Bun `server.timeout`)

- **What it is:** `timeout(request: Request, seconds: number): void` — documented as "Reset the
  **idle** timeout of the given Request to the given number of seconds. `0` means no timeout."
  (`bun-types@1.4.2/serve.d.ts:1140–1153`).
- **What it does on expiry:** the server closes the connection. It returns `undefined`; there is no
  promise, no 504 body, no `ctx.signal` abort, no `onError`.
- **Why it cannot be used:** it changes three rows of §2.3 at once — no 504, no cooperative abort,
  no post-commit semantics — and it exists only on Bun, while `web-runner` is shared by every
  adapter and must not branch on runtime identity.
- **Verdict:** rejected as semantics-incompatible, on source evidence rather than measurement.

### 6.5 Summary

| Class | Work removed | Measured effect | Verdict |
| --- | --- | --- | --- |
| A — current | — | 2.4–5.8 µs/request, flat across c | **Retain** |
| B — always arm | 4 turns | **+1.1 to +1.7 µs on GET** | Reject — worse |
| B′ — manual promise instead of race | race allocation | ≈0.2 µs average, under noise | Not justified |
| C — shared scheduler | N timers | target cost does not scale; adds 43 MB at 36k rps | Reject — unjustified |
| Native `server.timeout` | — | undefined → connection close | Reject — breaks contract |

---

## 7. Correctness Gates

### 7.1 Existing tests, unmodified

```
bun test packages/runtime/src/__tests__/web-runner.test.ts \
         packages/runtime/src/__tests__/web-runner-timeout-contract.test.ts
→ 23 pass, 0 fail, 54 expect() calls (205 ms)
```

These cover committed-but-unsettled dispatch, timeout delivery, completion before the deadline,
late response and late rejection, synchronous and asynchronous failure, disabled timeouts, and
cleanup of active deadlines. No test was modified, skipped, or weakened.

### 7.2 Live contract verification (`check-behavior.ts`, 20/20 pass)

Servers: NextRush at a 120 ms deadline, NextRush at `timeout: 0`, Hono as a no-deadline control.

| # | Behaviour | Result |
| --- | --- | --- |
| 1 | Fast GET completes | 200 in 4.6 ms |
| 2 | Never-settling handler answered | 504 after 121 ms for a 120 ms deadline |
| 3 | Deadline lands at the deadline, not later | 121 ms |
| 4 | `ctx.signal` aborted on timeout | 1 abort, reason `Request timeout` |
| 5 | Late rejection after the deadline | 504, server alive, handler observed running past the deadline |
| 6 | Committed-then-unsettled | 200 after 121 ms, body `{"ok":true,"committed":true}` |
| 7 | Synchronous throw | 500 |
| 8 | Asynchronous throw | 500 |
| 9 | POST body read then hang | 504 after 122 ms |
| 10 | 50 concurrent deadlines | 50/50 × 504, 50 aborts, no crash |
| 11 | Client disconnect before deadline | no crash, next request 200 |
| 12 | `timeout: 0` | request never answered; **zero** deadline-reason aborts |
| 13 | `timeout: 0` + client disconnect | abort reason `The connection was closed.` — the platform signal, not the deadline |
| 14 | 2000 completed requests | 2000/2000 × 200, server healthy |

Item 13 was initially written as a failing check on the assumption that `timeout: 0` means the
signal never aborts. That assumption is wrong: `ctx.signal` combines client disconnect with the
adapter controller, so it aborts whenever either fires. The framework is correct; the check was
corrected to distinguish abort reasons. This is a contract fact the package README does not state
(F-05).

---

## 8. Findings

### F-01 — The deadline is a fixed 1.3–5.8 µs per-request cost and the largest identifiable share of the framework's remaining gap · Priority `P1`

- **Current situation.** Deadline on versus off, measured on real sockets at four concurrency
  levels: GET 2.4–3.3 µs, GET + 3 middleware 3.5–5.2 µs, POST 1 KB 1.3–5.8 µs, POST 64 KB
  3.6–5.3 µs. Against Hono with no deadline, the deadline accounts for 2.4 of a 5.8 µs gap at
  c=32 GET, 3.3 of 6.7 µs at c=128, 5.7 of 8.8 µs on POST 1 KB, and 5.3 of 11.4 µs on POST 64 KB
  — 25–65% of the gap.
- **Impact.** Every request pays it; it is the single largest removable-looking component of the
  framework's per-request cost.
- **Benefits of the current design.** It is the guarantee: bounded dispatch, cooperative abort,
  504-or-committed-response, cleanup, and cross-runtime parity. Hono's lower number is not a
  like-for-like comparison — Hono offers no deadline.
- **Drawbacks.** Fixed cost on every request, including the ~55% that never need a timer.
- **Long-term risk.** Low. The cost is flat across concurrency, so it does not become a scaling
  problem as traffic grows within one core.
- **Recommendation.** Retain. Document the cost so it is not rediscovered as a regression.
- **Tradeoffs.** Removing it would improve throughput 3–17% and remove a security control that
  bounds slow or stuck handlers.
- **Priority / migration difficulty.** P1 for the decision record; no migration — no change.

### F-02 — The four-turn settlement window is effective on the wire, and always-arm is worse · Priority `P2`

- **Current situation.** `SETTLE_TURNS = 4` lets a dispatch settle before a timer is armed. The
  measured always-arm proxy costs 3.7–5.0 µs on GET where the current design costs 2.4–3.3 µs.
- **Impact.** Settles a design question that Phase 1 left open: the window is not vestigial, and
  removing it is a regression, not an optimization.
- **Benefits.** ~45% of real GET requests avoid arming a timer entirely.
- **Drawbacks.** The success rate is a heuristic that varies by shape; the 4-layer and POST shapes
  cross it nearly always.
- **Long-term risk.** The constant is tuned for microtask-turn counts, which shift if handler
  conventions change — but the failure mode is graceful (an unnecessary timer, not incorrectness).
- **Recommendation.** Leave `SETTLE_TURNS` alone. Explicitly do not tune it, in either direction.
- **Tradeoffs.** Raising it trades GET for POST; lowering it approaches always-arm.
- **Priority / migration difficulty.** P2, informational; no change.

### F-03 — No timer-contention scaling signal exists in the measured range · Priority `P2`

- **Current situation.** The deadline's per-request cost does not grow from c=32 to c=512
  (GET 2.4 → 3.3 → −0.2 µs; POST 1 KB 5.7 → 1.3 → 5.8 µs).
- **Impact.** A shared deadline scheduler (class C) has no problem to solve.
- **Benefits of not building it.** Avoids O(log n) work per request and ~43 MB of deadline state
  at 36k rps with a 30 s default.
- **Drawbacks of not building it.** If a future workload uses very short deadlines at very high
  concurrency, timer density could change character; this measurement cannot rule that out.
- **Long-term risk.** Low, and detectable: the trigger to revisit is deadline state appearing in a
  CPU or allocation profile, which it did not in Phase 4.
- **Recommendation.** Do not build class C.
- **Tradeoffs.** Accepted: a theoretically elegant design deferred for lack of an observed cost.
- **Priority / migration difficulty.** P2; no change.

### F-04 — Bun's native `server.timeout` cannot implement this contract · Priority `P2`

- **Current situation.** `server.timeout(request, seconds): void` resets an idle socket timeout;
  expiry closes the connection.
- **Impact.** Closes the "use the platform facility" line of inquiry permanently for this contract.
- **Benefits of the platform facility.** Presumably cheaper than a JS timer, and no userland
  bookkeeping.
- **Drawbacks.** No 504, no `ctx.signal` abort, no post-commit handling, no `onError`; Bun-only,
  which would require a runtime-identity branch that the architecture forbids.
- **Long-term risk.** If Bun later exposes a resolvable deadline promise, re-evaluate — but only
  behind an adapter capability with a portable fallback.
- **Recommendation.** Record the rejection; do not add a capability for it.
- **Tradeoffs.** None taken; the alternative is invalid rather than merely slower.
- **Priority / migration difficulty.** P2; no change.

### F-05 — The public timeout contract is narrower than the implementation · Priority `P2`

- **Current situation.** `packages/adapters/bun/README.md:188–210` documents the default, the 504,
  the committed-response rule, and that an already-committed handler arms no timer. It does not
  state: the deadline's start point, that it covers body read and middleware, that `timeout: 0`
  disables enforcement entirely, the timeout abort reason (`Error('Request timeout')`), that late
  rejections are observed rather than surfaced, or that `ctx.signal` also aborts on client
  disconnect when enforcement is disabled.
- **Impact.** `timeout: 0` is accepted by the adapter (`options.timeout ?? DEFAULT_TIMEOUT_MS`)
  and silently changes the guarantee, including removing any bound on a committed-then-hanging
  handler. A user disabling timeouts has no documented statement of what they lose.
- **Benefits of documenting it.** The behaviour is already correct and already relied on by the
  adapter's own tests; only the public description lags.
- **Drawbacks.** None beyond doc maintenance.
- **Long-term risk.** A caller disabling the deadline to "reduce overhead" would remove the only
  bound on a stuck handler without noticing.
- **Recommendation.** Add a short contract table to the adapter README covering the seven gaps
  above, cross-linked to this report. Documentation only, no behaviour change.
- **Tradeoffs.** Slightly longer README in exchange for an explicit, testable contract.
- **Priority / migration difficulty.** P2; small (S).

---

## 9. Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A future change tunes `SETTLE_TURNS` to chase the in-process gate | Medium | POST/large-body regression, invisible in-process | F-02 recorded here; the phase brief already forbids it |
| The deadline is removed for throughput | Low | Unbounded stuck handlers, 504 contract loss | F-01 records it as a security-relevant guarantee |
| Class C is built later without a scaling trigger | Low–Medium | 43 MB deadline state, O(log n) per request, no measured win | F-03 states the trigger: profile evidence, not intuition |
| Measured deltas over-trusted | Medium | Mis-sized expectations (±50% per cell) | §5.6 states confidence bounds per conclusion |
| `timeout: 0` used in production unaware of the loss | Medium | No bound on a committed-then-hanging handler | F-05 recommendation |

---

## 10. Recommendations

| # | Recommendation | Addresses | Priority | Effort | Status |
| - | -------------- | --------- | -------- | ------ | ------ |
| 1 | **Retain the current deadline design.** Do not build class B, B′, or C, and do not add a Bun-native capability. Record the measured cost and the rejection reasoning in the RFC/ADR so the question is not reopened without new profile evidence. | F-01, F-02, F-03, F-04 | P1 | — | ⬜ Open |
| 2 | Document the missing contract rows in `packages/adapters/bun/README.md`: deadline start point, coverage, `timeout: 0` semantics, abort reason, late-rejection handling, and client-disconnect aborts. | F-05 | P2 | S | ⬜ Open |

No narrowly scoped prototype is authorized by this report. The one design with a real
work-elimination mechanism is measurably worse, and the two that remain are either unjustified by
the scaling data or semantically invalid. If the maintainer wants the ~0.2 µs from replacing
`Promise.race` with a manual promise (B′), it should be justified as a simplification, not as a
performance change — the gain is below this harness's noise floor.

---

## 11. Migration Strategy

_Not applicable — the recommendation is no change to production code._

---

## 12. Conclusion

The timeout mechanism is not idle overhead in the sense that would justify redesign. On a real
socket it costs 1.3–5.8 µs per request, it is flat across concurrency from 1 to 512, and the
cheapest alternative shape measured — arming a timer for every request — costs more than the
window-plus-timer it would replace. The two remaining alternatives fail for different reasons: a
shared scheduler addresses a contention effect that the data does not show, and Bun's native idle
timeout cannot return a 504 or abort `ctx.signal`.

What the investigation does change is the description of the cost. The deadline is 25–65% of the
framework's remaining per-request gap to a framework that does not offer the guarantee, and it is
the largest single component that has been identified so far. That belongs in the record as a
deliberate price, and in the adapter documentation as an explicit contract — including what a
caller gives up by setting `timeout: 0`.

The single most important next step is to accept the retain decision and close the RFC line of
inquiry, so that the remaining framework gap is looked for in the non-deadline path (context
construction, finalize, response write) rather than re-litigated here.

---

## Checklist

- [x] Every finding carries the nine-field block and a stable ID.
- [x] Conclusions rest on measured data at four concurrency levels, not on a single cell.
- [x] Client ceiling measured (55k rps) so throughput deltas are attributable to the server.
- [x] Interleaved, paired A/B; two reps; run-to-run variation reported (§5.6).
- [x] Missing p95 stated explicitly rather than interpolated.
- [x] Contract derived from source and confirmed by 20 live checks.
- [x] Existing contract tests run unmodified: 23 pass, 0 fail.
- [x] No production file, budget, public API, or timeout semantic changed; no commit made.
- [x] Every rejected candidate has a stated mechanism, measurement or source evidence, and reason.

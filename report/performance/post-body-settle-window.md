# POST body settle window — measurement record

Question: the Web runner gave every dispatch four microtask turns before arming its deadline. A
request that declares a body cannot settle inside that window — the body read waits on I/O, a
macrotask — so the turns only delay the arm. With the deadline now served by one shared timer, is
skipping the window for body-bearing requests a win, and what keeps the window for everything else?

**Outcome: implemented, measured, kept.** Bun JSON POST 1 KB: paired median **−2.7 % server CPU per
request (4/5 pairs)** against the same bundle with the four-turn window, level medians 28.08 →
26.47 µs. A separate window with the constant patched to zero measured **25.51 vs 27.05 µs and 32.5
vs 30.5 k rps (5/5)**. The Bun POST gap to Hono measured in the final window narrowed from **1.31×
to 1.23×**. A bodyless dispatch keeps the window, because always-arming it was measured at about
+3.5 % CPU.

Machine: Intel Core i5-8300H (4C/8T, shared; SMT siblings 0↔4, 1↔5, 2↔6, 3↔7). Final window
measured 2026-10-23 with **Bun 1.4.4**, **Node v26.12.0**, Hono 4.13.0. Load average 1.4–1.7 during
the runs.

Revisions: 2026-10-23 — first record. Raw per-round output stayed under `/tmp` on the measurement
machine; nothing under `report/performance/raw/` is committed.

## 1. What changed

| #   | Change                                                                                                                                      | File                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | `WebContextBase.bodyLength` — the `content-length` the body source already parsed; `undefined` when unknown (chunked)                       | `packages/runtime/src/web-context-base.ts:122,211`                               |
| 2   | `WebRunnerContext.bodyLength?: number` — the optional adapter-side signal the runner reads                                                  | `packages/runtime/src/web-runner.ts:47`                                          |
| 3   | `settleTurnsFor(hasBody)` — zero turns for a declared, non-empty body; `SETTLE_TURNS` otherwise                                             | `packages/runtime/src/web-runner.ts:148`                                         |
| 4   | `dispatchWithTimeout` takes the turn count as a parameter instead of reading the constant                                                   | `packages/runtime/src/web-runner.ts:177`                                         |
| 5   | `answer()` chooses the window from `(ctx.bodyLength ?? 0) > 0`                                                                              | `packages/runtime/src/web-runner.ts:331`                                         |
| 6   | Unit and contract tests: shape rule, immediate arm, empty-body window, 504 for a body-bearing dispatch that never settles, context property | `packages/runtime/src/__tests__/web-runner*.test.ts`, `web-context-base.test.ts` |
| 7   | Changeset and this record                                                                                                                   | `.changeset/post-body-settle-window.md`, this file                               |

No adapter file changed. Bun, Deno, and Edge contexts inherit `bodyLength` from `WebContextBase` and
feed the same shared runner. The Node adapter keeps its own runner and its per-request timers, so it
keeps the window for every request.

## 2. The prior decision, and why its premise expired

Two committed documents close the question the other way:

- `report/performance/bun-timeout-architecture-rfc.md` §F-02 (2026-10-21 01:50): “Leave
  `SETTLE_TURNS` alone. Explicitly do not tune it, in either direction.”
- `docs/RFC/runtime-adapters/045-bun-request-hotpath-phase-1.md` (2026-10-21 08:27): “Resolved: yes,
  unchanged. No measured reason to tune it.”

Both were measured when **each request armed and cancelled its own timer**. In that design arming is
the expensive outcome, so a window that lets a fast handler avoid it is worth its turns: F-02 priced
always-arm at 3.7–5.0 µs against 2.4–3.3 µs for the window on GET.

The shared deadline scheduler landed later the same day (`53e2529b`, 2026-10-21 19:54). One timer
per runner changed the cost of the alternative by roughly an order of magnitude:

| Arm                                    | Measured cost                  |
| -------------------------------------- | ------------------------------ |
| Register + cancel on the shared timer  | 0.196–0.26 µs (196–256 ns)     |
| Four microtask turns, Bun POST on wire | ~1.5 µs of server CPU per POST |
| Touching `request.body` before a read  | ~0.6–0.8 µs on Bun (see §3)    |

The reasoning in F-02 was right about the design it measured; the premise no longer holds for a
request that cannot settle inside the window anyway. The window still pays for itself on a bodyless
dispatch, where a synchronous handler can finish in two to four turns and skip the registration
entirely (measured again this cycle: always-arming an async GET cost ~0.6 µs / ~3.5 % CPU). The
answer is therefore shape-scoped, not a global constant change.

## 3. The signal: `content-length`, not `request.body`

The obvious signal — “does this request have a body?” — is `request.body`. On Bun, touching it before
the first read initialises the stream, which costs more than the window saves. A microbenchmark of
the primitive, 1 KB body, nanoseconds per iteration:

| Arm                                                   |   ns |
| ----------------------------------------------------- | ---: |
| `request.text()` only (baseline)                      |  325 |
| touch `request.body`, then `text()`                   |  932 |
| inspect `request.body`, then `text()`                 | 1124 |
| read `content-length` from the headers, then `text()` |  600 |

`WebBodySource` already parses `content-length` at construction (for the size guard), so the new
property is a field write, not a lookup: the runner reads a value the request path computed anyway.
A request with no declared length — chunked — reports `undefined` and keeps the window, the
conservative choice. A POST that declares `content-length: 0` also keeps it; the request has no body
to wait on.

## 4. Behaviour contract

| Request shape                          | Turns before arming | Why                                                     |
| -------------------------------------- | ------------------: | ------------------------------------------------------- |
| GET / HEAD / OPTIONS (no-body methods) |                   4 | Empty source, `bodyLength` 0; a sync handler can settle |
| POST/PUT/PATCH, `content-length > 0`   |                   0 | The body read is a macrotask; turns cannot settle it    |
| POST/PUT/PATCH, `content-length: 0`    |                   4 | No body to wait on                                      |
| POST/PUT/PATCH, chunked (no length)    |                   4 | Length unknown; stay conservative                       |
| Any shape with `timeout: 0`            |            race off | Unchanged — no deadline is registered at all            |
| Node adapter, any shape                |         per-request | Node keeps its own runner and its own timers            |

The timeout contract itself is unchanged: 504 when nothing was committed, a committed response wins
the race, a settled dispatch cancels its deadline, and `triggerTimeout()` still fires once. The only
observable difference is when the clock starts for a body-bearing request — at dispatch instead of
after four microtask turns, microseconds earlier on windows measured in seconds. The timeout-contract
suite pins the immediate arm, the empty-body window, and the 504 for a body-bearing dispatch that
never settles.

## 5. Measurements

### 5.1 Final window — patched source vs four-turn bundle vs Hono

Three arms, 5 rounds, order rotated each round so no arm always runs first or last. Server pinned to
cores 0–1, `wrk -t2 -c64` on cores 4–7, 2 s warmup + 5 s measured per arm, CPU per request from
`(utime + stime)` deltas in `/proc/<pid>/stat` divided by the request count. All arms build the same
1 KB JSON POST shape through `bodyParser`; the NextRush arms differ only in the runner's turn count.

| Arm                                      | CPU/req (median) | rps (median) | p50 (median) | p99 (median) |
| ---------------------------------------- | ---------------: | -----------: | -----------: | -----------: |
| NextRush, `settleTurnsFor` (this change) |     **26.47 µs** |   **31,064** |      2.05 ms |      3.44 ms |
| NextRush, `SETTLE_TURNS = 4` (baseline)  |         28.08 µs |       29,912 |      2.15 ms |      3.18 ms |
| Hono 4.13.0 (`c.req.json()`)             |         21.45 µs |       37,391 |      1.73 ms |      3.00 ms |

Paired deltas (change vs baseline, same round):

| Round | Change CPU | Baseline CPU |   Δ CPU |   Δ rps |
| ----- | ---------: | -----------: | ------: | ------: |
| 1     |   26.43 µs |     30.82 µs | −14.2 % | +15.8 % |
| 2     |   27.37 µs |     28.08 µs |  −2.5 % |  +1.4 % |
| 3     |   26.78 µs |     25.77 µs |  +3.9 % |  −3.8 % |
| 4     |   26.47 µs |     27.21 µs |  −2.7 % |  +2.3 % |
| 5     |   26.34 µs |     28.19 µs |  −6.6 % |  +6.0 % |

**Paired median −2.7 % CPU (4/5 pairs favour the change); paired median +2.3 % rps (4/5).** The
level medians (28.08 → 26.47 µs, −5.7 %) overstate the effect because round 3 inverted; the paired
median is the number this campaign trusts. The p99 columns are inside this box's spread and are not a
claim.

Ratio to Hono computed within the same window: baseline **1.31×**, change **1.23×** server CPU per
request (rps ratio 1.25× → 1.20×). This recovers essentially the whole gain the constant-patched
window measured earlier; the remaining Bun POST gap is the body work itself (candidate #10
continues).

### 5.2 Earlier window — the constant patched to zero, and the race disabled

Two same-bundle A/Bs in this session, before the context signal existed, to establish how much the
window itself costs:

| Comparison (Bun, 1 KB JSON POST)                   | Baseline |   Change |           Δ | Pairs |
| -------------------------------------------------- | -------: | -------: | ----------: | ----: |
| `SETTLE_TURNS = 4` → `0` (constant patched)        |   30.5 k |   32.5 k |  +6.6 % rps |   5/5 |
| same, CPU per request                              | 27.05 µs | 25.51 µs |  −5.7 % CPU |   5/5 |
| `timeout: 0` → default (whole race disabled vs on) |   31.1 k |   26.8 k | +16.0 % rps |   5/5 |
| same, CPU per request                              | 26.13 µs | 27.98 µs |  −6.6 % CPU |   5/5 |

The second pair is the upper bound for removing the race entirely, not for this change; it is
recorded because it shows how much of the POST cost was the timeout machinery and how much is body
work. Hono in that window measured 38.3 k rps / 20.82 µs, putting the zero-turn arm at **1.23×** —
the same ratio the final window reproduces.

### 5.3 In-process corroboration

Server CPU time per request, best of three alternating passes, `N = 18,000` measured requests,
`process.cpuUsage()`:

| Arm (Bun, in-process)               | µs/req |
| ----------------------------------- | -----: |
| `bodyParser` route, default timeout |  4.112 |
| `bodyParser` route, `timeoutMs: 0`  |  3.765 |
| async handler, default timeout      |  2.466 |
| async handler, `timeoutMs: 0`       |  1.839 |
| Hono `c.req.json()`                 |  2.300 |

`timeoutMs: 0` disables the whole race, so its delta is an upper bound for the window: ~0.35 µs on
the parser path and ~0.63 µs on the async path. An earlier in-process A/B with only the constant
patched measured the parser path at 4.85 → 4.12 µs and the race overhead at 864 → 616 ns; the async
GET shape was slightly _better_ with the window kept, which is the same conclusion the wire GET
control reaches.

The in-process numbers are corroboration, not proof of the wire shape: the synthetic `Request`
objects in that harness carry no `content-length` header, so `bodyLength` is `undefined` there and
they keep the window. On a real server the runtime sends the header, which is why the wire harness is
the decisive one.

### 5.4 GET control

An earlier wire A/B armed the deadline unconditionally for an async GET: ~0.6 µs / ~3.5 % CPU
(rounds 2–5). That is the cost a global zero-turn rule would have imposed on every bodyless request.
GET keeps `bodyLength = 0`, so `settleTurnsFor(false)` returns `SETTLE_TURNS` and the GET path is
unchanged by construction; the contract test “keeps the turn window for a declared empty body” pins
it.

## 6. Verification

Re-run on 2026-10-23 against the working tree after the change and a fresh `@nextrush/runtime` build:

| Gate                                  | Result                                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| `@nextrush/runtime` tests             | 32 files, 402 tests — pass                                                                |
| `@nextrush/adapter-bun` tests         | 9 files, 129 tests — pass                                                                 |
| `@nextrush/adapter-deno` tests        | 10 files, 123 tests — pass                                                                |
| `@nextrush/adapter-edge` tests        | 12 files, 134 tests — pass                                                                |
| `@nextrush/adapter-node` tests        | 30 files, 301 tests — pass                                                                |
| `@nextrush/adapter-conformance` tests | 13 files, 436 tests — pass                                                                |
| dev-check `probe` (real sockets)      | Bun 16/16 PASS; Node 15/15 PASS                                                           |
| Typecheck, runtime + 4 adapters       | clean                                                                                     |
| Typecheck, conformance                | **pre-existing failure**, see below                                                       |
| Lint, runtime                         | 0 errors; one pre-existing warning at `response-builder.ts:181` (`no-non-null-assertion`) |

The conformance typecheck failure is `src/drivers/web-driver.ts:174`: the Deno driver returns
`Response | Promise<Response>` where `WebInvoke` requires `Promise<Response>`. Both files are
unmodified by this cycle, and `packages/adapters/deno/src/adapter.ts` has returned that union since
before this branch; it is recorded here so it is not mistaken for a regression. Its vitest suite
passes.

Probes confirm the observable POST path did not move: invalid JSON still answers
`400 INVALID_JSON`, an unsupported content type still answers `415`, JSON serialisation errors still
answer `500` without hanging, and the timeout contract keeps its 504-with-nothing-committed
behaviour.

## 7. Limitations

- **This box swings ~40 % in throughput between runs.** Only paired, order-flipped deltas within one
  window are used. The final window's paired median (−2.7 %, 4/5) is smaller than its level-median
  difference (−5.7 %) because one round inverted; both are stated, and no cross-window absolute
  comparison is made.
- **The effect is small enough that a 5-round window is near the floor.** The earlier constant-patched
  window (5/5, −5.7 % CPU) and the final window (4/5, −2.7 % paired) agree in direction; the
  magnitude is reported as a range, not a point.
- **Only Bun was wire-measured this cycle.** Deno and Edge share the runner and the rule, but their
  adapters were verified by unit suites and conformance, not by a Deno wire A/B. A Deno POST row is
  the obvious next confirmation.
- **p99 is not a claim.** The change arm's p99 median was 3.44 ms against the baseline's 3.18 ms;
  with 5 rounds at `c64` on a shared box that difference is not separable from noise.
- **In-process harnesses under-represent the wire shape** (§5.3): synthetic `Request`s do not carry
  `content-length`, so an in-process POST keeps the window.
- **The deadline is armed earlier for body-bearing requests.** The timeout contract is unchanged,
  but on a timeout measured in microseconds the clock start is observable; no supported default is
  near that scale.

## 8. Reproduction

```bash
# Two arms from the same committed entry: `before` is HEAD in a throwaway worktree,
# `after` is the working tree. Only the runner's turn count differs.
cd ~/project/framework/nextrush
git worktree add --detach /tmp/before HEAD
(cd /tmp/before/apps/benchmark && bun scripts/dev-check/lib/build.ts \
   scripts/dev-check/entries/serve-nextrush-post.ts /tmp/ab/nr-post-before.js bun --no-minify)
cd apps/benchmark && bun scripts/dev-check/lib/build.ts \
   scripts/dev-check/entries/serve-nextrush-post.ts /tmp/ab/nr-post-after.js bun --no-minify

# Hono arm, same shape
bun scripts/dev-check/lib/build.ts scripts/dev-check/entries/serve-hono-post.ts \
   /tmp/ab/hono-post.js bun --no-minify
```

`/tmp/wrk-post.lua` sets `wrk.method = "POST"`, a 1 KB JSON body, and
`Content-Type: application/json`. Run each arm with `taskset -c 0-1` and `PORT=<port>`, warm up with
`taskset -c 4-7 wrk -t2 -c64 -d2s -s /tmp/wrk-post.lua http://127.0.0.1:<port>/`, then measure 5 s
the same way. Read `utime + stime` (fields 14 + 15) from `/proc/<pid>/stat` before and after and
compute `ticks/100 × 1e6 / (rps × 5)` for CPU per request. Rotate arm order every round.

The in-process arms use `apps/benchmark/scripts/dev-check/entries/inproc-nextrush-post.ts` and
`inproc-hono-post.ts` through the same bundler; `ARMS=parser,parser_d0,nrasync,nrasync_d0,honobase`
selects shapes in the scratch harness used for §5.3.

## 9. Findings

- **F-12 — A measured decision expires when its premise changes.** F-02 and RFC 045 said not to tune
  `SETTLE_TURNS`, and both were right for a per-request timer. The shared scheduler changed the cost
  of the alternative by ~10×, and the recommendation became a prohibition applied to conditions it
  never measured. Re-read the premise, not just the verdict, when the infrastructure under a decision
  moves.
- **F-13 — Use a signal the request path already computed.** `request.body` was the obvious way to
  ask “is there a body?” and it costs more than the saving (+0.6–0.8 µs on Bun). `content-length`
  was already parsed for the size guard; exposing it is a field write. The best signal is free.
- **F-14 — Shape-scoped, not global.** Always-arming a bodyless dispatch costs ~3.5 % on GET. A
  global `SETTLE_TURNS = 0` would have traded the campaign's GET win for its POST win. The rule reads
  one field and keeps the conservative window wherever the body shape is unknown.
- **F-15 — The remaining POST gap is body work, not timeout machinery.** After this change the Bun
  POST ratio to Hono is 1.23× (was 1.31×), and the whole timeout race accounts for at most ~1.8 µs of
  a ~26 µs request. Candidate #10 continues at the parser, where content-type detection, the JSON
  parse, and the body-source read remain.

## 10. Git status

Changed by this cycle:

```
packages/runtime/src/web-runner.ts
packages/runtime/src/web-context-base.ts
packages/runtime/src/__tests__/web-runner.test.ts
packages/runtime/src/__tests__/web-runner-timeout-contract.test.ts
packages/runtime/src/__tests__/web-context-base.test.ts
.changeset/post-body-settle-window.md        (new)
report/performance/post-body-settle-window.md (new)
report/performance/campaign-scoreboard.md     (§11 update)
```

Pre-existing uncommitted work in the same tree, preserved untouched: the text-media-type change
(`response-body.ts`, `response-builder.ts`, node `context.ts`, adapter context tests, conformance
suite, website adapters page, `.changeset/text-media-type-deno-fast-path.md`), the static `send-file`
change (`.changeset/static-responses-emit-headers.md`), and the pnpm bump (`package.json`,
`pnpm-lock.yaml`).

`report/performance/raw/` remains gitignored; no raw benchmark output is committed.

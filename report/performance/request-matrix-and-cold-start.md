# Request matrix, Node POST, and the cold-start cost of `node:http2`

Date: 2026-10-23
Branch: `perf/lazy-http2-import` (from `b111682e`)
Runtime: Bun 1.4.4, Node v26.12.0, Deno 2.9.7
Box: i5-8300H, 8 logical cores, Linux. Load generator and server pinned to
disjoint cores. `wrk` and `strace` available; no `perf`, `hyperfine`, or
`autocannon`.

This campaign measured the workloads the scoreboard still listed as unknown,
decomposed the Node POST path with a CPU profile, and measured cold start. One
change was accepted; four candidates were rejected on evidence.

## 0. Outcome

| Candidate | Verdict | Evidence |
| --- | --- | --- |
| Load `node:http2` on demand | **ACCEPT** — `2d9c7be9` | Bun cold import of the meta package 31.3 → 19.9 ms median (−36 %, 5/5 runs) |
| Node: shared `DeadlineScheduler` instead of per-request `setTimeout` | **REJECT** | Timer pair costs 200 ns on Node 26 (not Deno's 2.15 µs); 0.65 % of sampled CPU |
| Response-header materialisation (`new Headers()` + append) | **REJECT** | 5 headers cost 921 ns; the only faster shape drops duplicate/case semantics |
| Node body-read path (listeners, `Buffer.concat`, closures) | **REJECT** | Whole body path is 4.8 % of sampled CPU; below wire-measurement noise |
| Hoist per-request stream runners; drop Deno's eager IP closure | **REJECT** | 1–2 allocations per request; sub-0.5 %, not measurable here |

## 1. Method

Two harnesses, used for different questions.

**In-process matrix** (`/tmp/nextrush-performance/c14/matrix.ts`). Each arm is a
real `createApp` behind the real Bun handler, so `Request` construction is a
constant across arms. Per arm: 5 000 warm-up requests, then 7 rounds of 20 000;
arm order flips each round; `Bun.gc(true)` before each batch; CPU from
`process.cpuUsage()`, normalised per request. Two identical minimal-GET arms are
the null control. Reported value is the median of the seven round medians.

**Wire A/B** (`report/performance/raw/ab2.mjs`, unchanged). Server and client on
different cores, `wrk -t2 -c64`, 3 s warm-up discarded, 8 s measured window,
server CPU read from `/proc/<pid>/stat` around the measured window only, five
pairs with the order flipped on alternate pairs.

Uncertainty: the null control differs by 56 ns (1.9 % of the minimal request), so
in-process deltas below ~150 ns are not resolvable. Wire CPU/req has a 5–7 %
run-to-run spread on this box; anything smaller is reported as inconclusive, not
as a win.

## 2. Workload matrix — Bun, ns CPU per request

Median of seven rounds; delta against the minimal JSON GET.

| Arm | Workload | CPU/req | Δ vs minimal |
| --- | --- | ---: | ---: |
| `get-min` | `ctx.json` on a static route | 2 951 | — |
| `get-min2` | identical (null control) | 2 895 | −56 |
| `get-text` | `ctx.send('ok')` | 2 670 | −281 |
| `get-dyn` | `/users/:id` | 3 274 | +322 |
| `get-mw3` | + 3 no-op middleware | 4 559 | +1 607 |
| `get-hdr3` | + 3 plain response headers | 3 966 | +1 014 |
| `get-hdrs` | + 5 headers incl. 2 `set-cookie` | 4 979 | +2 028 |
| `get-404` | unmatched path | 3 532 | +580 |
| `get-err` | handler throws → 500 | 6 424 | +3 472 |
| `get-stream` | `ctx.stream()` with one chunk | 10 093 | +7 142 |
| `get-16k` | 16 KB JSON response | 31 119 | +28 168 |
| `post-raw` | 1 KB POST, no parser | 3 478 | +527 |
| `post-json` | 1 KB POST + `bodyParser()` | 7 109 | +4 158 |

Reading:

- **Middleware costs ~536 ns per layer**, close to the async-call floor; `compose`
  is already fast-pathed and the prior campaign measured the race on/off, so this
  is not reopened.
- **A response header costs ~340–400 ns**, and most of that is the platform's
  `Headers` bookkeeping, not framework logic (see §4).
- **The error path is dominated by intentional logging** — every 5xx is logged
  (`packages/core/src/error-handler.ts`, audit C-7), which costs more than the
  throw itself. Not a defect.
- **`post-json` adds 4.16 µs over `post-raw`** on Bun, consistent with the
  previously measured 2.85 µs parser path plus body-source wiring.
- **Streaming adds 7.1 µs** for a single-chunk body; irrelevant next to any real
  stream's I/O, so it was not optimised.

### Correction: a discarded first run

The first matrix run reported +4.4 µs for five headers. That arm called
`ctx.setCookie()`, which **does not exist** in this repository — the call threw
into the error handler, so the arm was measuring the error path. The arm was
rewritten with `ctx.set('set-cookie', …)` and the run repeated; the table above is
the corrected data. The 4.4 µs figure is not evidence and is not used anywhere.

## 3. Node POST — where the CPU actually goes

Wire measurement, 1 KB JSON POST, CPU/req from `/proc`:

| Arm | CPU/req | vs raw |
| --- | ---: | ---: |
| raw `node:http` (body drained) | 27.67 µs | — |
| NextRush, no parser | 29.00 µs | +1.33 µs |
| NextRush + `bodyParser()` | 38.50 µs | +10.83 µs |

So the Node adapter plus core costs **1.3 µs** per request (4.8 %), and body
handling costs **9.5 µs** (25 %).

A `--cpu-prof` run at 18.7 k req/s (5 s, 8 096 samples) attributes that 9.5 µs:

| Frame | Share of samples |
| --- | ---: |
| `writeUtf8String` (native, response write) | 15.4 % |
| `(program)` | 7.3 % |
| `read` — body-parser | 2.4 % |
| `runMicrotasks` | 1.3 % |
| GC | 1.1 % |
| `insert` — `node:internal/timers` | 0.65 % |
| `buffer` — Node body source | 0.61 % |
| `serializeJson` | 0.57 % |
| `decodeUTF8` | 0.56 % |
| `concat` — `node:buffer` | 0.36 % |
| `NodeBodySource` (constructor) | 0.33 % |

The largest single cost is Node's own UTF-8 response write, which the framework
does not own. Summing the body-path frames gives ≈4.8 % of sampled CPU. A
`Buffer.concat` single-chunk fast path would remove 0.36 % — inside this box's
wire noise, so it fails the acceptance gate and was not implemented.

## 4. Accepted: load `node:http2` on demand

`packages/adapters/node/src/tls-server.ts` imported `node:http2` at module scope.
The `nextrush` meta package re-exports this adapter, so every application paid
that module's native initialisation at cold start — including plain-HTTP servers
that never build a TLS listener.

Change (`2d9c7be9`): the value import became `import type`, and
`createNodeServer` became `async`, loading `node:http2` only inside its TLS
branch. `serve()` already awaited around the call, so no caller changed.

Measured on Bun 1.4.4, importing `packages/nextrush/dist/index.js`:

| | Runs (ms) | Median |
| --- | --- | ---: |
| before (static import) | 31.3, 31.5, 31.0, 30.9, 31.4 | **31.3 ms** |
| after (dynamic import) | 21.7, 19.9, 19.8, 19.7, 20.8 | **19.9 ms** |

**−11.4 ms, −36 %, 5/5 runs.** Both bundles were rebuilt from the same tree; the
only difference was the two source files, applied and reverted through `git
stash`.

Node 26 showed no change (43.6 → 45.0 ms median, with one 66.9 ms outlier).
The reason is visible in `process.moduleLoadList`: importing the adapter leaves
`NativeModule http2` and its internal bindings loaded either way, so on Node the
static import was not paying for module evaluation at all. **The win is Bun-only
and is claimed as such.**

An earlier differential estimate suggested ~19 ms; the true figure is 11.4 ms
because `node:http` — still required — initialises some of the same compat
internals. The pre-warm experiment overstated the effect by warming those too.

### Guardrail

Nothing at runtime detects this regression (see the `moduleLoadList` result), so
`src/__tests__/lazy-http2-import.test.ts` asserts the module shape: no value
import of `node:http2` at module scope, and the dynamic import present inside
`createNodeServer`.

### Verification

- `@nextrush/adapter-node`: typecheck clean; 310 tests pass (308 existing + 2 new).
- TLS + HTTP/2 suites: 13/13.
- `@nextrush/adapter-conformance`: 756/756.
- `@nextrush/nextrush` (meta): typecheck clean; 107/107.

## 5. Rejected candidates

**Node shared deadline scheduler.** The Deno precedent (8.28 µs/req, +29.8 %) does
not transfer: `setTimeout` + `clearTimeout` costs **200 ns** on Node 26, and the
timer insertion shows up as 0.65 % of sampled CPU. The scheduler would trade that
for a `Map` insert, a registration object, and a cancel closure — a net win of
tens of nanoseconds, unmeasurable here, against the highest-risk contract in the
adapter (timeout ordering, cooperative cancellation, committed-response
precedence). Rejected.

**Response-header materialisation.** `new Headers()` + 5 × `append` +
`new Response(…, { headers })` costs 1 059 ns against 138 ns for a bare
`Response`; passing the pair list straight to the `Response` initialiser is
*slower* (1 164 ns), and a plain record is faster (805 ns) but collapses
duplicate `set-cookie` and case-insensitive duplicates — a semantic regression
for 254 ns. Rejected.

**Node body-read path.** 4.8 % of sampled CPU (§3), below wire noise. Rejected as
inconclusive rather than implemented blind.

**Stream-runner hoists / Deno's eager IP closure.** One object and one closure per
request; the lifecycle investigation put these below 0.5 % and unmeasurable at
these request costs. They remain available as cleanup, but not as a performance
claim.

## 6. Pre-existing issues found, not fixed

- `packages/adapters/node/src/body-source.ts:168` fails oxlint
  (`no-unnecessary-boolean-literal-compare`). Pre-existing; the file was not
  touched by this campaign.
- `packages/runtime/src/web-runner.ts:145-146` states that the Node adapter
  "keeps the window for every request: its deadlines are per-request timers".
  The code arms the timer synchronously on the uncommitted branch
  (`node/src/adapter.ts:401`). The comment is stale and is the one a future
  optimizer would trust.

## 7. Unknowns

- No Deno, edge, Workerd, or serverless cold-start measurement. The `http2` result
  is Bun-only.
- No allocation counter, GC trace, or RSS measurement; the `--cpu-prof` run gives
  CPU attribution only, and its 50 % idle share means percentages are of wall
  samples, not of busy CPU.
- Wire numbers come from a laptop with 8 logical cores and two client cores;
  `/proc` CPU accounting has 10 ms tick granularity, which is adequate over
  ~90 000 requests but not for sub-microsecond claims.

## 8. Reproduction

```bash
# In-process workload matrix (Bun)
cd /tmp/nextrush-performance/c14
NODE_ENV=production ITER=20000 ROUNDS=7 WARM=5000 taskset -c 2 bun matrix.ts

# Header materialisation microbench
N=5 ITER=200000 ROUNDS=7 taskset -c 2 bun headers.ts

# Node timer primitives
ITER=200000 ROUNDS=7 taskset -c 2 node node-timer.mjs

# Node POST, wire A/B (raw vs NextRush vs NextRush without a parser)
node report/performance/raw/ab2.mjs --runtime node --workload post \
  --a /tmp/nextrush-performance/c14/node-raw.mjs \
  --b /tmp/nextrush-performance/c14/node-nr.mjs --pairs 5 --label c14-node-post

# Node POST CPU profile + attribution
PORT=4703 node --cpu-prof --cpu-prof-dir=prof node-nr-prof.mjs &
taskset -c 1,3 wrk -t2 -c64 -d5s -s wrk-post.lua http://127.0.0.1:4703/
node prof-top.mjs prof/nr-post.cpuprofile 30

# Cold start, before and after
bun -e "const t=performance.now(); await import('<repo>/packages/nextrush/dist/index.js'); console.log(performance.now()-t)"
```

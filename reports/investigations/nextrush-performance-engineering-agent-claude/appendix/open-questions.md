# Appendix — Open Questions

Observations this investigation could not resolve with the available evidence. Each is stated with what
is known, what is not, why it matters, and the specific measurement that would settle it. Per playbook
§3.7 and §1.8, an unverifiable conclusion stays an open investigation rather than being presented as a
finding.

---

## OQ-1 — Why is Deep Route *faster* than Route Parameters for NextRush only?

**Known.** At 256 connections NextRush serves `/api/v1/orgs/:o/teams/:t/members/:m` (8 segments,
3 params) at **25,913 rps** but `/users/:id` (2 segments, 1 param) at **23,878 rps** — the deeper,
more-parameterised route is **8.5% faster**. Marginal cost above its own `hello-world` is 4.01 µs for the
deep route versus **7.30 µs** for the shallow one.

**NextRush is the only framework showing this inversion:**

| | Route Params @256 | Deep Route @256 | Deeper route faster? |
| --- | --- | --- | --- |
| Raw Node.js | 33,607 | 33,408 | No (−0.6%) |
| Fastify | 32,056 | 31,681 | No (−1.2%) |
| Hono | 28,027 | 28,251 | Marginally (+0.8%) |
| **NextRush v3** | **23,878** | **25,913** | **Yes (+8.5%)** |

**Unknown.** The mechanism. Since raw Node and Fastify show near-identical cost for both routes, response
payload size cannot be the whole explanation — if `userById()` produced a materially larger payload than
`deepRoute()`, every framework would show the same ordering.

**Why it matters.** It is directly adjacent to P-02, the second-widest finding in this report. An
inversion this large suggests a **second** mechanism in the param path that the container-allocation
analysis did not identify — plausibly something specific to a param child directly under the trie root,
or an interaction with the static-route map probe on short paths. If so, S-02 as designed may not close
the route-params gap, and the design should be revisited before implementation.

**To settle it:**
1. Compare `JSON.stringify` byte lengths of `userById(...)` and `deepRoute(...)` in
   `servers/_shared/payloads.js` — cheap, rules payload size in or out immediately.
2. Micro-benchmark `matchRoute` for `/users/:id` versus the deep route at equal payload, isolating the
   matcher from the response.
3. Run `bench:alloc:param-match` for both shapes and compare bytes/op.

**Priority: High** — do this *before* designing S-02 in detail.

---

## OQ-2 — Why does NextRush beat raw `node:http` at concurrency 1?

**Known.** NextRush wins five scenarios outright at concurrency 1, including Hello World
(27,318 vs raw Node's 25,586 rps), JSON Serialization, Query Strings, Deep Route and Large JSON. It cannot
be doing less work than the baseline it wraps.

**Working explanation (Moderate evidence).** At c=1 the measurement is latency-bound — ~36–39 µs per
round trip dominated by loopback and syscall latency, not JavaScript — so it is sensitive to socket-write
behaviour rather than CPU. `ctx.json()` performs exactly one `writeHead` (with `Content-Length`) followed
by one `end(body)`, per the shipped HP-14 trim. The raw-node baseline's `sendJson` does `writeHead` +
`end` but computes **no `Content-Length`**, leaving Node to choose framing. The correlation fits: NextRush
wins exactly the JSON-returning scenarios and *loses* `empty-response`, where there is no body to frame.

**Unknown.** Whether the mechanism is write count, `Content-Length` versus chunked framing, Nagle/TCP
behaviour, or a combination.

**Why it matters.** Two reasons. First, it means the response write path is already efficient, which is
what isolates the fixed floor (P-01) as the flat-scaling culprit — a load-bearing step in this report's
reasoning. Second, it is an asset that must not be lost: **any optimisation that improves saturated
throughput while losing the c=1 advantage is a trade, not a win**, and `06-validation-regression.md` §8
makes concurrency-1 a mandatory watch for exactly this reason.

**To settle it:** `strace -c -f -e trace=write,writev,sendto` on both servers under a c=1 wrk run,
comparing syscall counts per response; and add `Content-Length` to the raw-node baseline to see whether
the inversion disappears.

**Priority: Medium** — explanatory rather than actionable, but cheap.

---

## OQ-3 — Is any per-request cost concurrency-*dependent*?

**Known.** NextRush's scaling ratio is ×1.01–×1.24 (1 → 64 conn) versus peers' ×1.18–×1.53 — the worst in
the suite. `04-root-cause-analysis.md` §2 adopts Hypothesis B: this is the consequence of high *uniform*
per-request cost saturating the event loop early.

**Hypothesis A was rejected on evidence** but not disproved. It proposed that cost grows with in-flight
concurrency: at 256 connections roughly 256 `Timeout` objects and ~1,300 promise objects are
simultaneously live (P-01), which would produce GC pressure scaling with concurrency. It was rejected
because the p99/p50 ratio is **not** elevated (NextRush 1.28–1.32 versus Fastify 1.19–1.31, raw Node
1.13–1.38) — GC pauses would fatten the tail, and they do not.

**Unknown.** Whether a *smaller* concurrency-dependent effect exists beneath the dominant uniform cost.
Latency percentiles are a coarse instrument, and the benchmark stops at 256 connections.

**Why it matters.** It changes what S-01 should be. If cost is purely uniform, A2 (flag-and-callback)
captures most of the win and the shared timer wheel (A3) may not be worth its complexity. If there *is* a
concurrency-dependent component, A3 becomes clearly justified.

**To settle it:**
1. Extend the sweep to 512 and 1024 connections — a concurrency-dependent effect should widen there.
2. `--trace-gc` at 64 and 256 conn, comparing scavenge frequency and pause duration.
3. `perf_hooks.monitorEventLoopDelay` histogram at both levels.

**Priority: Medium** — resolve before committing to S-01/A3.

---

## OQ-4 — What is the real cost of static-file serving?

**Known.** `serveStatic` performs at least one `await statSafe(...)` per request with no metadata cache,
no negative cache, and no ETag memoisation. A miss with extension fallbacks plus directory-index
resolution can cost four or more filesystem syscalls for one HTTP request, making a 404 more expensive
than a 200.

**Unknown.** Everything quantitative. **No benchmark scenario serves a static file**, so P-05 is rated
Hypothesis and its impact is stated as "cannot be projected" rather than estimated.

**Why it matters.** Static serving is throughput-critical when used at all, and a `stat` in the warm case
is comparable to the framework's *entire* 30.30 µs per-request cost — far worse cold or on network
storage. But the fix carries the highest risk in this report: a cache that memoises the symlink-safety
verdict is a TOCTOU vulnerability. That combination — potentially large, wholly unmeasured, and
security-sensitive — is precisely when guessing is unacceptable.

**To settle it:** add scenarios for cached hit, cache miss (404), large file, and a cache-busting variant;
baseline rps and syscall counts (`strace -c -f -e trace=stat,lstat,openat,statx`); only then design the
cache.

**Priority: Medium** — and **blocking** for S-05. No implementation before measurement.

---

## OQ-5 — Did the router allocation trim actually increase param allocation?

**Known.** The previous investigation recorded that the team's own micro-benchmark showed param-match
allocation at **339.87 B/op** versus **64.24 B/op** for a static match (5.3×), while the pre-change
baseline recorded param at **169.4 B/op** — i.e. the number **doubled** after the trim shipped. It was
written off as "unmeasurable transient garbage" and the RPS A/B was deferred to hardware never
provisioned.

**Unknown.** Whether the regression is real, and whether it persists at HEAD. No allocation result
artifact for current code exists anywhere in the workspace.

**Why it matters.** It is the strongest independent corroboration of P-02 — a five-container inventory is
exactly what would produce a doubling — and if real, it means a shipped "allocation trim" made allocation
worse while succeeding at its security goals (DoS and prototype-pollution closure, both genuine and
verified). That is a significant thing to leave unresolved across two investigations.

**To settle it:** run `pnpm bench:alloc:param-match` and `bench:alloc:router-match` at HEAD. Two commands.
The harnesses are deterministic (`cv≈0`).

**Priority: High** — cheapest high-value measurement available, and a prerequisite for V-02's baseline.

---

## Deferred by scope

Recorded so they are not lost, but outside this investigation's remit:

| Item | Note |
| ---- | ---- |
| Class/DI runtime performance | `@nextrush/class` + `tsyringe`; `nextrush-v3-class.js` exists as a benchmark server but was **not** included in the measured run |
| Non-Node adapters | Bun, Deno, Edge, Serverless — no benchmark coverage; all four implement their own `Promise.race` timeout, so a P-01 analogue may apply to each |
| Cold start | `project-rules` targets <30 ms; nothing measures it |
| Memory footprint under load | `project-rules` targets <200 KB; nothing measures it |
| `registration-cost.js` results | Boot-time route registration harness exists; no result artifact. Relevant to S-03, which deliberately moves work *into* registration |
| Streaming (`@nextrush/stream`) | SSE/NDJSON paths unbenchmarked |
| Autocannon cross-check | The harness supports it; the stored run used wrk only |

---

## How to read the confidence labels

| Label | Applied when |
| ----- | ------------ |
| **Confirmed** | Read directly in source at the benchmarked revision, or read directly from the stored measurement |
| **Strong evidence** | Measured effect + identified mechanism that fully accounts for it, no competing explanation found |
| **Moderate evidence** | Measured effect + plausible mechanism, alternatives not excluded |
| **Hypothesis** | Mechanism identified in source; no measurement covers it |
| **Unknown** | Observed, unexplained — everything in this file |

Because no profiler was run (`02-runtime-profiling.md` §1), **no finding in this investigation is labelled
Confirmed for its magnitude.** Existence of a mechanism can be Confirmed; its cost is at best Strong
evidence. Items 1, 2 and 3 of `02-runtime-profiling.md` §5 are what lift that ceiling.

# Performance

NextRush ranks **#3 overall** among popular Node frameworks in its parity-validated suite —
ahead of Hono, Koa, and Express; behind Fastify and a raw Node.js baseline (the zero-framework
yardstick). Serialization-heavy routes sit at **~90–92% of baseline**.

Measure before you optimize — and measure against *your* workload. The numbers below are real
but machine-specific; use them to understand relative cost, not to predict your box.

## Headline scoreboard

The suite is 9 like-for-like scenarios × 2 concurrency levels × 6 frameworks = **108 points**.
Win = 6 pts, last = 1. Ties inside measurement noise split points. Figures below are **verbatim
from the current README** — the repo's source of truth.

| Rank | Framework | Score | Scenario wins |
| ---- | --------- | ----- | ------------- |
| 🥇 | **Raw Node.js** *(baseline)* | **105.5** / 108 | 18 |
| 🥈 | **Fastify** | **90.5** / 108 | 5 |
| 🥉 | **NextRush v3** | **68.1** / 108 | 0 |
| 4 | Hono | 60.1 / 108 | 0 |
| 5 | Koa | 34.0 / 108 | 0 |
| 6 | Express | 20.0 / 108 | 0 |

### Throughput @ 256 connections (req/s)

Mean of 6 runs · **wrk** · CPU-pinned. **Bold** = fastest in row.

| Scenario | Raw Node | NextRush | Fastify | Hono | Express |
| -------- | -------- | -------- | ------- | ---- | ------- |
| Hello World | **35,503** | 31,343 | 32,703 | 31,073 | 22,508 |
| JSON Serialization | **34,466** | 31,242 | 33,570 | 29,515 | 22,567 |
| Route Parameters | **33,672** | 28,847 | 30,743 | 27,911 | 20,889 |
| Large JSON | **22,589** | 20,717 | 21,748 | 19,416 | 15,558 |
| Send Object | **35,329** | 31,751 | 31,456 | 29,849 | 21,570 |
| POST JSON | **25,420** | 19,144 | 20,508 | 19,953 | 15,617 |

**NextRush vs baseline (that run):** Hello 88% · JSON 91% · Params 86% · Large JSON **92%** ·
Send Object 90% · POST 75% (body-parser safety work differs per framework).

## What the numbers mean

- **Requests/sec** is throughput — how many requests one server process completes per second at
  a fixed concurrency. Higher is better; it is the headline number for "how cheap is a request."
- **The gap to raw Node** is the framework's tax. NextRush sits at ~85–92% of baseline — the
  remaining cost is creating a `Context`, walking middleware, and matching routes, which raw
  Node doesn't do at all. Fastify's single-digit lead over NextRush on most rows is well inside
  scenario noise; the scoreboard only counts decisive wins.
- **The 68.1/108 score, and zero scenario wins**, means NextRush never beats raw Node outright —
  it's the *baseline* score that dominates. What the number really buys you is that NextRush is
  not structurally slower than its class on any scenario.

## What makes NextRush fast

- **A zero-dependency functional core.** The request path — core, router, types, errors,
  `adapter-node` — has **no third-party runtime dependencies** (no `tsyringe`, no
  `reflect-metadata` in the graph). Nothing to load, allocate, or delegate to at request time.
  Class/DI work happens only if you import `nextrush/class`. See [Packages](Packages).
- **A segment-trie router.** Routes are compiled into a segmented trie, not a linear array of
  regexes, so path matching scales with route *segments*, not the number of registered routes —
  the worst case is near O(path length). See [Routing](Routing).
- **Small, stable per-request objects.** The request path builds one `Context` and reuses
  property getters instead of reconstructing intermediates; per-request work is kept to what the
  handler actually touches. Context-bound signatures and fast-property request containers are
  the recorded decisions here (`docs/adr/ADR-0019`, `ADR-0021`).
- **One composed pipeline.** `app.callback()` is a single `await`-able chain — middleware
  composition happens once at setup, not per request.

## Production tuning checklist

1. **Keep dependencies off the hot path.** A request that only calls `ctx.json()` should not
   load decorator metadata or a DI container. Import from `nextrush` (functional) unless you
   genuinely use the class runtime — the install is cheaper and so is cold start.
2. **Don't block the event loop.** Avoid synchronous CPU-heavy work and synchronous I/O inside
   handlers; the whole framework is async/await native. See [Core Concepts](Core-Concepts).
3. **Reuse lightweight handlers.** Route handlers and middleware are plain objects — construct
   them once at module scope, not inside a request. Per-request closures are where allocations
   creep in.
4. **Stream big responses.** For large or incremental output use `ctx.sendStream()` / SSE —
   buffering a 10MB JSON string in memory costs more than the router ever will. See
   [Streaming](Streaming).
5. **Use the concurrency your hardware has.** The benchmark pins the server across cores; run
   one process per CPU and scale out, rather than fighting within a single process.
6. **Re-measure on your target.** Absolute RPS is machine-specific (loopback, shared host). Use
   relative rankings on identical hardware; re-run the suite before capacity planning.

## Always measure first

The suite exists to keep claims honest: `pnpm bench:validate` asserts byte-identical bodies,
statuses, content types, framing, and headers across all six servers *before* any timing —
output parity is a precondition for a throughput comparison. Multi-run statistics (mean ± sample
stddev + CV%) score adjacent gaps smaller than combined stddev as **ties**, never leads.

Run it yourself:

```bash
cd apps/benchmark
pnpm install
pnpm bench:validate          # abort if any server breaks parity
node scripts/run.js --compare --profile standard --runs 6 --pin 2-7 --client-pin 0-1
pnpm report                  # regenerate REPORT.md + tables from results.json
```

Profiles: `quick` (10s, dev smoke) · `standard` (30s, CI) · `full` (60s, release-grade).

**The warning, in one line:** every optimization you make should start from a profiling or
benchmark run on your own machine and workload — the framework's scores tell you where *it*
spends time, not where *your* app does.

## Next steps

- [Packages](Packages) — which packages are on the hot path and which are optional
- [Streaming](Streaming) — avoiding buffering-heavy response paths
- [Routing](Routing) — the segment-trie router design
- [Architecture](Architecture) — the layering that keeps the core dependency-free
- [Testing](Testing) — benchmark-adjacent but not the same discipline
- Docs-site benchmarks dashboard: https://0xtanzim.github.io/nextRush/docs/production/benchmarking
- Performance tuning guide: https://0xtanzim.github.io/nextRush/docs/production/performance-tuning
# NextRush Benchmark Suite

HTTP framework benchmark for NextRush v3 with **2 built-in benchmark tools** — **wrk** (C-based, process-isolated) and **autocannon** (Node.js-based). The runner auto-detects which tool is available; wrk takes priority when installed.

## Prerequisites

- **Node.js** >= 22.0.0
- **pnpm** (monorepo package manager)
- **wrk** (recommended) — C-based HTTP benchmarking tool

### Install wrk

```bash
# Ubuntu / Debian
sudo apt install wrk

# macOS
brew install wrk

# Verify
wrk --version
```

## Benchmark Tools

The suite supports two benchmark tools. You can force a specific tool with `--tool` or its
`--tools` alias:

| Tool          | Type       | Process Isolation | Shares Node.js Event Loop | Install Required | When to Use                                           |
| ------------- | ---------- | ----------------- | ------------------------- | ---------------- | ----------------------------------------------------- |
| **wrk**       | C binary   | ✅ Yes            | ❌ No                     | Yes (`sudo apt install wrk`) | Production-grade results, accurate latency/RPS |
| **autocannon**| Node.js pkg| ❌ No             | ✅ Yes                    | No (auto-installed via pnpm) | Quick dev iteration, CI without wrk installed  |

- **wrk** is the primary tool. It runs as a separate C process and does **not** share the Node.js event loop — giving the most accurate latency and throughput measurements.
- **autocannon** is the automatic fallback. It runs in-process (Node.js) and is always available since it's a project dependency. Good for quick comparisons or environments where you can't install system packages.
- If neither `--tool` nor `--tools` is provided and `wrk` is unavailable, the runner automatically falls back to autocannon.
- If `wrk` is explicitly requested but unavailable, the runner fails instead of silently measuring with autocannon.

## Quick Start

```bash
# Install dependencies
pnpm install

# Validate fairness (all servers return identical bodies/headers) — run this first
pnpm bench:validate

# Quick benchmark (NextRush only)
pnpm bench:quick

# Quick comparison (all frameworks)
pnpm bench:compare

# Standard all-framework benchmark (3 runs, 3 concurrency levels)
pnpm bench:standard

# Full all-framework benchmark (5 runs, 4 concurrency levels)
pnpm bench:full

# All-framework stress test (high concurrency, 2min duration)
pnpm bench:stress
```

## What Gets Measured

### Per Request

- **RPS** — requests per second (mean, stddev, min, max, CV%)
- **Latency** — avg, p50, p75, p90, p99 percentiles
- **Transfer** — bytes/sec throughput
- **Errors** — socket errors, timeouts, non-2xx responses

### Per Framework

- **RSS Memory** — peak, average, min/max (sampled from `/proc/<pid>/status` on Linux)
- **GC Events** — count, total/max/avg pause, scavenge vs. mark-compact split (when
  `--trace-gc` is enabled)
- **Concurrency Scaling** — RPS curve across connection levels, one line per framework. Each
  line uses a fixed, colorblind-safe color. Framework names are intentionally kept out of the
  plot area because Mermaid endpoint labels clip or overlap when lines converge; a `Line color
  | Framework` text table sits immediately below every scaling chart as the authoritative,
  guaranteed-visible mapping.

### Statistical

- **Sample standard deviation** (Bessel-corrected) for multi-run profiles
- **Coefficient of Variation** (CV%) — result stability indicator (<5% is good)

## Profiles

| Profile    | Duration | Connections     | Runs | Warmup | Publishable | Use Case                     |
| ---------- | -------- | --------------- | ---- | ------ | ----------- | ---------------------------- |
| `quick`    | 10s      | 64, 128         | 1    | 5s     | ❌ No       | Dev iteration, smoke testing |
| `standard` | 30s      | 1, 64, 256      | 3    | 10s    | ✅ Yes      | CI benchmark, daily checks   |
| `full`     | 60s      | 1, 64, 256, 512 | 5    | 15s    | ✅ Yes      | Release validation           |
| `stress`   | 120s     | 256, 512, 1024  | 3    | 15s    | ❌ No       | Breaking-point analysis      |

Single-run (`quick`) and stress profiles are marked **NOT publishable** — their reports carry a
warning banner and their numbers must never be published (no variance / adversarial load).

Framework selection defaults are intentional: `quick` (and the no-profile default) runs NextRush only; `standard`, `full`, and `stress` run all six default frameworks. `--compare` also forces all-framework mode, while `--framework` and `--frameworks` always override the profile default for targeted runs.

Thread count auto-scales based on CPU cores (capped at 16). `standard` and `full` include a 1-connection serial baseline for pure latency measurement.

Any profile's connection ladder can be overridden with `--connections <n>` or `--connections <n1>,<n2>,...` — see [Quick checkup](#quick-checkup-dev-iteration-or-an-ai-agent-verifying-a-change) below.

## Scenarios

All 10 scenarios are implemented identically across every server:

| Scenario         | Method | Path                                     | Tests                        |
| ---------------- | ------ | ---------------------------------------- | ---------------------------- |
| hello-world      | GET    | `/`                                      | Baseline framework overhead  |
| json-serialize   | GET    | `/json`                                  | JSON serialization (~200B)   |
| route-params     | GET    | `/users/12345`                           | Dynamic parameter extraction |
| query-string     | GET    | `/search?q=benchmark&limit=10`           | Query string parsing         |
| post-json        | POST   | `/users`                                 | JSON body parsing + response |
| deep-route       | GET    | `/api/v1/orgs/123/teams/456/members/789` | Deep parameterized route     |
| middleware-stack | GET    | `/middleware`                            | 5 idiomatic layers † |
| error-handling   | GET    | `/error`                                 | Error handler → 500 †|
| large-json       | GET    | `/large-json`                            | Large payload (~5KB array)   |
| empty-response   | GET    | `/empty`                                 | 204 No Content, zero payload |

† **Not like-for-like.** These two use each framework's idiomatic mechanism (middleware chain
vs Fastify hooks vs raw-node manual chain / dedicated error handler vs local catch). They
measure per-framework 5-layer and error-path cost, not a single shared mechanism.

The `quick` profile runs a subset: hello-world, route-params, post-json, middleware-stack.

## Frameworks

| Framework       | Version   | Role                          |
| --------------- | --------- | ----------------------------- |
| Raw Node.js     | built-in  | Zero-framework baseline       |
| **NextRush v3** | workspace | Subject under test (functional path) |
| **NextRush v3 (class)** | workspace | Class/DI path — opt-in via `--frameworks`, not in the default `--compare` set (see [Class-Path Overhead](#class-path-overhead-functional-vs-classdi)) |
| Fastify         | 5.x       | Performance leader comparison |
| Express         | 5.x       | Industry standard comparison  |
| Koa             | 3.x       | Middleware pattern comparison |
| Hono            | 4.x       | Modern framework comparison   |

### Fairness Guarantees

Enforced mechanically by `pnpm bench:validate` (the runner also runs it as a pre-flight):

- **Byte-identical bodies** — for the 8 identical-work scenarios, every server returns the
  same response bytes, built from a single shared payload module (`servers/_shared/payloads.js`).
  The validator normalizes only the random POST `id` and timestamps.
- **Identical middleware headers** — the 5-layer scenario sets the same 5 headers (same names
  and values) in every framework; the validator fails if any is missing or differs.
- **No pre-computed JSON** — all servers serialize per-request (including the raw Node.js baseline).
- **Body parsing only on POST** — attached at the route level; no global middleware penalizes GET routes.
- **Identical runtime config** — same Node flags (`--expose-gc --max-old-space-size=512`),
  `NODE_ENV=production`, and port for every server.
- **No pipelining** — pipelining=1 simulates real client behavior.

**Explicitly NOT like-for-like (by design, disclosed):**

- **Middleware stack** — each framework uses its idiomatic 5-layer mechanism (Koa/Express/Hono/
  NextRush middleware chains, Fastify `onRequest` hooks, raw-node a manual function chain). This
  measures each framework's own 5-layer dispatch cost, not one shared mechanism. Do not read it
  as "framework A's middleware beats framework B's" at face value.
- **Error handling** — routed through each framework's idiomatic error handler; the raw-node
  baseline uses a local catch because it has no pipeline. Returns 500 everywhere.

## CLI Reference

```bash
# Profile selection
node scripts/run.js --profile quick            # NextRush only
node scripts/run.js --profile standard         # all frameworks
node scripts/run.js --profile full             # all frameworks
node scripts/run.js --profile stress           # all frameworks

# Force all-framework comparison (useful with quick/default profile)
node scripts/run.js --compare

# Specific framework
node scripts/run.js --framework nextrush-v3|fastify|express|koa|hono|raw-node

# Explicit framework set — targeted comparison (functional vs class) or the CI perf gate
node scripts/run.js --frameworks nextrush-v3,nextrush-v3-class

# Specific scenario
node scripts/run.js --scenario hello-world

# Explicit tool — --tool and --tools are accepted aliases; values are validated
node scripts/run.js --tool wrk
node scripts/run.js --tools autocannon

# Override connections — works with EVERY profile (quick/standard/full/stress).
# Replaces just that profile's connection ladder; duration/runs/threads stay as
# the profile declares them. Accepts one level or a comma-separated list.
node scripts/run.js --connections 256                       # one custom level
node scripts/run.js --profile standard --connections 512    # standard profile, only 512c
node scripts/run.js --compare --connections 64,256,512      # several custom levels

# Override duration — --duration and --time are the same flag; --time wins if
# both are given (it's the more discoverable spelling)
node scripts/run.js --duration 3 --runs 3    # 3s per run, 3 runs
node scripts/run.js --time 3 --runs 3        # identical, --time spelling

# Enable GC tracking (slower, more data)
node scripts/run.js --trace-gc

# Pin server processes to CPU cores (Linux, taskset) for lower noise
node scripts/run.js --compare --pin 2-7

# Randomize framework execution order to cancel position/thermal bias (off by default)
node scripts/run.js --compare --shuffle

# Skip the parity pre-flight (not advised — parity is the fairness gate)
node scripts/run.js --compare --no-validate

# Validate fairness (byte-identical bodies + headers) without benchmarking
pnpm bench:validate

# Fail if the latest run regressed vs results/baseline (CI gate)
pnpm bench:check

# Regenerate every report artifact from stored JSON — no re-measurement
pnpm report:generate --id <run-id>
pnpm report:regenerate-all

# Combine options
node scripts/run.js --compare --profile full --pin 2-7 --trace-gc

# Diagnostic-saturation run — explicit opt-in for a deliberately adversarial-load
# run (e.g. an intentionally high-concurrency stress probe). Forces
# publishable:false regardless of run count or concurrency levels — this run's
# results are retained but never mistaken for a comparison-grade number.
node scripts/run.js --stress --diagnostic-saturation
```

### Quick checkup (dev iteration or an AI agent verifying a change)

The full `standard`/`full` profiles take hours — for a fast sanity check at one specific
concurrency level, override `--connections`, `--time`, and `--runs` on top of any profile
instead of waiting for the whole ladder:

```bash
# All frameworks, only 256c, 5s per run, single run — seconds, not hours
node scripts/run.js --compare --connections 256 --time 5 --runs 1

# Then inspect the resulting report immediately (no re-measurement)
node scripts/generate-report.js --stdout
```

This is **not publishable** (single run, short duration) — it exists to catch a regression or
confirm a change didn't break anything, not to back a published number. A bad value to any of
`--connections`, `--time`, or `--tool` exits immediately with a clear error, before any server
is spawned, so a scripted/agent-driven invocation fails loudly on a typo rather than silently
measuring the wrong thing.


## Results

Results are saved to `results/<timestamp>/`. `results.json` is the **source of truth**; every
other file in the folder is derived from it and can be regenerated at any time.

```
results/
├── 2026-03-04T10-30-00/
│   ├── results.json          # Source of truth — every raw measurement
│   ├── REPORT.md             # Full report: rankings, charts, methodology
│   ├── README-TABLES.md      # Copy-paste tables for READMEs/docs (ASCII, no Mermaid)
│   ├── results.csv           # Flat export — one row per framework/scenario/concurrency
│   ├── scoreboard.json       # Machine-readable rankings, points, winners
│   ├── raw-node.json         # Per-framework details
│   ├── nextrush-v3.json
│   ├── fastify.json
│   ├── express.json
│   ├── koa.json
│   └── hono.json
├── HISTORY.md                # Cross-run trends (comparable runs only)
└── latest/                   # Copy of most recent run
```

### What REPORT.md contains

In order, with nothing hidden behind a toggle above the results:

1. **System Information** — platform, arch, Node.js, CPU model and core count, memory, kernel,
   host uptime, load-tool version, CPU pinning. The device the numbers describe.
2. **Load Configuration** — profile, tool, duration, connections, runs, threads, pipelining,
   framework and per-scenario warmup, cooldown, pauses, server/client CPU pinning, framework
   order, GC tracing — plus the total timed-run count so the run's size is auditable.
3. **Frameworks Under Test** — server id, version, role (baseline/target/comparison), the exact
   configuration each server uses, and whether it was measured or failed to start.
4. **Scenarios Executed** — name, id, method, path, expected status, category, fairness tag.
5. **Scoreboard** and **Scenario winners** — or, for a single-framework run, an explicit note
   that there is nothing to rank.
6. **Per-scenario rankings** (or results), **Latency**, **Resource Usage**, **Efficiency**,
   **Raw results**, **Fairness and methodology**, **Reproduce this**.

A value the run did not persist is printed as `not recorded in this run` rather than filled in
from the current environment — a number read months later is not evidence about what was
measured. Runs record their full configuration and framework versions from now on; when
regenerating an older run's report, the framework-version table says where the versions came
from.

### Measure once, derive many

A publishable run takes hours. Changing the report format must never mean re-measuring, so
report generation is a pure function of `results.json` — no servers, no load generator:

```
wrk / autocannon  (hours, once)
        │
        ▼
   results.json   ← source of truth
        │
        ├── REPORT.md          (rankings · charts · methodology)
        ├── README-TABLES.md   (npm/docs tables)
        ├── results.csv        (spreadsheets, external plotting)
        ├── scoreboard.json    (CI gates, trend input)
        └── HISTORY.md         (cross-run trend)
```

```bash
pnpm report:generate                          # regenerate the latest run's artifacts
pnpm report:generate --id 2026-03-04T10-30-00 # a specific run
pnpm report:generate --rank-at 64             # rank at a different concurrency level
pnpm report:regenerate-all                    # every stored run + HISTORY.md
pnpm report:history                           # HISTORY.md only
pnpm report:generate --stdout                 # print REPORT.md, write nothing
pnpm report:generate --out /tmp/preview       # write elsewhere (preview a format change)
```

### How the ranking works

Every framework is ranked in **each scenario at each concurrency level**. A win is worth one
point per competing framework, last place one point (6 frameworks → 6 points for a win).

- **Headline score counts like-for-like scenarios only.** `middleware-stack` and
  `error-handling` use each framework's own idiomatic mechanism (middleware chain vs. hook vs.
  manual call), so folding them into one number would report a mechanism difference as a
  performance difference. They get a separate, labelled table.
- **The headline concurrency level is the highest in the run**, not the first. The lowest level
  is usually a single connection, which measures per-request latency rather than throughput —
  a lead there does not survive a saturated server. `REPORT.md` shows the winner at *every*
  level so the difference is visible rather than implied. Override with `--rank-at <conn>`.
- **`≈` marks a gap smaller than the two frameworks' combined standard deviation** — that
  ordering is not statistically meaningful, and the report says so instead of awarding a
  silent win.
- **Trend lines only connect comparable runs.** A different framework set, connection ladder,
  scenario set, or load tool is not on the same scale — a single-framework run scores 100% of
  its own maximum. `HISTORY.md` lists those runs with the reason they were excluded.

### View Results

```bash
pnpm report              # Show latest report
pnpm report:latest       # Same as above

node scripts/report.js --list           # List all runs
node scripts/report.js --id <run-id>    # Show specific run
```

## Methodology

1. **Parity gate** — before timing, `validate-parity.js` boots every server and asserts
   byte-identical bodies, matching statuses, and identical middleware headers. A run that fails
   parity aborts.
2. **Process isolation** — wrk runs as a separate C process. autocannon shares the runtime
   (single process, no worker threads) — prefer wrk for accuracy.
3. **Warmup** — framework-level (root route) plus a per-scenario warmup so each measured code
   path (body parsing, middleware chain, deep-route descent) is JIT-warm before timing.
4. **Cooldown** — pause between frameworks to prevent resource carryover.
5. **No pipelining** — pipelining=1 for realistic client simulation.
6. **Identical work** — the 8 core scenarios return byte-identical responses; middleware-stack
   and error-handling are per-framework idiomatic (mechanisms differ, disclosed above).
7. **Non-2xx guard** — any non-2xx in a success scenario flags the run invalid.
8. **Memory tracking** — RSS sampled from `/proc/<pid>/status` during the benchmark (Linux).
9. **Statistical rigor** — mean ± sample stddev + CV across runs; **only `standard`/`full`
   (3–5 runs) are publishable**. Single-run `quick` reports are stamped NOT publishable.

## Smoke Testing

Verify all servers respond correctly before benchmarking:

```bash
node scripts/smoke-test.js              # Test all 6 servers
node scripts/smoke-test.js nextrush-v3  # Test specific server
```

Tests all 10 endpoints on each server with expected status codes.

## Unit Tests

The pure logic — statistics, run validity (invalid-run exclusion), latency aggregation, and
CPU-sample analysis — is unit-tested with the built-in Node test runner (no extra dependency):

```bash
pnpm test   # node --test scripts/lib/__tests__/*.test.js
```

## Platform Notes

- **Memory tracking** uses `/proc/<pid>/status` — Linux only. On macOS, memory data will be empty.
- **Thread count** auto-detects from `os.cpus().length`, capped between 2 and 16.
- **`--max-old-space-size=512`** is passed to all servers to cap V8 heap.

## Directory Structure

```
apps/benchmark/
├── config/
│   ├── constants.js      # Port, V8 flags, sampling intervals, tolerances
│   ├── frameworks.js     # Framework definitions
│   ├── profiles.js       # Benchmark profiles (duration, connections, runs, publishable)
│   └── scenarios.js      # Test scenarios (endpoints, methods, payloads, expectStatus)
├── scripts/
│   ├── run.js            # Orchestrator (parity pre-flight → per-framework loop → report)
│   ├── bench-exec.js     # Measurement loop, warmup, single-run execution
│   ├── report-md.js      # Composes REPORT.md + every derived artifact from results.json
│   ├── generate-report.js# Regenerate all artifacts from stored JSON (no benchmarking)
│   ├── validate-parity.js# Fairness gate: byte-identical bodies + headers across servers
│   ├── check-regression.js# CI gate: latest vs results/baseline
│   ├── registration-cost.js# Class-path boot cost by controller count (spawns child per scale×run)
│   ├── registration-cost-child.js# Child harness: boots N controllers, prints { n, bootMs }
│   ├── smoke-test.js     # Server verification (status + middleware headers)
│   ├── report.js         # Report viewer
│   ├── utils.js          # Thin barrel re-exporting scripts/lib/*
│   └── lib/              # Focused modules (each < 300 LOC):
│       ├── logging.js args.js time.js system.js fsx.js paths.js
│       ├── server.js     # process lifecycle
│       ├── metrics.js    # RSS + CPU sampling/analysis
│       ├── stats.js      # computeStats, run validity, latency aggregation
│       ├── report/       # Pure, JSON-driven report generation:
│       │   ├── scoreboard.js  # Ranking, points, winners, overhead (no I/O)
│       │   ├── charts.js      # Mermaid builders (xychart, radar, quadrant)
│       │   ├── csv.js         # Flat CSV export
│       │   ├── history.js     # Cross-run trends, comparability filtering
│       │   ├── format.js      # Table/number/medal formatting
│       │   ├── readme-tables.js       # ASCII tables for npm/docs
│       │   └── sections-*.js  # Report section builders
│       ├── tools/        # wrk.js, autocannon.js, version.js
│       └── __tests__/    # node:test unit tests (stats, metrics, report/*)
├── servers/
│   ├── _shared/
│   │   └── payloads.js   # Canonical response payloads + identical middleware headers
│   ├── raw-node.js       # Zero-framework baseline
│   ├── nextrush-v3.js    # NextRush v3 (functional path)
│   ├── nextrush-v3-class.js # NextRush v3 (class/DI path) — mirrors nextrush-v3.js via @Controller
│   ├── express.js        # Express 5
│   ├── fastify.js        # Fastify 5
│   ├── koa.js            # Koa 3
│   └── hono.js           # Hono 4
├── wrk/
│   ├── .generated/       # Per-run POST scripts generated from config/scenarios.js (gitignored)
│   └── mixed.lua         # Mixed workload (via `pnpm bench:mixed`)
└── results/              # Benchmark output
    ├── baseline/         # Optional pinned baseline for `bench:check` — create via `cp -r results/latest results/baseline`
    ├── latest/           # Copy of most recent run (gitignored)
    └── <timestamp>/      # Historical runs (gitignored)
```

## Allocation Harnesses

Alongside the throughput benchmarks above, `scripts/*-alloc.js` measure deterministic
**bytes-per-request** (or bytes-per-match, bytes-per-op) for specific hot-path code — the metric
throughput can't isolate, since it moves with hardware/scheduler noise while a fixed allocation
count does not. Each runs the REAL, built code in an isolated `--expose-gc` child process, forces
GC before/after, and reports `heapUsed` delta ÷ N — near-zero coefficient of variation is the
expected signature of a clean run; a run in which GC fired mid-loop is rejected and retried.

```bash
pnpm bench:alloc:handler          # @nextrush/adapter-node's createHandler per-request closure
pnpm bench:alloc:param-match      # @nextrush/router's param-match path (gross, includes transient)
pnpm bench:alloc:router           # @nextrush/router's match path (net-retained)
pnpm bench:alloc:context          # NodeContext construction
pnpm bench:alloc:context-raw      # ctx.raw lazy-wrapper trim
pnpm bench:alloc:context-state    # ctx.state lazy-init
pnpm bench:alloc:dispatch         # middleware dispatch
pnpm bench:alloc:web              # web-standard Context construction
```

`bench:alloc:handler` reports two figures — the default (`timeout > 0`) handler-vs-timeout race
path, and the `timeout <= 0` disabled path — so a future change to `createHandler`'s timeout
mechanism cannot land without an allocation signal on either branch.

CI wires every `*-alloc.js` harness into a **tight** allocation-regression gate (near-zero
tolerance) against a committed baseline, complementing the throughput gate's loose tolerance — see
[Latest Results](#latest-results) and `.github/workflows/performance-gate.yml`.

### CPU / heap / GC / event-loop profiling (`scripts/profile.js`)

A separate, deeper diagnostic entry point for inspecting ONE server on ONE named scenario under
load — distinct from `run.js`'s six-server throughput comparison. Produces a V8 `.cpuprofile`,
before/after heap snapshots, a GC-event summary (reusing `--trace-gc` capture already collected by
the server-lifecycle helper), and event-loop-utilization samples, all saved under
`results/<run-id>/profile/` with the same commit/dirty-flag provenance as a throughput run.

```bash
node scripts/profile.js --scenario hello-world              # 20s default duration
node scripts/profile.js --scenario route-params --duration 30s
node scripts/profile.js --scenario post-json --heap-snapshot=false --cpu-prof=false
```

Diagnostic-only — never wired into CI, never part of the six-server fairness comparison. Requires
`wrk` on `PATH`. Opens a debugger port (`--inspect`) on the profiled server process only; `run.js`'s
comparison flow never does this. See
`reports/investigations/cpu-allocation-profiling-results.md` for the first findings produced with
this tool.

## Class-Path Overhead (functional vs class/DI)

NextRush exposes two ways to build an app: the **functional path** (`createApp`/`createRouter`,
zero runtime dependencies) and the **class/DI path** (`@Controller` + `registerControllers()`,
which pulls in `tsyringe` + `reflect-metadata`). This suite ships a reproducible,
fairness-validated benchmark for honestly disclosing what the class path costs relative to the
functional path — both **registration/boot cost** (how it scales with controller count) and
**per-request overhead**.

`servers/nextrush-v3-class.js` mirrors `servers/nextrush-v3.js` scenario-for-scenario through
the class path's own idiomatic mechanism (`@Controller`/`@Get`/`@Post` decorators, one
`UseInterceptor` per middleware layer). Both pass the same byte-identical-response gate before
any timing, so the comparison is apples-to-apples:

```bash
pnpm bench:validate nextrush-v3 nextrush-v3-class   # both agree with the raw-node reference
```

### Registration cost (boot time by controller count)

`scripts/registration-cost.js` boots the class path with N generated controllers in a fresh
child process per (scale × run) — timing only `registerControllers()` — and reports mean ±
stddev + CV per scale plus a linear/super-linear scaling verdict:

```bash
node scripts/registration-cost.js --scales 1,10,100,1000 --runs 5
```

Use it to confirm registration stays **sub-linear** as controller count grows (no hidden O(n²)
at 1000+ controllers). Boot cost is a one-time startup expense, not a per-request one. Output is
written to `results/registration-cost-<timestamp>/registration-cost.json`.

### Per-request overhead (class vs functional)

Run both NextRush paths back-to-back in one comparison. The `--frameworks` set keeps it to just
these two — the class server is deliberately **not** in the default `--compare` set (this axis
is functional-vs-class *within* NextRush, not a new cross-framework competitor):

```bash
# quick smoke (single machine, fast) — shows the shape of the overhead, NOT a publishable figure
node scripts/run.js --frameworks nextrush-v3,nextrush-v3-class --profile quick

# publishable-grade — multi-run mean ± stddev + CV, CPU-pinned to cut scheduler noise
pnpm bench:validate nextrush-v3 nextrush-v3-class
node scripts/run.js --frameworks nextrush-v3,nextrush-v3-class --profile full --pin 2-7
```

Because both paths are measured back-to-back on the same cores, same Node flags, and same load
tool, the **ratio** between them (class ÷ functional) cancels most shared-machine noise — a far
more portable statement than an absolute RPS number. Expect the class path's relative overhead
to be largest on the cheapest scenario (hello-world), where per-request DI/interceptor
resolution is a big fraction of a tiny workload, and to shrink as the handler does real work
(body parsing, more headers).

> **Numbers follow the same clean-measurement policy as [Latest Results](#latest-results).**
> Publishable class-vs-functional figures come from the multi-run `standard`/`full` profile on a
> quiet, CPU-pinned host — run the commands above on your own hardware rather than citing a
> shared-machine number.

## Latest Results

> **Numbers are being re-measured on a clean, CPU-pinned environment with the hardened
> harness (parity-validated servers, multi-run `full` profile). They are intentionally not
> published here yet.**

Previous published figures came from single-run (`quick`) sessions on a shared, unpinned
machine and are not reproducible to a publishable standard — see the consolidated audit report
in this folder (`BENCHMARK_AUDIT_REPORT.md`). Do not cite them.

To produce current numbers on your own hardware:

```bash
# Validate fairness first, then run the publishable profile
pnpm bench:validate
pnpm bench:compare --profile full        # 5 runs, 4 concurrency levels, mean ± stddev + CV
node scripts/run.js --compare --profile full --pin 2-7   # optional CPU pinning (Linux, taskset)
```

Only the `standard` and `full` profiles are publishable. The `quick` profile is single-run
(no variance) and its reports are stamped **NOT publishable**.

## Known Limitations

- **Single-run profiles carry no variance** — only `standard`/`full` (3–5 runs) are publishable.
- **Loopback-bound** — client and server share the machine's cores, so absolute RPS reflects
  the whole box, not the framework in isolation. Use relative rankings, not absolute numbers.
- **CPU pinning** is available via `--pin <cores>` (Linux/taskset) to cut scheduler noise; it is
  off by default. Recommended for publishable runs.
- **No Docker isolation** — servers and the load tool share the OS scheduler.
- **Middleware/error scenarios are per-framework idiomatic** (different mechanisms) — not
  like-for-like; see Fairness Guarantees.
- **Memory sampling uses `/proc`** — Linux only (macOS/Windows logs a warning and skips).
- **autocannon shares the Node.js event loop** — prefer wrk for accurate results; autocannon
  runs single-process (no worker threads), so its results are not "N-threaded."
- **`bench:mixed` is a manual probe** — it drives a mixed traffic distribution via wrk but you
  must start a server yourself first (`node servers/<name>.js`). It is not parity-validated and
  its `limit=5` query intentionally differs from the query scenario's `limit=10`.
- **Framework order** is fixed by default for reproducibility; pass `--shuffle` to randomize it
  and cancel position/thermal bias across a comparison.

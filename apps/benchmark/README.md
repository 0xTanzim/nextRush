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

The suite supports two benchmark tools. You can force a specific tool with `--tool`:

| Tool          | Type       | Process Isolation | Shares Node.js Event Loop | Install Required | When to Use                                           |
| ------------- | ---------- | ----------------- | ------------------------- | ---------------- | ----------------------------------------------------- |
| **wrk**       | C binary   | ✅ Yes            | ❌ No                     | Yes (`sudo apt install wrk`) | Production-grade results, accurate latency/RPS |
| **autocannon**| Node.js pkg| ❌ No             | ✅ Yes                    | No (auto-installed via pnpm) | Quick dev iteration, CI without wrk installed  |

- **wrk** is the primary tool. It runs as a separate C process and does **not** share the Node.js event loop — giving the most accurate latency and throughput measurements.
- **autocannon** is the automatic fallback. It runs in-process (Node.js) and is always available since it's a project dependency. Good for quick comparisons or environments where you can't install system packages.
- If neither `--tool` nor `wrk` is available, the runner automatically falls back to autocannon.

## Quick Start

```bash
# Install dependencies
pnpm install

# Validate fairness (all servers return identical bodies/headers) — run this first
pnpm bench:validate

# Quick benchmark (NextRush only)
pnpm bench:quick

# Compare all 6 frameworks
pnpm bench:compare:quick

# Standard CI-grade benchmark (3 runs, 3 concurrency levels)
pnpm bench:standard

# Full release benchmark (5 runs, 4 concurrency levels)
pnpm bench:full

# Stress test (high concurrency, 2min duration)
pnpm bench:stress
```

## What Gets Measured

### Per Request

- **RPS** — requests per second (mean, stddev, min, max, CV%)
- **Latency** — avg, p50, p75, p90, p99 percentiles
- **Transfer** — bytes/sec throughput
- **Errors** — socket errors, timeouts, non-2xx responses

### Per Framework

- **RSS Memory** — peak, average, min (sampled from `/proc/<pid>/status` on Linux)
- **GC Events** — count, total pause, max pause (when `--trace-gc` is enabled)
- **Concurrency Scaling** — RPS curve across connection levels

### Statistical

- **Sample standard deviation** (Bessel-corrected) for multi-run profiles
- **Coefficient of Variation** (CV%) — result stability indicator (<5% is good)

## Profiles

| Profile    | Duration | Connections     | Runs | Warmup | Publishable | Use Case                     |
| ---------- | -------- | --------------- | ---- | ------ | ----------- | ---------------------------- |
| `quick`    | 10s      | 64              | 1    | 5s     | ❌ No       | Dev iteration, smoke testing |
| `standard` | 30s      | 1, 64, 256      | 3    | 10s    | ✅ Yes      | CI benchmark, daily checks   |
| `full`     | 60s      | 1, 64, 256, 512 | 5    | 15s    | ✅ Yes      | Release validation           |
| `stress`   | 120s     | 256, 512, 1024  | 3    | 15s    | ❌ No       | Breaking-point analysis      |

Single-run (`quick`) and stress profiles are marked **NOT publishable** — their reports carry a
warning banner and their numbers must never be published (no variance / adversarial load).

Thread count auto-scales based on CPU cores (capped at 16). `standard` and `full` include a 1-connection serial baseline for pure latency measurement.

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
| **NextRush v3** | workspace | Subject under test            |
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
node scripts/run.js --profile quick|standard|full|stress

# Compare all frameworks
node scripts/run.js --compare

# Specific framework
node scripts/run.js --framework nextrush-v3|fastify|express|koa|hono|raw-node

# Specific scenario
node scripts/run.js --scenario hello-world

# Force tool
node scripts/run.js --tool wrk|autocannon

# Override connections
node scripts/run.js --connections 256

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

# Combine options
node scripts/run.js --compare --profile full --pin 2-7 --trace-gc
```

## Results

Results are saved to `results/<timestamp>/`:

```
results/
├── 2026-03-04T10-30-00/
│   ├── results.json          # Full structured data
│   ├── REPORT.md             # Formatted markdown report
│   ├── raw-node.json         # Per-framework details
│   ├── nextrush-v3.json
│   ├── fastify.json
│   ├── express.json
│   ├── koa.json
│   └── hono.json
└── latest/                   # Copy of most recent run
```

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
│   ├── report-md.js      # Markdown report generation
│   ├── validate-parity.js# Fairness gate: byte-identical bodies + headers across servers
│   ├── check-regression.js# CI gate: latest vs results/baseline
│   ├── smoke-test.js     # Server verification (status + middleware headers)
│   ├── report.js         # Report viewer
│   ├── utils.js          # Thin barrel re-exporting scripts/lib/*
│   └── lib/              # Focused modules (each < 120 LOC):
│       ├── logging.js args.js time.js system.js fsx.js paths.js
│       ├── server.js     # process lifecycle
│       ├── metrics.js    # RSS + CPU sampling/analysis
│       ├── stats.js      # computeStats, run validity, latency aggregation
│       ├── tools/        # wrk.js, autocannon.js, version.js
│       └── __tests__/    # node:test unit tests (stats, metrics)
├── servers/
│   ├── _shared/
│   │   └── payloads.js   # Canonical response payloads + identical middleware headers
│   ├── raw-node.js       # Zero-framework baseline
│   ├── nextrush-v3.js    # NextRush v3
│   ├── express.js        # Express 5
│   ├── fastify.js        # Fastify 5
│   ├── koa.js            # Koa 3
│   └── hono.js           # Hono 4
├── wrk/
│   ├── post-json.lua     # POST body script for wrk
│   └── mixed.lua         # Mixed workload (via `pnpm bench:mixed`)
└── results/              # Benchmark output
    ├── baseline/         # Optional pinned baseline for `bench:check` — create via `cp -r results/latest results/baseline`
    ├── latest/           # Copy of most recent run (gitignored)
    └── <timestamp>/      # Historical runs (gitignored)
```

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

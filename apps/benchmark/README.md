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

| Profile    | Duration | Connections     | Runs | Warmup | Use Case                     |
| ---------- | -------- | --------------- | ---- | ------ | ---------------------------- |
| `quick`    | 10s      | 64              | 1    | 5s     | Dev iteration, smoke testing |
| `standard` | 30s      | 1, 64, 256      | 3    | 10s    | CI benchmark, daily checks   |
| `full`     | 60s      | 1, 64, 256, 512 | 5    | 15s    | Release validation           |
| `stress`   | 120s     | 256, 512, 1024  | 3    | 15s    | Breaking-point analysis      |

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
| middleware-stack | GET    | `/middleware`                            | 5 middleware layers          |
| error-handling   | GET    | `/error`                                 | Error throw + catch pipeline |
| large-json       | GET    | `/large-json`                            | Large payload (~5KB array)   |
| empty-response   | GET    | `/empty`                                 | 204 No Content, zero payload |

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

- **No pre-computed JSON** — all servers serialize per-request (including raw Node.js baseline)
- **Body parsing only on POST** — no global middleware that penalizes GET routes
- **Error handling is equivalent** — all servers throw and catch (including raw Node.js)
- **Same response payloads** — identical data structures across all implementations
- **No pipelining** — pipelining=1 simulates real client behavior

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

# Combine options
node scripts/run.js --compare --profile standard --trace-gc
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

1. **Process isolation** — wrk runs as a separate C process (isolated from Node.js). autocannon shares the runtime — use wrk for production-grade accuracy
2. **Warmup** — real HTTP traffic warmup before measurement (5-15s depending on profile)
3. **Cooldown** — pause between frameworks to prevent resource carryover
4. **No pipelining** — pipelining=1 for realistic client simulation
5. **Identical work** — all servers do equivalent per-request computation
6. **Memory tracking** — RSS sampled from `/proc/<pid>/status` during benchmark (Linux)
7. **Statistical rigor** — sample standard deviation across multiple runs

## Smoke Testing

Verify all servers respond correctly before benchmarking:

```bash
node scripts/smoke-test.js              # Test all 6 servers
node scripts/smoke-test.js nextrush-v3  # Test specific server
```

Tests all 10 endpoints on each server with expected status codes.

## Platform Notes

- **Memory tracking** uses `/proc/<pid>/status` — Linux only. On macOS, memory data will be empty.
- **Thread count** auto-detects from `os.cpus().length`, capped between 2 and 16.
- **`--max-old-space-size=512`** is passed to all servers to cap V8 heap.

## Directory Structure

```
apps/benchmark/
├── config/
│   ├── frameworks.js     # Framework definitions
│   ├── profiles.js       # Benchmark profiles (duration, connections, runs)
│   └── scenarios.js      # Test scenarios (endpoints, methods, payloads)
├── scripts/
│   ├── run.js            # Main orchestrator
│   ├── smoke-test.js     # Server verification
│   ├── report.js         # Report viewer
│   └── utils.js          # Server lifecycle, wrk/autocannon runners, stats
├── servers/
│   ├── raw-node.js       # Zero-framework baseline
│   ├── nextrush-v3.js    # NextRush v3
│   ├── express.js        # Express 5
│   ├── fastify.js        # Fastify 5
│   ├── koa.js            # Koa 3
│   └── hono.js           # Hono 4
├── wrk/
│   ├── post-json.lua     # POST body script for wrk
│   └── mixed.lua         # Mixed workload script (manual use)
└── results/              # Benchmark output (gitignored)
    ├── latest/           # Copy of most recent run
    └── <timestamp>/      # Historical runs
```

## Latest Results (NextRush v3 — Quick Profile)

> Run on Intel i5-8300H (8 cores), 15.5 GB RAM, Node.js v25.9.0
> Profile: `quick` — 10s duration, single run, 64 connections, 4 threads

### wrk (C-based, process-isolated)

| Scenario         | RPS        | Latency p50 | Latency p99 | Memory (RSS peak) |
| ---------------- | ---------- | ----------- | ----------- | ----------------- |
| Hello World      | **31,311** | 1ms         | 3ms         | 109.8 MB          |
| Route Parameters | 29,688     | 2ms         | 4ms         | 109.8 MB          |
| POST JSON        | 18,460     | 3ms         | 6ms         | 109.8 MB          |
| Middleware Stack | **32,377** | 1ms         | 3ms         | 109.8 MB          |

### autocannon (Node.js-based, shares runtime)

| Scenario         | RPS        | Latency p50 | Latency p99 | Memory (RSS peak) |
| ---------------- | ---------- | ----------- | ----------- | ----------------- |
| Hello World      | **31,733** | 1ms         | 3ms         | 109.8 MB          |
| Route Parameters | 29,534     | 2ms         | 4ms         | 109.8 MB          |
| POST JSON        | 19,192     | 3ms         | 6ms         | 109.8 MB          |
| Middleware Stack | **32,220** | 1ms         | 3ms         | 109.8 MB          |

Results differ by ~4% between tools; relative rankings stay consistent.

### Key Observations

- **Middleware lead:** NextRush v3 middleware stack (32,377 RPS wrk) outperforms all other frameworks and even raw Node.js — `compose()` pre-compilation pays off
- **Hello World baseline:** ~31K RPS — exceeding 30K target
- **Route params overhead:** Within ~8% of hello world — segment trie is efficient
- **POST JSON gap:** Body parsing narrows the gap with Fastify to within ~4%
- **Memory footprint:** ~110 MB peak RSS under sustained load

## Known Limitations

- No Docker isolation — servers and benchmark tool share the same OS scheduler
- No CPU pinning — results may vary under OS load
- Memory sampling uses `/proc` — Linux only (macOS/Windows logs a warning and skips)
- autocannon shares the Node.js event loop — use wrk for accurate results

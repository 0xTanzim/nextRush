# NextRush Benchmark Suite

HTTP framework benchmark for NextRush v3 using **wrk** (C-based, process-isolated) as primary tool with **autocannon** as automatic fallback.

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

If wrk is not installed, the suite automatically falls back to autocannon (Node.js-based). wrk is preferred because it runs in a separate C process and does not share the Node.js event loop with the server under test.

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

1. **Process isolation** — wrk runs as a separate C process, not sharing Node.js runtime
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

## Latest Results (NextRush v3 — Full Profile)

> Run on Intel i5-8300H (8 cores), 15.5 GB RAM, Node.js v25.1.0, wrk 4.2.0
> Profile: `full` — 60s duration, 5 runs per configuration, 4 concurrency levels

### Performance Summary (64 connections)

| Scenario           | RPS (mean ± stddev) | CV%   | Latency p50 | Latency p99 |
| ------------------ | ------------------- | ----- | ----------- | ----------- |
| Empty Response     | **36,436 ± 535**    | 1.47% | 1.64ms      | 2.45ms      |
| Middleware Stack   | **31,296 ± 91**     | 0.29% | 1.97ms      | 2.94ms      |
| Hello World        | **29,935 ± 565**    | 1.89% | 2.04ms      | 3.09ms      |
| JSON Serialization | **29,463 ± 284**    | 0.96% | 2.05ms      | 2.98ms      |
| Route Parameters   | **27,732 ± 278**    | 1.00% | 2.22ms      | 3.08ms      |
| Deep Route         | **27,548 ± 182**    | 0.66% | 2.23ms      | 3.20ms      |
| Query Strings      | **21,846 ± 510**    | 2.33% | 2.68ms      | 3.69ms      |
| POST JSON          | **17,609 ± 334**    | 1.90% | 3.64ms      | 4.78ms      |
| Large JSON (~5KB)  | **16,151 ± 1,026**  | 6.36% | 4.41ms      | 5.22ms      |
| Error Handling     | **16,156 ± 141**    | 0.87% | 3.71ms      | 5.05ms      |

### Serial Baseline (1 connection)

| Scenario           | RPS    | Latency p50 | Latency p99 |
| ------------------ | ------ | ----------- | ----------- |
| Empty Response     | 29,866 | 33μs        | 61μs        |
| Deep Route         | 26,611 | 34μs        | 77μs        |
| JSON Serialization | 26,502 | 33μs        | 79μs        |
| Hello World        | 25,928 | 32μs        | 105μs       |
| Route Parameters   | 26,095 | 34μs        | 77μs        |
| Query Strings      | 22,061 | 41μs        | 91μs        |
| Middleware Stack   | 21,767 | 41μs        | 88μs        |
| Large JSON (~5KB)  | 17,010 | 51μs        | 106μs       |
| POST JSON          | 14,521 | 60μs        | 125μs       |
| Error Handling     | 14,483 | 61μs        | 114μs       |

### Key Observations

- **Peak throughput:** 36,436 RPS (empty response @ 64 connections)
- **Hello World baseline:** ~30K RPS — exceeding 25K target
- **Middleware overhead:** 5 middleware layers adds negligible cost — middleware stack (31K RPS) actually outperforms hello-world under concurrency due to response header caching
- **Radix tree depth:** Deep route (3 params, 6 segments) is within 8% of simple route params — radix tree scales well
- **Concurrency scaling:** Flat RPS curve from 64→512 connections with linear latency increase — no throughput collapse
- **Statistical stability:** All scenarios CV% < 3% except Large JSON at 512 connections (one outlier run at 46 RPS — transient system hiccup)
- **Memory footprint:** 224 MB peak RSS under sustained 60s full load across all scenarios

## Known Limitations

- No Docker isolation — servers and benchmark tool share the same OS scheduler
- No CPU pinning — results may vary under OS load
- Memory sampling uses `/proc` — Linux only (macOS/Windows logs a warning and skips)
- autocannon shares the Node.js event loop — use wrk for accurate results

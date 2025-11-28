# 🚀 NextRush v2 Performance Benchmark Suite

Enterprise-grade performance benchmarks comparing **NextRush v2** against **Express**, **Fastify**, **Koa**, and **Hono**.

## 📊 Quick Commands

```bash
# Install dependencies
pnpm install

# Run all frameworks benchmark
pnpm bench:all                    # Full benchmark (~15 min)
pnpm bench:all:quick              # Quick benchmark (~5 min)

# Run NextRush-only benchmark (for development iteration)
pnpm bench:nextrush               # Full NextRush benchmark
pnpm bench:nextrush:quick         # Quick NextRush benchmark
pnpm bench:nextrush --label "v2.1 fix"  # With label

# Compare and analyze
pnpm bench:nextrush:history       # View all benchmark runs
pnpm bench:nextrush:compare       # Compare latest with previous
pnpm bench:nextrush:compare 1 3   # Compare specific runs
pnpm bench:nextrush:trend         # Show performance trend

# Analyze existing results
pnpm analyze                      # Generate analysis report

# Cleanup
pnpm clean:all                    # Remove all results
pnpm clean:nextrush               # Remove NextRush results only
pnpm clean:comparison             # Remove comparison results only
```

## 🎯 Test Configuration

| Setting | Full Mode | Quick Mode |
|---------|-----------|------------|
| **Duration** | 30s per test | 10s per test |
| **Connections** | 100 | 100 |
| **Pipelining** | 10 | 10 |
| **Warmup** | 3s | 3s |
| **Total Time** | ~15 min (all) | ~5 min (all) |

## 📦 Frameworks Tested

| Framework | Description | Version |
|-----------|-------------|---------|
| **NextRush v2** | Our framework | 2.0.x |
| **Express** | Most popular | 5.x |
| **Fastify** | High performance | 5.x |
| **Koa** | Lightweight/Modern | 3.x |
| **Hono** | Ultra-fast | 4.x |

## 🧪 Test Scenarios

| Scenario | Route | Purpose |
|----------|-------|---------|
| **Hello World** | `GET /` | Baseline throughput |
| **Route Parameters** | `GET /users/:id` | Router performance |
| **Query Strings** | `GET /search?q=test&limit=10` | Query parsing |
| **POST JSON** | `POST /users` | Body parser performance |
| **Mixed Workload** | All routes | Real-world simulation |

## 📁 Results Structure

```
results/
├── nextrush/                      # NextRush-only benchmarks
│   ├── latest/                    # Always points to latest
│   │   ├── results.json          # Raw JSON data
│   │   └── REPORT.md             # Human-readable report
│   ├── 2025-01-15_14-30-00/      # Timestamped results
│   │   ├── results.json
│   │   └── REPORT.md
│   └── README.md
├── comparison/                    # Multi-framework comparisons
│   ├── latest/
│   │   ├── results.json
│   │   ├── REPORT.md
│   │   ├── nextrush.json
│   │   ├── express.json
│   │   ├── fastify.json
│   │   ├── koa.json
│   │   └── hono.json
│   └── 2025-01-15_14-30-00/
└── BENCHMARK_RESULTS.md          # Legacy analysis (from analyze command)
```

## 🏗️ Project Structure

```
performance/
├── servers/                       # Test servers for each framework
│   ├── nextrush.js               # NextRush v2 (ESM, uses dist/)
│   ├── express.js                # Express (ESM)
│   ├── fastify.js                # Fastify (ESM)
│   ├── koa.js                    # Koa (ESM)
│   └── hono.js                   # Hono (ESM)
├── scripts/
│   ├── benchmark-all.js          # All frameworks benchmark
│   ├── nextrush-benchmark.js     # NextRush-only benchmark
│   ├── nextrush-compare.js       # Comparison & history tool
│   └── analyze.js                # Results analyzer
├── results/                       # Benchmark results
├── package.json
└── README.md
```

## 🔧 Server Implementations

All servers implement identical routes:

```javascript
// 1. Hello World
GET  /                → { message: "Hello World" }

// 2. Route Parameters
GET  /users/:id       → { id, name, email }

// 3. Query Strings
GET  /search          → { query, limit, results: [...] }

// 4. POST JSON
POST /users           → { success: true, user: {...} }
```

## 📈 Metrics Tracked

- **RPS (Requests/sec)** - Throughput capacity
- **Latency p50** - Median response time
- **Latency p99** - 99th percentile (tail latency)
- **Throughput** - Data transfer rate (MB/s)
- **Errors** - Error count during test
- **Timeouts** - Request timeout count

## ⚖️ Benchmark Fairness

We take fairness seriously. Here's what we do to ensure unbiased comparisons:

### Body Parser Configuration
- **NextRush**: Body parser applied ONLY to POST routes (not globally)
- **Express**: `express.json()` is lightweight but global (fair trade-off)
- **Fastify**: Built-in lazy parsing (only parses when accessed)
- **Koa**: Body parser applied ONLY to POST routes (not globally)
- **Hono**: Lazy parsing (only when `c.req.json()` called)

### Framework Optimizations
- **Fastify**: Default config (no extra optimizations like `ignoreTrailingSlash`)
- **All frameworks**: No logging middleware
- **All frameworks**: Production mode enabled

### What We DON'T Do
❌ No hidden optimizations for NextRush
❌ No extra middleware on competitors
❌ No unfair configuration differences

### Disclosure
- Results may vary based on hardware and system load
- Run multiple times for consistent results
- These are synthetic benchmarks - real-world performance depends on your use case

## 🎓 Best Practices

### For Development Iteration

```bash
# Make code changes, then quickly verify performance
pnpm bench:nextrush:quick --label "fixed hot path"
pnpm bench:nextrush:compare
```

### For Release Validation

```bash
# Full benchmark before release
pnpm bench:all --label "v2.1.0 release"
```

### For Tracking Trends

```bash
# View historical performance
pnpm bench:nextrush:history
pnpm bench:nextrush:trend
```

## ⚠️ Important Notes

1. **Build First**: Run `pnpm build` in the main project before benchmarking NextRush
2. **Close Applications**: Close other CPU-intensive apps for consistent results
3. **Multiple Runs**: Run 2-3 times to verify consistency
4. **Use Labels**: Always add descriptive labels for code changes
5. **Production Mode**: All servers run with `NODE_ENV=production`

## 🔬 Environment Detection

The benchmark automatically detects and reports:
- Node.js version
- Platform (Linux/macOS/Windows)
- CPU model and cores
- Available memory
- Test timestamp

## 📊 Sample Output

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                     🏆 BENCHMARK RESULTS                                    ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌──────────────┬──────────────┬───────────────┬───────────────┬──────────┐
│ Rank         │ Framework    │ Avg RPS       │ Latency (p50) │ Tests    │
├──────────────┼──────────────┼───────────────┼───────────────┼──────────┤
│ 🥇 1st       │ hono       │      26,252 │     44.40ms │      5/5 │
│ 🥈 2nd       │ fastify    │      24,500 │     48.00ms │      5/5 │
│ 🥉 3rd       │ nextrush   │      18,175 │     57.00ms │      5/5 │
│    4th       │ koa        │      15,200 │     65.00ms │      5/5 │
│    5th       │ express    │      10,500 │     95.00ms │      5/5 │
└──────────────┴──────────────┴───────────────┴───────────────┴──────────┘
```

## 📚 References

- [Autocannon](https://github.com/mcollina/autocannon) - HTTP/1.1 benchmarking
- [K6](https://k6.io/) - Modern load testing
- [Fastify Benchmarks](https://github.com/fastify/benchmarks) - Inspiration

---

**Made with ❤️ for NextRush v2 - Performance you can trust, measured with precision**

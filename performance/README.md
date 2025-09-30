# Performance Benchmarks

Professional performance benchmarks comparing **NextRush v2** against **Express**, **Koa**, and **Fastify**.

## 🎯 Methodology

### Fairness Principles

1. **Identical Routes** - All frameworks implement the exact same routes with identical logic
2. **Production Mode** - All frameworks run in production mode (no debug logging)
3. **Minimal Middleware** - Only essential middleware (body parser for JSON routes)
4. **Same Environment** - Sequential tests on the same hardware
5. **Multiple Runs** - Each test runs 3 times, median result reported
6. **Warm-up Phase** - 30s warm-up before each test

### Test Scenarios

| Scenario             | Route                         | Purpose                               |
| -------------------- | ----------------------------- | ------------------------------------- |
| **Hello World**      | `GET /`                       | Baseline throughput, minimal overhead |
| **Route Parameters** | `GET /users/:id`              | Router performance, param parsing     |
| **Query Strings**    | `GET /search?q=test&limit=10` | Query parsing efficiency              |
| **POST JSON**        | `POST /users`                 | Body parser performance               |
| **Mixed Workload**   | All routes combined           | Real-world traffic pattern            |

### Metrics Tracked

- **Requests/sec (RPS)** - Throughput
- **Latency p50** - Median latency
- **Latency p95** - 95th percentile
- **Latency p99** - 99th percentile
- **Memory (RSS)** - Process memory
- **CPU %** - CPU utilization
- **Errors** - Error rate

### Tools Used

- **[autocannon](https://github.com/mcollina/autocannon)** - HTTP/1.1 benchmarking (created by Fastify team)
- **[k6](https://k6.io/)** - Modern load testing
- **[pidusage](https://github.com/soyuka/pidusage)** - System resource monitoring

## 🚀 Quick Start

### Prerequisites

```bash
# Install k6 (for Ubuntu/Debian)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Or install via snap
sudo snap install k6
```

### Install Dependencies

```bash
cd performance
pnpm install
```

### Run All Benchmarks

```bash
# Run complete benchmark suite (autocannon + k6)
pnpm bench

# Or run specific tests
pnpm bench:hello     # Hello World test
pnpm bench:params    # Route parameters test
pnpm bench:query     # Query strings test
pnpm bench:post      # POST JSON test
pnpm bench:mixed     # Mixed workload test
```

### Generate Report

```bash
# Analyze results and generate markdown report
pnpm analyze
pnpm report
```

## 📊 Test Configuration

### Autocannon Settings

```javascript
{
  connections: 100,      // Concurrent connections
  duration: 40,         // Test duration (seconds)
  pipelining: 10,       // Requests per connection
  warmup: 30            // Warm-up duration (seconds)
}
```

### K6 Settings

```javascript
{
  vus: 100,             // Virtual users
  duration: '60s',      // Test duration
  thresholds: {
    http_req_duration: ['p(95)<100'],  // 95% under 100ms
    http_req_failed: ['rate<0.01']     // Error rate < 1%
  }
}
```

## 🏗️ Project Structure

```
performance/
├── servers/              # Test servers for each framework
│   ├── nextrush.js      # NextRush v2 server
│   ├── express.js       # Express server
│   ├── koa.js          # Koa server
│   └── fastify.js      # Fastify server
├── tests/
│   ├── autocannon/     # Autocannon tests
│   │   ├── hello.js
│   │   ├── params.js
│   │   ├── query.js
│   │   ├── post.js
│   │   ├── mixed.js
│   │   └── run-all.sh
│   └── k6/            # K6 load tests
│       ├── hello.js
│       ├── params.js
│       ├── query.js
│       ├── post.js
│       ├── mixed.js
│       └── run-all.sh
├── scripts/
│   ├── run-benchmark.sh    # Master benchmark script
│   ├── run-single.js       # Run single test
│   ├── analyze.js          # Results analyzer
│   └── generate-report.js  # Report generator
├── results/                # Test results (JSON, CSV, MD)
├── package.json
└── README.md
```

## 📈 Expected Results

Based on design and optimizations:

| Framework       | RPS (Expected) | Latency p95 | Memory  |
| --------------- | -------------- | ----------- | ------- |
| **NextRush v2** | ~45,000        | < 25ms      | < 100MB |
| **Fastify**     | ~47,000        | < 20ms      | < 80MB  |
| **Koa**         | ~35,000        | < 30ms      | < 70MB  |
| **Express**     | ~10,000        | < 100ms     | < 50MB  |

_Actual results will be updated after running benchmarks_

## 🔬 Test Environment

### Hardware

- **CPU**: [Will be auto-detected]
- **RAM**: [Will be auto-detected]
- **OS**: [Will be auto-detected]
- **Node.js**: [Will be auto-detected]

### Configuration

- `NODE_ENV=production`
- Single process (no clustering for clarity)
- No external middleware except body parser
- Keep-alive enabled
- HTTP/1.1

## 🎓 Understanding the Results

### Requests/sec (RPS)

- Higher is better
- Indicates maximum throughput
- Real-world apps rarely need > 10,000 RPS per instance

### Latency (p50, p95, p99)

- Lower is better
- **p50** - 50% of requests finish faster
- **p95** - 95% of requests finish faster (important for UX)
- **p99** - 99% of requests finish faster (tail latency)

### Memory Usage

- Lower is better for density
- Important for cloud costs
- NextRush v2 uses context pooling for efficiency

### Trade-offs

- **NextRush v2**: Balance of performance, features, and DX
- **Fastify**: Fastest, but less flexible
- **Koa**: Minimal, requires more middleware
- **Express**: Mature ecosystem, but slower

## 📝 Contributing

To add a new benchmark:

1. Create server in `servers/[framework].js`
2. Add test in `tests/autocannon/[test-name].js`
3. Add k6 test in `tests/k6/[test-name].js`
4. Update `run-benchmark.sh`
5. Run and validate results

## ⚠️ Disclaimer

- Benchmarks are run on virtual hardware (GitHub Actions)
- Results can vary due to "noisy neighbor" effect
- These tests measure framework overhead, not real-world app performance
- Your mileage may vary based on:
  - Hardware specifications
  - Network conditions
  - Application logic complexity
  - Middleware usage

## 📚 References

- [Fastify Benchmarks](https://github.com/fastify/benchmarks)
- [Autocannon Documentation](https://github.com/mcollina/autocannon)
- [K6 Documentation](https://k6.io/docs/)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)

## 📄 License

MIT - Same as NextRush v2

---

**Made with ❤️ for NextRush v2 - Proving performance claims with data**

# 🚀 NextRush v2 Performance Benchmarks

Professional performance testing suite comparing NextRush v2 against Express, Koa, and Fastify.

## Quick Start

```bash
# Install dependencies
cd performance
pnpm install

# Run complete benchmark suite (autocannon + k6)
pnpm bench

# Or run individually
pnpm bench:autocannon  # HTTP load testing with autocannon
pnpm bench:k6          # Load testing with k6

# Analyze results
pnpm analyze           # Generate statistical analysis

# Generate comprehensive report
pnpm report            # Creates BENCHMARK_REPORT.md
```

## Benchmark Tools

### 🔧 Autocannon

- **What**: HTTP/1.1 benchmarking tool
- **Configuration**: 100 connections, 40s duration, pipelining 10
- **Best for**: Maximum throughput testing
- **Output**: RPS, latency percentiles, throughput

### 🔧 K6

- **What**: Modern load testing tool
- **Configuration**: 100 VUs, 60s duration
- **Best for**: Realistic user behavior simulation
- **Output**: Request duration, iterations, failure rates

## Test Scenarios

### 1. Hello World (`/`)

Simple GET request returning JSON.

**Request:**

```
GET http://localhost:3000/
```

**Response:**

```json
{
  "message": "Hello World",
  "framework": "nextrush"
}
```

### 2. Route Parameters (`/users/:id`)

Dynamic route parameter parsing.

**Request:**

```
GET http://localhost:3000/users/123
```

**Response:**

```json
{
  "userId": "123",
  "framework": "nextrush"
}
```

### 3. Query Strings (`/search?q=term&page=1`)

Query parameter handling.

**Request:**

```
GET http://localhost:3000/search?q=nodejs&page=1
```

**Response:**

```json
{
  "query": "nodejs",
  "page": "1",
  "framework": "nextrush"
}
```

### 4. POST JSON (`POST /users`)

JSON body parsing and validation.

**Request:**

```
POST http://localhost:3000/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}
```

**Response:**

```json
{
  "user": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "framework": "nextrush"
}
```

### 5. Mixed Workload

Realistic traffic simulation:

- 60% GET requests (Hello World)
- 20% Route parameters
- 20% Query strings
- 10% POST requests

## Methodology

### Fair Comparison Standards

All frameworks tested with:

- ✅ **Production mode** (`NODE_ENV=production`)
- ✅ **Minimal middleware** (only JSON body parser)
- ✅ **No logging middleware**
- ✅ **Identical routes and logic**
- ✅ **Same response payloads**
- ✅ **30s warmup period**
- ✅ **5s cooldown between tests**

### Benchmark Process

1. **Server Startup**: Each framework starts in production mode
2. **Health Check**: Wait for server to be ready
3. **Warmup**: 30s warmup period with light traffic
4. **Test Execution**: Run benchmark with configured load
5. **Cooldown**: 5s cooldown before next test
6. **Result Collection**: Save metrics to JSON files
7. **Analysis**: Calculate statistics and comparisons

## Framework Configurations

### NextRush v2

```javascript
const app = createApp({
  debug: false,
  smartBodyParser: true,
  keepAliveTimeout: 5000,
  requestTimeout: 30000,
});
```

### Express

```javascript
const app = express();
app.use(express.json());
app.disable('x-powered-by');
app.disable('etag');
```

### Koa

```javascript
const app = new Koa();
app.use(bodyParser());
app.silent = true;
```

### Fastify

```javascript
const app = fastify({
  logger: false,
  trustProxy: false,
  ignoreTrailingSlash: true,
});
```

## Results Structure

```
performance/
├── results/
│   ├── nextrush-hello-autocannon.json
│   ├── nextrush-hello-k6.json
│   ├── express-hello-autocannon.json
│   ├── ...
│   ├── BENCHMARK_RESULTS.md      # Autocannon analysis
│   └── BENCHMARK_REPORT.md       # Comprehensive report
```

## Interpreting Results

### Key Metrics

**Requests Per Second (RPS)**

- Higher is better
- Measures throughput capacity
- Industry standard metric

**Latency Percentiles**

- `p50`: Median response time (50% of requests)
- `p95`: 95th percentile (95% of requests faster than this)
- `p99`: 99th percentile (tail latency)
- Lower is better

**Throughput (MB/s)**

- Data transfer rate
- Higher is better
- Important for large payloads

**Error Rate**

- Failed requests / total requests
- Should be < 1%
- 0% is ideal

### Performance Targets

Based on Fastify benchmarks and industry standards:

| Framework | Expected RPS | p95 Latency |
| --------- | ------------ | ----------- |
| Fastify   | ~47,000      | < 50ms      |
| NextRush  | ~45,000      | < 50ms      |
| Koa       | ~35,000      | < 60ms      |
| Express   | ~10,000      | < 100ms     |

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Performance Benchmarks

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          npm install -g pnpm
          cd performance && pnpm install

      - name: Run benchmarks
        run: cd performance && pnpm bench

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: benchmark-results
          path: performance/results/
```

## Troubleshooting

### Server won't start

```bash
# Check if port 3000 is in use
lsof -ti:3000

# Kill process using port 3000
kill -9 $(lsof -ti:3000)
```

### K6 not found

```bash
# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# macOS
brew install k6
```

### Autocannon errors

```bash
# Reinstall autocannon
cd performance
rm -rf node_modules
pnpm install
```

### Low RPS results

- Close other applications
- Disable antivirus temporarily
- Ensure CPU is not throttled
- Run on dedicated hardware if possible
- Check system resource usage

## Advanced Usage

### Custom Test Duration

```bash
# Modify in test files or set environment variable
DURATION=60 pnpm bench:autocannon
```

### Custom Port

```bash
PORT=8080 pnpm bench
```

### Single Framework Test

```bash
# Start specific server
NODE_ENV=production node servers/nextrush.js

# In another terminal, run specific test
node tests/autocannon/hello.js
```

### Warm Cache Testing

```bash
# Run warmup separately
./scripts/run-benchmark.sh

# Then run test immediately
node tests/autocannon/hello.js
```

## Benchmark History

Track performance over time:

```bash
# Save results with git tag
git tag v2.0.0-alpha.1-bench
cp results/BENCHMARK_REPORT.md docs/benchmarks/v2.0.0-alpha.1.md
git add docs/benchmarks/
git commit -m "chore: add v2.0.0-alpha.1 benchmark results"
```

## Contributing

### Adding New Test Scenarios

1. Create autocannon test in `tests/autocannon/`
2. Create k6 test in `tests/k6/`
3. Update `TESTS` array in scripts
4. Add test route to all framework servers
5. Update this README

### Modifying Benchmark Parameters

Edit configuration in:

- `tests/autocannon/*.js` - autocannon settings
- `tests/k6/*.js` - k6 options
- `scripts/run-benchmark.sh` - test orchestration

## References

- [Fastify Benchmarks](https://github.com/fastify/benchmarks)
- [Autocannon Documentation](https://github.com/mcollina/autocannon)
- [K6 Documentation](https://k6.io/docs/)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)

## License

MIT - See LICENSE file in project root

---

**Built with ❤️ for fair, accurate, and reproducible benchmarks**

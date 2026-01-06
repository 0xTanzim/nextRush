# 🚀 NextRush v3 Performance Benchmarks Manual

## Overview

The NextRush v3 Performance Benchmarks suite is a comprehensive, enterprise-grade benchmarking tool designed to measure and compare the performance of NextRush v3 against popular Node.js web frameworks including Express, Fastify, Koa, and Hono.

### Key Features

- **Multi-Framework Comparison**: Benchmark NextRush v3 against Express, Fastify, Koa, and Hono
- **Comprehensive Test Suite**: 5 different test scenarios covering real-world use cases
- **Automated Server Management**: Automatic server startup, health checks, and graceful shutdown
- **Detailed Reporting**: JSON results, Markdown reports, and console output
- **Performance Tracking**: Historical comparison and trend analysis
- **Enterprise-Ready**: Production-grade error handling and logging

### Test Scenarios

1. **Hello World** - Simple JSON response (baseline performance)
2. **Route Parameters** - Dynamic routes with parameters (router performance)
3. **Query Strings** - URL query parsing (query parser performance)
4. **POST JSON** - JSON body parsing (body parser performance)
5. **Mixed Workload** - Combined operations (real-world simulation)

## Prerequisites

- **Node.js**: >= 20.0.0
- **pnpm**: Latest version
- **Operating System**: Linux, macOS, or Windows (Linux recommended for consistent results)

## Installation

1. Navigate to the performance benchmarks directory:
   ```bash
   cd apps/performance-ultra
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Verify installation:
   ```bash
   pnpm --version
   node --version
   ```

## Quick Start

### Run NextRush v3 Only Benchmark
```bash
pnpm bench:v3
```

### Run Quick Benchmark (10 seconds per test)
```bash
pnpm bench:v3:quick
```

### Run Full Framework Comparison
```bash
pnpm bench:all
```

## Available Commands

### Benchmark Scripts

| Command | Description |
|---------|-------------|
| `pnpm bench` | Run full benchmark comparison (all frameworks) |
| `pnpm bench:quick` | Run quick benchmark comparison (10s per test) |
| `pnpm bench:v3` | Run NextRush v3 dedicated benchmark |
| `pnpm bench:v3:quick` | Run NextRush v3 quick benchmark |
| `pnpm bench:v3:compare` | Compare current results with previous runs |
| `pnpm bench:v3:history` | View performance history and trends |
| `pnpm bench:v3:trend` | Analyze performance trends over time |

### Utility Scripts

| Command | Description |
|---------|-------------|
| `pnpm setup` | Install dependencies |
| `pnpm clean` | Remove results directory |
| `pnpm clean:all` | Remove all generated files |

## Command Line Parameters

### Global Parameters

All benchmark scripts support the following parameters:

#### `--quick`
Run quick benchmarks (10 seconds per test instead of 30 seconds).
```bash
pnpm bench:v3 --quick
pnpm bench:all --quick
```

#### `--duration <seconds>`
Set custom test duration per test scenario.
```bash
pnpm bench:v3 --duration 60    # 60 seconds per test
pnpm bench:all --duration 45   # 45 seconds per test
```

#### `--label "<text>"`
Add a custom label to the benchmark run for identification.
```bash
pnpm bench:v3 --label "v3.0-alpha"
pnpm bench:all --label "production-server"
```

#### `--frameworks <list>`
Specify which frameworks to benchmark (comma-separated, for `bench:all` only).
```bash
pnpm bench:all --frameworks nextrush-v3,hono
pnpm bench:all --frameworks express,fastify,koa
```

#### `--verbose` or `-v`
Enable verbose output (for `bench:v3` only).
```bash
pnpm bench:v3 --verbose
```

### Parameter Examples

```bash
# Quick benchmark with custom label
pnpm bench:v3:quick --label "hotfix-test"

# Full comparison with specific frameworks and custom duration
pnpm bench:all --frameworks nextrush-v3,fastify,hono --duration 45

# NextRush v3 benchmark with verbose output
pnpm bench:v3 --duration 60 --verbose --label "optimization-test"
```

## Understanding Results

### Console Output

The benchmark displays results in a formatted table:

```
┌────────────────────┬──────────────┬─────────────┬─────────────┬───────────────┐
│ Test               │ RPS          │ Latency p50 │ Latency p99 │ vs Previous   │
├────────────────────┼──────────────┼─────────────┼─────────────┼───────────────┤
│ Hello World        │    32,144    │     3.1ms   │     4.2ms   │ ↑ +2.1%       │
│ Route Parameters   │    31,892    │     3.2ms   │     4.3ms   │ → 0.0%        │
│ Query Strings      │    31,567    │     3.2ms   │     4.4ms   │ ↓ -1.5%       │
│ POST JSON          │    30,123    │     3.4ms   │     4.6ms   │ ↑ +3.2%       │
│ Mixed Workload     │    31,998    │     3.1ms   │     4.2ms   │ ↑ +1.8%       │
└────────────────────┴──────────────┴─────────────┴─────────────┴───────────────┘
```

### Metrics Explained

- **RPS (Requests Per Second)**: Number of requests processed per second
- **Latency p50**: Median response time (50th percentile)
- **Latency p99**: 99th percentile response time (worst-case performance)
- **vs Previous**: Performance change compared to last benchmark run

### Performance Summary

```
📈 Average RPS: 31,545 requests/sec
⚡ Average Latency: 3.2ms (p50)
```

### Ranking (Multi-Framework)

```
┌──────────────┬──────────────┬───────────────┬───────────────┬──────────┐
│ Rank         │ Framework    │ Avg RPS       │ Latency (p50) │ Tests    │
├──────────────┼──────────────┼───────────────┼───────────────┼──────────┤
│ 🥇 1st       │ nextrush-v3  │    31,545     │     3.2ms     │ 5/5      │
│ 🥈 2nd       │ hono         │    28,932     │     3.5ms     │ 5/5      │
│ 🥉 3rd       │ fastify      │    26,118     │     3.9ms     │ 5/5      │
└──────────────┴──────────────┴───────────────┴───────────────┴──────────┘
```

## Results Storage

### Directory Structure

```
results/
├── comparison/           # Multi-framework comparison results
│   ├── 2025-12-25_14-30-15/  # Timestamped results
│   │   ├── results.json      # Raw JSON data
│   │   ├── REPORT.md         # Markdown report
│   │   └── [framework].json  # Individual framework results
│   └── latest/               # Symlink to latest results
└── nextrush-v3/         # NextRush v3 dedicated results
    ├── 2025-12-25_14-30-15/
    │   ├── results.json
    │   └── REPORT.md
    └── latest/
```

### File Formats

#### results.json
Contains complete benchmark data including:
- System information (CPU, memory, Node.js version)
- Test configuration (duration, connections, etc.)
- Detailed results for each test scenario
- Performance metrics and statistics

#### REPORT.md
Human-readable Markdown report with:
- System information table
- Test configuration
- Results summary table
- Detailed per-test breakdown
- Performance comparison (if applicable)

## Adding Custom Parameters

### Modifying Test Configuration

To add new command-line parameters, edit the `parseArgs()` function in the benchmark scripts:

```javascript
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    quick: args.includes('--quick'),
    duration: DEFAULT_DURATION,
    label: '',
    customParam: '',  // Add your custom parameter
  };

  // Add parsing for your custom parameter
  const customIdx = args.indexOf('--custom-param');
  if (customIdx !== -1 && args[customIdx + 1]) {
    config.customParam = args[customIdx + 1];
  }

  // ... rest of parsing logic
  return config;
}
```

### Adding New Test Scenarios

To add a new test scenario, modify the `TESTS` array:

```javascript
const TESTS = [
  // ... existing tests
  {
    name: 'custom',
    title: 'Custom Test',
    description: 'Your custom test scenario',
    url: `http://localhost:${PORT}/custom-endpoint`,
    method: 'POST',
    body: JSON.stringify({ data: 'test' }),
    headers: { 'content-type': 'application/json' },
  },
];
```

### Modifying Benchmark Settings

Key configuration constants that can be customized:

```javascript
const DEFAULT_DURATION = 30;    // Default test duration (seconds)
const QUICK_DURATION = 10;     // Quick mode duration
const CONNECTIONS = 100;       // Concurrent connections
const PIPELINING = 10;         // HTTP pipelining factor
const WARMUP_TIME = 3000;      // Server warmup time (ms)
const PORT = 3000;             // Server port
```

## Adding New Frameworks

### 1. Create Server Implementation

Create a new server file in `servers/` directory:

```javascript
// servers/new-framework.js
import { createServer } from 'http';

// Your framework setup here
const app = createYourApp();

// Create HTTP server
const server = createServer(app);

// Export for testing
export { app };

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`New Framework running on http://localhost:${port}`);
  });
}
```

### 2. Implement Required Routes

Ensure your server implements all test endpoints:

```javascript
// Hello World
app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

// Route Parameters
app.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id });
});

// Query Strings
app.get('/search', (req, res) => {
  res.json({ query: req.query.q, limit: req.query.limit });
});

// POST JSON (conditional body parsing)
app.post('/users', (req, res) => {
  // Only parse body for this specific route
  const body = parseBody(req);
  res.json({ created: true, user: body });
});

// Mixed workload
app.get('/mixed', (req, res) => {
  res.json({ mixed: true });
});
```

### 3. Add to Framework List

Update the `AVAILABLE_FRAMEWORKS` array in `benchmark-all.js`:

```javascript
const AVAILABLE_FRAMEWORKS = [
  'nextrush-v3',
  'express',
  'fastify',
  'koa',
  'hono',
  'new-framework',  // Add your framework
];
```

### 4. Add Dependencies

Update `package.json` with required dependencies:

```json
{
  "devDependencies": {
    "new-framework": "^1.0.0",
    // ... other deps
  }
}
```

### 5. Test the Implementation

Run a quick test to ensure the server starts correctly:

```bash
node servers/new-framework.js
# Should output: "New Framework running on http://localhost:3000"
```

Then run the benchmark:

```bash
pnpm bench:all --frameworks new-framework --quick
```

## Troubleshooting

### Common Issues

#### Server Won't Start
**Symptoms**: "Server failed to start within timeout"
**Solutions**:
- Check server implementation for syntax errors
- Verify all dependencies are installed
- Ensure port 3000 is available
- Check server logs for error messages

#### Low RPS Results
**Symptoms**: Unexpectedly low performance numbers
**Solutions**:
- Ensure server is running in production mode
- Check system resources (CPU, memory)
- Verify no other processes are consuming resources
- Compare with baseline results on same hardware

#### EPIPE/ECONNRESET Errors
**Symptoms**: Error messages during benchmark execution
**Note**: These are normal during high-load testing and are automatically suppressed. No action needed.

#### Memory Issues
**Symptoms**: Out of memory errors or crashes
**Solutions**:
- Reduce CONNECTIONS constant
- Increase system memory
- Run fewer concurrent tests
- Check for memory leaks in server implementation

### Debug Mode

Enable verbose logging for detailed information:

```bash
pnpm bench:v3 --verbose
```

### Health Checks

Manually test server health:

```bash
# Start server
node servers/nextrush-v3.js

# Test endpoints in another terminal
curl http://localhost:3000/
curl http://localhost:3000/users/123
curl -X POST http://localhost:3000/users -H "Content-Type: application/json" -d '{"name":"test"}'
```

### Performance Validation

Compare results across different runs to identify anomalies:

```bash
# Run multiple times to check consistency
pnpm bench:v3:quick --label "run1"
pnpm bench:v3:quick --label "run2"
pnpm bench:v3:compare
```

## Advanced Usage

### Custom Test Scenarios

Create specialized benchmarks for specific use cases:

```javascript
const CUSTOM_TESTS = [
  {
    name: 'auth-heavy',
    title: 'Authentication Heavy',
    description: 'JWT validation and user lookup',
    url: `http://localhost:${PORT}/api/protected`,
    method: 'GET',
    headers: { 'authorization': 'Bearer token' },
  },
  // ... more custom tests
];
```

### Automated Regression Testing

Set up CI/CD integration:

```bash
#!/bin/bash
# ci-benchmark.sh

# Run benchmark
pnpm bench:v3 --label "ci-$(date +%s)"

# Check performance regression
node scripts/check-regression.js

# Fail CI if performance dropped >5%
if [ $? -ne 0 ]; then
  echo "Performance regression detected!"
  exit 1
fi
```

### Performance Monitoring

Track performance over time:

```bash
# Daily automated benchmarks
crontab -e
# Add: 0 2 * * * cd /path/to/project && pnpm bench:v3 --label "daily-$(date +\%Y\%m\%d)"

# View trends
pnpm bench:v3:trend
```

## Examples

### Complete Benchmark Run

```bash
cd apps/performance-ultra

# Full NextRush v3 benchmark
pnpm bench:v3

# Quick comparison of specific frameworks
pnpm bench:quick --frameworks nextrush-v3,hono,fastify

# Custom duration benchmark with label
pnpm bench:v3 --duration 120 --label "extended-test"

# View results
cat results/nextrush-v3/latest/REPORT.md
```

### CI/CD Integration Example

```yaml
# .github/workflows/benchmark.yml
name: Performance Benchmark
on: [push, pull_request]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: cd apps/performance-ultra && pnpm bench:v3:quick --label "pr-${{ github.event.number }}"
      - uses: actions/upload-artifact@v3
        with:
          name: benchmark-results
          path: apps/performance-ultra/results/
```

## Contributing

### Code Style
- Follow existing code patterns
- Add JSDoc comments for new functions
- Test server implementations manually before benchmarking
- Update this manual when adding new features

### Testing New Frameworks
1. Implement server with all required routes
2. Test manually with curl
3. Run quick benchmark first
4. Compare results with existing frameworks
5. Update documentation

---

## Support

For issues or questions:
- Check the troubleshooting section above
- Review server logs for error messages
- Compare with working framework implementations
- Ensure all dependencies are correctly installed

---

*Generated for NextRush v3 Performance Benchmarks Suite*

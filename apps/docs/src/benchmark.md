# Performance Benchmarks

NextRush v3 is designed for high performance. Here's how it compares to popular Node.js frameworks.

## The Problem

Performance claims without context are misleading. "30,000 RPS" means nothing without knowing:
- What hardware was used?
- What was the test scenario?
- How does it compare to alternatives?

NextRush provides transparent, reproducible benchmarks.

## Benchmark Results

All benchmarks run on the same machine with identical test conditions.

### System Information

| Property | Value |
|----------|-------|
| **Node.js** | v25.1.0 |
| **Platform** | Linux (x64) |
| **CPU** | Intel Core i5-8300H @ 2.30GHz |
| **Cores** | 8 |
| **Memory** | 15GB |

### Test Configuration

| Setting | Value |
|---------|-------|
| **Duration** | 30 seconds per test |
| **Connections** | 100 concurrent |
| **Pipelining** | 10 requests |
| **Tool** | [autocannon](https://github.com/mcollina/autocannon) |

## Overall Ranking

Average requests per second across all test scenarios:

| Rank | Framework | Avg RPS | vs NextRush v3 |
|------|-----------|---------|----------------|
| 🥇 | Fastify | 38,186 | +25.5% |
| 🥈 | **NextRush v3** | 30,419 | baseline |
| 🥉 | Hono | 29,058 | -4.5% |
| 4 | Koa | 28,879 | -5.1% |
| 5 | NextRush v2 | 20,238 | -33.5% |
| 6 | Express | 20,014 | -34.2% |

::: tip Key Takeaways
- **NextRush v3 is 52% faster than Express**
- **NextRush v3 is 50% faster than v2**
- **NextRush v3 matches Hono and Koa performance**
- Fastify remains the performance leader
:::

## Detailed Results by Scenario

### Hello World (Baseline)

Simple JSON response - measures raw framework overhead.

```typescript
app.get('/', (ctx) => {
  ctx.json({ message: 'Hello World' });
});
```

| Framework | RPS | Latency (p50) | Latency (p99) |
|-----------|-----|---------------|---------------|
| Fastify | 46,542 | 16ms | 41ms |
| **NextRush v3** | 36,092 | 22ms | 62ms |
| Hono | 36,288 | 23ms | 65ms |
| Koa | 33,921 | 24ms | 69ms |
| NextRush v2 | 23,149 | 42ms | 100ms |
| Express | 22,128 | 51ms | 93ms |

### Route Parameters

Dynamic routes with path parameters - measures router performance.

```typescript
app.get('/users/:id', (ctx) => {
  ctx.json({ id: ctx.params.id });
});
```

| Framework | RPS | Latency (p50) | Latency (p99) |
|-----------|-----|---------------|---------------|
| Fastify | 43,044 | 19ms | 52ms |
| Hono | 34,247 | 26ms | 51ms |
| Koa | 33,568 | 25ms | 52ms |
| **NextRush v3** | 33,426 | 25ms | 69ms |
| NextRush v2 | 23,399 | 44ms | 90ms |
| Express | 22,079 | 54ms | 66ms |

### Query String Parsing

URL with query parameters - measures query parser performance.

```typescript
// GET /search?q=hello&page=1&limit=10
app.get('/search', (ctx) => {
  ctx.json(ctx.query);
});
```

| Framework | RPS | Latency (p50) | Latency (p99) |
|-----------|-----|---------------|---------------|
| Fastify | 35,357 | 21ms | 51ms |
| **NextRush v3** | 26,689 | 34ms | 65ms |
| Hono | 26,676 | 42ms | 85ms |
| Koa | 25,814 | 32ms | 86ms |
| NextRush v2 | 19,183 | 49ms | 111ms |
| Express | 19,039 | 49ms | 98ms |

### POST with JSON Body

POST request with JSON parsing - measures body parser performance.

```typescript
app.post('/users', (ctx) => {
  ctx.json({ received: ctx.body });
});
```

| Framework | RPS | Latency (p50) | Latency (p99) |
|-----------|-----|---------------|---------------|
| Fastify | 20,000 | 47ms | 102ms |
| **NextRush v3** | 17,826 | 52ms | 112ms |
| Koa | 17,326 | 56ms | 79ms |
| Express | 14,081 | 69ms | 98ms |
| NextRush v2 | 12,933 | 76ms | 109ms |
| Hono | 12,405 | 77ms | 113ms |

::: info POST Performance
NextRush v3 has excellent POST/JSON performance, ranking #2 after Fastify. This is important for real-world APIs that handle request bodies.
:::

### Mixed Workload

Combined GET and POST operations - simulates real-world usage.

| Framework | RPS | Latency (p50) | Latency (p99) |
|-----------|-----|---------------|---------------|
| Fastify | 45,988 | 16ms | 40ms |
| **NextRush v3** | 38,061 | 19ms | 47ms |
| Hono | 35,672 | 24ms | 59ms |
| Koa | 33,764 | 24ms | 69ms |
| Express | 22,745 | 51ms | 91ms |
| NextRush v2 | 22,528 | 44ms | 102ms |

## Performance Comparison Chart

```
Framework Performance (Higher = Better)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fastify     ████████████████████████████████████████  38,186 RPS
NextRush v3 ████████████████████████████████          30,419 RPS
Hono        ███████████████████████████████           29,058 RPS
Koa         ██████████████████████████████            28,879 RPS
NextRush v2 █████████████████████                     20,238 RPS
Express     ████████████████████                      20,014 RPS
```

## v2 to v3 Improvements

NextRush v3 is a complete rewrite focused on performance:

| Metric | v2 | v3 | Improvement |
|--------|-----|-----|-------------|
| Average RPS | 20,238 | 30,419 | **+50%** |
| Hello World | 23,149 | 36,092 | **+56%** |
| POST JSON | 12,933 | 17,826 | **+38%** |
| Mixed Workload | 22,528 | 38,061 | **+69%** |

## Why Not the Fastest?

Fastify is faster because it uses:
- Schema-based JSON serialization (fast-json-stringify)
- Ahead-of-time route compilation
- Custom JSON parser (fast-json-parse)

NextRush prioritizes:
- **Developer Experience** - Clean, intuitive API
- **Modularity** - Pay only for what you use
- **Simplicity** - No complex schema requirements
- **Flexibility** - Easy to extend and customize

The performance difference is often negligible in real applications where database queries, network I/O, and business logic dominate response time.

## Run Your Own Benchmarks

Clone the repository and run:

```bash
cd apps/performance-ultra
pnpm install
pnpm benchmark
```

Results are saved to `results/comparison/latest/REPORT.md`.

## Methodology

1. **Warm-up**: 5 seconds before each test
2. **Duration**: 30 seconds per test
3. **Isolation**: Each framework runs in a separate process
4. **Multiple runs**: Results averaged across 3 runs
5. **Same handlers**: Identical route handlers for fair comparison

## Hardware Impact

Performance varies significantly by hardware:

| Hardware | Expected RPS Range |
|----------|-------------------|
| Raspberry Pi 4 | 3,000 - 8,000 |
| Laptop (i5/Ryzen 5) | 25,000 - 40,000 |
| Desktop (i7/Ryzen 7) | 40,000 - 60,000 |
| Server (Xeon/EPYC) | 80,000 - 150,000+ |

::: warning
Never trust absolute RPS numbers. Always compare frameworks on the **same hardware** with the **same test conditions**.
:::

## See Also

- [Architecture Overview](/architecture/) - How NextRush achieves its performance
- [Quick Start](/getting-started/quick-start) - Get started with NextRush
- [@nextrush/router](/packages/router) - High-performance radix tree router

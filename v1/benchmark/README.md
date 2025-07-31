# 🚀 NextRush Benchmark Suite

A modular, zero-fake-data benchmark system for testing NextRush against other Node.js web frameworks.

## Features

- **Modular Architecture**: Clean separation of adapters, reporters, and core engine
- **Zero Dependencies for NextRush**: Tests our zero-dependency framework without polluting it
- **Real Measurements**: No fake data, all actual HTTP requests and measurements
- **Multiple Framework Support**: Express, Fastify, Koa, Hapi, and more
- **Comprehensive Reports**: JSON, Markdown, and CSV outputs
- **Beautiful Console Output**: Colored, formatted terminal output
- **Smart Installation Detection**: Automatically detects available frameworks
- **Memory & CPU Profiling**: Real performance metrics
- **Stress Testing**: Concurrent request testing

## Quick Start

### Install Dependencies

```bash
# From the benchmark directory
pnpm install

# Build TypeScript
pnpm run build
```

### Run Benchmarks

```bash
# Run all available frameworks
pnpm run benchmark

# Run specific frameworks
pnpm run benchmark:nextrush
pnpm run benchmark:express
pnpm run benchmark:compare

# Custom benchmark
node src/index.js nextrush express fastify
```

### View Results

Results are saved to `./results/` in multiple formats:

- `benchmark-YYYY-MM-DD.json` - Raw data
- `benchmark-YYYY-MM-DD.md` - Human-readable report
- `benchmark-YYYY-MM-DD.csv` - Analysis-ready data

## Architecture

```
benchmark/
├── src/
│   ├── core/           # Core engine and types
│   ├── adapters/       # Framework-specific adapters
│   ├── utils/          # HTTP client, logger, etc.
│   ├── reporters/      # Report generators
│   └── index.ts        # Main entry point
├── results/            # Generated reports
├── package.json        # Dependencies for testing
└── tsconfig.json       # TypeScript config
```

## Framework Support

| Framework | Status       | Installation                              |
| --------- | ------------ | ----------------------------------------- |
| NextRush  | ✅ Built-in  | No dependencies needed                    |
| Express   | ✅ Supported | `pnpm add express`                        |
| Fastify   | ✅ Supported | `pnpm add fastify`                        |
| Koa       | ✅ Supported | `pnpm add koa @koa/router koa-bodyparser` |
| Hapi      | ✅ Supported | `pnpm add @hapi/hapi`                     |

## Test Cases

1. **Simple Route** - Basic hello world (2000 requests)
2. **JSON Response** - Structured data response (2000 requests)
3. **Middleware Stack** - Multiple middleware (1500 requests)
4. **Parameter Parsing** - URL parameters (1500 requests)
5. **Error Handling** - Error performance (1000 requests)
6. **Large Payload** - 10KB responses (800 requests)
7. **POST Echo** - JSON body parsing (1200 requests)
8. **Nested Route** - Complex routing (1000 requests)
9. **Stress Tests** - Concurrent requests (10, 25, 50 concurrent)

## Configuration

Environment variables:

- `BENCHMARK_WARMUP=100` - Warmup requests
- `BENCHMARK_TIMEOUT=30000` - Request timeout (ms)
- `BENCHMARK_CONCURRENCY=50` - Max concurrency

## Adding New Frameworks

1. Create adapter in `src/adapters/[framework].ts`
2. Extend `FrameworkAdapter` base class
3. Register in `src/adapters/registry.ts`
4. Add dependencies to `package.json`

Example adapter structure:

```typescript
export class MyFrameworkAdapter extends FrameworkAdapter {
  readonly frameworkName = 'MyFramework';
  readonly packageName = 'my-framework';
  readonly dependencies = ['my-framework'];

  async createApp(): Promise<void> {
    /* ... */
  }
  async setupRoutes(): Promise<void> {
    /* ... */
  }
  async startServer(port: number): Promise<void> {
    /* ... */
  }
  async stopServer(): Promise<void> {
    /* ... */
  }
  getSupportedFeatures(): string[] {
    /* ... */
  }
}
```

## Why Separate Workspace?

This benchmark system is in its own workspace to:

1. **Keep NextRush Clean**: Our main framework stays zero-dependency
2. **Isolated Testing**: Dependencies don't interfere with main project
3. **Modular Design**: Easy to add/remove frameworks
4. **CI/CD Friendly**: Can run benchmarks independently
5. **Performance Focus**: Dedicated environment for accurate measurements

## Performance Tips

- Run benchmarks on dedicated hardware
- Close other applications during testing
- Use `--max-old-space-size=4096` for large tests
- Enable GC monitoring with `--expose-gc`
- Multiple runs for statistical significance

## Contributing

1. Add new framework adapters
2. Improve test cases
3. Enhance report formats
4. Optimize measurement accuracy
5. Add more metrics (latency percentiles, etc.)

---

Built with ❤️ for NextRush performance optimization

# NextRush v2 Benchmarks

🚀 Professional benchmarking suite for NextRush v2 using industry-standard tools.

## Overview

This package provides comprehensive benchmarking capabilities for NextRush v2, comparing it against other popular Node.js frameworks like Express, Fastify, and Koa.

## Features

- **Multiple Benchmarking Tools**: autocannon, artillery, clinic, k6
- **Framework Comparison**: NextRush vs Express vs Fastify vs Koa
- **Performance Metrics**: latency, throughput, memory usage, CPU usage
- **Stress Testing**: high-load scenarios and concurrency testing
- **Real-world Scenarios**: API endpoints, file uploads, database operations
- **Professional Reporting**: detailed reports with charts and analysis

## Installation

```bash
# Install dependencies
pnpm install

# Install system-level tools (k6, siege, ab)
./scripts/install-tools.sh
```

## Quick Start

```bash
# Run a basic benchmark
pnpm benchmark

# Compare NextRush with other frameworks
pnpm benchmark:compare

# Run specific framework benchmark
pnpm benchmark:nextrush
pnpm benchmark:express
pnpm benchmark:fastify
pnpm benchmark:koa
```

## Available Scripts

### Basic Benchmarks

- `pnpm benchmark` - Run all benchmarks
- `pnpm benchmark:nextrush` - Benchmark NextRush only
- `pnpm benchmark:express` - Benchmark Express only
- `pnpm benchmark:fastify` - Benchmark Fastify only
- `pnpm benchmark:koa` - Benchmark Koa only
- `pnpm benchmark:compare` - Compare all frameworks

### Specialized Tests

- `pnpm stress` - Stress testing with high load
- `pnpm memory` - Memory usage analysis
- `pnpm cpu` - CPU performance testing
- `pnpm latency` - Latency measurement
- `pnpm throughput` - Throughput testing
- `pnpm concurrent` - Concurrency testing
- `pnpm real-world` - Real-world scenario testing

### Analysis & Reporting

- `pnpm profile` - Performance profiling
- `pnpm analyze` - Detailed analysis
- `pnpm report` - Generate reports
- `pnpm validate` - Validate results

## Tools Used

### NPM Packages

- **autocannon**: HTTP/1.1 benchmarking tool
- **artillery**: Modern load testing toolkit
- **clinic**: Performance profiling tools
- **0x**: Node.js flamegraph generator
- **systeminformation**: System monitoring
- **pidusage**: Process monitoring
- **heapdump**: Memory analysis
- **v8-profiler-next**: V8 profiling

### System Tools (Installed Separately)

- **k6**: Modern load testing tool
- **siege**: HTTP load testing utility
- **ab (Apache Bench)**: HTTP server benchmarking

## Configuration

The benchmarking suite is highly configurable through:

- Environment variables
- Configuration files
- Command-line options
- Framework-specific settings

## Results

Benchmark results are stored in:

- `results/` - Raw benchmark data
- `reports/` - Generated reports
- `profiles/` - Performance profiles

## Contributing

When adding new benchmarks:

1. Follow the existing patterns
2. Include proper error handling
3. Add comprehensive documentation
4. Ensure cross-platform compatibility
5. Include performance metrics

## License

MIT License - see LICENSE file for details.

# 🚀 NextRush v2 Benchmarks

Simple, clean benchmark comparison between web frameworks.

## Quick Start

```bash
# Install dependencies
pnpm install

# Install benchmark tools
pnpm setup:tools

# Run comparison
pnpm bench
```

## What It Does

Compares NextRush v2 against Express, Fastify, and Koa:

- **Simple HTTP routes** (`/hello`, `/json`, `/echo`)
- **30-second tests** with 100 concurrent connections
- **Clean results table** with RPS, latency, and errors

## Results Format

```
🏆 Results:
┌─────────────┬─────────┬─────────┬────────┐
│ Framework   │ RPS     │ Latency │ Errors │
├─────────────┼─────────┼─────────┼────────┤
│ 🥇 NextRush │   45000 │   2.1ms │      0 │
│ 🥈 Fastify  │   38000 │   2.6ms │      0 │
│ 🥉 Express  │   15000 │   6.5ms │      0 │
│    Koa      │   12000 │   8.1ms │      0 │
└─────────────┴─────────┴─────────┴────────┘
```

## Files

- `src/simple-bench.ts` - Main benchmark runner
- `src/adapters/` - Framework adapters (NextRush, Express, Fastify, Koa)
- `scripts/install-tools.sh` - Installs autocannon and other tools

**That's it!** No complex configurations, no confusing options.

---
title: Performance & Benchmarking
type: topic
created: 2026-07-10
sources: [readme-2026-07-10]
tags: [performance, benchmark]
---
# Performance & Benchmarking

## Current Status (as of README, 2026-07-10)
**Published numbers are withdrawn pending re-measurement.** Earlier figures came from single-run sessions on a shared machine, not reproducible to a publishable standard. Run the suite yourself for current numbers.

## Harness (`apps/benchmark`)
Compares 6 servers (NextRush + Fastify, Hono, Koa, Express, raw Node.js baseline) across 10 scenarios using **wrk** (C-based, process-isolated) and **autocannon** (Node.js-based).

Guarantees:
- Fairness validated, not assumed — `pnpm bench:validate` asserts byte-identical response bodies/statuses/middleware headers across all six before any timing.
- Publishable numbers require multi-run: `standard` profile = 3 runs, `full` profile = 5 runs; each reports mean ± stddev and CV.
- Identical runtime config: same Node flags, `NODE_ENV=production`, same payloads.
- Honest scope: 8/10 scenarios do byte-identical work; middleware and error scenarios use each framework's idiomatic mechanism and are explicitly labeled not-like-for-like.

```bash
cd apps/benchmark
pnpm install
pnpm bench:validate
pnpm bench:compare --profile full
```

## Targets (from global-rules steering)
| Metric | Target |
|---|---|
| Hello World RPS | 35,000+ |
| Core size | <3,000 LOC |
| Cold start | <30ms |
| Memory footprint | <200KB |

## Rules
- No unnecessary allocations in hot paths (middleware chain, router lookup)
- No closures in tight loops
- Static dispatch over dynamic where possible
- No blocking I/O in core/middleware packages
- No deep cloning in request lifecycle
- No JSON.stringify/parse round-trips for internal data transfer

## Related
- [[topics/engineering-standards]] — zero-dependency rule underpins these numbers.

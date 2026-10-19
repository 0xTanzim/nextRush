# Framework and runtime comparison method

## Questions to answer separately

Do not collapse all behavior into “fastest framework.” Measure or source-verify each axis independently:

1. Request hot path: fixed work before/after user handler, context creation, header/body handling, response finalization.
2. Router and middleware: registration cost, static/dynamic/wildcard route match, dispatch strategy, middleware count and `next()` behavior.
3. Runtime and adapter: Bun-native APIs vs Node HTTP/Web APIs, adapter-specific overhead, shared code vs forked request runners.
4. Cold start/registration: process startup, time to first response, scaling at small and large route counts.
5. Memory: baseline RSS, memory per route, peak and post-load RSS, heap/allocation profiles; ensure same measurement point.
6. Packaging: minified bundle size, what entrypoint was built, dependencies/validators included, tree-shaking, side effects and optional subpaths.
7. Compilation: runtime/JIT/registration-time compilation vs optional build-time AOT; build duration, output artifacts, dynamic-code/CSP/edge compatibility, fallback/debuggability.
8. Correctness and security: HTTP semantics, path normalization, errors, headers, streams, proxy trust, schema validation, context isolation, runtime conformance.
9. Developer/maintenance surface: public API choices, package boundaries, plugins, test burden, duplicated implementations and drift risk.

## Experimental controls

For a meaningful benchmark, align:

- hardware/VM/container and OS;
- exact runtime/framework versions and package lock;
- route table, handler, payload, headers, middleware, schemas and response behavior;
- connection count, keep-alive/client, worker count, duration and warm-up;
- profiler/instrumentation and output processing;
- benchmark order or randomized order if thermal/background effects may bias it.

Record deviations. Test frameworks in the same runtime separately (e.g. Bun-vs-Bun and Node-vs-Node); never compare one framework on Bun with another on Node and call the difference a framework effect.

## Source quality for “latest architecture” claims

Prefer this order:

1. Official versioned docs and release notes.
2. Maintainer-authored design posts and official repository source/issues/PRs.
3. Reproducible source-level inspection and a local minimal reproduction.
4. Independent benchmarks with published code/environment.
5. Blog summaries or marketing copy (leads only).

Record URL, access date, published date/version, relevant claim, and whether local reproduction exists. Label beta/experimental versions and do not imply they are stable. When source and code disagree, capture both and investigate; do not silently choose the convenient version.

## Interpreting results

- Throughput (`req/s`), latency percentiles, in-process microseconds/request, startup time, memory and bundle size are different metrics.
- Ratios from same-run measurements often travel better across machines than absolute measurements, but they do not remove every confounder.
- A profiler's inclusive `Total%` can include child calls; understand the profiler format before summing percentages.
- A hot function is a hypothesis for optimization, not a guaranteed speedup.
- A raw-runtime floor is a lower bound for a minimal equivalent handler, not a substitute for all framework features.
- Publish medians/distributions and all run counts under noisy conditions. Do not cherry-pick best runs or hide variance.
- Performance acceptance thresholds should come from the project's budget / user goal, not be chosen after seeing results.

## Avoiding cargo cult architecture

For each proposed competitor-inspired feature, document:

- What problem it solves in the competitor and evidence that the same problem exists here.
- Which NextRush goals it supports or conflicts with (runtime portability, no-build default, package modularity, safety, debugging, DX).
- The smallest experiment that tests the expected benefit.
- Cost to implementation and maintenance, failure modes, edge-runtime compatibility, migration and fallback.
- Evidence required before converting it into an RFC or default architecture.

# NextRush profiling workflow reference

This reference is derived from the supplied `framework-profiling` skill. It is useful only when the checked-out repo contains these scripts and entries. Verify all paths, CLI options, runtime requirements, dependency versions and budgets against the current checkout before executing anything.

## Preferred short feedback loop

Main runner described in the source guide:

```bash
node apps/benchmark/scripts/dev-check/check.mjs
node apps/benchmark/scripts/dev-check/check.mjs probe
node apps/benchmark/scripts/dev-check/check.mjs probe --rt node
node apps/benchmark/scripts/dev-check/check.mjs inproc
node apps/benchmark/scripts/dev-check/check.mjs profile
```

Named stages in that guide:

| Stage | Measures | Cautions |
|---|---|---|
| `bundle` | hello-world bundle size | Source bundle measurements are not published package sizes. |
| `cold` | startup/first response and route-count scaling | Record route count and runtime. |
| `inproc` | per-request framework work without network | Runtime-specific request objects can dominate some profiles. |
| `wire` | real HTTP load/throughput (uses `wrk` if supported) | Noisy; run repeatedly and check the load generator isn't saturated. |
| `probe` | real-socket behavior/conformance | Correctness result, not a speed measurement. |
| `profile` | function-level CPU attribution | Ignore native/runtime/harness rows when attributing framework overhead. |

A missing stage argument reportedly runs all stages except `profile`; verify the current runner's `--help`/implementation rather than assuming this remains true.

## Before/after workflow

1. Record commit and `git status`.
2. Run the target measurement on the baseline.
3. Make/use the change only if authorized, then run the exact same command under the same conditions.
4. Repeat noisy or small-delta runs; record all runs, not just the best-looking one.
5. Run correctness probes on both Bun and Node where supported.
6. Report runtime/version, hardware/environment, command, repetitions, effect size and what was not measured.

## Profile workflow

The source guide documents these patterns; verify them before running:

```bash
node apps/benchmark/scripts/dev-check/check.mjs profile
node apps/benchmark/scripts/dev-check/check.mjs profile --entry inproc-hono
node apps/benchmark/scripts/dev-check/check.mjs profile --rt node
HEADERS=12 node apps/benchmark/scripts/dev-check/check.mjs profile
```

Look for actual framework functions taking meaningful CPU, not just native runtime APIs or profiler harness overhead. A profile showing a hot function does not by itself prove that removing it will improve end-to-end latency; measure the resulting change.

## Additional existing instruments mentioned by the source guide

```bash
pnpm --filter nextrush-benchmark bench:alloc:dispatch
pnpm --filter nextrush-benchmark bench:alloc:web
pnpm --filter nextrush-benchmark bench:alloc:router
```

The source guide also mentions a long `bench:standard|full` suite. Keep long benchmark suites for release-quality evidence; use deterministic short checks in the inner development loop when their methodology matches the question.

## Raw-runtime floor and correctness

- Use a raw Bun/Node HTTP implementation as an approximate floor only if request parsing, response semantics, headers, body, and client behavior are comparable.
- If the client becomes the bottleneck, the raw-floor ratio can be misleading.
- Use byte-exact/raw socket clients for path-normalization and malformed-request claims; high-level clients may normalize the input before the server receives it.
- Never report a raw server as an apples-to-apples replacement for middleware/schema-heavy framework behavior.

## Historical case-study baseline

The supplied workflow records a baseline dated **2026-10-18** using Bun 1.4.3 and Node 26.12 on a shared 8-core development box. Those numbers are historical reference only. They must not be repeated as current results without checking out the matching revision/environment and rerunning the benchmark. The accompanying modernization audit is a useful map of hypotheses/findings but also states that no new profile was run during that audit session; validate each claim from source and measurement before adopting it.

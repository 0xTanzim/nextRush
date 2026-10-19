# Profiling and Benchmark Methodology

## 1. The measurement should match the question

| Question | First useful evidence | Avoid concluding from |
|---|---|---|
| Where is CPU time spent? | CPU profile/flame graph | Wall-clock microbenchmark alone |
| How much does one operation allocate? | Allocation profile/bytes per operation | RSS alone |
| What objects are retained? | Heap snapshot and retaining paths | Allocation rate alone |
| Is GC hurting latency? | GC telemetry correlated with latency and load | One isolated GC pause |
| Is startup slow? | Fresh-process phase timings, module/bundle analysis | Warm steady-state benchmark |
| Is a route algorithm scaling badly? | Controlled route-count sweep and complexity evidence | Single-route benchmark |
| Is I/O/syscall overhead material? | Runtime/I/O metrics plus syscall tracing where available | Assuming every write equals one syscall |
| Is cache behavior limiting? | Relevant counters/experiments on supported hardware | Source-code intuition or a generic flame graph |
| Is HTTP behavior faster? | Real socket benchmark with latency percentiles | In-process dispatch numbers alone |
| Is throughput capped? | Server and generator CPU, queue, concurrency and network metrics | Requests/sec number without saturation checks |

## 2. Benchmark design

Define the endpoint/workload, request payload, response payload, headers, middleware, route distribution, concurrency, transport, keep-alive/TLS, runtime/build flags and success criteria before measuring.

Compare semantically equivalent implementations. Include the realistic critical path and meaningful edge cases. Use a raw runtime only as contextual lower-bound information, not as a feature-equivalent framework comparison. Document unavoidable mismatches.

Ensure results are consumed and inputs vary enough to avoid constant-folding/dead-code-elimination artifacts in microbenchmarks. A JavaScript microbenchmark should warm the relevant path when measuring steady state, but avoid pre-warming the target process when measuring cold start.

## 3. Warm and cold are different experiments

- **Steady-state:** measure after appropriate warm-up and stabilization for the question. Record warm-up policy and how stability was judged.
- **Process-cold:** start a fresh process and measure defined startup phases/first request. Filesystem cache may still be warm.
- **Runtime-cold:** may imply fresh runtime initialization but must be defined precisely.
- **Serverless-cold:** includes host/platform orchestration outside local process startup and cannot be inferred from a local process alone.

Do not average startup runs and steady-state requests into one number. Report the phase that was measured.

## 4. Repetition and noise

Run enough independent repetitions to characterize variance and detect regressions. Report per-run results or min/median/max when appropriate, not only a pooled average. Use medians for typical run comparison when outliers exist, but retain tail-latency distributions when tails matter.

A claimed win should exceed noise. If results overlap substantially, repeat, increase sample size, reduce environmental variation or report the conclusion as inconclusive. Never manufacture a statistical confidence claim without an appropriate method and sufficient data.

Control or record CPU frequency behavior, thermal throttling, background jobs, CPU affinity, container limits, runtime versions, tool versions, machine differences and power mode where relevant. Do not require invasive machine tuning when unavailable; record the limitation.

## 5. Latency and coordinated omission

Report throughput together with p50/p95/p99 or other percentiles suitable for the workload. Mean latency hides tails. p99.9 requires enough samples to be meaningful. State whether the load generator corrects for coordinated omission; if unknown, say unknown. Avoid comparing percentiles computed with different sampling or correction methods.

Keep client and server capacity in view. A saturated load generator can understate server capacity; placing client and server on the same CPU cores can contaminate results. Separate them when practical and document the setup.

## 6. Profiles and traces

- **CPU profile:** sampled attribution; small functions may be hidden by sampling granularity, and native/runtime frames need correct interpretation.
- **Flame graph:** visualization of sampled stacks, not a literal timeline or proof of causality. Width generally represents sample weight, depending on tooling.
- **Heap snapshot:** retained-object graph at a point in time; can perturb memory and runtime behavior.
- **Allocation profile:** helps show allocation sites/rates; does not alone prove retention or GC harm.
- **GC trace:** interpret according to runtime/version and correlate with the workload.
- **Hardware counters:** architecture-specific, sometimes multiplexed or denied in VMs/containers; compare only when collection semantics are understood.
- **Syscall trace:** can perturb timing and may reveal calls without proving they dominate total latency.

Profiling tools can change the workload. Use them to explain behavior, then verify the optimization in a less-instrumented benchmark.

## 7. Runtime-specific tooling

Discover the current runtime and tool versions. Verify the supported flags and output formats in official documentation or the installed tool's help. Node flags are not automatically valid for Bun or Deno. Do not invent profiler commands; follow the repository's profiling skill/scripts first.

## 8. Before/after experiment discipline

1. Record baseline commit/worktree and exact setup.
2. Run baseline and preserve raw data.
3. Form a specific hypothesis and prediction.
4. Change one meaningful factor when practical.
5. Run correctness tests and conformance.
6. Repeat equivalent measurements.
7. Compare effect size, run-to-run spread, throughput, latency and relevant resource metrics.
8. Check end-to-end impact and regressions on other runtimes.
9. Keep only evidence-supported changes; report inconclusive outcomes honestly.

When multiple changes must be combined, document why they cannot be isolated and avoid attributing the entire gain to one change.

## 9. Runtime and framework comparisons

For NextRush vs Hono/Elysia/Fastify/raw runtime, record versions, runtime engine/version, machine, flags, route semantics, middleware, error behavior, payloads, connection model, concurrency and load-generator version. Compare equivalent capabilities. Include raw runtime results as context, not proof that framework overhead can be entirely removed. Avoid cross-machine comparisons as if they were controlled experiments.

## 10. Local workflow and CI

Prefer rapid local loops during investigation; use longer release-quality suites to confirm a result. Do not introduce or change CI budgets/workflows during a read-only audit. Performance thresholds need noise-aware guardrails and explicit ownership. A regression budget is useful only if its workload is stable enough and false alarms are understood.

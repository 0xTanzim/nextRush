---
name: systems-performance-engineering
description: Use for non-trivial performance-sensitive code changes, request-path or runtime architecture investigations, profiling, benchmarking, bottleneck analysis, startup and memory investigations, and optimization of NextRush or other TypeScript multi-runtime systems. Teaches evidence-driven reasoning from algorithms through JavaScript engines, operating systems, CPU and I/O without assuming a cost before measuring it.
---

# Systems Performance Engineering

## Mission

Investigate and improve real system behavior—not source-code aesthetics or imagined machine costs. Reason from end-to-end behavior down through algorithms, runtime, memory, CPU, operating system, and I/O as needed; then choose the highest architectural level that removes the unnecessary work. Keep code clear, correct, portable, observable, and maintainable.

The skill is inspired by expert systems-engineering practice. It does not grant knowledge of unmeasured internals: treat explanations of machine behavior as hypotheses until supported by suitable evidence.

## When to use this skill

Load this skill before:
- Changing routing, middleware, request context, adapters, dispatch, dependency injection, serialization, streaming, or other hot request-path code for performance.
- Investigating allocations, garbage collection, heap growth, RSS, startup time, bundle size, latency, throughput, CPU use, or suspected stalls.
- Evaluating a performance claim, optimization RFC, architecture audit, regression, or comparison with another framework/runtime.
- Making low-level choices involving data structures, buffering, caching, scheduling, system calls, or runtime-specific optimizations.

Do not load the full references for a typo, routine documentation-only edit, or unrelated feature unless performance behavior is implicated. Read only the reference files that fit the question.

## Required repository orientation

1. Read the repository root `AGENTS.md` and any applicable nested instructions.
2. Inspect `git status --short --branch`, the relevant diff, and the actual implementation/tests. Preserve pre-existing user work.
3. Discover the real package manager, runtime versions, benchmark scripts, test commands, known failures, and existing baselines. Never invent a command or assume an old command still works.
4. For NextRush, read the installed/repository `framework-profiling` skill for concrete measurement commands. For audits/comparisons and `.audit/` artifacts, also read `framework-audit-profiling`. These skills own repository-specific procedures and report templates; this skill owns systems reasoning.
5. Work locally by default. Do not change CI, workflows, budgets, dependencies, lockfiles, release configuration, or application code during a read-only audit unless explicitly authorized.

## The governing question

For every meaningful stage of a request or lifecycle, ask:

1. **What work happens?** Identify operations, allocations, copies, calls, branches, parsing, scheduling, and I/O.
2. **Where and how often does it happen?** At build time, process startup, first request, once per request, once per middleware, once per response, on error, or in the kernel/network.
3. **What does it cost in this workload?** CPU time, memory traffic, allocations, retention, GC, syscalls, queueing, bytes, latency, or contention.
4. **Is it necessary?** Can it be removed, combined, moved to startup, made lazy, bounded, or performed with a better algorithm without changing the contract?
5. **What evidence would disprove the hypothesis?** Select measurements that distinguish competing causes, not merely a tool that produces lots of data.

## Investigation workflow

### 1. Define the observable problem

Write down the question, symptom, workload, affected runtime/version, and desired outcome. Separate the metric from the presumed cause. Examples: first-request latency, warm p99 latency, requests/second, bytes allocated/request, peak RSS, cold bundle size, GC CPU, or route lookup scaling.

Name the measurement layer:
- Algorithm/data-structure complexity.
- In-process dispatch/handler cost.
- Runtime execution/JIT/GC.
- Real HTTP throughput and latency.
- Startup/cold start/bundle.
- Memory/allocations/retention.
- Kernel, socket, filesystem, or network.
- Behavioral correctness/conformance.

These results are related but not interchangeable.

### 2. Trace the architecture and lifecycle

Trace a representative operation end to end before editing. For an HTTP request, follow the real path through runtime ingress, adapter normalization, context/lifecycle setup, route lookup, middleware, handler, response construction, adapter output, and socket/network. Mark optional paths, errors, streams, and capability boundaries.

Build a scope map:
- **Build-time:** generated/compiled artifacts, tree shaking, bundle composition.
- **Process startup:** module graph, imports, registrations, container/router/middleware/schema setup.
- **First request:** lazy initialization and first-use compilation.
- **Per request:** normalization, dispatch, context, middleware, handler.
- **Per response:** headers/body conversion, serialization, write/flush.
- **Under load:** queues, GC, contention, memory pressure, scheduling, backpressure.

Look for work performed at the wrong scope (for example, invariant middleware composition repeated per request), but verify lifecycle semantics before moving it.

### 3. Build a cost model before choosing a fix

Estimate counts and scaling before chasing individual instructions:
- Operations per request and per middleware/route/header/body byte.
- Complexity as route count, middleware count, payload size, concurrency, and plugin count grow.
- Allocations and allocated bytes per request; live/retained bytes; copies and bytes copied.
- Function/dispatch boundaries, parsing passes, string/byte conversions, and branches.
- Queue depth, blocking, syscalls/writes, packet/response sizes, and work moved to threads.
- Startup work, bundle/module count, first-use work, and persistent memory.

Use simple arithmetic as a sanity check, not as a substitute for measurement. For example, a path consuming 2 microseconds of CPU per request at 100,000 requests/second would require roughly 0.2 CPU-seconds per wall-clock second for that path alone, assuming the estimate is valid and the workload is comparable. State assumptions explicitly.

### 4. Form competing hypotheses

Create a short ranked list, usually two to four hypotheses. For each, state:
- Mechanism: why it could cause the observed symptom.
- Prediction: what should change if true.
- Discriminating test/profile: what evidence distinguishes it from alternatives.
- Falsifier: what observation would make you reject it.

Example: “Repeated route normalization may add CPU cost” predicts a profile hotspot or a measurable difference when the repeated work is isolated. If it barely registers and end-to-end latency does not move after removal, it was not a meaningful optimization.

Do not start from “objects are bad,” “closures are slow,” “regex is slow,” “syscalls dominate,” or “cache misses explain it.” Start from the observed symptom.

### 5. Choose the right measurement

Use the least expensive reliable tool that can answer the question:
- CPU attribution: CPU profile/flame graph, then investigate relevant call paths.
- Allocation pressure: allocation profile or bytes/objects per operation.
- Retention/leaks: heap snapshots, retained-object paths, heap/RSS over time.
- GC: runtime GC telemetry/traces, pause/CPU cost and allocation rate.
- Cold start: fresh process and explicit first-use measurements; do not warm up the process under test.
- Steady-state JIT performance: warm-up strategy appropriate to the runtime, then repeat measured runs.
- Bundle/module cost: built artifact analysis and controlled cold-start measurements.
- Syscall/I/O behavior: platform-appropriate tracing and socket/I/O metrics.
- Hardware behavior: counters such as cache misses, cycles, IPC or branch misses where available and interpretable.
- Concurrency/saturation: queue, event-loop delay, thread-pool, connection and load-generator telemetry.
- HTTP outcome: real socket tests with realistic payloads, concurrency and latency percentiles.
- Scaling: vary the relevant dimension (routes, middleware, payload size, concurrency) and inspect how cost grows.

A CPU profile is not the first answer to every problem. Hardware counters may be unavailable or misleading in VMs/containers. Tool support and flags vary by runtime version: discover and verify them before use.

### 6. Establish a trustworthy baseline

- Use production-like build and execution mode, not development mode, unless development behavior is the subject.
- Record commit/worktree state, machine/OS, CPU, container/VM limits, runtime versions, flags, tool versions, workload and environment.
- Keep compared implementations equivalent in semantics and feature set. Do not present a raw runtime as a feature-equivalent framework.
- Ensure the load generator is not the bottleneck. For server/client tests, separate them onto different cores or hosts when practical.
- Use enough independent runs to observe variance. Report distributions and run-to-run spread; do not call tiny differences real wins.
- Report throughput and latency percentiles (at least p50 and p99 when relevant); include p95/p99.9 when the workload warrants it. State how the harness handles coordinated omission if known; otherwise state that it is unknown.
- For cold start, use fresh processes and define whether “cold” means process-cold, filesystem-cache-cold, runtime-cold, or serverless-cold. Do not imply one kind proves another.
- Record raw output/artifacts when feasible so another engineer can reproduce the result.

### 7. Optimize at the highest useful level

Use this preference order, subject to evidence:
1. Remove unnecessary behavior/work from the contract or request path.
2. Fix algorithmic complexity and choose an appropriate data structure.
3. Avoid repeated work; compile/precompute stable state at startup when semantically safe.
4. Avoid unnecessary parsing, normalization, conversion, copying, allocation, and indirection.
5. Improve batching, streaming, backpressure, resource bounds, and I/O behavior.
6. Simplify control flow/data layout on a proven hot path.
7. Consider runtime-specific/JIT/microarchitectural tuning only when measurements support it.

A higher-level fix that removes an entire pass generally beats a lower-level attempt to make that pass slightly faster. Do not force the hierarchy if evidence points elsewhere.

### 8. Make one meaningful change at a time

- Preserve public API and behavior unless a change is explicitly authorized and specified.
- Keep fast paths small and isolated. State their preconditions and why they exist. Use a fallback when a specialized path has restricted preconditions and a general path is needed.
- Avoid pooling, manual buffer reuse, caches, bit tricks, unrolling, native hooks, or engine-specific assumptions without measured justification and clear lifetime/safety rules.
- Do not use `eval`/`new Function` in portable core merely to chase speed; respect runtime/CSP constraints and repository policy.
- Do not trade security, portability, predictable errors, cancellation, backpressure, or maintainability for a benchmark result.
- Test edge cases and compare behavior against a simple reference/previous implementation where practical.

### 9. Validate causality and the whole system

After the change:
1. Run relevant correctness and regression tests.
2. Run cross-runtime conformance for affected adapter/runtime paths.
3. Repeat the same measurement with the same machine, versions, flags, and workload.
4. Compare effect size with observed noise; include regressions and distribution changes.
5. Check end-to-end impact. A microbenchmark improvement that does not improve the real workload may still explain a hot path, but do not claim an end-to-end win without end-to-end evidence.
6. Check memory, startup, error paths, concurrency, streaming/backpressure, and other relevant guardrails.
7. Keep only changes whose benefits justify their complexity and regressions.

### 10. Report the result

Use `templates/investigation-record.md` as a guide or the existing repository audit template when one applies. State:
- Question and workload.
- Observed facts versus hypotheses.
- Execution path and cost model.
- Tools/commands actually run and their actual output/results.
- Baseline and after measurements, spread/noise, and environment.
- Cause supported by evidence, or hypotheses that remain unresolved.
- Code and files changed, behavioral/compatibility checks, regressions, limitations.
- What evidence would change the conclusion.

Never fabricate a profile, timing, counter, path, command, runtime flag, or test result. If a measurement could not run, say why and what remains unknown.

## Reading the references

Load only the reference documents relevant to the hypothesis:
- `references/01-cost-model-and-reasoning.md` — universal workflow, scope, count and scaling models.
- `references/02-cpu-execution-and-caches.md` — instruction execution, registers, branches, cache hierarchy, locality.
- `references/03-memory-allocation-and-gc.md` — stack/heap, allocation, object lifetime, GC, virtual memory metrics.
- `references/04-javascript-runtime-and-jit.md` — V8/JSC, JIT, object shapes, async and strings.
- `references/05-os-processes-and-concurrency.md` — kernel boundaries, scheduling, threads, context switches, event loops.
- `references/06-kernel-networking-and-io.md` — syscalls, sockets, TCP/HTTP, streaming, filesystems.
- `references/07-next-rush-request-path.md` — framework-level cost inventory and request-path questions.
- `references/08-profiling-and-benchmark-methodology.md` — experiments, statistics, tooling selection and benchmark validity.
- `references/09-optimization-patterns-and-traps.md` — safe optimization strategies and common false assumptions.

## Definition of done

The investigation answers the original question with reproducible evidence—or clearly documents why evidence is unavailable. It improves or preserves correctness, API clarity, security, runtime support and maintainability. Any claimed performance gain is larger than measurement noise and demonstrated at the layer where the claim is made.

# Suggested root AGENTS.md integration

Place a compact section inside the existing performance-engineering area. Integrate rather than duplicate existing rules.

## Systems-level engineering mindset

Think beyond source-level syntax. Trace how architecture and code translate into runtime work, memory behavior, CPU execution, and operating-system activity.

For non-trivial or performance-sensitive changes:
1. Trace the complete path and identify work performed at startup, first use, per request, per response, and under load.
2. Reason across algorithms, allocation/lifetime, GC, JIT/runtime behavior, CPU and memory locality, scheduling, syscalls, and I/O as relevant.
3. Treat suspected costs as hypotheses. Choose measurements that can distinguish competing explanations; do not infer machine costs from source syntax alone.
4. Eliminate unnecessary work at the highest architectural level possible before attempting micro-optimization.
5. Preserve clean code, API contracts, correctness, security, portability, cancellation, streaming/backpressure and maintainability.
6. Validate with comparable measurements, relevant tests and cross-runtime conformance. Report noise, trade-offs and uncertainty honestly.

Before any non-trivial performance investigation or optimization, read the `systems-performance-engineering` skill and the applicable repository-specific profiling procedures. Use `framework-profiling` for concrete NextRush measurements and `framework-audit-profiling` for audits/comparisons and evidence artifacts. Do not load or apply deep low-level rules mechanically to unrelated tasks.

### Optimization acceptance contract

Keep the existing project rules requiring measured evidence, before/after comparison, correctness/equivalence tests, a fallback when specialized-path preconditions require one, an explanation of why the optimization exists, and a regression guardrail where practical. Do not claim a performance win unless it exceeds measurement noise; verify end-to-end impact when making an end-to-end claim.

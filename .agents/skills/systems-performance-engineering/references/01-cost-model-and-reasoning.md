# Cost Models and Systems Reasoning

## 1. The fundamental model

Performance is not a property of syntax in isolation. It emerges from the algorithm, amount of work, data representation, runtime/compiler, operating system, hardware, workload, and measurement method. A good investigation connects these layers without confusing what is known with what is inferred.

Use the chain:

**Workload and contract → architecture path → operation counts and scaling → runtime/hardware mechanism → measurement → targeted change → end-to-end validation.**

## 2. Ask where, how often, and under what conditions

Every cost should be associated with a scope:

| Scope | Typical work | Key question |
|---|---|---|
| Build time | TypeScript compilation, bundling, code generation | Does this affect developer build time or shipped output? |
| Process startup | Module loading, registration, container/router construction | Is one-time cost acceptable, and is it repeated accidentally? |
| First use | Lazy module load, schema compile, JIT tiering | Is this a cold-path latency spike or steady-state cost? |
| Per request | Adapter normalization, routing, context, middleware | How much work is paid by every request? |
| Per item/byte | Parsing, serialization, copying, scans | Does cost scale with payload size or collection length? |
| Per response | Encoding, body construction, writes, flush | Are we copying/buffering/fragmenting unnecessarily? |
| Under concurrency | Queues, contention, GC, scheduling, backpressure | Does load change the bottleneck or cause nonlinear collapse? |
| Failure/cancellation | Error construction, cleanup, abort propagation | Are error paths correct and bounded? |

A change that relocates cost is not automatically an improvement. Moving work from per-request execution into startup may improve throughput but hurt cold starts and startup memory. Measure the relevant trade-off.

## 3. Count work before counting cycles

Start with quantities that can be reasoned about and measured:

- Number of route checks, middleware calls, object creations, normalizations, parse passes, encodings and copies.
- Allocated objects and bytes per request, plus retained/live bytes.
- Operations per payload byte and scaling with route count or middleware count.
- Number and size of writes, syscalls, queue operations and context changes.
- Cold-start module count, compiled artifact size, first-use operations and initial memory.

Reducing a repeated pass from three executions to one is often more robust than trying to tune its inner loop. But measure the complete path: removing a pass can require a larger structure, add branches, or change semantics.

## 4. Amdahl's law and prioritization

For a component consuming fraction `f` of total runtime, accelerating that component by factor `s` yields total speedup:

`Speedup = 1 / ((1 - f) + f / s)`

If a component accounts for only 2% of request cost, making it twice as fast yields roughly a 1% total improvement. This is why profile attribution and the actual target metric matter.

Use a practical priority score based on: measured impact, frequency, user-visible importance, confidence in causality, implementation risk, and maintenance cost. Avoid fake precision in weighted scores; state the rationale.

## 5. Latency, throughput, and queueing are different

- **Latency** is time for one operation; use percentiles, not only an average.
- **Throughput** is completed work per unit time; it can rise while tail latency gets worse.
- **Utilization** shows how busy a resource is, not whether it is the bottleneck by itself.
- **Queueing** can make latency grow nonlinearly near saturation.
- **Concurrency** is in-flight work, not the same as parallel CPU execution.
- **CPU time** and wall-clock time diverge when waiting, blocked or scheduled out.

A small CPU optimization may not improve end-to-end latency if the request is waiting on network or another service. Conversely, reducing a serial dependency can matter even when its CPU samples are small.

## 6. Control, influence, observe

Classify suspected costs before acting:

### Control directly
Algorithm, repeated work, data structure, call count, allocation requests, copying, serialization strategy, buffer bounds, queue limits, concurrency policy, startup initialization, imports, feature inclusion and adapter decisions—within the supported contract.

### Influence indirectly
JIT optimization, register allocation, branch prediction, cache behavior, allocator/GC behavior, kernel batching and scheduling. Source-level changes can affect these but do not fully dictate them.

### Observe rather than control directly
Exact machine instructions selected by a JIT, physical register assignment, cache replacement decisions, kernel scheduler choices, page placement and network conditions. Use evidence and platform-specific techniques; do not promise control that the language/runtime does not expose.

## 7. Build a falsifiable hypothesis

Write each hypothesis in this form:

- **Observation:** what is actually measured or seen.
- **Mechanism:** a plausible explanation.
- **Prediction:** what should change if the explanation is correct.
- **Experiment:** the smallest reliable measurement that distinguishes it.
- **Falsifier:** evidence that would cause rejection.
- **Alternative:** at least one competing explanation.

Example:

- Observation: p99 increases sharply when middleware count grows from 5 to 30.
- Hypothesis: middleware dispatch has per-layer overhead or scales worse than expected.
- Prediction: an in-process test with a no-op handler and varied layer counts shows corresponding growth.
- Falsifier: in-process cost stays flat while real HTTP p99 changes; investigate queueing, load, GC, or the benchmark instead.

## 8. When to stop

Stop micro-optimization when the effect is below noise, the end-to-end outcome does not matter, the implementation costs more complexity than the gain, or correctness/portability regresses. Report what is known and unresolved rather than continuing to tune for an unproven hypothesis.

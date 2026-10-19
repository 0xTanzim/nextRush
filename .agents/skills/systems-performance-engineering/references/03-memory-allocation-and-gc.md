# Memory, Allocation, Object Lifetime, and Garbage Collection

## 1. Stack is not the same as the JavaScript call stack

At the native level, stack frames commonly hold return information, saved registers and stack-resident values. JavaScript engines use interpreter frames, optimized frames, heap objects and internal representations that change with execution tier. A TypeScript local variable is not guaranteed to occupy a native stack slot; it may be held in a register, represented indirectly, stored on a heap object, or optimized away.

Treat “stack versus heap” as a conceptual starting point, not a way to infer physical layout from source.

## 2. Allocations: rate, size, and lifetime

Allocation cost depends on runtime implementation, object type and size, allocation rate, heap state, synchronization and subsequent collection. Many small objects may be cheap to allocate in a young generation but still create pressure through volume. Objects surviving collection may be promoted; long-lived graphs increase retained memory. Large buffers may use external/native memory accounting.

Measure at least these dimensions when relevant:
- Objects allocated per operation.
- Bytes allocated per operation.
- Total allocation rate under throughput load.
- Live/retained heap after warm-up and after a representative load.
- Peak RSS and external/native memory where relevant.
- GC frequency, pause distribution and CPU share.

Allocation volume and memory leaks are different problems. A workload can allocate heavily but retain little; another can allocate modestly yet retain request objects indefinitely.

## 3. Common sources of avoidable allocation

Investigate rather than assume:
- Rebuilding invariant arrays/maps/closures or middleware chains per request.
- Repeatedly constructing wrappers for the same object or converting between equivalent forms.
- Multiple string/byte conversions or copies along one path.
- Eager parsing/decoding of headers, query, cookies or body that handlers never read.
- Temporary collections created just to pass values between adjacent layers.
- Repeated serialization metadata/schema/regex compilation.
- Logging or tracing payloads that copies large values unnecessarily.
- Closures retaining large contexts or request/response objects beyond their intended lifetime.

Some abstractions are important for ownership, correctness or clarity. Remove allocation only after confirming it matters and preserving identity, mutability, cancellation, lifetime and error semantics.

## 4. Object lifetime and retention

For every request-owned object, ask:
- Who creates it and who owns it?
- Who holds references after the request completes?
- Could a closure, listener, cache, timer, promise, hook, logger, trace buffer or global registry keep it alive?
- Is cleanup required on success, rejection, abort, disconnect and timeout?
- Is the resource bounded under long-running load?

Memory-retention investigations need evidence such as heap snapshots and retaining paths. RSS alone cannot identify which JavaScript objects are retained. Heap size alone cannot describe total process memory. Use the runtime's documentation to understand metric semantics.

## 5. Garbage collection mechanisms and trade-offs

Managed runtimes typically trace reachability. Common strategies include generational collection, marking, sweeping, compaction, and incremental or concurrent work, but the exact implementation varies by engine/version.

GC may affect performance through:
- CPU consumed by collection work.
- Pauses or scheduling interference.
- Promotion and scanning of long-lived objects.
- Pointer updates/write barriers in relevant runtimes.
- Heap growth and memory pressure.
- Collection triggered by high allocation rate.

Do not write “avoid all objects.” Objects can simplify ownership and are often efficiently allocated. Aim to remove unnecessary allocations on measured hot paths, reduce accidental retention, and keep memory bounded. A design with fewer objects but much more manual mutation or retained pooled objects may be worse.

### Pooling and reuse

Pooling can reduce allocation churn but introduces lifetime and correctness risks: stale data, use-after-reuse, concurrent ownership, retained memory, complex cleanup and cross-request contamination. It can also defeat runtime allocation optimizations. Pool only after measured evidence; establish explicit ownership, maximum pool size, reset invariants, failure/cancellation cleanup and tests.

## 6. Buffers and copying

Track bytes, not only objects. A request may cross several representations: a string, encoded bytes, copied body, stream chunks, and runtime-specific buffers. Determine which conversions are contractually required, which can be delayed, and which can be avoided.

Zero-copy claims require care: a view/slice may still share and retain a large backing allocation; a native API may copy internally; ownership and mutability can constrain reuse. Streaming reduces buffering only when the path actually preserves streaming and backpressure.

## 7. Virtual memory and metrics

- **RSS**: physical memory currently resident for the process, subject to OS reporting details.
- **Virtual size/address space**: mapped address-space range, not the same as physical memory used.
- **Managed heap**: runtime-defined managed memory; excludes or accounts differently for native/external allocations depending on the engine.
- **External memory**: native buffers or other memory outside the ordinary managed heap, where the runtime reports it.

Page faults, TLB misses, swapping, cgroup limits, copy-on-write and OOM behavior can matter in constrained or large-memory environments. Diagnose them using OS/container metrics rather than inferring them from JavaScript heap graphs alone.

## 8. Diagnostic decision tree

- High allocation rate + frequent GC + CPU profile showing GC: investigate short-lived allocation volume and expensive allocations.
- Heap/RSS rises continuously under stable workload: inspect retaining paths, caches, listeners, queues and external buffers.
- Heap stable but RSS high: examine native/external memory, allocator arenas, mappings and platform reporting.
- Allocation profile looks clean but p99 spikes during load: correlate GC, event-loop delay, queueing, OS scheduling and downstream I/O.
- Memory reduction but throughput regression: compare allocation, copying, cache locality, branches and runtime optimization rather than assuming smaller memory is faster.

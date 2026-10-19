# CPU Execution, Registers, and Caches

This reference helps generate and test hypotheses. JavaScript/TypeScript source does not specify exact machine instructions or register placement; JIT compilation and the target CPU decide those details.

## 1. CPU execution concepts

### Instructions, cycles, and dependencies

A CPU executes machine instructions through pipelines and execution units. Runtime can depend on instruction count, instruction latency, throughput, dependencies, branches, cache/memory stalls, and how much work can overlap. Fewer source lines or even fewer instructions do not always mean lower latency: one instruction may have high latency, while multiple independent operations can overlap.

Use concepts such as cycles per instruction (CPI) and instructions per cycle (IPC) to interpret measurements when the platform exposes reliable hardware counters. They are diagnostic signals, not universal scorecards: workload, CPU architecture, instruction mix and frequency all matter.

### Registers and spills

Registers are fast CPU storage used for live values. The compiler/JIT chooses assignment. If there are too many simultaneously live values or constraints inhibit allocation, values may spill to stack slots or be reloaded. Application code cannot directly request a particular register allocation in ordinary TypeScript.

Reason about this indirectly: very large functions, long live ranges, complex control flow or failed optimization may affect generated code, but do not infer spills from source appearance. Use generated-code/JIT diagnostics only when supported and needed.

### Calls, inlining, and dispatch

Function calls have costs such as control transfer, argument/return handling and potential loss of optimization context, but optimized runtimes may inline calls. Polymorphic dispatch may make specialization harder, but a clean abstraction is not automatically expensive. Inspect profiles and engine diagnostics before flattening abstractions or merging functions.

### Branches and prediction

Predictable branches are usually easier for hardware to handle than irregular branches. However, removing a branch may require extra work or memory access. Do not replace readable control flow with branchless tricks unless a measured hotspot justifies it and the resulting code remains verifiable.

### SIMD and vectorization

SIMD can process several values per instruction in workloads with suitable data layout and operations. General framework routing/middleware code is often not an obvious SIMD target. JavaScript engines may vectorize certain operations internally; do not rewrite generic code to emulate SIMD without workload-specific evidence and an appropriate runtime/API.

## 2. Cache hierarchy and locality

CPUs normally have small, fast caches near a core (L1 instruction/data and L2) and a larger last-level cache (often shared in some way). Main-memory access has much higher latency than a cache hit. Exact sizes, inclusivity, line size, topology and sharing differ by processor.

A **cache line** is the unit of cache transfer/coherence on typical systems. Common line sizes are often 64 bytes, but code must not treat this as universal. The useful question is whether access patterns reuse nearby data and whether a workload's active working set fits the relevant caches—not whether a structure is manually padded to an assumed line size.

### Patterns that can hurt locality

- Pointer-heavy trees/lists that make the next access depend on a memory load.
- Scattered objects and deep object graphs in repeated traversal.
- Repeatedly accessing a working set far larger than cache capacity.
- Unnecessary copies and temporary representations that enlarge memory traffic.
- Poorly arranged tables that force extra indirection for each route/middleware lookup.

### Patterns that may help

- Contiguous or compact arrays/tables for hot traversal when access patterns suit them.
- Precomputed metadata and fewer dependent lookups.
- Avoiding repeated conversion and copying.
- Keeping hot data separate from cold diagnostic/configuration data when measurement supports the complexity.

An array is not automatically better than a tree, `Map`, or object. Consider lookup/update complexity, semantic requirements, table size, branch behavior, memory overhead and runtime implementation. Measure realistic route distributions.

## 3. Cache misses, TLBs, and memory bandwidth

A cache miss may fetch a line from a lower cache or memory. A miss is not inherently a problem if latency is hidden by independent work or the access is infrequent. Hardware counters are often multiplexed, restricted, virtualized or architecture-specific; state the limitation.

The **TLB** caches virtual-to-physical address translations. Large or scattered working sets can trigger TLB misses and page walks. This can matter for memory-intensive workloads but is rarely justified as a primary explanation without evidence.

Memory bandwidth matters when a program moves large amounts of data. In small per-request dispatch code, branch behavior, dependency chains or other costs may matter more. Find the limiting resource instead of assuming all memory-bound symptoms are cache-line problems.

## 4. Cache coherence and false sharing

When multiple cores access writable data, cache-coherence traffic can occur. **False sharing** happens when independently updated values occupy the same cache line and coherence forces needless interference. This is most relevant to genuinely concurrent native/shared-memory workloads, such as atomic counters in `SharedArrayBuffer`; it is not a blanket concern for ordinary single-threaded JavaScript data structures.

Padding structures can increase memory footprint and may not work portably because physical layout is not always controllable. Only consider padding/alignment after showing a concurrent contention problem and understanding the runtime representation.

## 5. What framework engineers can change

**Direct levers:** algorithm, number of operations, data layout at source level, number of memory traversals, copies, object count, table size, locality of repeated access, and degree of concurrency.

**Indirect levers:** JIT-generated instructions, register use, branch prediction, exact cache mapping and prefetching.

Use CPU profiles first for attribution. Consider hardware counters when a plausible hardware-level hypothesis remains and the machine supports interpretable measurements. Do not claim a cache-line or register-level win merely because code became shorter or more compact.

## 6. Useful questions for a router or middleware path

- Does matching scan every route, or does cost scale with route count as intended?
- Is each step accessing scattered metadata or repeating path/string conversions?
- Is dispatch work dominated by comparisons, branches, allocations, or a downstream operation?
- Does a more compact representation reduce total cost, or merely exchange CPU work for more complex construction?
- Does the improvement persist under realistic paths, route distributions and runtimes?

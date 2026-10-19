# Optimization Patterns and Common Traps

## 1. Prefer removing work to accelerating it

Look first for duplicate work, repeated scans, repeated decoding/normalization, redundant conversion, repeated setup and unnecessary feature execution. Removing an entire pass often beats tuning its inner loop. Verify that semantics, ownership and laziness are unchanged.

## 2. Match the algorithm to the workload

Know the complexity in relevant dimensions: route count, middleware count, header count, payload bytes, cache size, concurrency and queue length. Big-O does not predict all constant factors, but it reveals scaling hazards. Benchmark representative sizes and distributions, including worst cases and misses.

## 3. Precompute stable work—with lifecycle discipline

Candidate work includes route compilation, middleware composition, schema/validator/serializer setup, normalized static metadata and dependency graphs. Precomputation can reduce request cost but increase startup latency, memory and time-to-first-use. It can also affect error timing and dynamic registration. Check the public contract before moving work.

## 4. Parse lazily—with semantic discipline

Avoid parsing headers/body/cookies/query that no consumer uses when the API permits. Cache parsed results per request if repeated reads are expected and semantics permit. Beware one-shot bodies, body locking, mutable headers, repeated reads, normalization errors and when errors should surface.

## 5. Data structures

Choose based on operation pattern, scale, memory footprint, construction cost, iteration order, mutation behavior and semantics. A hash table may offer average constant-time lookup but uses memory and hashing; a compact array scan can win for tiny tables; a trie can improve some path workloads but increases nodes and pointer traversal. Measure across route counts and realistic path distributions.

## 6. Reduce allocation and copying only where it matters

Useful candidates: duplicate conversions, intermediate collections, transient wrappers, repeated buffer creation and repeated serialization setup. Keep object lifetime and buffer ownership explicit. Do not manually pool or reuse memory until profiling shows a benefit; add bounds and strict ownership rules if pooling is justified.

## 7. Keep hot path distinct from cold path where appropriate

A common request may justify a simple fast path while rare edge cases use a general fallback. Make preconditions explicit, keep both paths behaviorally equivalent, cover edge cases with differential/property tests and test on supported runtimes. Do not build a maze of branches based on speculative “common cases.”

## 8. Batch I/O and preserve backpressure

Batching can reduce per-operation overhead but may increase buffering and latency. Streaming can reduce peak memory but introduces cancellation, partial completion and error concerns. Measure chunk sizes, writes, body size, first-byte latency, throughput and memory under concurrent loads.

## 9. Cache only with a clear invalidation and size policy

Caching can trade computation for memory, synchronization, stale values and invalidation complexity. Define ownership, key semantics, maximum size, eviction, lifetime, failure behavior and concurrency behavior. Measure hit rate and net benefit; avoid caches whose setup, lookup and retention cost exceed recomputation.

## 10. Common false rules

- “One function call is one expensive operation.” Optimizing compilers may inline it.
- “Every object allocation invokes GC.” Allocation and collection are separate events.
- “No allocations is always best.” Fewer allocations can require more copying, mutation, retention or complexity.
- “Every `await` causes a kernel context switch.” Promise scheduling and OS scheduling are distinct.
- “A syscall is automatically the bottleneck.” Measure its fraction of total work.
- “Regex is slower than manual scanning.” Engine and workload decide.
- “Array is faster than Map.” Size, access pattern, runtime and semantics decide.
- “Cache lines should be manually aligned.” JavaScript generally offers no direct portable control over object placement.
- “Less source code is faster.” Source length is not a cost model.
- “The raw runtime is the correct performance target.” It may not provide equivalent routing, middleware, safety or semantics.
- “A microbenchmark win means the app is faster.” Validate the complete path.
- “One runtime's result proves all runtimes.” Engines, adapters and OS integrations differ.

## 11. Safe acceptance contract

Before accepting a low-level optimization, answer:
1. What measured bottleneck is being addressed?
2. What code path or resource was previously costly?
3. Why should this change improve it?
4. What is the expected trade-off or downside?
5. Which behavioral contract and edge cases must remain identical?
6. What measurements compare baseline and new behavior?
7. Is the effect larger than noise?
8. Does the real workload improve or is the result only local/microbenchmark-level?
9. Is the result acceptable on all supported runtimes and relevant configurations?
10. Is the code still understandable and maintainable?

If the evidence is weak, present the change as an experiment, not a proven optimization.

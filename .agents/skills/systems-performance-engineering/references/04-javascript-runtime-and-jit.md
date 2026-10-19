# JavaScript Runtime, JIT, and Execution Semantics

## 1. Source code is not machine code

JavaScript engines may parse modules, interpret bytecode, collect type feedback, compile optimized machine code, and deoptimize when assumptions stop holding. Tiering thresholds and implementation details vary by engine and release. A source-level pattern is a hypothesis about possible execution—not proof of the actual instructions.

For NextRush, Node, Deno and many edge environments use V8, while Bun uses JavaScriptCore. Version and host integration matter. Verify the actual versions and official tooling before drawing engine-specific conclusions.

## 2. Object shapes and inline caches

Engines often optimize property access using feedback about object layouts/shapes. Consistently initialized fields and stable access patterns can help optimization, but exact behavior is engine-specific. Adding fields later, deleting properties, or presenting many shapes to a hot access site may inhibit specialization in some contexts.

Do not turn this into a rule that every object must have every possible property, or that optional fields are always bad. A larger fixed shape can increase memory and initialization work. Profile and check engine diagnostics only if property access is plausibly material.

## 3. Calls, closures, and inlining

A function call or closure is not automatically expensive. The engine may inline a function, represent a closure compactly, eliminate intermediate objects, or optimize across layers. Dynamic dispatch, polymorphism, escape, or complex control flow may prevent some optimizations, but cannot be judged reliably from syntax alone.

Investigate when profiles show substantial time in framework dispatch/calls or when warm-up/deoptimization behavior is suspected. Preserve useful module/function boundaries unless evidence demonstrates an important cost.

## 4. Arrays, maps, and element representations

Dense arrays with stable element types can be optimized effectively by some engines; holes or mixed types may require more general behavior in certain cases. `Map`, object properties, arrays and trees have different trade-offs. Consider expected size, lookup/update patterns, memory footprint, iteration, semantics and setup cost. Benchmark real distributions, including missing routes and common paths.

## 5. Strings, regex, encoding and buffers

Strings may use different internal representations; concatenation, slicing and conversion can produce allocations or deferred work. Built-in string operations and regex engines can be highly optimized. Manual scanners can be faster or slower depending on pattern, size, engine and JIT behavior.

Look for repeated normalization, repeated path decoding, duplicate URL parsing, encoding/decoding passes, accidental copies and regex compilation in loops. Never replace a built-in with handwritten code solely because it “looks lower-level.” Preserve Unicode, encoding, case, escaping, path and error semantics.

## 6. Promises, async/await and event loops

Promises and `async` functions involve runtime scheduling semantics and may add allocations or microtask activity, but details vary and optimizations may apply. An `await` is not inherently an OS context switch. An asynchronous operation can still block internally, and non-blocking I/O can still contend or wait on resources.

Inspect the actual path:
- Is a promise created for work that can safely remain synchronous?
- Does a middleware design force async boundaries through every handler?
- Is the awaited operation actually pending, or mostly immediately resolved?
- Is CPU work blocking the event loop despite async syntax?
- Is time spent in microtasks, downstream I/O, thread-pool work or queueing?

Keep sync fast paths only when semantics remain straightforward and measurements justify the complexity.

## 7. JIT warm-up and deoptimization

Steady-state microbenchmarks should account for warm-up; cold-start benchmarks should deliberately avoid warming the process under test. Do not mix the two. A workload used for warm-up should reflect the measured workload sufficiently to exercise relevant paths. Too much warm-up can hide important first-use costs.

Deoptimization traces and generated-code inspection can help diagnose a specific hypothesis, but can be noisy and version-specific. Use the exact runtime's supported diagnostics. Avoid making shipped code depend on undocumented engine internals.

## 8. Practical rules

- Measure both realistic warm steady state and cold/first-use latency when both matter.
- Use production-like module/build settings.
- Avoid assuming V8 and JavaScriptCore behave identically.
- Avoid engine-specific tricks in portable core.
- Use stable, understandable code as the baseline; tune only hotspots supported by evidence.
- Re-run after runtime/version upgrades when a low-level assumption materially affects the design.

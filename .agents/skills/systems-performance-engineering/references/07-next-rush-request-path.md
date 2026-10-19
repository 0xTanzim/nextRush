# NextRush Request-Path Cost Inventory

This is a checklist for tracing and investigating NextRush. It is not a claim that every listed step exists in every current path. Inspect actual source and tests before making architecture claims.

## 1. Sketch the real path

For each relevant runtime/adapter, trace the actual sequence:

1. Host/runtime receives and parses request bytes.
2. Adapter accepts the host request and translates/normalizes it as required.
3. Core establishes request lifecycle, context, cancellation and error boundary.
4. Router selects route and extracts params.
5. Middleware and lifecycle hooks run in the specified order.
6. DI/provider resolution and validation/parsing occur when configured/used.
7. Handler produces a result.
8. Response helpers construct headers/body/stream and apply required semantics.
9. Adapter commits the response and handles writes, backpressure and cleanup.
10. Request-scoped resources/references are released after success, rejection, disconnect or cancellation.

For each step, identify whether it is core, adapter, optional package, runtime implementation or OS/network behavior.

## 2. Startup-versus-request questions

- Are routes compiled or normalized once, or work repeated on every request?
- Is middleware composed once or reconstructed per request?
- Are schemas, regexes, validators, serializers and DI metadata compiled once where appropriate?
- Are optional modules loaded eagerly through a root entrypoint or barrel?
- Does module import execute expensive top-level work?
- Is adapter capability information determined once, or repeatedly rediscovered?
- Does lazy initialization create first-request latency or races?

Moving work to startup is only correct when behavior, error timing, isolation and mutation semantics are preserved.

## 3. Adapter and request normalization

Look for duplicate Request/URL/path/header/body normalization, wrapper chains, conversion between equivalent request types, runtime-specific work leaking into core, capability checks repeated in the hot path, and duplicate error/response paths.

Do not remove a conversion unless the contract and ownership remain valid. Web `Request`/`Response` objects, native requests and streams have semantics that may include body locking, cancellation, header restrictions and runtime-specific behavior.

## 4. Router

- Determine lookup complexity for static and dynamic routes as route count grows.
- Measure common routes, misses, params, wildcards, optional patterns, case sensitivity and trailing-slash cases.
- Check repeated path normalization/decoding and duplicate matching passes.
- Account for router construction/startup cost and memory, not just lookup speed.
- Compare the real workload distribution; a benchmark using only one route may hide scaling issues.
- Validate ambiguity and precedence rules before changing internal structures.

A more complicated trie/radix/hash/compiled matcher is not automatically superior. Choose according to route semantics, route count, build cost, memory and measured workloads.

## 5. Middleware, context and DI

- Is chain composition done at registration/startup or repeated per request?
- How many calls and promise/microtask boundaries occur for a request with N middleware layers?
- Is every middleware required on every route, or do scoping/optional features exist in the contract?
- Are request context fields initialized consistently? Does dynamic mutation create excess shapes or complicate ownership?
- Are values recomputed or parsed in several middleware layers?
- Is DI resolution repeated even for safe stable metadata? Is provider scope correct (singleton/request/transient)?
- Do error boundaries, hooks, cancellation and cleanup preserve their contract?

Do not collapse middleware layers merely to reduce function calls if that breaks composability, ordering, error behavior or API expectations.

## 6. Body, headers and response

- Are headers/query/cookies/body parsed before any consumer asks for them?
- Are parsed results cached per request when reuse is safe, or recomputed repeatedly?
- Are strings encoded to bytes more than once?
- Are response bodies copied, wrapped, buffered or serialized repeatedly?
- Are headers normalized/canonicalized more than once?
- Are stream errors, aborts and backpressure honored end to end?
- Are small helper functions creating measurable overhead, or are they effectively inlined/irrelevant?

## 7. Optional features, observability and security

Logging, tracing, metrics, CORS, security headers, compression, validation and other middleware can add work. Measure each with representative enabled/disabled configurations. Do not remove mandatory security controls for speed. Avoid formatting/serializing large log payloads when the log level is disabled if safely possible. Bound buffers/queues and prevent instrumentation itself from becoming a bottleneck.

## 8. Cross-runtime review

Use the project's actual conformance suite and supported runtime matrix. Separate portable contract from optional capabilities. A Node-specific optimization belongs behind the appropriate adapter boundary and should not leak into Web-standard core. Measure on affected engines because Node/Deno/Workers often use V8 while Bun uses JavaScriptCore, with version-specific differences.

## 9. Request-path evidence table

For each stage, record:

| Stage | Scope | Work/count | Evidence | Candidate waste | Correctness risk |
|---|---|---|---|---|---|
| Adapter | Per request | Actual operations | Profile/tests | Duplicate conversion? | Body/headers/runtime semantics |
| Router | Per request | Lookup scaling | Varied route-count workload | Repeated scan/normalize? | Match precedence/params |
| Middleware | Per request/layer | Calls/awaits/allocations | In-process and end-to-end | Repeated composition/work? | Ordering/errors/abort |
| Context/DI | Per request/provider | Objects/lookups | Allocation/profile | Recompute/extra wrapper? | Scope/isolation |
| Response | Per response/chunk | Bytes/copies/writes | Allocation and socket test | Re-encoding/buffering? | Backpressure/cancellation |

Fill this from the real code; do not assume these costs exist merely because a checklist names them.

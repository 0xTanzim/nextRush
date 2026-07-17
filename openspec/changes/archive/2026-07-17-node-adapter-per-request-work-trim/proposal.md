## Why

The hot-path review (`report/core-hot-path-performance-review.md`, roadmap tier **P1** —
"Remove unnecessary per-request work") found the Node adapter doing avoidable work on **every**
request, none of it behavior-affecting:

- **HP-1** — `ctx.ip` is resolved eagerly in the `NodeContext` constructor and allocates a
  header-lookup closure per request, even when `trustProxy` is false (the default) and no handler
  reads `ctx.ip`. When `trustProxy` is false, `resolveClientIp` just returns the socket IP, so the
  closure and the call are pure waste.
- **HP-4** — a fresh `{ trustProxy }` options object is built per request in `createHandler`,
  though `trustProxy` is constant for the server's lifetime.
- **HP-7** — `ctx.next()` adds an extra `async` frame on top of the dispatch thunk the composer
  already created, on every `ctx.next()` call.

This is the next tier after P0 (the single-middleware fast path, now archived): eliminate these
per-request allocations/frames, behavior-preserving and measurement-gated.

## What Changes

- **HP-1 — stop the eager `ctx.ip` closure.** When `trustProxy` is false, set `ctx.ip` directly
  from the socket address (no closure, no `resolveClientIp` call). When `trustProxy` is true,
  resolve via the shared policy as today. `ctx.ip` yields the **identical value** in both cases;
  the value is captured eagerly enough to remain stable after socket close.
- **HP-4 — hoist the constant context-options object.** Build `{ trustProxy }` once in
  `createHandler`'s closure and reuse it, rather than per request. The constructor only reads
  `options.trustProxy`; it does not retain or mutate the object.
- **HP-7 — drop the extra async frame in `ctx.next()`.** Forward the stored dispatch thunk
  directly (`return this._next ? this._next() : <resolved>`) instead of `async next() { await
  this._next() }`, preserving ordering, error propagation, and the no-op-when-unwired behavior.
- Add tests covering the behavior-preserving edge cases per finding (ip parity for both
  `trustProxy` states + post-socket-close stability; `next()` ordering/error/no-op parity), plus
  the cross-adapter behavioral expectation and a measurement gate (allocation micro-bench +
  `pnpm bench:validate` + a `--profile full` A/B before/after).
- **BREAKING**: None. No public API/type changes; `ctx.ip` and `ctx.next()` observable behavior
  are unchanged by construction, pinned as a regression contract by the spec scenarios.

## Capabilities

### New Capabilities

- `node-adapter-per-request-work-trim`: The requirement that `@nextrush/adapter-node` avoid
  per-request allocations and async frames that do not affect observable behavior — specifically
  the eager `ctx.ip` lookup closure (resolved lazily/short-circuited when proxies are not
  trusted), the per-request context-options object, and the redundant `async` frame in
  `ctx.next()` — while guaranteeing `ctx.ip`, `ctx.next()`, and all request/response behavior stay
  byte-for-byte identical to today, including under `trustProxy` on/off and cross-adapter.

### Modified Capabilities

- None. These are implementation-level per-request optimizations in the Node adapter; the
  observable Context behavior they preserve was not previously captured as an OpenSpec capability,
  so the new capability's scenarios serve as the executable regression contract.

## Impact

- **Affected code:** `packages/adapters/node/src/context.ts` (`NodeContext` constructor — `ip`
  resolution; `next()` method) and `packages/adapters/node/src/adapter.ts` (`createHandler` —
  hoist the options object). No changes to `@nextrush/core` or `@nextrush/router`.
- **Affected tests:** `packages/adapters/node/src/__tests__/` — ip parity + post-close stability,
  `next()` ordering/error/no-op parity, and the per-request-work regression checks.
- **Cross-adapter:** `ctx.ip` and `ctx.next()` observable behavior must remain identical across
  Node/Bun/Deno/Edge; Bun/Deno/Edge carry the analogous eager-ip/`next()` shapes and are a
  **follow-up** (noted as a Non-Goal here to keep this change measurable and scoped to the
  benchmarked adapter), with their behavioral parity suites unaffected.
- **Performance harness:** `apps/benchmark` — an allocation micro-bench for the context path,
  `bench:validate` parity, and a `--profile full` A/B on Hello World / Route Params.
- **Public API / types / dependencies:** none.

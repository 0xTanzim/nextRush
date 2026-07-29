# Elide redundant resolved-promise allocation in `compose()`

## Why

`compose()` in `@nextrush/core` allocates a **fresh** resolved promise on four paths where an
already-resolved promise would be observably identical:

- the `len === 0` fast path's `next ? next() : Promise.resolve()`
- `composedSingle`'s `nextFn` terminal `next ? next() : Promise.resolve()`
- the general path's `if (!fn) return Promise.resolve()`
- both paths' `return Promise.resolve(fn(ctx, nextFn))` **when the middleware returned
  `undefined`** — i.e. a genuinely synchronous middleware

This is finding **F-09** in `reports/investigations/performance-investigation-reconciliation.md`
("elide `Promise.resolve` for synchronous middleware returns"), the deferred half of
recommendation 11.

Measured directly (spike: patched, measured, reverted) against a genuinely synchronous
single-middleware stack, 300,000 invocations, `--expose-gc`, retaining every returned promise:

| Middleware shape | Current | With shared sentinel | Delta |
| --- | --- | --- | --- |
| **synchronous** (returns `undefined`) | 84.0 B/op | **12.0 B/op** | **−86%** |
| `async` (already returns a promise) | 817.4 B/op | 807.3 B/op | within noise (±17.0) |

The async row is expected to be flat and is **not** a goal: `Promise.resolve(p) === p` for a native
promise, so that path never allocated in the first place. **This change only helps synchronous
middleware**, which is the exact shape F-09 named.

The precedent is already in this repo: `@nextrush/router` uses shared `RESOLVED` /
`RESOLVED_PROMISE` / `NOOP_NEXT` sentinels (`dispatch.ts`, `segment-trie.ts`) for this same reason.
`@nextrush/core`'s `compose()` is the remaining hot-path file still allocating a fresh resolved
promise per call.

## What Changes

- Add a module-level `const RESOLVED: Promise<void> = Promise.resolve()` to
  `packages/core/src/middleware.ts` and return it in place of a freshly-constructed
  `Promise.resolve()` on the four paths above.
- The middleware-return path short-circuits **only on `=== undefined`**. Every other return value —
  native promise, non-promise thenable, or any other value — continues through
  `Promise.resolve(...)` unchanged. See design.md D2 for why this specific predicate is
  load-bearing and why `instanceof Promise` is forbidden here.

## Non-Goals

- **Not** changing `ComposedMiddleware`'s return type to `void | Promise<void>`. That would be a
  public API change requiring an RFC, and would push the sync/async branch onto every consumer.
  Rejected — see design.md D3.
- **Not** touching the double-next-detection guard, `warnDoubleResponse`, or the general path's
  per-layer `nextFn` closure. The per-layer closure allocation was separately investigated and
  concluded non-removable without codegen in
  `archive/2026-07-29-reduce-router-match-allocations` task 4.3; that conclusion stands and is not
  revisited here.
- **Not** expected to move any benchmark scenario. Every `apps/benchmark` middleware is
  async or returns `ctx.next()`, so none of them hit the elided path. Claiming a benchmark
  improvement here would be dishonest; the allocation harness is the only instrument that can show
  this change at all.
- **Not** replacing `Promise.reject(...)` sites with a shared rejected sentinel. A shared rejected
  promise would carry one shared `Error` (losing per-call context) and risks spurious
  unhandled-rejection reporting. Explicitly out of scope.

## Impact

- `@nextrush/core` — `packages/core/src/middleware.ts` only.
- No public API change, no type change, no observable behavior change. Purely an allocation
  reduction on an internal hot path.
- Risk concentrates in one place: a return value that is falsy-but-not-`undefined`, or a thenable,
  must still be adopted exactly as today. That is what the RED tests in tasks.md target.

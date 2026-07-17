## Why

The hot-path performance review (`report/core-hot-path-performance-review.md`, finding **HP-6**,
the roadmap's sole **P0**) found that the app pays a full middleware-composition dispatch layer —
plus its per-request closures — on **100% of requests**, even when the entire application
middleware stack is a single entry. That is the common shape: the benchmark server
(`apps/benchmark/servers/nextrush-v3.js`) does `app.route('/', router)`, which pushes exactly one
middleware (`router.routes()`), so the stack is `[router.routes()]`. NextRush sits at **20.1%
overhead over raw Node** on Hello World vs Fastify's **9.7%**; this redundant layer is the single
largest *structural* contributor because it fires universally.

Evidence (cited to real source):

- `packages/core/src/middleware.ts` — `compose()` has a fast path only for `len === 0`. For
  `len >= 1` it always builds, per request: a recursive `dispatch` function closure, a `nextFn`
  closure, a `Promise.resolve(...)` wrap, an index-comparison guard, and a `ctx.setNext(...)`
  call — regardless of stack size.
- `packages/core/src/application.ts` — `callback()` unconditionally routes the stack through
  `compose()`, then wraps it in an async try/catch. For a one-entry stack this means the app runs
  a whole dispatch engine just to invoke one middleware, **which then runs its own dispatch**
  (`packages/router/src/segment-trie.ts` `compileExecutor`) to reach the handler — two nested
  index-based dispatch engines for one conceptual hop.

The correctness-critical constraint — and the reason this needs a spec, not a one-line patch — is
that `compose()` today guarantees subtle middleware semantics that a naive fast path would
silently break: **calling `next()` more than once rejects with `next() called multiple times`**
(via the shared `index` guard), `ctx.next()` and the `next` argument advance the *same* chain, a
synchronous throw becomes a rejected promise, non-`Error` throws are wrapped, and per-request
state must never leak across concurrent requests. The fast path must preserve every one of these
for the single layer, verified by an exhaustive edge-case, concurrency, and parity suite — not
assumed.

## What Changes

- Add a **`len === 1` fast path** to `compose()` (`packages/core/src/middleware.ts`) that invokes
  the single middleware without allocating the recursive `dispatch` closure or running the
  index-comparison machinery, while preserving **100% of observable middleware semantics** for
  that layer:
  - `next()` called 0 times → chain settles; the tail `next` is not invoked.
  - `next()` called 1 time → advances to the tail `next` (or resolves if there is none).
  - `next()` called 2, 3, … n times → every call after the first rejects with the identical
    message `next() called multiple times`, tracked via **per-invocation** state (never hoisted
    or shared across requests).
  - `ctx.next()` and the `next` argument resolve to the **same** guarded thunk, so a double-call
    is detected even when the two calls come through different surfaces.
  - Synchronous throws → rejected promise; non-`Error` throws → wrapped as `new Error(String(e))`.
  - `warnDoubleResponse` warning still fires (non-production) when a middleware responds and then
    calls `next()`, with message parity to the general path.
  - `ctx.setNext(...)` is still wired before the middleware runs; contexts lacking `setNext` still
    work via the `next` argument.
- Keep `compose()` as the **single source of truth** for middleware semantics — the fast path
  lives inside `compose()`, NOT duplicated into `application.ts`'s `callback()`, so the two paths
  cannot diverge.
- Add an **exhaustive test matrix** (see the spec) covering call-count edge cases (0/1/2/3/n,
  sync and async, mixed surfaces), error propagation, double-response warning, `setNext` wiring,
  the fast-path boundary (`len` 0/1/2), **per-request isolation under concurrency** (the real
  worst case), and **behavioral parity** with the general `len >= 2` path.
- Add a **performance verification gate**: an allocation micro-benchmark proving the `dispatch`
  closure is no longer allocated on the `len === 1` path, plus `pnpm bench:validate` (byte-identical
  parity) and a `pnpm bench:compare --profile full` A/B showing no regression (ideally a gain) on
  Hello World / Route Params. A change that regresses or shows no movement beyond stddev is
  reverted or parked.
- **BREAKING**: None. No public API changes. The optimization is behavior-preserving by
  construction; the new capability spec pins every preserved semantic as a regression contract.

## Capabilities

### New Capabilities

- `single-middleware-fastpath`: The requirement that `@nextrush/core`'s `compose()` provide an
  allocation-lighter execution path when the composed stack has exactly one middleware, while
  guaranteeing byte-for-byte-identical observable middleware semantics to the general path —
  next()-call-count detection (including 2/3/n-times, sync/async, and mixed `ctx.next()`/arg
  surfaces), onion ordering, error wrapping/propagation, the double-response warning, `setNext`
  wiring, and per-request state isolation under concurrency.

### Modified Capabilities

- None. The middleware-composition semantics this change preserves were not previously captured
  as an OpenSpec capability; rather than retroactively author a broad `middleware-composition`
  spec, this change introduces the fast-path capability whose scenarios double as the executable
  regression contract for those semantics on the single-middleware path.

## Impact

- **Affected code:** `packages/core/src/middleware.ts` (`compose()` — add the `len === 1` branch;
  the `len === 0` branch and the general `len >= 2` path are unchanged). `application.ts`
  `callback()` is unchanged and benefits automatically.
- **Affected tests:** new/expanded suites under `packages/core/src/__tests__/` (middleware
  composition edge cases, concurrency isolation, general-vs-fast parity).
- **Performance harness:** `apps/benchmark` — `bench:validate` parity gate + a `--profile full`
  A/B on the affected scenarios; an allocation micro-benchmark for the closure-elimination claim.
- **Public API / types:** none. `ComposedMiddleware`'s `(ctx, next?) => Promise<void>` contract is
  preserved for every caller of `compose()`.
- **Cross-adapter:** `compose()` is runtime-agnostic core, so the behavior must hold identically
  on Node/Bun/Deno/Edge (adapter-consistency requirement, `tdd-workflow.md`); no adapter code
  changes.
- **Dependencies / systems:** none. No new runtime dependency, no network surface, no production
  behavior change beyond reduced per-request allocation.

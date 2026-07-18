# single-middleware-fastpath Specification

## Purpose
TBD - created by archiving change core-single-middleware-fastpath. Update Purpose after archive.
## Requirements
### Requirement: `compose()` provides an allocation-lighter path for a single-middleware stack

`@nextrush/core`'s `compose()` SHALL provide a dedicated execution path when the composed stack
contains exactly one middleware (`len === 1`) that avoids allocating the recursive `dispatch`
function closure and the per-call index-comparison used by the general path, while remaining a
valid `ComposedMiddleware` with the `(ctx, next?) => Promise<void>` signature. The `len === 0`
empty path and the `len >= 2` general path SHALL be unchanged.

#### Scenario: A single middleware executes and produces its response
- **WHEN** `compose([mw])` is invoked with a context and `mw` writes a response
- **THEN** the response is produced and the composed function resolves, identical to the general path

#### Scenario: The fast path does not allocate the recursive dispatch closure
- **WHEN** the `len === 1` path is exercised under allocation instrumentation / a micro-benchmark
- **THEN** no recursive `dispatch` function closure is allocated per invocation (only the single guarded `next` thunk)

#### Scenario: The empty stack still uses the existing zero-middleware path
- **WHEN** `compose([])` is invoked
- **THEN** it behaves exactly as before this change (calls the tail `next` or resolves)

#### Scenario: A two-middleware stack still uses the unchanged general path
- **WHEN** `compose([a, b])` is invoked
- **THEN** it runs the general `dispatch`-based path with behavior unchanged from before this change

#### Scenario: The single middleware need not be the router
- **WHEN** the one middleware is an arbitrary user middleware (e.g. a lone `app.use(fn)` with no routes)
- **THEN** the fast path runs it correctly, not only when the middleware is `router.routes()`

### Requirement: `next()` call-count semantics are preserved on the fast path

On the single-middleware fast path, calling the `next` function MORE THAN ONCE SHALL reject with an
`Error` whose message is exactly `next() called multiple times`, and calling it zero or one time
SHALL behave identically to the general path. The multiple-call guard SHALL be tracked with
per-invocation state.

#### Scenario: next() called exactly once advances the chain
- **WHEN** the middleware calls `next()` once
- **THEN** the tail `next` runs (or the call resolves if there is no tail), and control returns to the middleware after it (onion before/after ordering preserved)

#### Scenario: next() called zero times settles without invoking the tail
- **WHEN** the middleware responds and never calls `next()`
- **THEN** the composed function resolves and the tail `next` is never invoked

#### Scenario: next() called twice synchronously rejects the second call
- **WHEN** the middleware calls `next()` twice in the same tick
- **THEN** the second call rejects with `Error('next() called multiple times')`

#### Scenario: next() called three times rejects every call after the first
- **WHEN** the middleware calls `next()` three times
- **THEN** the first advances the chain and both the second and third calls reject with `next() called multiple times`

#### Scenario: next() called n times (n greater than 3) rejects every call after the first
- **WHEN** the middleware calls `next()` n times for an arbitrary n greater than 3
- **THEN** exactly the first call advances the chain and all n minus one subsequent calls reject with `next() called multiple times`

#### Scenario: next() called twice with an await in between rejects the second call
- **WHEN** the middleware calls `await next()`, then calls `next()` again afterward
- **THEN** the second call rejects with `next() called multiple times`

#### Scenario: The rejection message is byte-identical to the general path
- **WHEN** a double-`next()` rejection occurs on both the fast path and the general path
- **THEN** both reject with an `Error` whose message string is exactly `next() called multiple times`

### Requirement: `ctx.next()` and the `next` argument advance the same guarded chain

On the fast path, `ctx.next()` (via `ctx.setNext`) and the `next` function passed as the
middleware's second argument SHALL resolve to the SAME guarded thunk, so a multiple-call is
detected regardless of which surface each call came through. A context that does not implement
`setNext` SHALL still execute correctly via the `next` argument.

#### Scenario: ctx.next() advances the same chain as the argument
- **WHEN** the middleware calls `ctx.next()` instead of the `next` argument
- **THEN** the tail chain advances exactly as if the `next` argument had been called

#### Scenario: A call via the argument then via ctx.next() is detected as a double-call
- **WHEN** the middleware calls the `next` argument once, then calls `ctx.next()`
- **THEN** the second call (`ctx.next()`) rejects with `next() called multiple times`

#### Scenario: A call via ctx.next() then via the argument is detected as a double-call
- **WHEN** the middleware calls `ctx.next()` once, then calls the `next` argument
- **THEN** the second call (the argument) rejects with `next() called multiple times`

#### Scenario: A context without setNext still runs via the argument
- **WHEN** the context does not implement `setNext`
- **THEN** the fast path invokes the middleware with the `next` argument and does not throw for the missing `setNext`

### Requirement: Error propagation is preserved on the fast path

On the fast path, a synchronous throw from the middleware SHALL become a rejected promise (never an
uncaught synchronous throw out of `compose()`), a returned rejected promise SHALL propagate, and a
thrown non-`Error` value SHALL be wrapped in `new Error(String(value))` — identical to the general
path.

#### Scenario: A synchronous throw becomes a rejected promise
- **WHEN** the middleware throws synchronously
- **THEN** the composed function returns a rejected promise (it does not throw synchronously)

#### Scenario: A returned rejected promise propagates
- **WHEN** the middleware returns a rejected promise
- **THEN** the composed function rejects with that same reason

#### Scenario: A thrown non-Error value is wrapped as an Error
- **WHEN** the middleware throws a non-`Error` (string, number, null, undefined, or object)
- **THEN** the rejection is an `Error` whose message equals `String(thrownValue)`, matching the general path

#### Scenario: An error from the tail next propagates back through the middleware
- **WHEN** the middleware calls `await next()` and the tail rejects
- **THEN** that rejection propagates back through the awaiting middleware and out of the composed function

#### Scenario: The rejection reaches the application error handler
- **WHEN** the fast path is used via `Application.callback()` and the middleware throws
- **THEN** the error is caught by `callback()`'s try/catch and routed to the configured/default error handler, not left unhandled

### Requirement: The double-response warning is preserved on the fast path

When double-response warning is enabled (non-production), a middleware that has already committed a
response and then calls `next()` SHALL emit the same warning the general path emits (including the
index-0 reference). When disabled (production), no warning SHALL be emitted.

#### Scenario: Responding then calling next() warns in non-production
- **WHEN** `warnDoubleResponse` is enabled, the middleware sends a response, then calls `next()`
- **THEN** a warning is emitted whose text matches the general path's warning (referencing index 0)

#### Scenario: No warning is emitted in production
- **WHEN** `warnDoubleResponse` is disabled (production) and the middleware responds then calls `next()`
- **THEN** no warning is emitted

### Requirement: Per-request state is isolated across concurrent invocations

The fast path's multiple-`next()` guard SHALL be per-invocation state, never shared across
requests. Concurrent invocations of the same composed function SHALL not affect one another's
call-count tracking or response state.

#### Scenario: A double-caller does not corrupt a concurrent single-caller
- **WHEN** two invocations of the same composed function run concurrently, one calling `next()` twice and one calling it once
- **THEN** only the double-caller's second call rejects; the single-caller resolves normally, with no cross-talk

#### Scenario: High-concurrency mix keeps guards independent
- **WHEN** many invocations run interleaved, half of them calling `next()` twice and half once
- **THEN** exactly the double-callers reject and exactly the single-callers succeed, with per-invocation counts independent

#### Scenario: Interleaved async execution keeps state isolated
- **WHEN** invocation A calls `await next()` into a slow tail while invocation B runs to completion
- **THEN** A's and B's guard/response state remain independent and neither observes the other's state

### Requirement: The fast path is behaviorally identical to the general path

For every scenario expressible on both paths, the single-middleware fast path SHALL produce
observably identical results to the general path — the same resolution/ordering, the same rejection
messages, and the same warning text. This parity SHALL be asserted by a shared test matrix that
runs the same middleware behaviors through both paths.

#### Scenario: The same behavior yields identical results on both paths
- **WHEN** a given middleware behavior is run through the fast path (a one-entry stack) and through the general path (a forced multi-entry stack with a transparent passthrough)
- **THEN** the observable outcome — resolved value, execution ordering, any rejection message, any warning text — is identical

#### Scenario: The parity matrix covers call-count, error, and warning cases
- **WHEN** the parity matrix runs the next()-count, error-propagation, and double-response cases through both paths
- **THEN** each case produces identical observable results on both paths

### Requirement: Integration through the real adapter and router stack is unregressed

With the fast path active, an application whose stack is a single mounted router SHALL serve all
route outcomes correctly through the real Node adapter, and the router's own per-route
multiple-`next()` detection SHALL remain independent and intact. Behavior SHALL be identical across
all adapters, since `compose()` is runtime-agnostic core.

#### Scenario: The single-middleware app serves all route outcomes
- **WHEN** an app mounted as `app.route('/', router)` (single-middleware stack) receives requests for a static route, a param route, a POST route, and an unmatched path
- **THEN** it returns the correct 200 responses (with correct body/params) and a correct 404 for the unmatched path

#### Scenario: 404 fall-through works through the fast path
- **WHEN** the mounted router does not match and calls its tail `next()` once, setting status 404
- **THEN** the single `next()` call resolves (no tail present at the app root) and the adapter finalizes a 404 response

#### Scenario: The router's own multiple-next detection is unaffected
- **WHEN** a route registered with per-route middleware has a layer that calls `next()` twice
- **THEN** the router's own executor (`compileExecutor`) rejects that double-call independently of the app-level fast path

#### Scenario: Behavior is identical across adapters
- **WHEN** the same single-middleware app behavior is exercised on each supported adapter (Node/Bun/Deno/Edge)
- **THEN** the observable middleware behavior is identical, since `compose()` is shared core

### Requirement: The optimization is validated by benchmark and coverage gates

The change SHALL be accepted only when its performance claim is measured and its correctness is
covered. A no-measurable-gain result SHALL park or revert the change rather than merge it on
aesthetics.

#### Scenario: An allocation micro-benchmark documents the closure removal
- **WHEN** the allocation micro-benchmark runs against the `len === 1` path
- **THEN** it shows the recursive `dispatch` closure is no longer allocated per invocation

#### Scenario: Response parity is unaffected
- **WHEN** `pnpm bench:validate` runs across all benchmark servers
- **THEN** response bodies and Content-Type remain byte-identical (the fast path changes no output)

#### Scenario: The full-profile A/B shows no regression
- **WHEN** `pnpm bench:compare --profile full` (5 runs, CPU-pinned) is run before and after on Hello World and Route Params
- **THEN** there is no RPS regression beyond stddev; a regression fails the gate

#### Scenario: Coverage is maintained and the new branch is covered
- **WHEN** the test suite runs with coverage
- **THEN** per-package line coverage stays at or above 90% and the new `len === 1` branch is covered


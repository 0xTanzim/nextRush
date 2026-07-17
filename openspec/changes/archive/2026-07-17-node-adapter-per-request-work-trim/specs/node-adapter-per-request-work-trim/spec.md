## ADDED Requirements

### Requirement: `ctx.ip` resolution avoids a per-request closure when proxies are not trusted

When `trustProxy` is false, `NodeContext` SHALL set `ctx.ip` directly from the socket address
without allocating a header-lookup closure or invoking the proxy-header resolution policy, and
SHALL produce the identical `ctx.ip` value it produces today. When `trustProxy` is true, it SHALL
resolve `ctx.ip` via the shared client-IP policy exactly as today. The resolved value SHALL remain
readable (never `undefined`) regardless of when `ctx.ip` is accessed.

#### Scenario: trustProxy false returns the socket address without a lookup closure
- **WHEN** a request is handled with `trustProxy` false
- **THEN** `ctx.ip` equals the socket remote address, and no per-request header-lookup closure is allocated for IP resolution

#### Scenario: trustProxy false ignores proxy headers (parity with today)
- **WHEN** `trustProxy` is false and the request carries `x-forwarded-for` / `x-real-ip` headers
- **THEN** `ctx.ip` still equals the socket remote address (the proxy headers are ignored), identical to today's behavior

#### Scenario: trustProxy true resolves via the shared policy
- **WHEN** `trustProxy` is true and a valid `x-forwarded-for` header is present
- **THEN** `ctx.ip` resolves to the policy result (first valid forwarded entry, etc.), identical to today

#### Scenario: A socket with no remote address yields an empty string
- **WHEN** the socket has no `remoteAddress`
- **THEN** `ctx.ip` is the empty string `''`, matching today's `?? ''` fallback

#### Scenario: The value is stable regardless of read timing
- **WHEN** `ctx.ip` is read at any point during (or after) request handling
- **THEN** it returns the address captured for that request and is never `undefined`

### Requirement: The context-options object is not allocated per request

`createHandler` SHALL construct the context-options object (carrying `trustProxy`) once and reuse
it across requests, rather than allocating a new object per request. The shared object SHALL NOT
be mutated or retained in a way that lets one request affect another.

#### Scenario: trustProxy is applied identically without per-request allocation
- **WHEN** many requests are handled by the same `createHandler` instance
- **THEN** every request observes the same `trustProxy` behavior, and the options object is not re-allocated per request

#### Scenario: The shared options object cannot corrupt request state
- **WHEN** requests are handled concurrently
- **THEN** each observes the same configured `trustProxy` value, with no cross-request interference from the shared object

### Requirement: `ctx.next()` forwards the dispatch thunk without an extra async frame

`NodeContext.next()` SHALL forward the wired dispatch thunk directly (returning its promise)
rather than wrapping it in an additional `async` frame, while preserving ordering, rejection
propagation, the no-op-when-unwired behavior, and the `Promise<void>` return contract.

#### Scenario: Awaiting next() preserves onion ordering
- **WHEN** a middleware calls `await ctx.next()` and downstream runs
- **THEN** control returns to the caller after downstream completes, exactly as before this change

#### Scenario: A rejection from the wired thunk propagates
- **WHEN** the wired downstream chain rejects and the middleware `await`s `ctx.next()`
- **THEN** the rejection propagates out of `ctx.next()` to the awaiting middleware

#### Scenario: next() with no wired thunk is a resolved no-op
- **WHEN** `ctx.next()` is called and no next thunk was wired (`_next` is unset)
- **THEN** it returns an already-resolved promise and does not throw

#### Scenario: next() always returns a promise
- **WHEN** `ctx.next()` is called in any state (wired or unwired)
- **THEN** it returns a `Promise<void>`

#### Scenario: next() advances the same chain the composer guards
- **WHEN** a middleware calls `ctx.next()` under the composed pipeline
- **THEN** it advances the same chain as the composer's `next` argument, so the composer's multiple-`next()` detection still applies unchanged

### Requirement: No observable request/response behavior changes, and cross-adapter parity holds

The trims SHALL NOT change any observable request/response behavior of the Node adapter, and
`ctx.ip` / `ctx.next()` behavior SHALL remain identical across all adapters (the sibling adapters
are unchanged by this Node-scoped change).

#### Scenario: The adapter serves all route outcomes identically
- **WHEN** the Node adapter handles static, param, POST, and unmatched-path requests after the trims
- **THEN** responses (status, body, headers) are identical to before the change

#### Scenario: Cross-adapter behavioral parity is preserved
- **WHEN** the cross-adapter behavioral/conformance suites run
- **THEN** `ctx.ip` and `ctx.next()` behave identically across Node/Bun/Deno/Edge, with the sibling adapters unchanged

### Requirement: The optimization is validated by benchmark and coverage gates

The change SHALL be accepted only when the per-request work removal is measured and correctness is
covered. The deterministic allocation evidence is the primary gate; the RPS A/B confirms no
regression.

#### Scenario: An allocation micro-benchmark documents the removed per-request work
- **WHEN** the allocation micro-benchmark runs against the Node context request path
- **THEN** it shows the per-request IP lookup closure (for `trustProxy` false) and the per-request options object are no longer allocated, and `ctx.next()` allocates no extra async frame

#### Scenario: Response parity is unaffected
- **WHEN** `pnpm bench:validate` runs across all benchmark servers
- **THEN** response bodies and Content-Type remain byte-identical

#### Scenario: The full-profile A/B shows no regression
- **WHEN** `pnpm bench:compare --profile full` (5 runs, CPU-pinned) is run before and after on Hello World and Route Params
- **THEN** there is no RPS regression beyond stddev

#### Scenario: Coverage is maintained and changed branches are covered
- **WHEN** the test suite runs with coverage
- **THEN** per-package line coverage stays at or above 90% and the changed `ip` / `next()` / options branches are covered

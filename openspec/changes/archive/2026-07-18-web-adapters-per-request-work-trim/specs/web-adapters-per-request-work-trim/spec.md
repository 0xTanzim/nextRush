## ADDED Requirements

### Requirement: `ctx.ip` avoids a per-request lookup closure on the Web adapters when proxies are not trusted

The Bun, Deno, and Edge adapters SHALL resolve `ctx.ip` directly from the platform address when
`trustProxy` is false, without allocating a per-request header-lookup closure, producing the
identical value they produce today. When `trustProxy` is true, they SHALL resolve via the shared
client-IP policy exactly as today. Untrusted proxy headers SHALL be ignored (as today).

#### Scenario: Bun with trustProxy false returns the provided client IP without a lookup closure
- **WHEN** the Bun adapter handles a request with `trustProxy` false and a platform `clientIp`
- **THEN** `ctx.ip` equals that `clientIp` and no per-request header-lookup closure is allocated

#### Scenario: Bun with trustProxy false and no client IP yields an empty string
- **WHEN** the Bun adapter handles a request with `trustProxy` false and no platform `clientIp`
- **THEN** `ctx.ip` is `''`, matching today's behavior, with no lookup closure allocated

#### Scenario: Bun with trustProxy true resolves via the shared policy
- **WHEN** the Bun adapter handles a request with `trustProxy` true and a valid forwarded header
- **THEN** `ctx.ip` equals the policy result (using the platform `clientIp` as the direct address), identical to today

#### Scenario: Deno with trustProxy false returns the connection address
- **WHEN** the Deno adapter handles a request with `trustProxy` false
- **THEN** `ctx.ip` equals `connInfo.remoteAddr.hostname` (or `''`), with no lookup closure allocated

#### Scenario: Deno with trustProxy true resolves via the shared policy
- **WHEN** the Deno adapter handles a request with `trustProxy` true and a valid forwarded header
- **THEN** `ctx.ip` equals the policy result, identical to today

#### Scenario: Edge with trustProxy false yields an empty string without a lookup closure
- **WHEN** the Edge adapter handles a request with `trustProxy` false
- **THEN** `ctx.ip` is `''` (Edge has no socket address), with no lookup closure allocated

#### Scenario: Edge with trustProxy true preserves the Cloudflare precedence
- **WHEN** the Edge adapter handles a request with `trustProxy` true
- **THEN** `ctx.ip` resolves with the `cf-connecting-ip` → `x-forwarded-for` → `x-real-ip` precedence, identical to today

#### Scenario: Untrusted proxy headers are ignored on every Web adapter
- **WHEN** any of Bun/Deno/Edge handles a request with `trustProxy` false and `x-forwarded-for` / `x-real-ip` present
- **THEN** `ctx.ip` is the platform address (the proxy headers are ignored), matching today

### Requirement: `ctx.next()` forwards without an extra async frame on the Web adapters

The Bun, Deno, and Edge adapters SHALL forward the composer's dispatch thunk directly from
`ctx.next()` (returning its promise) rather than wrapping it in an additional `async` frame, while
preserving ordering, rejection propagation, the unwired no-op, and the `Promise<void>` contract.

#### Scenario: Awaiting next() preserves onion ordering
- **WHEN** a middleware calls `await ctx.next()` on any Web adapter and downstream runs
- **THEN** control returns to the caller after downstream completes, exactly as before

#### Scenario: A rejection from the wired thunk propagates
- **WHEN** the downstream chain rejects and the middleware `await`s `ctx.next()`
- **THEN** the rejection propagates out of `ctx.next()`

#### Scenario: next() with no wired thunk is a resolved no-op
- **WHEN** `ctx.next()` is called with no next thunk wired
- **THEN** it returns an already-resolved promise and does not throw

#### Scenario: next() advances the same chain the composer guards
- **WHEN** a middleware calls `ctx.next()` under the composed pipeline on any Web adapter
- **THEN** it advances the same chain as the composer's `next` argument, so the composer's multiple-`next()` detection still applies

### Requirement: `ctx.ip` and `ctx.next()` behavior stays identical across all four adapters

`ctx.ip` resolution policy and `ctx.next()` behavior SHALL be identical across Node, Bun, Deno, and
Edge, pinned by the `packages/adapters/conformance` suite. "Identical" means the same trust
handling, header precedence, validation, and `next()` semantics; the literal `ctx.ip` value may
still differ only by the platform-supplied direct address when no trusted header applies.

#### Scenario: The conformance suite stays green across all adapters
- **WHEN** the `packages/adapters/conformance` suite runs after the trims
- **THEN** it passes for all four adapters with no behavioral divergence in `ctx.ip` / `ctx.next()`

#### Scenario: The same header set and trust setting apply the same policy everywhere
- **WHEN** each adapter resolves `ctx.ip` for the same request headers and `trustProxy` setting
- **THEN** each applies the same precedence and validation policy, differing only in the platform direct address when no trusted header matches

#### Scenario: Edge's Cloudflare precedence is pinned in conformance
- **WHEN** the conformance suite exercises Edge `ctx.ip` with `trustProxy` true and `cf-connecting-ip` present
- **THEN** the Cloudflare precedence is asserted, so a future edit cannot silently drop it

### Requirement: The optimization is validated by allocation and coverage gates

Because the `wrk` RPS suite drives only the Node server, acceptance for the siblings SHALL rest on
deterministic allocation evidence and the conformance/unit suites, not an RPS A/B.

#### Scenario: A per-adapter allocation micro-benchmark documents the removed closure
- **WHEN** the allocation micro-benchmark runs against each Web adapter's context path
- **THEN** it shows the per-request header-lookup closure is no longer allocated when `trustProxy` is false

#### Scenario: All suites remain green
- **WHEN** the conformance suite and each Web adapter's own test suite run
- **THEN** they pass with the trims applied

#### Scenario: Coverage is maintained and changed branches are covered
- **WHEN** the test suites run with coverage
- **THEN** per-package line coverage stays at or above 90% and the changed `ip` / `next()` branches in each adapter are covered

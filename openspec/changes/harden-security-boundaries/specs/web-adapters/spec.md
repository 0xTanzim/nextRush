## MODIFIED Requirements

### Requirement: `ctx.ip` avoids a per-request lookup closure on the Web adapters when proxies are not trusted

The Bun, Deno, and Edge adapters SHALL resolve `ctx.ip` directly from the platform address when proxy
trust is `false`, without allocating a per-request header-lookup closure, producing the identical
value they produce today. When proxy trust is a hop count or a trusted-peer list, they SHALL resolve
via the shared client-IP policy — walking `X-Forwarded-For` from right to left and stopping at the
first address the trust specification does not cover. Untrusted proxy headers SHALL be ignored (as
today), and a vendor header such as `cf-connecting-ip` SHALL be honored only when the direct peer is
covered by the trust specification.

#### Scenario: Bun with proxy trust disabled returns the provided client IP without a lookup closure

- **WHEN** the Bun adapter handles a request with proxy trust `false` and a platform `clientIp`
- **THEN** `ctx.ip` equals that `clientIp` and no per-request header-lookup closure is allocated

#### Scenario: Bun with proxy trust disabled and no client IP yields an empty string

- **WHEN** the Bun adapter handles a request with proxy trust `false` and no platform `clientIp`
- **THEN** `ctx.ip` is `''`, matching today's behavior, with no lookup closure allocated

#### Scenario: Bun with proxy trust enabled resolves via the shared policy

- **WHEN** the Bun adapter handles a request with a hop count configured and a valid forwarded header
- **THEN** `ctx.ip` equals the policy result for that hop count, using the platform `clientIp` as the
  direct address

#### Scenario: Deno with proxy trust disabled returns the connection address

- **WHEN** the Deno adapter handles a request with proxy trust `false`
- **THEN** `ctx.ip` equals `connInfo.remoteAddr.hostname` (or `''`), with no lookup closure allocated

#### Scenario: Deno with proxy trust enabled resolves via the shared policy

- **WHEN** the Deno adapter handles a request with a trust specification and a valid forwarded header
- **THEN** `ctx.ip` equals the policy result for that specification

#### Scenario: Edge with proxy trust disabled yields an empty string without a lookup closure

- **WHEN** the Edge adapter handles a request with proxy trust `false`
- **THEN** `ctx.ip` is `''` (Edge has no socket address), with no lookup closure allocated

#### Scenario: Edge's Cloudflare precedence applies only under a trust specification

- **WHEN** the Edge adapter handles a request with a trust specification configured
- **THEN** `ctx.ip` resolves with the `cf-connecting-ip` → `x-forwarded-for` → `x-real-ip` precedence;
  **AND WHEN** proxy trust is `false`, `cf-connecting-ip` is ignored

#### Scenario: Edge with no platform peer address cannot verify a peer list

- **WHEN** the Edge adapter is configured with a trusted-peer CIDR list and the platform supplies no
  direct peer address
- **THEN** the configuration is refused at boot with an error directing the developer to a hop count,
  because a peer list is unverifiable without a peer address

#### Scenario: Untrusted proxy headers are ignored on every Web adapter

- **WHEN** any of Bun/Deno/Edge handles a request with proxy trust `false` and `x-forwarded-for` /
  `x-real-ip` present
- **THEN** `ctx.ip` is the platform address (the proxy headers are ignored), matching today

### Requirement: `ctx.ip` and `ctx.next()` behavior stays identical across all four adapters

`ctx.ip` resolution policy and `ctx.next()` behavior SHALL be identical across Node, Bun, Deno, and
Edge, pinned by the `packages/adapters/conformance` suite. "Identical" means the same trust
specification handling, chain-walk direction, header precedence, validation, and `next()` semantics;
the literal `ctx.ip` value may still differ only by the platform-supplied direct address when no
trusted header applies. The canonical-path contract (`ctx.path` carrying the router-matched value and
`ctx.originalPath` carrying the raw target) SHALL likewise be identical across all four adapters.

#### Scenario: The conformance suite stays green across all adapters

- **WHEN** the `packages/adapters/conformance` suite runs
- **THEN** it passes for all four adapters with no behavioral divergence in `ctx.ip` / `ctx.next()`

#### Scenario: The same header set and trust setting apply the same policy everywhere

- **WHEN** each adapter resolves `ctx.ip` for the same request headers and the same trust
  specification
- **THEN** each applies the same chain-walk direction, precedence, and validation, differing only in
  the platform direct address when no trusted entry matches

#### Scenario: A forged leftmost forwarded entry is rejected identically everywhere

- **WHEN** the conformance suite sends `X-Forwarded-For: 1.2.3.4, <trusted-peer>` with a hop count of
  1 to every adapter
- **THEN** no adapter returns `1.2.3.4`

#### Scenario: Edge's Cloudflare precedence is pinned in conformance

- **WHEN** the conformance suite exercises Edge `ctx.ip` with a trust specification and
  `cf-connecting-ip` present
- **THEN** the Cloudflare precedence is asserted, so a future edit cannot silently drop it

#### Scenario: Canonical path parity is pinned in conformance

- **WHEN** the conformance suite dispatches a request whose target contains repeated slashes and mixed
  case to every adapter
- **THEN** every adapter reports the same `ctx.path` and the same `ctx.originalPath`

#### Scenario: Dot-segment rejection parity is pinned in conformance

- **WHEN** the conformance suite dispatches `/a/../b` to every adapter
- **THEN** every adapter responds 400 without dispatching a handler

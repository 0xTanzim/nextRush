## ADDED Requirements

### Requirement: Proxy trust is expressed as a hop count or a trusted-peer list

The application option that governs proxy-header trust SHALL accept `false` (trust nothing),
a positive integer (the number of trusted proxy hops to skip, counting from the right of
`X-Forwarded-For`), or an array of CIDR strings (the peers whose forwarded assertions are trusted).
The legacy boolean `true` SHALL be rejected at boot with an actionable error naming both replacements.
This is a **BREAKING** change to the `proxy` option's type; the migration path is `proxy: 1` for a
single reverse proxy or `proxy: ['10.0.0.0/8']` for a known proxy network.

#### Scenario: A hop count selects the correct entry

- **WHEN** `proxy: 1` is configured and a request arrives with
  `X-Forwarded-For: 203.0.113.9, 10.0.0.5`
- **THEN** `ctx.ip` is `10.0.0.5` — the entry the trusted hop asserted, not the client-authored
  leftmost value

#### Scenario: A trusted-peer list stops at the first untrusted address

- **WHEN** `proxy: ['10.0.0.0/8']` is configured and a request arrives with
  `X-Forwarded-For: 203.0.113.9, 198.51.100.7, 10.0.0.5` from peer `10.0.0.5`
- **THEN** `ctx.ip` is `198.51.100.7` — the walk stops at the first address outside the trust set

#### Scenario: A forged header from an untrusted peer is ignored entirely

- **WHEN** `proxy: ['10.0.0.0/8']` is configured and a request arrives directly from `203.0.113.9`
  carrying `X-Forwarded-For: 1.2.3.4`
- **THEN** `ctx.ip` is `203.0.113.9` — the direct peer address, because the peer is not trusted to
  assert anything

#### Scenario: The legacy boolean is refused

- **WHEN** an application is configured with `proxy: true`
- **THEN** boot throws an error naming the hop-count and trusted-peer forms

#### Scenario: A hop count larger than the chain falls back to the direct peer

- **WHEN** `proxy: 3` is configured and only one forwarded entry is present
- **THEN** `ctx.ip` is the direct peer address, never an attacker-supplied entry

#### Scenario: Malformed entries in the chain do not shift the selection

- **WHEN** a trusted chain contains a malformed entry (`not-an-ip`, an empty element, or an
  unbracketed IPv6 with a port)
- **THEN** the malformed entry is not returned; resolution either selects the next valid trusted entry
  or falls back to the direct peer, and never returns a value from an untrusted position

#### Scenario: Zero is not a valid hop count

- **WHEN** `proxy: 0` is configured
- **THEN** boot throws, directing the developer to `proxy: false` for "trust nothing"

#### Scenario: A vendor header is honored only from a trusted peer

- **WHEN** a request carries `cf-connecting-ip` and the direct peer is outside the configured trust
  set
- **THEN** the header is ignored

## MODIFIED Requirements

### Requirement: `ctx.ip` resolution avoids a per-request closure when proxies are not trusted

When proxy trust is `false`, `NodeContext` SHALL set `ctx.ip` directly from the socket address
without allocating a header-lookup closure or invoking the proxy-header resolution policy, and
SHALL produce the identical `ctx.ip` value it produces today. When proxy trust is a hop count or a
trusted-peer list, it SHALL resolve `ctx.ip` via the shared client-IP policy, walking
`X-Forwarded-For` from right to left and stopping at the first address the trust specification does
not cover. The leftmost forwarded entry SHALL NOT be selected merely because it is present. The
resolved value SHALL remain readable (never `undefined`) regardless of when `ctx.ip` is accessed.

#### Scenario: Proxy trust disabled returns the socket address without a lookup closure

- **WHEN** a request is handled with proxy trust `false`
- **THEN** `ctx.ip` equals the socket remote address, and no per-request header-lookup closure is
  allocated for IP resolution

#### Scenario: Proxy trust disabled ignores proxy headers (parity with today)

- **WHEN** proxy trust is `false` and the request carries `x-forwarded-for` / `x-real-ip` headers
- **THEN** `ctx.ip` still equals the socket remote address (the proxy headers are ignored), identical
  to today's behavior

#### Scenario: Proxy trust enabled resolves via the shared policy, right to left

- **WHEN** proxy trust is a hop count or peer list and a valid `x-forwarded-for` header is present
- **THEN** `ctx.ip` resolves to the entry selected by walking the chain from the right under that
  trust specification

#### Scenario: A socket with no remote address yields an empty string

- **WHEN** the socket has no `remoteAddress`
- **THEN** `ctx.ip` is the empty string `''`, matching today's `?? ''` fallback

#### Scenario: The value is stable regardless of read timing

- **WHEN** `ctx.ip` is read at any point during (or after) request handling
- **THEN** it returns the address captured for that request and is never `undefined`

#### Scenario: An IPv4-mapped or bracketed IPv6 peer is normalized consistently

- **WHEN** the socket address is `::ffff:10.0.0.5` or a bracketed IPv6 with a port, and a trusted-peer
  list is configured
- **THEN** the trust comparison and the published `ctx.ip` use the same normalized form, so a peer is
  never treated as untrusted purely because of its textual representation

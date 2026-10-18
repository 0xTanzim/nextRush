# Spec Delta

## MODIFIED Requirements

### Requirement: `ctx.ip` and `ctx.next()` behavior stays identical across all four adapters

`ctx.ip` resolution policy and `ctx.next()` behavior SHALL be identical across Node, Bun, Deno, and
Edge, pinned by the `packages/adapters/conformance` suite. "Identical" means the same trust
specification handling, chain-walk direction, header precedence, validation, and `next()` semantics;
the literal `ctx.ip` value may still differ only by the platform-supplied direct address when no
trusted header applies. The canonical-path contract (`ctx.path` carrying the router-matched value and
`ctx.originalPath` carrying the raw target) SHALL likewise be identical across all four adapters.

Dot-segment rejection parity SHALL be asserted against each adapter's negotiated capabilities rather
than asserted as uniform behaviour: an adapter whose platform preserves the request target MUST reject
a dot segment with 400 before dispatching a handler, and an adapter whose platform normalizes the
target before the application observes it MUST report that through the negotiated request-target
capability and produce the documented outcome for that platform.

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

#### Scenario: Dot-segment rejection is driven by the request-target capability

- **WHEN** the conformance suite dispatches a literal and a percent-encoded dot segment to an adapter
  whose negotiated capabilities report that the raw request target is unavailable
- **THEN** the adapter produces the outcome its capability and documentation declare, and the suite
  fails if the adapter's reported capability and its observed behaviour disagree

## ADDED Requirements

### Requirement: The incoming-header record is materialised only when read

The Web adapters SHALL build the incoming-header record on first read of `ctx.headers` and memoise
it, so a request that never reads the record allocates none. A single-name lookup through `ctx.get`
SHALL read the platform headers directly without materialising the record. The record's
prototype-less shape, case-insensitive lookup, and `set-cookie` array handling SHALL be unchanged.

#### Scenario: A request that never reads ctx.headers builds no record

- **WHEN** a Web adapter request is handled by a handler that reads only `ctx.body` or `ctx.path`
- **THEN** the incoming-header record is not constructed for that request

#### Scenario: ctx.headers is memoised with stable identity

- **WHEN** `ctx.headers` is read once or repeatedly
- **THEN** the same record object is returned each time

#### Scenario: A single-name lookup does not materialise the record

- **WHEN** `ctx.get('x-request-id')` is called on a request whose header record was never read
- **THEN** the value is returned and the record is still not constructed

#### Scenario: Record semantics are identical to today

- **WHEN** the record is materialised for a request carrying repeated `set-cookie` headers, a header
  with unusual casing, and a `__proto__` header
- **THEN** `set-cookie` is an array, lookup is case-insensitive, the record has no prototype, and no
  polluting property is created

### Requirement: The client IP is resolved only when read

Where a platform client address is obtained through a call that allocates or blocks, the Web adapters
SHALL resolve it on first read of `ctx.ip` and memoise the result instead of resolving it for every
request. The trust-chain policy, the resolved value, and the empty-string result when no address is
available SHALL be unchanged.

#### Scenario: A handler that never reads ctx.ip performs no address lookup

- **WHEN** a Web adapter request is handled by a handler that never reads `ctx.ip`
- **THEN** the platform client-address lookup is not performed for that request

#### Scenario: Repeated reads resolve once

- **WHEN** `ctx.ip` is read twice in one request
- **THEN** the platform lookup runs exactly once and both reads return the same value

#### Scenario: Proxy trust is unchanged

- **WHEN** proxy trust is configured as a hop count or a trusted-peer list and a forwarded header is
  present
- **THEN** `ctx.ip` equals the shared policy's result, whether or not the handler reads it early

#### Scenario: An absent platform address yields the empty string

- **WHEN** the platform exposes no client address and proxy trust is disabled
- **THEN** `ctx.ip` is `''`, as today

### Requirement: The request path is derived without constructing a URL

The Web adapters SHALL derive the path, the query string, and `ctx.originalPath` from the request
target by scanning the target string, without constructing a `URL` object per request. The
derivation SHALL handle absolute-form targets, an absent path, an IPv6 authority, a fragment
separator, and a query-only target, and SHALL produce the same values the current implementation
produces for a target without dot segments.

#### Scenario: No URL object is constructed per request

- **WHEN** a Web adapter handles a request
- **THEN** the path and query are derived without constructing a `URL` for that request

#### Scenario: Absolute-form and unusual targets are handled

- **WHEN** the request target is `https://host/a/b?x=1`, `https://[::1]:8443/a?x=1`, `/?x=1`, `/a#f`,
  or `/a?`
- **THEN** path, query and `originalPath` are derived correctly and parsing never throws

#### Scenario: Derived values match the current implementation

- **WHEN** an ordinary target such as `/users/ABC?limit=10` is handled
- **THEN** `ctx.path`, `ctx.originalPath` and `ctx.query` equal the values the previous
  implementation produced

#### Scenario: Query parsing may be deferred only when measured

- **WHEN** query parsing is deferred to first read of `ctx.query`
- **THEN** it is adopted only if the committed request-cost gate shows no regression, and `ctx.query`
  keeps its read-only, shared-empty-object contract

### Requirement: The handler timeout is armed only when the handler has not already settled

The Web adapters SHALL arm the handler timeout only when the handler has not already settled
synchronously, matching the Node adapter's fast path. When a timer is armed, the timeout interval,
the 504 response body, the cancellation signal, and the warning text SHALL be unchanged.

#### Scenario: A synchronous handler arms no timer

- **WHEN** a handler writes its response before returning
- **THEN** no timer is scheduled for that request and no timeout racing is performed

#### Scenario: A slow handler still times out with the same response

- **WHEN** a handler does not settle within the configured timeout
- **THEN** the client receives the same 504 body as before, the cancellation signal is aborted, and
  the same warning is emitted

#### Scenario: Timer behaviour is identical across adapters

- **WHEN** the conformance and adapter test suites run the timeout scenarios
- **THEN** Node, Bun, Deno, Edge and serverless produce the same observable outcome

### Requirement: The Web adapters share one per-request runner

The Web adapters SHALL use one shared per-request runner for boot, context construction, timeout
arming and response finalization, rather than per-adapter copies of that logic. Each adapter SHALL
supply only its platform bindings, and a behaviour fixed in the runner SHALL take effect on every
adapter without a second edit.

#### Scenario: One runner serves every Web adapter

- **WHEN** the Web adapters' request entry points are inspected
- **THEN** each delegates to the shared runner and none re-implements boot, timeout arming or
  finalization

#### Scenario: A runner-level fix reaches every adapter

- **WHEN** a behaviour is changed in the shared runner
- **THEN** every Web adapter's tests and the conformance suite observe the change with no
  adapter-local patch

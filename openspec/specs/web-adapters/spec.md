# web-adapters

## Purpose

The Web-platform adapters (`@nextrush/adapter-bun`, `-deno`, `-edge`) and their shared per-request
Context/response behavior: a shared frozen empty query object in `parseQueryString`, the
`set-cookie` `toLowerCase` pre-check in `WebResponseBuilder.set`, the lazily-memoized `ctx.raw`
wrapper, the `ctx.ip` trust-proxy resolution (including Edge's `cf-connecting-ip` precedence), and
the `ctx.next()` direct-forward. Every behavior is held byte-identical to its pre-optimization form
and identical across all four adapters (Node + the three), pinned by
`packages/adapters/conformance` and validated by allocation micro-benchmarks rather than an RPS
A/B (since the `wrk` suite drives only the Node server).

## Requirements

### Requirement: A query-less Web request uses a shared frozen empty query object

`parseQueryString` SHALL return a shared frozen empty query object for its empty and over-limit
early-return cases instead of allocating a fresh object, so a query-less Bun/Deno/Edge request
allocates no throwaway query object, while the non-empty parse path is unchanged. `ctx.query` MUST
remain read-only.

#### Scenario: A query-less request across Web adapters gets the shared frozen empty object
- **WHEN** a Bun, Deno, or Edge request with no query string is handled
- **THEN** `ctx.query` is the shared frozen empty query object (no fresh per-request object is allocated) and is empty

#### Scenario: A non-empty query is parsed unchanged
- **WHEN** a request with `?a=1&b=2` is handled on any Web adapter
- **THEN** `ctx.query` equals the parsed params, identical to today (its own object, not the shared instance)

#### Scenario: An over-limit query rejects to the shared empty object
- **WHEN** a query string longer than the max length is received
- **THEN** `parseQueryString` returns the shared frozen empty object (reject-to-empty), matching today's empty result

### Requirement: `WebResponseBuilder.set` gates the set-cookie toLowerCase behind a cheap pre-check

`WebResponseBuilder.set` SHALL detect `set-cookie` via a constant-time pre-check before falling back
to `field.toLowerCase()`, so non-cookie headers allocate no lowercased string, while `Set-Cookie` is
still detected case-insensitively and accumulated. The `assertHeaderSafe` CRLF guard and the
array-value branch MUST be unchanged.

#### Scenario: Set-Cookie is detected across casings and accumulates
- **WHEN** `ctx.set('Set-Cookie', …)`, `ctx.set('set-cookie', …)`, or `ctx.set('SET-COOKIE', …)` is called with a string value on a Web adapter
- **THEN** each is detected as a cookie and appended (multiple cookies accumulate), identical to today

#### Scenario: A non-cookie header skips the toLowerCase allocation
- **WHEN** `ctx.set('Content-Type', 'text/plain')` (or any non-cookie header) is called
- **THEN** the header is set correctly and no `toLowerCase()` string is allocated for cookie detection

#### Scenario: The CRLF guard and array-value branch are unaffected
- **WHEN** `ctx.set` is called with a CR/LF in field or value, or with an array value
- **THEN** `assertHeaderSafe` still throws for CR/LF, and an array value still replaces then appends each entry, identical to today

### Requirement: `ctx.raw` is built lazily and identically on the Web adapters

Bun, Deno, and Edge contexts SHALL build the `{ req, res }` wrapper only when `ctx.raw` is read
(memoized getter), holding `req` in a private field that the internal `signal`/timeout paths use.
`ctx.raw` MUST return the same `{ req, res: undefined }` shape and stable identity as today, and
behavior MUST stay identical across all three adapters.

#### Scenario: A request that never reads ctx.raw allocates no wrapper
- **WHEN** a Bun/Deno/Edge request is handled by a handler that never reads `ctx.raw`
- **THEN** no `{ req, res }` wrapper object is allocated for that request

#### Scenario: ctx.raw returns the identical shape and is memoized
- **WHEN** `ctx.raw` is read (once or repeatedly) on any Web adapter
- **THEN** it returns `{ req: <the Request>, res: undefined }`, and repeated reads return the same object (`ctx.raw === ctx.raw`)

#### Scenario: Signal and timeout still work after the refactor
- **WHEN** `ctx.signal` is accessed or `triggerTimeout` fires
- **THEN** the abort signal combines the request signal and the timeout controller exactly as today, using the private `req` field

### Requirement: The trims stay cross-adapter-consistent and are validated by allocation and conformance gates

Because each trim is <1%, the change SHALL be accepted on deterministic allocation reduction,
byte-identical parity, and the cross-adapter conformance suite rather than an RPS A/B, and coverage
MUST NOT decrease.

#### Scenario: The conformance suite stays green
- **WHEN** the `packages/adapters/conformance` suite runs across Node/Bun/Deno/Edge

### Requirement: A Next.js App Router route handler can mount a NextRush application without rewriting the request

`@nextrush/adapter-nextjs`'s `handle(app)` SHALL return the seven Next.js route-handler exports
(`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`) by delegating to
`@nextrush/adapter-edge`'s `createFetchHandler`, forwarding the incoming `Request` unmodified.
Mount prefixes MUST be declared by the application itself (`app.route(prefix, router)`) and MUST
NOT be inferred or stripped by the adapter. The package MUST import no runtime-specific API
(`node:*`, `process`, `Buffer`, or a `Deno`/`Bun` global) and MUST support only the App Router on
Next.js 14, 15, and 16.

#### Scenario: A mounted app sees the true request

- **WHEN** a request to `/api/hello` reaches a route handler built with `handle(app)`, and `app`
  declares `app.route('/api', router)` with `router.get('/hello', …)`
- **THEN** the handler's `ctx.path` is `/api/hello`, `ctx.url` is the full request URL, and
  `ctx.raw.req` is the same `Request` object Next.js passed in — none of them show a stripped path

#### Scenario: All seven methods are available from one call

- **WHEN** `handle(app)` is called
- **THEN** it returns an object with `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS`,
  each dispatching to the same underlying `Application`

#### Scenario: Background work reaches Next's `after()` when available

- **WHEN** a handler calls `ctx.waitUntil(promise)` under a Next.js version exposing
  `after` from `next/server`
- **THEN** `promise` is scheduled through `after()`; when `next/server` cannot be imported or
  exposes no `after`, `ctx.waitUntil()` no-ops without throwing

#### Scenario: A mount-prefix mismatch is diagnosed, never silently rescued, in development

- **WHEN** the underlying application produces a 404 for a request, `app.options.env` is not
  `'production'`, and the app has a matching route once the route file's mount segments are
  removed from the path
- **THEN** the framework logs an actionable message naming the mounted prefix and the missing
  `app.route()` call, and still returns the original 404 response — the alternate path is never
  served

#### Scenario: Cross-runtime parity holds for the Next.js entry point

- **WHEN** the `packages/adapters/conformance` suite's `nextjs` driver runs under the node,
  workerd, deno, and bun runners
- **THEN** observable behavior (status, headers, body, error shape) is identical across all four,
  matching the other Web adapters covered by this capability

#### Scenario: The functional install path stays free of Next.js

- **WHEN** a project runs `pnpm add nextrush` with no further installs
- **THEN** neither `@nextrush/adapter-nextjs` nor `next` is resolved onto disk
- **THEN** all cross-adapter behavior (query, headers, cookies, raw, responses) remains identical

#### Scenario: Allocation micro-benchmarks document the removed work
- **WHEN** `apps/benchmark/scripts/web-context-alloc.js` runs on a query-less, raw-unread request
- **THEN** it shows neither the empty-`query` object nor the `{ req, res }` wrapper is allocated

#### Scenario: Response parity is unaffected
- **WHEN** `pnpm bench:validate` runs across all benchmark servers
- **THEN** response bodies and Content-Type remain byte-identical

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

### Requirement: The Web per-request-work optimization is validated by allocation and coverage gates

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

### Requirement: Bun and Deno standardize on the nested tls shape
`@nextrush/adapter-bun` and `@nextrush/adapter-deno` SHALL expose the same `ServeOptions.tls: { cert: string | Buffer; key: string | Buffer; ca?: string | Buffer }` shape. Deno's pre-existing flat `cert`/`key` fields SHALL be retained as deprecated aliases for one minor version (each carrying a `@deprecated` JSDoc pointing at `tls`), then removed. `host` remains the canonical host-binding field name on both adapters.

#### Scenario: Bun's existing tls shape is unchanged
- **WHEN** `ServeOptions.tls` is inspected on `@nextrush/adapter-bun` after this change
- **THEN** it is byte-identical to its pre-change shape — no consumer of Bun's `tls` option needs to change anything

#### Scenario: Deno gains the nested tls field alongside deprecated aliases
- **WHEN** `serve(app, { tls: { cert, key } })` is called on the Deno adapter
- **THEN** it behaves identically to the pre-change `serve(app, { cert, key })` call

#### Scenario: Deno's flat fields remain functional but marked deprecated
- **WHEN** `serve(app, { cert, key })` (flat form) is called on the Deno adapter during the deprecation window
- **THEN** the server starts successfully with a `@deprecated` JSDoc visible in editor tooling, and behavior is unchanged from before this change

#### Scenario: Deno negotiates HTTP/2 automatically once tls is present
- **WHEN** `tls`/`cert`+`key` is supplied to the Deno adapter and a connecting client offers `h2` via ALPN
- **THEN** `Deno.serve()`'s native negotiation selects HTTP/2, with no separate protocol option required

### Requirement: Edge adapter's non-involvement in TLS/protocol negotiation is explicit
`@nextrush/adapter-edge` SHALL NOT expose a `tls` option. TLS termination and HTTP protocol negotiation for edge runtimes are the hosting platform's responsibility, occurring upstream of the adapter's isolate. The edge adapter's capability profile SHALL report `secureServing: false` and `http2: false` to reflect that the adapter itself performs neither — this is a statement about adapter responsibility, not a claim that the platform lacks TLS/HTTP2 (it typically has both, transparently).

#### Scenario: Edge adapter has no tls option
- **WHEN** the edge adapter's public options are inspected
- **THEN** no `tls`/`cert`/`key` field exists, consistent with its documented "TLS is the platform's job" architecture

#### Scenario: Edge capability profile does not overstate adapter responsibility
- **WHEN** `EdgeProfile`/`CloudflareProfile`/`VercelEdgeProfile` are read
- **THEN** `secureServing` and `http2` report `false`, reflecting that the adapter does not perform this negotiation itself

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
synchronously, matching the Node adapter's fast path. A response the handler already committed SHALL
be delivered rather than replaced by the 504. When a timer is armed, the timeout interval, the 504
response body, the cancellation signal, and the warning text SHALL be unchanged.

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

#### Scenario: A committed response is not replaced by the 504

- **WHEN** a handler commits a response and then continues working past the configured timeout
- **THEN** the client receives the handler's committed response rather than a 504, and the observable
  outcome matches the Node adapter for the same handler

### Requirement: The Web adapters share one per-request runner

The Web adapters SHALL use one shared per-request runner for boot, context construction, timeout
arming and response finalization, rather than per-adapter copies of that logic. Each adapter SHALL
supply only its platform bindings, and a behaviour fixed in the runner SHALL take effect on every
adapter without a second edit. The runner SHALL flush the recorded outgoing response once, after the
middleware chain settles, and SHALL derive the materialised `Response` from the record rather than
from a private builder state that post-handler middleware cannot reach.

#### Scenario: One runner serves every Web adapter

- **WHEN** the Web adapters' request entry points are inspected
- **THEN** each delegates to the shared runner and none re-implements boot, timeout arming or
  finalization

#### Scenario: A runner-level fix reaches every adapter

- **WHEN** a behaviour is changed in the shared runner
- **THEN** every Web adapter's tests and the conformance suite observe the change with no
  adapter-local patch

#### Scenario: The flush reads the record

- **WHEN** a post-handler middleware writes a header or replaces the body, and the runner flushes
- **THEN** the materialised `Response` carries that write, and no adapter-local path bypasses the
  record

### Requirement: The Web response builder records instead of committing

The Web response builder SHALL record the outgoing status, headers and body, and SHALL NOT produce a
`Response` until the runner flushes after the chain settles. A post-handler header write or body
replacement SHALL be visible on the flushed `Response`. The builder's existing byte-level guarantees
— the default `Content-Type` strings, HEAD/204/304 body suppression, accumulated `Set-Cookie`, the
resolve-before-commit serialization guarantee, and the unanswered-error envelope — SHALL be unchanged.

#### Scenario: A response method materialises nothing

- **WHEN** a handler calls `ctx.json()`, `ctx.send()`, `ctx.html()` or `ctx.redirect()`
- **THEN** no `Response` object is constructed for that request until the runner flushes

#### Scenario: A post-handler write reaches the materialised Response

- **WHEN** a middleware sets a header after `await next()` on a Web adapter
- **THEN** the flushed `Response` carries the header

#### Scenario: A post-handler body replacement reaches the materialised Response

- **WHEN** a middleware replaces the recorded body after `await next()` on a Web adapter
- **THEN** the flushed `Response` carries the new bytes, and any `Content-Length` it declares
  matches them — never the length of the body that was replaced

#### Scenario: Existing byte-level guarantees are unchanged

- **WHEN** the conformance and adapter suites run the JSON, text, HTML, redirect, HEAD, 204, 304 and
  cookie scenarios
- **THEN** status, header values and body bytes are identical to the pre-change output

#### Scenario: A serialization failure still leaves the response uncommitted

- **WHEN** `ctx.json(value)` is called with a value `JSON.stringify` cannot represent
- **THEN** it throws before the record is committed, and the error handler can still answer

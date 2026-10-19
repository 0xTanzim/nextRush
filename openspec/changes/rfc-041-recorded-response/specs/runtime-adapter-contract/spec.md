## MODIFIED Requirements

### Requirement: The outgoing response has a defined view for middleware that runs after the handler

Every adapter SHALL expose one recorded outgoing response that middleware running after the handler
can inspect and rewrite: status, headers, and the serialized body. `ctx.body` SHALL continue to mean
the parsed request body and MUST NOT be read as the outgoing response body. Response-aware middleware
SHALL read the record and SHALL NOT need an adapter-specific branch, and MUST NOT compress, hash or
transform the request body as a substitute for the response.

#### Scenario: ctx.body is never the outgoing response

- **WHEN** a middleware that runs after the handler inspects `ctx.body` on a GET request
- **THEN** it observes no outgoing response body there, and the recorded outgoing response is the
  only supported way to reach it

#### Scenario: Response middleware does not work on the request body

- **WHEN** a compressing middleware processes a request that carries a body
- **THEN** the request body is never compressed, transformed or replaced

#### Scenario: Absent outgoing body is reported once, and documented

- **WHEN** response-aware middleware finds no outgoing body it can act on, because the response is a
  started stream or a bodyless status
- **THEN** it emits one warning per process and its README states the limitation, rather than returning
  silently

#### Scenario: A response-aware middleware rewrites the record on every adapter

- **WHEN** a middleware runs after the handler, reads the recorded outgoing response, replaces its
  body or sets a header, on Node, Bun, Deno, Edge or serverless
- **THEN** the client observes the rewritten body or header on every adapter with no per-adapter
  branch in the middleware

#### Scenario: A documented example has the documented effect

- **WHEN** a response-aware middleware ships a documented example in its JSDoc or README
- **THEN** the example's observable effect occurs on every adapter, or the example is corrected to
  match the actual behaviour

#### Scenario: Post-handler header writes are pinned by conformance

- **WHEN** the conformance suite runs a middleware that sets a response header after `await next()`
- **THEN** the header is asserted present on every adapter, with no capability flag permitting a
  divergence

#### Scenario: A streamed response is not rewritable

- **WHEN** a handler has started a streamed response and a post-handler middleware attempts to
  rewrite the record
- **THEN** the write is refused and reported, because a started stream is committed and is never
  buffered

### Requirement: Post-handler writes and timeout completion are parity-pinned across adapters

Observable parity across adapters SHALL extend to the middleware surface that runs after the
handler: a post-handler response-header or body write MUST produce the same observable outcome on
every adapter, and a handler that commits a response and then outlives the configured timeout MUST
deliver that committed response on every adapter. A divergence in either MUST fail the cross-adapter
conformance suite rather than being treated as an adapter-specific detail.

#### Scenario: A post-handler header write behaves identically everywhere

- **WHEN** the conformance suite runs a middleware that writes a response header after `await next()`
  against every shipped adapter
- **THEN** every adapter completes the full middleware chain and reports the same header outcome

#### Scenario: A post-handler body rewrite behaves identically everywhere

- **WHEN** the conformance suite runs a middleware that replaces the outgoing body after
  `await next()` against every shipped adapter
- **THEN** every adapter delivers the rewritten body, and none declares a `Content-Length` that
  disagrees with it

#### Scenario: A committed response outlives the timeout on every adapter

- **WHEN** a handler commits a response and then continues working past the configured timeout on
  every shipped adapter
- **THEN** every adapter delivers the committed response and none substitutes a `504`

#### Scenario: A divergence fails the suite

- **WHEN** any adapter's post-handler write outcome or timeout-completion outcome differs from the
  others
- **THEN** the cross-adapter conformance suite fails and the adapter is not considered shipped

#### Scenario: No adapter declares a post-handler capability difference

- **WHEN** the conformance driver contract is inspected
- **THEN** it carries no flag describing whether a post-handler header write lands, because every
  adapter does

## ADDED Requirements

### Requirement: The flush happens once, after the middleware chain unwinds

An adapter SHALL flush the recorded outgoing response exactly once, after the composed middleware
chain settles, and SHALL NOT write headers or a body from inside a response method. A streamed
response is the sole exception and commits at the point the stream is wired.

#### Scenario: A response method writes no bytes

- **WHEN** a handler calls `ctx.json()`, `ctx.send()`, `ctx.html()` or `ctx.redirect()`
- **THEN** no header or body byte reaches the transport until the middleware chain has settled

#### Scenario: Post-handler middleware still influences the response

- **WHEN** a middleware writes a header or replaces the body after `await next()`
- **THEN** the flushed response carries that write, on every adapter

#### Scenario: The flush is not repeated

- **WHEN** the chain settles and the adapter flushes
- **THEN** exactly one flush occurs for the request, and a second flush attempt is a no-op

#### Scenario: A started stream commits immediately

- **WHEN** a handler wires a stream through `sendStream`, SSE or NDJSON
- **THEN** the response commits at that point and is never buffered or re-flushed

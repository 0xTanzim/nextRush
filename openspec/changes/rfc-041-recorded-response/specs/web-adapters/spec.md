## MODIFIED Requirements

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

## ADDED Requirements

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
- **THEN** the flushed `Response` carries the new bytes and a `Content-Length` matching them

#### Scenario: Existing byte-level guarantees are unchanged

- **WHEN** the conformance and adapter suites run the JSON, text, HTML, redirect, HEAD, 204, 304 and
  cookie scenarios
- **THEN** status, header values and body bytes are identical to the pre-change output

#### Scenario: A serialization failure still leaves the response uncommitted

- **WHEN** `ctx.json(value)` is called with a value `JSON.stringify` cannot represent
- **THEN** it throws before the record is committed, and the error handler can still answer

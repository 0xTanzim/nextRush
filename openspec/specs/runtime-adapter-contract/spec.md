# runtime-adapter-contract

## Purpose

The typed, enforced `ServerAdapter`/`FetchAdapter` two-tier contract, the shared `Context` factory
shape, the compile-time conformance guard, and the observable-parity requirements every NextRush
adapter must satisfy.

## Requirements

### Requirement: Typed two-tier adapter contracts
The framework SHALL export two adapter contract types from `@nextrush/types`: `ServerAdapter` (long-lived listener) and `FetchAdapter` (per-invocation `(Request) => Response`). Every shipped adapter MUST conform to exactly one of these contracts. Adapters MUST NOT widen the shared `Context` contract.

#### Scenario: Server adapters declare the ServerAdapter contract
- **WHEN** the `node`, `bun`, and `deno` adapter modules are type-checked
- **THEN** each satisfies `ServerAdapter` (exposing `serve(app, opts)` and `createHandler(app)`) and compilation succeeds

#### Scenario: Fetch adapters declare the FetchAdapter contract
- **WHEN** the `edge` and `serverless` adapter modules are type-checked
- **THEN** each satisfies `FetchAdapter` (exposing `createFetchHandler(app, opts)`) and compilation succeeds

#### Scenario: A divergent adapter fails compilation
- **WHEN** an adapter module omits a required contract method or widens `Context`
- **THEN** `tsc` reports a type error and the build fails

### Requirement: Compile-time conformance guard
Each adapter package SHALL include a compile-time conformance guard (a typed `satisfies` assertion) proving the module implements its declared contract, so contract violations are caught at authoring time rather than at boot or runtime.

#### Scenario: Guard catches a signature drift before runtime
- **WHEN** an adapter's `createFetchHandler` return type stops resolving to `Promise<Response>`
- **THEN** the conformance guard produces a type error at build time, before any test executes

### Requirement: Shared context factory shape
All adapters SHALL build the request `Context` through an `AdapterContextFactory` shape that takes the platform request plus a combined `AbortSignal` and a `BodySource`, and returns the shared `Context`. Adapters MUST NOT re-implement middleware composition or routing; they MUST run `app.callback()`.

#### Scenario: Adapter delegates the pipeline to the core
- **WHEN** any adapter handles a request
- **THEN** it builds `Context` via the factory and invokes `app.callback()` rather than composing middleware or resolving routes itself

### Requirement: Header writes are validated against the full HTTP field grammar

The shared response-header write path SHALL validate that a field name is a valid RFC 9110 token and
that a field value contains no control characters and no leading or trailing whitespace — not only
carriage return and line feed. A rejection SHALL throw a typed framework error, not a bare `Error`,
and SHALL be identical on every adapter rather than relying on the underlying platform's own
validation as the only line of defense.

#### Scenario: A non-token field name is rejected

- **WHEN** `ctx.set('X Foo', 'bar')` or `ctx.set('X:Foo', 'bar')` is called
- **THEN** a typed header-validation error is thrown before the platform is touched

#### Scenario: A control character in a value is rejected

- **WHEN** a header value containing a NUL, `\x1F`, or `\x7F` byte is set
- **THEN** a typed header-validation error is thrown

#### Scenario: Obs-fold and surrounding whitespace are rejected

- **WHEN** a header value with a leading space, a trailing space, or an embedded `\r\n\t` sequence is
  set
- **THEN** a typed header-validation error is thrown

#### Scenario: CR and LF remain rejected in both name and value

- **WHEN** either the field name or the field value contains `\r` or `\n`
- **THEN** a typed header-validation error is thrown

#### Scenario: Array values are validated element-wise

- **WHEN** a header is set with an array value where one element is invalid
- **THEN** the write is rejected and no element is applied

#### Scenario: Numeric values are accepted

- **WHEN** a header is set with a numeric value such as a content length
- **THEN** the write succeeds

#### Scenario: Validation is identical across adapters

- **WHEN** the conformance suite performs each rejected write above on every adapter
- **THEN** every adapter throws the same typed error for the same input

### Requirement: The client-IP trust policy is a conformance-pinned parity requirement

The proxy trust specification and its chain-walk semantics SHALL be defined once in the shared runtime
and consumed unchanged by every adapter. The conformance suite SHALL assert that no adapter can be
made to return a client-authored forwarded entry, and that an adapter which cannot supply a direct
peer address refuses a trusted-peer-list configuration at boot.

#### Scenario: One policy implementation serves every adapter

- **WHEN** the adapters' client-IP resolution is inspected
- **THEN** each delegates to the shared policy with no adapter-local precedence or validation logic

#### Scenario: No adapter returns an untrusted forwarded entry

- **WHEN** the conformance suite sends a forged leftmost forwarded entry with each supported trust
  specification to every adapter
- **THEN** no adapter returns the forged value

#### Scenario: An adapter without a peer address refuses a peer list

- **WHEN** an adapter that cannot supply a direct peer address is configured with a trusted-peer CIDR
  list
- **THEN** boot throws with an error directing the developer to a hop count

### Requirement: Observable parity across adapters
For the shared `Context` contract, all adapters SHALL be observationally identical. The cross-adapter conformance suite MUST pass for every shipped adapter. Where an adapter reports the `http2` capability, observable parity MUST additionally hold across HTTP/1.1, HTTPS/1.1, and negotiated HTTP/2 for that adapter — routing, middleware execution, streaming, request-body handling, and error handling MUST produce byte-identical responses regardless of which transport a given request negotiated.

Parity MUST additionally hold for the security-relevant contract surface: client-IP resolution under
every supported proxy trust specification, header-write validation outcomes, the canonical `ctx.path`
and `ctx.originalPath` values, and dot-segment rejection. A security behavior that holds on one
adapter and not another MUST be treated as a conformance failure, not an adapter-specific detail.

#### Scenario: Retrofit preserves behavior
- **WHEN** an existing adapter is retrofitted to the typed contract
- **THEN** the conformance suite produces byte-identical responses (status, headers, body) before and after the retrofit

#### Scenario: HTTP/2 parity holds where the capability is reported
- **WHEN** an adapter reports `RuntimeCapabilities.http2: true` and the conformance suite runs the same request over HTTP/1.1 and negotiated HTTP/2
- **THEN** status, headers, and body are byte-identical between the two transports

#### Scenario: An adapter without http2 is not required to prove HTTP/2 parity
- **WHEN** an adapter reports `RuntimeCapabilities.http2: false`
- **THEN** the conformance suite does not require HTTP/2 scenarios for that adapter, consistent with `runtime-capability-negotiation`'s graceful-degradation requirement

#### Scenario: Security parity is asserted, not assumed

- **WHEN** the conformance suite runs its security-parity scenarios (client IP under each trust form,
  rejected header writes, canonical path, dot-segment rejection) against every shipped adapter
- **THEN** all adapters produce identical outcomes, and a divergence fails the suite

#### Scenario: A new adapter cannot ship without the security-parity scenarios

- **WHEN** a new adapter is added to the conformance driver
- **THEN** the security-parity scenarios run against it and must pass before it is considered shipped

### Requirement: Every public per-request entry point boots the application before it dispatches

Every adapter entry point that hands the application a request — `serve()`, `createHandler()` and
`createFetchHandler()` — SHALL boot the application before the first dispatch, so an application that
declares routes is fully mounted without a manual `ready()`. Boot SHALL run at most once per
application and SHALL be shared by concurrent first requests.

#### Scenario: A handler that never awaited ready() routes correctly

- **WHEN** an application declares routes and an adapter handler is invoked without `await app.ready()`
- **THEN** the route matches and responds, and an unknown path responds 404 rather than an empty 200

#### Scenario: Concurrent first requests share one boot

- **WHEN** several requests arrive before boot completes
- **THEN** boot runs once and every request is dispatched against the fully mounted stack

#### Scenario: Extension setup runs exactly once

- **WHEN** an application with a registered extension is served through a handler created before boot
- **THEN** the extension's setup runs once across the whole application lifetime

#### Scenario: serve() still surfaces boot failures eagerly

- **WHEN** `serve()` is used and boot fails
- **THEN** the failure surfaces at startup rather than on the first request

### Requirement: A pre-boot application entry fails loudly instead of dispatching an incomplete stack

An application entry invoked before boot, while the application owns a router that boot would mount,
SHALL fail with an actionable error naming the cause and the fix, rather than returning a handler whose
middleware stack is missing the router.

#### Scenario: Calling callback() before ready() with an owned router is diagnosed

- **WHEN** application `callback()` is invoked before `ready()` while the application owns a router
  that boot would mount
- **THEN** it throws an error naming the cause and the fix, instead of silently returning a handler
  with an empty stack

#### Scenario: An explicitly mounted router is unaffected

- **WHEN** the application mounts its router explicitly and `callback()` is invoked without `ready()`
- **THEN** dispatch works as before, because no boot-time mount is being skipped

### Requirement: A request is never left unanswered

When the error path itself fails to produce a response, the framework SHALL supply a minimal 500
response rather than leaving the request unanswered. This SHALL hold for the application error
handler, for every adapter's response finalizer, and for the Web response builder, so no
configuration and no handler bug can produce a hanging socket or an empty body.

#### Scenario: An error handler that forgets to respond still answers the client

- **WHEN** a custom error handler completes without writing a response
- **THEN** the client receives a 500 with a JSON body

#### Scenario: A failing error handler still answers the client

- **WHEN** the error handler itself throws while writing its response
- **THEN** the framework supplies the minimal 500 body and the client is answered

#### Scenario: No path produces an empty 200

- **WHEN** any of the failure paths above is exercised on any adapter
- **THEN** the status is not 200, the body is not empty, and the response arrives promptly rather
  than after a socket timeout

### Requirement: The outgoing response has a defined view for middleware that runs after the handler

A middleware that runs after the handler SHALL have one defined way to inspect the outgoing response.
`ctx.body` SHALL continue to mean the parsed request body and MUST NOT be read as the outgoing
response body. Until a recorded-response model is adopted, response-aware middleware MUST NOT read,
compress, hash or transform the request body as if it were the response, and MUST report once — and
document — the absence of a readable outgoing body instead of silently doing nothing.

#### Scenario: ctx.body is never the outgoing response

- **WHEN** a middleware that runs after the handler inspects `ctx.body` on a GET request
- **THEN** it observes no outgoing response body there, and the framework's documented view is the
  only supported way to reach the outgoing response

#### Scenario: Response middleware does not work on the request body

- **WHEN** a compressing middleware processes a request that carries a body
- **THEN** the request body is never compressed, transformed or replaced

#### Scenario: Absent outgoing body is reported once, and documented

- **WHEN** response-aware middleware finds no outgoing body it can act on
- **THEN** it emits one warning per process and its README states the limitation, rather than returning
  silently

#### Scenario: A documented example has the documented effect

- **WHEN** a response-aware middleware ships a documented example in its JSDoc or README
- **THEN** the example's observable effect occurs on every adapter, or the example is corrected to
  match the actual behaviour

#### Scenario: Post-handler header writes are pinned by conformance

- **WHEN** the conformance suite runs a middleware that sets a response header after `await next()`
- **THEN** the scenario is executed against every adapter, and the current divergence between adapters
  is recorded rather than left undetected

### Requirement: Post-handler writes and timeout completion are parity-pinned across adapters

Observable parity across adapters SHALL extend to the middleware surface that runs after the
handler: a post-handler response-header write MUST produce the same observable outcome on every
adapter, and a handler that commits a response and then outlives the configured timeout MUST deliver
that committed response on every adapter. A divergence in either MUST fail the cross-adapter
conformance suite rather than being treated as an adapter-specific detail.

#### Scenario: A post-handler header write behaves identically everywhere

- **WHEN** the conformance suite runs a middleware that writes a response header after `await next()`
  against every shipped adapter
- **THEN** every adapter completes the full middleware chain and reports the same header outcome

#### Scenario: A committed response outlives the timeout on every adapter

- **WHEN** a handler commits a response and then continues working past the configured timeout on
  every shipped adapter
- **THEN** every adapter delivers the committed response and none substitutes a `504`

#### Scenario: A divergence fails the suite

- **WHEN** any adapter's post-handler write outcome or timeout-completion outcome differs from the
  others
- **THEN** the cross-adapter conformance suite fails and the adapter is not considered shipped

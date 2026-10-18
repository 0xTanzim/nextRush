# Spec Delta

## ADDED Requirements

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

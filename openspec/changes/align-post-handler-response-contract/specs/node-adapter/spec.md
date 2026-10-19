# Spec Delta — node-adapter

## ADDED Requirements

### Requirement: A response-header write after the response is committed is a no-op, not a chain-aborting throw

When `ctx.set()` is called after the response has been committed (`ctx.responded` is true or the
underlying `ServerResponse.headersSent` is true), the Node adapter SHALL NOT throw a platform error
and MUST NOT reject the middleware chain. The write SHALL be discarded, and the situation SHALL be
reported once per process. Every middleware that runs after the handler MUST still complete its
post-`next()` work.

#### Scenario: A post-handler header write does not abort the chain

- **WHEN** an inner middleware calls `ctx.set()` after `await next()` and the handler committed the
  response, and an outer middleware also performs work after `await next()`
- **THEN** the outer middleware's post-`next()` work runs to completion, the request is answered
  with the handler's response, and no error propagates

#### Scenario: The discarded write is reported once, not silently dropped

- **WHEN** a post-handler header write is discarded
- **THEN** a single warning per process identifies the field name and the committed-response cause,
  so the condition is observable without a per-request log storm

#### Scenario: A pre-commit write is unaffected

- **WHEN** `ctx.set()` is called before the response is committed
- **THEN** the header is present on the response, unchanged from the current behavior

#### Scenario: The header-validation guard is unaffected

- **WHEN** `ctx.set()` is called with an invalid field name or a value containing control
  characters, before or after commit
- **THEN** a typed header-validation error is thrown before commit, and the post-commit path does
  not weaken that guard

#### Scenario: Behavior is identical across adapters

- **WHEN** the cross-adapter conformance suite runs the post-handler header-write scenario on Node,
  Bun, Deno, Edge and serverless
- **THEN** every adapter completes the full middleware chain with the same observable outcome

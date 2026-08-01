# serverless-adapter

## Purpose

The `@nextrush/adapter-serverless` behaviors — a tiered public API (Tier 1: per-provider one-liner
handlers that hide all internals; Tier 2: an options object for tuning; Tier 3:
`createServerlessAdapter` + `EventMapper`, marked runtime-authors-only) over the execution model
(per-invocation, stateless, timeout→504, warm-instance container reuse) and a generic,
adapter-scoped `EventMapper<Event, Result, Ctx>` registry (immutable per-adapter list, no
globals), plus committed full-chain platform integration fixtures.

## Requirements

### Requirement: Tiered public API — per-provider handlers hide internals
The serverless adapter SHALL expose a tiered public API so ordinary users never encounter internal architecture (`EventMapper`, registry, provider selection). *Internal complexity MUST NOT become user complexity.*

- **Tier 1 (primary surface):** per-provider one-liner handlers — `createLambdaHandler(app)`, `createGoogleHandler(app)`, `createAzureHandler(app)` — that auto-configure the correct mapper(s) with zero configuration. (Cloudflare's Tier-1 handler already ships in `@nextrush/adapter-edge`.)
- **Tier 2:** the same handlers accept an options object (`{ timeout?, streaming? }`) for tuning — no architecture exposed.
- **Tier 3 (runtime authors only):** `createServerlessAdapter({ mappers })` and the `EventMapper` interface remain exported but MUST be marked `@advanced` / "Runtime authors only" in JSDoc and docs.

Tier-1 handlers MUST run the same `Context` pipeline and execution model (timeout→504, warm `ready()` reuse) as Tier 3.

#### Scenario: Zero-config Lambda handler
- **WHEN** a user writes `export const handler = createLambdaHandler(app)` with no options
- **THEN** it serves both Lambda Function URL and API Gateway events without the user naming a mapper or a provider

#### Scenario: Internals not required for normal use
- **WHEN** a normal application developer deploys to Lambda / Google / Azure
- **THEN** they can do so using only `createXHandler(app)`, never importing or referencing `EventMapper` or `createServerlessAdapter`

#### Scenario: Advanced tier remains available for runtime authors
- **WHEN** a runtime author needs an unsupported platform (e.g. Oracle, Fly.io)
- **THEN** `createServerlessAdapter({ mappers: [customMapper] })` is available and documented as runtime-authors-only

### Requirement: Generic, adapter-scoped EventMapper registry
The adapter SHALL separate the execution model (owned by the adapter) from the provider event format (owned by an `EventMapper`). The `EventMapper` type MUST be generic over the platform event, the platform result, and an optional context: `EventMapper<Event, Result, Ctx = unknown>` with `toRequest(event, ctx): Request` and `fromResponse(response, event): Result | Promise<Result>`, and an optional `detect(event): boolean`. Mappers MUST be supplied as an **immutable per-adapter list** at construction (`createServerlessAdapter({ mappers })`); the framework MUST NOT expose a global mutable mapper registry. Built-in mappers SHALL be provided for `apigw-v1`, `apigw-v2`, `lambda-function-url`, `gcf`, and `azure`. A new provider MUST be addable by supplying its `EventMapper` WITHOUT modifying the adapter, and the adapter MUST NOT contain a provider `switch`. Selection MUST be explicit-first: a named `provider`/mapper wins, and `detect()` runs only when no provider is specified. Mapping MUST correctly handle base64-encoded bodies, binary vs text payloads, multi-value headers, and query-string encoding.

#### Scenario: Third-party provider added without touching the adapter
- **WHEN** a developer supplies a custom `EventMapper` (e.g. for Oracle or Fly.io) in the `mappers` list passed to `createServerlessAdapter`
- **THEN** the handler serves that platform's events with no change to `@nextrush/adapter-serverless` source

#### Scenario: No global mutable registry
- **WHEN** two independently-constructed serverless adapters run in the same process with different `mappers`
- **THEN** each uses only its own mappers, and neither can overwrite or observe the other's mapper set

#### Scenario: Generic types flow to the mapper author
- **WHEN** an author implements `EventMapper<ApigwV2Event, ApigwV2Result>`
- **THEN** `toRequest` receives a typed `ApigwV2Event` and `fromResponse` must return a typed `ApigwV2Result`, with no `any` at the boundary

#### Scenario: Explicit provider wins over detection
- **WHEN** an explicit `provider` is configured AND an event would also match another mapper's `detect()`
- **THEN** the explicitly-configured mapper is used and `detect()` is not consulted

#### Scenario: Detection is the fallback when no provider is set
- **WHEN** no explicit provider is configured
- **THEN** the adapter selects the first mapper whose `detect(event)` returns true

#### Scenario: APIGW v2 event round-trips
- **WHEN** an API Gateway v2 event with a JSON body and query string is passed to the handler
- **THEN** the `apigw-v2` mapper produces a `Request` with the correct method, URL, headers, and body, and the resulting `Response` is mapped to a valid APIGW v2 result (statusCode, headers, body, isBase64Encoded)

#### Scenario: Base64 binary body is decoded and re-encoded
- **WHEN** an event carries a base64-encoded binary body
- **THEN** the `Request` body is the decoded bytes, and a binary `Response` body is returned base64-encoded with `isBase64Encoded: true`

#### Scenario: Multi-value headers are preserved
- **WHEN** an event carries multi-value headers
- **THEN** the mapped `Request` and the mapped result preserve all header values without loss

#### Scenario: Built-in mappers stay tree-shakeable
- **WHEN** an app includes only the `apigw-v2` mapper in its `mappers` list
- **THEN** the bundled output does not include the `azure`, `gcf`, or other unused mapper code

### Requirement: Response streaming for Lambda Function URL
For the `lambda-function-url` provider, the adapter SHALL support streamed responses when the handler produces a `ReadableStream`, rather than buffering the full body.

#### Scenario: Streamed response is not buffered
- **WHEN** a handler returns a `ReadableStream` under the `lambda-function-url` provider
- **THEN** the adapter streams the body to the platform response stream instead of collecting it into memory

### Requirement: Per-invocation timeout
The adapter SHALL support an optional per-invocation `timeout` that races the handler and returns HTTP 504 before the platform kills the invocation, aborting `ctx.signal`.

#### Scenario: Slow handler times out with 504
- **WHEN** a handler exceeds the configured per-invocation `timeout`
- **THEN** the adapter returns a 504 response and `ctx.signal` is aborted

### Requirement: Stateless execution and warm-instance reuse
Each invocation SHALL be stateless — `Context` and request-scoped services are per invocation and discarded. Application state built at `ready()` MUST be safely reusable across warm invocations, and `ready()` MUST run at most once per warm instance even under concurrent first invocations.

#### Scenario: No cross-invocation request state leaks
- **WHEN** two invocations run on the same warm instance
- **THEN** neither observes the other's `ctx.state`, params, or request-scoped instances

#### Scenario: ready() runs once per warm instance
- **WHEN** multiple concurrent invocations race the first request on a cold instance using the documented `app ??= build()` pattern
- **THEN** `ready()` executes exactly once and all invocations share the one booted application

### Requirement: End-to-end platform integration fixtures
Each built-in provider SHALL ship committed golden fixtures that exercise the full chain — `Platform Event → EventMapper.toRequest → app.callback() → Response → EventMapper.fromResponse → Platform Result` — not merely an isolated `Request`→`Response` unit. Fixtures MUST live at `fixtures/<provider>/event.json` + `fixtures/<provider>/expected-result.json` and MUST run in CI.

#### Scenario: Full-chain fixture passes in CI
- **WHEN** CI runs a provider's golden fixture: its `event.json` is fed through the mapper, a real application, and back through the mapper
- **THEN** the produced platform result equals the committed `expected-result.json`

#### Scenario: A platform event-shape change is caught by a fixture diff
- **WHEN** a mapper is changed such that it no longer produces the expected result for a committed event
- **THEN** the fixture test fails, surfacing the exact mapping difference

### Requirement: Conformance parity for the serverless adapter
The serverless adapter SHALL pass the cross-adapter conformance suite, proving observational parity with the Node, Bun, Deno, and Edge adapters for the shared `Context` contract.

#### Scenario: Serverless adapter joins the parity matrix
- **WHEN** the conformance suite runs
- **THEN** the serverless adapter produces responses identical to the other adapters for the shared contract, and the suite passes

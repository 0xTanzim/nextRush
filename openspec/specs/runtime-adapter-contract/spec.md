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

### Requirement: Observable parity across adapters
For the shared `Context` contract, all adapters SHALL be observationally identical. The cross-adapter conformance suite MUST pass for every shipped adapter. Where an adapter reports the `http2` capability, observable parity MUST additionally hold across HTTP/1.1, HTTPS/1.1, and negotiated HTTP/2 for that adapter — routing, middleware execution, streaming, request-body handling, and error handling MUST produce byte-identical responses regardless of which transport a given request negotiated.

#### Scenario: Retrofit preserves behavior
- **WHEN** an existing adapter is retrofitted to the typed contract
- **THEN** the conformance suite produces byte-identical responses (status, headers, body) before and after the retrofit

#### Scenario: HTTP/2 parity holds where the capability is reported
- **WHEN** an adapter reports `RuntimeCapabilities.http2: true` and the conformance suite runs the same request over HTTP/1.1 and negotiated HTTP/2
- **THEN** status, headers, and body are byte-identical between the two transports

#### Scenario: An adapter without http2 is not required to prove HTTP/2 parity
- **WHEN** an adapter reports `RuntimeCapabilities.http2: false`
- **THEN** the conformance suite does not require HTTP/2 scenarios for that adapter, consistent with `runtime-capability-negotiation`'s graceful-degradation requirement

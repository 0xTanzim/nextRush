# Spec Delta

## ADDED Requirements

### Requirement: The request deadline is served by one shared timer

The Web adapters' request deadline SHALL be served by a single timer per runner that serves every
pending deadline, rather than by a timer armed per request. The shared timer SHALL NOT be cancelled
when a request settles, and SHALL wake on a bounded window so that a runner with no pending deadline
holds no timer. A deadline SHALL be honoured at its deadline.

#### Scenario: A stuck handler still answers 504 and cancels the request

- **WHEN** a handler does not settle within the configured timeout
- **THEN** the response is `504 Gateway Timeout` and `ctx.signal` has fired

#### Scenario: A committed response still outlives the timeout

- **WHEN** a handler commits a response and then keeps running past the deadline
- **THEN** the committed response is the one the client receives

#### Scenario: Many pending deadlines share one timer

- **WHEN** several requests are pending at the same time
- **THEN** the runner holds one timer for them, not one timer per request

#### Scenario: A settled request releases its deadline

- **WHEN** a request settles before its deadline
- **THEN** its deadline is removed and the callback never runs

#### Scenario: A settled request does not disturb the shared timer

- **WHEN** a request settles while other requests are still pending
- **THEN** the shared timer is not cancelled and re-armed, so the remaining deadlines are unaffected

#### Scenario: The timeout behaviour is unchanged by the shared timer

- **WHEN** the shared deadline serves a request that times out
- **THEN** the response, the cancellation, and the observation of a late rejection are the same as
  when the deadline had its own timer

### Requirement: The shared deadline is validated by measurement and parity gates

The shared deadline SHALL be accepted only on measured evidence — a CPU-pinned paired A/B per
runtime, reporting the paired delta — and the timeout contract SHALL be verified by the
cross-adapter conformance suite on every supported runtime.

#### Scenario: The per-runtime effect is measured

- **WHEN** the shared deadline is evaluated
- **THEN** its before and after server CPU per request are captured per runtime with the same
  pinned protocol, and the paired delta is reported with the number of pairs that moved

#### Scenario: The cost of the race is measured without the change

- **WHEN** the cost of the per-request timer is attributed
- **THEN** the same bundle is measured with the race disabled and with the default timeout, so the
  difference is the race's cost rather than a difference between two builds

#### Scenario: The timeout contract holds on every runtime

- **WHEN** the change ships
- **THEN** the timeout scenarios pass on Node, Bun, Deno, Edge, and serverless, and the real-runtime
  runners on Bun, Deno, and `workerd` pass

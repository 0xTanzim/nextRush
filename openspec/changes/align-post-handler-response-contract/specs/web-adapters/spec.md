# Spec Delta — web-adapters

## MODIFIED Requirements

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

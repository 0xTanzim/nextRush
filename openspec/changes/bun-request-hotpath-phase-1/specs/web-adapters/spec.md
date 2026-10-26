# Spec Delta

## ADDED Requirements

### Requirement: A Web body source exposes a limited UTF-8 text read

The Web body source SHALL expose an internal limited UTF-8 text read. It SHALL use
`Request.text()` only when the configured encoding is UTF-8 and a `Content-Length` is present at or
below the effective limit. It SHALL enforce the limit against actual UTF-8 bytes. All other cases
SHALL use `buffer(limit)`.

#### Scenario: An eligible Web request uses the native text read

- **WHEN** a Web body source is UTF-8, has a `Content-Length` at or below the limit, and the caller
  requests text
- **THEN** the body is read through `Request.text()` and the returned string equals the string the
  buffer path would decode for the same valid UTF-8 body

#### Scenario: Ineligible requests keep the buffer path

- **WHEN** the body has no `Content-Length`, is chunked, is over the declared limit, or uses a
  non-UTF-8 encoding
- **THEN** the existing `buffer(limit)` path is used and its incremental limit enforcement is
  unchanged

#### Scenario: Actual bytes over the limit are rejected

- **WHEN** a text read returns a string whose actual UTF-8 bytes exceed the effective limit
- **THEN** the source rejects it with `BodyTooLargeError` and does not cache it as an accepted body

### Requirement: The limited text read preserves BodySource semantics

The limited text read SHALL preserve the public `BodySource` contract, including `text()`,
`buffer(limit?)`, `json()`, `stream()`, consumed state, and cache behavior. A source without the
capability, including the Node body source, SHALL keep its existing read path.

#### Scenario: Cache order remains compatible

- **WHEN** `text()` is followed by `buffer()`, or `buffer()` is followed by `text()`
- **THEN** the second read uses the cached representation without a second platform read, and a
  valid UTF-8 body round-trips to identical text

#### Scenario: The public BodySource shape is unchanged

- **WHEN** the public `BodySource` type and the Node body source are inspected
- **THEN** no limited text method is added to the public interface, and Node's behavior is unchanged

#### Scenario: A source without the capability falls back

- **WHEN** a body source does not expose the limited text capability
- **THEN** body-parser uses its existing `buffer(limit)` path and error mapping

## MODIFIED Requirements

### Requirement: The handler timeout is armed only when the handler has not already settled

The Web adapters SHALL arm the handler timeout only when the handler has not already committed a
response synchronously, matching the Node adapter's fast path. A handler that settles without
committing MAY arm a timer, but its promise SHALL win the direct race and the timer SHALL be
cleared; no 504 SHALL be produced. A committed response SHALL be delivered. The timeout interval,
504 body, signal, and warning text SHALL be unchanged.

#### Scenario: A synchronous handler arms no timer

- **WHEN** a handler writes its response before returning
- **THEN** no timer is scheduled for that request and no timeout racing is performed

#### Scenario: A slow handler still times out with the same response

- **WHEN** a handler does not settle within the configured timeout
- **THEN** the client receives the same 504 body as before, the cancellation signal is aborted, and
  the same warning is emitted

#### Scenario: A settled handler with no committed response does not time out

- **WHEN** a handler settles without committing a response and its promise wins the timeout race
- **THEN** no 504 is produced, the timer is cleared, and the runner proceeds with its normal
  finalization

#### Scenario: Timer behaviour is identical across adapters

- **WHEN** the conformance and adapter test suites run the timeout scenarios
- **THEN** Node, Bun, Deno, Edge and serverless produce the same observable outcome

#### Scenario: A committed response is not replaced by the 504

- **WHEN** a handler commits a response and then continues working past the configured timeout
- **THEN** the client receives the handler's committed response rather than a 504, and the observable
  outcome matches the Node adapter for the same handler

# Spec Delta

## ADDED Requirements

### Requirement: The Next.js App Router bridge is proven over a real server

The proof suite SHALL exercise the Next.js adapter through a production `next build` followed by a
real `next start` server, issuing HTTP requests over that server. In-process construction of a
`Request` and a successful build alone MUST NOT be reported as proof of the App Router integration.

#### Scenario: The fixture runs on a real Next.js server

- **WHEN** the Next.js 16 proof runs
- **THEN** it builds the fixture, starts the production server, and reaches it over HTTP before
  asserting anything

#### Scenario: JSON CRUD is asserted over HTTP

- **WHEN** the proof issues GET, POST, PUT, PATCH, and DELETE requests with JSON payloads
- **THEN** each response's status, headers, and body are asserted against the documented contract,
  including dynamic route parameters and 404s for unknown identifiers

#### Scenario: Client errors are predictable

- **WHEN** a request carries malformed JSON, a missing or invalid field, or an unsupported method
- **THEN** the server answers a deterministic client-error status and body rather than a 500 or a
  silently modified success

#### Scenario: State persists across sequential requests in one process

- **WHEN** the proof creates, updates, and deletes a record through the running server
- **THEN** later requests in the same server process observe exactly the state the earlier requests
  established

#### Scenario: In-process results are not presented as real-server proof

- **WHEN** the Next.js proof or certification output is summarized
- **THEN** in-process driver results and real-server results are reported separately, and a
  build-only fixture is not reported as integration proof

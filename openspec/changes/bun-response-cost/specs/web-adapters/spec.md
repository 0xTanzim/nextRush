## ADDED Requirements

### Requirement: The outgoing response header record is materialised only when needed

The Web response builder SHALL NOT allocate a header record for a response that carries only the
default headers. The record SHALL be materialised on the first write of a header outside that default
set, and once materialised SHALL be reused for the rest of the request. The built response MUST be
byte-identical to the current one: same status, same `Content-Type` string, same body bytes, same
accumulated `Set-Cookie`, same body suppression for HEAD, 204, and 304.

#### Scenario: A default-header response allocates no header record

- **WHEN** a handler returns a JSON body on a Web adapter and sets no header outside the default set
- **THEN** the response builder allocates no header record for that request and the response carries
  the same `Content-Type` it carries today

#### Scenario: A non-default header materialises the record once

- **WHEN** a handler sets `x-request-id` and then sets a second non-default header
- **THEN** the header record is materialised on the first write, both headers are present on the
  response, and the record is not reallocated on the second write

#### Scenario: Header output is byte-identical to today

- **WHEN** the same handler runs against the previous and the new builder
- **THEN** status, the set of header names, every header value, and the body bytes are identical,
  including a `Content-Type` set explicitly by the handler overriding the default

#### Scenario: Header ordering is not part of the contract

- **WHEN** the built response's header order differs from the previous builder's only in the
  position of the default `Content-Type`
- **THEN** the difference is accepted, because no consumer may rely on header order over HTTP/2

#### Scenario: Set-Cookie accumulation is unchanged

- **WHEN** a handler appends two cookies through `ctx.set('Set-Cookie', …)` in mixed casings
- **THEN** both cookies appear on the response as separate `set-cookie` values, as today

#### Scenario: Body suppression is unchanged

- **WHEN** the request method is HEAD, or the status is 204 or 304
- **THEN** the response has no body, exactly as today, and the header behaviour is unchanged

#### Scenario: The record is not shared between requests

- **WHEN** two requests are handled concurrently on the same adapter
- **THEN** a header set by one request does not appear on the other's response

### Requirement: The response-construction trim is adopted only on a measured improvement

The lazy header record SHALL be adopted only when a spike, run on Bun and Node with the real header
shapes, shows it is cheaper than the current construction, and only when the Bun
`inproc.nextrush.vs_hono` ratio improves beyond this machine's run-to-run spread. A null or negative
result MUST be recorded and the change parked rather than merged. The spike MUST also compare the
platform's JSON fast path with a pre-serialized body before any switch between them is considered.

#### Scenario: The spike decides before implementation

- **WHEN** the spike has not yet produced a verdict
- **THEN** no change to the response builder is merged

#### Scenario: A measured win is the only adoption path

- **WHEN** the spike shows the lazy record is not cheaper, or the Bun ratio does not move beyond the
  measured spread
- **THEN** the outcome is recorded in the change and in the owning RFC, and the response builder is
  left as it is

#### Scenario: Adoption keeps the gates green

- **WHEN** the trim is adopted
- **THEN** the conformance suite passes on every runtime, the adapter suites pass, and per-package
  line coverage does not decrease

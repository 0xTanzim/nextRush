# Spec Delta

## ADDED Requirements

### Requirement: The framework's JSON responses carry one media type on every adapter

Every framework-generated JSON response — a handler's `ctx.json()`, an object passed to `ctx.send()`,
and the framework's own `404`/`500`/`504` error envelope — SHALL carry the media type
`application/json` on the Node, Bun, Deno, Edge, and serverless adapters alike. The value SHALL NOT
carry a `charset` parameter, because RFC 8259 §8.1 defines none for `application/json`.

#### Scenario: A handler's JSON response carries the shared media type

- **WHEN** a handler calls `ctx.json(data)` on any adapter
- **THEN** the response's `Content-Type` is `application/json`

#### Scenario: A framework error response carries the shared media type

- **WHEN** the framework answers `404`, `500`, or `504` on any adapter
- **THEN** the response's `Content-Type` is `application/json`, produced through the one shared
  error-response construction path rather than a per-adapter literal

#### Scenario: The media type is identical across adapters

- **WHEN** the cross-adapter conformance suite runs on Node, Bun, Deno, Edge, and serverless
- **THEN** every adapter reports the same `content-type` value for the same JSON response

#### Scenario: An explicit content type still wins

- **WHEN** a middleware sets `Content-Type` explicitly before or after the body method
- **THEN** the explicit value is what the response carries, and the framework's JSON media type is
  not applied over it

### Requirement: The Web response is built from a plain init record when it carries only a content type

The Web response builder SHALL construct the outgoing `Response` from a plain init record — the body
and a single `content-type` header — when the recorded response carries no header beyond that
content type. When the recorded response carries any additional header, the builder SHALL fall back
to the general path that materialises a `Headers` instance, so that repeated fields such as
`Set-Cookie` keep every entry.

#### Scenario: A content-type-only response uses the plain init record

- **WHEN** a handler responds with a JSON body and sets no other header
- **THEN** the response is constructed from a plain init record carrying exactly one `content-type`
  header, and no `Headers` instance is allocated for that response

#### Scenario: A response with extra headers keeps the general path

- **WHEN** a handler responds and sets any header other than the content type
- **THEN** the response is constructed through the `Headers` path, and every accumulated entry is
  present on the response

#### Scenario: Repeated Set-Cookie entries are preserved

- **WHEN** a handler sets two `Set-Cookie` headers and responds with a JSON body
- **THEN** the response carries both cookie values as separate headers, not one joined value

### Requirement: The JSON media type and the plain init record are validated by measurement and parity gates

The JSON media type and the plain init record SHALL be accepted only on measured evidence — a
CPU-pinned paired A/B per runtime, reporting the paired delta rather than a difference of medians —
and SHALL be verified by the cross-adapter conformance suite on every supported runtime. A change
whose measured effect is inside the run-to-run spread SHALL be parked and reverted in the same
change.

#### Scenario: The per-runtime effect is measured before the change is kept

- **WHEN** the JSON media type or the plain init record is evaluated
- **THEN** its before and after server CPU per request are captured per runtime with the same
  pinned protocol, and the paired delta is reported with the number of pairs that moved in the
  claimed direction

#### Scenario: The construction choice is verified in isolation

- **WHEN** the media type's effect is claimed
- **THEN** the `Response` construction shapes are measured directly, so the claim does not rest on
  an end-to-end delta that is inside the noise

#### Scenario: Every affected adapter is verified

- **WHEN** the change ships
- **THEN** the conformance suite passes on Node, Bun, Deno, Edge, and serverless, with the same
  observable media type on each

# Spec Delta

## ADDED Requirements

### Requirement: Client-error responses carry a truthful, non-disclosing error code

A client-error response body SHALL carry a truthful `code`. When the raised error carries a string
code, that code SHALL be used; otherwise the code SHALL be derived from the response status. A 5xx
response SHALL keep reporting the framework's internal error code with a masked message, and the code
of an internal failure SHALL never be exposed to a client.

#### Scenario: A parser error keeps its own code

- **WHEN** a request body fails to parse and the parser raises an error carrying the code
  `INVALID_JSON`
- **THEN** the response body's `code` is `INVALID_JSON` and not `INTERNAL_ERROR`

#### Scenario: A client error without a code derives one from the status

- **WHEN** an error with a 404 status and no string code reaches the default handler
- **THEN** the response body's `code` is the code for that status, not `INTERNAL_ERROR`

#### Scenario: Other client-error codes are preserved

- **WHEN** a request is rejected for an oversized entity or an unsupported content type
- **THEN** the response body's `code` is `ENTITY_TOO_LARGE` or `UNSUPPORTED_CONTENT_TYPE`
  respectively

#### Scenario: A 5xx body is unchanged

- **WHEN** an internal failure occurs, including one whose error object carries a string code
- **THEN** the response body's `code` remains the framework's internal error code and its message
  remains masked, byte-identical to today

#### Scenario: One contract serves every surface

- **WHEN** the default error handler and the framework's error middleware produce a body for the same
  error
- **THEN** the derived code agrees, so there is a single client-visible error contract

#### Scenario: The code is identical across adapters

- **WHEN** the conformance suite triggers the same client error on every adapter
- **THEN** every adapter responds with the same body, code included

# Spec Delta

## ADDED Requirements

### Requirement: An eligible JSON body is read once as limited UTF-8 text

When `json()` or `bodyParser()` parses a JSON request and neither `rawBody` nor `verify` requires
bytes, body-parser SHALL use the body source's limited UTF-8 text capability when available. When
the capability is absent, the encoding is not UTF-8, or the body length is not provable, it SHALL
use `buffer(limit)`. Both paths SHALL produce the same `ctx.body`.

#### Scenario: An eligible JSON body uses one limited text read

- **WHEN** a UTF-8 JSON request with a `Content-Length` at or below the configured limit is parsed
  without `rawBody` or `verify`
- **THEN** the body is read through the limited text capability, and `ctx.body` equals the value
  the buffer path produces for the same request

#### Scenario: rawBody and verify keep the original bytes

- **WHEN** `json({ rawBody: true })` or `json({ verify })` is configured
- **THEN** the request uses the buffer path, `ctx.rawBody` and `verify` receive the original bytes,
  and the text path is not used

#### Scenario: Unprovable or non-UTF-8 bodies fall back to the buffer path

- **WHEN** the request has no `Content-Length`, a chunked body, or a non-UTF-8 configured encoding
- **THEN** body-parser uses `buffer(limit)` and the existing incremental reader, and the configured
  limit is still enforced during the read

### Requirement: The JSON text path enforces actual bytes and preserves parse semantics

The JSON text path SHALL enforce the configured `limit` against the actual UTF-8 byte length, not
`text.length` alone, and SHALL reject an over-limit body with `ENTITY_TOO_LARGE` before parsing.
Strict mode, `maxDepth`, parse errors, and `next()` ordering SHALL be identical to the buffer path.

#### Scenario: Actual UTF-8 bytes over the limit are rejected

- **WHEN** a text body's actual UTF-8 byte length exceeds the configured limit even though
  `text.length` is below it
- **THEN** the request is rejected with `ENTITY_TOO_LARGE` before parsing

#### Scenario: An understated Content-Length does not bypass the limit

- **WHEN** a request declares a `Content-Length` at or below the limit but the body's actual UTF-8
  bytes exceed it
- **THEN** the post-read byte check rejects the request with `ENTITY_TOO_LARGE`, and no parsed body
  is assigned

#### Scenario: Strict mode, depth, and parse errors are identical on both paths

- **WHEN** the same invalid JSON, strict-mode scalar, or over-depth payload is parsed through the
  text path and the buffer path
- **THEN** both paths produce the same error code, status, and client-safe message, and the depth
  guard never skips a payload that could reach `maxDepth`

#### Scenario: next() ordering is unchanged

- **WHEN** a JSON body is parsed successfully through the text path
- **THEN** `next()` is awaited once, after `ctx.body` is assigned, exactly as on the buffer path

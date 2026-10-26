# Spec Delta

## MODIFIED Requirements

### Requirement: `ctx.json()` writes headers with a single writeHead, merge-safe

`ctx.json()` SHALL record the status, `Content-Type`, and the serialized body, and SHALL set them on
the transport via a single `res.writeHead()` when the response is flushed after the middleware chain
unwinds, producing byte-identical output, preserving headers set earlier via `ctx.set()` (including
accumulated `Set-Cookie`), and keeping the HEAD/204/304 body suppression and the double-send guard.
`Content-Length` SHALL be derived from the serialized body at flush time.

Serialization SHALL be completed before the response is treated as committed: `ctx.json()` MUST NOT
mark the response responded or record a body until it holds a serialized string. A value that cannot
be serialized (a `BigInt`, a circular structure, a function or a `Symbol`) SHALL throw a `TypeError`
naming the value class, and SHALL leave the response uncommitted so the application error handler can
still answer. A value that serializes to `undefined` SHALL be rejected the same way instead of
producing an empty body.

The recorded JSON media type SHALL be `application/json` — RFC 8259 §8.1 defines no `charset`
parameter for it — and SHALL be the same value on every adapter.

#### Scenario: A JSON response is byte-identical

- **WHEN** `ctx.json(data)` is called
- **THEN** the status, `Content-Type: application/json`, `Content-Length`, and body bytes are identical to today

#### Scenario: Headers set before json() survive the writeHead

- **WHEN** a middleware calls `ctx.set('X-Custom', 'v')` (and/or accumulates `Set-Cookie`) and then a handler calls `ctx.json(data)`
- **THEN** `X-Custom` and every accumulated `Set-Cookie` are present on the response alongside the JSON headers (the flush merges them)

#### Scenario: Body suppression is preserved

- **WHEN** `ctx.json()` is called for a HEAD request or with status 204/304
- **THEN** no body is written, matching today

#### Scenario: The double-send guard holds

- **WHEN** `ctx.json()` is called after the response was already committed (`responded`/`headersSent`)
- **THEN** it is a no-op (no second write, no throw), identical to today

#### Scenario: A serialization failure leaves the response uncommitted

- **WHEN** `ctx.json(value)` is called with a value `JSON.stringify` cannot serialize
- **THEN** a `TypeError` is thrown, no header or body byte is written, and the response is still
  reported as not responded

#### Scenario: A failing handler still produces a completed response

- **WHEN** a handler calls `ctx.json(value)` with a non-serializable value and the application error
  handler then calls `ctx.json({ error, message, code, status })`
- **THEN** the second call writes a complete response with status 500, and the client receives it
  rather than waiting for a socket timeout

#### Scenario: Serializing to undefined is rejected, not answered empty

- **WHEN** `ctx.json(undefined)` is called
- **THEN** a `TypeError` is thrown and the response is not committed with an empty body

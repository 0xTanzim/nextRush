## MODIFIED Requirements

### Requirement: A response-header write after the response headers are sent is a no-op, not a chain-aborting throw

When `ctx.set()` is called after the recorded response has been flushed to the transport, the Node
adapter SHALL NOT throw a platform error and MUST NOT reject the middleware chain: the write is
discarded and reported once per process. A header write that arrives after the handler committed the
record but before the adapter flushed it SHALL land on the response. Every middleware that runs after
the handler MUST still complete its post-`next()` work.

#### Scenario: A post-handler header write does not abort the chain

- **WHEN** an inner middleware calls `ctx.set()` after `await next()` and the handler committed the
  response, and an outer middleware also performs work after `await next()`
- **THEN** the header is present on the response, the outer middleware's post-`next()` work runs to
  completion, and no error propagates

#### Scenario: The discarded write is reported once, not silently dropped

- **WHEN** a header write arrives after the adapter flushed the response
- **THEN** a single warning per process identifies the field name and the flushed-response cause, so
  the condition is observable without a per-request log storm

#### Scenario: A write made while writeHead runs still lands

- **WHEN** a listener that Node invokes inside `writeHead` calls `ctx.set()` — the position the
  compat surface's `on-headers` bridge writes from
- **THEN** the header is present on the response, because the record is still mutable at that point

#### Scenario: A pre-commit write is unaffected

- **WHEN** `ctx.set()` is called before the handler commits the response
- **THEN** the header is present on the response, unchanged from the current behavior

#### Scenario: The header-validation guard is unaffected

- **WHEN** `ctx.set()` is called with an invalid field name or a value containing control
  characters, before or after the flush
- **THEN** a typed header-validation error is thrown before the flush, and the post-flush path does
  not weaken that guard

#### Scenario: Behavior is identical across adapters

- **WHEN** the cross-adapter conformance suite runs the post-handler header-write scenario on Node,
  Bun, Deno, Edge and serverless
- **THEN** every adapter completes the full middleware chain with the same observable outcome

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

#### Scenario: A JSON response is byte-identical

- **WHEN** `ctx.json(data)` is called
- **THEN** the status, `Content-Type: application/json; charset=utf-8`, `Content-Length`, and body bytes are identical to today

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

## ADDED Requirements

### Requirement: The flush happens once, after the middleware chain unwinds

The Node adapter SHALL flush the recorded outgoing response exactly once, after the composed
middleware chain settles, and SHALL NOT write headers or a body from inside a response method. A
streamed response is the sole exception and commits at the point the stream is wired.

#### Scenario: A response method writes no bytes

- **WHEN** a handler calls `ctx.json()`, `ctx.send()`, `ctx.html()` or `ctx.redirect()`
- **THEN** no header or body byte reaches the socket until the middleware chain has settled

#### Scenario: Post-handler middleware still influences the response

- **WHEN** a middleware writes a header or replaces the body after `await next()`
- **THEN** the flushed response carries that write

#### Scenario: The flush is not repeated

- **WHEN** the chain settles and the adapter flushes
- **THEN** exactly one flush occurs for the request, and a second flush attempt is a no-op

#### Scenario: A started stream commits immediately

- **WHEN** a handler wires a stream through `sendStream`, SSE or NDJSON
- **THEN** the response commits at that point and is never buffered or re-flushed

### Requirement: A body rewrite after the chain updates the length and the bytes together

When a post-handler middleware replaces the recorded body, the Node adapter SHALL flush the new bytes
and a `Content-Length` derived from them, so the response cannot declare a length that disagrees with
its body.

#### Scenario: A compressed body carries its own length

- **WHEN** a compression middleware replaces the recorded body after the handler
- **THEN** the flushed `Content-Length` equals the compressed byte length and `Content-Encoding` names
  the encoding applied

#### Scenario: A stale length is never flushed

- **WHEN** a middleware replaces the body without touching `Content-Length`
- **THEN** the adapter recomputes it from the final body rather than sending the previous value

#### Scenario: A bodyless status stays bodyless

- **WHEN** the recorded status is 204 or 304, or the request method is HEAD
- **THEN** no body is flushed and the header behaviour is unchanged

### Requirement: The Node adapter copies a response body only when a post-handler rewrite is possible

The Node adapter SHALL write the recorded body to the transport without an intermediate copy when no
post-handler middleware can rewrite it, and SHALL expose a per-request counter reporting how many
body copies the flush path performed, so the buffer cost is measurable rather than assumed.

#### Scenario: A response no middleware rewrites is not copied

- **WHEN** a request is handled by a chain with no middleware that runs after the handler
- **THEN** the recorded body is written without an intermediate copy and the counter reports zero

#### Scenario: The copy count is observable

- **WHEN** the response is flushed
- **THEN** the counter reports the number of body copies performed for that request

#### Scenario: Both paths produce identical bytes

- **WHEN** the same handler runs on a chain with and without a post-handler middleware
- **THEN** the status, headers and body bytes delivered to the client are identical

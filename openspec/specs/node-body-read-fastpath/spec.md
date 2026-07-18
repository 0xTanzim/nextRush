# node-body-read-fastpath Specification

## Purpose
TBD - created by archiving change node-body-read-fastpath. Update Purpose after archive.
## Requirements
### Requirement: `NodeBodySource.buffer()` reads via event listeners with byte-identical results

`NodeBodySource.buffer()` SHALL accumulate the request body via `req.on('data')` / `req.on('end')`
(rejecting on `req.on('error')`) rather than `for await…of`, producing a buffer byte-identical to
today for the same request, and `text()` / `json()` (which call it) SHALL behave identically.

#### Scenario: A normal body is buffered correctly
- **WHEN** a request with a body is read via `buffer()`
- **THEN** the returned bytes equal the full request body, identical to the previous reader

#### Scenario: An empty body yields an empty buffer
- **WHEN** a request with no body is read via `buffer()`
- **THEN** it resolves to an empty buffer (no hang, no error)

#### Scenario: All chunk types are handled
- **WHEN** the stream emits `Buffer`, `string`, `Uint8Array`, or `ArrayBuffer` chunks
- **THEN** each is converted via `chunkToBuffer` and concatenated to the same result as today

#### Scenario: text() and json() are unaffected
- **WHEN** `text()` or `json()` is called (both delegate to `buffer()`)
- **THEN** the decoded string / parsed value is identical to today, and invalid JSON still throws `BadRequestError`

### Requirement: Body size limits are preserved exactly

The content-length pre-check and the streaming size check SHALL behave exactly as today, throwing
`BodyTooLargeError(limit, size)` and destroying the stream on a mid-stream breach.

#### Scenario: A content-length over the limit throws before reading
- **WHEN** `content-length` exceeds the configured limit
- **THEN** `buffer()` throws `BodyTooLargeError` before any body bytes are consumed

#### Scenario: A streamed body over the limit is rejected mid-stream
- **WHEN** a body without an accurate `content-length` exceeds the limit while streaming
- **THEN** the running-total check triggers `this.req.destroy()` and the read rejects with `BodyTooLargeError(limit, totalRead)`

### Requirement: Consumed and cache semantics are preserved

A second read SHALL throw `BodyConsumedError`, and a re-read after a successful read SHALL return
the cached buffer without re-attaching listeners.

#### Scenario: A second read throws BodyConsumedError
- **WHEN** `buffer()` (or `text()`/`json()`) is called after the body was already consumed
- **THEN** it throws `BodyConsumedError`

#### Scenario: A re-read after success returns the cached buffer
- **WHEN** `buffer()` is called again after a successful read
- **THEN** it returns the cached buffer and does not re-attach stream listeners

### Requirement: Stream-lifecycle edge cases are handled without hangs or double-settles

The event-listener form SHALL handle the cases the async iterator handled implicitly: an
already-ended stream, a mid-body error/disconnect, single-settle, and listener cleanup.

#### Scenario: An already-ended stream resolves cleanly
- **WHEN** `buffer()` is called after the request stream has already ended
- **THEN** it resolves (empty result) rather than hanging on an `end` event that will never fire

#### Scenario: A stream error rejects the read
- **WHEN** the request stream emits an `error` during reading
- **THEN** `buffer()` rejects with that error

#### Scenario: A client disconnect mid-body rejects rather than hanging
- **WHEN** the client disconnects (premature close) before the body completes
- **THEN** the read rejects (the promise never stays pending)

#### Scenario: A limit breach settles exactly once
- **WHEN** a mid-stream limit breach occurs (destroy + reject) near the stream's end
- **THEN** the read settles exactly once — a single `BodyTooLargeError`, never a resolve-and-reject

#### Scenario: Listeners are removed on settle
- **WHEN** the read settles for any reason (end, error, or limit breach + destroy)
- **THEN** all attached `data`/`end`/`error`/`close` listeners are removed (no listener leak)

### Requirement: The stream() path is unchanged

`NodeBodySource.stream()` (the unbuffered `Transform` path) SHALL be unaffected by this change.

#### Scenario: stream() behavior is unchanged
- **WHEN** `stream()` is used to read the body
- **THEN** its behavior (size-enforcing `Transform`, `BodyConsumedError` on re-use) is identical to today

### Requirement: The rewrite is validated by a differential harness and the POST A/B

The new reader SHALL be confirmed identical to the pre-change reader across a payload corpus, and
gated on the POST-JSON benchmark and parity.

#### Scenario: Old-vs-new results match across a payload corpus
- **WHEN** a corpus (empty, small, large-but-under-limit, over-limit, multi-chunk, mixed chunk types) is read by both the pre-change and post-change `buffer()`
- **THEN** the results (bytes, and thrown error types) are identical for every input

#### Scenario: POST parity and no regression
- **WHEN** `pnpm bench:validate` and a `--profile full` A/B on the POST JSON scenario are run before/after
- **THEN** response bodies + Content-Type stay byte-identical and POST RPS does not regress beyond stddev

#### Scenario: Coverage is maintained and the rewritten read is covered
- **WHEN** the adapter-node test suite runs with coverage
- **THEN** per-package line coverage stays at or above 90% and the rewritten `buffer()` branches (limits, errors, already-ended, cache) are covered


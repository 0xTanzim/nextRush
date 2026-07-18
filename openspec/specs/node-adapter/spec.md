# node-adapter

## Purpose

The `@nextrush/adapter-node` request path and the per-request behavior of its `NodeContext`:
body reading (`NodeBodySource.buffer()`/`text()`/`json()` via event listeners, with size limits,
consumed/cache semantics, and stream-lifecycle safety), response emission (`ctx.json()` single
merge-safe `writeHead`, `ctx.set()` cookie detection), request shaping (`ctx.query`, `ctx.ip`
trust-proxy resolution, `ctx.next()` forwarding, lazily-built `ctx.raw`), and the shared
context-options object. Every behavior here is held byte-identical to its pre-optimization form and
kept in cross-adapter parity, validated by allocation micro-benchmarks, differential harnesses,
and coverage gates rather than accepted on aesthetics.

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

### Requirement: A query-less request uses a shared frozen empty query object

`NodeContext` SHALL assign a shared frozen empty object to `ctx.query` when the request has no
query string, rather than allocating a fresh object, while a request with a query string still gets
its parsed params. `ctx.query` remains read-only.

#### Scenario: A request with no query string gets the shared frozen empty object
- **WHEN** a request with no `?` is handled
- **THEN** `ctx.query` is the shared frozen empty query object (no fresh per-request object is allocated), and it is empty

#### Scenario: A request with a query string is parsed as today
- **WHEN** a request with a query string (`?a=1&b=2`) is handled
- **THEN** `ctx.query` equals the parsed params, identical to today

#### Scenario: ctx.query is read-only
- **WHEN** `ctx.query` is used
- **THEN** it is treated as read-only (the shared empty instance is frozen; a mutating pattern, if any existed, is not supported — and HP-2 falls back to a per-request object rather than changing that contract)

### Requirement: `ctx.json()` writes headers with a single writeHead, merge-safe

`ctx.json()` SHALL set the status, `Content-Type`, and `Content-Length` via a single
`res.writeHead()` for the non-suppressed case, producing byte-identical output, preserving headers
set earlier via `ctx.set()` (including accumulated `Set-Cookie`), and keeping the HEAD/204/304 body
suppression and the double-send guard.

#### Scenario: A JSON response is byte-identical
- **WHEN** `ctx.json(data)` is called
- **THEN** the status, `Content-Type: application/json; charset=utf-8`, `Content-Length`, and body bytes are identical to today

#### Scenario: Headers set before json() survive the writeHead
- **WHEN** a middleware calls `ctx.set('X-Custom', 'v')` (and/or accumulates `Set-Cookie`) and then a handler calls `ctx.json(data)`
- **THEN** `X-Custom` and every accumulated `Set-Cookie` are present on the response alongside the JSON headers (writeHead merges with prior `setHeader` values)

#### Scenario: Body suppression is preserved
- **WHEN** `ctx.json()` is called for a HEAD request or with status 204/304
- **THEN** no body is written, matching today

#### Scenario: The double-send guard holds
- **WHEN** `ctx.json()` is called after the response was already committed (`responded`/`headersSent`)
- **THEN** it is a no-op (no second write, no throw), identical to today

### Requirement: `ctx.set()` gates the set-cookie toLowerCase behind a cheap pre-check

`ctx.set()` SHALL detect `set-cookie` via a constant-time pre-check before falling back to
`field.toLowerCase()`, so non-cookie headers do not allocate a lowercased string, while
`Set-Cookie` is still detected case-insensitively and the CRLF safety guard still runs on every
call.

#### Scenario: Set-Cookie is detected across casings and accumulates
- **WHEN** `ctx.set('Set-Cookie', …)`, `ctx.set('set-cookie', …)`, or `ctx.set('SET-COOKIE', …)` is called (with a string value)
- **THEN** each is detected as a cookie and appended (accumulated), identical to today

#### Scenario: A non-cookie header skips the toLowerCase allocation
- **WHEN** `ctx.set('Content-Type', 'text/plain')` (or any non-cookie header) is called
- **THEN** the header is set correctly and no `toLowerCase()` string is allocated for cookie detection

#### Scenario: The CRLF safety guard still runs on every set
- **WHEN** `ctx.set()` is called with a field or value containing CR or LF
- **THEN** `assertHeaderSafe` still throws (the guard is unaffected by the pre-check)

### Requirement: `ctx.raw` is built lazily and identically

`NodeContext` SHALL allocate the `{ req, res }` wrapper only when `ctx.raw` is read, exposing it via
a memoized getter, and every internal response method MUST use the private `req`/`res` fields rather
than `ctx.raw`. `ctx.raw` SHALL return the same `{ req, res }` shape and identity as today.

#### Scenario: A request that never reads ctx.raw allocates no wrapper
- **WHEN** a request is handled by a handler that uses `ctx.json`/`ctx.send`/`ctx.body` but never reads `ctx.raw`
- **THEN** no `{ req, res }` wrapper object is allocated for that request

#### Scenario: ctx.raw returns the identical shape and is memoized
- **WHEN** `ctx.raw` is read (once or repeatedly)
- **THEN** it returns `{ req, res }` with the same `req`/`res` as the underlying request/response, and repeated reads return the same object (`ctx.raw === ctx.raw`)

#### Scenario: Response methods still behave identically
- **WHEN** `ctx.json` / `ctx.send` / `ctx.html` / `ctx.redirect` / streaming / `ctx.signal` / client-IP resolution run after the refactor
- **THEN** their observable behavior (status, headers, body, signal, `ctx.ip`) is byte-identical to today, using the private `req`/`res` fields

### Requirement: `ctx.ip` resolution avoids a per-request closure when proxies are not trusted

When `trustProxy` is false, `NodeContext` SHALL set `ctx.ip` directly from the socket address
without allocating a header-lookup closure or invoking the proxy-header resolution policy, and
SHALL produce the identical `ctx.ip` value it produces today. When `trustProxy` is true, it SHALL
resolve `ctx.ip` via the shared client-IP policy exactly as today. The resolved value SHALL remain
readable (never `undefined`) regardless of when `ctx.ip` is accessed.

#### Scenario: trustProxy false returns the socket address without a lookup closure
- **WHEN** a request is handled with `trustProxy` false
- **THEN** `ctx.ip` equals the socket remote address, and no per-request header-lookup closure is allocated for IP resolution

#### Scenario: trustProxy false ignores proxy headers (parity with today)
- **WHEN** `trustProxy` is false and the request carries `x-forwarded-for` / `x-real-ip` headers
- **THEN** `ctx.ip` still equals the socket remote address (the proxy headers are ignored), identical to today's behavior

#### Scenario: trustProxy true resolves via the shared policy
- **WHEN** `trustProxy` is true and a valid `x-forwarded-for` header is present
- **THEN** `ctx.ip` resolves to the policy result (first valid forwarded entry, etc.), identical to today

#### Scenario: A socket with no remote address yields an empty string
- **WHEN** the socket has no `remoteAddress`
- **THEN** `ctx.ip` is the empty string `''`, matching today's `?? ''` fallback

#### Scenario: The value is stable regardless of read timing
- **WHEN** `ctx.ip` is read at any point during (or after) request handling
- **THEN** it returns the address captured for that request and is never `undefined`

### Requirement: The context-options object is not allocated per request

`createHandler` SHALL construct the context-options object (carrying `trustProxy`) once and reuse
it across requests, rather than allocating a new object per request. The shared object SHALL NOT
be mutated or retained in a way that lets one request affect another.

#### Scenario: trustProxy is applied identically without per-request allocation
- **WHEN** many requests are handled by the same `createHandler` instance
- **THEN** every request observes the same `trustProxy` behavior, and the options object is not re-allocated per request

#### Scenario: The shared options object cannot corrupt request state
- **WHEN** requests are handled concurrently
- **THEN** each observes the same configured `trustProxy` value, with no cross-request interference from the shared object

### Requirement: `ctx.next()` forwards the dispatch thunk without an extra async frame

`NodeContext.next()` SHALL forward the wired dispatch thunk directly (returning its promise)
rather than wrapping it in an additional `async` frame, while preserving ordering, rejection
propagation, the no-op-when-unwired behavior, and the `Promise<void>` return contract.

#### Scenario: Awaiting next() preserves onion ordering
- **WHEN** a middleware calls `await ctx.next()` and downstream runs
- **THEN** control returns to the caller after downstream completes, exactly as before this change

#### Scenario: A rejection from the wired thunk propagates
- **WHEN** the wired downstream chain rejects and the middleware `await`s `ctx.next()`
- **THEN** the rejection propagates out of `ctx.next()` to the awaiting middleware

#### Scenario: next() with no wired thunk is a resolved no-op
- **WHEN** `ctx.next()` is called and no next thunk was wired (`_next` is unset)
- **THEN** it returns an already-resolved promise and does not throw

#### Scenario: next() always returns a promise
- **WHEN** `ctx.next()` is called in any state (wired or unwired)
- **THEN** it returns a `Promise<void>`

#### Scenario: next() advances the same chain the composer guards
- **WHEN** a middleware calls `ctx.next()` under the composed pipeline
- **THEN** it advances the same chain as the composer's `next` argument, so the composer's multiple-`next()` detection still applies unchanged

### Requirement: No observable request/response behavior changes, and cross-adapter parity holds

The trims SHALL NOT change any observable request/response behavior of the Node adapter, and
`ctx.ip` / `ctx.next()` behavior SHALL remain identical across all adapters (the sibling adapters
are unchanged by this Node-scoped change).

#### Scenario: The adapter serves all route outcomes identically
- **WHEN** the Node adapter handles static, param, POST, and unmatched-path requests after the trims
- **THEN** responses (status, body, headers) are identical to before the change

#### Scenario: Cross-adapter behavioral parity is preserved
- **WHEN** the cross-adapter behavioral/conformance suites run
- **THEN** `ctx.ip` and `ctx.next()` behave identically across Node/Bun/Deno/Edge, with the sibling adapters unchanged

### Requirement: The context/response trims are validated by allocation and coverage gates

Because each trim is <1%, the change SHALL be accepted on deterministic allocation reduction and
byte-identical parity rather than an RPS A/B, and per-package coverage MUST NOT decrease.

#### Scenario: Allocation micro-benchmarks document the removed work
- **WHEN** the context allocation micro-bench runs on a query-less request and a JSON response
- **THEN** it shows the empty-`query` object is no longer allocated and `ctx.json()` performs one header write instead of two

#### Scenario: Response parity is unaffected
- **WHEN** `pnpm bench:validate` runs across all benchmark servers
- **THEN** response bodies and Content-Type remain byte-identical

#### Scenario: Coverage is maintained and changed branches are covered
- **WHEN** the adapter-node test suite runs with coverage
- **THEN** per-package line coverage stays at or above 90% and the changed `query` / `json()` / `set()` branches are covered

### Requirement: The per-request-work optimization is validated by benchmark and coverage gates

The change SHALL be accepted only when the per-request work removal is measured and correctness is
covered. The deterministic allocation evidence is the primary gate; the RPS A/B confirms no
regression.

#### Scenario: An allocation micro-benchmark documents the removed per-request work
- **WHEN** the allocation micro-benchmark runs against the Node context request path
- **THEN** it shows the per-request IP lookup closure (for `trustProxy` false) and the per-request options object are no longer allocated, and `ctx.next()` allocates no extra async frame

#### Scenario: Response parity is unaffected (per-request work)
- **WHEN** `pnpm bench:validate` runs across all benchmark servers
- **THEN** response bodies and Content-Type remain byte-identical

#### Scenario: The full-profile A/B shows no regression
- **WHEN** `pnpm bench:compare --profile full` (5 runs, CPU-pinned) is run before and after on Hello World and Route Params
- **THEN** there is no RPS regression beyond stddev

#### Scenario: Coverage is maintained and changed branches are covered (per-request work)
- **WHEN** the test suite runs with coverage
- **THEN** per-package line coverage stays at or above 90% and the changed `ip` / `next()` / options branches are covered

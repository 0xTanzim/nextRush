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

The content-length pre-check and the streaming size check SHALL continue to run at the same two
points and SHALL still throw `BodyTooLargeError(effectiveLimit, size)` and destroy the stream on a
mid-stream breach. The enforced value is the **effective limit**: the caller-supplied `limit`
passed to `buffer(limit)` when present, otherwise the construction-time `options.limit` (which
remains the 1 MB default). Passing no argument preserves today's behavior exactly.

#### Scenario: A content-length over the effective limit throws before reading
- **WHEN** `content-length` exceeds the effective limit
- **THEN** `buffer()` throws `BodyTooLargeError` before any body bytes are consumed

#### Scenario: A streamed body over the effective limit is rejected mid-stream
- **WHEN** a body without an accurate `content-length` exceeds the effective limit while streaming
- **THEN** the running-total check triggers `this.req.destroy()` and the read rejects with `BodyTooLargeError(effectiveLimit, totalRead)`

#### Scenario: A no-argument read enforces the construction-time limit unchanged
- **WHEN** `buffer()` is called with no argument
- **THEN** it enforces the construction-time `options.limit` exactly as today (backward-compatible)

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

### Requirement: `ctx.state` is materialized lazily with stable identity

`NodeContext` SHALL allocate the `ctx.state` object only when `state` is first accessed, exposing it
via a memoized accessor over a private backing field, so a request that never touches `state`
allocates no object. `ctx.state` SHALL remain a mutable object with stable identity across reads
(`ctx.state === ctx.state`), SHALL be reassignable (`ctx.state = {...}`), and SHALL support the
symbol-keyed writes the prefix-mount path performs — behavior-identical to the previous eager
`state = {}` field.

#### Scenario: A request that never reads state allocates no object
- **WHEN** a request is handled by a handler that uses `ctx.json`/`ctx.body`/`ctx.params` but never reads or writes `ctx.state`
- **THEN** no `state` object is allocated for that request

#### Scenario: state materializes on first access and is identity-stable
- **WHEN** `ctx.state` is read (once or repeatedly)
- **THEN** it returns a mutable object, and repeated reads return the same object (`ctx.state === ctx.state`)

#### Scenario: Middleware share data through state as today
- **WHEN** one middleware writes `ctx.state.user = u` and a later middleware/handler reads `ctx.state.user`
- **THEN** the value is shared within the request exactly as with the previous eager object

#### Scenario: state is reassignable
- **WHEN** code assigns `ctx.state = { fresh: true }`
- **THEN** the assignment succeeds and subsequent reads of `ctx.state` return the assigned object

#### Scenario: Symbol-keyed prefix-mount writes work through the lazy accessor
- **WHEN** a router mounted at a prefix handles a request, writing/clearing its symbol keys on `ctx.state` (as `createPrefixMount` does)
- **THEN** the symbol writes land and are cleared correctly (the read materializes `state`), and the request is served identically to today

#### Scenario: Cross-adapter behavior is unchanged
- **WHEN** the cross-adapter behavioral/conformance suites run
- **THEN** `ctx.state` behaves identically as an observable mutable object; the laziness is an internal Node-scoped implementation detail with no observable difference (sibling adapters unchanged)

### Requirement: The lazy `ctx.state` trim is validated by allocation, parity, and coverage gates

Because the trim is behavior-preserving and small, it SHALL be accepted on deterministic allocation
reduction + byte-identical parity rather than an RPS A/B, and per-package coverage MUST NOT
decrease.

#### Scenario: An allocation micro-benchmark documents the removed object
- **WHEN** the context-state allocation micro-benchmark (`bench:alloc:context-state`) runs a state-unread request path
- **THEN** it shows the per-request `state` object is no longer allocated on the state-unread path (mirroring the lazy-`raw` result)

#### Scenario: Response parity is unaffected
- **WHEN** `pnpm bench:validate` runs across all benchmark servers
- **THEN** response bodies and Content-Type remain byte-identical

#### Scenario: Coverage is maintained and the accessor branches are covered
- **WHEN** the adapter-node test suite runs with coverage
- **THEN** per-package line coverage stays at or above 90% and the lazy `state` getter/setter (first-access materialization, reassignment, symbol-key write) branches are covered

### Requirement: The Node adapter listens with an explicit, sane TCP accept-queue backlog

`listen()` in `@nextrush/adapter-node` SHALL pass an explicit `backlog` value to the underlying
`server.listen()` call instead of relying on Node's platform default (511), so the accept queue can
absorb a larger burst of incoming connections before the operating system starts delaying or
dropping them. The value SHALL be a named constant, not derived from the running host's live
`net.core.somaxconn`, so behavior does not silently change across deployment environments.

#### Scenario: The server listens with the configured backlog
- **WHEN** `listen(app, port)` starts the Node HTTP server
- **THEN** the underlying `server.listen()` call is made with an explicit backlog value greater than Node's 511 default

#### Scenario: The backlog value is a named constant, not host-derived
- **WHEN** the backlog value is read
- **THEN** it comes from a documented constant in the adapter's source, not from inspecting the host's `net.core.somaxconn` at runtime

#### Scenario: Accepted-connection behavior is unaffected
- **WHEN** a connection is accepted and a request is served (any route: static, param, POST, error, 404)
- **THEN** the response is byte-identical to before this change — the backlog only affects how many pending connections can queue before being accepted, not per-request behavior

#### Scenario: Cross-adapter scope is Node-only
- **WHEN** the Bun, Deno, or Edge adapters listen for connections
- **THEN** they are unaffected by this change (the backlog is a `node:net`/`node:http` server option with no equivalent required elsewhere in this change's scope)

### Requirement: `NodeBodySource.buffer()` accepts an optional per-read limit

`NodeBodySource.buffer(limit?: number)` SHALL accept an optional byte limit; when provided it
takes precedence over the construction-time `options.limit` for both the content-length pre-check
and the streaming running-total check, without changing the read mechanism (event listeners),
the consumed/cache semantics, or the stream-lifecycle handling. The sibling `AbstractBodySource`
(runtime) and `WebBodySource` (Bun/Deno/Edge) SHALL honor the same optional-limit contract so
body-size enforcement is identical across adapters (RFC 017).

#### Scenario: A caller limit lower than the construction default is enforced
- **WHEN** `buffer(limit)` is called with a `limit` lower than `options.limit` and the body
  exceeds `limit`
- **THEN** the read is rejected against the lower caller `limit`

#### Scenario: A caller limit higher than the construction default is honored
- **WHEN** `buffer(limit)` is called with a `limit` higher than the construction default and the
  body is between the two sizes
- **THEN** the body is read successfully (the higher caller `limit` governs, not the 1 MB default)

#### Scenario: An omitted limit preserves construction-time behavior
- **WHEN** `buffer()` is called with no `limit` argument
- **THEN** enforcement falls back to `options.limit`, identical to today

#### Scenario: Web adapters honor the same optional-limit contract
- **WHEN** the cross-adapter conformance suite exercises `buffer(limit)` on the Bun/Deno/Edge
  `WebBodySource`
- **THEN** an over-limit body is rejected against the caller `limit` identically to the Node adapter

### Requirement: `ctx.bodySource` is built lazily for body-bearing methods

`NodeContext` SHALL construct the `NodeBodySource` only when `ctx.bodySource` is first read,
exposing it via a memoized accessor, so a body-method (`POST`/`PUT`/`PATCH`) request whose body is
never read allocates no body source and attaches no stream listeners. Bodyless methods SHALL
continue to resolve to the shared `EmptyBodySource` singleton. `ctx.bodySource` SHALL have stable
identity across reads (`ctx.bodySource === ctx.bodySource`).

#### Scenario: A POST that never reads the body allocates no body source
- **WHEN** a `POST` request is handled by a route with no body parser and the handler never reads
  `ctx.bodySource`
- **THEN** no `NodeBodySource` is allocated and no `data`/`end`/`error`/`close` listeners are
  attached for it

#### Scenario: Reading ctx.bodySource materializes it once with stable identity
- **WHEN** `ctx.bodySource` is read (once or repeatedly) on a body-method request
- **THEN** it returns a `NodeBodySource`, and repeated reads return the same instance

#### Scenario: Bodyless methods use the shared empty singleton
- **WHEN** a `GET`, `HEAD`, `OPTIONS`, or `TRACE` request is handled
- **THEN** `ctx.bodySource` is the shared `EmptyBodySource` singleton (no per-request allocation)

#### Scenario: Cross-adapter body-reading behavior is unchanged
- **WHEN** the cross-adapter behavioral/conformance suites run
- **THEN** observable body-reading behavior is identical across Node/Bun/Deno/Edge; the laziness
  is an internal Node-scoped implementation detail with no observable difference

### Requirement: A mid-stream body-size breach returns a clean 413, not a transport reset

When a request body exceeds the effective limit **while streaming** (no usable `Content-Length`,
so the breach is detected mid-read), the Node adapter SHALL deliver a well-formed `413` response
to the client before the request socket is torn down. It SHALL NOT `req.destroy()` in a way that
resets the connection before the `413` status line and body have flushed. The synchronous
`Content-Length` pre-check path (which rejects before any read) is unaffected.

#### Scenario: A chunked over-limit body receives a 413, not ECONNRESET
- **WHEN** a client streams a body (chunked / no accurate `Content-Length`) that exceeds the
  effective limit, and the framework's error handler maps the resulting `BodyTooLargeError` to a
  response
- **THEN** the client receives a `413` response (status + body) rather than a connection reset
  (`ECONNRESET` / socket hang up)

#### Scenario: The Content-Length pre-check path is unchanged
- **WHEN** a request declares a `Content-Length` over the effective limit
- **THEN** it is rejected synchronously with a `413` before any body is read, exactly as today

#### Scenario: Excess bytes are not buffered after the breach
- **WHEN** the running-total breach is detected mid-stream
- **THEN** no further body chunks are accumulated (the read stops consuming), while the response
  still flushes cleanly — memory is bounded near the limit

#### Scenario: Cross-adapter parity for the over-limit response
- **WHEN** the conformance suite drives an over-limit body through each adapter
- **THEN** every adapter returns a `413` (Web adapters via their stream cancellation), with no
  adapter resetting the connection before the response is delivered

### Requirement: Streaming responses settle deterministically when the client disconnects under backpressure
The Node adapter's response byte pump — `sendStream()` and the Web-`ReadableStream` branch of
`send()` — SHALL settle its returned promise when the client disconnects while the pump is parked
on socket backpressure. A parked `res.once('drain')` wait MUST additionally observe `res` `'close'`
and `'error'` (and the request abort signal) and resolve/reject promptly on any of them, so a
disconnect ends the wait — and the awaiting handler — rather than leaving the wait permanently
pending. A disconnected backpressured stream MUST NOT retain the pump frame, the `res`, the reader,
or the stream controller after the request ends.

#### Scenario: A disconnect while backpressured settles the handler
- **WHEN** an SSE/stream response is parked on `res.once('drain')` (the socket write buffer is full)
  and the client disconnects
- **THEN** the streaming promise settles within milliseconds (as a client-abort outcome), and the
  handler's `await ctx.sse(...)`/`await ctx.sendStream(...)` returns instead of hanging

#### Scenario: Post-stream handler cleanup runs on backpressured disconnect
- **WHEN** a handler has a `finally` block after `await ctx.stream(...)` and the client disconnects
  while the stream is backpressured
- **THEN** the `finally` block executes (e.g. a DB transaction is rolled back, a pooled resource is
  released)

#### Scenario: No pump state is retained after a backpressured disconnect
- **WHEN** a backpressured stream is disconnected and the request has ended
- **THEN** a heap snapshot shows the `res`, reader, and stream controller for that request are
  collectable (no permanently-pending promise roots them)

### Requirement: The Node request timeout matches the web adapters' cooperative handler timeout
The Node adapter SHALL provide the same handler-level request timeout that
`@nextrush/adapter-{bun,deno,edge}` already provide: a `timeout` on `ServeOptions` that, on overrun,
aborts the request's `ctx.signal` and — if no response has yet been sent — emits a
`504 Gateway Timeout`, defaulting to `DEFAULT_TIMEOUT_MS` with `0` disabling it. It SHALL be wired
into `ctx.signal` via the shared `combineAbortSignal` primitive so a cooperative handler observes
one signal for both client disconnect and timeout, and its observable behavior MUST be identical to
the Bun/Deno/Edge timeout (status `504`, cooperative cancellation) as pinned by the cross-adapter
conformance suite. A helper SHALL be provided to derive a child deadline `AbortSignal` from
`ctx.signal` for per-operation budgets. The socket-level `server.timeout` remains as a complementary
backstop.

#### Scenario: A hung handler is cancelled and answered with 504, matching the web adapters
- **WHEN** a handler does not respond within the configured `timeout`
- **THEN** `ctx.signal.aborted` becomes `true` and, if headers are not yet sent, the client receives
  a `504 Gateway Timeout` — byte-identical to the response Bun/Deno/Edge already return on timeout

#### Scenario: Disabling the timeout allocates no per-request timer
- **WHEN** `serve({ timeout: 0 })` is set
- **THEN** no per-request timeout timer is created for that request

#### Scenario: The request-timeout behavior is identical across all four adapters
- **WHEN** the cross-adapter conformance suite exercises a handler that overruns the timeout on
  Node, Bun, Deno, and Edge
- **THEN** each returns `504` and aborts `ctx.signal`, with no behavioral divergence

#### Scenario: A child deadline signal derives from ctx.signal
- **WHEN** a handler derives a child deadline signal from `ctx.signal` via the provided helper
- **THEN** the child signal aborts when either the deadline elapses or `ctx.signal` aborts (client
  disconnect or request timeout)

### Requirement: Response completion always sets a Content-Type
When the adapter completes a request whose handler resolved without sending a response and without
throwing, the emitted response SHALL carry an explicit `Content-Type`. The adapter MUST NOT emit a
bare status with an absent `Content-Type` on the unhandled-completion fallback path.

#### Scenario: The unhandled-completion fallback sets a Content-Type
- **WHEN** a handler resolves without calling any response method and without error, and the status
  is not `404`
- **THEN** the response sent by the adapter includes an explicit `Content-Type` header

### Requirement: A client abort during body read is classified as a client-side condition
When the request stream closes before the body is fully read (client disconnect/abort), the adapter
SHALL reject the body read with a typed client-abort error distinct from a server (`5xx`) error, so
metrics and logs do not misattribute a client disconnect as a server fault. Disconnect detection
MUST NOT rely on the deprecated `req 'aborted'` event.

#### Scenario: A premature body close yields a typed client-abort, not a 500
- **WHEN** the request stream closes before the declared body has been fully read
- **THEN** the body read rejects with a typed client-abort error (a `4xx`-class condition), not a
  generic error that surfaces as a `500`

#### Scenario: Disconnect detection uses a non-deprecated mechanism
- **WHEN** the adapter wires client-disconnect detection for `ctx.signal` and body reads
- **THEN** it uses `req`/`res` `'close'` (with the destroyed/aborted checks) rather than the
  deprecated `req 'aborted'` event

### Requirement: Node adapter supports TLS and negotiated HTTP/2
`@nextrush/adapter-node`'s `ServeOptions` SHALL include an optional `tls: { cert: string | Buffer; key: string | Buffer; ca?: string | Buffer }` field, matching the shape already shipped in `@nextrush/adapter-bun`. When `tls` is present, `serve()` SHALL construct a `node:http2` secure server with ALPN negotiation, falling back to HTTP/1.1 for clients that do not negotiate `h2`. When `tls` is absent, `serve()` SHALL behave exactly as before this change (plain `node:http`, HTTP/1.1 only). The canonical host-binding field remains `host`; this requirement MUST NOT introduce a `hostname` field.

#### Scenario: TLS absent preserves existing behavior
- **WHEN** `serve(app)` is called with no `tls` option
- **THEN** the adapter behaves identically to its pre-change implementation — plain `node:http`, HTTP/1.1 only

#### Scenario: TLS present negotiates HTTP/2 via ALPN
- **WHEN** `serve(app, { tls: { cert, key } })` is called and a connecting client supports ALPN with `h2`
- **THEN** the connection negotiates HTTP/2 and the request reaches the same shared `Context` shape as an HTTP/1.1 request

#### Scenario: TLS present falls back to HTTP/1.1 for non-h2 clients
- **WHEN** `serve(app, { tls: { cert, key } })` is called and a connecting client does not offer `h2` in ALPN
- **THEN** the connection serves HTTP/1.1 over TLS, with identical observable framework behavior to a plain HTTP/1.1 request

#### Scenario: The tls option matches the Bun adapter's shape
- **WHEN** the same `{ cert, key, ca? }` object is passed to both the Node and Bun adapters' `tls` option
- **THEN** both adapters accept it without a shape difference

#### Scenario: host remains the canonical field; hostname is not introduced
- **WHEN** `ServeOptions` is inspected after this change
- **THEN** it exposes `host` (unchanged) and does not gain a `hostname` field
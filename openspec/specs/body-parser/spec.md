# body-parser

## Purpose

Request body parsing (`@nextrush/body-parser`): content-type routing, decoding, and parsing to
`ctx.body`, with the configured size `limit` enforced incrementally at read time (not a fixed
adapter default), RFC-aligned method handling (DELETE parseable, TRACE bodyless), depth-guarded
JSON, and single content-type detection through the combined parser. Also its
developer-experience contract: when a route depends on a parsed body (e.g. `@Body()`) but no
body-parser middleware ran, the failure names the likely cause and fix rather than surfacing a
generic parameter-injection error, while a correctly configured body-parser path resolves the
body unchanged.

## Requirements

### Requirement: A missing body-parser produces an actionable `@Body` error
When `@Body()` resolves to nothing because no body-parser middleware ran, the resulting error
SHALL name the likely cause and fix, rather than a generic parameter-injection error with no
diagnostic hint.

#### Scenario: A route using `@Body()` with no body-parser installed fails with a helpful error
- **WHEN** a request hits a route using `@Body()` and no body-parser middleware
  (e.g. `json()`) has been registered on the application
- **THEN** the resulting error's message mentions the likely missing body-parser and how to fix
  it (e.g. referencing `app.use(json())`), instead of only a generic `MissingParameterError`
  with no such hint

#### Scenario: A correctly-configured `@Body()` route is unaffected
- **WHEN** a body-parser middleware is registered and a route using `@Body()` receives a valid
  request
- **THEN** the body resolves correctly with no error, exactly as before this change

### Requirement: The configured body-size limit is enforced incrementally during read

Body-parser SHALL enforce the parser's configured `limit` (the value passed to
`json({ limit })` / `urlencoded({ limit })` / `text({ limit })` / `raw({ limit })`, or the
per-parser default) as the limit that governs the actual read — not a fixed adapter default. An
over-limit body SHALL be rejected before materially more than that configured limit is buffered
into memory, and a body within the configured limit SHALL be accepted even when it exceeds the
adapter's own default limit. The rejection error SHALL report the limit that actually fired.

#### Scenario: A configured limit larger than the adapter default is honored
- **WHEN** `json({ limit: '5mb' })` receives a 2 MB body whose size is not knowable up front
  (chunked / absent / understated `Content-Length`)
- **THEN** the body is read and parsed successfully — it is NOT capped at the adapter's 1 MB
  default

#### Scenario: A configured limit smaller than the adapter default protects incrementally
- **WHEN** `json({ limit: '10kb' })` receives a chunked 900 KB body
- **THEN** the read is rejected once the running total exceeds the configured ~10 KB limit, and
  the peak bytes buffered stay near the configured limit rather than growing to the adapter's
  1 MB default

#### Scenario: The over-limit error reports the effective limit
- **WHEN** a body is rejected for exceeding the configured limit
- **THEN** the resulting `BodyParserError` (`ENTITY_TOO_LARGE`) reports the configured limit that
  fired, not a different layer's limit

#### Scenario: An honest oversized Content-Length is still rejected synchronously
- **WHEN** a request declares a `Content-Length` greater than the configured limit
- **THEN** it is rejected before any body bytes are read

#### Scenario: A body within the configured limit parses unchanged
- **WHEN** a request body within the configured limit is sent to a matching parser
- **THEN** it parses to the identical `ctx.body` value produced for the common case

### Requirement: A DELETE request body is parsed per the runtime method policy

Body-parser's bodyless-method set SHALL agree with the runtime's `METHODS_WITHOUT_BODY` policy:
DELETE is body-bearing (RFC 7231 §4.3.5) and SHALL be parsed when it carries a matching
`Content-Type`; TRACE is bodyless (RFC 7231 §4.3.8) and SHALL be skipped. GET, HEAD, and OPTIONS
remain bodyless and SHALL short-circuit without reading a body.

#### Scenario: A DELETE with a JSON body is parsed
- **WHEN** a `DELETE` request with `Content-Type: application/json` and a JSON body reaches a
  route with `json()` installed
- **THEN** `ctx.body` is the parsed object rather than `undefined`

#### Scenario: Bodyless methods short-circuit
- **WHEN** a `GET`, `HEAD`, `OPTIONS`, or `TRACE` request reaches any parser
- **THEN** the parser calls `next()` without reading a body

### Requirement: JSON nesting-depth protection is preserved under a small-payload fast path

The JSON depth guard SHALL continue to reject payloads whose nesting exceeds `maxDepth`. An
optimization that skips the depth traversal for payloads too small to possibly reach `maxDepth`
SHALL NOT weaken that guarantee — it may only skip work that cannot change the outcome.

#### Scenario: A payload deeper than maxDepth is still rejected
- **WHEN** a JSON payload nested beyond `maxDepth` is parsed (at any byte size)
- **THEN** it is rejected with `JSON_DEPTH_EXCEEDED`, regardless of the fast-path gate

#### Scenario: A payload too small to reach maxDepth skips the traversal
- **WHEN** a JSON payload whose byte length cannot represent nesting deeper than `maxDepth` is
  parsed
- **THEN** the depth traversal does not run, and `ctx.body` is byte-identical to the result
  produced with the traversal

#### Scenario: Disabling the depth check is still honored
- **WHEN** `json({ maxDepth: Infinity })` is configured
- **THEN** no depth rejection occurs for any nesting level

### Requirement: The combined parser detects the content type once per request

`bodyParser()` SHALL route a request to the matching parser without that parser re-performing the
method check and content-type detection the combined parser already performed. The parsed result
SHALL be identical to invoking the corresponding individual parser directly.

#### Scenario: A JSON request is detected once and matches json() directly
- **WHEN** a JSON request is handled through `bodyParser()`
- **THEN** method + content-type detection is performed once (not repeated by the delegated JSON
  parser), and `ctx.body` equals the result `json()` would produce for the same request

#### Scenario: A form request routes to urlencoded with identical output
- **WHEN** an `application/x-www-form-urlencoded` request is handled through `bodyParser()`
- **THEN** it is routed to the URL-encoded parser and `ctx.body` equals the result `urlencoded()`
  would produce directly

#### Scenario: An unsupported multipart body still errors clearly
- **WHEN** a `multipart/*` request is handled through `bodyParser()`
- **THEN** it is rejected with a 415 `UNSUPPORTED_CONTENT_TYPE` error pointing to the dedicated
  multipart package
### Requirement: Parse-failure messages are runtime-independent

A parse failure raised by a body parser SHALL carry a framework-authored constant message that does
not vary between JavaScript engines. Where the engine's own parse text is useful for diagnosis it
SHALL be retained as a non-enumerable `cause`, available to server-side logging and never serialized
into a response. Framework-authored detail, such as a configured size limit or a nesting limit, SHALL
remain in the message.

#### Scenario: Invalid JSON reports the constant message

- **WHEN** a malformed JSON body is parsed
- **THEN** the raised error's message is exactly the documented constant `Invalid JSON`

#### Scenario: The message is identical on every runtime

- **WHEN** the same malformed JSON body is parsed under Node and under Bun
- **THEN** the two responses carry byte-identical bodies

#### Scenario: Engine parse text stays server-side

- **WHEN** a malformed JSON body is parsed
- **THEN** the engine's message is present on the error as a non-enumerable `cause` and is absent from
  the serialized response body

#### Scenario: Framework-authored detail is preserved

- **WHEN** a body exceeds the configured limit or a JSON payload exceeds the configured nesting depth
- **THEN** the message still states the framework's own limit and cause, as today

#### Scenario: Other parsers do not embed engine text

- **WHEN** the urlencoded, text or raw parsers report a failure
- **THEN** none of them embeds an engine-authored message in the response-visible message

### Requirement: An unparsed content type is decided by an explicit policy

The combined body parser SHALL expose an explicit policy for the case where a request carries a body,
declares a `Content-Type`, and matches no configured parser. The default policy SHALL preserve today's
behaviour: `ctx.body` stays undefined and the request continues. Under the rejecting policy the
request SHALL fail with the framework's unsupported-content-type error before any route handler runs.

#### Scenario: The default policy preserves today's behaviour

- **WHEN** a request declares an unmatched `Content-Type` and no policy is configured
- **THEN** parsing is skipped, `ctx.body` is undefined, and the request continues as today

#### Scenario: The rejecting policy answers 415

- **WHEN** the rejecting policy is configured and a request carries a body with an unmatched
  `Content-Type`
- **THEN** the request fails with the framework's unsupported-content-type error and a 415 status,
  before any route handler runs

#### Scenario: Bodyless methods never reject

- **WHEN** the rejecting policy is configured and a bodyless method is handled
- **THEN** no rejection occurs, regardless of the declared `Content-Type`

#### Scenario: An absent or empty content type never rejects

- **WHEN** the rejecting policy is configured and a request carries no `Content-Type` header
- **THEN** no rejection occurs

#### Scenario: A configured parser is unaffected

- **WHEN** a request's `Content-Type` matches a configured parser under either policy
- **THEN** the body is parsed exactly as before

#### Scenario: Multipart keeps its dedicated diagnostic

- **WHEN** a `multipart/*` request is handled under the default policy
- **THEN** the existing dedicated unsupported-content-type error pointing at the multipart package is
  still raised

### Requirement: Lazy parsing defers the read until the application asks for it

`bodyParser()` and the individual parsers accept `lazy: true`. In that mode a parser must finish
detection and call `next()` without acquiring the bytes, enforcing the size limit, running `verify`,
parsing, or walking the JSON depth guard. Bytes are consumed only by `await ctx.readBody()`, which must
be idempotent, share one in-flight read between concurrent callers, and cache a failure for the rest of
the request. Eager parsing remains the default and its behaviour must not change. The reader goes
through the context's `BodySource`, so it adds no runtime-specific code.

#### Scenario: An unread body performs no body work

- **WHEN** `bodyParser({ lazy: true })` handles a request whose handler never reads the body
- **THEN** the body source is not read and the handler runs normally, even if the body is malformed JSON

#### Scenario: `ctx.body` fails loudly before the first read

- **WHEN** a handler reads `ctx.body` on a request a lazy parser claimed, before a successful `readBody()`
- **THEN** it throws the framework's `BODY_NOT_READ` error naming `readBody()`, rather than returning `undefined`

#### Scenario: An unclaimed request keeps `ctx.body` undefined

- **WHEN** a request is not claimed (a bodyless method, or an unmatched `Content-Type` under the default policy)
- **THEN** `ctx.body` is `undefined` and no reader is installed, exactly as in eager mode

#### Scenario: Read once, share the result

- **WHEN** `readBody()` is called repeatedly or concurrently
- **THEN** the body source is read exactly once and every caller receives the same value, with the same identity

#### Scenario: Failures are cached, not retried

- **WHEN** a read rejects (malformed JSON, depth exceeded, over the limit)
- **THEN** the rejection carries the same error code and status eager parsing produces, and a second `readBody()` rejects with the same error without reading the stream again

#### Scenario: The size limit is enforced at read time, not widened

- **WHEN** a request declares a body larger than the configured limit under lazy parsing
- **THEN** `readBody()` rejects with the entity-too-large error without reading those bytes, and the adapter's own transport cap still applies unconditionally

#### Scenario: Media-type decisions stay eager

- **WHEN** a request carries `multipart/*` or an unmatched `Content-Type` under `onUnsupportedContentType: 'reject'` with lazy parsing
- **THEN** the request still fails with `415` before any route handler runs, because the decision needs no bytes

#### Scenario: Eager mode is unchanged

- **WHEN** `lazy` is omitted
- **THEN** `ctx.body` is populated before `next()` and every parse, limit, `verify`, and error behaviour — status, code, and envelope — is identical to the previous release

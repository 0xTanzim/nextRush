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
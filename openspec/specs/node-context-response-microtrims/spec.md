# node-context-response-microtrims Specification

## Purpose
TBD - created by archiving change node-context-response-microtrims. Update Purpose after archive.
## Requirements
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

### Requirement: The trims are validated by allocation and coverage gates

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


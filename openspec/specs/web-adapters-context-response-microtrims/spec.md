# web-adapters-context-response-microtrims

## Purpose

The Web-adapter (Bun/Deno/Edge) request path avoids three per-request allocations that the Node
siblings already shipped, while keeping observable behavior byte-identical and cross-adapter
consistent: the empty-`query` object (a shared frozen object in `parseQueryString`), the
unconditional `toLowerCase()` in `WebResponseBuilder.set` (gated behind a cheap pre-check), and the
eager `{ req, res }` wrapper in the Bun/Deno/Edge contexts (a lazy memoized `raw`). `ctx.query`,
header/`Set-Cookie` accumulation, the CRLF guard, and `ctx.raw` remain unchanged and are pinned by
the scenarios below plus the cross-adapter conformance suite (`packages/adapters/conformance`).

## Requirements

### Requirement: A query-less Web request uses a shared frozen empty query object

`parseQueryString` SHALL return a shared frozen empty query object for its empty and over-limit
early-return cases instead of allocating a fresh object, so a query-less Bun/Deno/Edge request
allocates no throwaway query object, while the non-empty parse path is unchanged. `ctx.query` MUST
remain read-only.

#### Scenario: A query-less request across Web adapters gets the shared frozen empty object
- **WHEN** a Bun, Deno, or Edge request with no query string is handled
- **THEN** `ctx.query` is the shared frozen empty query object (no fresh per-request object is allocated) and is empty

#### Scenario: A non-empty query is parsed unchanged
- **WHEN** a request with `?a=1&b=2` is handled on any Web adapter
- **THEN** `ctx.query` equals the parsed params, identical to today (its own object, not the shared instance)

#### Scenario: An over-limit query rejects to the shared empty object
- **WHEN** a query string longer than the max length is received
- **THEN** `parseQueryString` returns the shared frozen empty object (reject-to-empty), matching today's empty result

### Requirement: `WebResponseBuilder.set` gates the set-cookie toLowerCase behind a cheap pre-check

`WebResponseBuilder.set` SHALL detect `set-cookie` via a constant-time pre-check before falling back
to `field.toLowerCase()`, so non-cookie headers allocate no lowercased string, while `Set-Cookie` is
still detected case-insensitively and accumulated. The `assertHeaderSafe` CRLF guard and the
array-value branch MUST be unchanged.

#### Scenario: Set-Cookie is detected across casings and accumulates
- **WHEN** `ctx.set('Set-Cookie', …)`, `ctx.set('set-cookie', …)`, or `ctx.set('SET-COOKIE', …)` is called with a string value on a Web adapter
- **THEN** each is detected as a cookie and appended (multiple cookies accumulate), identical to today

#### Scenario: A non-cookie header skips the toLowerCase allocation
- **WHEN** `ctx.set('Content-Type', 'text/plain')` (or any non-cookie header) is called
- **THEN** the header is set correctly and no `toLowerCase()` string is allocated for cookie detection

#### Scenario: The CRLF guard and array-value branch are unaffected
- **WHEN** `ctx.set` is called with a CR/LF in field or value, or with an array value
- **THEN** `assertHeaderSafe` still throws for CR/LF, and an array value still replaces then appends each entry, identical to today

### Requirement: `ctx.raw` is built lazily and identically on the Web adapters

Bun, Deno, and Edge contexts SHALL build the `{ req, res }` wrapper only when `ctx.raw` is read
(memoized getter), holding `req` in a private field that the internal `signal`/timeout paths use.
`ctx.raw` MUST return the same `{ req, res: undefined }` shape and stable identity as today, and
behavior MUST stay identical across all three adapters.

#### Scenario: A request that never reads ctx.raw allocates no wrapper
- **WHEN** a Bun/Deno/Edge request is handled by a handler that never reads `ctx.raw`
- **THEN** no `{ req, res }` wrapper object is allocated for that request

#### Scenario: ctx.raw returns the identical shape and is memoized
- **WHEN** `ctx.raw` is read (once or repeatedly) on any Web adapter
- **THEN** it returns `{ req: <the Request>, res: undefined }`, and repeated reads return the same object (`ctx.raw === ctx.raw`)

#### Scenario: Signal and timeout still work after the refactor
- **WHEN** `ctx.signal` is accessed or `triggerTimeout` fires
- **THEN** the abort signal combines the request signal and the timeout controller exactly as today, using the private `req` field

### Requirement: The trims stay cross-adapter-consistent and are validated by allocation and conformance gates

Because each trim is <1%, the change SHALL be accepted on deterministic allocation reduction,
byte-identical parity, and the cross-adapter conformance suite rather than an RPS A/B, and coverage
MUST NOT decrease.

#### Scenario: The conformance suite stays green
- **WHEN** the `packages/adapters/conformance` suite runs across Node/Bun/Deno/Edge
- **THEN** all cross-adapter behavior (query, headers, cookies, raw, responses) remains identical

#### Scenario: Allocation micro-benchmarks document the removed work
- **WHEN** `apps/benchmark/scripts/web-context-alloc.js` runs on a query-less, raw-unread request
- **THEN** it shows neither the empty-`query` object nor the `{ req, res }` wrapper is allocated

#### Scenario: Response parity is unaffected
- **WHEN** `pnpm bench:validate` runs across all benchmark servers
- **THEN** response bodies and Content-Type remain byte-identical

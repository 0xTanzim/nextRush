# web-adapters

## Purpose

The Web-platform adapters (`@nextrush/adapter-bun`, `-deno`, `-edge`) and their shared per-request
Context/response behavior: a shared frozen empty query object in `parseQueryString`, the
`set-cookie` `toLowerCase` pre-check in `WebResponseBuilder.set`, the lazily-memoized `ctx.raw`
wrapper, the `ctx.ip` trust-proxy resolution (including Edge's `cf-connecting-ip` precedence), and
the `ctx.next()` direct-forward. Every behavior is held byte-identical to its pre-optimization form
and identical across all four adapters (Node + the three), pinned by
`packages/adapters/conformance` and validated by allocation micro-benchmarks rather than an RPS
A/B (since the `wrk` suite drives only the Node server).

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

### Requirement: A Next.js App Router route handler can mount a NextRush application without rewriting the request

`@nextrush/adapter-nextjs`'s `handle(app)` SHALL return the seven Next.js route-handler exports
(`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`) by delegating to
`@nextrush/adapter-edge`'s `createFetchHandler`, forwarding the incoming `Request` unmodified.
Mount prefixes MUST be declared by the application itself (`app.route(prefix, router)`) and MUST
NOT be inferred or stripped by the adapter. The package MUST import no runtime-specific API
(`node:*`, `process`, `Buffer`, or a `Deno`/`Bun` global) and MUST support only the App Router on
Next.js 14, 15, and 16.

#### Scenario: A mounted app sees the true request

- **WHEN** a request to `/api/hello` reaches a route handler built with `handle(app)`, and `app`
  declares `app.route('/api', router)` with `router.get('/hello', …)`
- **THEN** the handler's `ctx.path` is `/api/hello`, `ctx.url` is the full request URL, and
  `ctx.raw.req` is the same `Request` object Next.js passed in — none of them show a stripped path

#### Scenario: All seven methods are available from one call

- **WHEN** `handle(app)` is called
- **THEN** it returns an object with `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS`,
  each dispatching to the same underlying `Application`

#### Scenario: Background work reaches Next's `after()` when available

- **WHEN** a handler calls `ctx.waitUntil(promise)` under a Next.js version exposing
  `after` from `next/server`
- **THEN** `promise` is scheduled through `after()`; when `next/server` cannot be imported or
  exposes no `after`, `ctx.waitUntil()` no-ops without throwing

#### Scenario: A mount-prefix mismatch is diagnosed, never silently rescued, in development

- **WHEN** the underlying application produces a 404 for a request, `app.options.env` is not
  `'production'`, and the app has a matching route once the route file's mount segments are
  removed from the path
- **THEN** the framework logs an actionable message naming the mounted prefix and the missing
  `app.route()` call, and still returns the original 404 response — the alternate path is never
  served

#### Scenario: Cross-runtime parity holds for the Next.js entry point

- **WHEN** the `packages/adapters/conformance` suite's `nextjs` driver runs under the node,
  workerd, deno, and bun runners
- **THEN** observable behavior (status, headers, body, error shape) is identical across all four,
  matching the other Web adapters covered by this capability

#### Scenario: The functional install path stays free of Next.js

- **WHEN** a project runs `pnpm add nextrush` with no further installs
- **THEN** neither `@nextrush/adapter-nextjs` nor `next` is resolved onto disk
- **THEN** all cross-adapter behavior (query, headers, cookies, raw, responses) remains identical

#### Scenario: Allocation micro-benchmarks document the removed work
- **WHEN** `apps/benchmark/scripts/web-context-alloc.js` runs on a query-less, raw-unread request
- **THEN** it shows neither the empty-`query` object nor the `{ req, res }` wrapper is allocated

#### Scenario: Response parity is unaffected
- **WHEN** `pnpm bench:validate` runs across all benchmark servers
- **THEN** response bodies and Content-Type remain byte-identical

### Requirement: `ctx.ip` avoids a per-request lookup closure on the Web adapters when proxies are not trusted

The Bun, Deno, and Edge adapters SHALL resolve `ctx.ip` directly from the platform address when
`trustProxy` is false, without allocating a per-request header-lookup closure, producing the
identical value they produce today. When `trustProxy` is true, they SHALL resolve via the shared
client-IP policy exactly as today. Untrusted proxy headers SHALL be ignored (as today).

#### Scenario: Bun with trustProxy false returns the provided client IP without a lookup closure
- **WHEN** the Bun adapter handles a request with `trustProxy` false and a platform `clientIp`
- **THEN** `ctx.ip` equals that `clientIp` and no per-request header-lookup closure is allocated

#### Scenario: Bun with trustProxy false and no client IP yields an empty string
- **WHEN** the Bun adapter handles a request with `trustProxy` false and no platform `clientIp`
- **THEN** `ctx.ip` is `''`, matching today's behavior, with no lookup closure allocated

#### Scenario: Bun with trustProxy true resolves via the shared policy
- **WHEN** the Bun adapter handles a request with `trustProxy` true and a valid forwarded header
- **THEN** `ctx.ip` equals the policy result (using the platform `clientIp` as the direct address), identical to today

#### Scenario: Deno with trustProxy false returns the connection address
- **WHEN** the Deno adapter handles a request with `trustProxy` false
- **THEN** `ctx.ip` equals `connInfo.remoteAddr.hostname` (or `''`), with no lookup closure allocated

#### Scenario: Deno with trustProxy true resolves via the shared policy
- **WHEN** the Deno adapter handles a request with `trustProxy` true and a valid forwarded header
- **THEN** `ctx.ip` equals the policy result, identical to today

#### Scenario: Edge with trustProxy false yields an empty string without a lookup closure
- **WHEN** the Edge adapter handles a request with `trustProxy` false
- **THEN** `ctx.ip` is `''` (Edge has no socket address), with no lookup closure allocated

#### Scenario: Edge with trustProxy true preserves the Cloudflare precedence
- **WHEN** the Edge adapter handles a request with `trustProxy` true
- **THEN** `ctx.ip` resolves with the `cf-connecting-ip` → `x-forwarded-for` → `x-real-ip` precedence, identical to today

#### Scenario: Untrusted proxy headers are ignored on every Web adapter
- **WHEN** any of Bun/Deno/Edge handles a request with `trustProxy` false and `x-forwarded-for` / `x-real-ip` present
- **THEN** `ctx.ip` is the platform address (the proxy headers are ignored), matching today

### Requirement: `ctx.next()` forwards without an extra async frame on the Web adapters

The Bun, Deno, and Edge adapters SHALL forward the composer's dispatch thunk directly from
`ctx.next()` (returning its promise) rather than wrapping it in an additional `async` frame, while
preserving ordering, rejection propagation, the unwired no-op, and the `Promise<void>` contract.

#### Scenario: Awaiting next() preserves onion ordering
- **WHEN** a middleware calls `await ctx.next()` on any Web adapter and downstream runs
- **THEN** control returns to the caller after downstream completes, exactly as before

#### Scenario: A rejection from the wired thunk propagates
- **WHEN** the downstream chain rejects and the middleware `await`s `ctx.next()`
- **THEN** the rejection propagates out of `ctx.next()`

#### Scenario: next() with no wired thunk is a resolved no-op
- **WHEN** `ctx.next()` is called with no next thunk wired
- **THEN** it returns an already-resolved promise and does not throw

#### Scenario: next() advances the same chain the composer guards
- **WHEN** a middleware calls `ctx.next()` under the composed pipeline on any Web adapter
- **THEN** it advances the same chain as the composer's `next` argument, so the composer's multiple-`next()` detection still applies

### Requirement: `ctx.ip` and `ctx.next()` behavior stays identical across all four adapters

`ctx.ip` resolution policy and `ctx.next()` behavior SHALL be identical across Node, Bun, Deno, and
Edge, pinned by the `packages/adapters/conformance` suite. "Identical" means the same trust
handling, header precedence, validation, and `next()` semantics; the literal `ctx.ip` value may
still differ only by the platform-supplied direct address when no trusted header applies.

#### Scenario: The conformance suite stays green across all adapters
- **WHEN** the `packages/adapters/conformance` suite runs after the trims
- **THEN** it passes for all four adapters with no behavioral divergence in `ctx.ip` / `ctx.next()`

#### Scenario: The same header set and trust setting apply the same policy everywhere
- **WHEN** each adapter resolves `ctx.ip` for the same request headers and `trustProxy` setting
- **THEN** each applies the same precedence and validation policy, differing only in the platform direct address when no trusted header matches

#### Scenario: Edge's Cloudflare precedence is pinned in conformance
- **WHEN** the conformance suite exercises Edge `ctx.ip` with `trustProxy` true and `cf-connecting-ip` present
- **THEN** the Cloudflare precedence is asserted, so a future edit cannot silently drop it

### Requirement: The Web per-request-work optimization is validated by allocation and coverage gates

Because the `wrk` RPS suite drives only the Node server, acceptance for the siblings SHALL rest on
deterministic allocation evidence and the conformance/unit suites, not an RPS A/B.

#### Scenario: A per-adapter allocation micro-benchmark documents the removed closure
- **WHEN** the allocation micro-benchmark runs against each Web adapter's context path
- **THEN** it shows the per-request header-lookup closure is no longer allocated when `trustProxy` is false

#### Scenario: All suites remain green
- **WHEN** the conformance suite and each Web adapter's own test suite run
- **THEN** they pass with the trims applied

#### Scenario: Coverage is maintained and changed branches are covered
- **WHEN** the test suites run with coverage
- **THEN** per-package line coverage stays at or above 90% and the changed `ip` / `next()` branches in each adapter are covered

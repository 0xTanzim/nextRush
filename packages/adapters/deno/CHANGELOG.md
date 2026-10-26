# @nextrush/adapter-deno

## 1.1.0

### Minor Changes

- [#63](https://github.com/0xTanzim/nextRush/pull/63) [`6004c48`](https://github.com/0xTanzim/nextRush/commit/6004c482727f50cd760d4ab55d3c6b7f033e018b) Thanks [@0xTanzim](https://github.com/0xTanzim)! - A JSON response's `Content-Type` is now `application/json`, with no `charset` parameter.

  **What changes.** Every framework-generated JSON response — a handler's `ctx.json()`, an object
  passed to `ctx.send()`, and the framework's own `404`/`500`/`504` envelope — carries
  `content-type: application/json` on every adapter. It previously carried
  `application/json; charset=utf-8`.

  ```ts
  // Before
  expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
  // After
  expect(res.headers.get('content-type')).toBe('application/json');
  ```

  **Why.** RFC 8259 §8.1 registers `application/json` with no parameters — JSON is UTF-8 by
  definition, so a `charset` parameter is one the specification does not define. Hono 4.13.0 and
  Express 5.2.1 already send the bare value; only Fastify sends the parameterised form. The earlier
  conformance rule that pinned the parameterised value existed to stop adapters drifting apart — Edge
  and Bun's server-level error path emitted a bare `application/json` while the shared helper emitted
  the parameterised form. Every adapter now goes through the one shared helper that emits the bare
  value, so the uniformity is preserved and the drift is gone.

  **Migration.** Applications that only _parse_ the media type are unaffected: JSON parsing keys off
  the `application/json` type, and the `charset` parameter was never required for it. Only an
  exact-string comparison needs updating. The value is now identical on every adapter, so one
  assertion update covers all of them.

  **What does not change.** The status, the body bytes, `Content-Length`, the header set, the
  multi-value `Set-Cookie` behaviour, `text/plain` and `text/html`, and every other response
  behaviour. Request parsing, routing, middleware ordering, `ctx.next()`, body limits, raw-body bytes,
  UTF-8 correctness, caching, streaming, and error status mapping are all untouched.

  **Why this is a minor release.** No exported API, status, body, or request behavior changes, and
  JSON parsing keys off the media type rather than the exact header string. The one observable
  difference is the `Content-Type` value: an application that compares it to the old parameterised
  string exactly must update that assertion as shown above. The maintainer classified that
  wire-visible difference as a minor change for this release line; it is documented here rather
  than left implicit.

  **Performance.** The change removes a per-request `Headers` allocation from every Web response,
  and the bare media type lets Deno's `Response` constructor take its static fast path — together
  **−16.6 % server CPU per request on Deno GET** and −8.1 % on Deno POST, measured against the
  previous release, with no regression on Bun or Node.

  **The request deadline no longer costs a timer per request.** A request that waits on I/O — a body
  read, a database call — is still pending when the timeout window opens, so the framework armed a
  `setTimeout` for it and cleared it when the request settled. That pair costs 2.15 µs on Deno
  against 0.16 µs on Bun, and it measured **8.28 µs of server CPU per request on Deno POST (+29.8 %)**.
  The deadline is now served by one shared timer per runner: the deadline value, the `504`, the
  `ctx.signal` cancellation, and the late-rejection guard are unchanged, and the measured effect is
  **−13.8 % on Deno POST and −10.4 % on Bun POST**, with no change on the GET fast path.

- [#63](https://github.com/0xTanzim/nextRush/pull/63) [`a701579`](https://github.com/0xTanzim/nextRush/commit/a701579e7ac52bfeab8a5d8c539e07b40661e885) Thanks [@0xTanzim](https://github.com/0xTanzim)! - **A route that finishes synchronously now answers with a `Response` instead of a promise, so Bun
  stops paying a microtask hop the runtime never needed.**

  **What changes.** `createWebRunner` returns `Response | Promise<Response>`, and `createHandler` in
  the Bun, Deno and edge adapters follows that type. When the application's only middleware is the
  mounted router and the route executor reports that the handler settled without leaving work
  pending, the runner builds the response and returns it directly. Every other shape — application
  middleware, per-route middleware, an async handler, a throw — takes the existing promise path
  unchanged, timeout race included.

  **Why it is safe to answer early.** The new `Application.syncDispatchSafe` getter is true only when
  the middleware stack is exactly one entry _and_ that entry is a router dispatch mounted at the root.
  That middleware returns the executor's promise directly and never resumes after the handler, so
  nothing can mutate the response once the handler returns. A middleware registered ahead of the
  router can resume after `next()`, which is why a stack with two or more entries never takes the
  path — even when every middleware in it happens to be synchronous. The executor sets its marker
  only in the no-per-route-middleware branch, and only when the handler returned without a promise; a
  throw produces a rejection and no marker.

  **Compatibility.** Runtime behaviour is unchanged: callers that `await` the handler still work,
  because a `Response` awaits to itself. The type widening is source-visible for code that stores the
  return value in a `Promise<Response>`-typed variable; annotate it as `Response | Promise<Response>`
  (the adapters' own `BunFetchHandler` and `FetchHandler` types already do). `Bun.serve`, `Deno.serve`
  and the edge runtimes all accept either shape.

  **Measured (`wrk -t2 -c64`, server pinned to one core, paired order-flipped, CPU µs/request from
  `/proc/<pid>/stat`).** Bun GET: 14.86 → 13.20 µs (−11.7 %, 5/5 pairs). Deno GET: 12.75 → 11.44 µs
  (−6.8 %, 3/3). Deno POST: 36.59 → 34.76 µs (−2.9 %, 3/3). Bun POST and Node GET/POST: unchanged
  within noise (Bun POST keeps its `bodyParser` middleware, so the chain is genuinely asynchronous and
  the path does not apply). Node is unaffected because its adapter owns a callback-based runner.

- [#63](https://github.com/0xTanzim/nextRush/pull/63) [`81211bc`](https://github.com/0xTanzim/nextRush/commit/81211bc61e68fe437cbcd57e313c4e22a0f9d780) Thanks [@0xTanzim](https://github.com/0xTanzim)! - **The framework's default text media type is now written `text/plain;charset=UTF-8`** — no space
  after the separator, upper-case charset value — instead of `text/plain; charset=utf-8`.

  **What changes.** Exactly one header value, on the responses the framework types for you: `ctx.send()`
  with a string or primitive, and the `text/plain` body `ctx.redirect()` sends by default. It is the
  same value on every adapter, including Node's native response path, so cross-adapter output stays
  byte-identical to itself.

  **Why.** Deno's `Response` constructor has a static fast path for a small set of exact literals.
  `text/plain;charset=UTF-8` is one of them; the conventional `text/plain; charset=utf-8` spelling is
  not, and pays for header-list validation plus a native re-map on every response. Priced in isolation
  on Deno 2.9.7, constructing the response costs **612 ns with the old spelling and 197 ns with this
  one**. `application/json` is corrected in the pending JSON media-type changeset for the same reason;
  `text/plain` was the remaining common media type outside the fast path.

  **Migration.** Applications that _parse_ the media type are unaffected. RFC 9110 §5.6.1 makes the
  whitespace around `;` insignificant, and the charset value was already case-insensitive, so this is
  the same media type — not a new one. Only an **exact-string** comparison needs updating:

  ```diff
  - expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
  + expect(res.headers.get('content-type')).toBe('text/plain;charset=UTF-8');
  ```

  One assertion update covers every adapter, because they all emit the same value.

  **What does not change.** The status, the body bytes, `Content-Length`, the header set and ordering,
  multi-value `Set-Cookie`, `application/json`, `text/html`, the redirect status and `Location`, and
  `ctx.stream()`/SSE/NDJSON defaults (the stream package sets its own media types and is untouched).
  Request parsing, routing, middleware ordering, `ctx.next()`, body limits, raw-body bytes, UTF-8
  handling, response commitment, caching, streaming, timeouts, and error mapping are all untouched.
  `text/html` keeps the conventional spelling deliberately: it has no fast path to enter (measured 622
  vs 602 ns on Deno — noise), so changing it would be wire churn with nothing behind it.

  **Why the bump is minor, not major.** Semantically the two spellings are the same media type, so no
  client that parses `Content-Type` can observe a difference. The bump signals a wire-visible byte
  change in case a consumer asserts the exact string — the same class of change as the pending
  `application/json` one, which is also classified as a minor: it removes a parameter, but no client
  that parses the media type can observe that, and only an exact-string assertion needs updating.

  **Measured.** Deno text workload, paired A/B on server CPU per request: median **−2.3 %** over 7
  pairs (mean −4.3 %, 5/7 pairs faster), consistent with the −415 ns at the `Response` boundary.
  Bun neutral (median +0.1 %, 2/4) and Node neutral (+0.8 %, 1/2) — neither has a matching fast path,
  and neither is expected to move. Full numbers, harness, and the rejected alternatives are in
  `report/performance/campaign-scoreboard.md` §9.

### Patch Changes

- [#61](https://github.com/0xTanzim/nextRush/pull/61) [`23e927a`](https://github.com/0xTanzim/nextRush/commit/23e927ae3d41b655da6e6862272356df7a2d481f) Thanks [@0xTanzim](https://github.com/0xTanzim)! - A handler built before the application booted now boots it, instead of dispatching against an empty stack.

  **A `createHandler`-only entry point routes.** `Bun.serve({ fetch: createHandler(app) })`,
  `Deno.serve({ handler: createHandler(app) })`, and `http.createServer(createHandler(app))` are the
  documented forms for a runtime that owns its own server, and none of them has a startup phase to
  await `app.ready()` in. The handler now boots the application on the first request, so declared
  routes and extension-registered middleware are present and an unknown path is a `404` rather than
  an empty `200`.

  The failure this replaces was silent, and that was the worst part of it: the handler composed the
  middleware stack as it stood at construction, so an application's own router — mounted only by
  `ready()` — was simply absent. Every declared route fell through to the finalizer's empty `200`,
  with nothing logged and nothing thrown. `serve()`/`listen()` were unaffected because they boot
  before building a handler.

  The boot barrier is shared: `@nextrush/runtime` exports `createBootGate(app, { label, markRunning })`
  returning `{ handler, ensure() }`. `handler` is resolved synchronously for an application that was
  already booted, so an entry point with an eager startup phase keeps exactly its previous timing, and
  a request in steady state reads `handler` with no promise hop at all. Concurrent first requests share
  one boot; a failed boot clears its memo so the next request retries rather than serving every later
  request from a poisoned barrier.

  `Application.callback()` now fails fast when the application owns a router that boot has not yet
  mounted, naming the router and listing the ways to boot (`listen`, `serve`, `createHandler`). The
  check is deliberately narrow: it fires only when the application has a router, so a bare
  `createApp()` — which has none — is unaffected.

  The boot-reuse warning (a second, different `Application` booting in the same process or isolate)
  moved into the shared gate, so every adapter emits it with its own label. Edge no longer keeps that
  bookkeeping in its own module; the diagnostic behaviour and its cross-platform message are unchanged
  apart from naming the adapter instead of listing each edge factory.

- [#61](https://github.com/0xTanzim/nextRush/pull/61) [`57d4713`](https://github.com/0xTanzim/nextRush/commit/57d4713e607d071112db9250c9e6e7984214fc15) Thanks [@0xTanzim](https://github.com/0xTanzim)! - **A dot segment is rejected in every spelling, and the path a Web adapter publishes is no longer
  reshaped by a `URL` parser.**

  `GET /files/%2e%2e/admin` was matched literally: `canonicalizePath()` treats `%2e` as three ordinary
  characters, so that traversal spelling slipped past the rejection the literal `/files/../admin`
  already received and was routed (or answered `404`) instead of `400`. Every percent-encoded dot
  spelling — `%2e`, `%2E`, mixed case, either end of a segment — is now a dot segment, decided in one
  linear scan as the path is canonicalized. A name that merely _contains_ a dot is still not a segment:
  `..hidden`, `archive.tar.gz`, and `%252e%252e` (a double-encoded dot, which is a literal `%` to every
  parser in the chain) all route as before.

  The Web context also stops deriving `ctx.path` through `new URL()`. That call parsed, percent-encoded,
  and **resolved dot segments**, so on Deno — which hands the request target over unparsed — a target of
  `/files/../admin` became `/admin` and dispatched to a route the client never named, while Node
  rejected the same target with `400`. The two now agree: the published path is the bytes the platform
  delivered, with no decoding and no resolution, and a request that names a traversal is rejected on
  both.

  One consequence is worth stating plainly: a target whose bytes `URL.pathname` would percent-encode (a
  non-ASCII character, a space, `"`, `<`, `` ` ``, `{`, `}`) is now published **as delivered** rather
  than re-encoded. Re-encoding would publish a form the client never sent and then match routes and
  mounts against it — the same class of reshaping as resolving a segment.

  **The platform decides first, and now says so.** Whether a dot segment survives to the application at
  all belongs to the HTTP front end: `Bun.serve`, the edge isolates, and the serverless event mapping
  parse the target into a `URL` before any framework code runs, so the original bytes are already gone
  and the rejection cannot fire there. That fact is now a capability —
  `RuntimeCapabilities.rawRequestTarget`, `true` on Node and Deno, `false` on the parsing platforms and
  wherever it cannot be proven — and the adapter conformance suite derives its expectation from it over
  a real socket instead of asserting one answer for every runtime. Nothing in the request path branches
  on the flag.

  `RuntimeCapabilities` gained a required property, so code that constructs one must include it; reading
  it is unchanged. The behavior, the per-platform matrix, and where to enforce a path ACL are documented
  in the security guide and on each adapter page.

- [#63](https://github.com/0xTanzim/nextRush/pull/63) [`fbb8b93`](https://github.com/0xTanzim/nextRush/commit/fbb8b93fed819bea9ae6bcb3907b54f7b84fa8ee) Thanks [@0xTanzim](https://github.com/0xTanzim)! - **A request whose handler never reads `ctx.query` no longer pays to parse it.**

  `WebContextBase` (Bun/Deno/Edge) and `NodeContext` parsed the query string in the constructor,
  before any handler could ask for it. Many query-bearing requests never read the bag, and middleware
  that does read it (logging, validation) is enabled per app rather than per request. The parse is now
  deferred to the first read of `ctx.query` and memoized: a request that reads the bag performs
  exactly the parse it performed before, and one that never reads it performs none. A query-less
  context still returns the shared frozen empty bag on first read.

  Measured same-process, paired and order-flipped, server CPU per request (negative is faster):

  | Workload                                      |      Change | Pairs |
  | --------------------------------------------- | ----------: | ----: |
  | Bun full request, `?limit=10&offset=0` unread | **−947 ns** |   9/9 |
  | Node context, query unread                    | **−720 ns** |   9/9 |
  | Deno full request, query unread               | **−816 ns** |   9/9 |
  | Bun request, query read                       |     −105 ns |   5/9 |
  | Node context, query read                      |      −24 ns |   6/9 |

  The query-less control arm moved −11 ns on Bun (6/9) and +10 ns on Node (2/9), inside each run's
  noise. Values, decoding, the 256-parameter/2048-character limits, denied keys and the shared frozen
  empty bag are byte-identical to the eager implementation across a 25-target differential corpus on
  both context classes.

  `ctx.query` keeps its typed read-only contract, exposes the same memoized bag on every read, and is
  now a prototype accessor instead of an own data property; assigning to it was outside that contract.

- [#63](https://github.com/0xTanzim/nextRush/pull/63) [`d21a453`](https://github.com/0xTanzim/nextRush/commit/d21a4534d4e352617ad2e9e3ff06907926342c9e) Thanks [@0xTanzim](https://github.com/0xTanzim)! - **A request that declares a non-empty body arms its handler deadline immediately instead of
  spinning four microtask turns first; a bodyless request keeps the window.**

  **Why the window was there, and why it no longer helps this shape.** The Web runner gives a dispatch
  a bounded number of microtask turns (`SETTLE_TURNS = 4`) before registering a deadline, so a handler
  that settles quickly never pays for the shared timer. A body read cannot settle inside that window:
  it waits on I/O, which is a macrotask on every supported runtime. The turns therefore only delay the
  deadline arm; they cannot avoid it. With one shared deadline timer the trade has flipped — register
  plus cancel costs about 0.2–0.3 µs, while four turns cost about 1.5 µs of server CPU on a POST on the
  wire. The window was measured when every request armed its own timer, and its cost was justified
  then; that premise no longer holds for body-bearing requests.

  **What changes.** `WebContextBase` now exposes `ctx.bodyLength` — the `content-length` the body
  source already parses — and `createWebRunner` passes it through the new `settleTurnsFor()` helper:
  a declared, non-empty body means zero turns, anything else keeps `SETTLE_TURNS`. Asking
  `request.body` for the same answer would initialise the body stream and cost more than the window
  saves (measured: about +0.6–0.8 µs on Bun before the body is read). A POST that declares
  `content-length: 0`, a chunked body with no declared length, and every bodyless method keep the
  window. `timeout: 0` still disables the race entirely.

  **Compatibility.** `bodyLength` is additive: a `readonly number | undefined` on `WebContextBase`
  and an optional member of `WebRunnerContext`. Timeout semantics are unchanged — 504 when nothing was
  committed, a committed response still wins, and a settled dispatch still cancels its deadline. The
  only observable difference is that a body-bearing request's timeout clock starts at dispatch rather
  than after four microtask turns (microseconds earlier, on a window measured in seconds). The Node
  adapter is untouched: it owns a callback runner with per-request timers, so arming remains the
  expensive outcome there and it keeps the window for every request.

  **Measured (Bun 1.4.3, JSON POST 1 KB through `bodyParser`, `wrk -t2 -c64`, server pinned, CPU per
  request from `/proc/<pid>/stat`, 5 interleaved rounds).** Paired median **−2.7 % server CPU per
  request (4/5 pairs)** against the same bundle with `SETTLE_TURNS = 4`; level medians 28.08 → 26.47 µs,
  and 27.05 → 25.51 µs with 30.5 → 32.5 k rps in an earlier window (5/5). The Bun POST gap to Hono
  measured in the same run narrowed from 1.31× to **1.23×**. A GET/async shape is unchanged by construction; always-arming it
  was measured at about +3.5 % CPU, which is why the rule is shape-scoped rather than global.

- [#61](https://github.com/0xTanzim/nextRush/pull/61) [`836dd6a`](https://github.com/0xTanzim/nextRush/commit/836dd6a55312f20f2a9dbaef480f4e962e37b941) Thanks [@0xTanzim](https://github.com/0xTanzim)! - **One shared Web request runner, and no timeout timer for a handler that already settled.**

  Bun, Deno, and Edge each owned a copy of the same per-request flow — boot
  barrier, dispatch, timeout race, not-found finalize, error handling — so every
  fix to it had to be made three times. `@nextrush/runtime` now exports
  `createWebRunner`, which owns that flow once; each adapter supplies only its
  context factory (which decides how the client address is resolved) and its
  timeout policy. Next.js and serverless already route through the Edge handler,
  so they get the same runner.

  The race also stopped paying for a timer it does not need: a dispatch that
  settles within a few microtasks — the common case — is awaited without ever
  calling `setTimeout`, and a timer is armed only when the handler is still
  pending. Timeout interval, 504 body, cooperative cancellation via `ctx.signal`,
  the not-found body, and the Edge timeout warning are unchanged.

  Measured on the committed `dev-check` stages (same machine, same run, versus the
  previous commit): in-process cost 5.9 → 4.05 µs/request on Bun (-31%) and
  17.9 → 13.3 µs/request on Node (-25%), with no probe regression. Most of that
  comes from the two laziness changes in this group; the runner removes the
  triplication that made the third fix necessary.

- Updated dependencies [[`23e927a`](https://github.com/0xTanzim/nextRush/commit/23e927ae3d41b655da6e6862272356df7a2d481f), [`57d4713`](https://github.com/0xTanzim/nextRush/commit/57d4713e607d071112db9250c9e6e7984214fc15), [`9e6de5f`](https://github.com/0xTanzim/nextRush/commit/9e6de5f81b93401198138d11f6c2eaf5948502ad), [`6004c48`](https://github.com/0xTanzim/nextRush/commit/6004c482727f50cd760d4ab55d3c6b7f033e018b), [`fbb8b93`](https://github.com/0xTanzim/nextRush/commit/fbb8b93fed819bea9ae6bcb3907b54f7b84fa8ee), [`2d0f0c1`](https://github.com/0xTanzim/nextRush/commit/2d0f0c185165d50960e2c66b4a9c714d1463381b), [`4bdf830`](https://github.com/0xTanzim/nextRush/commit/4bdf8303cbeed3bf4351d035935c44d5110f8738), [`d21a453`](https://github.com/0xTanzim/nextRush/commit/d21a4534d4e352617ad2e9e3ff06907926342c9e), [`836dd6a`](https://github.com/0xTanzim/nextRush/commit/836dd6a55312f20f2a9dbaef480f4e962e37b941), [`a701579`](https://github.com/0xTanzim/nextRush/commit/a701579e7ac52bfeab8a5d8c539e07b40661e885), [`81211bc`](https://github.com/0xTanzim/nextRush/commit/81211bc61e68fe437cbcd57e313c4e22a0f9d780)]:
  - @nextrush/runtime@4.1.0
  - @nextrush/core@4.1.0
  - @nextrush/types@4.1.0
  - @nextrush/errors@4.1.0
  - @nextrush/stream@1.0.3

## 1.0.1

### Patch Changes

- [`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Prepare the NextRush v4 ecosystem patch release with updates across core, routing, adapters, middleware, utilities, OpenAPI, testing, development tooling, and the create-nextrush scaffolder.

- Updated dependencies [[`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8)]:
  - @nextrush/runtime@4.0.2
  - @nextrush/errors@4.0.2
  - @nextrush/stream@1.0.2
  - @nextrush/types@4.0.2
  - @nextrush/core@4.0.2

## 1.0.0

### Patch Changes

- [`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Consolidated patch release across all NextRush public packages.

- Updated dependencies [[`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9)]:
  - @nextrush/core@4.0.0
  - @nextrush/errors@4.0.0
  - @nextrush/runtime@4.0.0
  - @nextrush/stream@1.0.0
  - @nextrush/types@4.0.0

## 1.0.0-beta.1

### Patch Changes

- Consolidated patch release across all NextRush public packages.

- Updated dependencies []:
  - @nextrush/core@4.0.0-beta.2
  - @nextrush/errors@4.0.0-beta.2
  - @nextrush/runtime@4.0.0-beta.2
  - @nextrush/stream@1.0.0-beta.2
  - @nextrush/types@4.0.0-beta.2

## 1.0.0-beta.0

### Major Changes

- 793d596: **BREAKING**: Removed a batch of dead backward-compatibility aliases across several packages.
  Each had been superseded for at least one release and carried zero remaining internal use.

  **Adapters (`@nextrush/adapter-bun`, `-deno`, `-node`)**: removed the deprecated
  `ServeOptions.hostname` / `ServerInstance.hostname` fields. Use `host` instead — it was already
  the canonical field; `hostname` was accepted only as a fallback.

  **Adapters (`@nextrush/adapter-bun`, `-deno`, `-edge`)**: removed the `{Bun,Deno,Edge}BodySource`
  type/value aliases and their `create{Bun,Deno,Edge}BodySource` factory functions. Use
  `WebBodySource` / `createWebBodySource` from `@nextrush/runtime` — the aliases were pure
  re-exports pointing at the same implementation.

  **`@nextrush/core`**: removed the `createHttpError` alias. Use `createError` (same function,
  different name) from `@nextrush/core`, `@nextrush/errors`, or `nextrush`.

  **`@nextrush/errors`**: removed `ErrorContext` (use `Context` from `@nextrush/types`),
  `ErrorMiddleware` (use `Middleware` from `@nextrush/types`), and `catchAsync()` (it was a no-op
  wrapper — `return handler` — remove the call, your handler already works without it; async
  errors propagate to `errorHandler()` on their own).

  **`@nextrush/body-parser`**: removed the Node-stream fallback path — `BodyParserContext.raw`,
  the `RequestStream` interface, and the `BodyParserMiddleware` type alias (use `Middleware` from
  `@nextrush/types`). Body parsing now requires `ctx.bodySource`, which every current adapter
  (Node, Bun, Deno, Edge) already provides — this only affects a custom/third-party adapter that
  never implemented `bodySource`.

  **`@nextrush/helmet`**: removed `frameguard()`, the `frameguard` option on `helmet()`, and the
  `XFrameOptionsValue` type. `X-Frame-Options` is superseded by the Content-Security-Policy
  `frame-ancestors` directive, which every modern browser honors. Replace
  `helmet({ frameguard: 'DENY' })` with
  `helmet({ contentSecurityPolicy: { directives: { 'frame-ancestors': ["'none'"] } } })` (or
  `["'self'"]` for the `SAMEORIGIN` equivalent).

  **`@nextrush/cors`**: removed the `CorsMiddleware` type alias (confirmed zero real usage anywhere
  in this repo). Use `Middleware` from `@nextrush/types`.

  **`nextrush`** (meta package): re-exported `catchAsync` — bumped as a consequence of the
  `@nextrush/errors` removal above. `@nextrush/class` bumped patch since it re-exports
  `@nextrush/di` symbols that are unaffected, included only because its own test suite exercises
  `@nextrush/core`'s error re-exports.

  No migration tooling is provided for this batch — every replacement is a one-line rename or
  import-path swap (`frameguard` is the one exception, needing a CSP directive instead of a
  function call; see the table in
  [the upgrade guide](https://github.com/0xTanzim/nextRush/blob/main/apps/website/content/docs/migrate/upgrade-guide.mdx)
  for the full old → new mapping).

### Patch Changes

- eee4462: Reliability hardening: bounded teardown, deterministic streaming, and cross-runtime request-timeout
  parity.

  A reliability audit (`report/reliability/reliability-framework-review.md`) found three failure
  paths that only surface in multi-week, streaming-heavy production runs. All fixes are additive or
  observable-behavior-only; no existing public signature is removed or narrowed.

  **`@nextrush/core`**
  - `Application.close(options?: { timeout?: number })` — bounds total teardown time. Omitting
    `timeout` is byte-identical to today's unbounded behavior. A teardown unit that doesn't finish in
    time is reported as a `TeardownTimeoutError` (exported) in the returned `Error[]`, naming which
    unit timed out, instead of hanging `close()` indefinitely.
  - `Application.onClose(hook)` — new teardown-registration API for subsystems outside the extension
    system (stateful middleware, long-lived services). Runs under the same bounded, per-hook-isolated
    guarantee as extension `destroy()`, reverse of registration order.
  - `Application.isDraining` — new getter, `true` from the moment `close()` begins until teardown
    completes. Shutdown start and any teardown failure/timeout are now logged via `app.logger`.

  **`@nextrush/class`** — a throwing `onShutdown()` service hook no longer strands every later
  service's teardown; each hook is now isolated (errors collected into an `AggregateError`).

  **`@nextrush/adapter-node`**
  - Streaming responses (`ctx.sse`/`ctx.stream`/`ctx.ndjson`/`ctx.sendStream`) now settle
    deterministically when the client disconnects while backpressured — previously the handler's
    promise could hang forever, stranding any `finally` cleanup after the stream call.
  - Graceful drain now releases idle keep-alive connections at drain start (`server
.closeIdleConnections()`) instead of only at the force-close timeout, and advertises `Connection:
close` on responses completed while draining — both reduce shutdown latency.
  - `drainAndClose` now passes `shutdownTimeout` as the teardown budget to `app.close()`, bounding
    the whole shutdown, not just the socket drain.
  - The request-abort-detection path no longer uses the deprecated `req.on('aborted')` event.
  - A body read that is interrupted by a client disconnect now rejects with a typed
    `RequestAbortedError` (from `@nextrush/runtime`) instead of a generic `Error`.
  - A response that completes without an explicit `Content-Type` now always gets one.

  **`@nextrush/adapter-bun` / `@nextrush/adapter-deno`** — `close()` now passes the same teardown
  budget into `app.close()`, so a hung extension teardown can no longer hang shutdown past
  `shutdownTimeout` on these runtimes either.

  **`@nextrush/runtime`**
  - New `RequestAbortedError` export (a `BadRequestError` subclass) — the typed client-abort
    condition used by the Node adapter's body-read path.
  - New `deriveDeadlineSignal(parentSignal, ms)` export — derives a child `AbortSignal` that aborts
    when either `ms` elapses or the parent signal aborts, for per-operation deadlines built on
    `ctx.signal`.

  **`@nextrush/websocket`**
  - The heartbeat interval is now `unref()`'d, so a missed disposal no longer keeps the process alive
    after an otherwise-complete graceful shutdown.
  - New `createWebSocketExtension()` export — offers the WebSocket server as a self-disposing
    `Extension` (`app.extend(createWebSocketExtension())`), whose `destroy()` calls `wss.close()` on
    `app.close()`. The existing `createWebSocket()` factory is unchanged, for manual/advanced attach.

  **`@nextrush/health`** — `CheckFn` now optionally receives an `AbortSignal` that aborts when the
  check exceeds `checkTimeoutMs`, so a cooperative check can cancel its in-flight work instead of
  leaking an orphaned operation on every probe. Existing signal-less checks are unaffected.

  **`@nextrush/rate-limit`** — `rateLimit()` accepts an optional `app` field; when provided (and no
  custom `store` is supplied), the default in-memory store's cleanup interval is registered via
  `app.onClose` for deterministic disposal, instead of relying solely on its `unref()`'d interval.

  None of the above changes default behavior for an application that does not opt into the new
  options — `timeout`/`onClose`/`createWebSocketExtension`/the health `signal` parameter are all
  additive. The Node adapter's streaming-disconnect fix, idle-drain release, and `Content-Type`/typed-
  abort corrections are observable-behavior fixes on paths that were previously incorrect, not new
  opt-in surfaces.

- Updated dependencies [2820a4c]
- Updated dependencies [eee4462]
- Updated dependencies [793d596]
- Updated dependencies [838367f]
  - @nextrush/types@4.0.0-beta.0
  - @nextrush/core@4.0.0-beta.0
  - @nextrush/runtime@4.0.0-beta.0
  - @nextrush/errors@4.0.0-beta.0
  - @nextrush/stream@4.0.0-beta.0

## 3.1.0

### Major Changes

- d7eb075: Extension Model — replace the plugin system with Composition-First (RFC-NEXTRUSH-PLUGIN-SYSTEM).

  **Breaking changes**
  - **Removed the plugin system.** `Plugin`, `PluginWithHooks`, `PluginMeta`, `PluginFactory`, `ApplicationLike`, `app.plugin()`, `app.pluginAsync()`, `app.getPlugin()`, `app.hasPlugin()`, and the deprecated `app.onError()` setter are gone.
  - **New `Extension` contract** (`@nextrush/types`): `{ name, needs?, setup(ctx), destroy? }`, registered via `app.extend()` and booted at `app.ready()` (a deferred boot barrier that adapters call automatically before serving — eliminating the un-awaited-async-plugin race). Extensions decorate the app via the extension-only `ctx.decorate()`; `app.hasDecorator()` is the public read side. Error handling: use `app.setErrorHandler()`.
  - **App-owned router.** `Application` accepts `{ router }`; `app.get/post/put/patch/delete/head/all` delegate to it and it mounts last at `ready()`. `nextrush`'s `createApp()` injects a default router (batteries-included); `@nextrush/core`'s `createApp()` is bring-your-own-router. (No `app.options()` verb — it collides with the config property; use `app.all()`/CORS for OPTIONS.)
  - **Per-app DI container.** The container contract moved to `@nextrush/types` (`Container`); `@nextrush/di` re-exports it (the previous `ContainerInterface` alias has been removed — use `Container` directly). Each app owns its container (`app.container`, `createApp({ container })`), exposed to extensions via `ExtensionContext.container`.
  - **Package reclassification:** `@nextrush/events` → an Extension (`events()`); `@nextrush/openapi` → middleware (`app.use(openapi({ router }))`); `@nextrush/template` → middleware only (`templatePlugin()` removed); `@nextrush/controllers` → `registerControllers(app, options)` registrar (`ControllersPlugin`/`controllersPlugin` removed, `ControllersPluginOptions` → `ControllersOptions`). Adapter `serve()`/`listen()` are now async on Bun and Deno.

  See `docs/guides/migration-extension-model.md` for a full before/after guide.

### Patch Changes

- Updated dependencies [d7eb075]
- Updated dependencies [0e2b399]
- Updated dependencies [32a0db6]
  - @nextrush/types@3.1.0
  - @nextrush/core@3.1.0
  - @nextrush/errors@3.1.0
  - @nextrush/runtime@3.1.0
  - @nextrush/stream@3.1.0

## 3.0.5

### Patch Changes

- [#21](https://github.com/0xTanzim/nextRush/pull/21) [`1f97078`](https://github.com/0xTanzim/nextRush/commit/1f970782653a9454e3a67e7ac004cb40dd791ae5) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Stable **3.0.4**: **`@nextrush/di`** clears resolution tracking on **`container.reset()`** and runs Vitest test files sequentially (`fileParallelism: false`) so the global singleton container is not stressed by parallel test files—fixes flaky / hung circular-dependency tests in CI and locally. Unified semver and docs/wiki surfaces updated to **3.0.4**.

- Updated dependencies [[`1f97078`](https://github.com/0xTanzim/nextRush/commit/1f970782653a9454e3a67e7ac004cb40dd791ae5)]:
  - @nextrush/errors@3.0.5
  - @nextrush/runtime@3.0.5
  - @nextrush/types@3.0.5
  - @nextrush/core@3.0.5

## 3.0.4

### Patch Changes

- Stable **3.0.4**: **`@nextrush/di`** clears resolution tracking on **`container.reset()`** and runs Vitest test files sequentially (`fileParallelism: false`) so the global singleton container is not stressed by parallel test files—fixes flaky / hung circular-dependency tests in CI and locally. Unified semver and docs/wiki surfaces updated to **3.0.4**.

- Updated dependencies []:
  - @nextrush/errors@3.0.4
  - @nextrush/runtime@3.0.4
  - @nextrush/types@3.0.4
  - @nextrush/core@3.0.4

## 3.0.3

### Patch Changes

- Patch **3.0.3**: **`nextrush`** ships the **`nextrush`** CLI via **`@nextrush/dev`**; **`@nextrush/dev`** skips false-positive decorator `tsconfig` warnings on functional scaffolds; **`create-nextrush`** / docs / plugin metadata aligned to **3.0.3**.

- Updated dependencies []:
  - @nextrush/errors@3.0.3
  - @nextrush/runtime@3.0.3
  - @nextrush/types@3.0.3
  - @nextrush/core@3.0.3

## 3.0.1

### Patch Changes

- [#15](https://github.com/0xTanzim/nextRush/pull/15) [`6c37c2f`](https://github.com/0xTanzim/nextRush/commit/6c37c2f1a60c24eda5fba50c7543627104fb776c) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Sync package metadata and documentation URLs, and ensure package-level homepage/readme publishing metadata is consistent across released packages.

- Updated dependencies []:
  - @nextrush/types@3.0.1
  - @nextrush/errors@3.0.1
  - @nextrush/core@3.0.1
  - @nextrush/runtime@3.0.1

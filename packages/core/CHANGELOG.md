# @nextrush/core

## 4.1.0

### Minor Changes

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

- [#61](https://github.com/0xTanzim/nextRush/pull/61) [`9e6de5f`](https://github.com/0xTanzim/nextRush/commit/9e6de5f81b93401198138d11f6c2eaf5948502ad) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Error bodies are now a stable, runtime-independent contract, and an unparsed `Content-Type` is an
  explicit choice instead of a silent fallthrough.

  **A client error keeps its own code.** `{"code":"INTERNAL_ERROR","status":400}` was what a failed
  body parse sent: a 4xx that read to the client like a server fault, so nothing could branch on the
  failure. A non-`NextRushError` now reports the code it carries, or its status's canonical code when
  it carries none:

  | Error                                   | Body before                              | Body now               |
  | --------------------------------------- | ---------------------------------------- | ---------------------- |
  | `BodyParserError` (`INVALID_JSON`, 400) | `code: 'INTERNAL_ERROR'`                 | `code: 'INVALID_JSON'` |
  | A plain error with `status: 404`        | `code: 'INTERNAL_ERROR'`                 | `code: 'NOT_FOUND'`    |
  | Any 5xx                                 | `code: 'INTERNAL_ERROR'`, masked message | unchanged              |

  Every 5xx body is byte-for-byte what it was — the code and message of an internal failure still
  never reach the client. `@nextrush/errors` exports the derivation both error responses now call,
  `resolveErrorCode(error, status)`, so `app`'s default error response and `errorHandler()` cannot
  drift apart. `errorHandler()` also now reads a plain error's `status` (via the existing
  `getErrorStatus()`) instead of always reporting `500`, which is what made the two surfaces agree.

  **Failure messages are framework constants.** `@nextrush/body-parser` put the JS engine's own parse
  text in the response — `"Invalid JSON: Expected property name or '}' in JSON at position 1"` — which
  differs per runtime for the same bytes, so the body was a function of where the code ran. Every
  response-visible message is now fixed (`'Invalid JSON'`, `'Invalid URL-encoded body'`, `'Error
reading request body'`), and the engine's text is retained as a **non-enumerable**
  `BodyParserError.cause` for server-side logging. It never appears in `toJSON()`, in
  `JSON.stringify(error)`, or in any response. If you matched on a message, read `error.code` or
  `error.cause` instead.

  **`onUnsupportedContentType`.** A `POST` whose `Content-Type` matches no configured parser used to
  answer `200` with `ctx.body === undefined`, so the client's eventual error was whatever validation
  said about a missing field. `bodyParser()` now takes an explicit policy:

  ```ts
  app.use(bodyParser({ onUnsupportedContentType: 'reject' }));
  ```

  `'ignore'` is the default and preserves today's behaviour exactly. `'reject'` answers `415` naming
  the content type **before any handler runs**. Use `'reject'` for a JSON API: the wrong media type is
  the failure, and it should be reported as one. A bodyless method and a request with no
  `Content-Type` at all are never rejected under either policy; `multipart/*` rejects under both, as
  it always has.

  > **Planned for the next major:** the default becomes `'reject'`. Silently accepting an unparsed
  > body is the wrong default for the APIs this package exists to build, but flipping it now would
  > turn previously-accepted requests into errors without a version to carry the change, so it is
  > scheduled rather than shipped. Set the option explicitly to have the future behaviour today.

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

- [#61](https://github.com/0xTanzim/nextRush/pull/61) [`2d0f0c1`](https://github.com/0xTanzim/nextRush/commit/2d0f0c185165d50960e2c66b4a9c714d1463381b) Thanks [@0xTanzim](https://github.com/0xTanzim)! - A request is now always answered, and a body is serialized before it is committed.

  **Nothing can leave a request unanswered.** When the error path itself fails to produce a response,
  the framework answers instead of leaving the socket open. This covers a custom error handler that
  completes without writing (it returned early, or took a path that forgot to respond), an error
  handler that throws while writing, and a handler that set an error status and wrote no body at all:

  | What happened                                         | Body sent now                                   |
  | ----------------------------------------------------- | ----------------------------------------------- |
  | A handler throws and `setErrorHandler` writes nothing | `500` + the default JSON error body             |
  | `setErrorHandler` throws while writing                | `500` + the default JSON error body             |
  | A handler sets an error status and writes nothing     | that status + `{ "error": "<status message>" }` |
  | A handler responds with a success status and no body  | unchanged — the documented empty response       |

  The guarantee holds at three layers — the application error path (`@nextrush/core`), each adapter's
  response finalizer, and the shared Web response builder (`@nextrush/runtime`) — precisely so no
  configuration and no handler bug can reach the client as a hanging request. Previously a custom
  error handler that returned without responding ended the request with whatever status the handler
  had set and an empty body; a handler could also be answered by an adapter finalizer before its own
  error path ran.

  **A body is serialized before the response is marked sent.** `ctx.json()` (and the object branch of
  `ctx.send()`) no longer flips the responded flag before calling `JSON.stringify`. A value JSON has
  no representation for — a `BigInt`, a circular structure, a function, a `Symbol`, or a top-level
  `undefined` — now throws a `TypeError` naming the value class with the response still unwritten, so
  the error path above answers it with a `500`. On Node this was the difference between a `500` and a
  socket that received no bytes at all; on Bun, Deno, and Edge it was the difference between a `500`
  and an empty `200` carrying a success status. A value that serializes to `undefined` is rejected
  the same way instead of producing an empty body.

  Adapters no longer distinguish a body method's failure from a handler's: both are answered. Code
  that currently swallows a serialization failure and sends its own fallback should keep doing that —
  the framework guarantee only applies once nothing has written.

  `@nextrush/runtime` additionally exports the pieces both families now share:
  `serializeJson()`, `prepareBody()`, `PreparedBody`, `measureBodyLength()`,
  `unansweredErrorBody()`, and `LAST_RESORT_ERROR_STATUS`. `assertHeaderSafe()` and
  `isBodylessResponse()` moved to a `header-guards` module with no change to their behavior or to
  their public export path. The response-body classification moved out of the Web response builder,
  so a body is resolved by a pure function and committed afterwards.

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

### Patch Changes

- Updated dependencies [[`57d4713`](https://github.com/0xTanzim/nextRush/commit/57d4713e607d071112db9250c9e6e7984214fc15), [`9e6de5f`](https://github.com/0xTanzim/nextRush/commit/9e6de5f81b93401198138d11f6c2eaf5948502ad), [`6004c48`](https://github.com/0xTanzim/nextRush/commit/6004c482727f50cd760d4ab55d3c6b7f033e018b), [`4bdf830`](https://github.com/0xTanzim/nextRush/commit/4bdf8303cbeed3bf4351d035935c44d5110f8738), [`a701579`](https://github.com/0xTanzim/nextRush/commit/a701579e7ac52bfeab8a5d8c539e07b40661e885)]:
  - @nextrush/types@4.1.0
  - @nextrush/errors@4.1.0

## 4.0.2

### Patch Changes

- [`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Prepare the NextRush v4 ecosystem patch release with updates across core, routing, adapters, middleware, utilities, OpenAPI, testing, development tooling, and the create-nextrush scaffolder.

- Updated dependencies [[`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8)]:
  - @nextrush/errors@4.0.2
  - @nextrush/types@4.0.2

## 4.0.1

### Patch Changes

- Updated dependencies []:
  - @nextrush/types@4.0.1
  - @nextrush/errors@4.0.1

## 4.0.0

### Patch Changes

- [`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Consolidated patch release across all NextRush public packages.

- Updated dependencies [[`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9)]:
  - @nextrush/errors@4.0.0
  - @nextrush/types@4.0.0

## 4.0.0-beta.2

### Patch Changes

- Consolidated patch release across all NextRush public packages.

- Updated dependencies []:
  - @nextrush/errors@4.0.0-beta.2
  - @nextrush/types@4.0.0-beta.2

## 4.0.0-beta.1

### Patch Changes

- Updated dependencies [[`207dbca`](https://github.com/0xTanzim/nextRush/commit/207dbca2ee20a0ce7a00fe6ee14615bbb56562a2)]:
  - @nextrush/types@4.0.0-beta.1
  - @nextrush/errors@4.0.0-beta.1

## 4.0.0-beta.0

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

### Minor Changes

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

### Patch Changes

- Updated dependencies [2820a4c]
- Updated dependencies [793d596]
- Updated dependencies [838367f]
  - @nextrush/types@4.0.0-beta.0
  - @nextrush/errors@4.0.0-beta.0

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
  - @nextrush/errors@3.1.0

## 3.0.7

### Patch Changes

- [#26](https://github.com/0xTanzim/nextRush/pull/26) [`c9723dd`](https://github.com/0xTanzim/nextRush/commit/c9723ddb29e4bf834625f294eadb0c9e1c28432e) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Simplify template code and auto-install dev package

- Updated dependencies []:
  - @nextrush/types@3.0.7
  - @nextrush/errors@3.0.7

## 3.0.6

### Patch Changes

- Updated dependencies []:
  - @nextrush/types@3.0.6
  - @nextrush/errors@3.0.6

## 3.0.5

### Patch Changes

- Updated dependencies [[`1f97078`](https://github.com/0xTanzim/nextRush/commit/1f970782653a9454e3a67e7ac004cb40dd791ae5)]:
  - @nextrush/errors@3.0.5
  - @nextrush/types@3.0.5

## 3.0.4

### Patch Changes

- Updated dependencies []:
  - @nextrush/errors@3.0.4
  - @nextrush/types@3.0.4

## 3.0.3

### Patch Changes

- Updated dependencies []:
  - @nextrush/errors@3.0.3
  - @nextrush/types@3.0.3

## 3.0.1

### Patch Changes

- Updated dependencies []:
  - @nextrush/types@3.0.1
  - @nextrush/errors@3.0.1

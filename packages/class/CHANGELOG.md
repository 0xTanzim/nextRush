# @nextrush/class

## 1.0.0-beta.0

### Major Changes

- 4231f6e: **BREAKING**: `nextrush`'s functional install no longer carries the class/DI stack, and
  `@nextrush/class`'s `RouteMetadata` type is renamed to `ControllerRouteMetadata`.

  **`nextrush`** (meta package): `@nextrush/class`, `@nextrush/di`, and `reflect-metadata` moved
  from `dependencies` to **optional `peerDependencies`**. A functional-only `pnpm add nextrush`
  no longer resolves the class runtime, the DI container, `tsyringe`, or `reflect-metadata` —
  closing the gap between the framework's "install only what you need" promise and what it
  actually shipped (see `report/framework/framework-composition-review.md`, F-01).

  **Migration:** if your project uses `nextrush/class` (decorators, DI, controllers), add the
  peer explicitly:

  ```bash
  pnpm add @nextrush/class reflect-metadata
  ```

  If you never install it, importing `nextrush/class` now fails with an actionable message
  naming the exact install command rather than an opaque module-resolution error. Projects
  scaffolded by `create-nextrush`'s **class-based** or **full** templates already add
  `@nextrush/class` for you — no action needed there.

  **`@nextrush/class`**: the decorator-storage interface `RouteMetadata` is renamed to
  `ControllerRouteMetadata`, reserving the name `RouteMetadata` for the single, unrelated,
  renderer-facing contract in `@nextrush/types` (re-exported via `nextrush`'s `.` entry). The two
  types had collided under one name with structurally incompatible shapes (F-02).

  **Migration:**

  ```ts
  // Before
  import type { RouteMetadata } from 'nextrush/class';

  // After
  import type { ControllerRouteMetadata } from 'nextrush/class';
  ```

  A `@deprecated` `RouteMetadata` alias for `ControllerRouteMetadata` ships in `nextrush/class`
  for this release only — it will be removed in the next major.

  **`create-nextrush`** (minor): the class-based and full templates now add `@nextrush/class`
  explicitly to the generated `package.json` (previously relied on it being a free transitive
  dependency of `nextrush`, which is no longer true after the change above).

  See `docs/guides/migration-framework-composition.md` for the full before/after guide and
  `docs/RFC/framework-composition/020-framework-composition-integrity.md` for the rationale.

- 7a05218: **BREAKING**: Removed `@nextrush/controllers` and `@nextrush/decorators`.

  Both packages were pure compatibility shims — every export was a straight re-export from
  `@nextrush/class` (six DI symbols in `@nextrush/controllers` re-exported from `@nextrush/di`
  instead, with an identical end result). Neither package contained any logic of its own. A
  repo-wide sweep found zero internal consumers, and the migration tooling this removal depends on
  already existed and was already tested from the earlier class-consolidation effort.

  **Migration:**

  ```bash
  nextrush codemod consolidate-imports "src/**/*.ts"
  ```

  This automated codemod rewrites imports from either removed package into a single merged
  `nextrush/class` import, preserving `import type` and aliases, and is idempotent. Or migrate
  manually:

  ```diff
  - import { Controller, Get, UseGuard } from '@nextrush/decorators';
  - import { registerControllers } from '@nextrush/controllers';
  + import { Controller, Get, UseGuard, registerControllers } from 'nextrush/class';
  ```

  Every symbol either package re-exported remains available at its current location in
  `nextrush/class` (or `@nextrush/di` directly) — only the two old import paths are gone. See
  [Deprecations](https://github.com/0xTanzim/nextRush/blob/main/apps/website/content/docs/migrate/deprecations.mdx)
  for the complete symbol-by-symbol map.

  `nextrush` (the meta package) had `@nextrush/controllers` and `@nextrush/decorators` listed as
  direct dependencies with no code actually importing from either — both were removed from its
  `package.json`. `@nextrush/class`'s own version bumps because it is now the sole owner of the
  decorator/controller surface these two packages used to share responsibility for documenting and
  distributing, with no functional change to `@nextrush/class` itself.

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

- 70197bb: Three small papercut fixes, batched because they touch the same class/router package pair:

  - **`@nextrush/router`**: `router.ts` (918 lines) split into `matching.ts`, `match-route.ts`,
    `composition.ts`, `middleware-adapter.ts`, and `registration.ts` along its existing thematic
    seams (matching engine, sub-router composition, middleware adaptation, route registration).
    `Router`'s public shape, exported symbols, and dispatch behavior are unchanged — confirmed via
    the package's public-surface snapshot test (byte-identical before/after) and the full
    behavioral suite (212/212 passing at every extraction step, not just at the end). Purely
    internal file reorganization.

  - **`@nextrush/router` + `@nextrush/class`**: `@All()`/`app.all()` (and `router.group(...).all()`)
    now register a single ANY-method route-table entry instead of one entry per explicitly-
    enumerated HTTP method. All 7 standard verbs still match an `@All()` route identically — this
    changes only what `getRoutes()` reports for an `@All()` route (1 row instead of 7), not
    dispatch. `@nextrush/openapi`, the one in-repo consumer of `getRoutes()` found via a codebase-
    wide search, was updated in the same change: previously it silently emitted only 1 of 7
    expected operations for an `@All()` route in a generated OpenAPI spec (a real correctness bug),
    now it correctly expands an ANY-method row into one operation per standard verb. New,
    additive `RouteDefinition.isAnyMethod?: boolean` field in `@nextrush/types`.

  - **`@nextrush/class`**: `@Body()` resolving to nothing because no body-parser middleware ran now
    throws a `MissingParameterError` whose message names the likely fix (`app.use(json())`),
    instead of the same generic message used for every other missing-parameter case. Other
    parameter sources (`@Param`, `@Query`, `@Header`) are unaffected — the hint is scoped to the
    body source specifically, where "no parser ran" is the common, previously-unexplained cause.

- Updated dependencies [2820a4c]
- Updated dependencies [eee4462]
- Updated dependencies [793d596]
- Updated dependencies [838367f]
- Updated dependencies [70197bb]
  - @nextrush/types@4.0.0-beta.0
  - @nextrush/core@4.0.0-beta.0
  - @nextrush/errors@4.0.0-beta.0
  - @nextrush/router@4.0.0-beta.0
  - @nextrush/di@4.0.0-beta.0

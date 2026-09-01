# @nextrush/websocket

## 1.0.1

### Patch Changes

- [`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Prepare the NextRush v4 ecosystem patch release with updates across core, routing, adapters, middleware, utilities, OpenAPI, testing, development tooling, and the create-nextrush scaffolder.

- Updated dependencies [[`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8)]:
  - @nextrush/types@4.0.2

## 1.0.0

### Patch Changes

- [`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Consolidated patch release across all NextRush public packages.

- Updated dependencies [[`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9)]:
  - @nextrush/types@4.0.0

## 1.0.0-beta.1

### Patch Changes

- Consolidated patch release across all NextRush public packages.

- Updated dependencies []:
  - @nextrush/types@4.0.0-beta.2

## 1.0.0-beta.0

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
- Updated dependencies [838367f]
  - @nextrush/types@4.0.0-beta.0

## 3.0.6

### Patch Changes

- Updated dependencies [d7eb075]
- Updated dependencies [32a0db6]
  - @nextrush/types@3.1.0

## 3.0.5

### Patch Changes

- [#21](https://github.com/0xTanzim/nextRush/pull/21) [`1f97078`](https://github.com/0xTanzim/nextRush/commit/1f970782653a9454e3a67e7ac004cb40dd791ae5) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Stable **3.0.4**: **`@nextrush/di`** clears resolution tracking on **`container.reset()`** and runs Vitest test files sequentially (`fileParallelism: false`) so the global singleton container is not stressed by parallel test files—fixes flaky / hung circular-dependency tests in CI and locally. Unified semver and docs/wiki surfaces updated to **3.0.4**.

- Updated dependencies [[`1f97078`](https://github.com/0xTanzim/nextRush/commit/1f970782653a9454e3a67e7ac004cb40dd791ae5)]:
  - @nextrush/types@3.0.5

## 3.0.4

### Patch Changes

- Stable **3.0.4**: **`@nextrush/di`** clears resolution tracking on **`container.reset()`** and runs Vitest test files sequentially (`fileParallelism: false`) so the global singleton container is not stressed by parallel test files—fixes flaky / hung circular-dependency tests in CI and locally. Unified semver and docs/wiki surfaces updated to **3.0.4**.

- Updated dependencies []:
  - @nextrush/types@3.0.4

## 3.0.3

### Patch Changes

- Patch **3.0.3**: **`nextrush`** ships the **`nextrush`** CLI via **`@nextrush/dev`**; **`@nextrush/dev`** skips false-positive decorator `tsconfig` warnings on functional scaffolds; **`create-nextrush`** / docs / plugin metadata aligned to **3.0.3**.

- Updated dependencies []:
  - @nextrush/types@3.0.3

## 3.0.1

### Patch Changes

- [#15](https://github.com/0xTanzim/nextRush/pull/15) [`6c37c2f`](https://github.com/0xTanzim/nextRush/commit/6c37c2f1a60c24eda5fba50c7543627104fb776c) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Sync package metadata and documentation URLs, and ensure package-level homepage/readme publishing metadata is consistent across released packages.

- Updated dependencies []:
  - @nextrush/types@3.0.1

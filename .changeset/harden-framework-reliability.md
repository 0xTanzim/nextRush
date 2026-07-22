---
"@nextrush/core": minor
"@nextrush/class": patch
"@nextrush/adapter-node": minor
"@nextrush/adapter-bun": patch
"@nextrush/adapter-deno": patch
"@nextrush/runtime": minor
"@nextrush/websocket": minor
"@nextrush/health": minor
"@nextrush/rate-limit": minor
---

Reliability hardening: bounded teardown, deterministic streaming, and cross-runtime request-timeout
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

---
"@nextrush/adapter-node": minor
---

Add an opt-in `gracefulShutdown` option to `serve()`'s `ServeOptions`.

`serve()` already returned a `close()` that drains connections correctly (stop accepting new
connections, force-close after `shutdownTimeout`, then `app.close()`) — nothing wired that drain
to an OS termination signal. Setting `gracefulShutdown: true` (or `{ signals, timeout }` to
override the default `['SIGTERM', 'SIGINT']` set and/or the timeout) now installs
`process.once` handlers for the specified signals that invoke the same existing drain logic, with
zero dropped in-flight requests on a signal. The handlers are removed once shutdown completes, so
repeated `serve()`/`close()` cycles in one process (e.g. in tests) never accumulate listeners.

Fully additive and off by default — omitting the option installs no signal handler and leaves
today's behavior unchanged. New export: `GracefulShutdownOptions`.

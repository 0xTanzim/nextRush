# graceful-shutdown

## Purpose

Opt-in, signal-wired graceful shutdown for `serve()`: an optional `gracefulShutdown` field on
`ServeOptions` that wires `SIGTERM`/`SIGINT` (or a specified signal set) to the server's existing
connection-drain `close()` logic, draining in-flight requests within a configurable timeout and
removing its own handler after completing — with zero behavioral change when the option is omitted.

## Requirements

### Requirement: `serve()` supports opt-in signal-wired graceful shutdown
`serve()` SHALL accept an optional `gracefulShutdown` field on `ServeOptions` (boolean, or an
object specifying `signals` and/or `timeout`) that, when truthy, wires `SIGTERM`/`SIGINT` (or the
specified signal set) to the server's existing connection-drain `close()` logic. When the option
is omitted, no signal handler SHALL be installed — behavior identical to today.

#### Scenario: A SIGTERM triggers a clean drain when opted in
- **WHEN** `serve()` is called with `gracefulShutdown: true` and the process later receives
  `SIGTERM`
- **THEN** the server stops accepting new connections, allows in-flight requests to complete
  (up to the configured timeout), then exits — with zero dropped in-flight requests

#### Scenario: No signal handler is installed by default
- **WHEN** `serve()` is called without the `gracefulShutdown` option
- **THEN** no `SIGTERM`/`SIGINT` handler is registered, and the process's default signal
  behavior is unchanged from before this feature existed

#### Scenario: The signal set and timeout are overridable
- **WHEN** `serve()` is called with `gracefulShutdown: { signals: ['SIGTERM'], timeout: 5000 }`
- **THEN** only the specified signal(s) trigger the drain, using the specified timeout instead
  of the default

#### Scenario: The handler is removed after shutdown completes
- **WHEN** a graceful shutdown completes (drain finished, process about to exit)
- **THEN** the signal handler registered for that `serve()` call is removed, so a subsequent
  `serve()` call in the same process does not accumulate duplicate handlers

### Requirement: Application teardown is bounded by a shutdown budget
`app.close()` SHALL bound the total time spent tearing down extensions, class-service `onShutdown`
hooks, and registered close hooks by a configurable budget, and `serve()`'s drain path SHALL apply
`shutdownTimeout` to BOTH the socket drain AND the subsequent teardown, so a hung teardown cannot
hang the process past the configured budget. When the budget elapses, `app.close()` MUST resolve
(never hang), reporting which teardown(s) did not complete in time.

#### Scenario: A hung teardown does not hang the process past the budget
- **WHEN** an extension `destroy()` (or a class `onShutdown()`) never resolves and `app.close()` is
  invoked with a teardown budget
- **THEN** `app.close()` resolves within the budget and its result identifies the teardown that
  timed out

#### Scenario: The adapter drain applies the budget to teardown, not only the socket drain
- **WHEN** `serve({ shutdownTimeout })` triggers a drain and a downstream teardown hangs
- **THEN** the overall `close()` returned by `serve()` completes within a bounded multiple of
  `shutdownTimeout` rather than hanging indefinitely, so the process can exit

#### Scenario: Normal teardown completes without waiting out the budget
- **WHEN** all teardown hooks complete promptly
- **THEN** `app.close()` resolves as soon as they finish, without waiting for the budget to elapse

### Requirement: Each teardown hook runs in isolation
Every extension `destroy()`, class-service `onShutdown()`, and registered close hook SHALL run
isolated from the others: one that throws or times out MUST NOT prevent the remaining hooks from
running. Teardown errors SHALL be collected and reported (returned and/or logged), never swallowed
silently, and teardown ordering SHALL remain reverse-of-initialization.

#### Scenario: A throwing onShutdown does not strand later teardowns
- **WHEN** several services implement `onShutdown()` and the first one invoked throws
- **THEN** every remaining service's `onShutdown()` still runs, and the thrown error is collected
  and reported rather than aborting the teardown loop

#### Scenario: Teardown errors are collected, not swallowed
- **WHEN** one or more teardown hooks reject
- **THEN** `app.close()` reports the collected errors to the caller (and/or the logger) instead of
  discarding them

### Requirement: Long-lived services are disposed by the application lifecycle
A long-lived resource owned by an extension or a registered subsystem (a heartbeat interval, a
background timer, a connection pool) SHALL be released as part of `app.close()`. The application
SHALL expose a teardown-registration hook (`app.onClose(hook)`) that stateful middleware and
subsystems use to register deterministic cleanup, run under the same bounded, isolated teardown as
extension `destroy()`. Any interval or timer that outlives a single request MUST NOT, on its own,
keep the event loop alive (e.g. it is `unref()`'d), so a completed graceful shutdown allows the
process to exit.

#### Scenario: A WebSocket heartbeat is released on shutdown so the process exits
- **WHEN** a WebSocket server with an active heartbeat is used, a graceful shutdown runs to
  completion, and no other work is pending
- **THEN** the heartbeat interval is cleared as part of the app lifecycle and the process exits
  without requiring a manual, out-of-band `close()` call

#### Scenario: Stateful middleware cleanup runs on close
- **WHEN** a stateful middleware (e.g. an in-memory rate-limit store owning a cleanup interval)
  registers cleanup via `app.onClose`, and `app.close()` runs
- **THEN** its cleanup executes deterministically as part of teardown

#### Scenario: An undisposed background timer does not by itself block exit
- **WHEN** a framework-owned interval/timer that outlives a request is created
- **THEN** it is `unref()`'d, so even if a disposal path is missed it does not on its own keep the
  process alive after shutdown

### Requirement: Idle keep-alive connections are released at the start of the drain
When a graceful drain begins, the adapter SHALL close idle keep-alive connections immediately
(rather than only at the force-close timeout) and SHALL advertise connection close on responses
completed during the drain, so an idle keep-alive client does not extend the drain to the full
`shutdownTimeout`.

#### Scenario: An idle keep-alive client does not delay the drain
- **WHEN** a client holds an idle keep-alive connection and a graceful drain begins with no
  in-flight requests
- **THEN** the drain completes promptly (idle connections are closed at drain start) rather than
  waiting for the force-close timeout

#### Scenario: In-flight responses during drain advertise connection close
- **WHEN** a request completes while the server is draining
- **THEN** its response advertises `Connection: close` so the socket is not kept alive for reuse
  during shutdown

### Requirement: Shutdown progress is observable
The shutdown path SHALL surface observable lifecycle signals — at minimum a `draining` state
transition when the drain begins, and, on completion, the teardown outcome (which hooks completed,
and which failed or timed out) — through the application logger and/or an events surface, so an
operator can diagnose a slow or failed shutdown.

#### Scenario: The draining transition is observable
- **WHEN** a graceful drain begins
- **THEN** a `draining` state transition is surfaced (via the logger and/or an events surface) that
  a readiness check or operator tooling can observe

#### Scenario: A timed-out teardown is reported at completion
- **WHEN** a teardown hook times out during shutdown
- **THEN** the shutdown completion surfaces which hook timed out, rather than exiting silently

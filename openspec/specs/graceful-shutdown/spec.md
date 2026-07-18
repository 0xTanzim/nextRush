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

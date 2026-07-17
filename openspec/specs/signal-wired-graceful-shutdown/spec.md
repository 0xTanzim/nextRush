# signal-wired-graceful-shutdown Specification

## Purpose
TBD - created by archiving change add-graceful-shutdown-and-health-package. Update Purpose after archive.
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

### Requirement: `@nextrush/health` exposes liveness and readiness endpoints with a check registry
A new `@nextrush/health` middleware package SHALL expose a `/livez` endpoint (reflecting process
liveness only) and a `/readyz` endpoint (reflecting registered readiness checks), plus an API for
registering custom readiness checks at setup time.

#### Scenario: `/readyz` reflects a failing registered check
- **WHEN** a registered readiness check returns/resolves to `false` or throws
- **THEN** `/readyz` responds with `503`

#### Scenario: `/readyz` reflects all-passing checks
- **WHEN** every registered readiness check passes
- **THEN** `/readyz` responds with `200`

#### Scenario: `/livez` does not depend on registered checks
- **WHEN** one or more registered readiness checks are failing
- **THEN** `/livez` still responds with `200`, as long as the process itself can respond at all

#### Scenario: A hung check does not hang the endpoint indefinitely
- **WHEN** a registered check's promise never resolves
- **THEN** `/readyz` still responds within a bounded time, treating the timed-out check as a
  failure

#### Scenario: The package's README states its default security posture explicitly
- **WHEN** a reader consults `@nextrush/health`'s README
- **THEN** it explicitly states that `/livez`/`/readyz` are unauthenticated by default (the
  conventional cluster-internal-probe pattern) and how to restrict access if the deployment
  requires it


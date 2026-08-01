# health

## Purpose

The `@nextrush/health` middleware package: `/livez` (process liveness only) and `/readyz`
(registered readiness checks) endpoints with a check registry, bounded so a hung check cannot hang
the endpoint, and an explicitly documented unauthenticated-by-default posture. It also defines the
optional, user-wired integration with `serve()`'s graceful shutdown so a readiness check can flip
`/readyz` to `503` the moment draining begins — an integration, not a hard code dependency between
the two packages.

## Requirements

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

### Requirement: A registered readiness check may reflect an in-progress graceful shutdown
When both `serve()`'s `gracefulShutdown` option and `@nextrush/health` are used together, it
SHALL be possible for a user to register a readiness check that reflects whether the server is
currently draining, so `/readyz` can flip to `503` the moment shutdown begins rather than only
once fully drained. This SHALL be an optional integration a user wires themselves, not a hard
code dependency between the two packages.

#### Scenario: A registered draining-aware check flips readiness promptly
- **WHEN** a user registers a check that reads a shared "is draining" flag, and a graceful
  shutdown begins
- **THEN** `/readyz` responds with `503` from the moment draining starts, not only after the
  drain completes

#### Scenario: `@nextrush/health` works without `gracefulShutdown` at all
- **WHEN** `@nextrush/health` is installed and used without `serve()`'s `gracefulShutdown` option
- **THEN** `/livez` and `/readyz` function correctly using only whatever checks the user
  registered, with no error or missing dependency related to the shutdown feature

### Requirement: A timed-out readiness check receives a cancellation signal
When a registered readiness check exceeds `checkTimeoutMs`, `@nextrush/health` SHALL abort an
`AbortSignal` passed to that check, so a cooperative check can cancel its in-flight work instead of
leaking an orphaned operation on every probe. The check MUST still be treated as a failure on
timeout. The signal parameter SHALL be optional so existing checks that ignore it keep working
unchanged.

#### Scenario: A hung cooperative check is aborted on timeout
- **WHEN** a registered check reads the `AbortSignal` it is given and exceeds `checkTimeoutMs`
- **THEN** that signal is aborted at the timeout, allowing the check to cancel its in-flight work,
  and `/readyz` still reports the check as a failure

#### Scenario: Existing signalless checks keep working
- **WHEN** a registered check ignores the signal argument (the pre-existing shape)
- **THEN** it continues to function, and a timeout is still treated as a failure with the endpoint
  responding within the bounded time

#### Scenario: The abort does not leak across probes
- **WHEN** successive `/readyz` probes run the same check
- **THEN** each invocation receives its own signal, and a timed-out invocation's abort does not
  affect a later invocation

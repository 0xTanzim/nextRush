# Spec Delta — `performance-gate`

## ADDED Requirements

### Requirement: Server construction is equalized and disclosed, not just response output

The benchmark's fairness validation SHALL cover how each server is *constructed*, not only what it
responds. Response-parity checking (bodies, statuses, headers, framing) proves the servers do the
same work; it cannot prove they were given the same conditions, and every configuration asymmetry
found in this suite has lived in that blind spot.

Specifically:

- Every compared server SHALL listen with the same TCP accept-queue backlog, and the run SHALL fail
  rather than warn when they disagree.
- Every compared server's handlers for a scenario tagged like-for-like SHALL use the same
  synchronous/asynchronous shape, except where a handler genuinely awaits I/O.
- Where the benchmark **overrides** a framework's own default in order to equalize, that override
  SHALL be disclosed in the generated report — a silent override is the same class of defect as the
  hidden asymmetry it replaces.
- Any asymmetry that cannot be removed without producing an unrepresentative server SHALL be
  documented per-server in the report rather than left implicit.

#### Scenario: Disagreeing accept-queue backlogs fail the run

- **WHEN** the fairness validation runs and two compared servers listen with different backlogs
- **THEN** validation fails with a message naming the servers and their differing values, in the
  same way a `Content-Length`/`Transfer-Encoding` framing disagreement already fails it

#### Scenario: The report discloses per-server configuration

- **WHEN** a benchmark report is generated
- **THEN** it states, per server, the accept-queue backlog and whether that server's like-for-like
  handlers are synchronous or asynchronous, so a configuration skew is visible without reading the
  server sources

#### Scenario: A benchmark-applied override is stated as an override

- **WHEN** the harness sets a value on a competitor server that differs from that framework's own
  default in order to match another server
- **THEN** the report identifies it as a harness-applied override rather than presenting it as the
  framework's native behavior

### Requirement: A throughput conclusion states whether the servers were saturated

A throughput comparison SHALL report whether the measured servers reached CPU/event-loop saturation
at the tested concurrency, and SHALL NOT be cited as evidence about framework CPU cost when they did
not. An unsaturated run is bounded by the load generator or the loopback rather than by framework
efficiency, so differences observed in it — including differences favourable to NextRush — do not
support a framework-CPU conclusion.

#### Scenario: A run records its saturation evidence

- **WHEN** a throughput comparison completes
- **THEN** its artifacts record per-server CPU utilization and idle share, and GC event count and
  total pause, for the tested concurrency

#### Scenario: An unsaturated run is not cited as CPU evidence

- **WHEN** a run's servers did not reach saturation at the tested concurrency
- **THEN** the report marks that run as unsuitable for attributing the result to framework CPU cost,
  rather than presenting the throughput ordering as a framework-efficiency finding

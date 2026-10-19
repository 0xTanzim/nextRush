# Spec Delta — performance-gate

## ADDED Requirements

### Requirement: An in-proc request-cost measurement exercises the adapter it reports

Every in-proc request-cost entry SHALL exercise the request entry point of the adapter whose runtime
it reports, so a row attributed to a runtime measures that runtime's own adapter rather than a shared
runner reached through another runtime's entry point. Each recorded row SHALL state which adapter and
which runtime produced it, and a mismatch between the reported runtime and the exercised entry point
SHALL fail rather than be reported as that runtime's adapter cost.

#### Scenario: A runtime's in-proc row exercises that runtime's adapter

- **WHEN** the in-proc request-cost measurement runs for a given runtime
- **THEN** the entry under measurement uses that runtime's own adapter request entry point

#### Scenario: A row that measures a shared runner is labelled as such

- **WHEN** an in-proc entry exercises a shared per-request runner rather than an adapter's own entry
  point
- **THEN** the reported row states that it measures the runner, so its cost is not read as the
  adapter's cost

#### Scenario: A mismatch fails instead of being reported

- **WHEN** an in-proc entry's entry point does not match the runtime the measurement reports
- **THEN** the measurement fails and no number is recorded for that row

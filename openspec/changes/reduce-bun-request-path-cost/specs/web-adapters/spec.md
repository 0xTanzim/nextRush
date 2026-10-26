# Spec Delta

## ADDED Requirements

### Requirement: The Bun request-path candidates are validated by wire-stage and allocation evidence, and inside-spread results are parked

The Bun adapter's request-path candidates SHALL be accepted only on reproducible stage evidence: wire-path work on the `wire` stage (real listener, shared load generator, median of repeated runs, spread reported), and sub-noise per-request trims on deterministic allocation evidence rather than an RPS A/B. A candidate whose measured effect falls inside the run-to-run spread SHALL be parked and reverted in the same change.

#### Scenario: Wire-path work is measured before and after with the same stage invocation
- **WHEN** a Bun wire-path candidate is evaluated
- **THEN** its before and after medians are captured with the same stage invocation, machine, and pinned runtime version, and the run-to-run spread is reported

#### Scenario: An inside-spread result is parked
- **WHEN** a candidate's after median does not exceed its before median beyond the run-to-run spread
- **THEN** the candidate is reverted in the same change and the measurement is recorded as a parked result

#### Scenario: A sub-noise trim is accepted on allocation evidence
- **WHEN** a per-request trim's cost effect is below the wire-stage noise floor
- **THEN** acceptance rests on deterministic allocation evidence plus the package tests and the cross-adapter conformance suite, not an RPS A/B

#### Scenario: Accepted work keeps behavior and coverage intact
- **WHEN** an accepted candidate ships
- **THEN** the cross-adapter conformance suite passes on real Bun with byte-identical observable behavior, and line coverage on the touched packages does not decrease

# Spec Delta

## ADDED Requirements

### Requirement: Request-cost ratios are committed with a maximum and a target, measured in the same run

The benchmark harness SHALL commit request-cost ratios measured against a baseline framework in the
same run, so machine noise cancels, each with a hard maximum and a tighter target. CI SHALL fail a
pull request whose measured ratio exceeds its maximum.

#### Scenario: Ratios are measured in the same run

- **WHEN** the request-cost stage runs
- **THEN** the framework and the baseline framework are measured in the same process and machine
  conditions, and the ratio is derived from that single run

#### Scenario: Exceeding the maximum fails the pull request

- **WHEN** a change pushes a measured ratio above its committed maximum
- **THEN** the gate fails and reports the ratio, the maximum and the change from the previous run

#### Scenario: Reaching the target clears the warning

- **WHEN** the measured ratio reaches or falls below the committed target
- **THEN** the stage reports success with no warning, and the committed target is ratcheted down in
  the same change when a further reduction is proven

#### Scenario: The deterministic stages run in CI

- **WHEN** the gate runs on a pull request touching the request path
- **THEN** the deterministic bundle, cold-start, in-process, and probe stages run, and a failure in any
  of them fails the pull request

### Requirement: A known-failure id must cover a real probe and expires when the behaviour is fixed

Known, accepted probe failures SHALL be listed by id alongside the committed budgets, each id covering
at least one probe. The pull request that makes a listed probe pass SHALL delete that id in the same
change, so the probe becomes a permanent regression guard instead of a permanent exemption.

#### Scenario: A known failure must be a real probe

- **WHEN** the committed budgets list a known-failure id
- **THEN** at least one probe in the suite is identified by that id, and an id with no probe fails the
  gate as a bookkeeping error

#### Scenario: Fixing behaviour removes its id

- **WHEN** a change makes a formerly known-failing probe pass
- **THEN** the same change deletes that id from the committed budgets, and a re-introduced defect turns
  the gate red rather than being absorbed by a stale exemption

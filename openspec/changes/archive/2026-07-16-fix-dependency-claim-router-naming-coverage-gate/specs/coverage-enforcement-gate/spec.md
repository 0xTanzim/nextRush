## ADDED Requirements

### Requirement: CI enforces a minimum per-package test coverage threshold
The CI pipeline SHALL run a coverage check against every package touched by a pull request and
SHALL fail the pipeline if any touched package's line coverage falls below 90% or branch
coverage falls below 85%, per the thresholds already stated in
`~/.kiro/steering/engineering-standards.md` and this repo's `project-rules.instructions.md` §7.

#### Scenario: A coverage regression fails the pipeline
- **WHEN** a pull request drops a touched package's line coverage below 90% (or branch coverage
  below 85%)
- **THEN** the CI pipeline reports a failure attributable to the coverage gate, distinct from
  build/test/typecheck/lint failures

#### Scenario: A package meeting the threshold passes
- **WHEN** every package touched by a pull request meets or exceeds 90% line / 85% branch
  coverage
- **THEN** the coverage gate step passes and does not block the pipeline

#### Scenario: Coverage is measured per package, not as a repo-wide average
- **WHEN** the coverage gate evaluates a pull request touching multiple packages
- **THEN** each touched package's coverage is checked independently against the threshold,
  and one well-covered package's numbers do not offset another touched package's shortfall

### Requirement: The coverage gate is wired into the existing verification pipeline
The coverage check SHALL run as part of the same pipeline invoked by `pnpm verify` (or an
equivalent CI-invoked variant of it), rather than as a wholly separate, independently-triggered
CI job, so there is one canonical gate developers check before merge.

#### Scenario: Coverage check runs alongside existing verify steps
- **WHEN** CI executes the verification pipeline for a pull request
- **THEN** the coverage check runs in the same workflow as the existing build/test/typecheck/lint
  steps, and its pass/fail status is visible in that same pipeline run

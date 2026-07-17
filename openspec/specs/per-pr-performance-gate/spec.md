# per-pr-performance-gate Specification

## Purpose
TBD - created by archiving change add-class-path-perf-benchmark-and-ci-gate. Update Purpose after archive.
## Requirements
### Requirement: The per-PR performance gate is fast enough to run routinely
The CI performance gate SHALL use a fast, low-sample "smoke" benchmark profile distinct from the
slower, multi-run profile used for publishable figures, so it can run on relevant PRs without
becoming a merge bottleneck.

#### Scenario: The CI gate completes within a reasonable time budget
- **WHEN** the performance-gate job runs on a PR
- **THEN** it completes using the smoke profile, not the full multi-run publishable profile

#### Scenario: The gate's tolerance accounts for CI environment noise
- **WHEN** the gate's regression tolerance is configured
- **THEN** it is set loosely enough to avoid failing on normal CI runner jitter, while still
  catching a gross regression, with the chosen value documented alongside the CI job


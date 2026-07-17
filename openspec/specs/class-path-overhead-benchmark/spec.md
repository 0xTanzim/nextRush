# class-path-overhead-benchmark Specification

## Purpose
TBD - created by archiving change add-class-path-perf-benchmark-and-ci-gate. Update Purpose after archive.
## Requirements
### Requirement: A reproducible benchmark measures class-path overhead against the functional path
A benchmark SHALL exist that measures and publishes: (a) registration/boot cost of the class/DI
path at multiple controller-count scales, and (b) per-request overhead of the class path relative
to the functional path, using the existing benchmark harness's fairness-validated methodology.

#### Scenario: The class-path server passes the harness's fairness check
- **WHEN** the class-path benchmark server and the existing functional benchmark server are
  compared via the harness's fairness validation (byte-identical response bodies/statuses)
- **THEN** both pass, confirming the comparison is apples-to-apples

#### Scenario: Registration cost is measured at multiple controller-count scales
- **WHEN** the class-path registration-cost benchmark runs
- **THEN** it reports boot time at more than one controller count (e.g. a small and a large N),
  revealing whether registration cost scales linearly or worse

#### Scenario: Published numbers include statistical confidence
- **WHEN** the class-path benchmark's numbers are published
- **THEN** they are produced via the harness's multi-run ("standard" or "full") profile and
  reported with mean ± stddev, per this repo's existing benchmark-publishing convention

### Requirement: CI fails a pull request on a significant performance regression
CI SHALL run the existing regression-checker tool against a stored baseline for
performance-sensitive changes, failing the pull request when a scenario regresses beyond the
configured tolerance.

#### Scenario: A deliberate regression fails the gate
- **WHEN** a pull request introduces a change that measurably slows a benchmarked scenario
  beyond the configured tolerance
- **THEN** the CI performance-gate job fails, using the existing `check-regression.js` tool

#### Scenario: A non-regressing change passes the gate
- **WHEN** a pull request's benchmark run shows no scenario regressing beyond tolerance
- **THEN** the CI performance-gate job passes

#### Scenario: The gate is scoped to performance-sensitive paths
- **WHEN** a pull request touches only paths unrelated to performance-sensitive code (per the
  scoping decided in design.md's Non-Goals)
- **THEN** the performance-gate job does not run, avoiding unnecessary CI cost


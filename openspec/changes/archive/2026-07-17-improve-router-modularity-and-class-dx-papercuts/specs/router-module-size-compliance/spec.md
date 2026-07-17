## ADDED Requirements

### Requirement: Router package source files stay within the 300-line ceiling
No shipping source file in `@nextrush/router` SHALL exceed 300 lines. Any split performed to
satisfy this SHALL preserve all existing observable behavior, verified by a passing test suite
and an unchanged public-surface snapshot.

#### Scenario: The router package has no over-cap file after the split
- **WHEN** every `.ts` file under `packages/router/src` (excluding test files) is measured
- **THEN** none exceeds 300 lines

#### Scenario: The public API surface is unchanged after the split
- **WHEN** the router package's public-surface snapshot test runs before and after the file
  reorganization
- **THEN** the exported symbol set is identical

#### Scenario: Existing router behavior is unchanged after the split
- **WHEN** the full router package test suite (plus any characterization tests added to cover
  gaps found during the refactor) runs after the split
- **THEN** all tests pass with no behavior change from before the split

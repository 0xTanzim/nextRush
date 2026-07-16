## ADDED Requirements

### Requirement: CI measures and gates the general functional core bundle's size
CI SHALL measure the gzipped size of the general functional core bundle (independent of the
edge-specific adapter bundle already measured) and SHALL fail a pull request that regresses the
measured size past a stated budget.

#### Scenario: A core-bundle size regression fails CI
- **WHEN** a change adds a dependency or import to the functional core path that pushes its
  gzipped bundle size past the stated budget
- **THEN** CI fails on the core-bundle size check, distinct from the existing edge-bundle check

#### Scenario: A published core-bundle size figure exists
- **WHEN** a reader wants to know the current functional core bundle's size
- **THEN** a measured, current gzipped size figure is available (in CI output or published docs),
  not only the previously-measured edge-bundle figure

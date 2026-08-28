## ADDED Requirements

### Requirement: A middleware that re-exports from a dependency locks its surface against the dependency's real exports
A middleware or package that re-exports symbols from a dependency (`export { x } from 'pkg'`)
SHALL lock its surface against that dependency's ACTUAL exported symbols, so a dependency
breaking change (adding, removing, or renaming an export) fails the package's own surface-lock
test — never a later cold build, and never silently. The expected-export list in the
surface-lock test MUST be the set of symbols that both (a) the package intends to expose and
(b) the dependency actually provides at install time.

#### Scenario: A removed dependency export fails the middleware's surface test at test time
- **WHEN** a dependency drops a symbol the middleware re-exports, and the middleware's surface-lock test runs
- **THEN** the test fails with a mismatch naming the missing symbol, before any downstream build gate runs

#### Scenario: A stale lock is caught rather than faithfully re-locking the wrong surface
- **WHEN** a surface-lock test's expected list still contains a dependency symbol that no longer exists
- **THEN** updating the test to "lock in" the missing symbol is a build failure — the list MUST be corrected to the dependency's real, surviving surface

#### Scenario: The guarded lock reflects the installed dependency
- **WHEN** a package's re-export surface is checked
- **THEN** every re-exported symbol resolves against the installed dependency version (a compile-time link check), and the locked list matches that verified set
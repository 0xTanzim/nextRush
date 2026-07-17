## ADDED Requirements

### Requirement: Build scan respects the package boundary

The `nextrush build` command SHALL constrain its recursive source-file scan to the boundary of the package being built. The scan root MUST be resolved to the nearest enclosing `package.json` directory, and the scan MUST exclude any nested subdirectory that has its own `package.json` (in addition to the existing `node_modules` exclusion). The build MUST NOT ascend above the resolved package boundary.

#### Scenario: Sibling workspace package is excluded
- **WHEN** `nextrush build` runs in one package of a multi-package workspace
- **THEN** only that package's source files are scanned and compiled, and sibling packages' files are excluded from the build output

#### Scenario: A nested package is treated as separate
- **WHEN** the scanned tree contains a subdirectory that has its own `package.json`
- **THEN** that subdirectory is treated as a separate package and is excluded from the current package's build scan

#### Scenario: Single-package project is unaffected
- **WHEN** `nextrush build` runs in a project that is not part of a workspace (a single `package.json` at the project root)
- **THEN** the build scans the whole project exactly as it did before this change

#### Scenario: Fallback when no package boundary is found
- **WHEN** no enclosing `package.json` can be resolved for the build target
- **THEN** the build falls back to its prior current-working-directory-rooted scan behavior

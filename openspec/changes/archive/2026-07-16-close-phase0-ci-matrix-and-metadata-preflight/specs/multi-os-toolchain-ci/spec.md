## ADDED Requirements

### Requirement: `nextrush dev` and `nextrush build` are exercised in CI on Windows and macOS
CI SHALL run the `@nextrush/dev` package's CLI commands (`dev`, `build`) against a fixture
project on `windows-latest` and `macos-latest` runners, in addition to the existing
`ubuntu-latest` job, so platform-specific regressions in the CLI are caught before release.

#### Scenario: A Windows-specific regression fails CI
- **WHEN** a change introduces a path-separator, line-ending, or process-spawning bug that only
  manifests on Windows
- **THEN** the Windows CI job fails, while the Linux job may still pass

#### Scenario: A macOS-specific regression fails CI
- **WHEN** a change introduces a regression that only manifests on macOS
- **THEN** the macOS CI job fails, while the Linux job may still pass

#### Scenario: Cross-platform CI coverage is scoped, not exhaustive
- **WHEN** the Windows and macOS CI jobs run
- **THEN** they exercise the `@nextrush/dev` CLI's `dev` and `build` commands against a fixture
  project, not the full monorepo test/lint/typecheck suite

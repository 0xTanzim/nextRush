## ADDED Requirements

### Requirement: `nextrush build`'s output is verified end-to-end against a real fixture
CI SHALL compile a fixture project via `nextrush build` and assert that the expected JS output,
`.d.ts` declaration files, sourcemaps, and file-extension mapping are all present and correct.

#### Scenario: A missing declaration file fails the build-integration test
- **WHEN** `nextrush build`'s output for a fixture is missing an expected `.d.ts` file
- **THEN** the build-integration test fails, identifying the missing artifact

#### Scenario: Correct build output passes
- **WHEN** `nextrush build` produces JS output, `.d.ts` files, sourcemaps, and correctly-mapped
  extensions for the fixture, matching what's expected
- **THEN** the build-integration test passes

#### Scenario: The test runs across the CI OS matrix
- **WHEN** the build-integration test executes in CI
- **THEN** it runs on Linux, Windows, and macOS (per the multi-OS CI matrix already established),
  not only on the original Linux-only job

## ADDED Requirements

### Requirement: `nextrush build` fails fast on a decorator-metadata toolchain misconfiguration
`nextrush build` SHALL validate the project's decorator-metadata emission configuration
(`experimentalDecorators` and `emitDecoratorMetadata` tsconfig flags) before completing the
build, and SHALL fail with actionable remediation text when the configuration is mismatched
(one flag enabled without the other) — rather than completing the build and allowing a
metadata-broken artifact to ship silently.

#### Scenario: A mismatched decorator config fails the build
- **WHEN** `nextrush build` runs against a project whose `tsconfig.json` sets
  `experimentalDecorators: true` without `emitDecoratorMetadata: true` (or vice versa)
- **THEN** the build fails with an error identifying the missing flag and the fix required

#### Scenario: A decorator-free project is unaffected
- **WHEN** `nextrush build` runs against a project whose `tsconfig.json` sets neither
  `experimentalDecorators` nor `emitDecoratorMetadata` (a functional, decorator-free project)
- **THEN** the build completes normally with no decorator-related warning or failure

#### Scenario: A correctly-configured decorator project is unaffected
- **WHEN** `nextrush build` runs against a project whose `tsconfig.json` sets both
  `experimentalDecorators: true` and `emitDecoratorMetadata: true`
- **THEN** the build completes normally

#### Scenario: Build-time and dev-time remediation text are consistent
- **WHEN** the same tsconfig mismatch is detected by both `nextrush build` (fail-fast) and
  `nextrush dev` (warn-and-continue)
- **THEN** both surfaces present the same underlying remediation text describing the missing
  flag and required fix, not two different wordings for the same problem

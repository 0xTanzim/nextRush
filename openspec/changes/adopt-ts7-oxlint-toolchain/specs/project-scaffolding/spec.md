# Spec Delta — project-scaffolding

## ADDED Requirements

### Requirement: The generated lint gate is installable and runnable

The lint configuration a generated project ships SHALL be paired with the devDependencies that
configuration imports, so the generated lint script runs on a freshly installed project. A generated
project MUST NOT contain a lint configuration that references a package the generated `package.json`
does not declare. The generated editor-recommendation list MUST name the linter the project is
actually configured with.

#### Scenario: Every lint-configuration import is a declared devDependency

- **WHEN** a project is generated with any preset that emits a lint configuration
- **THEN** every package the emitted lint configuration imports appears as a declared devDependency in the generated `package.json`

#### Scenario: The generated lint script succeeds on a fresh install

- **WHEN** the generate-then-install gate installs a generated project and runs its `lint` script
- **THEN** the script exits zero, with no unresolved-module or missing-configuration error

#### Scenario: The editor recommendation matches the configured linter

- **WHEN** the emitted editor-recommendation file is inspected
- **THEN** it recommends the extension for the linter the project is configured with, not an extension for a different linter

## MODIFIED Requirements

### Requirement: Toolchain dev-dependencies are version-resolved and engine-aligned

`typescript`, `@types/node`, and every lint-toolchain package in a generated project SHALL be resolved
the same way as framework dependencies (registry with a build-time fallback), single-sourced with the
scaffolder's own toolchain versions, and `@types/node`'s major MUST NOT exceed the generated
`engines.node` floor. The emitted `typescript` range MUST be on the same major line as the framework's
own compiler, so a generated project is not silently scaffolded onto a superseded TypeScript line.

#### Scenario: Toolchain versions match the scaffolder and the engine floor

- **WHEN** a generated `package.json` is inspected
- **THEN** its `typescript`/`@types/node` ranges are not hardcoded-and-drifted from the scaffolder's own, and `@types/node`'s major aligns with (does not exceed) the declared Node floor

#### Scenario: The generated TypeScript line matches the framework's compiler

- **WHEN** a project is generated while the framework's own toolchain is on a given TypeScript major line
- **THEN** the emitted `typescript` range resolves within that same major line, with no stale hardcoded range left behind as a fallback

#### Scenario: The lint toolchain is single-sourced like any other toolchain package

- **WHEN** a generated `package.json` declares the linter and its type-aware companion (if the emitted configuration enables type-aware rules)
- **THEN** those ranges come from the scaffolder's own resolved versions rather than an independently drifting literal

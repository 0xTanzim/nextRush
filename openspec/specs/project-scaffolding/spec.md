# project-scaffolding

## Purpose

The `create-nextrush` project-generation contract: the interactive/flag-driven CLI, per-package
framework-version resolution with an offline fallback map, template generation across every
`style × runtime × middleware` combination, and the guarantee that a generated project **installs,
builds, and runs with working dependency injection on its selected runtime** — carrying
production-ready defaults and honest, self-consistent documentation. This capability defines what a
developer's first NextRush project is guaranteed to be. It owns the scaffolder and the generated-project
contract; the toolchain that a generated project *invokes* (`@nextrush/dev`: build, dev server,
generators) is owned by the `dev-tooling` capability, which this capability depends on but does not
restate.

## Requirements

### Requirement: Generated projects install with fully resolvable dependency versions
`create-nextrush` SHALL resolve the version of every `@nextrush/*` and framework dependency it emits
from that package's own registry entry, never by using one package's version as a proxy for another.
Every dependency range written into a generated `package.json` MUST resolve against a real published
version for the exact `{style, runtime, middleware}` selected. When the registry is unreachable, the
scaffolder MUST fall back to a build-time-injected **per-package** version map (not a single shared
range), and that fallback MUST likewise be resolvable.

#### Scenario: Every generated dependency range resolves
- **WHEN** a project is generated for any `{style, runtime, middleware}` combination
- **THEN** each dependency and devDependency range (including `@nextrush/dev`, the selected middleware, and any runtime adapter) resolves to a real published version — no range references a version line the package is not published on

#### Scenario: A package on a different version line is resolved independently
- **WHEN** an emitted package (e.g. `@nextrush/dev`, `@nextrush/rate-limit`, `@nextrush/adapter-deno`) is on a different major line than `nextrush`
- **THEN** its range reflects that package's own published version, not the `nextrush` or `@nextrush/cors` version

#### Scenario: Offline generation uses a resolvable per-package fallback map
- **WHEN** the registry is unreachable during generation
- **THEN** each emitted range comes from the build-time per-package fallback map and still resolves once connectivity returns

### Requirement: A generate-then-install matrix gate verifies every scaffold combination
CI SHALL scaffold a project for each supported `style × runtime × middleware` combination and verify
that its dependencies install (a real install, or a `--dry-run`/resolution check against publish
versions). This gate MUST fail the build when any generated combination pins an unresolvable range.

#### Scenario: A combination that cannot install fails CI
- **WHEN** any scaffold combination emits a dependency range that does not resolve against publish versions
- **THEN** the matrix gate fails, naming the offending combination and package

#### Scenario: The matrix covers every offered option
- **WHEN** the gate runs
- **THEN** every value of `style`, `runtime`, and `middleware` is exercised in at least one generated-and-installed combination

### Requirement: Dependency-install and git failures produce actionable diagnostics
When post-scaffold dependency installation or git initialization fails, `create-nextrush` SHALL surface
the underlying command's captured error output and the exact command to retry manually, rather than a
generic message with the real error suppressed.

#### Scenario: A failed install shows the cause and the retry command
- **WHEN** the dependency install step exits non-zero
- **THEN** the CLI prints the captured install error output and the exact manual install command for the selected package manager, not only "installation failed"

#### Scenario: Success stays quiet
- **WHEN** installation succeeds
- **THEN** the CLI shows only a success indicator (captured output is not dumped on the happy path)

### Requirement: Every offered runtime scaffolds a project that builds and runs with working DI
For every runtime offered by the CLI (`node`, `bun`, `deno`), a generated project of any style SHALL
build and start with working dependency injection. For class-based and full styles, the generated
project MUST be configured so decorator metadata is emitted on the selected runtime — either by routing
`dev`/`build` scripts through the `@nextrush/dev` toolchain (which owns the metadata guarantee) or by
emitting the runtime's required configuration (e.g. a `deno.json` with the decorator compiler options).
Generated scripts MUST NOT pin transient `@latest` toolchain references, and MUST NOT grant broader
runtime permissions than the application needs (no blanket `-A` on Deno).

#### Scenario: Deno class-based project resolves DI at runtime
- **WHEN** a `deno` + `class-based` (or `full`) project is generated, installed, and started
- **THEN** decorator metadata is available and constructor DI resolves (a `@Service` injected into a `@Controller` works), because the generated scripts route through the toolchain or a generated `deno.json` enables it

#### Scenario: Generated scripts avoid transient and over-broad flags
- **WHEN** the generated `package.json` scripts for any runtime are inspected
- **THEN** no script pins `@latest` for a NextRush toolchain package, and the Deno scripts request a scoped permission set rather than blanket `-A`

#### Scenario: Bun class-based build carries decorator metadata
- **WHEN** a `bun` + `class-based` project is built via its generated `build` script
- **THEN** the built output carries decorator metadata (the guarantee enforced by the `dev-tooling` capability's build-conformance test), so DI works in the production build

### Requirement: The scaffolder validates the host environment before generating
`create-nextrush` SHALL check the host Node.js version against the framework's minimum (`>=22`) at
startup and, when it is below the floor, print an actionable message and exit non-zero before generating
any files.

#### Scenario: An unsupported Node version is rejected early
- **WHEN** the CLI is run on a Node.js version below the supported floor
- **THEN** it prints the required version and how to upgrade, and exits non-zero without scaffolding

### Requirement: Generated TypeScript configuration is safe for a per-file transpiler
The `tsconfig.json` a generated project ships SHALL enable the guards required by an isolated per-file
transpiler (SWC): `isolatedModules` (at minimum) so `tsc` rejects constructs SWC cannot transpile, and
MUST match the framework's own module-syntax standard where feasible (`verbatimModuleSyntax`).

#### Scenario: A type-only re-export mistake is caught at type-check
- **WHEN** a generated project's source re-exports a type without `export type` (a construct SWC would mistranspile)
- **THEN** `tsc --noEmit` against the generated `tsconfig` reports the error rather than compiling clean

### Requirement: Generated package.json carries production-ready metadata
A generated `package.json` SHALL declare `engines.node` matching the framework floor and a
`packageManager` field reflecting the detected/selected package manager, so the project signals its
runtime requirement and pins its package manager.

#### Scenario: Engine and package-manager fields are present
- **WHEN** a project is generated
- **THEN** its `package.json` contains `engines.node` (>= the framework floor) and a `packageManager` entry consistent with the resolved package manager

### Requirement: Toolchain dev-dependencies are version-resolved and engine-aligned
`typescript` and `@types/node` in a generated project SHALL be resolved the same way as framework
dependencies (registry with a build-time fallback), single-sourced with the scaffolder's own toolchain
versions, and `@types/node`'s major MUST NOT exceed the generated `engines.node` floor.

#### Scenario: Toolchain versions match the scaffolder and the engine floor
- **WHEN** a generated `package.json` is inspected
- **THEN** its `typescript`/`@types/node` ranges are not hardcoded-and-drifted from the scaffolder's own, and `@types/node`'s major aligns with (does not exceed) the declared Node floor

### Requirement: Version resolution honors the configured package registry
`create-nextrush` SHALL read the caller's configured registry (`npm_config_registry` / `.npmrc`) before
defaulting to the public npm registry, so version resolution works behind a private registry or proxy.

#### Scenario: A configured private registry is used for resolution
- **WHEN** the environment sets a non-default `npm_config_registry`
- **THEN** version probes are issued against that registry, not hardcoded `registry.npmjs.org`

### Requirement: Generated documentation matches generated output
Documentation `create-nextrush` produces or ships (the generated project `README.md` and the package
`README.md`'s structure listings) SHALL describe only files and structure the generator actually emits.
The generated project's structure section MUST be derived from the emitted file map, not a hardcoded
per-style guess.

#### Scenario: No phantom files in generated docs
- **WHEN** a `full`-style project is generated
- **THEN** its `README.md` structure section lists exactly the files emitted (no `not-found.ts` that is never generated) and reflects the correct per-style layout

### Requirement: Generated project structure follows framework conventions
Generated projects SHALL follow NextRush conventions: controller auto-discovery globs are scoped to the
controllers directory (not the whole source tree), a `test` script and one example test are included
(consistent with the framework's test-first constitution), and app-construction idioms are consistent
across styles.

#### Scenario: Controller discovery is scoped
- **WHEN** a class-based or full project runs controller auto-discovery
- **THEN** the discovery glob targets the controllers directory rather than importing every source file including the entry module

#### Scenario: A generated project ships a runnable test
- **WHEN** a project is generated
- **THEN** its `package.json` has a `test` script and the project includes at least one example test that passes against the generated code

### Requirement: The scaffolder onboarding flow is coherent and honest
The CLI onboarding SHALL be internally consistent: an explicitly-passed affirmative flag (`--install`,
`--git`) does not re-prompt for the same decision; a git-initialized project receives an initial commit;
the completion output names the correct brand (`NextRush`) and tells the developer the URL to open to
verify the running app; and the version probe is not performed when no install will occur.

#### Scenario: Explicit flags are not re-asked
- **WHEN** the user passes `--install` or `--git` explicitly
- **THEN** the CLI does not prompt again for that same decision

#### Scenario: A git-initialized project has an initial commit
- **WHEN** git initialization is enabled
- **THEN** the generated project is left with an initial commit, not merely staged files

#### Scenario: Completion output is branded correctly and points to a URL
- **WHEN** scaffolding completes
- **THEN** the outro uses `NextRush` (correct casing) and the next steps include the URL to open (e.g. the health endpoint) for the selected style

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

### Requirement: Every scaffold style generates a unified configuration module
A generated project of ANY style (`functional`, `class-based`, or `full`) SHALL emit a centralized
`src/config/index.ts` as the single source of truth for application configuration. Application code
(entrypoint, routes, controllers, services) MUST NOT read environment variables directly; it SHALL
import the generated `config` module instead. The module SHALL expose the same shape on every
runtime: `{ port: number, host: string, nodeEnv: 'development' | 'production' | 'test' }`.

#### Scenario: Class-based and full styles get a config module
- **WHEN** a `class-based` or `full` project is generated for any runtime
- **THEN** its `src/config/index.ts` exists, its entrypoint imports `config` (not inline `process.env`), and the generated `package.json` contains no reference to a PORT constant outside the config module

#### Scenario: The config module shape is consistent across runtimes
- **WHEN** a functional project is generated for `node`, `bun`, or `deno`
- **THEN** each `src/config/index.ts` exposes the same `{ port, host, nodeEnv }` surface, with only the environment-access implementation differing (`process.env` for node/bun, `Deno.env.get` for deno)

### Requirement: Generated environment files match the selected runtime
A generated project SHALL emit environment files appropriate to its runtime. Node and Bun projects
SHALL emit both `.env` (with working defaults `HOST=0.0.0.0`, `PORT=8080`, `NODE_ENV=development`)
and a committed `.env.example` (with empty values documenting the variables). Deno projects SHALL
emit `.env.example` only and MUST NOT generate a `.env` file by default (Deno uses native
`Deno.env`).

#### Scenario: Node and Bun projects get .env and .env.example
- **WHEN** a `node` or `bun` project is generated
- **THEN** the file map contains `.env` with `HOST=0.0.0.0`, `PORT=8080`, `NODE_ENV=development`, and `.env.example` with empty `HOST=`/`PORT=`/`NODE_ENV=` entries

#### Scenario: Deno projects get .env.example only
- **WHEN** a `deno` project is generated
- **THEN** the file map contains `.env.example` and does not contain `.env`

#### Scenario: The .env file is never committed
- **WHEN** a project is generated and its `.gitignore` is inspected
- **THEN** `.env` (and `.env.local`, `.env.*.local`) are listed, so a git-initialized project never stages the generated `.env`

### Requirement: Runtime-appropriate .env loading is owned by the generated application
The generated application SHALL own environment-file loading so behavior is identical in development
and production (where `@nextrush/dev` is not present). For Node and Bun, the generated entrypoint
SHALL begin with `import 'dotenv/config'` as its FIRST import, before any module that reads
configuration, and the generated `package.json` SHALL include a `dotenv` dependency. Deno SHALL NOT
import `dotenv` and SHALL NOT include it as a dependency.

#### Scenario: Node and Bun entrypoints load .env first
- **WHEN** a `node` or `bun` project's entrypoint is inspected
- **THEN** `import 'dotenv/config'` is the first statement and appears before the `config` import

#### Scenario: Deno entrypoints use native environment access
- **WHEN** a `deno` project's entrypoint and `package.json` are inspected
- **THEN** the entrypoint contains no `dotenv` import and `package.json` has no `dotenv` dependency

### Requirement: The dotenv dependency is resolved through the version pipeline
The `dotenv` dependency emitted into a generated Node/Bun `package.json` SHALL be resolved by the
same per-package version pipeline as every framework dependency: it MUST be included in the set of
package names probed against the registry (`getAllPossiblePackageNames`), read via the version store
(`getPackageRange`), and MUST have a build-time-injected fallback range sourced from
`create-nextrush`'s own devDependencies (mirroring the `typescript`/`vitest` single-sourcing pattern)
so offline generation still emits a resolvable range. The template MUST NOT hardcode a `dotenv`
version.

#### Scenario: dotenv is resolved like any other dependency
- **WHEN** a Node/Bun project is generated with the registry reachable
- **THEN** its `dotenv` range is the live-resolved latest version, and the template source contains no hardcoded `dotenv` version literal

#### Scenario: Offline generation still emits a resolvable dotenv range
- **WHEN** a Node/Bun project is generated with the registry unreachable
- **THEN** the emitted `dotenv` range comes from the build-time fallback (sourced from `create-nextrush`'s own devDependencies) and resolves against a real published version once connectivity returns

### Requirement: The generated server honors the configured host
The generated entrypoint SHALL forward `config.host` to the runtime's server start call so the
`HOST` environment variable is actually honored (all supported adapters expose a canonical `host`
option). A generated project MUST NOT silently ignore a configured `HOST`.

#### Scenario: HOST is forwarded to the server
- **WHEN** a generated project's entrypoint is inspected for any runtime
- **THEN** the server start call passes `config.host` (or the adapter's `host` option) rather than omitting it, so `HOST=127.0.0.1` in `.env` binds the intended interface

### Requirement: Generated config parsing normalizes environment edge cases
The generated `config` module SHALL handle malformed environment values deterministically instead of
silently misbehaving: an empty, non-numeric, zero, or missing `PORT` SHALL resolve to the default
port; a negative or overflow port SHALL be rejected to the default; an empty or unknown `NODE_ENV`
SHALL resolve to the development default and SHALL be coerced to the `'development' |
'production' | 'test'` union so downstream checks (e.g. error-handler stack traces) never see an
unexpected value.

#### Scenario: Malformed PORT values fall back to the default
- **WHEN** `PORT` is `''`, `abc`, `0`, `-1`, or an out-of-range integer in the environment
- **THEN** the generated `config.port` is the default `8080` (not `NaN`, `0`, a negative number, or an overflow), and the server starts on the default port

#### Scenario: A valid PORT is honored
- **WHEN** `PORT` is a positive integer within the valid port range
- **THEN** `config.port` equals that value

#### Scenario: Empty or unknown NODE_ENV falls back and is coerced
- **WHEN** `NODE_ENV` is `''` or a value outside `development`/`production`/`test`
- **THEN** `config.nodeEnv` is the `'development'` default (never an empty string or an unexpected literal), so error-handler behavior is deterministic

### Requirement: Generated documentation describes the environment setup accurately
The generated project `README.md` SHALL document the runtime-specific environment behavior
accurately: which environment files are generated (`.env`/`.env.example` vs `.env.example` only),
that `.env` is gitignored and `.env.example` is committed, and how to configure `PORT`/`HOST`/
`NODE_ENV`. The README's structure listing SHALL reflect the emitted files (including any generated
environment files) and MUST NOT list files that are not generated.

#### Scenario: The README documents environment files and runtime differences
- **WHEN** a generated project's README is inspected for any runtime
- **THEN** it names the environment files actually generated for that runtime, states `.env` is gitignored (`.env.example` is committed), and its structure section matches the emitted file map (no phantom files)

### Requirement: The dev toolchain's injected environment takes precedence in development
The generated application SHALL behave consistently under `nextrush dev` even though the dev
toolchain injects `PORT` and `NODE_ENV` into the spawned child's environment. Because the entrypoint
loads `dotenv` non-overriding, an explicitly injected `PORT`/`NODE_ENV` from `@nextrush/dev` SHALL
take precedence over `.env` values in development; this precedence SHALL be documented in the
generated README so a developer changing `.env` knows to also change the dev command or the
`nextrush.config.ts` dev port rather than expecting `.env` alone to win under `nextrush dev`.

#### Scenario: Dev-injected PORT wins over .env under nextrush dev
- **WHEN** a Node/Bun project runs under `nextrush dev` with `PORT=9090` in `.env`
- **THEN** the dev toolchain's injected `PORT` (default 8080, or the configured dev port) wins and the app binds that port, matching the documented precedence rather than silently contradicting `.env`

#### Scenario: Production start honors .env
- **WHEN** the same project is started via `node dist/index.js` or `bun dist/index.js` with `PORT=9090` in `.env`
- **THEN** the app binds port 9090, because the generated application owns `.env` loading and no toolchain injection is present

### Requirement: Every emitted dependency is declared in a single dependency manifest
`create-nextrush` SHALL declare every dependency it can emit in a single dependency manifest (a
TypeScript registry, not JSON). The set of package names probed by the version resolver
(`getAllPossiblePackageNames`) and the dependency sets written into a generated `package.json`
(`getDependencies`) SHALL be derived from that manifest, never maintained as separate manual lists.
The manifest SHALL record, per dependency: `scope` (`dependency` or `devDependency`), the `runtimes`
and `templates` it applies to, and its resolution policy.

#### Scenario: Adding a dependency requires one declaration
- **WHEN** a new dependency is introduced to the scaffolder
- **THEN** declaring it once in the dependency manifest is sufficient for it to appear in the probed package-name set, the generated `package.json` for the matching `{runtime, template}`, and the resolution pipeline — no separate edits to `getDependencies`, `getAllPossiblePackageNames`, or a fallback map are required

#### Scenario: The manifest derives the probed package set
- **WHEN** `getAllPossiblePackageNames` is called
- **THEN** it returns exactly the set of manifest keys (plus any packages only referenced indirectly), and this set stays in sync with the manifest automatically

### Requirement: Third-party and workspace packages resolve identically
`create-nextrush` SHALL treat third-party packages (e.g. `dotenv`) and workspace `@nextrush/*`
packages identically in the resolution pipeline: both are declared in the dependency manifest, both
are probed against the registry, and both fall back to a per-package fallback range. There SHALL be
no special-case fallback map for third-party packages.

#### Scenario: A third-party package falls back per-package
- **WHEN** the registry is unreachable for a third-party manifest dependency (e.g. `dotenv`)
- **THEN** it falls back to ITS OWN declared fallback range (sourced from the manifest), exactly like a workspace package — not a shared scalar, not a special-cased map

#### Scenario: No hardcoded version literals in templates
- **WHEN** a generated `package.json` is produced for any `{style, runtime, middleware}`
- **THEN** every dependency range comes from the resolution pipeline (manifest + resolver), and no template source contains a hardcoded version literal for any manifest dependency

### Requirement: The generated runtime floor is derived from a single runtime policy
`create-nextrush` SHALL derive the generated project's `engines.node` floor and the `@types/node`
major cap from a single runtime-policy value (e.g. `SUPPORTED_NODE_LTS`), not from a hardcoded
literal embedded in the generator. Moving the supported Node floor to a future LTS SHALL require
changing only that policy value; every newly generated project follows it automatically.

#### Scenario: Changing the runtime policy updates generated engines
- **WHEN** the runtime-policy value changes (e.g. from Node 22 to a future LTS)
- **THEN** newly generated projects emit the new `engines.node` floor and align the `@types/node` cap, with no template edits

#### Scenario: The policy is a single source of truth
- **WHEN** the scaffolder's `engines.node` emission and `@types/node` cap are inspected
- **THEN** both derive from the same runtime-policy value (no independent hardcoded constants)

### Requirement: Every runtime generates the same environment file layout
A generated project of ANY runtime (`node`, `bun`, or `deno`) SHALL emit both `.env` (with working
defaults `HOST=0.0.0.0`, `PORT=8080`, `NODE_ENV=development`) and a committed `.env.example` (empty
values). The project layout MUST NOT differ by runtime — the runtime difference is the loading
mechanism, not the file set.

#### Scenario: Deno projects get a .env file too
- **WHEN** a `deno` project is generated
- **THEN** its file map contains `.env` (with `HOST=0.0.0.0`, `PORT=8080`, `NODE_ENV=development`) AND `.env.example`, matching the node/bun layout

#### Scenario: The .env file is gitignored for every runtime
- **WHEN** a `deno` project is generated and its `.gitignore` is inspected
- **THEN** `.env` is listed, so a git-initialized Deno project never stages the generated `.env`

### Requirement: Deno loads .env via --env-file in the production start script
The generated Deno `start` script SHALL load the project's `.env` file via Deno's `--env-file=.env`
flag (alongside the existing scoped permissions), so production `deno run dist/index.js` honors
`.env` without a `dotenv` dependency. The generated Deno config module SHALL continue to read
`Deno.env.get(...)`.

#### Scenario: Deno production start honors .env
- **WHEN** a Deno project's generated `start` script is inspected
- **THEN** it is `deno run --allow-net --allow-read --allow-env --env-file=.env dist/index.js` (or equivalent scoped permissions + `--env-file=.env`), and the config module still uses `Deno.env.get`

#### Scenario: Deno gets no dotenv dependency or import
- **WHEN** a Deno project is generated
- **THEN** its `package.json` has no `dotenv` dependency and its entrypoint has no `import 'dotenv/config'`

### Requirement: The dev toolchain loads .env for Deno projects
`@nextrush/dev` SHALL pass `--env-file=.env` (when the file is present) when spawning the Deno dev
server and Deno build, so `nextrush dev` and `nextrush build` load `.env` for Deno projects the same
way Node/Bun projects load it via their entrypoint `dotenv` import. Because `--env-file` does not
overwrite existing process environment variables, an explicitly injected `PORT`/`NODE_ENV` from the
toolchain SHALL still take precedence in dev (matching the Node/Bun documented behavior).

#### Scenario: nextrush dev loads .env for a Deno project
- **WHEN** `@nextrush/dev` spawns a Deno dev server for a project with a `.env` file
- **THEN** the spawn arguments include `--env-file=.env` (or the equivalent), so `Deno.env.get('PORT')` reflects `.env` values not already set in the process environment

#### Scenario: Toolchain-injected env still wins in Deno dev
- **WHEN** the dev toolchain injects `PORT`/`NODE_ENV` and a `.env` file also sets them
- **THEN** the injected values take precedence (existing process env is not overwritten by `--env-file`), matching the documented Node/Bun dev behavior


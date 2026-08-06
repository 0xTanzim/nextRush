# dev-tooling

## Purpose

The `@nextrush/dev` local-development lifecycle contract: the CLI (`dev`, `build`, `generate`,
`codemod`), the SWC-everywhere TypeScript compilation with guaranteed decorator-metadata emission
(so DI works), cross-runtime process spawning and native-watcher auto-restart, the incremental
build cache, type-declaration emission, the cross-runtime loader-resolution strategy, and the
toolchain's diagnostics and verification bar. This capability defines what the tooling guarantees a
developer across Node, Bun, and Deno — observable behavior that must hold identically where a
runtime supports it, and degrade with an actionable message where it does not.
## Requirements
### Requirement: Production build is correct and metadata-emitting on every supported runtime
`nextrush build` SHALL, on each supported runtime (Node, Bun, Deno), transform every discovered
TypeScript source file to a correct output file with decorator metadata emitted (so DI resolves at
runtime). The Deno build path MUST operate on the discovered files' actual paths (never pass a
file descriptor object where a path string is expected), and every runtime MUST map extensions
identically: `.ts`/`.tsx` → `.js`, `.mts` → `.mjs`, `.cts` → `.cjs`. A runtime whose decorator-
metadata emission cannot be guaranteed MUST be documented as experimental rather than claimed stable.

#### Scenario: Deno build transforms all files without a path-type error
- **WHEN** `nextrush build` runs under Deno against a project with `.ts`/`.mts`/`.cts` sources
- **THEN** each source is transformed to its correctly-mapped output file and the build exits 0, with no `ERR_INVALID_ARG_TYPE` from a path helper

#### Scenario: Decorator metadata is present in built output on each runtime
- **WHEN** a decorated class is built via `nextrush build` under Node, Bun, and Deno
- **THEN** the emitted output contains the `design:paramtypes` reflection metadata required for DI on every runtime whose build path is documented as stable

#### Scenario: A runtime that cannot guarantee metadata is labelled experimental
- **WHEN** a runtime's decorator-metadata emission is not covered by an automated conformance test
- **THEN** its build path is documented as "experimental", not "stable", in the README and support matrix

### Requirement: The incremental build cache survives a clean build
The build cache SHALL be stored outside the output directory so that `--clean` (default enabled)
and `--cache` (default enabled) are orthogonal. A warm rebuild with unchanged sources MUST skip
re-transforming cached files.

#### Scenario: Cache persists across default builds
- **WHEN** `nextrush build` is run twice in a row with default options (clean and cache both on) and no source changes
- **THEN** the second build reports the unchanged files as cached/skipped rather than re-transforming every file

#### Scenario: Changed source invalidates only its own cache entry
- **WHEN** one source file changes between two default builds
- **THEN** only that file (and dependents that must re-emit) is re-transformed; the rest are served from cache

### Requirement: Declaration emission is controlled solely by the dts option
`.d.ts` generation SHALL be gated only on the `dts` option, independent of `decoratorMetadata`.
Emitted declarations MUST sit at the same relative layout as their corresponding `.js` outputs.

#### Scenario: Disabling decorator metadata still emits declarations
- **WHEN** `nextrush build --no-decorator-metadata` runs with `--dts` (default on)
- **THEN** `.d.ts` files are still generated

#### Scenario: Declarations mirror the JS output layout for nested sources
- **WHEN** a project with nested source directories is built
- **THEN** each `.d.ts` is emitted beside its corresponding `.js` at the same relative path

### Requirement: Node built-in module access is type-checked
Access to Node built-ins (`node:fs`, `node:path`, `node:child_process`, …) SHALL be typed so
`tsc` verifies their usage, while preserving the variable-specifier import pattern that prevents
bundlers from stripping the `node:` prefix (required for Deno loading).

#### Scenario: Misusing a built-in fails type-check
- **WHEN** code passes a non-string value where a `node:path` API expects a string
- **THEN** `tsc --noEmit` reports a type error rather than compiling clean

#### Scenario: Built ESM keeps the node: prefix
- **WHEN** the package is built and inspected
- **THEN** dynamic imports of built-ins retain the `node:` prefix so the output loads under Deno

### Requirement: Dev server startup and restart are verified against a live server
The dev integration test suite SHALL assert that `nextrush dev` produces a server that actually
serves a request, and that editing a watched source file restarts the server and serves the
updated behavior. Per-package line coverage MUST be at or above 90%.

#### Scenario: Started dev server answers a request
- **WHEN** the dev integration test starts `nextrush dev` against a fixture app
- **THEN** an HTTP request to the server's port returns the expected response (not merely a startup banner)

#### Scenario: Editing a watched file restarts and serves the change
- **WHEN** a watched source file is modified while `nextrush dev` runs
- **THEN** the server restarts and a subsequent request reflects the change

### Requirement: The dev server reports child crashes and shuts down cleanly
`nextrush dev` SHALL surface a child (application) process crash with an actionable message and a
non-zero exit code, and on receiving `SIGINT`/`SIGTERM` MUST terminate the child (and its descendant
application process) and await its exit before the parent exits.

#### Scenario: An application startup crash is reported
- **WHEN** the spawned application exits with an error at startup
- **THEN** the dev CLI prints an actionable error and exits non-zero rather than hanging or exiting 0 silently

#### Scenario: Ctrl-C awaits child termination before exiting
- **WHEN** the developer sends `SIGINT` to `nextrush dev`
- **THEN** the child (and descendant app) is terminated and reaped, and the port is released, before the CLI process exits

### Requirement: File watching is portable and guarded
For Node, `nextrush dev` SHALL default to bare `--watch` (portable across platforms). It MUST use
`--watch-path` only for explicitly-provided `--watch <path>` arguments, guarded by platform/Node-
version support, and MUST fall back to bare `--watch` with a one-line warning where `--watch-path`
is unsupported rather than crashing with a raw platform error.

#### Scenario: Default Node dev uses bare --watch
- **WHEN** `nextrush dev` runs on Node with no explicit `--watch` argument
- **THEN** the spawned command uses bare `--watch`, not `--watch-path`

#### Scenario: Unsupported --watch-path falls back with a warning
- **WHEN** the developer passes `--watch <path>` on a platform/Node version where `--watch-path` is unsupported
- **THEN** the CLI falls back to bare `--watch` and prints a one-line warning instead of throwing `ERR_FEATURE_UNAVAILABLE_ON_PLATFORM`

### Requirement: Diagnostics are actionable for missing runtimes and invalid config
When `nextrush dev`/`build` targets a runtime whose binary is not installed, the CLI SHALL emit an
actionable message naming the runtime and how to proceed, rather than a raw `spawn … ENOENT`. A
malformed project config file MUST produce a warning rather than being silently ignored.

#### Scenario: Missing target runtime binary is explained
- **WHEN** a project targets Bun (via its adapter) but `bun` is not on PATH and the CLI attempts to spawn it
- **THEN** the error names Bun, states it is not installed, and suggests installing it or running under Node

#### Scenario: Malformed config surfaces a warning
- **WHEN** a `nextrush.config.ts` fails to load or parse
- **THEN** the CLI warns that the config was ignored (naming the reason) rather than silently falling back to defaults

### Requirement: SWC loader path resolution is deterministic across install layouts
The dev SWC loader path SHALL resolve to the `@nextrush/dev` package's own `dist/` directory
regardless of whether an ancestor directory in the install path is named `dist`.

#### Scenario: A `dist`-named ancestor does not misresolve the loader
- **WHEN** `@nextrush/dev` is installed under a path containing an ancestor directory named `dist`
- **THEN** the loader path resolves to the package's own `dist/loaders/` and `nextrush dev` starts without a module-not-found error

### Requirement: The import codemod preserves comments and untargeted imports
`nextrush codemod consolidate-imports` SHALL rewrite only the targeted class-model specifiers
(`@nextrush/decorators`, `@nextrush/controllers` → `nextrush/class`) and MUST preserve leading
comments (license/header), untargeted imports, and their relative position.

#### Scenario: A license header is preserved above the imports
- **WHEN** the codemod runs on a file that begins with a `/* license */` header followed by shim imports
- **THEN** the header remains at the top of the file and only the targeted imports are consolidated

#### Scenario: Untargeted imports are left untouched
- **WHEN** the codemod runs on a file containing imports from packages other than the shim packages
- **THEN** those imports are left byte-for-byte unchanged

### Requirement: Path composition behaves identically across runtimes
The cross-runtime `resolvePath`/`joinPath` helpers SHALL produce identical results across Node,
Bun, and Deno for the same inputs, including `..` collapsing and absolute-segment handling.

#### Scenario: Absolute and parent segments resolve identically on Deno and Node
- **WHEN** `resolvePath` is called with the same inputs (including `..` and an absolute later segment) under Node and under Deno
- **THEN** both runtimes return the same resolved path

### Requirement: Toolchain dependencies are reproducible
The `@nextrush/dev` package SHALL declare no unused runtime dependency, and MUST pin its
compilation-critical dependencies (`@swc/core`, `@swc-node/register`) to tight version ranges so
tool builds are reproducible.

#### Scenario: No unused runtime dependency is declared
- **WHEN** the package's declared runtime dependencies are checked against actual source imports
- **THEN** every declared runtime dependency is referenced (the unused `tsx` dependency is removed)

#### Scenario: Compilation-critical dependencies are pinned
- **WHEN** the package manifest is inspected
- **THEN** `@swc/core` and `@swc-node/register` use exact or tightly-bounded version ranges rather than open carets

### Requirement: Build concurrency scales to available CPUs
The SWC build SHALL derive its transform concurrency from the host's available parallelism (capped
to a safe maximum) rather than a hardcoded constant, verified by measurement before adoption.

#### Scenario: Concurrency reflects available parallelism
- **WHEN** `nextrush build` runs on a multi-core host
- **THEN** the number of concurrent transforms is derived from available parallelism (capped, e.g. at 8), not fixed at a constant

### Requirement: The Deno dev/build spawn loads the project .env file
`@nextrush/dev` SHALL pass `--env-file=.env` to the Deno binary when spawning the dev server or
build for a Deno project, when a `.env` file exists in the project directory. This makes
`nextrush dev`/`nextrush build` load `.env` for Deno projects, matching how Node/Bun projects load it
via the generated entrypoint's `dotenv` import. The flag MUST be added to the scoped permission set
(`--allow-net --allow-read --allow-env`), never with blanket `-A`.

#### Scenario: Deno dev spawn includes --env-file
- **WHEN** `buildDevArgs` builds arguments for a `deno` runtime with a `.env` file present
- **THEN** the args include `--env-file=.env` alongside the scoped `--allow-*` permissions

#### Scenario: Existing process env is not overwritten
- **WHEN** a Deno dev/build spawn runs with `--env-file=.env` and the process environment already has a variable also present in `.env`
- **THEN** the existing process value is preserved (Deno's `--env-file` does not overwrite), so toolchain-injected `PORT`/`NODE_ENV` still win in dev


# framework-composition

## Purpose

The contract for how NextRush's packages compose into one installable framework: which packages
the `nextrush` meta-package re-exports and via which subpaths (`.` functional, `./class`); the
requirement that the advertised dependency footprint matches the actual install graph; the
canonical publishable-package manifest conventions (ESM `exports` shape, dependency-vs-peer-vs-
optional discipline, the no-unjustified-install-script rule, build-target/engines alignment); and
the discoverability of the framework's satellite packages. This capability exists so the
framework's stated promises — "install only what you need", "zero-dependency functional core" —
are true at install time, not merely at runtime, and cannot silently drift as packages are added,
versioned, or re-tiered.

## Requirements

### Requirement: The advertised functional footprint matches the functional install graph
The `nextrush` meta-package SHALL declare `@nextrush/class`, `@nextrush/di`, and
`reflect-metadata` as OPTIONAL peer dependencies (`peerDependencies` with
`peerDependenciesMeta.<name>.optional: true`), NOT as hard `dependencies`, so that installing
`nextrush` for functional use does not download the class runtime, the DI container, `tsyringe`,
or `reflect-metadata`. The `.` (functional) entry point MUST remain importable and fully
functional with those optional peers absent.

#### Scenario: A functional install omits the class/DI stack
- **WHEN** `nextrush` is installed into a fresh project with no explicit class-runtime dependency
- **THEN** the resolved install tree contains none of `@nextrush/class`, `@nextrush/di`, `tsyringe`, or `reflect-metadata`, and `import { createApp, listen } from 'nextrush'` works

#### Scenario: A class install resolves the optional peers
- **WHEN** a project installs `nextrush` together with `@nextrush/class`
- **THEN** `import { Controller, Get } from 'nextrush/class'` resolves and works, `reflect-metadata` is loaded once via the subpath's side-effect import, and no duplicate DI container/`reflect-metadata` instance is introduced

### Requirement: The nextrush/class subpath fails with an actionable error when its peers are absent
When the `nextrush/class` subpath is imported in a project that has not installed the optional
class peers, resolution SHALL fail with an actionable message that names the missing package and
the exact install command, rather than an opaque module-not-found error or a silent partial
failure.

#### Scenario: Importing nextrush/class without the peer gives install guidance
- **WHEN** code imports from `nextrush/class` in a project where `@nextrush/class` is not installed
- **THEN** the failure message names `@nextrush/class` (and `reflect-metadata`) and states the install command (e.g. `pnpm add @nextrush/class reflect-metadata`)

### Requirement: Class-based scaffolds install the class peers automatically
`create-nextrush` SHALL add the class optional peers (`@nextrush/class`, and `reflect-metadata`
if not transitively provided) to the generated `package.json` for its class-based and full
templates, and MUST NOT add them for the functional (routes-only) template.

#### Scenario: The class template scaffolds a working class project
- **WHEN** a project is scaffolded with the class-based or full template
- **THEN** the generated `package.json` includes `@nextrush/class`, and a generated controller runs without a missing-peer error

#### Scenario: The functional template stays class-free
- **WHEN** a project is scaffolded with the functional (routes-only) template
- **THEN** the generated `package.json` does not include `@nextrush/class` or `reflect-metadata`

### Requirement: Publishable packages execute no code at install time
No publishable NextRush package SHALL declare an `install`, `preinstall`, or `postinstall`
lifecycle script. Discovery of optional tooling (e.g. `@nextrush/dev`) MUST be surfaced through
documentation, the scaffolder, or an actionable runtime message from the CLI — never by executing
a script during dependency installation.

#### Scenario: The meta-package manifest declares no install script
- **WHEN** the `nextrush` `package.json` is inspected
- **THEN** it declares no `postinstall`/`preinstall`/`install` script, and ships no install-time script file in its `files` allow-list

#### Scenario: The optional dev CLI is still discoverable
- **WHEN** a developer wants the `nextrush dev`/`nextrush build` CLI
- **THEN** the README quick-start and the scaffolder point to `@nextrush/dev`, and running the `nextrush` CLI without it installed prints an actionable install message

### Requirement: Always-shipped transitive packages are documented accurately
Documentation SHALL NOT describe a package that already ships transitively with an installed
NextRush package as "install separately" in a way that implies it is absent. Where such a package
(e.g. `@nextrush/stream`, `@nextrush/runtime` via `@nextrush/adapter-node`) is optional to *use*,
the docs MUST state that it ships with the adapter and that a direct dependency entry is only
needed to import it directly.

#### Scenario: Stream/runtime are documented as shipping with the node adapter
- **WHEN** the meta-package README lists `@nextrush/stream` and `@nextrush/runtime`
- **THEN** it states they ship with `@nextrush/adapter-node` and explains a direct dependency is only required for a direct import — it does not imply they are missing from a `nextrush` install

### Requirement: Publishable package manifests follow one canonical shape
Every publishable NextRush package manifest SHALL follow one canonical shape, locked by a repo
test: an ESM `exports` map is the source of truth for entry points; no package declares the same
dependency as both a regular `dependency` and a required `peerDependency`; the non-standard
`module` field is applied consistently (either present on every publishable package or none); the
build `target` is at or above the declared `engines.node` floor; and no empty or vestigial
directory is included in the published `files` allow-list.

#### Scenario: A dependency/peer double-declaration fails the manifest lock
- **WHEN** a publishable package lists the same package in both `dependencies` and required
  `peerDependencies` (as `@nextrush/class` does for `@nextrush/core`/`@nextrush/router`)
- **THEN** the canonical-manifest lock test fails until the redundant declaration is resolved

#### Scenario: A build target below the engines floor fails the manifest lock
- **WHEN** a package's build `target` is lower than its `engines.node` floor (e.g. `node20` while `engines` is `>=22`)
- **THEN** the canonical-manifest lock test fails until they are aligned

### Requirement: Satellite packages are discoverable through a maintained catalog
The framework SHALL provide a single canonical, maintained package catalog listing every
publishable package with its tier and install command, and the `nextrush` meta-package README
SHALL link to it. The meta-package's runtime export surface MUST stay minimal — the catalog is the
discovery mechanism, not a meta-package barrel that re-exports every satellite package.

#### Scenario: A new publishable package appears in the catalog
- **WHEN** a new publishable `@nextrush/*` package is added
- **THEN** the package catalog gains an entry (name, tier, install command) and the meta README's link continues to resolve, without the package being re-exported from the meta runtime surface

# create-nextrush

> Scaffold a new NextRush project with one command - pick a style, a runtime, and a
> middleware preset, and get a working, testable app.

[![npm version](https://img.shields.io/npm/v/create-nextrush.svg)](https://www.npmjs.com/package/create-nextrush)
[![downloads](https://img.shields.io/npm/dm/create-nextrush.svg)](https://www.npmjs.com/package/create-nextrush)
[![types](https://img.shields.io/npm/types/create-nextrush.svg)](https://www.npmjs.com/package/create-nextrush)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/create-nextrush.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Scaffold a runnable NextRush project (functional, class-based, or full) in one command |
| **Package type** | Tooling |
| **Status** | Stable |
| **Included in `nextrush`?** | No - standalone install, run via `create nextrush` / `npx create-nextrush` |
| **Support tier** | Public - tooling (stable) - see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | The CLI itself runs on Node.js; it can target Node, Bun, or Deno for the *generated* project |
| **Requires** | Node `>=22` to run the CLI - ESM-only |
| **Introduced** | `v1.0.0` |

## Highlights

- Interactive prompts (directory, style, runtime, middleware, package manager, git, install) or fully non-interactive via flags / `--yes`
- 3 project styles: functional routes, class-based controllers with DI, or both combined
- 3 target runtimes: Node.js, Bun, Deno - each gets the correct adapter import and scripts
- Every emitted `@nextrush/*` dependency is resolved from its own npm registry entry at scaffold time, never proxied through another package's version

## The problem

Wiring a new NextRush project by hand means picking a routing style, choosing a runtime
adapter, adding the right middleware packages, writing a `tsconfig.json` with the correct
decorator flags, and getting `engines`/`packageManager` right in `package.json` - all before
writing a single route. Getting any of these wrong (missing `@nextrush/class` as an explicit
dependency for a class-based project, or a `tsconfig.json` missing `isolatedModules` under
the SWC-based dev toolchain) produces a working-looking project that fails on the second
change, not the first.

## When to use

**Use `create-nextrush` if:**

- You are starting a new NextRush project from nothing
- You want a working, testable example (with a real unit test) instead of an empty skeleton
- You are not sure yet whether you want functional routes, class-based controllers, or both

**Reach for something else if:**

- You already have a project and only need one package - `pnpm add @nextrush/<name>` directly
- You want the framework itself, not the scaffolder - see [`nextrush`](https://github.com/0xTanzim/nextRush/tree/main/packages/nextrush)

---

## Installation

There is nothing to install ahead of time - your package manager fetches `create-nextrush`
on demand when you run the `create` command:

```bash
pnpm create nextrush my-app
npm create nextrush my-app
yarn create nextrush my-app
bun create nextrush my-app
```

`create nextrush` (two words, with a space) is the form your package manager expands into
the npm package `create-nextrush` (hyphenated). Both forms exist and do the same thing:

```bash
# same CLI, invoked by its literal package name instead of the "create" convention
npx create-nextrush@latest my-app
pnpm dlx create-nextrush@latest my-app
bunx create-nextrush my-app
```

> [!NOTE]
> Pin a version with the `@` **after `nextrush`**, not after `create`:
> `npm create nextrush@latest` is correct; `npm create@latest nextrush` is not what you want.
> `pnpm dlx create nextrush` (two words after `dlx`) does not resolve - use
> `pnpm dlx create-nextrush` or `pnpm create nextrush` instead.

## Quick start

```bash
pnpm create nextrush my-app
cd my-app
pnpm dev
```

Answer the four prompts (directory, style, runtime, middleware) or skip them entirely with
flags:

```bash
pnpm create nextrush my-app --style functional --runtime node --middleware api --yes
```

The scaffolder writes the project, then (unless disabled) runs `git init` + an initial commit
and installs dependencies with your detected package manager.

## Capabilities

**Capabilities**
- **3 project styles** - `functional` (a layered API: routes → services → repositories
  with centralized config, shared types, and middleware), `class-based` (controllers + DI
  under `/api` via `@Module`/`registerModule`), `full` (functional routes + a class-based
  module graph + a shared error-handling middleware, with controllers under `/api`)
- **3 target runtimes** - `node` (built-in adapter), `bun` (`@nextrush/adapter-bun`), `deno`
  (`@nextrush/adapter-deno`) - each emits the correct import and `package.json` scripts
- **3 middleware presets** - `minimal` (none), `api` (`cors`, `body-parser`, `helmet`), `full`
  (adds `rate-limit`, `compression`, `request-id`)
- **Live dependency resolution** - every emitted `@nextrush/*` (and `nextrush` itself) version
  is probed against the npm registry at scaffold time; a failed probe falls back to a
  build-time-pinned version for that package only, never another package's fallback

**Developer experience**
- **Non-interactive mode** - every prompt has a corresponding flag, so CI/scripting never
  needs a TTY
- **Generated example test** - every style ships at least one real `vitest` unit test, not a
  placeholder
- **Self-describing README** - the generated project's own `README.md` lists its file tree by
  reading back the exact files the generator wrote, so it cannot drift from what was scaffolded

## Mental model

The CLI is a pure generator wrapped in a small amount of I/O: prompts resolve a
`ProjectOptions` object, `generateProject()` turns that object into an in-memory file map with
no disk access, and only the final step writes the map to disk.

```text
prompts/flags --> ProjectOptions --> generateProject() --> FileMap (in memory)
                                                                |
                                                                +-- writeFiles() to disk
```

**Rule:** nothing before `writeFiles()` touches the filesystem - `generateProject()` is a pure
function of its input, which is what makes the three styles exhaustively testable without a
real disk.

> [!TIP]
> The full scaffold-generation sequence (Mermaid) is in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Scaffold a functional-style API

```bash
pnpm create nextrush my-api --style functional --middleware api --yes
```

Generates `src/index.ts`, `src/config/index.ts` (centralized env config), `src/lib/types.ts`
(shared domain types), `src/middleware/logger.ts` (request-logging middleware), a functional
health route (`src/routes/health.routes.ts` calling `src/services/health.service.ts`), a full
layered todos CRUD (`src/routes/todos.routes.ts` → `src/services/todos.service.ts` →
`src/repositories/todos.repository.ts` — params, query, body, response codes, 400/404 error
paths via `NotFoundError`/`BadRequestError` from `nextrush`), and unit tests for both the
service and repository layers.

### Scaffold a class-based project with DI

```bash
pnpm create nextrush my-api --style class-based --middleware api --yes
```

Generates a feature-module scaffold: `src/index.ts` (which calls `registerModule(app,
AppModule)` under prefix `/api`), a root `src/app.module.ts` composing feature modules via
`@Module({ imports })`, and two feature modules under `src/modules/`:

- `health/` — minimal controller + service with constructor DI.
- `todos/` — full CRUD (`@Get`/`@Post`/`@Delete` with `@Param`/`@Body`/`@Query`,
  `@HttpCode`, `@Repository`, `HttpError` validation paths) plus unit tests.

Use `--middleware minimal` to omit the body-parser/cors/helmet presets; note `@Body()`
requires a body-parser (`app.use(json())`), which ships with the default `api` preset.

### Target Bun or Deno instead of Node

```bash
pnpm create nextrush my-api --runtime bun --yes
pnpm create nextrush my-api --runtime deno --yes
```

Swaps the entrypoint's server import for the matching adapter package and adjusts the
generated `package.json` scripts (Bun runs the CLI via `bun nextrush dev`; Deno runs it via
`deno run` with an explicit, minimal permission set - never a blanket `-A`).

### Scaffold without prompts, git, or install

```bash
pnpm create nextrush my-api --yes --no-git --no-install
```

## API overview

The published package has no importable API - `create-nextrush` is a CLI-only package. Its
entire public surface is the command-line interface documented below.

| Flag | Short | Values | Default | Description |
| ---- | ----- | ------ | ------- | ------------ |
| `--style` | `-s` | `functional`, `class-based`, `full` | `functional` | Project style |
| `--runtime` | `-r` | `node`, `bun`, `deno` | `node` | Target runtime for the generated project |
| `--middleware` | `-m` | `minimal`, `api`, `full` | `api` | Middleware preset |
| `--pm` | | `npm`, `pnpm`, `yarn`, `bun` | auto-detected | Package manager for install/run scripts |
| `--install` | `-i` | - | `true` | Install dependencies after scaffolding |
| `--no-install` | | - | - | Skip dependency installation |
| `--git` | | - | `true` | Initialize a git repository and create an initial commit |
| `--no-git` | | - | - | Skip git initialization |
| `--yes` | `-y` | - | `false` | Accept all defaults, skip interactive prompts |
| `--version` | `-v` | - | - | Print the CLI version |
| `--help` | `-h` | - | - | Print usage |

## Options

No configuration file - every option above is a CLI flag or an interactive prompt answer.
There is no persisted config; each scaffold run is independent.

## Compatibility

**Requirements**

| Requirement | Version |
| ----------- | ------- |
| Node.js (to run the CLI) | `>=22.0.0` |
| Generated project's Node.js floor | `>=22.0.0` (written into the generated `package.json`) |

**Runtimes (of the generated project, not the CLI)**

| Runtime | Supported | Notes |
| ------- | --------- | ----- |
| Node.js `>=22` | Yes | Built-in adapter, no extra dependency |
| Bun | Yes | Adds `@nextrush/adapter-bun` |
| Deno | Yes | Adds `@nextrush/adapter-deno`; scripts run through `nextrush dev`/`build`, not a raw `deno run` on the entry file |

**Integration**
- **Peer dependencies:** none
- **Works with:** any of the 4 package managers it detects or is told to use (`npm`, `pnpm`, `yarn`, `bun`)
- **Incompatible with:** nothing - the CLI itself has no NextRush runtime dependency

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** - no CommonJS build. On Node `>=22`, CJS consumers can
> `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong>"Unable to resolve a version for package ..." during scaffolding</strong></summary>

**Cause:** the CLI could not reach the configured npm registry for that specific package, and
no build-time fallback version exists for it - this only happens if a new `@nextrush/*`
package was added to the scaffolder without a matching fallback entry.

**Fix:** check network access to the registry (`npm_config_registry` if you have one
configured), or retry once connectivity is restored. This is a scaffolder defect if it
happens on a stock, unmodified release - report it.

</details>

<details>
<summary><strong>Git initialization or dependency install "failed - see the error above"</strong></summary>

**Cause:** `git init`/`git add`/`git commit`, or the package manager's install command,
exited non-zero (for example, no `git` on `PATH`, or a network-restricted install).

**Fix:** the CLI prints the exact command to retry manually once the underlying issue (missing
tool, network) is resolved - the scaffolded files themselves are already written and are not
affected by a failed git/install step.

</details>

## FAQ

**Can I skip the interactive prompts?**
Yes - pass `--yes` to accept every default, or supply `--style`/`--runtime`/`--middleware`
directly; any flag you provide is used instead of the corresponding prompt.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno?**
The CLI itself requires Node.js `>=22` to run (it uses Node's `child_process` and `fs` APIs
directly). The *generated project* can target Bun or Deno via `--runtime bun` / `--runtime deno`.

**What if my target directory is not empty?**
The CLI asks for confirmation before writing into a non-empty directory; declining cancels the
scaffold with no files written.

---

## Package relationships

```text
                 depends on            @clack/prompts (interactive prompts, its only runtime dependency)
create-nextrush --------------->
                 scaffolds a project that depends on   nextrush, @nextrush/class, @nextrush/dev, and the middleware/adapter packages the user selected
                 usually used next     nextrush (the framework itself, inside the generated project)
```

- **Depends on:** `@clack/prompts` - the only runtime dependency of the CLI itself
- **Scaffolds projects that depend on:** [`nextrush`](https://github.com/0xTanzim/nextRush/tree/main/packages/nextrush), [`@nextrush/class`](https://github.com/0xTanzim/nextRush/tree/main/packages/class) (class-based/full styles only), [`@nextrush/dev`](https://github.com/0xTanzim/nextRush/tree/main/packages/dev), and whichever middleware/adapter packages the chosen preset/runtime selects
- **Usually used next:** the generated project's own `README.md`, which documents the exact commands for that scaffold
- **Alternative:** manually running `pnpm add nextrush` and writing the app by hand - see the [Quick Start in the root README](https://github.com/0xTanzim/nextRush#quick-start)

## Architecture

Maintaining or contributing to this package? The internal design - the pure
`generateProject()` pipeline, the three style templates, and the version-resolution flow - is
in **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**.

## Resources

- Learn - [Documentation](https://0xtanzim.github.io/nextRush/docs) - [Architecture](./ARCHITECTURE.md) - [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- Changelog - [CHANGELOG.md](./CHANGELOG.md)
- Report an issue - [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- Contribute - [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)

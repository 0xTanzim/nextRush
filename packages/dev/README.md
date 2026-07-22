# @nextrush/dev

> Development server and build tools for NextRush with multi-runtime support.

**Support tier:** Public - tooling (stable). See [ADR-0005](../../docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md).

## Quick Start

```bash
# Install
pnpm add -D @nextrush/dev

# Start development server (auto-detects everything)
nextrush dev

# Build for production
nextrush build
```

That's it! No configuration needed. The CLI auto-detects:

- Entry file (`src/index.ts`, `src/main.ts`, etc.)
- Runtime (Node.js, Bun, or Deno)
- TypeScript settings from `tsconfig.json`

## The Problem

TypeScript decorators with dependency injection require **`emitDecoratorMetadata`** to work. This compiler option emits type information at runtime:

```typescript
// This TypeScript:
@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}
}

// Needs to emit this metadata:
Reflect.metadata('design:paramtypes', [UserService]);
```

Without this metadata, the DI container cannot resolve constructor parameters:

```
TypeInfo not known for UserController
```

### The Problem with Modern Bundlers

Most modern bundlers **strip types without emitting decorator metadata**:

| Tool                 | Speed         | Decorator Metadata | DI Works? |
| -------------------- | ------------- | ------------------ | --------- |
| `tsup` / `esbuild`   | Fast          | Not emitted         | No        |
| `tsx`                | Fast          | Not emitted         | No        |
| `node --strip-types` | Fast          | Not emitted         | No        |
| `tsc`                | Slow (build step) | Emitted         | Yes       |
| **`nextrush dev`**   | Fast          | Emitted             | Yes       |
| **`nextrush build`** | Fast          | Emitted             | Yes       |

## Installation

```bash
pnpm add -D @nextrush/dev
```

## Commands

### `nextrush dev` - Development Server

Start a development server with auto-restart on change and decorator support.
(Changes trigger a full process restart via the runtime's native watcher - this
is auto-restart, not state-preserving HMR.)

```bash
# Auto-detects entry file
nextrush dev

# Specify entry file
nextrush dev ./src/server.ts

# Custom port
nextrush dev --port 4000

# Enable debugger
nextrush dev --inspect
```

**Options:**

| Option           | Alias | Default | Description                 |
| ---------------- | ----- | ------- | --------------------------- |
| `--port`         | `-p`  | `8080`  | Port number (`PORT` env when `--port` omitted) |
| `--watch`        | `-w`  | `src`   | Paths to watch (repeatable) |
| `--inspect`      | -     | `false` | Enable Node.js inspector    |
| `--inspect-port` | -     | `9229`  | Inspector port              |
| `--no-clear`     | -     | -       | Don't clear screen on start |
| `--verbose`      | `-v`  | `false` | Verbose output              |

### `nextrush build` - Production Build

Build for production with SWC, emitting decorator metadata.

```bash
# Build with defaults
nextrush build

# Custom output directory
nextrush build --outDir dist

# Minify output
nextrush build --minify

# Target ES2020
nextrush build --target es2020
```

**Options:**

| Option                    | Alias | Default  | Description                  |
| ------------------------- | ----- | -------- | ---------------------------- |
| `--outDir`                | `-o`  | `dist`   | Output directory             |
| `--target`                | `-t`  | `es2022` | Target ES version            |
| `--sourcemap`             | -     | `true`   | Generate sourcemaps          |
| `--no-sourcemap`          | -     | -        | Disable sourcemaps           |
| `--minify`                | `-m`  | `false`  | Minify output                |
| `--no-decorator-metadata` | -     | -        | Skip decorator metadata      |
| `--dts` / `--no-dts`      | -     | `--dts`  | Emit `.d.ts` declarations (fails the build on error unless `--no-dts`) |
| `--no-cache`              | -     | -        | Bypass the incremental build cache |
| `--no-clean`              | -     | -        | Don't clean output directory |
| `--verbose`               | `-v`  | `false`  | Verbose output               |

### `nextrush generate` - Code Generator

Generate controllers, services, middleware, guards, and routes.

```bash
# Generate a controller class
nextrush generate controller user

# Short alias
nextrush g controller user

# Generate all types
nextrush g s user-profile        # Service
nextrush g mw logger             # Middleware
nextrush g guard auth            # Guard
nextrush g r products            # Route
```

**Types:**

| Type         | Alias | Output Path                            | Style       |
| ------------ | ----- | -------------------------------------- | ----------- |
| `controller` | `c`   | `src/controllers/<name>.controller.ts` | Class-based |
| `service`    | `s`   | `src/services/<name>.service.ts`       | Class-based |
| `middleware` | `mw`  | `src/middleware/<name>.ts`             | Functional  |
| `guard`      | `g`   | `src/guards/<name>.guard.ts`           | Functional  |
| `route`      | `r`   | `src/routes/<name>.ts`                 | Functional  |

**Generated Controller Example:**

```typescript
// nextrush g controller user -> src/controllers/user.controller.ts
import { Controller, Get, Post, Body, Param } from 'nextrush/class';

@Controller('/user')
export class UserController {
  @Get()
  async findAll() {
    return [];
  }

  @Get('/:id')
  async findOne(@Param('id') id: string) {
    return { id };
  }

  @Post()
  async create(@Body() data: unknown) {
    return data;
  }
}
```

**Generated Service Example:**

```typescript
// nextrush g s order -> src/services/order.service.ts
import { Service } from 'nextrush/class';

@Service()
export class OrderService {
  async findAll() {
    return [];
  }

  async findOne(id: string) {
    return { id };
  }

  async create(data: unknown) {
    return data;
  }
}
```

**Naming Rules:**

- Use lowercase letters, numbers, and hyphens: `user`, `user-profile`, `v2`
- Multi-word names are converted to PascalCase: `user-profile` -> `UserProfileController`
- Duplicate file detection: won't overwrite existing files

### `nextrush generate adapter` - Scaffold a Runtime Adapter

A distinct, multi-file scaffold (not a single-file generator): creates a
contract-conformant adapter package skeleton under `<name>/` - source stub,
conformance test wired to the shared suite, fixtures, README, and a CI snippet.

```bash
nextrush generate adapter my-runtime
nextrush g ad my-runtime
```

| Type      | Alias | Output              | Contents                                                    |
| --------- | ----- | -------------------- | ------------------------------------------------------------ |
| `adapter` | `ad`  | `<name>/` (directory) | `src/adapter.ts`, `src/__tests__/conformance.test.ts`, `fixtures/`, `README.md`, CI snippet |

### `nextrush codemod` - Automated Code Transformations

Runs a codemod against files matching a glob pattern.

```bash
nextrush codemod consolidate-imports src/**/*.ts

# Preview changes without writing to disk
nextrush codemod consolidate-imports 'src/**/*.{ts,tsx}' --dry-run
```

**Available codemods:**

| Codemod                | What it does                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `consolidate-imports`   | Rewrites `@nextrush/decorators` and `@nextrush/controllers` imports to `nextrush/class`, merging and deduplicating; leaves `@nextrush/di` untouched |

**Options:**

| Option      | Default | Description                          |
| ----------- | ------- | ------------------------------------- |
| `--dry-run` | `false` | Preview changes without writing to disk |

The rewrite is surgical: only the matched import statements are touched. A leading
license/header comment, unrelated imports, and all other code are preserved
byte-for-byte - the file is never reprinted whole.

## Package.json Scripts

```json
{
  "scripts": {
    "dev": "nextrush dev",
    "build": "nextrush build",
    "start": "node dist/index.js",
    "generate": "nextrush generate"
  }
}
```

## Multi-Runtime Support

The CLI automatically detects and adapts to your runtime environment:

| Runtime     | Dev Server              | Production Build  | Decorator Metadata |
| ----------- | ----------------------- | ----------------- | ------------------ |
| **Node.js** | Yes - `@swc-node/register` | Yes - @swc/core      | Yes - Full support    |
| **Bun**     | Yes - Native `--watch`     | Yes - Native bundler | Yes - Full support    |
| **Deno**    | Yes - Native `--watch`     | Yes - npm:@swc/core  | Yes - Full support    |

### How It Works

**Node.js:**

- Dev: Uses `@swc-node/register` for SWC-powered TypeScript execution with decorator metadata
- Build: Uses `@swc/core` transform API with `decoratorMetadata: true`

**Bun:**

- Dev: Native TypeScript execution with `bun --watch`
- Build: Native `Bun.build()` bundler (preserves decorator metadata!)

**Deno:**

- Dev: Native TypeScript execution with `deno run --watch`
- Build: Uses `npm:@swc/core` for consistent decorator metadata emission

### Runtime Detection

```typescript
import { detectRuntime, getRuntimeInfo } from '@nextrush/dev';

const runtime = detectRuntime(); // 'node' | 'bun' | 'deno'
const info = getRuntimeInfo();
// {
//   runtime: 'node',
//   version: '22.0.0',
//   supportsTypeScript: false,
//   supportsWatch: true,
//   needsSwc: true
// }
```

### Deno Permissions

`nextrush dev` spawns Deno with a fixed default permission set:
`--allow-net --allow-read --allow-env`. If your app needs more (writing files,
FFI, spawning subprocesses, ...), extend the default set via `nextrush.config.ts`:

```typescript
// nextrush.config.ts
import type { NextRushConfig } from '@nextrush/dev';

export default {
  dev: {
    deno: {
      permissions: ['--allow-write', '--allow-ffi'],
    },
  },
} satisfies NextRushConfig;
```

Configured permissions are **merged into** the default set - they extend it, they
never replace it. `--allow-net`, `--allow-read`, and `--allow-env` are always present
even when you add more; a permission you configure that's already in the default set
is simply not duplicated. Scoped forms are supported as pass-through strings, e.g.
`--allow-read=./data` or `--allow-write=./dist`.

Each configured value must begin with `--allow-` or `--deny-`. An invalid value
(missing that prefix) fails the command before Deno is spawned, naming the offending
value in the error.

> **Adding permissions weakens Deno's sandbox.** Only grant what your application
> actually needs - never configure `--allow-all` as a default. The CLI itself never
> adds `--allow-all` automatically, and there is currently no way to *remove* a
> default permission (extend-only by design); if you genuinely need a narrower
> sandbox than the defaults, run `deno` directly instead of through `nextrush dev`.

## Programmatic API (Optional)

> **Note:** The programmatic API is optional. Most users only need the CLI commands (`nextrush dev` and `nextrush build`), which auto-detect everything.

The programmatic API is useful for:

- Build tool integration
- Custom build scripts
- Monorepo setups
- Testing frameworks

### `dev(entry?, options?): Promise<SpawnResult>`

Start the development server programmatically.

```typescript
import { dev } from '@nextrush/dev';

// Simple - auto-detect entry
await dev();

// With entry file
await dev('./src/app.ts');

// With options
await dev('./src/app.ts', {
  port: 4000,
  inspect: true,
  watch: ['./src', './config'],
  env: { DATABASE_URL: 'postgres://...' },
});
```

**DevOptions:**

| Option        | Type                     | Default   | Description           |
| ------------- | ------------------------ | --------- | --------------------- |
| `entry`       | `string`                 | auto      | Entry file path       |
| `port`        | `number`                 | `8080`    | Port number           |
| `inspect`     | `boolean`                | `false`   | Enable debugger       |
| `inspectPort` | `number`                 | `9229`    | Debugger port         |
| `watch`       | `string[]`               | `['src']` | Watch paths           |
| `env`         | `Record<string, string>` | `{}`      | Environment variables |
| `clearScreen` | `boolean`                | `true`    | Clear screen on start |
| `verbose`     | `boolean`                | `false`   | Verbose output        |

### `build(entry?, options?): Promise<void>`

Build for production programmatically.

```typescript
import { build } from '@nextrush/dev';

// Simple
await build();

// With options
await build('./src/index.ts', {
  outDir: 'dist',
  minify: true,
  sourcemap: true,
  target: 'es2022',
});
```

**BuildOptions:**

| Option              | Type      | Default    | Description             |
| ------------------- | --------- | ---------- | ----------------------- |
| `entry`             | `string`  | auto       | Entry file path         |
| `outDir`            | `string`  | `'dist'`   | Output directory        |
| `target`            | `string`  | `'es2022'` | ES target               |
| `sourcemap`         | `boolean` | `true`     | Generate sourcemaps     |
| `minify`            | `boolean` | `false`    | Minify output           |
| `decoratorMetadata` | `boolean` | `true`     | Emit decorator metadata |
| `clean`             | `boolean` | `true`     | Clean output first      |
| `verbose`           | `boolean` | `false`    | Verbose output          |

## Auto-Detection

Entry file detection order:

1. `package.json` `main` or `module` field (converts `dist/` to `src/`, `.js` to `.ts`)
2. `src/index.ts`
3. `src/main.ts`
4. `src/app.ts`
5. `src/server.ts`
6. `index.ts`
7. `main.ts`
8. `app.ts`
9. `server.ts`

## Requirements

- Node.js >= 22.0.0 (for native `--watch` support)
- `tsconfig.json` with:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## Why Not Use tsup/esbuild?

**tl;dr**: They don't emit decorator metadata, breaking DI.

```typescript
// Your code
@Service()
class UserService {
  constructor(private db: Database) {}
}

// After tsup/esbuild (metadata LOST):
let UserService = class {
  constructor(db) {}
};

// After nextrush build (metadata PRESERVED):
let UserService = class {
  constructor(db) {}
};
Reflect.defineMetadata('design:paramtypes', [Database], UserService);
```

The `nextrush build` command uses SWC with `decoratorMetadata: true`, which properly emits the reflection metadata required by tsyringe and other DI containers.

## API Reference

### Runtime Detection

```typescript
import {
  detectRuntime, // () => 'node' | 'bun' | 'deno'
  getRuntimeInfo, // () => RuntimeInfo
  isNode, // () => boolean
  isBun, // () => boolean
  isDeno, // () => boolean
} from '@nextrush/dev';
```

### Configuration

```typescript
import {
  findEntry, // () => string
  loadConfig, // () => Promise<NextRushConfig>
  getDefaultWatchPaths, // () => string[]
} from '@nextrush/dev';
```

### Code Generation

```typescript
import {
  generate, // (type, name, cwd?) => Promise<string>
  generateCli, // (args: string[]) => Promise<void>
  GENERATOR_TYPES, // ['controller', 'service', 'middleware', 'guard', 'route']
} from '@nextrush/dev';

// Programmatic usage
const filePath = await generate('controller', 'user', process.cwd());
```

## Production Readiness

### Current Status: Beta

Every row below is backed by a permanent, real-runtime regression test - not asserted.
"Stable" means the behavior is proven under CI on that runtime; "Experimental" means it
runs but has no automated regression guard yet.

| Feature       | Status         | Evidence                                                                   |
| ------------- | -------------- | --------------------------------------------------------------------------- |
| Node.js dev   | Yes - Stable      | `dev-http-liveness.test.ts` (real HTTP response), `dev-restart-on-change.test.ts` (real `--watch` restart) |
| Node.js build | Yes - Stable      | `build-e2e-integration.test.ts`, `swc-builder-integration.test.ts` (cache, `.d.ts`, nested layout) |
| Bun dev       | Experimental | Native support; no dedicated `nextrush dev` regression test on Bun yet     |
| Bun build     | Yes - Stable      | `build-bun-decorator-integration.test.ts` - asserts `design:paramtypes` literally appears in Bun-built output |
| Deno dev      | Experimental | Native support; no dedicated `nextrush dev` regression test on Deno yet    |
| Deno build    | Yes - Stable      | `build-deno-integration.test.ts` - asserts non-empty, correctly-mapped `.js` output under real Deno |
| Generate      | Yes - Stable      | `generators/*.test.ts` - all 5 generator types                             |

Bun/Deno `build` and `dev` regression tests run in CI on their real binaries via the
`dev-tooling-cross-runtime` job in `runtime-conformance.yml` (pinned Deno 2.6.3 / Bun 1.3.14).

### All Runtimes Support Decorator Metadata

Decorator metadata emission is verified, not asserted, on every runtime `nextrush build` targets:

- **Node.js**: `@swc/core` transform API - `swc-builder-integration.test.ts`
- **Bun**: native bundler preserves `Reflect.metadata`/`design:paramtypes` - `build-bun-decorator-integration.test.ts`
- **Deno**: `npm:@swc/core` via the `npm:` specifier - `build-deno-integration.test.ts`

### Architecture Documentation

For a deep dive into how this package works, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## License

MIT (c) NextRush Team

## Behavior & Cross-Platform Notes

- **Auto-restart, not HMR.** `nextrush dev` uses the runtime's native watcher
  (`node --watch`, `bun --watch`, `deno run --watch`). A change restarts the
  process; module state is not preserved.
- **Watch paths are honored per runtime.** `--watch <path>` (repeatable) maps to
  `node --watch-path=<path>`, `deno --watch=<paths>`; on Bun (no path-scoped
  watch) it warns and falls back to watching imported files.
- **Flags accept `--flag=value` and `--flag value`.** Unknown flags are a hard
  error (non-zero exit), not silently ignored.
- **Cross-platform.** The SWC dev loader is resolved as a `file://` URL (correct
  on Windows), path handling uses `node:path`, and Node child processes are
  spawned via the running Node binary - no reliance on `npx`/PATH shims.
- **Declarations are deterministic.** `.d.ts` files are generated with the
  project's locally-installed TypeScript (no `npx`, no network); a declaration
  failure fails the build unless `--no-dts` is passed.
- **Safe cleaning.** `nextrush build` refuses to clean an output directory that
  is the project root, an ancestor, the source directory, or outside the project.
- **Output is ESM** (`module: es6`); `.ts`/`.tsx` -> `.js`, `.mts` -> `.mjs`,
  `.cts` -> `.cjs`. An incremental content-hash cache skips unchanged files
  (`--no-cache` to bypass).

## Monorepo / Workspace Build Scoping

`nextrush build` resolves its scan root to the nearest enclosing `package.json`
directory - walking upward from the entry file's own directory (e.g. from `src/` for
the common `src/index.ts` layout) until it finds one. That directory is the package
boundary: the scan never ascends above it, and any subdirectory *inside* the scanned
tree that carries its **own** `package.json` is excluded entirely - a nested or
vendored package is never pulled into the current package's build output.

```
my-package/
|-- package.json          <- scan root resolves here (not src/)
|-- config.ts             Yes - scanned - sibling of src/, at the package root
|-- src/
|   |-- index.ts          Yes - scanned
|   |-- utils.ts          Yes - scanned
|   `-- vendor/
|       |-- package.json  Excluded - this makes `vendor/` a separate package -
|       `-- lib.ts            excluded entirely, never descended into
`-- dist/                  (build output)
```

In a pnpm/npm/Turborepo workspace, a sibling package (e.g. `packages/other-package`
next to `packages/my-package`) is excluded because the scan stops ascending the moment
it finds `packages/my-package/package.json` - it never continues upward into the
workspace root or sideways into a directory outside that boundary. If no
`package.json` can be found anywhere above the entry file (an unusual, non-package
layout), the build falls back to scanning from the entry's own directory - the
behavior this feature builds on. This holds for every layout: single-package
projects, workspace packages, and projects with no `package.json` at all (which
scan exactly as they did before this feature).

**In short:** if you have a directory nested inside your source tree that is its
own package (has its own `package.json`), it is always excluded from the build -
this is intended, not a bug, and there is no config flag to change it.

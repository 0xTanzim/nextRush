# @nextrush/dev Architecture

> Deep dive into how the NextRush development tooling works under the hood.

## Table of Contents

- [Overview](#overview)
- [The Decorator Metadata Problem](#the-decorator-metadata-problem)
- [Runtime Architecture](#runtime-architecture)
- [Development Server (`nextrush dev`)](#development-server-nextrush-dev)
- [Production Build (`nextrush build`)](#production-build-nextrush-build)
- [SWC Integration](#swc-integration)
- [Multi-Runtime Support](#multi-runtime-support)
- [File Structure](#file-structure)
- [Production Readiness](#production-readiness)

---

## Overview

`@nextrush/dev` provides development and build tooling for NextRush applications with a critical focus on **decorator metadata emission** - essential for dependency injection systems.

### Core Problem Solved

Modern TypeScript bundlers (esbuild, tsup, swc-cli without config) strip type information during compilation. This breaks dependency injection:

```typescript
// Source TypeScript
@Service()
class UserService {
  constructor(private db: Database) {}  // ← DI needs to know this is 'Database'
}

// After esbuild/tsup (BROKEN)
let UserService = class { constructor(db) {} };
// No type info! DI can't resolve 'Database'

// After nextrush build (CORRECT)
let UserService = class { constructor(db) {} };
Reflect.defineMetadata("design:paramtypes", [Database], UserService);
// ✅ DI can now resolve 'Database'
```

---

## The Decorator Metadata Problem

### What is `emitDecoratorMetadata`?

TypeScript's `emitDecoratorMetadata` compiler option emits runtime type information:

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true  // ← This is the magic
  }
}
```

This causes TypeScript to emit `Reflect.defineMetadata` calls that store:
- `design:type` - Property type
- `design:paramtypes` - Constructor parameter types
- `design:returntype` - Method return type

### Which Tools Support It?

| Tool | Decorator Metadata | Speed | Use Case |
|------|-------------------|-------|----------|
| `tsc` | ✅ Yes | 🐢 Slow | Reference compiler |
| `@swc/core` | ✅ Yes | ⚡ Fast | Production builds |
| `esbuild` | ❌ No | ⚡ Fast | Non-DI projects |
| `tsup` | ❌ No | ⚡ Fast | Non-DI projects |
| `tsx` | ❌ No | ⚡ Fast | Development only |
| `Bun.build()` | ✅ Yes | ⚡ Fast | Bun production builds |
| `Deno` | ❌ No | ⚡ Fast | Use npm:@swc/core |

**Why SWC?**

SWC is the only fast compiler that supports `emitDecoratorMetadata`. It's:
- Written in Rust (fast)
- Supports full TypeScript syntax
- Properly emits decorator metadata
- Used by Next.js, Parcel, Deno

---

## Runtime Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         @nextrush/dev                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────────┐    ┌─────────────────┐                        │
│   │  nextrush dev   │    │  nextrush build │                        │
│   │  (Development)  │    │  (Production)   │                        │
│   └────────┬────────┘    └────────┬────────┘                        │
│            │                      │                                  │
│            ▼                      ▼                                  │
│   ┌─────────────────────────────────────────┐                       │
│   │        Runtime Detection                 │                       │
│   │   detectRuntime() → 'node'|'bun'|'deno' │                       │
│   └────────────────────┬────────────────────┘                       │
│                        │                                             │
│            ┌───────────┼───────────┐                                │
│            ▼           ▼           ▼                                │
│   ┌────────────┐ ┌──────────┐ ┌──────────┐                         │
│   │   Node.js  │ │   Bun    │ │   Deno   │                         │
│   └─────┬──────┘ └────┬─────┘ └────┬─────┘                         │
│         │             │            │                                 │
│         ▼             ▼            ▼                                 │
│   ┌─────────────────────────────────────────┐                       │
│   │     Runtime-Specific Implementation      │                       │
│   │                                          │                       │
│   │ Dev:                                     │                       │
│   │   Node.js: node --watch + tsx/swc-node  │                       │
│   │   Bun:     bun --watch (native)         │                       │
│   │   Deno:    deno run --watch (native)    │                       │
│   │                                          │                       │
│   │ Build:                                   │                       │
│   │   Node.js: @swc/core transform()        │                       │
│   │   Bun:     Bun.build() native           │                       │
│   │   Deno:    @swc/core via npm:           │                       │
│   └─────────────────────────────────────────┘                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Development Server (`nextrush dev`)

### How It Works

```
User runs: nextrush dev
              │
              ▼
┌──────────────────────────────────────┐
│ 1. Detect Runtime                     │
│    - Check globalThis.Bun             │
│    - Check globalThis.Deno            │
│    - Default to Node.js               │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ 2. Find Entry File                    │
│    - Check package.json main          │
│    - Check src/index.ts               │
│    - Check src/main.ts                │
│    - Check index.ts                   │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ 3. Start Dev Server (Runtime-Specific)│
└──────────────────┬───────────────────┘
                   │
     ┌─────────────┼─────────────┐
     ▼             ▼             ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Node.js │  │   Bun   │  │  Deno   │
└────┬────┘  └────┬────┘  └────┬────┘
     │            │            │
     ▼            ▼            ▼
```

### Node.js Development

```bash
# What happens when you run:
nextrush dev

# Under the hood (default — no explicit --watch):
node --import <@nextrush/dev SWC loader> \
     --watch \
     src/index.ts

# With explicit watch paths (nextrush dev --watch ./src):
node --import <@nextrush/dev SWC loader> \
     --watch-path=./src \
     src/index.ts
```

**Components:**
- `--import <SWC loader>`: `@nextrush/dev`'s loader registers `@swc-node/register`, so TypeScript
  is transpiled on import **with `emitDecoratorMetadata`** — required for DI. This is the only
  TypeScript mechanism used on Node; `tsx` / `--experimental-strip-types` are NOT used (they do
  not emit decorator metadata).
- `--watch`: Node's native watcher (imported files) — the portable default across all platforms.
- `--watch-path=<dir>`: used only when explicit `--watch <path>` args are given, guarded with a
  fallback to bare `--watch` where the platform/Node version does not support it (see RFC-019).

**Why the SWC loader (not `tsx`)?**
- `tsx`/esbuild strip types WITHOUT emitting decorator metadata, so DI silently breaks.
- `@swc-node/register` (via the loader) emits `design:paramtypes`, which the DI container needs.

### Bun Development

```bash
# What happens:
nextrush dev

# Under the hood:
bun --watch src/index.ts
```

**Why Bun is simpler:**
- Native TypeScript support
- Native watch mode
- Native decorator support
- No additional loaders needed

### Deno Development

```bash
# What happens:
nextrush dev

# Under the hood:
deno run \
     --watch \
     --allow-net --allow-read --allow-env \
     src/index.ts
```

**Deno specifics:**
- `--watch`: Deno's native file watching.
- Permissions: a fixed, minimal default set — `--allow-net --allow-read --allow-env`. The CLI
  **never** grants `--allow-all`. A project may EXTEND (never replace) this set via
  `nextrush.config.ts` (`dev.deno.permissions`); an invalid flag fails fast before Deno is spawned.
- Native TypeScript support.

---

## Production Build (`nextrush build`)

### How It Works

```
User runs: nextrush build
              │
              ▼
┌──────────────────────────────────────┐
│ 1. Detect Runtime & Options           │
│    - Parse CLI arguments              │
│    - Load tsconfig.json               │
│    - Determine output settings        │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ 2. Clean Output Directory             │
│    - Remove existing dist/            │
│    - Create fresh directory           │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ 3. Find TypeScript Files              │
│    - Scan source directory            │
│    - Exclude tests, node_modules      │
│    - Build file list                  │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ 4. Transform Files (Runtime-Specific) │
└──────────────────┬───────────────────┘
                   │
     ┌─────────────┼─────────────┐
     ▼             ▼             ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Node.js │  │   Bun   │  │  Deno   │
│ @swc/   │  │ Bun.    │  │ npm:    │
│ core    │  │ build() │  │ @swc/   │
│         │  │         │  │ core    │
└────┬────┘  └────┬────┘  └────┬────┘
     │            │            │
     ▼            ▼            ▼
┌──────────────────────────────────────┐
│ 5. Generate Declarations (tsc)        │
│    - tsc --declaration --emitOnly     │
│    - Output .d.ts files               │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ 6. Output Summary                     │
│    - File count                       │
│    - Build duration                   │
│    - Output size                      │
└──────────────────────────────────────┘
```

### Node.js Build with SWC

```typescript
// What happens in buildWithSwc():

import * as swc from '@swc/core';

for (const file of tsFiles) {
  const source = await fs.readFile(file, 'utf-8');

  const result = await swc.transform(source, {
    filename: file,
    jsc: {
      parser: {
        syntax: 'typescript',
        decorators: true,          // Enable decorator parsing
      },
      target: 'es2022',
      transform: {
        legacyDecorator: true,     // Use legacy decorators
        decoratorMetadata: true,   // ← THE CRITICAL OPTION
      },
      keepClassNames: true,        // Required for DI
    },
    module: {
      type: 'es6',
    },
    sourceMaps: true,
  });

  await fs.writeFile(outFile, result.code);
}
```

**Key SWC Options:**
- `decorators: true` - Parse decorator syntax
- `legacyDecorator: true` - Use TypeScript-style decorators
- `decoratorMetadata: true` - **CRITICAL** - Emit Reflect.defineMetadata
- `keepClassNames: true` - Preserve class names for DI resolution

### Bun Build (Native)

```typescript
// What happens in buildWithBun():

const Bun = globalThis.Bun;

const result = await Bun.build({
  entrypoints: [entryPath],
  outdir: outDir,
  target: 'bun',
  sourcemap: 'external',
  minify: false,
});
```

**✅ Bun Decorator Metadata:**
Bun's native bundler correctly preserves decorator metadata patterns.
The `Reflect.metadata` calls and `design:paramtypes` are emitted properly,
ensuring DI systems like tsyringe work correctly.

### Deno Build with SWC

```typescript
// What happens in buildWithDeno():

// Use npm: specifier for @swc/core
const swc = await import('npm:@swc/core@1.15.43');

// Then use same transform API as Node.js
const result = await swc.transform(source, {
  filename: file,
  jsc: {
    parser: { syntax: 'typescript', decorators: true },
    target: 'es2022',
    transform: {
      legacyDecorator: true,
      decoratorMetadata: true,  // ← Emits metadata!
    },
    keepClassNames: true,
  },
  module: { type: 'es6' },
  sourceMaps: true,
});
```

**✅ Deno Decorator Metadata:**
Deno build now uses `npm:@swc/core` via Deno's npm compatibility.
This properly emits decorator metadata, ensuring DI systems work correctly.

---

## SWC Integration

### What is SWC?

SWC (Speedy Web Compiler) is a Rust-based JavaScript/TypeScript compiler.

```
┌───────────────────────────────────────────────────────────────┐
│                         SWC Ecosystem                          │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                     @swc/core                            │  │
│  │  - Core Rust binary with Node.js bindings               │  │
│  │  - transform(), parse(), minify() APIs                  │  │
│  │  - Used by: Next.js, Parcel, Deno, Vite                 │  │
│  └─────────────────────────────────────────────────────────┘  │
│                              │                                 │
│              ┌───────────────┼───────────────┐                │
│              ▼               ▼               ▼                │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐     │
│  │ @swc-node/    │  │ @swc/cli      │  │ swc-loader    │     │
│  │ register      │  │               │  │               │     │
│  │               │  │ CLI tool      │  │ Webpack       │     │
│  │ Node.js       │  │ for SWC       │  │ integration   │     │
│  │ loader hook   │  │               │  │               │     │
│  └───────────────┘  └───────────────┘  └───────────────┘     │
│        │                                                       │
│        ▼                                                       │
│  Used for: Development with decorator metadata                 │
│  Command: node --import @swc-node/register app.ts             │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

### @swc/core vs @swc-node/register

| Package | Purpose | When Used |
|---------|---------|-----------|
| `@swc/core` | Programmatic compilation | Production builds |
| `@swc-node/register` | Node.js loader hook | Development server |

**Development (Node.js):**
```bash
node --import @swc-node/register src/index.ts
# ↓
# @swc-node/register intercepts .ts imports
# Compiles on-the-fly with decorator metadata
# Returns compiled JavaScript to Node.js
```

**Production Build:**
```typescript
import * as swc from '@swc/core';

// Direct API usage
const result = await swc.transform(sourceCode, options);
// Returns compiled JavaScript with decorator metadata
```

### Runtime Compatibility

SWC works across all JavaScript runtimes:

| Runtime | @swc/core | @swc-node/register | How to Use |
|---------|-----------|-------------------|------------|
| Node.js | ✅ Direct | ✅ Direct | `import('@swc/core')` |
| Bun | ✅ npm | ❌ Not needed | `import('@swc/core')` |
| Deno | ✅ npm: | ❌ Not applicable | `import('npm:@swc/core')` |

**Key Insight:**
`@swc/core` is runtime-agnostic because it's just a Rust binary with JavaScript bindings.
The npm package includes pre-built binaries for all platforms.

---

## Multi-Runtime Support

### Runtime Detection

```typescript
// src/runtime/detect.ts

export function detectRuntime(): 'node' | 'bun' | 'deno' {
  // Check for Bun
  if (typeof globalThis.Bun !== 'undefined') {
    return 'bun';
  }

  // Check for Deno
  if (typeof globalThis.Deno !== 'undefined') {
    return 'deno';
  }

  // Default to Node.js
  return 'node';
}
```

### Why Different Implementations?

Each runtime has different capabilities:

| Capability | Node.js | Bun | Deno |
|------------|---------|-----|------|
| Native TS | v22+ (strip) | ✅ Full | ✅ Full |
| Native Watch | v18+ | ✅ | ✅ |
| npm Packages | ✅ | ✅ | via npm: |
| Decorator Metadata | via SWC | Native? | via SWC |

### Node.js Specifics

Node.js requires external tools for TypeScript:

```
┌─────────────────────────────────────────────────────────────┐
│                 Node.js TypeScript Options                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Option 1: tsx (Development)                                 │
│  ────────────────────────────                               │
│  - Fast, no config                                          │
│  - No decorator metadata                                    │
│  - Good for testing basic functionality                     │
│                                                              │
│  Option 2: @swc-node/register (Development with DI)         │
│  ─────────────────────────────────────────────────         │
│  - Emits decorator metadata                                 │
│  - Required for testing DI during development               │
│  - Slightly slower startup                                  │
│                                                              │
│  Option 3: --experimental-strip-types (Node 22+)            │
│  ───────────────────────────────────────────────           │
│  - Native Node.js TS support                                │
│  - No decorator metadata (type-strip only)                  │
│  - Fallback option                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Bun Specifics

Bun has the simplest setup:

```
┌─────────────────────────────────────────────────────────────┐
│                     Bun Capabilities                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ✅ Native TypeScript execution                              │
│  ✅ Native file watching                                     │
│  ✅ Native bundling (Bun.build)                              │
│  ✅ Fast startup                                             │
│  ✅ Decorator metadata (verified!)                           │
│                                                              │
│  Development: bun --watch entry.ts                           │
│  Build: Bun.build() preserves decorator metadata             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Deno Specifics

Deno requires special handling for npm packages:

```
┌─────────────────────────────────────────────────────────────┐
│                     Deno Capabilities                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ✅ Native TypeScript execution                              │
│  ✅ Native file watching                                     │
│  ✅ npm compatibility via npm: specifier                     │
│  ✅ Decorator metadata via npm:@swc/core                     │
│                                                              │
│  Development: deno run --watch --node-modules-dir entry.ts   │
│  Build: Uses npm:@swc/core for decorator metadata            │
│                                                              │
│  How it works:                                               │
│  Deno imports @swc/core via npm: specifier and uses the      │
│  same transform() API as Node.js, ensuring consistent        │
│  decorator metadata emission across all runtimes.            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
packages/dev/
├── bin/
│   ├── nextrush.js          # CLI entry point
│   └── nextrush-dev.js      # Alternative entry
│
├── src/
│   ├── cli.ts               # CLI argument parsing
│   ├── index.ts             # Public API exports
│   │
│   ├── commands/
│   │   ├── dev.ts           # Development server logic
│   │   ├── build.ts         # Production build logic
│   │   └── index.ts         # Command registry
│   │
│   ├── runtime/
│   │   ├── detect.ts        # Runtime detection
│   │   ├── fs.ts            # Cross-runtime file system
│   │   ├── spawn.ts         # Cross-runtime process spawning
│   │   ├── node-modules.ts  # Node.js module constants
│   │   └── index.ts         # Runtime exports
│   │
│   ├── utils/
│   │   ├── config.ts        # Configuration loading
│   │   └── logger.ts        # CLI output formatting
│   │
│   └── __tests__/
│       ├── runtime-detect.test.ts
│       ├── config.test.ts
│       └── logger.test.ts
│
├── dist/                    # Compiled output
│   └── loaders/
│       └── swc-loader.mjs   # Custom SWC loader
│
├── package.json
├── tsconfig.json
├── tsup.config.ts           # Build configuration
└── vitest.config.ts         # Test configuration
```

---

## Production Readiness

### Current Status: ✅ Beta

Every row below is backed by a permanent, real-runtime regression test — not asserted.
"Stable" means the behavior is proven under CI on that runtime; "Experimental" means it
runs but has no automated regression guard yet.

| Feature | Status | Evidence |
|---------|--------|-------|
| Node.js dev | ✅ Stable | `dev-http-liveness.test.ts` (real HTTP response), `dev-restart-on-change.test.ts` (real `--watch` restart) |
| Node.js build | ✅ Stable | `build-e2e-integration.test.ts`, `swc-builder-integration.test.ts` (cache, `.d.ts`, nested layout) |
| Bun dev | 🧪 Experimental | Native support; no dedicated `nextrush dev` regression test on Bun yet |
| Bun build | ✅ Stable | `build-bun-decorator-integration.test.ts` — asserts `design:paramtypes` literally appears in Bun-built output |
| Deno dev | 🧪 Experimental | Native support; no dedicated `nextrush dev` regression test on Deno yet |
| Deno build | ✅ Stable | `build-deno-integration.test.ts` — asserts non-empty, correctly-mapped `.js` output under real Deno |
| Tests | ✅ Unit + integration | 262 tests passing (`pnpm --filter @nextrush/dev test`) |
| Documentation | ✅ Complete | README + ARCHITECTURE |

Bun/Deno `build` and `dev` regression tests run in CI on their real binaries via the
`dev-tooling-cross-runtime` job in `.github/workflows/runtime-conformance.yml` (pinned
Deno 2.6.3 / Bun 1.3.14) — see RFC-019 task 7.3.

### All Runtimes Support Decorator Metadata

Decorator metadata emission is verified, not asserted, on every runtime `nextrush build` targets:

- **Node.js**: @swc/core transform API — `swc-builder-integration.test.ts`
- **Bun**: Native `Bun.build()` preserves metadata — `build-bun-decorator-integration.test.ts`
- **Deno**: npm:@swc/core via npm specifier — `build-deno-integration.test.ts`

### Recommended Usage

```bash
# Development (any runtime)
nextrush dev              # Auto-detects runtime
bun nextrush dev          # Explicit Bun
deno run -A nextrush dev  # Explicit Deno

# Production build (any runtime)
nextrush build            # Auto-detects runtime
bun nextrush build        # Bun native bundler
deno run -A nextrush build  # Deno with npm:@swc/core
```

---

## Appendix: Decorator Metadata Deep Dive

### What Gets Emitted

```typescript
// Source
@Injectable()
class UserService {
  constructor(
    private db: DatabaseService,
    private logger: LoggerService,
  ) {}

  @Get('/users')
  async getUsers(): Promise<User[]> {
    return this.db.query('SELECT * FROM users');
  }
}

// After SWC compilation with decoratorMetadata: true
var UserService = class {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }
  async getUsers() {
    return this.db.query('SELECT * FROM users');
  }
};

// Decorator metadata (the critical part)
Reflect.defineMetadata("design:type", Function, UserService);
Reflect.defineMetadata("design:paramtypes", [
  DatabaseService,  // ← DI can now resolve this
  LoggerService,    // ← And this
], UserService);

Reflect.defineMetadata("design:returntype", Promise, UserService.prototype, "getUsers");
```

### How DI Uses It

```typescript
// Inside tsyringe/similar DI container
function resolve<T>(token: Constructor<T>): T {
  // Get constructor parameter types
  const paramTypes = Reflect.getMetadata("design:paramtypes", token);
  // paramTypes = [DatabaseService, LoggerService]

  // Recursively resolve dependencies
  const deps = paramTypes.map(dep => container.resolve(dep));

  // Create instance with resolved dependencies
  return new token(...deps);
}
```

Without `emitDecoratorMetadata`, `paramTypes` would be `undefined` and DI fails.

---

## Contributing

To contribute to the dev package:

1. **Setup**: `pnpm install`
2. **Build**: `pnpm --filter @nextrush/dev build`
3. **Test**: `pnpm --filter @nextrush/dev test`
4. **Playground**: `cd apps/playground && pnpm dev`

Focus areas:
- Deno build with npm:@swc/core
- Bun decorator metadata verification
- Integration test suite
- Documentation improvements

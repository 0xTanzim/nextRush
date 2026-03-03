# @nextrush/dev

> Development server and build tools for NextRush with multi-runtime support.

## Quick Start

```bash
# Install
pnpm add -D @nextrush/dev

# Start development server (auto-detects everything)
npx nextrush dev

# Build for production
npx nextrush build
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
| `tsup` / `esbuild`   | ⚡ Fast       | ❌ Not emitted     | ❌ No     |
| `tsx`                | ⚡ Fast       | ❌ Not emitted     | ❌ No     |
| `node --strip-types` | ⚡ Fast       | ❌ Not emitted     | ❌ No     |
| `tsc`                | 🐢 Build step | ✅ Emitted         | ✅ Yes    |
| **`nextrush dev`**   | ⚡ Fast       | ✅ Emitted         | ✅ Yes    |
| **`nextrush build`** | ⚡ Fast       | ✅ Emitted         | ✅ Yes    |

## Installation

```bash
pnpm add -D @nextrush/dev
```

## Commands

### `nextrush dev` - Development Server

Start a development server with hot reload and decorator support.

```bash
# Auto-detects entry file
npx nextrush dev

# Specify entry file
npx nextrush dev ./src/server.ts

# Custom port
npx nextrush dev --port 4000

# Enable debugger
npx nextrush dev --inspect
```

**Options:**

| Option           | Alias | Default | Description                 |
| ---------------- | ----- | ------- | --------------------------- |
| `--port`         | `-p`  | `3000`  | Port number                 |
| `--watch`        | `-w`  | `src`   | Paths to watch (repeatable) |
| `--inspect`      | -     | `false` | Enable Node.js inspector    |
| `--inspect-port` | -     | `9229`  | Inspector port              |
| `--no-clear`     | -     | -       | Don't clear screen on start |
| `--verbose`      | `-v`  | `false` | Verbose output              |

### `nextrush build` - Production Build

Build for production with SWC, emitting decorator metadata.

```bash
# Build with defaults
npx nextrush build

# Custom output directory
npx nextrush build --outDir dist

# Minify output
npx nextrush build --minify

# Target ES2020
npx nextrush build --target es2020
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
| `--no-clean`              | -     | -        | Don't clean output directory |
| `--verbose`               | `-v`  | `false`  | Verbose output               |

## Package.json Scripts

```json
{
  "scripts": {
    "dev": "nextrush dev",
    "build": "nextrush build",
    "start": "node dist/index.js"
  }
}
```

## Multi-Runtime Support

The CLI automatically detects and adapts to your runtime environment:

| Runtime     | Dev Server          | Production Build  | Decorator Metadata |
| ----------- | ------------------- | ----------------- | ------------------ |
| **Node.js** | ✅ `tsx watch`      | ✅ @swc/core      | ✅ Full support    |
| **Bun**     | ✅ Native `--watch` | ✅ Native bundler | ✅ Full support    |
| **Deno**    | ✅ Native `--watch` | ✅ npm:@swc/core  | ✅ Full support    |

### How It Works

**Node.js:**

- Dev: Uses `tsx watch` for TypeScript execution with file watching
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
| `port`        | `number`                 | `3000`    | Port number           |
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

## Production Readiness

### Current Status: Beta

This package is functional and tested across all major runtimes:

| Feature       | Status    | Notes                   |
| ------------- | --------- | ----------------------- |
| Node.js dev   | ✅ Stable | Full support            |
| Node.js build | ✅ Stable | Full decorator metadata |
| Bun dev       | ✅ Stable | Native support          |
| Bun build     | ✅ Stable | Full decorator metadata |
| Deno dev      | ✅ Stable | Native support          |
| Deno build    | ✅ Stable | Uses npm:@swc/core      |

### All Runtimes Support Decorator Metadata

All three runtimes (`nextrush build`) now properly emit decorator metadata:

- **Node.js**: @swc/core transform API
- **Bun**: Native bundler preserves metadata
- **Deno**: npm:@swc/core via npm specifier

### Architecture Documentation

For a deep dive into how this package works, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## License

MIT © NextRush Team

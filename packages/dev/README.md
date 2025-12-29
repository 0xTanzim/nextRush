# @nextrush/dev

> Development server for NextRush with full decorator and DI support.

## The Problem

TypeScript decorators with dependency injection require **`emitDecoratorMetadata`** to work. This compiler option emits type information at runtime:

```typescript
// This TypeScript:
@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}
}

// Needs to emit this metadata:
Reflect.metadata('design:paramtypes', [UserService])
```

Without this metadata, the DI container sees `undefined` for constructor parameters and fails with:
```
TypeInfo not known for UserController
```

### The Problem with Modern Runners

Most modern fast TypeScript runners **strip types without emitting decorator metadata**:

| Runtime | Speed | Decorator Metadata | DI Works? |
|---------|-------|-------------------|-----------|
| `tsx` | ⚡ Fast | ❌ Not emitted | ❌ No |
| `node --strip-types` | ⚡ Fast | ❌ Not emitted | ❌ No |
| `esbuild` | ⚡ Fast | ❌ Not emitted | ❌ No |
| `ts-node` | 🐢 Slow | ⚠️ Unreliable ESM | ⚠️ Issues |
| `tsc + node` | 🐢 Build step | ✅ Emitted | ✅ Yes |
| **nextrush-dev** | ⚡ Fast | ✅ Emitted | ✅ Yes |

## How nextrush-dev Works

`nextrush-dev` uses SWC (via `@swc-node/register`) which properly emits decorator metadata:

```bash
# Under the hood:
node --watch --import @swc-node/register/esm-register ./src/index.ts
```

SWC is:
- **Fast**: Native Rust implementation, 10-20x faster than `tsc`
- **Compatible**: Supports `emitDecoratorMetadata` and `experimentalDecorators`
- **Watch-enabled**: Uses Node.js 20+ native `--watch` for file changes

## Installation

```bash
pnpm add -D @nextrush/dev
```

## Usage

### CLI (Recommended)

```bash
# Auto-detects entry file (src/index.ts, src/app.ts, etc.)
npx nextrush-dev

# Specify entry file
npx nextrush-dev ./src/server.ts

# Custom port
npx nextrush-dev --port 4000

# Enable debugger
npx nextrush-dev --inspect
```

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "nextrush-dev",
    "dev:debug": "nextrush-dev --inspect"
  }
}
```

### Programmatic API

```typescript
import { dev } from '@nextrush/dev';

// Simple - auto-detect entry
dev();

// With entry file
dev('./src/app.ts');

// With options
dev('./src/app.ts', {
  port: 4000,
  inspect: true,
  watch: ['./src', './config'],
  env: { DATABASE_URL: 'postgres://...' },
});
```

## CLI Options

```
Usage: nextrush-dev [entry] [options]

Options:
  --port, -p <port>     Port number (default: 3000)
  --watch, -w <path>    Additional path to watch (can be used multiple times)
  --inspect             Enable Node.js inspector
  --inspect-port        Inspector port (default: 9229)
  --help, -h            Show help

Examples:
  nextrush-dev
  nextrush-dev ./src/app.ts
  nextrush-dev --port 4000
  nextrush-dev --watch ./src --watch ./config
  nextrush-dev ./src/app.ts --port 4000 --inspect
```

## Auto-Detection

If no entry file is specified, `nextrush-dev` searches for:

1. `package.json` `main` field (converted from `dist/` to `src/`)
2. `src/index.ts`
3. `src/main.ts`
4. `src/app.ts`
5. `src/server.ts`
6. `index.ts`

## Requirements

- Node.js >= 20.0.0 (for native `--watch` support)
- `tsconfig.json` with:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## Production Build

For production, compile with `tsc` and run the JavaScript:

```json
{
  "scripts": {
    "dev": "nextrush-dev",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

## When to Use What

| Use Case | Command |
|----------|---------|
| Local development | `nextrush-dev` |
| Production | `tsc && node dist/index.js` |
| CI/CD build | `tsc` |
| Testing | `vitest` (supports decorators natively) |

## API Reference

### `dev(entry?, options?): ChildProcess`

Start the development server.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `entry` | `string` | Entry file path (auto-detected if not provided) |
| `options` | `DevOptions` | Configuration options |

**DevOptions:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entry` | `string` | auto | Entry file path |
| `port` | `number` | `3000` | Port number (set as `PORT` env var) |
| `inspect` | `boolean` | `false` | Enable Node.js debugger |
| `inspectPort` | `number` | `9229` | Debugger port |
| `watch` | `string[]` | `['src']` | Paths to watch for changes |
| `env` | `Record<string, string>` | `{}` | Additional environment variables |
| `clearScreen` | `boolean` | `true` | Clear screen on restart |

**Returns:** `ChildProcess` - Node.js child process handle

### `cli(): void`

Run the CLI with `process.argv` arguments.

## License

MIT © NextRush Team

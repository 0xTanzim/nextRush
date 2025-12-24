# @nextrush/dev

> Simple dev server for NextRush - powered by tsx

No custom watchers. No complexity. Just works.

## Installation

```bash
pnpm add -D @nextrush/dev tsx
```

## Usage

### CLI (Recommended)

```bash
# Auto-detects entry file
npx nextrush-dev

# Specify entry
npx nextrush-dev ./src/app.ts

# Custom port
npx nextrush-dev --port 4000

# With debugger
npx nextrush-dev --inspect
```

### Programmatic

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
});
```

## CLI Options

```
Usage: nextrush-dev [entry] [options]

Options:
  --port, -p <port>    Port number (default: 3000)
  --inspect            Enable Node.js inspector
  --inspect-port       Inspector port (default: 9229)
  --help, -h           Show help
```

## How it works

This package simply spawns `tsx watch` under the hood:

```bash
tsx watch ./src/index.ts
```

That's it. No reinventing the wheel.

## Auto-detection

If no entry file is specified, it looks for:
1. `./src/index.ts`
2. `./src/app.ts`
3. `./src/server.ts`
4. `./index.ts`
5. `./app.ts`

## Requirements

- Node.js >= 20.0.0
- `tsx` package (bundled as dependency)

## License

MIT © NextRush Team

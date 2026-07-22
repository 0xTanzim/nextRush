# create-nextrush

> Create a new NextRush project with one command.

**Support tier:** Public — tooling (stable). See [ADR-0005](../../docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md).

## Usage

When you run `create nextrush` (with a **space**), your package manager expands that to the npm package **`create-nextrush`**. That is the correct, supported form—`create` and `nextrush` are two words, not `createnextrush`.

```bash
# Interactive (recommended)
pnpm create nextrush
npm create nextrush
yarn create nextrush
bun create nextrush
```

Pin the scaffolder version by adding `@` **after `nextrush`** (not after `create`):

```bash
npm create nextrush@latest
pnpm create nextrush@latest
```

Run the same CLI by its **package name** (hyphenated) with `npx` or `pnpm dlx`:

```bash
npx create-nextrush@latest
pnpm dlx create-nextrush@latest
bunx create-nextrush
```

Do **not** use `pnpm dlx create nextrush` (two words after `dlx`)—use `pnpm dlx create-nextrush` or `pnpm create nextrush` above.

```bash
# Non-interactive
pnpm create nextrush my-api --style functional --middleware api
```

The CLI walks you through project setup with an interactive prompt, or you can pass flags directly.

### Maintainers: verify the tarball

From this package directory, after `pnpm run build`:

```bash
npm pack --dry-run
```

Confirm `bin/create-nextrush.js` appears in the tarball contents before publishing.

## Options

| Flag           | Short | Description                                        | Default       |
| -------------- | ----- | -------------------------------------------------- | ------------- |
| `--style`      | `-s`  | Project style: `functional`, `class-based`, `full` | `functional`  |
| `--middleware` | `-m`  | Middleware preset: `minimal`, `api`, `full`        | `api`         |
| `--runtime`    | `-r`  | Runtime target: `node`, `bun`, `deno`              | `node`        |
| `--git`        |       | Initialize git repository                          | `true`        |
| `--no-git`     |       | Skip git initialization                            |               |
| `--install`    | `-i`  | Install dependencies after scaffold                | `true`        |
| `--no-install` |       | Skip dependency installation                       |               |
| `--pm`         |       | Package manager: `pnpm`, `npm`, `yarn`, `bun`      | auto-detected |
| `--help`       | `-h`  | Show help                                          |               |
| `--version`    | `-v`  | Show version                                       |               |

## Project Styles

### `functional` (default)

Lightweight, function-based routing. Best for APIs and microservices.

```
my-api/
├── src/
│   ├── index.ts               # App setup + routes
│   └── routes/
│       ├── health.ts          # Health check route
│       ├── health-status.ts   # Pure health-check payload (unit-testable)
│       └── __tests__/
│           └── health-status.test.ts
├── package.json
├── tsconfig.json
└── .gitignore
```

```typescript
import { createApp, createRouter, listen } from 'nextrush';

const router = createRouter();
const app = createApp({ router });

router.get('/', (ctx) => ctx.json({ message: 'Welcome to NextRush!' }));

await listen(app, 8080);
```

### `class-based`

Decorator-driven controllers with dependency injection. Best for structured applications.

```
my-api/
├── src/
│   ├── index.ts
│   ├── controllers/
│   │   └── health.controller.ts
│   └── services/
│       ├── app.service.ts
│       └── __tests__/
│           └── app.service.test.ts
├── package.json
├── tsconfig.json
└── .gitignore
```

```typescript
// src/services/app.service.ts
import { Service } from 'nextrush/class';

@Service()
export class AppService {
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

// src/controllers/health.controller.ts
import { Controller, Get } from 'nextrush/class';
import { AppService } from '../services/app.service.js';

@Controller('/health')
export class HealthController {
  constructor(private readonly appService: AppService) {}

  @Get()
  check() {
    return this.appService.getHealth();
  }
}
```

### `full`

Both functional routes and class-based controllers with custom error handling middleware. Best for production applications.

```
my-api/
├── src/
│   ├── index.ts
│   ├── routes/
│   │   └── health.ts
│   ├── controllers/
│   │   └── hello.controller.ts
│   ├── services/
│   │   ├── hello.service.ts
│   │   └── __tests__/
│   │       └── hello.service.test.ts
│   └── middleware/
│       └── error-handler.ts
├── package.json
├── tsconfig.json
└── .gitignore
```

## Middleware Presets

| Preset    | Included                                                                   |
| --------- | -------------------------------------------------------------------------- |
| `minimal` | None — bare framework                                                      |
| `api`     | `cors`, `body-parser`, `helmet`                                            |
| `full`    | `cors`, `body-parser`, `helmet`, `rate-limit`, `compression`, `request-id` |

## After Scaffolding

```bash
cd my-api

# Start development server (with hot reload)
pnpm dev

# Run the generated example test
pnpm test

# Build for production
pnpm build

# Run production build
pnpm start
```

Every generated project ships an `engines.node` field (`>=22.0.0`) and, for a non-npm package
manager, a pinned `packageManager` field — and every emitted `@nextrush/*` dependency is
resolved from that package's own published version (never proxied through another package's
version), so `install` succeeds for every `style` × `runtime` × `middleware` combination.

## Requirements

- Node.js >= 22.0.0

## License

MIT

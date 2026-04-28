# create-nextrush

> Create a new NextRush project with one command.

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
│   ├── index.ts          # App setup + routes
│   └── routes/
│       └── health.ts     # Health check route
├── package.json
├── tsconfig.json
└── .gitignore
```

```typescript
import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();
const router = createRouter();

router.get('/', (ctx) => ctx.json({ message: 'Welcome to NextRush!' }));

app.route('/', router);
await listen(app, 3000);
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
│       └── app.service.ts
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
│   │   └── hello.service.ts
│   └── middleware/
│       ├── error-handler.ts
│       └── not-found.ts
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

# Build for production
pnpm build

# Run production build
pnpm start
```

## Requirements

- Node.js >= 22.0.0

## License

MIT

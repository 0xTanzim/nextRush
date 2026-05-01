# NextRush

> Minimal, modular, high-performance Node.js framework

[![npm version](https://badge.fury.io/js/nextrush.svg)](https://www.npmjs.com/package/nextrush)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-≥22-339933?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org)

## Why NextRush?

- **Minimal Core** — Under 3,000 lines of code
- **Modular** — Install only what you need
- **Fast** — Competes with Fastify, Hono, and Koa
- **Type-Safe** — Full TypeScript with zero `any`
- **Zero Dependencies** — No external runtime dependencies in core
- **Modern DX** — Clean context API, async/await native

## Performance

Benchmark snapshot from a single lab machine (Intel i5-8300H, 8 cores) running Node.js v25.1.0.
For methodology, versions, and reproducible scripts, see https://github.com/0xTanzim/nextRush/blob/main/apps/docs/content/docs/performance/index.mdx.

| Framework       | Hello World    | POST JSON      | Mixed Workload |
| --------------- | -------------- | -------------- | -------------- |
| Fastify         | 48,045 RPS     | 21,412 RPS     | 48,493 RPS     |
| **NextRush v3** | **43,268 RPS** | **20,438 RPS** | **43,283 RPS** |
| Hono            | 37,476 RPS     | 12,625 RPS     | 38,759 RPS     |
| Koa             | 34,683 RPS     | 17,664 RPS     | 35,566 RPS     |
| Express         | 23,739 RPS     | 14,417 RPS     | 23,783 RPS     |

In this run, mean RPS was higher than Express, Hono, and Koa, and lower than Fastify.

> Performance varies by hardware. Run `pnpm benchmark` to test on your machine.

## Quick Start

### Scaffold a Project (Recommended)

```bash
pnpm create nextrush my-api
cd my-api && pnpm dev
```

The `create nextrush` form (with a space) installs the `create-nextrush` package. You can also use `npx create-nextrush@latest` or `pnpm dlx create-nextrush@latest`. See the [create-nextrush docs](https://github.com/0xTanzim/nextRush/tree/main/packages/create-nextrush#usage).

The interactive scaffolder lets you choose between functional, class-based, or full style, pick a middleware preset, and select your runtime target.

### Manual Setup

```bash
pnpm add nextrush
```

```typescript
import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();

// Create feature routers
const users = createRouter();
users.get('/', (ctx) => ctx.json([]));
users.get('/:id', (ctx) => ctx.json({ id: ctx.params.id }));
users.post('/', (ctx) => ctx.json({ received: ctx.body }));

// Mount routers — Hono-style composition
app.route('/users', users);

// Simple routes directly on app
const router = createRouter();
router.get('/', (ctx) => ctx.json({ message: 'Hello NextRush!' }));
app.route('/', router);

listen(app, 3000);
```

### Class-Based Controllers

```bash
pnpm add nextrush @nextrush/di @nextrush/decorators @nextrush/controllers
```

```typescript
import 'reflect-metadata';
import { Controller, Get, Post, Body, Param, Service } from 'nextrush';

@Service()
class UserService {
  async findAll() {
    return [{ id: 1, name: 'Alice' }];
  }
}

@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Get('/:id')
  findOne(@Param('id') id: string) {
    return { id };
  }

  @Post()
  create(@Body() data: unknown) {
    return data;
  }
}
```

## Context API

NextRush uses a unified context object for clean, intuitive code:

```typescript
// Request (Input)
ctx.method; // GET, POST, etc.
ctx.path; // /users/123
ctx.params; // { id: '123' }
ctx.query; // { page: '1' }
ctx.body; // Parsed request body
ctx.headers; // Request headers
ctx.get('header'); // Get specific header

// Response (Output)
ctx.status = 201; // Set status code
ctx.json(data); // Send JSON
ctx.send(text); // Send text
ctx.html(content); // Send HTML
ctx.redirect(url); // Redirect
ctx.set('header', 'value'); // Set header

// Middleware
ctx.next(); // Call next middleware
ctx.state; // Share data between middleware
```

## Packages

### Core (included in `nextrush`)

| Package                  | Description                          |
| ------------------------ | ------------------------------------ |
| `@nextrush/core`         | Application & middleware composition |
| `@nextrush/router`       | High-performance radix tree router   |
| `@nextrush/adapter-node` | Node.js HTTP adapter                 |
| `@nextrush/types`        | Shared TypeScript types              |
| `@nextrush/errors`       | HTTP error classes                   |

### Middleware (install separately)

| Package                 | Description                 |
| ----------------------- | --------------------------- |
| `@nextrush/body-parser` | JSON/form/text body parsing |
| `@nextrush/cors`        | CORS headers                |
| `@nextrush/helmet`      | Security headers            |
| `@nextrush/rate-limit`  | Rate limiting               |
| `@nextrush/compression` | Response compression        |
| `@nextrush/cookies`     | Cookie handling             |

### Plugins (install separately)

| Package               | Description             |
| --------------------- | ----------------------- |
| `@nextrush/static`    | Static file serving     |
| `@nextrush/websocket` | WebSocket support       |
| `@nextrush/template`  | Template rendering      |
| `@nextrush/logger`    | Structured logging      |
| `@nextrush/events`    | Type-safe event emitter |

### Class-Based Development (install separately)

| Package                 | Description                 |
| ----------------------- | --------------------------- |
| `@nextrush/controllers` | Decorator-based controllers |
| `@nextrush/di`          | Dependency injection        |
| `@nextrush/decorators`  | Route & param decorators    |

### Development

| Package           | Description                                                   |
| ----------------- | ------------------------------------------------------------- |
| `@nextrush/dev`   | Hot reload dev server, production builds, and code generators |
| `create-nextrush` | Project scaffolder — `pnpm create nextrush`, `npx create-nextrush` ([usage](https://github.com/0xTanzim/nextRush/blob/main/packages/create-nextrush/README.md)) |

## Adding Middleware

```bash
pnpm add @nextrush/cors @nextrush/body-parser @nextrush/helmet
```

```typescript
import { createApp, listen } from 'nextrush';
import { cors } from '@nextrush/cors';
import { json } from '@nextrush/body-parser';
import { helmet } from '@nextrush/helmet';

const app = createApp();

app.use(helmet());
app.use(cors());
app.use(json());

app.post('/api/users', (ctx) => {
  const { name, email } = ctx.body;
  ctx.status = 201;
  ctx.json({ id: Date.now(), name, email });
});

listen(app, 3000);
```

## Error Handling

```typescript
import { NotFoundError, BadRequestError } from 'nextrush';

app.get('/users/:id', async (ctx) => {
  const user = await db.findUser(ctx.params.id);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  ctx.json(user);
});

// Or use ctx.throw()
app.get('/users/:id', (ctx) => {
  ctx.throw(404, 'User not found');
});
```

## CLI Tools

### Dev Server & Build

```bash
nextrush dev                    # Hot reload dev server
nextrush build                  # Production build with decorator metadata
```

### Code Generators

```bash
nextrush generate controller user    # Class-based controller
nextrush g service user-profile      # Injectable service
nextrush g middleware request-logger # Async middleware
nextrush g guard auth               # Guard function
nextrush g route product            # Functional route
```

## Development

```bash
# Install dependencies (does not run a full compile — use build/verify when you need artifacts)
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run benchmarks
cd apps/benchmark && pnpm benchmark

# Type check
pnpm typecheck
```

## Project Structure

```
nextrush/
├── packages/
│   ├── core/            # @nextrush/core
│   ├── router/          # @nextrush/router
│   ├── types/           # @nextrush/types
│   ├── errors/          # @nextrush/errors
│   ├── runtime/         # @nextrush/runtime
│   ├── adapters/        # Platform adapters (node, bun, deno, edge)
│   ├── middleware/       # cors, helmet, body-parser, etc.
│   ├── plugins/         # controllers, websocket, template, etc.
│   ├── di/              # Dependency injection
│   ├── decorators/      # Controller decorators
│   ├── dev/             # CLI: dev server, build, generators
│   ├── create-nextrush/ # Project scaffolder
│   └── nextrush/        # Meta package
├── apps/
│   ├── docs/            # Documentation site
│   ├── benchmark/       # Benchmark suite
│   └── playground/      # Testing playground
└── draft/               # Architecture docs & RFCs
```

## Documentation

- [Getting Started](https://github.com/0xTanzim/nextRush/blob/main/apps/docs/content/docs/getting-started/index.mdx)
- [Core Concepts](https://github.com/0xTanzim/nextRush/blob/main/apps/docs/content/docs/concepts/index.mdx)
- [API Reference](https://github.com/0xTanzim/nextRush/blob/main/apps/docs/content/docs/api-reference/index.mdx)
- [Performance & benchmarks](https://github.com/0xTanzim/nextRush/blob/main/apps/docs/content/docs/performance/index.mdx)
- [Docs site (GitHub Pages)](https://0xtanzim.github.io/nextRush/docs)
- [GitHub Wiki](https://github.com/0xTanzim/nextRush/wiki) — concise guides (source in repo [`wiki/`](https://github.com/0xTanzim/nextRush/tree/main/wiki); publish with `./scripts/publish-github-wiki.sh`)

## Versioning

NextRush follows [Semantic Versioning](https://semver.org/). We use [Changesets](https://github.com/changesets/changesets) to manage releases.

- **Major** (x.0.0) — Breaking API changes
- **Minor** (0.x.0) — New features, backward-compatible
- **Patch** (0.0.x) — Bug fixes, security patches
- **Pre-release** (`-alpha.x`, `-beta.x`) — Unstable, API may change

See [CHANGELOG.md](CHANGELOG.md) for release history and [PUBLISHING.md](PUBLISHING.md) for release process.

## Contributing

Contributions are welcome! Please read the [contribution guidelines](CONTRIBUTING.md) first.

## License

MIT © [Tanzim Hossain](https://github.com/0xTanzim)

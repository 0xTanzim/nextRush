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

Benchmark results on Intel i5-8300H (8 cores), Node.js v25.1.0:

| Framework       | Hello World    | POST JSON      | Mixed Workload |
| --------------- | -------------- | -------------- | -------------- |
| Fastify         | 46,542 RPS     | 20,000 RPS     | 45,988 RPS     |
| **NextRush v3** | **36,092 RPS** | **17,826 RPS** | **38,061 RPS** |
| Hono            | 36,288 RPS     | 12,405 RPS     | 35,672 RPS     |
| Koa             | 33,921 RPS     | 17,326 RPS     | 33,764 RPS     |
| Express         | 22,128 RPS     | 14,081 RPS     | 22,745 RPS     |

NextRush v3 is **50-60% faster than Express** and matches Hono/Koa performance.

> Performance varies by hardware. Run `pnpm benchmark` to test on your machine.

## Quick Start

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

| Package         | Description           |
| --------------- | --------------------- |
| `@nextrush/dev` | Hot reload dev server |

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

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run benchmarks
cd apps/performance-ultra && pnpm benchmark

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
│   ├── adapters/        # Platform adapters
│   ├── middleware/      # cors, helmet, body-parser, etc.
│   ├── plugins/         # static, websocket, template, etc.
│   ├── di/              # Dependency injection
│   ├── decorators/      # Controller decorators
│   └── nextrush/        # Meta package
├── apps/
│   ├── docs/            # Documentation site
│   └── performance-ultra/  # Benchmark suite
└── draft/               # Architecture docs
```

## Documentation

- [Getting Started](https://nextrush.dev/getting-started/)
- [Core Concepts](https://nextrush.dev/concepts/)
- [API Reference](https://nextrush.dev/api/)
- [Benchmarks](https://nextrush.dev/benchmark)

## Contributing

Contributions are welcome! Please read the [contribution guidelines](CONTRIBUTING.md) first.

## License

MIT © [Tanzim Hossain](https://github.com/0xTanzim)

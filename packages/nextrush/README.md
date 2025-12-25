# NextRush

> Minimal, Modular, Blazing Fast Node.js Framework

[![npm version](https://img.shields.io/npm/v/nextrush.svg)](https://www.npmjs.com/package/nextrush)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Philosophy

**This meta package provides essentials only:**

- `createApp` - Create application
- `createRouter` - Create router
- `listen` / `serve` - Start server
- `compose` - Compose middleware
- Error classes (HttpError, NotFoundError, etc.)
- Essential types (Context, Middleware, Plugin, etc.)

**Middleware and plugins are installed separately.** This is intentional - you only pay for what you use.

## Installation

```bash
pnpm add nextrush
```

## Quick Start

```typescript
import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();
const router = createRouter();

router.get('/', (ctx) => {
  ctx.json({ message: 'Hello NextRush!' });
});

app.use(router.routes());

listen(app, 3000);
```

## Adding Middleware

Install what you need:

```bash
pnpm add @nextrush/cors @nextrush/body-parser
```

```typescript
import { createApp, listen } from 'nextrush';
import { cors } from '@nextrush/cors';
import { json } from '@nextrush/body-parser';

const app = createApp();

app.use(cors());
app.use(json());

app.use((ctx) => {
  ctx.json({ body: ctx.body });
});

listen(app, 3000);
```

## What's Included

This meta package re-exports from:

| Package | Exports |
|---------|---------|
| `@nextrush/core` | `createApp`, `Application`, `compose`, errors |
| `@nextrush/router` | `createRouter`, `Router` |
| `@nextrush/adapter-node` | `listen`, `serve`, `createHandler` |
| `@nextrush/types` | `Context`, `Middleware`, `Plugin`, `HttpStatus`, etc. |

## Available Packages

### Core (included in nextrush)

| Package | Description |
|---------|-------------|
| `@nextrush/core` | Application & middleware composition |
| `@nextrush/router` | High-performance radix tree router |
| `@nextrush/adapter-node` | Node.js HTTP adapter |
| `@nextrush/types` | Shared TypeScript types |
| `@nextrush/errors` | HTTP error classes |

### Middleware (install separately)

| Package | Description |
|---------|-------------|
| `@nextrush/body-parser` | JSON/form/text body parsing |
| `@nextrush/cors` | CORS headers |
| `@nextrush/helmet` | Security headers |
| `@nextrush/cookies` | Cookie handling |
| `@nextrush/compression` | Response compression (gzip/brotli) |
| `@nextrush/rate-limit` | Rate limiting with multiple algorithms |
| `@nextrush/request-id` | Request ID generation |
| `@nextrush/timer` | Request timing headers |

### Plugins (install separately)

| Package | Description |
|---------|-------------|
| `@nextrush/logger` | Structured logging |
| `@nextrush/static` | Static file serving |
| `@nextrush/websocket` | WebSocket support with rooms |
| `@nextrush/template` | Multi-engine template rendering |
| `@nextrush/events` | Type-safe event emitter |
| `@nextrush/controllers` | Decorator-based controllers |

### Advanced (install separately)

| Package | Description |
|---------|-------------|
| `@nextrush/di` | Dependency injection container |
| `@nextrush/decorators` | Controller & route decorators |

### Dev Tools

| Package | Description |
|---------|-------------|
| `@nextrush/dev` | Hot reload dev server (tsx-based) |

## Direct Package Usage

For maximum control, skip the meta package:

```typescript
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { listen } from '@nextrush/adapter-node';
import { cors } from '@nextrush/cors';
```

## Error Handling

Built-in HTTP error classes:

```typescript
import { NotFoundError, BadRequestError, HttpError } from 'nextrush';

app.use(async (ctx) => {
  if (!user) throw new NotFoundError('User not found');
  if (!valid) throw new BadRequestError('Invalid input');
});
```

## Version

```typescript
import { VERSION } from 'nextrush';
console.log(VERSION); // '3.0.0-alpha.1'
```

## License

MIT © NextRush Team

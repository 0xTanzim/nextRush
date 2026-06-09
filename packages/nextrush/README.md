# NextRush

> Minimal, modular, high-performance Node.js framework

[![npm version](https://img.shields.io/npm/v/nextrush.svg)](https://www.npmjs.com/package/nextrush)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-≥22-339933?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org)

## Why NextRush?

- **Fast** — 50-60% faster than Express, competes with Fastify and Hono
- **Minimal** — Core under 3,000 lines of code
- **Modular** — Install only what you need
- **Type-Safe** — Full TypeScript with zero `any`
- **Zero Dependencies** — No external runtime dependencies in core

## This Package

**`nextrush` is a meta package that re-exports the essentials:**

- `createApp`, `Application` — Create and manage application instances
- `createRouter`, `Router` — Create and manage routers
- `listen`, `serve`, `createHandler` — Start HTTP server (Node.js)
- `compose` — Compose middleware
- Error classes (`HttpError`, `NotFoundError`, `BadRequestError`, `MethodNotAllowedError`, etc.)
- Error utilities (`createError`, `isHttpError`, `errorHandler`, `notFoundHandler`, `catchAsync`)
- TypeScript types (`Context`, `Middleware`, `Next`, `Plugin`, `RouteHandler`, `HttpMethod`, etc.)
- Constants (`VERSION`, `HttpStatus`, `ContentType`)

**Middleware and plugins are installed separately.** This is intentional — you only pay for what you use.

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

app.route('/', router);

listen(app, 3000);
```

## Performance

Benchmark snapshot from a single lab machine (Intel i5-8300H, 8 cores) running Node.js v25.9.0.
Two tools available: **wrk** (C-based, process-isolated) and **autocannon** (Node.js, automatic fallback).
All tests: 10s duration, 64 connections, no pipelining. See [Performance](https://github.com/0xTanzim/nextRush/blob/main/apps/docs/content/docs/performance/index.mdx) for methodology and numbers.

### wrk

| Framework       | Hello World    | Route Params   | POST JSON      | Middleware Stack |
| --------------- | -------------- | -------------- | -------------- | ---------------- |
| Raw Node.js     | 35,863 RPS     | 33,326 RPS     | 25,116 RPS     | 30,738 RPS       |
| Fastify         | 35,592 RPS     | 32,407 RPS     | 18,799 RPS     | 27,968 RPS       |
| **NextRush v3** | **31,311 RPS** | **29,688 RPS** | **18,460 RPS** | **32,377 RPS**   |
| Hono            | 26,438 RPS     | 26,586 RPS     | 10,826 RPS     | 22,179 RPS       |
| Koa             | 23,350 RPS     | 21,890 RPS     | 14,954 RPS     | 20,972 RPS       |
| Express         | 17,784 RPS     | 17,598 RPS     | 12,947 RPS     | 17,356 RPS       |

### autocannon

| Framework       | Hello World    | Route Params   | POST JSON      | Middleware Stack |
| --------------- | -------------- | -------------- | -------------- | ---------------- |
| Raw Node.js     | 36,903 RPS     | 33,936 RPS     | 24,936 RPS     | 31,471 RPS       |
| Fastify         | 34,063 RPS     | 31,095 RPS     | 18,532 RPS     | 28,744 RPS       |
| **NextRush v3** | **31,733 RPS** | **29,534 RPS** | **19,192 RPS** | **32,220 RPS**   |
| Hono            | 28,209 RPS     | 25,966 RPS     | 10,798 RPS     | 22,258 RPS       |
| Koa             | 23,845 RPS     | 22,421 RPS     | 15,323 RPS     | 21,125 RPS       |
| Express         | 19,496 RPS     | 18,209 RPS     | 13,063 RPS     | 17,352 RPS       |

> Performance varies by hardware. Run `apps/benchmark` on your machine.

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

## Class-Based Controllers

Class-based APIs (decorators, DI, controllers) are available via the `nextrush/class` subpath:

- `nextrush` — Functional API (`createApp`, `createRouter`, `listen`, errors, types)
- `nextrush/class` — Class-based API (`Controller`, `Get`, `Service`, `controllersPlugin`, etc.)

The `nextrush/class` entry auto-imports `reflect-metadata`, so you can use decorators and DI without any extra setup:

```bash
pnpm add nextrush
```

```typescript
import { createApp, createRouter, listen } from 'nextrush';
import { controllersPlugin, Controller, Get, Service } from 'nextrush/class';

@Service()
class GreetService {
  greet() {
    return { message: 'Hello!' };
  }
}

@Controller('/api')
class HelloController {
  constructor(private svc: GreetService) {}

  @Get()
  hello() {
    return this.svc.greet();
  }
}

const app = createApp();
const router = createRouter();

app.plugin(controllersPlugin({ router, root: './src' }));
app.route('/', router);
listen(app, 3000);
```

> **`experimentalDecorators` and `emitDecoratorMetadata`** are required when you use `nextrush/class` with DI or decorators. `create-nextrush` turns them **on** for **class-based** and **full** templates, and **omits** them for **functional** (routes-only) projects where they are unnecessary.

## What's Included

This meta package re-exports from:

| Package                  | Exports                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `@nextrush/core`         | `createApp`, `Application`, `compose`                                                                                                |
| `@nextrush/router`       | `createRouter`, `Router`                                                                                                             |
| `@nextrush/adapter-node` | `listen`, `serve`, `createHandler`                                                                                                   |
| `@nextrush/types`        | `Context`, `Middleware`, `Next`, `Plugin`, `RouteHandler`, `HttpMethod`, `HttpStatus`, `ContentType`                                 |
| `@nextrush/errors`       | `HttpError`, `NextRushError`, error classes (4xx/5xx), `createError`, `isHttpError`, `errorHandler`, `notFoundHandler`, `catchAsync` |

## Available Packages

### Core (included in nextrush)

| Package                  | Description                          |
| ------------------------ | ------------------------------------ |
| `@nextrush/core`         | Application & middleware composition |
| `@nextrush/router`       | High-performance radix tree router   |
| `@nextrush/adapter-node` | Node.js HTTP adapter                 |
| `@nextrush/types`        | Shared TypeScript types              |
| `@nextrush/errors`       | HTTP error classes                   |

### Middleware (install separately)

| Package                 | Description                            |
| ----------------------- | -------------------------------------- |
| `@nextrush/body-parser` | JSON/form/text body parsing            |
| `@nextrush/cors`        | CORS headers                           |
| `@nextrush/helmet`      | Security headers                       |
| `@nextrush/cookies`     | Cookie handling                        |
| `@nextrush/compression` | Response compression (gzip/brotli)     |
| `@nextrush/rate-limit`  | Rate limiting with multiple algorithms |
| `@nextrush/request-id`  | Request ID generation                  |
| `@nextrush/timer`       | Request timing headers                 |

### Plugins (install separately)

| Package                 | Description                     |
| ----------------------- | ------------------------------- |
| `@nextrush/logger`      | Structured logging              |
| `@nextrush/static`      | Static file serving             |
| `@nextrush/websocket`   | WebSocket support with rooms    |
| `@nextrush/template`    | Multi-engine template rendering |
| `@nextrush/events`      | Type-safe event emitter         |
| `@nextrush/controllers` | Decorator-based controllers     |

### Advanced (install separately)

| Package                | Description                    |
| ---------------------- | ------------------------------ |
| `@nextrush/di`         | Dependency injection container |
| `@nextrush/decorators` | Controller & route decorators  |

### Dev Tools

| Package           | Description                                               |
| ----------------- | --------------------------------------------------------- |
| `@nextrush/dev`   | Hot reload dev server, production builds, code generators |
| `create-nextrush` | Project scaffolder — `pnpm create nextrush`, `npx create-nextrush` ([usage](https://github.com/0xTanzim/nextRush/blob/main/packages/create-nextrush/README.md)) |

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
console.log(VERSION); // '3.0.5'
```

## License

MIT © [Tanzim Hossain](https://github.com/0xTanzim)

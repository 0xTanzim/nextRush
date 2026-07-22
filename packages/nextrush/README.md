# NextRush

> Minimal, modular, high-performance Node.js framework

[![npm version](https://img.shields.io/npm/v/nextrush.svg)](https://www.npmjs.com/package/nextrush)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-≥22-339933?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript)](https://www.typescriptlang.org)

**Support tier:** Public — core (stable, semver-guarded). See [ADR-0005](../../docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md).

## Why NextRush?

- **Fast** — competes with Fastify and Hono; see [Performance](#performance) below
- **Minimal** — Core under 3,000 lines of code
- **Modular** — Install only what you need
- **Type-Safe** — Full TypeScript with zero `any`
- **Zero Dependencies (functional path)** — `createApp`/`createRouter`/`listen` pull in no
  external runtime dependencies; the class/DI path (`nextrush/class`) is a separate, optional
  install (see [Class-Based Controllers](#class-based-controllers) below)

## This Package

**`nextrush` is a meta package that re-exports the essentials:**

- `createApp`, `Application` — Create and manage application instances
- `createRouter`, `Router` — Create and manage routers
- `listen`, `serve`, `createHandler` — Start HTTP server (Node.js)
- `compose` — Compose middleware
- `endpoint` — Route metadata marker consumed by `@nextrush/openapi` and other renderers
- Error classes (`HttpError`, `NotFoundError`, `BadRequestError`, `MethodNotAllowedError`, etc.)
- Error utilities (`createError`, `isHttpError`, `errorHandler`, `notFoundHandler`)
- TypeScript types (`Context`, `Middleware`, `Next`, `Extension`, `ExtensionContext`, `RouteHandler`, `RouteDefinition`, `RouteMetadata`, `HttpMethod`, etc.)
- Constants (`HttpStatus`, `ContentType`)

**Middleware, extensions, and the class runtime are installed separately.** This is
intentional — you only pay for what you use. This runtime surface is locked by an automated
test (`src/__tests__/public-surface.test.ts`); if this README ever claims an export that test
doesn't list, that's a documentation bug — please file an issue.

## Installation

```bash
pnpm add nextrush
```

This installs only the functional core and its four internal dependencies
(`@nextrush/core`, `@nextrush/router`, `@nextrush/adapter-node`, `@nextrush/errors`,
`@nextrush/types`) — no class runtime, no DI container, no `reflect-metadata`, no `tsyringe`.
See [Dependency Footprint](#dependency-footprint).

## Quick Start

```typescript
import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();
const router = createRouter();

router.get('/', (ctx) => {
  ctx.json({ message: 'Hello NextRush!' });
});

app.route('/', router);

listen(app, 8080);
```

## Dependency Footprint

NextRush's runtime dependencies differ by which path you use — there is no single "zero
dependencies" claim that holds for the whole framework:

| Usage path | Entry point | Install | Runtime dependencies |
| ---------- | ----------- | ------- | --------------------- |
| Functional core (routing, middleware, context) | `createApp`, `createRouter`, `listen` from `nextrush` | `pnpm add nextrush` | None |
| Class-based / DI (`@Controller`, `@Service`, guards…) | `nextrush/class` | `pnpm add nextrush @nextrush/class` | `@nextrush/class`, `@nextrush/di` (wraps `tsyringe@^4.10.0`), `reflect-metadata@^0.2.2` |

`@nextrush/class`, `@nextrush/di`, and `reflect-metadata` are **optional peer dependencies** of
`nextrush` — a functional-only install never resolves them. If you import `nextrush/class`
without installing the peer, you get an actionable error naming the exact install command
rather than an opaque module-resolution failure.

`@nextrush/stream` and `@nextrush/runtime` ship transitively with `@nextrush/adapter-node`
(they power streaming responses and runtime detection) — they are always present once
`nextrush` is installed. You only need to add `@nextrush/stream` as a direct dependency of your
own project if you import its API directly rather than through the adapter.

## Performance

NextRush is built for high throughput with a zero-dependency functional core, and it benchmarks
competitively against Fastify, Hono, Koa, and Express. The suite in `apps/benchmark` compares
six servers (including a raw Node.js baseline) across 10 scenarios using **wrk** (C-based,
process-isolated) and **autocannon** (Node.js-based).

> **Published numbers are being re-measured on a clean, CPU-pinned environment with the
> hardened, parity-validated harness.** Earlier figures came from single-run sessions on a
> shared machine and were not reproducible to a publishable standard, so they have been
> withdrawn pending re-measurement. Run the suite yourself for current numbers on your hardware.

What the harness guarantees (see `apps/benchmark/README.md` and the audit reports there):

- **Fairness is validated, not assumed** — `pnpm bench:validate` asserts byte-identical response
  bodies, statuses, and middleware headers across all six servers before any timing.
- **Publishable numbers are multi-run** — only the `standard` (3 runs) and `full` (5 runs)
  profiles may back published figures; each reports mean ± stddev and CV.
- **Identical runtime config** — same Node flags, `NODE_ENV=production`, and payloads everywhere.
- **Honest scope** — 8 scenarios do byte-identical work; the middleware and error scenarios use
  each framework's idiomatic mechanism and are labeled as not like-for-like.

```bash
cd apps/benchmark
pnpm install
pnpm bench:validate                       # confirm fairness
pnpm bench:compare --profile full         # publishable comparison (5 runs)
```

> Performance varies by hardware. The only numbers that matter for your capacity planning are
> the ones you measure on your own machine.

## Scaffold a Project (Recommended)

```bash
pnpm create nextrush my-api
cd my-api && pnpm dev
```

The `create nextrush` form (with a space) installs the `create-nextrush` package. You can also use `npx create-nextrush@latest` or `pnpm dlx create-nextrush@latest`. See the [create-nextrush docs](https://github.com/0xTanzim/nextRush/tree/main/packages/create-nextrush#usage).

The interactive scaffolder lets you choose between functional, class-based, or full style, pick a middleware preset, and select your runtime target. For class-based and full projects, it adds `@nextrush/class` to your `package.json` automatically — you don't need to install it by hand.

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

listen(app, 8080);
```

## Class-Based Controllers

Class-based APIs (decorators, DI, controllers) are available via the `nextrush/class` subpath,
behind an explicit, optional install:

```bash
pnpm add nextrush @nextrush/class
```

```typescript
import { createApp, listen } from 'nextrush';
import { Controller, Get, Service, registerControllers } from 'nextrush/class';

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
await registerControllers(app, { root: './src' });
await listen(app, 8080);
```

The `nextrush/class` entry auto-imports `reflect-metadata`, so decorators and DI work with no
extra setup once `@nextrush/class` is installed. `registerControllers` is a **registrar**, not
a plugin — call and `await` it directly; it reads `app.router` and `app.container` (both
injected automatically by `nextrush`'s `createApp()`) and must resolve before
`listen()`/`serve()` starts the server.

If you forget to install `@nextrush/class`, importing `nextrush/class` fails with a message
naming the exact install command — it never fails silently or with an opaque
module-resolution error.

> **`experimentalDecorators` and `emitDecoratorMetadata`** are required when you use `nextrush/class` with DI or decorators. `create-nextrush` turns them **on** for **class-based** and **full** templates, and **omits** them for **functional** (routes-only) projects where they are unnecessary.

## What's Included

This meta package re-exports from:

| Package                  | Exports                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `@nextrush/core`         | `createApp`, `Application`, `compose`                                                                                                |
| `@nextrush/router`       | `createRouter`, `Router`, `endpoint`                                                                                                 |
| `@nextrush/adapter-node` | `listen`, `serve`, `createHandler`                                                                                                   |
| `@nextrush/types`        | `Context`, `Middleware`, `Next`, `Extension`, `ExtensionContext`, `RouteHandler`, `RouteDefinition`, `RouteMetadata`, `HttpMethod`, `HttpStatus`, `ContentType` |
| `@nextrush/errors`       | `HttpError`, `NextRushError`, error classes (4xx/5xx), `createError`, `isHttpError`, `errorHandler`, `notFoundHandler`               |

`@nextrush/stream` and `@nextrush/runtime` ship with `@nextrush/adapter-node` (not re-exported
from `nextrush` directly — see [Dependency Footprint](#dependency-footprint)).

## Available Packages

For the full catalog of publishable packages (middleware, extensions, adapters, class runtime,
dev tooling) with install commands, see the
[package catalog](https://0xtanzim.github.io/nextRush/docs/resources/package-catalog)
or the [root README's package table](https://github.com/0xTanzim/nextRush#packages).

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

## License

MIT © [Tanzim Hossain](https://github.com/0xTanzim)

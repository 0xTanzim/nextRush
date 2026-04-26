---
name: nextrush
description: >
  Build high-performance APIs with the NextRush framework — a minimal, modular
  Node.js/Bun/Deno framework with zero runtime dependencies. Covers functional
  routing (createApp, createRouter from 'nextrush'), decorator-based controllers
  (@Controller, @Get, @Post, @Service from 'nextrush/class'), Koa-style async
  middleware, dependency injection (@Service, @Repository, container, inject),
  error handling (HttpError hierarchy, errorHandler, catchAsync), guards
  (@UseGuard, GuardFn, CanActivate), parameter decorators (@Body, @Param,
  @Query, @Header), Context API (ctx.json, ctx.send, ctx.html, ctx.redirect),
  and the complete middleware ecosystem (body-parser, cors, helmet, rate-limit,
  compression, cookies, csrf, multipart, request-id, timer). Also covers plugins
  (controllers, events, logger, static files, templates, websocket), platform
  adapters (Node.js, Bun, Deno, Edge/Cloudflare/Vercel/Netlify), and dev tools
  (CLI with nextrush dev/build/generate). Use this skill whenever the user works
  with any 'nextrush' or '@nextrush/*' import, writes nextrush middleware or
  routes, scaffolds a nextrush project, configures middleware packages, sets up
  DI containers, builds REST APIs, asks about nextrush patterns or architecture,
  or mentions any @nextrush/* package — even if they don't say "NextRush"
  explicitly but the code clearly uses its APIs.
license: MIT
metadata:
  author: nextrush
  version: '2.0'
  framework: nextrush
  node: '>=22.0.0'
---

# NextRush Framework

Minimal, modular, high-performance Node.js framework. Zero external runtime
dependencies. Dual paradigm: functional routes and decorator-based controllers.
Targets: 35,000+ RPS, <200KB memory, <30ms cold start.

## When to Use

Use this skill when the user:

- Creates, reviews, or refactors any NextRush application or API
- Writes middleware, routes, controllers, or services
- Uses any `nextrush` or `@nextrush/*` import
- Sets up dependency injection, guards, or parameter decorators
- Configures middleware packages (cors, helmet, body-parser, rate-limit, etc.)
- Works with the Context API (`ctx.json`, `ctx.params`, `ctx.body`, etc.)
- Builds plugins, adapters, or error handling logic
- Scaffolds a new project with `create-nextrush` or `nextrush generate`
- Asks about NextRush patterns, architecture, or best practices
- Writes code that clearly uses NextRush APIs (even without saying "NextRush")

## Import Architecture

NextRush has **two entry points** from the meta-package. Getting imports right
is critical — using the wrong entry point will cause missing export errors.

```typescript
// FUNCTIONAL API — routing, errors, types, adapters
import { createApp, createRouter, listen } from 'nextrush';

// CLASS-BASED API — DI, decorators, controllers (auto-imports reflect-metadata)
import { Controller, Get, Service, controllersPlugin } from 'nextrush/class';
```

**Rule**: Never import class-based APIs (`Controller`, `Service`, `inject`,
`controllersPlugin`, etc.) from `'nextrush'` — they only exist in
`'nextrush/class'`. Functional APIs (`createApp`, `createRouter`, `listen`,
errors, types) only exist in `'nextrush'`.

**tsconfig requirement for class-based**: When using `nextrush/class`, the
project's `tsconfig.json` must have `"experimentalDecorators": true` and
`"emitDecoratorMetadata": true` under `compilerOptions`. Functional-only
projects don't need these flags.

When using individual packages directly (advanced), import from `@nextrush/*`:

```typescript
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { Service, container } from '@nextrush/di';
import { Controller, Get, Body } from '@nextrush/decorators';
import { controllersPlugin } from '@nextrush/controllers';
import { NotFoundError } from '@nextrush/errors';
import type { Context, Middleware } from '@nextrush/types';
```

## Package Map

| Package                  | Import Path              | Purpose                                        |
| ------------------------ | ------------------------ | ---------------------------------------------- |
| **Meta (functional)**    | `nextrush`               | createApp, createRouter, listen, errors, types |
| **Meta (class-based)**   | `nextrush/class`         | DI, decorators, controllers, reflect-metadata  |
| `@nextrush/core`         | `@nextrush/core`         | Application, middleware composition            |
| `@nextrush/router`       | `@nextrush/router`       | Radix tree routing                             |
| `@nextrush/errors`       | `@nextrush/errors`       | HTTP error hierarchy (40+ classes)             |
| `@nextrush/types`        | `@nextrush/types`        | Shared TypeScript types                        |
| `@nextrush/di`           | `@nextrush/di`           | Dependency injection (tsyringe wrapper)        |
| `@nextrush/decorators`   | `@nextrush/decorators`   | Controller, route, param, guard decorators     |
| `@nextrush/controllers`  | `@nextrush/controllers`  | Auto-discovery, handler building               |
| `@nextrush/adapter-node` | `@nextrush/adapter-node` | Node.js HTTP adapter                           |
| `@nextrush/adapter-bun`  | `@nextrush/adapter-bun`  | Bun adapter                                    |
| `@nextrush/adapter-deno` | `@nextrush/adapter-deno` | Deno adapter                                   |
| `@nextrush/adapter-edge` | `@nextrush/adapter-edge` | Edge/Cloudflare/Vercel/Netlify                 |
| `@nextrush/body-parser`  | `@nextrush/body-parser`  | JSON, URL-encoded, text, raw body              |
| `@nextrush/cors`         | `@nextrush/cors`         | CORS with presets                              |
| `@nextrush/helmet`       | `@nextrush/helmet`       | Security headers with presets                  |
| `@nextrush/rate-limit`   | `@nextrush/rate-limit`   | Rate limiting (token bucket, sliding window)   |
| `@nextrush/compression`  | `@nextrush/compression`  | gzip, deflate, brotli                          |
| `@nextrush/cookies`      | `@nextrush/cookies`      | Cookie parsing, signing, sessions              |
| `@nextrush/csrf`         | `@nextrush/csrf`         | CSRF protection                                |
| `@nextrush/multipart`    | `@nextrush/multipart`    | File uploads (disk/memory storage)             |
| `@nextrush/request-id`   | `@nextrush/request-id`   | Request ID, correlation, tracing               |
| `@nextrush/timer`        | `@nextrush/timer`        | Response time, Server-Timing header            |
| `@nextrush/events`       | `@nextrush/events`       | Event emitter plugin                           |
| `@nextrush/logger`       | `@nextrush/logger`       | Structured logging plugin                      |
| `@nextrush/static`       | `@nextrush/static`       | Static file serving                            |
| `@nextrush/template`     | `@nextrush/template`     | Template engine (EJS, Handlebars, Pug, etc.)   |
| `@nextrush/websocket`    | `@nextrush/websocket`    | WebSocket support                              |
| `@nextrush/dev`          | `@nextrush/dev`          | CLI: dev, build, generate                      |
| `@nextrush/runtime`      | `@nextrush/runtime`      | Runtime detection, body source                 |

## Quick Start

### Functional Style

```typescript
import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();
const router = createRouter();

router.get('/', (ctx) => ctx.json({ message: 'Hello NextRush' }));
router.get('/users/:id', (ctx) => ctx.json({ id: ctx.params.id }));

app.route('/', router);
listen(app, 3000);
```

### Class-Based Style

```typescript
import { createApp, createRouter, listen } from 'nextrush';
import { Controller, Get, Post, Body, Service, controllersPlugin } from 'nextrush/class';

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
  async list() {
    return this.userService.findAll();
  }

  @Post()
  async create(@Body() data: { name: string }) {
    return data;
  }
}

const app = createApp();
const router = createRouter();
await app.plugin(controllersPlugin({ router, root: './src', prefix: '/api' }));
app.route('/', router);
listen(app, 3000);
```

## Context API

The Context object is the primary interface for request/response handling.

```typescript
// ── Request (Input) ──────────────────────────────
ctx.method; // HttpMethod ('GET', 'POST', etc.)
ctx.path; // Request path ('/users/123')
ctx.url; // Full URL string
ctx.params; // Route parameters { id: '123' }
ctx.query; // Query parameters { page: '1', limit: '10' }
ctx.body; // Parsed request body (set by body-parser)
ctx.headers; // Request headers (readonly)
ctx.ip; // Client IP address
ctx.get('header'); // Get specific request header
ctx.state; // Mutable state bag for middleware data passing

// ── Response (Output) ────────────────────────────
ctx.json(data); // Send JSON response (sets Content-Type)
ctx.send(data); // Send text, Buffer, or stream
ctx.html(str); // Send HTML response
ctx.redirect(url); // Redirect (default 302, pass status as 2nd arg)
ctx.status = 201; // Set status code
ctx.set('key', 'v'); // Set response header
ctx.responded; // Boolean — true if response already sent

// ── Error Helpers ────────────────────────────────
ctx.throw(404, 'Not found'); // Throw HttpError
ctx.assert(condition, 400, 'Bad'); // Assert or throw

// ── Flow Control ─────────────────────────────────
await ctx.next(); // Call next middleware in chain

// ── Raw Access ───────────────────────────────────
ctx.raw; // Raw HTTP request/response (platform-specific)
ctx.runtime; // Runtime identifier ('node', 'bun', 'deno', 'edge')
ctx.bodySource; // Body source for streaming
```

## Middleware

Koa-style async middleware. Must call `ctx.next()` OR send a response — never
both, never neither.

```typescript
import type { Middleware } from 'nextrush';

const logger: Middleware = async (ctx) => {
  const start = Date.now();
  await ctx.next();
  console.log(`${ctx.method} ${ctx.path} ${Date.now() - start}ms`);
};

app.use(logger);
```

Order matters: first registered = outermost. Register error/security middleware
first, then business logic.

## Application

```typescript
import { createApp } from 'nextrush';
const app = createApp({ env: 'production', proxy: true });

app.use(middleware); // Register middleware
app.route('/prefix', router); // Mount router at prefix
await app.plugin(myPlugin); // Install plugin (sync or async)
app.setErrorHandler(handler); // Custom error handler
app.getPlugin('name'); // Get installed plugin
app.hasPlugin('name'); // Check if plugin installed
app.callback(); // Build request handler (for adapters)
```

## Routing Quick Reference

```typescript
import { createRouter } from 'nextrush';
const router = createRouter();

router.get('/users', handler); // GET
router.post('/users', handler); // POST
router.put('/users/:id', handler); // PUT
router.patch('/users/:id', handler); // PATCH
router.delete('/users/:id', handler); // DELETE
router.head('/health', handler); // HEAD
router.options('/users', handler); // OPTIONS
router.all('/any', handler); // All methods
router.redirect('/old', '/new', 301); // Redirect
router.use(middleware); // Router-scoped middleware
router.use('/nested', childRouter); // Mount sub-router
```

Route params: `/:id` → `ctx.params.id`. Wildcard: `/*` catches all.

## Controllers & Decorators Quick Reference

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Header,
  Ctx,
  UseGuard,
  Redirect,
  SetHeader,
  Service,
  Repository,
  inject,
  container,
  controllersPlugin,
} from 'nextrush/class';
import type { GuardFn, CanActivate, GuardContext } from 'nextrush/class';
```

| Decorator                                              | Purpose                                 |
| ------------------------------------------------------ | --------------------------------------- |
| `@Controller('/path')`                                 | Define controller with route prefix     |
| `@Get()`, `@Post()`, `@Put()`, `@Delete()`, `@Patch()` | Route methods                           |
| `@Body()`, `@Body('key')`                              | Request body / specific field           |
| `@Param()`, `@Param('id')`                             | Route params / specific param           |
| `@Query()`, `@Query('page')`                           | Query params / specific param           |
| `@Header()`, `@Header('auth')`                         | Headers / specific header               |
| `@Ctx()`                                               | Full Context object                     |
| `@Req()`, `@Res()`                                     | Raw request/response (escape hatch)     |
| `@UseGuard(guard)`                                     | Apply guard (class or method level)     |
| `@Redirect(url, status?)`                              | Redirect response                       |
| `@SetHeader(key, value)`                               | Set response header                     |
| `@Service()`                                           | Singleton DI registration (default)     |
| `@Service({ scope: 'transient' })`                     | New instance per resolve                |
| `@Repository()`                                        | Semantic alias for data access          |
| `@Config()`                                            | Configuration holder (always singleton) |
| `@Optional()`                                          | Mark constructor param as optional      |
| `@inject(token)`                                       | Inject by token (for interfaces)        |

Parameter transforms: `@Param('id', { transform: Number })` or
`@Body({ transform: zodSchema.parseAsync })`.

## Error Handling Quick Reference

```typescript
import { NotFoundError, BadRequestError, HttpError, errorHandler } from 'nextrush';

// Throw typed errors
throw new NotFoundError('User not found');
throw new BadRequestError('Invalid input');

// Use built-in error handler middleware
app.use(errorHandler());

// Or use ctx helpers
ctx.throw(404, 'Not found');
ctx.assert(user, 404, 'User not found');
```

Common errors from `nextrush`: `BadRequestError` (400), `UnauthorizedError` (401),
`ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409),
`TooManyRequestsError` (429), `InternalServerError` (500).
Extended errors (from `@nextrush/errors` only): `ValidationError`,
`RequiredFieldError`, `PaymentRequiredError`, `GoneError`, etc.
See [error-handling.md](references/error-handling.md) for the full list of
40+ error classes and factory functions.

## Built-in Middleware Packages

Install individually from `@nextrush/*`:

```typescript
import { bodyParser } from '@nextrush/body-parser';
import { cors } from '@nextrush/cors';
import { helmet } from '@nextrush/helmet';
import { rateLimit } from '@nextrush/rate-limit';

const app = createApp();
app.use(helmet()); // Security headers
app.use(cors()); // CORS
app.use(bodyParser()); // Parse JSON/form bodies
app.use(rateLimit({ max: 100, window: 60 })); // Rate limiting
```

| Package     | Quick Usage                                                 | Presets                                        |
| ----------- | ----------------------------------------------------------- | ---------------------------------------------- |
| body-parser | `bodyParser()`, `json()`, `urlencoded()`, `text()`, `raw()` | —                                              |
| cors        | `cors()`                                                    | `devCors()`, `strictCors()`, `simpleCors()`    |
| helmet      | `helmet()`                                                  | `strictHelmet()`, `devHelmet()`, `apiHelmet()` |
| rate-limit  | `rateLimit({ max, window })`                                | `tokenBucket`, `slidingWindow`, `fixedWindow`  |
| compression | `compression()`                                             | `gzip()`, `deflate()`, `brotli()`              |
| cookies     | `cookies({ secret })`                                       | `secureOptions()`, `sessionOptions()`          |
| csrf        | `csrf()`                                                    | —                                              |
| multipart   | `multipart({ storage })`                                    | `DiskStorage`, `MemoryStorage`                 |
| request-id  | `requestId()`                                               | `correlationId()`, `traceId()`                 |
| timer       | `timer()`                                                   | `responseTime()`, `serverTiming()`             |

See [middleware.md](references/middleware.md) for detailed configuration.

## Plugins

```typescript
// Controllers — auto-discovery of @Controller classes
import { controllersPlugin } from 'nextrush/class';
await app.plugin(controllersPlugin({ router, root: './src', prefix: '/api' }));

// Events — pub/sub event system
import { eventsPlugin } from '@nextrush/events';

// Logger — structured logging
import { createLogger } from '@nextrush/logger';

// Static — serve static files
import { staticMiddleware } from '@nextrush/static';

// Template — render templates (EJS, Handlebars, Pug, etc.)
import { templateMiddleware } from '@nextrush/template';

// WebSocket — real-time communication
import { createWebSocket } from '@nextrush/websocket';
```

See [ecosystem.md](references/ecosystem.md) for detailed plugin docs.

## Adapters

Default adapter is Node.js (included in `nextrush`). For other runtimes:

```typescript
// Bun
import { listen } from '@nextrush/adapter-bun';
listen(app, 3000);

// Deno
import { listen } from '@nextrush/adapter-deno';
listen(app, 3000);

// Edge (Cloudflare Workers, Vercel Edge, Netlify Edge)
import { createCloudflareHandler } from '@nextrush/adapter-edge';
export default { fetch: createCloudflareHandler(app) };
```

## Dev Tools

```bash
# Scaffold a new project
npm create nextrush@latest     # Interactive project scaffolder
npx create-nextrush my-app     # Direct scaffold

# Development
npx nextrush dev               # Start dev server with HMR
npx nextrush build             # Production build

# Code generators
npx nextrush generate controller user   # Generate controller
npx nextrush generate service user      # Generate service
npx nextrush generate middleware auth   # Generate middleware
npx nextrush generate guard admin       # Generate guard
```

## Topic Reference

Read reference files for detailed patterns, edge cases, and troubleshooting:

| Topic       | File                                                                     | Use When                                                          |
| ----------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Middleware  | [references/middleware.md](references/middleware.md)                     | Writing middleware, configuring body-parser/cors/helmet/etc.      |
| Routing     | [references/routing.md](references/routing.md)                           | CRUD endpoints, params, router composition, mounting              |
| Controllers | [references/controllers.md](references/controllers.md)                   | Decorator-based routes, guards, param injection, transforms       |
| DI          | [references/dependency-injection.md](references/dependency-injection.md) | Service registration, scopes, tokens, testing with mocks          |
| Errors      | [references/error-handling.md](references/error-handling.md)             | Error classes, factory functions, custom errors, error middleware |
| Ecosystem   | [references/ecosystem.md](references/ecosystem.md)                       | Plugins, adapters, dev tools, runtime detection                   |

## Global Rules

- `nextrush` = functional only. `nextrush/class` = class-based (DI, decorators, controllers)
- Zero `any` — use `unknown` at boundaries, proper types internally
- No `eval()`, `Function()`, or dynamic code execution
- Error responses must never leak stack traces or internal paths
- Middleware must call `ctx.next()` or send a response — never both, never neither
- `reflect-metadata` is auto-imported by `nextrush/class` — no manual import needed
- Lower packages never import from higher packages in the hierarchy
- No external runtime dependencies in core packages
- Use `ctx.state` for passing data between middleware — not globals
- Register error/security middleware before business logic middleware

---
name: nextrush
description: >
  Build high-performance Node.js APIs with the NextRush framework. Provides
  patterns for functional routing (createApp, createRouter), decorator-based
  controllers (@Controller, @Get, @Post), Koa-style async middleware, dependency
  injection (@Service, @Repository), structured error handling (HttpError hierarchy),
  guards, parameter decorators (@Body, @Param, @Query), and the Context API.
  Use when creating, reviewing, or refactoring NextRush applications, writing
  middleware, setting up DI containers, building REST APIs, or handling errors.
license: MIT
metadata:
  author: nextrush
  version: '1.0'
  framework: nextrush
  node: '>=22.0.0'
---

# NextRush Framework

Minimal, modular, high-performance Node.js framework. Zero external runtime
dependencies. Dual paradigm: functional routes and decorator-based controllers.
Target: 35,000+ RPS, <200KB memory, <30ms cold start.

## When to Use

Use this skill when the user:

- Creates a new NextRush application or API
- Writes or refactors middleware, routes, or controllers
- Sets up dependency injection with `@Service` or `@Repository`
- Adds error handling or custom error classes
- Uses decorators like `@Controller`, `@Get`, `@UseGuard`
- Works with the Context API (`ctx.json`, `ctx.params`, `ctx.body`)
- Asks about NextRush patterns, architecture, or best practices
- Builds guards, parameter transforms, or validation logic
- Configures routers, plugins, or adapters

## Package Map

| Package                 | Import                       | Purpose                             |
| ----------------------- | ---------------------------- | ----------------------------------- |
| `@nextrush/core`        | `createApp`                  | Application entry point, middleware |
| `@nextrush/router`      | `createRouter`               | Radix tree routing                  |
| `@nextrush/errors`      | `HttpError`, `NotFoundError` | Typed HTTP errors                   |
| `@nextrush/types`       | `Context`, `Middleware`      | Shared TypeScript types             |
| `@nextrush/di`          | `Service`, `container`       | Dependency injection                |
| `@nextrush/decorators`  | `Controller`, `Get`, `Body`  | Route & param decorators            |
| `@nextrush/controllers` | `controllersPlugin`          | Auto-discovery, handler building    |

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';

const app = createApp();
const router = createRouter();

router.get('/', (ctx) => ctx.json({ message: 'Hello NextRush' }));

app.route('/', router);
app.listen(3000);
```

## Topic Reference

Read reference files for detailed patterns, examples, and troubleshooting:

| Topic       | File                                                                     | Use When                                           |
| ----------- | ------------------------------------------------------------------------ | -------------------------------------------------- |
| Middleware  | [references/middleware.md](references/middleware.md)                     | Building logging, auth, error boundaries, timing   |
| Routing     | [references/routing.md](references/routing.md)                           | CRUD endpoints, route params, pagination, mounting |
| Controllers | [references/controllers.md](references/controllers.md)                   | Decorator-based routes, guards, param injection    |
| DI          | [references/dependency-injection.md](references/dependency-injection.md) | Service registration, scopes, tokens, testing      |
| Errors      | [references/error-handling.md](references/error-handling.md)             | Error classes, error middleware, custom errors     |

## Quick Reference

### Middleware

```typescript
import type { Middleware } from '@nextrush/types';

const logger: Middleware = async (ctx) => {
  const start = Date.now();
  await ctx.next();
  console.log(`${ctx.method} ${ctx.path} ${Date.now() - start}ms`);
};

app.use(logger);
```

- Must call `ctx.next()` OR send a response — never both, never neither
- Register order matters — security middleware first
- Use `ctx.state` to pass data between middleware

### Routing

```typescript
const users = createRouter();

users.get('/', (ctx) => ctx.json(allUsers));
users.get('/:id', (ctx) => ctx.json(findUser(ctx.params.id)));
users.post('/', (ctx) => ctx.json(createUser(ctx.body)));

app.route('/users', users);
```

- Route params via `ctx.params`, query via `ctx.query`, body via `ctx.body`
- Mount routers with `app.route('/prefix', router)`
- Supports GET, POST, PUT, PATCH, DELETE

### Controllers & Decorators

```typescript
import 'reflect-metadata';
import { Controller, Get, Post, Body, ParamProp, UseGuard } from '@nextrush/decorators';
import { Service } from '@nextrush/di';

@Service()
class ProductService {
  async findAll() {
    return [];
  }
  async findById(id: string) {
    return null;
  }
  async create(data: { name: string }) {
    return { id: '1', ...data };
  }
}

@Controller('/products')
class ProductController {
  constructor(private productService: ProductService) {}

  @Get()
  async list() {
    return this.productService.findAll();
  }

  @Get('/:id')
  async one(@ParamProp('id') id: string) {
    return this.productService.findById(id);
  }

  @Post()
  async create(@Body() data: CreateProductDto) {
    return this.productService.create(data);
  }
}
```

**Parameter Decorators:**

| Decorator             | Source                 |
| --------------------- | ---------------------- |
| `@Body()`             | Full request body      |
| `@BodyProp('key')`    | Specific body property |
| `@Param()`            | All route params       |
| `@ParamProp('id')`    | Single route param     |
| `@Query()`            | All query params       |
| `@QueryProp('page')`  | Single query param     |
| `@Headers()`          | All headers            |
| `@HeaderProp('auth')` | Single header          |
| `@State()`            | Middleware state bag   |
| `@Ctx()`              | Full context object    |

**Guards:**

```typescript
const AuthGuard: GuardFn = async (ctx) => Boolean(ctx.get('authorization'));

@UseGuard(AuthGuard)
@Controller('/admin')
class AdminController {}
```

### Dependency Injection

```typescript
import { Service, Repository } from '@nextrush/di';

@Service() // singleton (default)
class ConfigService {}

@Service({ scope: 'transient' }) // new instance each resolve
class RequestLogger {}

@Repository() // semantic alias for data access
class UserRepository {}
```

- `reflect-metadata` must be imported first
- Singleton = one instance for app lifetime
- Transient = new instance per resolve

### Error Handling

```typescript
import { HttpError, NotFoundError, BadRequestError } from '@nextrush/errors';

// Throw typed errors
router.get('/:id', (ctx) => {
  const item = db.get(ctx.params.id);
  if (!item) throw new NotFoundError('Item not found');
  return ctx.json(item);
});

// Error middleware (register FIRST)
const errorHandler: Middleware = async (ctx) => {
  try {
    await ctx.next();
  } catch (err) {
    const status = err instanceof HttpError ? err.statusCode : 500;
    const message = err instanceof HttpError ? err.message : 'Internal Server Error';
    ctx.status = status;
    ctx.json({ error: { status, message } });
  }
};
```

**Error Classes:** `BadRequestError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), `ValidationError` (400), `TooManyRequestsError` (429), `InternalServerError` (500)

## Context API

```typescript
// Request (input)
ctx.method; // HTTP method
ctx.path; // Request path
ctx.params; // Route parameters  { id: '123' }
ctx.query; // Query parameters  { page: '1' }
ctx.body; // Parsed request body
ctx.headers; // Request headers
ctx.state; // Mutable state bag for middleware
ctx.get('header'); // Get request header

// Response (output)
ctx.json(data); // Send JSON response
ctx.send(data); // Send text/buffer
ctx.html(str); // Send HTML
ctx.redirect(url); // Redirect
ctx.status = 201; // Set status code
ctx.set('key', 'val'); // Set response header

// Flow
ctx.next(); // Call next middleware
```

## Global Rules

- Zero `any` — use `unknown` at boundaries, proper types internally
- No `eval()`, `Function()`, or dynamic code execution
- No `console.log` in production — use structured logging
- Error responses must never leak stack traces or internal paths
- Middleware must call `ctx.next()` or send a response
- `reflect-metadata` must be the first import when using decorators
- Lower packages never import from higher packages in the hierarchy
- No external runtime dependencies except `reflect-metadata`

## How to Use

Read individual reference files for detailed explanations, code examples,
edge cases, and troubleshooting tables:

```
references/middleware.md
references/routing.md
references/controllers.md
references/dependency-injection.md
references/error-handling.md
```

Each reference file contains step-by-step workflows, correct/incorrect
patterns, and a troubleshooting table for common issues.

---
applyTo: '**'
---

# NextRush v3 Architecture Overview

## Monorepo Structure

NextRush v3 uses a modular monorepo architecture with Turborepo and pnpm workspaces.

## Package Hierarchy

```
@nextrush/types        → Shared TypeScript types (no deps)
       ↓
@nextrush/errors       → HTTP error classes (depends on types)
       ↓
@nextrush/core         → Application, Context, Middleware (depends on types)
       ↓
@nextrush/router       → Segment trie routing (depends on types)
       ↓
@nextrush/runtime      → listen / runtime helpers
       ↓
@nextrush/di           → Dependency injection (wraps tsyringe)
       ↓
@nextrush/class        → Controllers, decorators, guards, modules, DI re-exports
       ↓
@nextrush/adapter-*    → Platform adapters (depends on core, types)
       ↓
@nextrush/middleware/* → cors, helmet, body-parser (depends on types)
       ↓
@nextrush/extensions/* → events, websocket (long-lived app-scoped services)
       ↓
nextrush               → Meta package (re-exports all essentials)
```

## Core Concepts

1. **Application** (`@nextrush/core`): Main entry point, middleware registration, extension/plugin wiring
2. **Context**: Request/response wrapper with DX-focused API
3. **Middleware**: Koa-style async middleware with `compose()`
4. **Extension mechanism**: Middleware (~99%, `app.use()`) is the default; a Registrar (~0.9%, e.g. `registerControllers`/`registerModule`) wires a subsystem; an Extension (~0.1%, rare) is a long-lived app-scoped service via `app.extend()` + `await app.ready()`
5. **Router** (`@nextrush/router`): High-performance segment trie routing, O(k) lookup
6. **Adapter**: Platform-specific HTTP handling (Node.js, Bun, Edge)
7. **DI Container** (`@nextrush/di`): Dependency injection with tsyringe wrapper
8. **Class runtime** (`@nextrush/class`): Controller, route, param, and guard decorators, modules, request scope
9. **Errors** (`@nextrush/errors`): HTTP error hierarchy with proper status codes

## Context API (DX-First Design)

```typescript
// INPUT (Request)
ctx.body; // Parsed request body
ctx.query; // Query parameters
ctx.params; // Route parameters
ctx.headers; // Request headers
ctx.method; // HTTP method
ctx.path; // Request path
ctx.state; // Mutable state bag for middleware

// OUTPUT (Response)
ctx.json(data); // Send JSON
ctx.send(data); // Send text/buffer
ctx.html(str); // Send HTML
ctx.redirect(); // Redirect
ctx.status; // Status code

// MIDDLEWARE
ctx.next(); // Modern middleware syntax
```

## Dependency Injection (`@nextrush/di`)

Wraps tsyringe with enhanced error messages and NextRush-specific patterns.

### Core Exports

```typescript
// Container
export { container, createContainer } from './container';

// Decorators
export { Service, Repository } from './decorators';

// Re-exports from tsyringe
export { inject, injectable, singleton, delay } from 'tsyringe';
```

### Service Registration

```typescript
// Singleton (default)
@Service()
class UserService {}

// Transient (new instance each resolve)
@Service({ scope: 'transient' })
class RequestLogger {}

// Semantic alias
@Repository()
class UserRepository {}
```

## Decorators (`@nextrush/class`)

Provides controller, route, parameter, and guard decorators.

### Controller & Route Decorators

```typescript
@Controller('/users')
class UserController {
  @Get()          // GET /users
  @Get('/:id')    // GET /users/:id
  @Post()         // POST /users
  @Put('/:id')    // PUT /users/:id
  @Patch('/:id')  // PATCH /users/:id
  @Delete('/:id') // DELETE /users/:id
}
```

### Parameter Decorators

```typescript
@Body()              // Full request body
@Body('name')        // Specific body property
@Param()             // All route params
@Param('id')         // Specific route param
@Query()             // All query params
@Query('page')       // Specific query param
@Header()            // All headers
@Header('auth')      // Specific header
@Ctx()               // Full context object
@Req()               // Raw request (escape hatch)
@Res()               // Raw response (escape hatch)
```

### Parameter Transform

```typescript
// Sync transform
@Param('id', { transform: Number })

// Async transform (for validation libraries)
@Body({ transform: zodSchema.parseAsync })
```

### Guard System

Guards control route access by returning boolean.

```typescript
// Function guard
const AuthGuard: GuardFn = async (ctx) => {
  return Boolean(ctx.get('authorization'));
};

// Class guard (with DI)
@Service()
class RoleGuard implements CanActivate {
  constructor(private roles: RoleService) {}

  async canActivate(ctx: GuardContext): Promise<boolean> {
    return this.roles.check(ctx.state.user);
  }
}

// Usage
@UseGuard(AuthGuard)
@UseGuard(RoleGuard)
@Controller('/admin')
class AdminController {}
```

### Guard Types

```typescript
// Lightweight context for guards (no response methods)
interface GuardContext {
  readonly method: string;
  readonly path: string;
  readonly params: Record<string, string>;
  readonly query: Record<string, string | string[] | undefined>;
  readonly body: unknown;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly state: Record<string, unknown>;
  get(name: string): string | undefined;
}

// Function-based guard
type GuardFn = (ctx: GuardContext) => boolean | Promise<boolean>;

// Class-based guard interface
interface CanActivate {
  canActivate(ctx: GuardContext): boolean | Promise<boolean>;
}
```

## Controllers Registrar (`@nextrush/class`)

Connects DI, decorators, and router to auto-register controllers.

### Usage

```typescript
import { registerControllers } from 'nextrush/class';

const app = createApp();

// Auto-discovery (recommended) — reads app.router + app.container, must be awaited
await registerControllers(app, {
  root: './src',           // Scan for @Controller classes
  prefix: '/api',          // Add prefix to all routes
  debug: true,             // Log discovered controllers
});
```

### Handler Building Pipeline

1. Read controller metadata (path, guards)
2. Read route metadata (method, path, guards)
3. Read parameter metadata (source, property, transform)
4. Resolve controller from DI container
5. Build handler that:
   - Executes class guards → method guards
   - Extracts parameters with transforms
   - Calls controller method
   - Serializes return value as JSON

## Error Hierarchy (`@nextrush/errors`)

```
HttpError (base)
├── BadRequestError (400)
├── UnauthorizedError (401)
├── ForbiddenError (403)
├── NotFoundError (404)
├── MethodNotAllowedError (405)
├── ConflictError (409)
├── UnprocessableEntityError (422)
├── TooManyRequestsError (429)
├── InternalServerError (500)
├── NotImplementedError (501)
├── BadGatewayError (502)
├── ServiceUnavailableError (503)
└── GatewayTimeoutError (504)

Validation errors (`@nextrush/errors`):
└── ValidationError (400) - Parameter validation failed

Controller-specific errors (`@nextrush/class`):
├── MissingParameterError (400) - Required parameter missing
└── GuardRejectionError (403) - Guard returned false
```

## Package Size Targets

| Package       | Max LOC | Responsibility              |
| ------------- | ------- | --------------------------- |
| types         | 500     | Shared TypeScript types     |
| errors        | 600     | HTTP error classes          |
| core          | 1,500   | Application, Middleware     |
| router        | 1,000   | Segment trie routing        |
| di            | 400     | DI container wrapper        |
| class         | —       | Consolidated class runtime  |
| adapter-\*    | 500     | Platform adapters           |
| middleware/\* | 300     | Individual middleware       |

## Key Files

### Types & Errors

- `packages/types/src/context.ts` - Context interface
- `packages/types/src/http.ts` - HTTP types
- `packages/errors/src/http.ts` - HTTP error classes

### Core

- `packages/core/src/application.ts` - Application class
- `packages/core/src/middleware.ts` - Middleware composition

### DI & Class Runtime

- `packages/di/src/container.ts` - DI container wrapper
- `packages/di/src/decorators.ts` - @Service, @Repository
- `packages/class/src/decorators/class.ts` - @Controller
- `packages/class/src/decorators/routes.ts` - @Get, @Post, etc.
- `packages/class/src/binding/params.ts` - @Body, @Param, etc.
- `packages/class/src/guards/` - @UseGuard, GuardFn, CanActivate, GuardContext

### Class Runtime Registrar

- `packages/class/src/registrar/registrar.ts` - Registrar entry (`registerControllers`)
- `packages/class/src/registrar/builder.ts` - Handler building
- `packages/class/src/errors.ts` - Controller errors

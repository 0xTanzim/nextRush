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
@nextrush/router       → Radix tree routing (depends on types)
       ↓
@nextrush/di           → Dependency injection (wraps tsyringe)
       ↓
@nextrush/decorators   → @Controller, @Get, @UseGuard (depends on types)
       ↓
@nextrush/controllers  → Auto-discovery, handler building (depends on di, decorators, errors)
       ↓
@nextrush/adapter-*    → Platform adapters (depends on core, types)
       ↓
@nextrush/middleware/* → cors, helmet, body-parser (depends on types)
       ↓
nextrush               → Meta package (re-exports all essentials)
```

## Core Concepts

1. **Application** (`@nextrush/core`): Main entry point, middleware registration, plugin system
2. **Context**: Request/response wrapper with DX-focused API
3. **Middleware**: Koa-style async middleware with `compose()`
4. **Plugin**: Extension mechanism via `Plugin` interface
5. **Router** (`@nextrush/router`): High-performance radix tree routing
6. **Adapter**: Platform-specific HTTP handling (Node.js, Bun, Edge)
7. **DI Container** (`@nextrush/di`): Dependency injection with tsyringe wrapper
8. **Decorators** (`@nextrush/decorators`): Controller, route, param, and guard decorators
9. **Controllers Plugin** (`@nextrush/controllers`): Auto-discovery and handler building
10. **Errors** (`@nextrush/errors`): HTTP error hierarchy with proper status codes

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
export { Service, Repository, AutoInjectable } from './decorators';

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

## Decorators (`@nextrush/decorators`)

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
@BodyProp('name')    // Specific body property
@Param()             // All route params
@ParamProp('id')     // Specific route param
@Query()             // All query params
@QueryProp('page')   // Specific query param
@Headers()           // All headers
@HeaderProp('auth')  // Specific header
@State()             // Middleware state bag
@Ctx()               // Full context object
```

### Parameter Transform

```typescript
// Sync transform
@ParamProp('id', { transform: Number })

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
  method: HttpMethod;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  headers: Record<string, string>;
  state: Record<string, unknown>;
  get(name: string): string | undefined;
  set(name: string, value: string): void;
}

// Function-based guard
type GuardFn = (ctx: GuardContext) => boolean | Promise<boolean>;

// Class-based guard interface
interface CanActivate {
  canActivate(ctx: GuardContext): boolean | Promise<boolean>;
}
```

## Controllers Plugin (`@nextrush/controllers`)

Connects DI, decorators, and router to auto-register controllers.

### Usage

````typescript
### Usage\n\n```typescript\nimport { controllersPlugin } from '@nextrush/controllers';\n\nconst app = createApp();\nconst router = createRouter();\n\n// Auto-discovery (recommended)\napp.plugin(controllersPlugin({\n  router,\n  root: './src',           // Scan for @Controller classes\n  prefix: '/api',          // Add prefix to all routes\n  debug: true,             // Log discovered controllers\n}));\n\napp.route('/', router);\n```
````

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

Controller-specific errors (`@nextrush/controllers`):
├── MissingParameterError (400) - Required parameter missing
└── GuardRejectionError (403) - Guard returned false
```

## Package Size Targets

| Package       | Max LOC | Responsibility              |
| ------------- | ------- | --------------------------- |
| types         | 500     | Shared TypeScript types     |
| errors        | 600     | HTTP error classes          |
| core          | 1,500   | Application, Middleware     |
| router        | 1,000   | Radix tree routing          |
| di            | 400     | DI container wrapper        |
| decorators    | 800     | Controller/route decorators |
| controllers   | 800     | Handler building, discovery |
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

### DI & Decorators

- `packages/di/src/container.ts` - DI container wrapper
- `packages/di/src/decorators.ts` - @Service, @Repository
- `packages/decorators/src/class.ts` - @Controller
- `packages/decorators/src/routes.ts` - @Get, @Post, etc.
- `packages/decorators/src/params.ts` - @Body, @Param, etc.
- `packages/decorators/src/guards.ts` - @UseGuard
- `packages/decorators/src/types.ts` - GuardFn, CanActivate, GuardContext

### Controllers Plugin

- `packages/plugins/controllers/src/plugin.ts` - Plugin entry
- `packages/plugins/controllers/src/builder.ts` - Handler building
- `packages/plugins/controllers/src/errors.ts` - Controller errors

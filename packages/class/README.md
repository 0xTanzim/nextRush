# @nextrush/class

> Unified class-based API for NextRush — decorators, dependency injection, and automatic controller registration.

This package consolidates the entire class-based runtime: decorators for routes and parameters, a DI container for dependency management, and controller auto-discovery with handler registration.

## What It Does

Build structured APIs with TypeScript decorators, dependency injection, and type-safe parameter extraction:

```typescript
import { createApp, listen } from 'nextrush';
import {
  Controller, Get, Post, Service, Body, Param,
  registerControllers,
} from 'nextrush/class';

@Service()
class UserService {
  findAll() { return [{ id: 1, name: 'Alice' }]; }
  findOne(id: string) { return { id, name: 'Alice' }; }
  create(data: unknown) { return { ...data, id: Date.now() }; }
}

@Controller('/users')
class UserController {
  constructor(private users: UserService) {}

  @Get()
  findAll() { return this.users.findAll(); }

  @Get('/:id')
  findOne(@Param('id') id: string) { return this.users.findOne(id); }

  @Post()
  create(@Body() data: unknown) { return this.users.create(data); }
}

const app = createApp();
await registerControllers(app, { root: './src' });
await listen(app, 8080);
```

## Core Components

### Decorators

Declare routes, parameters, and guards declaratively:

- **`@Controller(path)`** — Mark a class as an HTTP controller
- **Route decorators** — `@Get()`, `@Post()`, `@Put()`, `@Patch()`, `@Delete()`, `@Head()`, `@Options()`, `@All()`
- **Parameter decorators** — `@Body()`, `@Param()`, `@Query()`, `@Header()`, `@Ctx()`, `@Req()`, `@Res()`
- **Guard decorators** — `@UseGuard()` for authentication/authorization
- **Filter decorators** — `@Catch()`, `@UseFilter()` for exception handling
- **Interceptor decorators** — `@UseInterceptor()` for cross-cutting concerns
- **Response decorators** — `@HttpCode()`, `@Redirect()`, `@SetHeader()`
- **Module decorator** — `@Module()` for feature composition

### Dependency Injection

Manage service lifecycles with `@Service()` and the DI container:

```typescript
@Service()                                    // singleton (default)
class Config {}

@Service({ scope: 'transient' })             // new instance each resolve
class RequestLogger {}

@Service({ scope: 'request' })               // one per HTTP request
class RequestId {
  id = crypto.randomUUID();
}
```

Inject services into controllers, other services, and guards:

```typescript
@Controller('/api')
class ApiController {
  constructor(
    private config: Config,
    private logger: RequestLogger,
  ) {}

  @Get() index() { return { ok: true }; }
}
```

### Controller Registration

Automatically discover and register controllers:

```typescript
// Scan a directory, find @Controller classes, build routes
await registerControllers(app, {
  root: './src',        // scan this directory
  prefix: '/api',       // prepend to all routes
  debug: true,          // log discoveries
});

// Or register manually
await registerControllers(app, {
  controllers: [UserController, AdminController],
});

// Or register modules
@Module({
  controllers: [UserController],
  providers: [UserService],
})
class UserModule {}

await registerModule(app, UserModule, { prefix: '/api' });
```

## Installation

```bash
pnpm add nextrush @nextrush/class
```

The package auto-loads `reflect-metadata` for you — no manual import needed.

## When to Use

- Building REST/GraphQL APIs with structured controllers
- Needing dependency injection for services and middleware
- Wanting declarative route and parameter validation
- Sharing business logic across routes via services

## When NOT to Use

- Building minimal, framework-free APIs (use `nextrush` functional API instead)
- Avoiding reflection/decorator overhead (use functional API)

## Architecture

The class-based runtime is built on three layers:

1. **Decorators** (`@nextrush/class` exports) — Declare routes, parameters, guards, filters, interceptors
2. **DI Container** (`@nextrush/di`, re-exported) — Manage service lifecycles
3. **Controller Plugin** (`registerControllers`, `registerModule`) — Auto-discover and register routes

When you call `registerControllers(app, options)`:

1. Discover `@Controller` classes from the filesystem or explicit list
2. For each controller, read its route metadata
3. Resolve dependencies from the DI container
4. Build route handlers with parameter extraction, guards, filters, interceptors
5. Register routes on `app.router`

## Performance

- Minimal startup overhead: controllers are discovered and registered once
- No per-request reflection: metadata is read at registration time, not during requests
- Fast handler execution: route handlers are built at registration time, not dynamically per-request

## Type Safety

Full TypeScript support with zero `any` types:

- Route decorators are type-checked
- Parameters are validated and transformed
- Service dependencies are type-checked via the DI container
- Guard return types are enforced

## See Also

- `nextrush` — the functional API for minimal apps
- `@nextrush/di` — standalone dependency injection container
- `@nextrush/decorators` — standalone decorator package (deprecated, use `@nextrush/class`)
- `@nextrush/controllers` — standalone controller plugin (deprecated, use `@nextrush/class`)

## License

MIT

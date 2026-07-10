---
title: DI & Class-Based Development
type: topic
created: 2026-07-10
sources: [readme-2026-07-10]
tags: [di, decorators, controllers, modules, request-scope]
---
# DI & Class-Based Development

## Packages
`@nextrush/class` (class runtime — decorators, controllers, guards, filters, interceptors, lifecycle, request scope, modules; import via `nextrush/class`), `@nextrush/di` (DI, independent), `@nextrush/testing` (`createTestModule().override().compile()`). `@nextrush/controllers` and `@nextrush/decorators` are **deprecated** compatibility shims for `@nextrush/class`.

## Basic Pattern
```ts
@Service()
class UserService {
  async findAll() { return [{ id: 1, name: 'Alice' }]; }
}

@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}
  @Get() findAll() { return this.userService.findAll(); }
  @Get('/:id') findOne(@Param('id') id: string) { return { id }; }
  @Post() create(@Body() data: unknown) { return data; }
}
```

## Service Scopes
- **Singleton** (default) — one shared instance: `@Service()`
- **Transient** — fresh instance every resolve: `@Service({ scope: 'transient' })`
- **Request** — one instance per request, shared within it: `@Service({ scope: 'request' })`

Request scope is backed by a per-request child DI container. If any part of a controller's dependency graph is request-scoped, `registerControllers` resolves the controller fresh per request; a purely-singleton controller keeps the memoized fast path (zero added per-request cost). Bubbling is automatic. Services read the request via `@Ctx` on the controller method, **not** constructor injection.

Reference: `docs/RFC/RFC-NEXTRUSH-REQUEST-SCOPE.md`.

## Modules
`@Module` groups a feature's controllers/providers and composed sub-features:
```ts
@Module({ controllers: [UserController], providers: [UserService] })
class UserModule {}

@Module({ imports: [UserModule] })
class AppModule {}

await registerModule(app, AppModule, { prefix: '/api' });
```

`@Module` fields: `imports` (other `@Module` classes), `controllers`, `providers` (bare class, or `{provide, useClass}` / `{provide, useValue}` / `{provide, useFactory, inject, scope}`), `exports` (recorded, not yet enforced).

`registerModule` reuses the `registerControllers` pipeline (route building, DI validation, lifecycle hooks, request scope). Imports walked safely — diamond/duplicate imports register once, cycles guarded.

**Known limitation**: modules group but do **not** yet encapsulate — every provider is visible to every module via the shared DI container regardless of `exports`. True per-module encapsulation is planned follow-up (RFC-NEXTRUSH-MODULES.md).

## Parameter Decorators
`@Body()`, `@Body('name')`, `@Param()`, `@Param('id')`, `@Query()`, `@Query('page')`, `@Header()`, `@Header('auth')`, `@Ctx()`, `@Req()` (escape hatch), `@Res()` (escape hatch). Support transforms: `@Param('id', { transform: Number })`, async transforms for validation libs (`@Body({ transform: zodSchema.parseAsync })`).

## Related
- [[topics/architecture]] — guard system, error hierarchy, controllers pipeline.

# NextRush Class-Based API Reference

Full API surface for `import { ... } from 'nextrush/class'`. The class runtime is a **registrar on top of
`nextrush` core** — it mounts `@Controller` routes onto the same router and resolves them from the DI
container. It also re-exports the `@nextrush/di` surface.

## Decorator Import Map

```typescript
import {
  // Class decorators
  Controller,

  // Module decorator
  Module,

  // Route decorators
  Get, Post, Put, Delete, Patch, Head, Options, All,

  // Parameter decorators
  Body, Param, Query, Header, Ctx, Req, Res,
  createCustomParamDecorator,

  // Response decorators
  HttpCode, Redirect, SetHeader,

  // Guards / interceptors / filters
  UseGuard, UseInterceptor, Catch, UseFilter,

  // Metadata readers
  isController, getControllerMetadata, getRouteMetadata, getHttpCode,

  // Registration
  registerControllers, registerModule, ControllerRegistry, buildRoutes,

  // Module graph helpers
  collectModuleControllers, collectModuleGraph, getModuleMetadata, isModule,

  // Discovery
  discoverControllers, getControllersFromResults, getErrorsFromResults,
  FilesystemSource, MemorySource,

  // Lifecycle hooks (duck-typed — no decorator)
  type OnInit, type OnShutdown,

  // Diagnostics
  getClassDiagnostics,

  // Errors
  ControllerError, ControllerResolutionError, DiscoveryError, GuardRejectionError,
  NotAControllerError, NotAModuleError, RouteRegistrationError, MissingParameterError,

  // DI (re-exported from @nextrush/di)
  Service, Repository, inject, container, createContainer,
} from 'nextrush/class';
```

Each import's meaning and exact signature is below. `nextrush/class` auto-loads `reflect-metadata`,
so do **not** double-import it.

## Controller Decorator

```typescript
@Controller(pathOrOptions?: string | ControllerOptions)

interface ControllerOptions {
  path?: string;              // base path (default: derived from class name, e.g. UserController → /user)
  version?: string;           // mounts every route under /<version> (e.g. 'v1')
  middleware?: MiddlewareRef[]; // runs on every route of this controller
  tags?: string[];            // OpenAPI grouping tags
}
```

`@Controller` both marks the class an HTTP controller **and** makes it DI-resolvable.

## Route Decorators

Each accepts a path, an options object, or both:

```typescript
@Get(pathOrOptions?: string | RouteOptions, options?: RouteOptions)
@Post(...) @Put(...) @Patch(...) @Delete(...) @Head(...) @Options(...) @All(...)

interface RouteOptions {
  path?: string;
  statusCode?: number;      // success status (overridden by @HttpCode when both set)
  description?: string;     // OpenAPI/doc metadata
  deprecated?: boolean;     // OpenAPI/doc metadata
  middleware?: MiddlewareRef[]; // route-level middleware (runs after controller middleware)
}

@HttpCode(status: number)         // fixed success status, method-level
@Redirect(url: string, status?: number) // 302 default
@SetHeader(name: string, value: string) // stackable
```

## Parameter Decorators

```typescript
@Body()                       // whole parsed body (requires body-parser)
@Body('name')                 // one body field
@Body({ transform, required }) 

@Param()                      // all params: { id: string }
@Param('id')                  // one param
@Param('id', { transform: Number, required, defaultValue })

@Query()                      // whole query object
@Query('page')                // one key
@Query('limit', { defaultValue: 10, transform: Number })

@Header('authorization')                 // one header
@Header('x-api-version', { defaultValue: 'v1' })

@Ctx()                        // the full request Context
@Req() / @Res()               // raw adapter Request/Response (escape hatch)
```

Options: `transform` (sync or async value transform, applied before injection), `required` (throw
`MissingParameterError` / 400 when absent), `defaultValue` (param/query only). Params and body
default to `required: true`; query and header to `required: false`.

### Custom parameter decorators

```typescript
import { createCustomParamDecorator } from 'nextrush/class';

const CurrentUser = createCustomParamDecorator((ctx) => ctx.state.user, { required: false });

@Controller('/users')
class UsersController {
  @Get('/me')
  profile(@CurrentUser user: User) { return user; }  // NOTE: no parentheses
}
```

The factory returns a **parameter decorator used directly** (`@CurrentUser`, not `@CurrentUser()`).
Options mirror `@Param`: `{ transform?, required? }`. Sync or async extractor.

## Service & DI (from @nextrush/di)

```typescript
@Service()                    // default injectable; singleton unless scoped
@Repository()                 // data-access service (same behavior as @Service)
@Config({ prefix: 'DB' })     // config holder; always singleton

class UserService {
  findAll() { ... }
}

@Controller('/users')
class UsersController {
  constructor(private users: UserService) {}  // resolved by type automatically
}
```

`@inject(token)` overrides a parameter's token; `@Optional()` allows `undefined` for a missing
dependency; `delay(() => B)` breaks circular references.

### Scopes

| Scope | Instance lifetime |
| ----- | ----------------- |
| `singleton` | One per container, shared. **Default.** |
| `transient` | New instance per resolve. |
| `request` | One per HTTP request (per-request child container). |

```typescript
@Service({ scope: 'transient' })
class RequestLogger {}

@Service({ scope: 'request' })
class RequestContext { user?: User; }
```

**Request scope bubbles.** A class whose declared scope is `'request'` — **or that transitively
depends on one** — resolves fresh per request. A singleton controller depending on a request-scoped
service is auto-promoted to request scope so it never caches one request's instance forever. A
pure-singleton graph keeps the memoized fast path.

## Modules (module-first)

A class app is module-first: a feature is a `@Module`, features are composed into a root `AppModule`,
and one `registerModule` call wires the graph.

```typescript
import { Module, registerModule } from 'nextrush/class';

@Module({
  imports: [BillingModule],                  // other @Module classes to compose
  controllers: [UsersController],            // @Controller classes owned here
  providers: [UsersService, { provide: 'CONFIG', useValue: cfg }],
  exports: [UsersService],                   // intended visibility (recorded, NOT yet enforced)
})
class UsersModule {}

@Module({ imports: [UsersModule, BillingModule] })
class AppModule {}

const app = createApp();
await registerModule(app, AppModule, { prefix: '/api' });
```

**Option types:** `imports`/`controllers`/`exports` are `Function[]`; `providers` is
`ModuleProvider[]` — a bare class, or a config with exactly one of `useValue`/`useFactory`/`useClass`
(plus optional `provide`, `inject`, `scope`). Class/factory providers default to `singleton`.

**`registerModule(app, RootModule, options?)`** walks `imports` post-order, dedupes diamond imports,
guards import cycles (`NotAModuleError` on a non-module), registers each module's providers into one
container, then hands the flattened controllers to the shared `registerControllers` pipeline — so it
inherits request scope, lifecycle-hook bridging, and eager validation.

**`exports` is not an encapsulation boundary today** — every provider registered in a graph is
resolvable everywhere in that graph. For true isolation use a separate call with `isolate: true`.

## Controller Registration

`registerControllers(app, options)` is the underlying registrar that `registerModule` delegates to.

```typescript
await registerControllers(app, {
  root: './src',                              // scan a directory (auto-discovery)
  controllers: [UsersController],             // or an explicit list — merged with root results
  include: ['**/*.controller.ts'],            // globs (default), not regex
  exclude: ['**/*.test.ts', '**/__tests__/**'], // globs (default), not regex
  prefix: '/api',
  middleware: [myMiddleware],
  container: customContainer,                 // default: app.container → global
  isolate: false,                             // give this call its own fresh container
  strict: false,                              // throw on discovery errors instead of logging
  validate: true,                             // eagerly resolve every controller at boot
  diagnostics: false,                         // collect a DiagnosticsReport (see below)
  debug: false,
});
```

| Option | Type | Default | Meaning |
| ------ | ---- | ------- | ------- |
| `root` | `string` | — | Directory to scan (enables auto-discovery) |
| `controllers` | `Function[]` | `[]` | Explicit classes, merged with `root` results |
| `include` | `string[]` | `['**/*.controller.ts', '**/*.controller.js']` | Glob patterns |
| `exclude` | `string[]` | tests / `node_modules` / `dist` | Glob patterns |
| `prefix` | `string` | `''` | Route prefix |
| `middleware` | `Middleware[]` | `[]` | Global middleware for all routes |
| `container` | `Container` | `app.container` → global | DI container |
| `isolate` | `boolean` | `false` | Fresh isolated container for this call |
| `strict` | `boolean` | `false` | Throw on discovery errors |
| `validate` | `boolean` | `true` | Eagerly resolve controllers at boot |
| `diagnostics` | `boolean` | `false` | Collect the diagnostics report |
| `debug` | `boolean` | `false` | Log to stderr |

**Discovery side-effect:** each matched file is dynamically `import()`-ed, running its top-level
code. Use a narrow `root`/`include` or an explicit `controllers` list when a file has side-effects.
Filesystem discovery is **Node-only**; on Bun/Deno/Edge use an explicit `controllers` list or a
`MemorySource`.

## Discovery

```typescript
import { discoverControllers, getControllersFromResults, getErrorsFromResults } from 'nextrush/class';

const results = await discoverControllers({ root: './src' });  // DiscoveryResult[]
const controllers = getControllersFromResults(results);
const errors = getErrorsFromResults(results);
```

`registerControllers` accepts a `source` (a `DiscoverySource` with `discover(): ClassRef[]`). Two ship
with the package:

```typescript
import { FilesystemSource, MemorySource, registerControllers } from 'nextrush/class';

// Positional constructor: (root, include, exclude, debug)
await registerControllers(app, {
  source: new FilesystemSource('./dist', ['**/*.controller.js'], [], false),
});

// Explicit list source — great for tests and edge/serverless builds
await registerControllers(app, {
  source: new MemorySource([UsersController, BillingController]),
});
```

`source` takes precedence over `root` and is incompatible with `controllers`.

## Guards

```typescript
import { UseGuard } from 'nextrush/class';
import type { GuardFn, CanActivate, GuardContext } from 'nextrush/class';

// Function guard
const AuthGuard: GuardFn = (ctx) => ctx.get('authorization') !== undefined;

// Class guard (DI-resolved, per request)
@Service()
class AdminGuard implements CanActivate {
  constructor(private auth: AuthService) {}
  async canActivate(ctx: GuardContext): Promise<boolean> {
    const user = await this.auth.verify(ctx.get('authorization'));
    ctx.state.user = user;
    return Boolean(user);
  }
}

@Controller('/admin')
@UseGuard(AuthGuard, AdminGuard)   // class-level
class AdminController {
  @Get()
  @UseGuard(RoleGuard('admin'))    // method-level
  dashboard() { ... }
}
```

- `GuardFn` returns `true` (allow) / `false` (deny → `GuardRejectionError` / 403); **throw** a typed
error for a non-403 status (e.g. `UnauthorizedError` → 401).
- **Order:** class guards run before method guards; within one `@UseGuard(A, B)`, left-to-right;
stacked decorators apply bottom-to-top; the chain short-circuits at the first failure.
- `GuardContext` is read-only request snapshot + live mutable `ctx.state` for passing a verified user.

## Interceptors

```typescript
import { UseInterceptor } from 'nextrush/class';
import type { Interceptor, Context } from 'nextrush/class';

@Service()
class WrapInterceptor implements Interceptor {
  async intercept(ctx: Context, next: () => Promise<unknown>): Promise<unknown> {
    const result = await next();          // resolves to the handler's return value
    return { data: result, at: Date.now() };// transform what proceeds to response handling
  }
}

@Controller('/orders')
class OrdersController {
  @UseInterceptor(WrapInterceptor)
  @Get()
  list() { return loadOrders(); }
}
```

Class-level interceptors are outer; method-level are inner (closest to the handler). `next()` resolves
to the handler's return; whatever `intercept` returns flows into response handling. Opt-in — routes
without `@UseInterceptor` behave as before.

## Exception Filters

```typescript
import { Catch, UseFilter } from 'nextrush/class';
import type { ExceptionFilter, Context } from 'nextrush/class';
import { NotFoundError } from 'nextrush';

@Service()
@Catch(NotFoundError)
class NotFoundFilter implements ExceptionFilter {
  catch(error: unknown, ctx: Context): void {
    ctx.status = 404;
    ctx.json({ error: 'Resource not found' });
  }
}

@Controller('/users')
@UseFilter(NotFoundFilter)
class UsersController {
  @Get('/:id')
  findOne(@Param('id') id: string) {
    throw new NotFoundError('User not found');
  }
}
```

- `@Catch(...)` matches with `instanceof` (base type catches subclasses); `@Catch()` / no `@Catch` =
catch-all.
- Method-level filters take precedence over class-level; first matching filter wins; no match → the
error rethrows to the global error middleware.
- A filter wraps the whole route handler (guards, params, handler, interceptors), not the middleware
pipeline.

## Lifecycle Hooks (duck-typed)

```typescript
import type { OnInit, OnShutdown } from 'nextrush/class';

@Service()
class DatabaseService implements OnInit, OnShutdown {
  async onInit() { await this.pool.connect(); }      // at app.ready(), dependency order
  async onShutdown() { await this.pool.end(); }      // at app.close(), exact reverse order
}
```

- **No decorator** — implement the plain method; the registrar detects it on the resolved instance.
- Hooks are collected by walking the reachable service graph from registered controllers, so a
service is included only if reachable (directly or transitively).
- Register **before** `serve()`/`listen()`/`ready()`; `validate: false` disables controller-level hook
detection; a rejecting `onInit` fails boot. App lifecycle ≠ per-request lifecycle.

## Diagnostics

```typescript
import { registerControllers, getClassDiagnostics } from 'nextrush/class';

await registerControllers(app, {
  controllers: [UsersController],
  diagnostics: true,                     // required — opt-in, zero-cost when off
});

const report = getClassDiagnostics(app); // DiagnosticsReport | undefined
```

`getClassDiagnostics(app)` is **synchronous**, takes the `Application`, and returns `undefined` when
diagnostics were off. The report is a read-only snapshot:

| Field | Type | Holds |
| ----- | ---- | ----- |
| `routes` | `RouteEntry[]` | `method`, `path` (prefix applied), `controller` |
| `providers` | `ProviderEntry[]` | `token`, `dependencies` |
| `duplicateRoutes` | `DuplicateRoute[]` | method+path collisions with `count` |
| `circularDependencies` | `CircularDependency[]` | provider cycles |
| `timings` | `TimingEntry[]` | bootstrap stage + ms |

## Request-Scope Pipeline Order (per matched route)

```text
Controller-level middleware → guard(s) → resolve controller → inject params → interceptor(s) → handler → interceptor post-processing → exception filter(s) → response
```

The whole route pipeline runs inside the same middleware onion and the same error boundary as the
functional API. Guards gate before the method, interceptors wrap it, filters map a thrown error.

## Errors

Throw typed `HttpError` subclasses from `nextrush` (`NotFoundError`, `UnauthorizedError`, …) or the
class-specific errors above (`NotAModuleError`, `NotAControllerError`, `GuardRejectionError`, …).
They serialize consistently and land in the same error boundary — see `references/errors.md`.

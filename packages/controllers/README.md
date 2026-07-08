# @nextrush/controllers

> Connect decorators, dependency injection, and routing into automatic controller registration with guards and parameter extraction.

## The Problem

Decorator-based controllers don't wire themselves. Without a connection layer:

- You write boilerplate to register each route from decorated methods
- Guards need manual execution before each handler
- Parameter extraction logic is duplicated across handlers
- DI resolution happens ad-hoc with no error handling

## How NextRush Approaches This

`@nextrush/controllers` is the **integration layer** that reads decorator metadata and builds optimized route handlers. It ships one function — `registerControllers(app, options)` — a plain async **registrar**, not a plugin. It reads `app.router` and `app.container` directly and has no lifecycle of its own:

1. **Discovery**: Find controller classes (manual or auto-discovery)
2. **Metadata Reading**: Extract `@Controller`, `@Get`/`@Post`, `@Body`/`@Param` metadata
3. **Guard Chain Building**: Collect class and method guards in execution order
4. **Handler Building**: Create route handlers with parameter injection
5. **Route Registration**: Register handlers with `app.router`

This happens once at startup, before the server starts listening. At runtime, handlers are pre-built and optimized.

## Mental Model

Think of `registerControllers` as a **compiler for controllers**, run once at boot:

```
@Controller + @Get + @Body + @UseGuard
              ↓
    [registerControllers reads metadata]
              ↓
    Built route handler, registered on app.router:
      1. Execute guards (class → method order)
      2. Resolve controller from DI
      3. Extract & transform parameters
      4. Call controller method
      5. Send response
```

## Installation

```bash
pnpm add nextrush
```

Or install individual packages:

```bash
pnpm add @nextrush/controllers @nextrush/decorators @nextrush/di
```

> `reflect-metadata` is auto-imported when you use `nextrush/class`. If you use individual packages, add `import 'reflect-metadata'` at your entry point.

**Required `tsconfig.json` settings:**

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## Quick Start

```typescript
// src/controllers/user.controller.ts
import { Controller, Get, Post, Body, Param, UseGuard } from '@nextrush/decorators';
import { Service } from '@nextrush/di';
import type { GuardFn } from '@nextrush/decorators';

// Service with DI
@Service()
class UserService {
  findAll() {
    return [{ id: 1, name: 'Alice' }];
  }
  findOne(id: string) {
    return { id, name: 'Alice' };
  }
  create(data: { name: string }) {
    return { id: Date.now(), ...data };
  }
}

// Guard
const AuthGuard: GuardFn = (ctx) => Boolean(ctx.get('authorization'));

// Controller (auto-discovered from ./src directory)
@UseGuard(AuthGuard)
@Controller('/users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Get('/:id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Post()
  create(@Body() data: { name: string }) {
    return this.userService.create(data);
  }
}
```

```typescript
// src/index.ts
import { createApp, listen } from 'nextrush';
import { registerControllers } from 'nextrush/class';

async function main() {
  const app = createApp(); // batteries-included: app.router is already set

  // Auto-discover controllers from ./src and register them on app.router.
  // Must be awaited before listen()/serve() — routes aren't registered until it resolves.
  await registerControllers(app, {
    root: './src', // Scan this directory for @Controller classes
    prefix: '/api', // Add prefix to all routes: /api/users
    debug: true, // Log discovered controllers at startup
  });

  listen(app, { port: 8080 });
}

main();
```

## Handler Building Pipeline

When you call `registerControllers()`, this is what happens for each controller:

### 1. Validate Controller

```typescript
// Checks:
// - Has @Controller decorator → NotAControllerError if missing
// - Has at least one route decorator → NoRoutesError if missing
```

### 2. Collect Guards

```typescript
// Collects guards in order:
// 1. Class-level guards (from @UseGuard on class)
// 2. Method-level guards (from @UseGuard on method)

// Guards can be functions or classes implementing CanActivate
const guards = getAllGuards(UserController, 'findOne');
// [AuthGuard, RoleGuard] (if both applied)
```

### 3. Build Handler Function

For each route method, a handler is created:

```typescript
// Pseudo-code of the generated handler:
async function handler(ctx: Context) {
  // 1. Execute guards (class → method order)
  for (const guard of guards) {
    if (isGuardClass(guard)) {
      const instance = container.resolve(guard);
      if (!(await instance.canActivate(guardContext))) {
        throw new GuardRejectionError(guard.name);
      }
    } else {
      if (!(await guard(guardContext))) {
        throw new GuardRejectionError('Guard');
      }
    }
  }

  // 2. Resolve controller from DI (singleton — resolved once, then memoized)
  const controller = container.resolve(UserController);

  // 3. Extract & transform parameters (async transform support)
  //    Supports: body, query, param, header, ctx, req, res, custom
  const args = await resolveParameters(ctx, paramMetadata);

  // 4. Call the controller method
  const result = await controller.findOne(...args);

  // 5. Apply @SetHeader headers + route statusCode — AFTER the method returns
  for (const { name, value } of responseHeaders) {
    ctx.set(name, value);
  }
  if (statusCode !== undefined) {
    ctx.status = statusCode;
  }

  // 6. Handle response
  //    - @Redirect: set Location header, override URL/status from return value
  //    - Default: ctx.json(result) if nothing has been sent yet
  if (redirectMetadata) {
    const url = typeof result === 'string' ? result : redirectMetadata.url;
    ctx.status = result?.statusCode ?? redirectMetadata.statusCode;
    ctx.set('Location', url);
    ctx.send('');
  } else if (result !== undefined) {
    ctx.json(result);
  }
}
```

### 4. Register Routes

```typescript
// Routes are registered directly on app.router:
app.router.get('/api/users', handler1);
app.router.get('/api/users/:id', handler2);
app.router.post('/api/users', handler3);
```

## Guard Execution

Guards protect routes by running before the handler. Both function-based and class-based guards are supported:

### Function Guards

```typescript
const AuthGuard: GuardFn = async (ctx) => {
  const token = ctx.get('authorization');
  if (!token) return false;

  const user = await verifyToken(token);
  ctx.state.user = user;
  return Boolean(user);
};
```

### Class Guards (with DI)

```typescript
@Service()
class AuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(ctx: GuardContext): Promise<boolean> {
    const token = ctx.get('authorization');
    if (!token) return false;

    const user = await this.authService.verify(token);
    ctx.state.user = user;
    return Boolean(user);
  }
}
```

### Guard Resolution

`registerControllers` detects guard type using `isGuardClass()`:

- **Function guards**: Called directly with `GuardContext`
- **Class guards**: Resolved from the app's DI container, then `canActivate()` called

### Guard Context (snapshot contract)

Every guard receives a `GuardContext` — a per-guard snapshot built once, before any
guard on the route runs. The fields are **not** all the same kind of reference:

- **`state` is the live `ctx.state` reference.** Mutations are visible to later guards
  and to the handler, so this is the supported channel for a guard to pass data forward
  (for example `ctx.state.user = user` in the examples above).
- **`method`, `path`, `params`, `query`, `headers`, and `body` are captured by value**
  at guard time. A guard sees the request as it was when guards began; it cannot mutate
  the real request through these fields, and a mutation made by middleware _after_ the
  snapshot would not be observed. Attach forward state via `state`, never by writing to
  the snapshotted fields.

### Guard Rejection

A guard denies access in one of two ways, with different outcomes:

**1. Return `false`** → `GuardRejectionError` (403 Forbidden):

```typescript
const AuthGuard: GuardFn = (ctx) => Boolean(ctx.get('authorization'));

// When it returns false:
throw new GuardRejectionError('AuthGuard');
// HTTP Response:
// Status: 403 Forbidden
// Body: { "error": "GuardRejectionError", "message": "Access denied", "code": "GUARD_REJECTED" }
```

**2. Throw an error** → the error propagates **unchanged**. Throw a typed `HttpError` to
control the status and message — for example `UnauthorizedError` for a 401:

```typescript
import { UnauthorizedError } from '@nextrush/errors';

const AuthGuard: GuardFn = (ctx) => {
  if (!ctx.get('authorization')) {
    throw new UnauthorizedError('Missing bearer token'); // → 401, not 403
  }
  return true;
};
```

The guard's error is never swallowed or downgraded to a generic 403 — its status, message, and
stack are preserved. This makes 401 (and any other status) expressible from a guard.

## Exception filters

Exception filters localize error handling to a controller or a single route. They are
**opt-in**: a controller/route with no filter behaves exactly as before — thrown errors
propagate to the global error middleware.

A filter is a class implementing `ExceptionFilter`. It declares which errors it handles with
`@Catch(...)` and produces the response by mutating `ctx`. Attach filters with `@UseFilter`
(usable at both the controller and method level).

```typescript
import { Catch, Controller, Get, UseFilter, type ExceptionFilter } from '@nextrush/controllers';
import { Service } from '@nextrush/di';
import type { Context } from '@nextrush/types';

class EntityNotFoundError extends Error {}

@Service()
@Catch(EntityNotFoundError)
class NotFoundFilter implements ExceptionFilter {
  catch(error: unknown, ctx: Context): void {
    ctx.status = 404;
    ctx.json({ error: 'Not found' });
  }
}

@UseFilter(NotFoundFilter)
@Controller('/users')
class UserController {
  @Get('/:id')
  findOne() {
    throw new EntityNotFoundError('no such user'); // → handled by NotFoundFilter (404)
  }
}
```

### Resolution

Filters are **class-based and resolved from the DI container** (like class guards), so they can
inject services — a logger, metrics, or an error-to-response mapper. Register a filter the same
way you register any injectable, and resolution happens lazily, only when an error is actually
thrown.

### Matching and precedence

When a route's body throws — from a guard, parameter resolution, or the handler method — the
first matching filter handles it:

- `@Catch(A, B)` matches when `error instanceof A` **or** `error instanceof B` (subclasses
  included).
- No-arg `@Catch()` (or a filter with no `@Catch`) is a **catch-all** and matches any error.
- **Method-level filters take precedence over class-level filters**; within a level, the
  first-listed matching filter wins.
- The first matching filter is invoked and remaining filters are skipped.

### Relation to the global error middleware

Filters sit **in front of** the global error middleware, not in place of it. If **no** filter
matches the thrown error, it is **rethrown unchanged** and the global error middleware handles
it exactly as it does today. This is what keeps filters non-breaking and preserves guard-error
propagation: a filter only intercepts errors it explicitly opts into via `@Catch`.

## Parameter Extraction

Parameters are extracted from the request based on decorator metadata:

### Extraction Sources

| Decorator         | Source            | Example                            |
| ----------------- | ----------------- | ----------------------------------- |
| `@Body()`         | `ctx.body`        | Full request body                  |
| `@Body('name')`   | `ctx.body.name`   | Specific body property             |
| `@Param()`        | `ctx.params`      | All route parameters               |
| `@Param('id')`    | `ctx.params.id`   | Specific route parameter           |
| `@Query()`        | `ctx.query`       | All query parameters               |
| `@Query('page')`  | `ctx.query.page`  | Specific query parameter           |
| `@Header('auth')` | `ctx.get('auth')` | Specific header                    |
| `@Ctx()`          | `ctx`             | Full context object                |
| Custom            | User-defined      | Via `createCustomParamDecorator()` |

### Async Transform Support

Transform functions can be async, enabling validation library integration:

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

@Controller('/users')
class UserController {
  @Post()
  async create(@Body({ transform: UserSchema.parseAsync }) data: z.infer<typeof UserSchema>) {
    // data is validated and typed
    return this.userService.create(data);
  }
}
```

### Missing Parameters

Required parameters throw `MissingParameterError` (400):

```typescript
// If @Body('email') is required but not provided:
throw new MissingParameterError('UserController', 'create', 'email', 'body');

// HTTP Response:
// Status: 400 Bad Request
// Body: { "message": "Required body parameter \"email\" is missing", "code": "MISSING_PARAMETER" }
```

## Response & status codes

A plain value returned from a handler is serialized as JSON with **HTTP 200**:

```typescript
@Get('/:id')
findOne(@Param('id') id: string) {
  return { id }; // → 200 OK, Content-Type: application/json
}
```

Returning an object with a `status` field does **not** change the HTTP status — the response is
still `200`, with `status` sitting inside the body. To send a different status code, use one of:

| Approach                                        | Use when                                        |
| ----------------------------------------------- | ----------------------------------------------- |
| `@HttpCode(201)` on the method                  | The status is fixed for the handler             |
| Route option `@Get('/x', { statusCode: 201 })`  | The status is fixed for the route               |
| Inject `@Ctx()` and set `ctx.status = 202`      | The status depends on runtime logic             |
| `throw` an `HttpError` subclass                 | Signalling an error (e.g. `NotFoundError` → 404) |

```typescript
import { NotFoundError } from 'nextrush';

@Controller('/users')
export class UserController {
  @Get('/:id')
  findById(@Param('id', { transform: Number }) id: number) {
    const user = this.userService.findById(id);
    if (!user) {
      throw new NotFoundError('User not found'); // → 404 Not Found
    }
    return user; // → 200 OK
  }
}
```

### `@HttpCode(statusCode)`

Set a fixed status code for a handler that returns a value:

```typescript
import { Controller, Post, HttpCode, Body } from 'nextrush/class';

@Controller('/users')
export class UserController {
  @Post()
  @HttpCode(201)
  create(@Body() data: CreateUserDto) {
    return this.userService.create(data); // → 201 Created
  }
}
```

Precedence:

- `@HttpCode` **overrides** the route decorator's `statusCode` option when both are present
  (`@Post('/', { statusCode: 200 }) @HttpCode(201)` responds with `201`).
- A thrown `HttpError` keeps the error's status (`@HttpCode` does not apply to error responses).
- `@Redirect` keeps the redirect status (the redirect wins over `@HttpCode`).

## Controller lifecycle: singletons

Controllers are resolved from the DI container as **singletons**. One instance is created
lazily on the first request to a route and reused for every request afterward — and it is
shared across all concurrent requests.

Keep controllers **stateless**. Per-request data stored on `this` leaks across requests:

```typescript
// ❌ Wrong — `this.currentUser` is shared by every request to this controller
@Controller('/users')
export class UserController {
  private currentUser?: User;

  @Get('/me')
  me(@Ctx() ctx: Context) {
    this.currentUser = ctx.state.user as User; // leaks into the next request
    return this.currentUser;
  }
}

// ✅ Correct — per-request state lives in ctx.state / @Ctx, never on `this`
@Controller('/users')
export class UserController {
  @Get('/me')
  me(@Ctx() ctx: Context) {
    return ctx.state.user;
  }
}
```

Constructor-injected dependencies (services, repositories) are safe to hold on `this` — they
are themselves singletons (or explicitly `transient`). Only **per-request** state is unsafe.

> Request-scoped DI — a fresh controller/service instance per request — is **proposed** future
> work and requires an RFC. `Scope` is `'singleton' | 'transient'` today.

## registerControllers Options

```typescript
import type { ControllersOptions } from '@nextrush/controllers';

interface ControllersOptions {
  // Explicit controller list — a first-class alternative to auto-discovery
  controllers?: Function[];

  // Auto-discovery options
  root?: string; // Directory to scan
  include?: string[]; // Glob patterns (default: ['**/*.controller.ts', '**/*.controller.js'])
  exclude?: string[]; // Exclude patterns (default: tests, node_modules, dist, __tests__)

  // Route configuration
  prefix?: string; // Global route prefix (e.g., '/api')
  middleware?: Middleware[]; // Global middleware for all routes

  // DI container — defaults to app.container, then the global container
  container?: Container;

  // Per-app DI isolation — give this registration its own container so two apps
  // in one process don't share service singletons (opt-in, default false)
  isolate?: boolean;

  // Debugging
  debug?: boolean; // Log discovered routes
  strict?: boolean; // Throw on discovery errors
}
```

`registerControllers` resolves its container in this order: `options.container` → `app.container` → the global `@nextrush/di` container. There is no `router` option — it always registers on `app.router`, so the app must be created with a router (`createApp()` from `nextrush`, or `createApp({ router })` from `@nextrush/core`).

### Isolated container (opt-in)

`@Service`/`@Repository`/`@Config` register their classes into the process-global
`@nextrush/di` container at import time. So by default, two `createApp()` instances in the
same process that fall back to the global container **share one instance of each service** —
a `container.register(TOKEN, { useValue })` on one app is visible to the other, and test state
leaks between apps.

Pass `isolate: true` to give a registration call its **own** container:

```typescript
// Each app owns its own service singletons — no cross-app sharing.
await registerControllers(app1, { controllers: [UserController], isolate: true });
await registerControllers(app2, { controllers: [UserController], isolate: true });
```

`registerControllers` creates a fresh container with `createContainer()` and re-registers the
reachable service graph into it: for each controller it reads the constructor dependency
**classes** (transitively) and registers every `@Service`/`@Repository`/`@Config` among them
with its declared scope. Controllers, their route handlers, and boot-time validation all
resolve from this isolated container.

**Register non-class providers first.** The graph walk can only auto-register **class**
dependencies. String/symbol `@inject('TOKEN')` tokens and any `useValue`/`useFactory`
providers carry no class metadata, so you must register them on the container you pass
**before** calling `registerControllers` — which also means passing your own `container`
(it always wins, even under `isolate: true`):

```typescript
const container = createContainer();
container.register('DATABASE_URL', { useValue: process.env.DATABASE_URL });
container.register('CACHE', { useFactory: () => new RedisCache() });

const app = createApp({ container });
await registerControllers(app, {
  controllers: [UserController],
  container,        // caller-owned container always wins
  isolate: true,    // still re-registers the @Service graph into it
});
```

`@Optional()` dependencies that stay unregistered resolve to `undefined`, exactly as without
isolation. `isolate` defaults to `false`, so existing callers are unaffected.

### Explicit Registration

Pass `controllers` directly to register a known list of controller classes without
scanning the filesystem. This is a **first-class, fully supported** alternative to
auto-discovery — reach for it when explicit wiring reads better than convention:
greppable registration, deterministic order, no filesystem scan (tests, bundled or
serverless builds where dynamic `import()` of a source tree isn't available).

```typescript
// Explicit controller list — no filesystem scanning
await registerControllers(app, {
  controllers: [UserController, ProductController],
  prefix: '/api',
});
```

`root` (auto-discovery) and `controllers` (explicit) can also be combined — discovered
controllers and those passed in `controllers` are merged.

### Auto-Discovery (Recommended)

```typescript
// ✅ Recommended — imports files matching the *.controller.* convention
await registerControllers(app, {
  root: './src',
  prefix: '/api',
});
```

By default, discovery imports only files matching the `*.controller.*` convention
(`user.controller.ts`, `modules/user/user.controller.ts`, …). Services, guards, and
repositories do **not** need to match — they load transitively via the controllers that
import them, so their `@Service`/`@Repository` registration side-effects still fire.

To scan every source file instead (the pre-v3.2 behavior), pass the scan-all escape hatch:

```typescript
await registerControllers(app, {
  root: './src',
  include: ['**/*.ts', '**/*.js'], // scan-all: import every source file
});
```

> **Import side-effect:** discovery works by dynamically `import()`ing each matched module,
> which runs its top-level code (DI registration, singleton construction, etc.). Narrow
> `include` if a module has side-effects you don't want executed at startup.

## Error Hierarchy

All errors extend `HttpError` from `@nextrush/errors` with proper status codes:

### Server Errors (5xx)

| Error                       | Code | Description                        |
| ---------------------------- | ---- | ----------------------------------- |
| `NotAControllerError`       | 500  | Class missing `@Controller`        |
| `NoRoutesError`             | 500  | Controller has no route decorators |
| `ControllerResolutionError` | 500  | DI failed to resolve controller    |
| `RouteRegistrationError`    | 500  | Route registration failed          |
| `DiscoveryError`            | 500  | File discovery failed              |

### Client Errors (4xx)

| Error                     | Code | Description                           |
| ------------------------- | ---- | -------------------------------------- |
| `MissingParameterError`   | 400  | Required parameter not provided       |
| `ParameterInjectionError` | 400  | Parameter transform/validation failed |
| `GuardRejectionError`     | 403  | Guard returned false                  |

### Error Usage

```typescript
import {
  GuardRejectionError,
  MissingParameterError,
  ControllerResolutionError,
} from '@nextrush/controllers';

// In error handling middleware:
app.use(async (ctx) => {
  try {
    await ctx.next();
  } catch (error) {
    if (error instanceof GuardRejectionError) {
      ctx.status = 403;
      ctx.json({ error: 'Access denied', guard: error.guardName });
    } else if (error instanceof MissingParameterError) {
      ctx.status = 400;
      ctx.json({ error: error.message, parameter: error.paramName });
    }
  }
});
```

## Development Runtime

Use `@nextrush/dev` for development. It runs with SWC on Node.js, emitting decorator metadata
that DI requires — and validates your `tsconfig.json` at startup:

```bash
pnpm add -D @nextrush/dev
```

```json
{
  "scripts": {
    "dev": "nextrush dev",
    "build": "nextrush build",
    "start": "node dist/index.js"
  }
}
```

## API Reference

### Exports

```typescript
// Registration
export { registerControllers } from '@nextrush/controllers';

// Discovery
export { discoverControllers, getControllersFromResults, getErrorsFromResults } from '@nextrush/controllers';

// Registry
export { ControllerRegistry } from '@nextrush/controllers';

// Builder
export { buildRoutes } from '@nextrush/controllers';

// Types
export type {
  BuiltRoute,
  ControllersOptions,
  DiscoveryOptions,
  DiscoveryResult,
  RegisteredController,
  ResolvedOptions,
} from '@nextrush/controllers';

// Errors
export {
  ControllerError,
  ControllerResolutionError,
  DiscoveryError,
  GuardRejectionError,
  HttpError,
  MissingParameterError,
  NoRoutesError,
  NotAControllerError,
  ParameterInjectionError,
  RouteRegistrationError,
} from '@nextrush/controllers';
```

Decorators and DI are also re-exported for convenience (`Controller`, `Get`, `Post`, `Body`, `UseGuard`, `Service`, `Repository`, `container`, `inject`), or import them directly from `@nextrush/decorators` and `@nextrush/di`.

## Common Mistakes

### Mistake 1: Forgetting reflect-metadata

```typescript
// ❌ Wrong - DI won't work
import { Controller } from '@nextrush/decorators';

// ✅ Correct - must be first import
import 'reflect-metadata';
import { Controller } from '@nextrush/decorators';
```

### Mistake 2: Not awaiting registerControllers

```typescript
// ❌ Wrong - routes won't be registered before the server starts
registerControllers(app, { root: './src' });
listen(app);

// ✅ Correct - await the async registrar
await registerControllers(app, { root: './src' });
listen(app);
```

### Mistake 3: Guards sending responses

Guards receive `GuardContext`, not full `Context`. They cannot send responses:

```typescript
// ❌ Wrong - GuardContext has no json()
const BadGuard: GuardFn = (ctx) => {
  ctx.json({ error: 'Denied' }); // TypeError!
  return false;
};

// ✅ Correct - return false, let error handler respond
const GoodGuard: GuardFn = (ctx) => {
  return Boolean(ctx.get('authorization'));
};
```

## Troubleshooting

### "TypeInfo not known for Controller"

**Cause**: `emitDecoratorMetadata` not enabled or using tsx/esbuild.

**Fix**: Use `@nextrush/dev` or compile with `tsc`.

### "Controller has no routes defined"

**Cause**: Missing `@Get`/`@Post` decorators on methods.

**Fix**: Add route decorators:

```typescript
@Controller('/users')
class UserController {
  @Get() // ← Required!
  findAll() {}
}
```

### "registerControllers() requires an app with a router"

**Cause**: The app was created without a router — either via `@nextrush/core`'s `createApp()` with no `router` option, or a custom setup that never wired one.

**Fix**: Use `createApp()` from `nextrush` (batteries-included), or pass one explicitly: `createApp({ router: createRouter() })` from `@nextrush/core`.

### "Access denied" but guard should pass

**Cause**: Guard is returning `undefined` instead of `true`.

**Fix**: Ensure guard returns boolean:

```typescript
// ❌ Wrong - returns undefined if no token
const BadGuard: GuardFn = (ctx) => {
  const token = ctx.get('auth');
  if (token) return true;
  // Missing return false!
};

// ✅ Correct - always returns boolean
const GoodGuard: GuardFn = (ctx) => {
  return Boolean(ctx.get('auth'));
};
```

## License

MIT

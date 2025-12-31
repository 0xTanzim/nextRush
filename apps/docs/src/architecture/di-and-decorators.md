---
title: DI & Decorators
description: Deep-dive into class-based architecture — dependency injection, decorators, controllers, and the request execution pipeline.
---

# Class-Based Architecture (DI & Decorators)

> Deep-dive into how NextRush works under the hood: dependency injection, decorators, controllers, and the request execution pipeline.

## Philosophy

NextRush is built on three principles:

1. **Minimal Core**: The core is under 3,000 LOC. Everything else is modular.
2. **Dual Paradigm**: Support both functional and class-based patterns equally well.
3. **No Magic**: Every automatic behavior is documented and has an escape hatch.

This document explains the **class-based paradigm** with DI, decorators, and controllers.

---

## Package Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        User Application                              │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  @nextrush/controllers (Plugin)                                      │
│  - Reads decorator metadata                                          │
│  - Builds route handlers                                             │
│  - Registers with router                                             │
└─────────────────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ @nextrush/di │    │ @nextrush/   │    │ @nextrush/   │
│              │    │ decorators   │    │ errors       │
│ - Container  │    │              │    │              │
│ - @Service   │    │ - @Controller│    │ - HttpError  │
│ - @inject    │    │ - @Get/@Post │    │ - Guard-     │
│              │    │ - @Body      │    │   Rejection  │
│              │    │ - @UseGuard  │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
        │                    │
        └────────┬───────────┘
                 │
                 ▼
        ┌──────────────┐
        │ @nextrush/   │
        │ types        │
        │              │
        │ - Context    │
        │ - Middleware │
        │ - Plugin     │
        └──────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  @nextrush/core                                                      │
│  - Application class                                                 │
│  - Middleware composition                                            │
│  - Plugin system                                                     │
└─────────────────────────────────────────────────────────────────────┘
        │                                         │
        ▼                                         ▼
┌──────────────────┐                    ┌──────────────────┐
│ @nextrush/router │                    │ @nextrush/       │
│                  │                    │ adapter-node     │
│ - Radix tree     │                    │ (or bun/deno/    │
│ - O(k) matching  │                    │  edge)           │
│ - Parameters     │                    │                  │
└──────────────────┘                    └──────────────────┘
```

---

## How Decorators Work

Decorators in NextRush are **metadata annotations**, not code transformations. They store information that the controllers plugin reads at startup.

### @Controller

```typescript
@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}
}
```

**What happens:**

1. `@Controller` is called with path `'/users'`
2. It stores metadata on the class: `Reflect.defineMetadata(CONTROLLER_KEY, { path: '/users' }, UserController)`
3. It calls `@injectable()` from tsyringe to register the class with DI
4. **Nothing else happens at decoration time**

### @Get / @Post / etc.

```typescript
@Get('/:id')
findOne(@Param('id') id: string) { }
```

**What happens:**

1. `@Get('/:id')` stores route metadata: `{ method: 'GET', path: '/:id', methodName: 'findOne' }`
2. Metadata is stored on the class's `ROUTES_KEY` array
3. **The method itself is unchanged**

### @Body / @Param / @Query

```typescript
findOne(@Param('id', { transform: Number }) id: number) { }
```

**What happens:**

1. `@Param('id', { transform: Number })` stores: `{ source: 'param', name: 'id', index: 0, transform: Number }`
2. Metadata is stored on `PARAMS_KEY` keyed by method name
3. **The parameter is not modified at decoration time**

### @UseGuard

```typescript
@UseGuard(AuthGuard)
@Controller('/users')
class UserController { }
```

**What happens:**

1. `@UseGuard(AuthGuard)` stores: `{ guards: [AuthGuard], target: 'class' }`
2. Can be applied to class (all routes) or method (single route)
3. **Guards are not executed at decoration time**

---

## How DI Works

NextRush wraps [tsyringe](https://github.com/microsoft/tsyringe) with enhanced error messages.

### Registration

```typescript
@Service()
class UserService { }

@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}
}
```

**What happens:**

1. `@Service()` calls `@injectable()` + `@singleton()` from tsyringe
2. Class is registered in the global container
3. Constructor parameter types are read via `reflect-metadata`

### Resolution

```typescript
const controller = container.resolve(UserController);
```

**What happens:**

1. Container looks up `UserController`
2. Reads constructor parameters via `Reflect.getMetadata('design:paramtypes', UserController)`
3. For each parameter type, recursively resolves it
4. Creates instance with resolved dependencies
5. Caches instance (singleton by default)

### Why `emitDecoratorMetadata` is Required

TypeScript's `emitDecoratorMetadata` option emits:

```typescript
Reflect.metadata('design:paramtypes', [UserService])
```

This tells the DI container what types to inject. Without it, the container sees `undefined` and throws `TypeInfo not known`.

**This is why `@nextrush/dev` exists**: it uses SWC which properly emits this metadata, while `tsx` and `node --experimental-strip-types` do not.

---

## How Controllers Plugin Works

The `controllersPlugin` is the integration layer that connects everything.

### At Startup (Once)

```typescript
await app.pluginAsync(
  controllersPlugin({
    router,
    root: './src',   // Auto-discover controllers
    prefix: '/api',
    debug: true,
  })
);
```

**What happens:**

1. **Auto-discovery:**
   - Scan `root` directory for files matching `include` patterns
   - Import each file and check for `@Controller` decorated classes
   - Collect all discovered controllers

2. **For each controller class:**
   - Validate: Has `@Controller` decorator?
   - Validate: Has at least one route decorator?
   - Read controller metadata (path, version, middleware)
   - Read all route metadata (method, path, guards)

3. **For each route:**
   - Collect guards: class guards + method guards
   - Read parameter metadata
   - Build handler function (see next section)
   - Register with router: `router.get('/api/users/:id', handler)`

### Handler Building (Compile Time)

For each route, a handler function is created:

```typescript
// This is pseudo-code showing what the generated handler looks like
async function handler(ctx: Context) {
  // 1. Execute guards
  for (const guard of guards) {
    const result = isGuardClass(guard)
      ? await container.resolve(guard).canActivate(guardContext)
      : await guard(guardContext);

    if (!result) {
      throw new GuardRejectionError(guard.name);
    }
  }

  // 2. Resolve controller from DI
  const controller = container.resolve(UserController);

  // 3. Extract parameters
  const args = [];
  for (const param of paramMetadata) {
    let value = extractValue(ctx, param.source, param.name);
    if (param.transform) {
      value = await param.transform(value);  // Async transforms supported!
    }
    args[param.index] = value;
  }

  // 4. Call method
  const result = await controller.findOne(...args);

  // 5. Send response
  if (result !== undefined) {
    ctx.json(result);
  }
}
```

---

## Request Execution Flow

When a request comes in:

```
HTTP Request: GET /api/users/123
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Adapter (Node.js / Bun / Edge)                                      │
│  - Parses HTTP request                                               │
│  - Creates Context object                                            │
│  - Calls app.callback()                                              │
└─────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Application Middleware Stack                                        │
│  - Global middleware (cors, helmet, body-parser)                     │
│  - Each calls ctx.next() to continue                                 │
└─────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Router Middleware (router.routes())                                 │
│  - Matches path against radix tree: O(k)                             │
│  - Extracts route parameters: { id: '123' }                          │
│  - Sets ctx.params                                                   │
│  - Calls matched handler                                             │
└─────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Route Handler (built by controllers plugin)                         │
│                                                                      │
│  1. Execute guards (class → method order)                            │
│     ├─ Function guard: await guard(guardContext)                     │
│     └─ Class guard: await container.resolve(Guard).canActivate(ctx)  │
│                                                                      │
│  2. Resolve controller from DI container                             │
│     └─ Singleton: cached after first resolution                      │
│                                                                      │
│  3. Extract parameters with transforms                               │
│     ├─ @Param('id') → ctx.params.id                                  │
│     ├─ @Body() → ctx.body                                            │
│     ├─ @Query('page') → ctx.query.page                               │
│     └─ transform: Number → Number(value)                             │
│                                                                      │
│  4. Call controller method                                           │
│     └─ const result = await controller.findOne(id);                  │
│                                                                      │
│  5. Serialize response                                               │
│     └─ ctx.json(result)                                              │
└─────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Middleware Stack Unwinding                                          │
│  - Each middleware's "after" code runs in reverse order              │
│  - Logging, timing, response modification                            │
└─────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Adapter                                                             │
│  - Serializes response                                               │
│  - Sends HTTP response                                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Guard System Deep Dive

Guards protect routes. They run before the handler and can reject requests.

### Guard Types

```typescript
// Function guard (simple)
const AuthGuard: GuardFn = async (ctx) => {
  return Boolean(ctx.get('authorization'));
};

// Class guard (with DI)
@Service()
class RoleGuard implements CanActivate {
  constructor(private roleService: RoleService) {}

  async canActivate(ctx: GuardContext): Promise<boolean> {
    const user = ctx.state.user;
    return this.roleService.hasRole(user, 'admin');
  }
}
```

### Guard Resolution

The controllers plugin detects guard type using `isGuardClass()`:

```typescript
function isGuardClass(guard: Guard): guard is Constructor<CanActivate> {
  if (typeof guard !== 'function') return false;
  return typeof guard.prototype?.canActivate === 'function';
}
```

- **Function guards**: Called directly with `GuardContext`
- **Class guards**: Resolved from DI, then `canActivate()` called

### GuardContext vs Context

Guards receive `GuardContext`, not full `Context`:

```typescript
interface GuardContext {
  readonly method: string;
  readonly path: string;
  readonly params: Record<string, string>;
  readonly query: Record<string, string | string[] | undefined>;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body: unknown;
  readonly state: Record<string, unknown>;  // Mutable!
  get(name: string): string | undefined;
}
```

**Why not full Context?**

Guards should not:
- Send responses (`ctx.json()`, `ctx.send()`)
- Set status codes
- Set response headers

They should only:
- Check conditions
- Attach data to `ctx.state` for downstream handlers

---

## Parameter Transform Pipeline

Transforms can be sync or async, enabling validation library integration:

```typescript
@Post()
create(@Body({ transform: UserSchema.parseAsync }) data: User) { }
```

**Execution:**

1. Extract raw value: `ctx.body`
2. Check if transform exists
3. If async: `await UserSchema.parseAsync(ctx.body)`
4. If sync: `Number(ctx.params.id)`
5. Assign to parameter position

**Error handling:**

If transform throws (e.g., Zod validation fails), it becomes:
```typescript
throw new ParameterInjectionError(
  'UserController',
  'create',
  0,
  'Validation failed: ...'
);
```

This results in HTTP 400 Bad Request.

---

## Error Hierarchy

```
Error
└── NextRushError (base for all framework errors)
    └── HttpError (has status code)
        ├── BadRequestError (400)
        │   ├── MissingParameterError
        │   └── ParameterInjectionError
        ├── ForbiddenError (403)
        │   └── GuardRejectionError
        ├── NotFoundError (404)
        └── InternalServerError (500)
            ├── ControllerResolutionError
            ├── NotAControllerError
            └── NoRoutesError
```

**Design principle:**
- 4xx errors: Client's fault (missing params, failed validation, access denied)
- 5xx errors: Server's fault (misconfiguration, DI failure)

---

## Runtime Compatibility

### Development

`@nextrush/dev` uses SWC for TypeScript execution with decorator metadata:

```bash
node --watch --import @swc-node/register/esm-register ./src/index.ts
```

This properly emits `design:paramtypes` metadata required for DI.

### Production

Compile with `tsc`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

Run compiled JavaScript:

```bash
node dist/index.js
```

### Supported Runtimes

| Runtime | Adapter | Status |
|---------|---------|--------|
| Node.js 20+ | `@nextrush/adapter-node` | ✅ Full support |
| Bun 1.0+ | `@nextrush/adapter-bun` | ✅ Full support |
| Deno 2.0+ | `@nextrush/adapter-deno` | ✅ Full support |
| Cloudflare Workers | `@nextrush/adapter-edge` | ✅ Full support |
| Vercel Edge | `@nextrush/adapter-edge` | ✅ Full support |

---

## Performance Characteristics

### Route Matching: O(k)

Radix tree lookup is O(k) where k is path length:
- 10 routes: ~0.02ms
- 1,000 routes: ~0.02ms
- 10,000 routes: ~0.02ms

Route count doesn't affect lookup time.

### Controller Resolution: O(1) after first request

- First request: DI builds dependency graph, creates singletons
- Subsequent requests: Cached instances returned

### Guard Execution: O(g)

Where g is number of guards. Each guard is O(1) assuming simple checks.

### Parameter Extraction: O(p)

Where p is number of parameters. Each extraction is O(1).

---

## Key Design Decisions

### Why Decorators Over Functions?

Both are supported. Decorators provide:
- Clear visual structure for large APIs
- DI integration for testability
- Familiar NestJS-like patterns

Functions provide:
- Zero ceremony for simple routes
- No tsconfig requirements
- Faster cold start (no metadata processing)

### Why tsyringe?

- Microsoft-maintained
- TypeScript-first
- Minimal runtime (no proxies)
- Proven in production (Azure)

### Why Guards Over Middleware?

Guards are route-specific and declarative:

```typescript
@UseGuard(AuthGuard)  // Clear: this route needs auth
@Get('/profile')
getProfile() { }
```

Middleware is global and imperative:

```typescript
app.use(authMiddleware);  // Unclear: which routes are protected?
```

Both have their place. Use guards for route-level protection, middleware for cross-cutting concerns (logging, CORS).

---

## Summary

1. **Decorators** store metadata, nothing more
2. **DI** resolves dependencies via constructor type reflection
3. **Controllers plugin** reads metadata and builds handlers at startup
4. **Handlers** execute guards → resolve controller → extract params → call method → send response
5. **Runtime** requires `emitDecoratorMetadata` for DI to work
6. **Adapters** convert platform-specific requests to NextRush Context

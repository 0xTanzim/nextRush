# @nextrush/controllers

> Connect decorators, dependency injection, and routing into automatic controller registration with guards and parameter extraction.

## The Problem

Decorator-based controllers don't wire themselves. Without a connection layer:

- You write boilerplate to register each route from decorated methods
- Guards need manual execution before each handler
- Parameter extraction logic is duplicated across handlers
- DI resolution happens ad-hoc with no error handling

## How NextRush Approaches This

`@nextrush/controllers` is the **integration layer** that reads decorator metadata and builds optimized route handlers:

1. **Discovery**: Find controller classes (manual or auto-discovery)
2. **Metadata Reading**: Extract `@Controller`, `@Get`/`@Post`, `@Body`/`@Param` metadata
3. **Guard Chain Building**: Collect class and method guards in execution order
4. **Handler Building**: Create route handlers with parameter injection
5. **Route Registration**: Register handlers with the router

This happens once at startup. At runtime, handlers are pre-built and optimized.

## Mental Model

Think of this plugin as a **compiler for controllers**:

```
@Controller + @Get + @Body + @UseGuard
              ↓
    [controllersPlugin reads metadata]
              ↓
    Built route handler:
      1. Execute guards (class → method order)
      2. Resolve controller from DI
      3. Extract & transform parameters
      4. Call controller method
      5. Send response
```

## Installation

```bash
pnpm add @nextrush/controllers @nextrush/di @nextrush/decorators reflect-metadata
```

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
import 'reflect-metadata';
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { listen } from '@nextrush/adapter-node';
import { controllersPlugin } from '@nextrush/controllers';
import { Controller, Get, Post, Body, Param, UseGuard } from '@nextrush/decorators';
import { Service } from '@nextrush/di';
import type { GuardFn } from '@nextrush/decorators';

// Service with DI
@Service()
class UserService {
  findAll() { return [{ id: 1, name: 'Alice' }]; }
  findOne(id: string) { return { id, name: 'Alice' }; }
  create(data: { name: string }) { return { id: Date.now(), ...data }; }
}

// Guard
const AuthGuard: GuardFn = (ctx) => Boolean(ctx.get('authorization'));

// Controller
@UseGuard(AuthGuard)
@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}

  @Get()
  findAll() { return this.userService.findAll(); }

  @Get('/:id')
  findOne(@Param('id') id: string) { return this.userService.findOne(id); }

  @Post()
  create(@Body() data: { name: string }) { return this.userService.create(data); }
}

// Bootstrap
async function main() {
  const app = createApp();
  const router = createRouter();

  app.plugin(controllersPlugin({
    router,
    controllers: [UserController],
    prefix: '/api',
  }));

  app.use(router.routes());
  listen(app, { port: 3000 });
}

main();
```

## Handler Building Pipeline

When you call `controllersPlugin()`, this is what happens for each controller:

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
  // 1. Execute guards (in order)
  for (const guard of guards) {
    if (isGuardClass(guard)) {
      const instance = container.resolve(guard);
      if (!await instance.canActivate(guardContext)) {
        throw new GuardRejectionError(guard.name);
      }
    } else {
      if (!await guard(guardContext)) {
        throw new GuardRejectionError('Guard');
      }
    }
  }

  // 2. Resolve controller from DI
  const controller = container.resolve(UserController);

  // 3. Extract parameters (with async transform support)
  const args = await resolveParameters(ctx, paramMetadata);

  // 4. Call method
  const result = await controller.findOne(...args);

  // 5. Send response (if not already sent)
  if (result !== undefined) {
    ctx.json(result);
  }
}
```

### 4. Register Routes

```typescript
// Routes are registered with the router:
router.get('/api/users', handler1);
router.get('/api/users/:id', handler2);
router.post('/api/users', handler3);
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

The plugin detects guard type using `isGuardClass()`:
- **Function guards**: Called directly with `GuardContext`
- **Class guards**: Resolved from DI container, then `canActivate()` called

### Guard Rejection

When a guard returns `false` or throws:

```typescript
// Results in:
throw new GuardRejectionError('AuthGuard', 'Access denied by guard');

// HTTP Response:
// Status: 403 Forbidden
// Body: { "error": "GuardRejectionError", "message": "Access denied", "code": "GUARD_REJECTED" }
```

## Parameter Extraction

Parameters are extracted from the request based on decorator metadata:

### Extraction Sources

| Decorator | Source | Example |
|-----------|--------|---------|
| `@Body()` | `ctx.body` | Full request body |
| `@Body('name')` | `ctx.body.name` | Specific body property |
| `@Param()` | `ctx.params` | All route parameters |
| `@Param('id')` | `ctx.params.id` | Specific route parameter |
| `@Query()` | `ctx.query` | All query parameters |
| `@Query('page')` | `ctx.query.page` | Specific query parameter |
| `@Header('auth')` | `ctx.get('auth')` | Specific header |
| `@Ctx()` | `ctx` | Full context object |

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
  async create(
    @Body({ transform: UserSchema.parseAsync }) data: z.infer<typeof UserSchema>
  ) {
    // data is validated and typed
    return this.userService.create(data);
  }
}
```

### Missing Parameters

Required parameters throw `MissingParameterError` (400):

```typescript
// If @Body('email') is required but not provided:
throw new MissingParameterError(
  'UserController',
  'create',
  'email',
  'body'
);

// HTTP Response:
// Status: 400 Bad Request
// Body: { "message": "Required body parameter \"email\" is missing", "code": "MISSING_PARAMETER" }
```

## Plugin Options

```typescript
interface ControllersPluginOptions {
  // Required: Router instance for route registration
  router: Router;

  // Manual controller registration
  controllers?: Function[];

  // Auto-discovery options
  root?: string;              // Directory to scan (default: './src')
  include?: string[];         // Glob patterns (default: ['**/*.ts', '**/*.js'])
  exclude?: string[];         // Exclude patterns (default: tests, node_modules)

  // Route configuration
  prefix?: string;            // Global route prefix (e.g., '/api')
  middleware?: Middleware[];  // Global middleware for all routes

  // DI container (uses global container by default)
  container?: ContainerInterface;

  // Debugging
  debug?: boolean;            // Log discovered routes
  strict?: boolean;           // Throw on discovery errors
}
```

### Manual Registration

```typescript
app.plugin(controllersPlugin({
  router,
  controllers: [UserController, ProductController],
  prefix: '/api',
}));
```

### Auto-Discovery

```typescript
await app.pluginAsync(controllersPlugin({
  router,
  root: './src',
  include: ['**/*.controller.ts'],
  exclude: ['**/*.test.ts', '**/__tests__/**'],
  prefix: '/api',
  debug: true,
}));
```

## Error Hierarchy

All errors extend `HttpError` from `@nextrush/errors` with proper status codes:

### Server Errors (5xx)

| Error | Code | Description |
|-------|------|-------------|
| `NotAControllerError` | 500 | Class missing `@Controller` |
| `NoRoutesError` | 500 | Controller has no route decorators |
| `ControllerResolutionError` | 500 | DI failed to resolve controller |
| `RouteRegistrationError` | 500 | Route registration failed |
| `DiscoveryError` | 500 | File discovery failed |

### Client Errors (4xx)

| Error | Code | Description |
|-------|------|-------------|
| `MissingParameterError` | 400 | Required parameter not provided |
| `ParameterInjectionError` | 400 | Parameter transform/validation failed |
| `GuardRejectionError` | 403 | Guard returned false |

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

Use `@nextrush/dev` for development (decorator metadata support):

```bash
pnpm add -D @nextrush/dev
```

```json
{
  "scripts": {
    "dev": "nextrush-dev"
  }
}
```

## API Reference

### Exports

```typescript
// Plugin
export { controllersPlugin } from './plugin';

// Types
export type { ControllersPluginOptions, BuiltRoute } from './types';

// Errors
export {
  ControllerError,
  NotAControllerError,
  NoRoutesError,
  DiscoveryError,
  ControllerResolutionError,
  ParameterInjectionError,
  MissingParameterError,
  RouteRegistrationError,
  GuardRejectionError,
} from './errors';

// Re-exports from @nextrush/decorators (convenience)
export {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, Header, Ctx,
  UseGuard,
} from '@nextrush/decorators';

// Re-exports from @nextrush/di (convenience)
export { Service, Repository, container } from '@nextrush/di';
```

## Common Mistakes

### Mistake 1: Forgetting reflect-metadata

```typescript
// ❌ Wrong - DI won't work
import { Controller } from '@nextrush/decorators';

// ✅ Correct - must be first import
import 'reflect-metadata';
import { Controller } from '@nextrush/decorators';
```

### Mistake 2: Not awaiting pluginAsync for auto-discovery

```typescript
// ❌ Wrong - routes won't be registered
app.plugin(controllersPlugin({ router, root: './src' }));
app.use(router.routes());
listen(app);

// ✅ Correct - wait for discovery
await app.pluginAsync(controllersPlugin({ router, root: './src' }));
app.use(router.routes());
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
  @Get()  // ← Required!
  findAll() { }
}
```

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

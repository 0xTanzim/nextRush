# @nextrush/decorators

> Decorator-based metadata for building HTTP controllers with guards, dependency injection, and type-safe parameter extraction.

## The Problem

Building structured APIs in Node.js often leads to scattered route definitions, manual parameter parsing, and inconsistent authentication checks. Without a declarative system:

- Route handlers mix business logic with request parsing
- Authentication checks are copy-pasted across handlers
- Parameter validation is ad-hoc and error-prone
- Testing requires mocking the entire HTTP layer

## How NextRush Approaches This

NextRush decorators provide **declarative contracts** for HTTP controllers:

- **`@Controller`** defines the class as an HTTP boundary with DI integration
- **Route decorators** (`@Get`, `@Post`, etc.) declare endpoint paths and methods
- **Parameter decorators** (`@Body`, `@Param`, `@Query`) extract and transform request data
- **`@UseGuard`** protects routes with authentication/authorization checks

Decorators are **runtime metadata**, not build-time transformations. They store information that `@nextrush/controllers` reads to build optimized route handlers.

## Mental Model

Think of decorators as **annotations that declare intent**:

```
@Controller('/users')        ← "This class handles /users/* routes"
  └── constructor(UserService) ← "Inject UserService dependency"
  └── @UseGuard(AuthGuard)    ← "Require authentication for all routes"
  └── @Get('/:id')            ← "GET /users/:id calls this method"
      └── @Param('id')        ← "Extract 'id' from route params"
```

The `@nextrush/controllers` plugin reads this metadata and builds:
1. Route registrations with the router
2. Handler functions that extract parameters
3. Guard chains that run before handlers
4. DI resolution for controller instances

## Installation

```bash
pnpm add @nextrush/decorators reflect-metadata
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

## Development Runtime

TypeScript decorators require `emitDecoratorMetadata` to emit runtime type information. Most modern runners (`tsx`, `node --experimental-strip-types`) strip types without emitting metadata.

**Use `@nextrush/dev` for development:**

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

| Runtime | Decorator Metadata | Recommended |
|---------|-------------------|-------------|
| **nextrush-dev** | ✅ Full Support | ✅ Development |
| **tsc + node** | ✅ Full Support | ✅ Production |
| **tsx / esbuild** | ❌ Not Supported | ❌ No |

## Quick Start

```typescript
import 'reflect-metadata';
import { Controller, Get, Post, Body, Param, UseGuard } from '@nextrush/decorators';
import type { GuardFn } from '@nextrush/decorators';

// Function-based guard
const AuthGuard: GuardFn = async (ctx) => {
  return Boolean(ctx.get('authorization'));
};

@UseGuard(AuthGuard)
@Controller('/users')
class UserController {
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
  create(@Body() data: { name: string; email: string }) {
    return this.userService.create(data);
  }
}
```

## Guard System

Guards determine if a request should proceed to the handler. They run **before** the route handler and can reject requests.

### Function-Based Guards

Simple functions that receive `GuardContext` and return boolean:

```typescript
import type { GuardFn, GuardContext } from '@nextrush/decorators';

const AuthGuard: GuardFn = async (ctx) => {
  const token = ctx.get('authorization');
  if (!token) return false;

  const user = await verifyToken(token);
  ctx.state.user = user;
  return Boolean(user);
};

// Guard factory for dynamic configuration
const RoleGuard = (roles: string[]): GuardFn => async (ctx) => {
  const user = ctx.state.user as { role: string } | undefined;
  return user ? roles.includes(user.role) : false;
};
```

### Class-Based Guards (with DI)

Implement `CanActivate` interface for guards that need dependency injection:

```typescript
import { Service } from '@nextrush/di';
import type { CanActivate, GuardContext } from '@nextrush/decorators';

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

### Applying Guards

```typescript
// Controller-level (applies to all routes)
@UseGuard(AuthGuard)
@Controller('/admin')
class AdminController {
  @Get()
  dashboard() { }  // Protected by AuthGuard
}

// Method-level (applies to specific route)
@Controller('/users')
class UserController {
  @Get()
  findAll() { }  // Public

  @UseGuard(AdminGuard)
  @Delete('/:id')
  remove(@Param('id') id: string) { }  // Admin only
}

// Multiple guards (all must pass)
@UseGuard(AuthGuard)
@UseGuard(RoleGuard(['admin']))
@Controller('/admin')
class AdminController { }
```

### Guard Execution Order

Guards execute in declaration order: class guards first, then method guards.

```typescript
@UseGuard(ClassGuard1)    // Runs 1st
@UseGuard(ClassGuard2)    // Runs 2nd
@Controller('/example')
class ExampleController {
  @UseGuard(MethodGuard1) // Runs 3rd
  @UseGuard(MethodGuard2) // Runs 4th
  @Get()
  handler() {}
}
```

### GuardContext

Guards receive a minimal context (not the full `Context`) to prevent response manipulation:

```typescript
interface GuardContext {
  readonly method: string;
  readonly path: string;
  readonly params: Record<string, string>;
  readonly query: Record<string, string | string[] | undefined>;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body: unknown;
  readonly state: Record<string, unknown>;
  get(name: string): string | undefined;
}
```

## Controller Decorator

### `@Controller(path?)`

Marks a class as an HTTP controller **with automatic DI registration**.

```typescript
// With explicit path
@Controller('/users')
class UserController {}

// Auto-derived path (removes 'Controller' suffix, converts to kebab-case)
@Controller()
class UserProfileController {} // → '/user-profile'

// With options
@Controller({ path: '/users', version: 'v1', tags: ['users'] })
class UserController {}
```

**You do NOT need `@Service()` when using `@Controller()`!**

```typescript
// ✅ Correct
@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}  // Auto-injected
}

// ❌ Redundant
@Controller('/users')
@Service()  // NOT NEEDED
class UserController {}
```

## Route Decorators

```typescript
@Controller('/users')
class UserController {
  @Get()           // GET /users
  findAll() {}

  @Get('/:id')     // GET /users/:id
  findOne() {}

  @Post()          // POST /users
  create() {}

  @Put('/:id')     // PUT /users/:id
  replace() {}

  @Patch('/:id')   // PATCH /users/:id
  update() {}

  @Delete('/:id')  // DELETE /users/:id
  remove() {}

  @All('/webhook') // All methods
  webhook() {}
}
```

### Route Options

```typescript
@Get('/search', {
  statusCode: 200,
  description: 'Search users',
  deprecated: false,
})
search() {}
```

## Parameter Decorators

### `@Body(property?, options?)`

```typescript
// Full body
@Post()
create(@Body() data: CreateUserDto) {}

// Specific property
@Post()
create(@Body('name') name: string) {}

// With sync transform
@Post()
create(@Body({ transform: JSON.parse }) data: object) {}

// With async transform (e.g., Zod validation)
@Post()
create(@Body({ transform: UserSchema.parseAsync }) data: User) {}
```

### `@Param(name?, options?)`

```typescript
// All params
@Get('/:id/:action')
handle(@Param() params: { id: string; action: string }) {}

// Specific param
@Get('/:id')
findOne(@Param('id') id: string) {}

// With transform
@Get('/:id')
findOne(@Param('id', { transform: Number }) id: number) {}
```

### `@Query(name?, options?)`

```typescript
// All query params
@Get()
search(@Query() query: Record<string, string>) {}

// Specific param with default
@Get()
paginate(
  @Query('page', { defaultValue: 1, transform: Number }) page: number,
  @Query('limit', { defaultValue: 10, transform: Number }) limit: number
) {}
```

### `@Header(name?, options?)`

```typescript
@Get()
handle(
  @Header('authorization') auth: string,
  @Header('x-request-id') requestId?: string
) {}
```

### `@Ctx()`

Inject the full NextRush Context when you need response methods:

```typescript
@Get('/:id')
findOne(@Ctx() ctx: Context) {
  const user = this.userService.findOne(ctx.params.id);
  if (!user) {
    ctx.status = 404;
    ctx.json({ error: 'User not found' });
    return;
  }
  ctx.json(user);
}
```

### Transform Functions

Transforms can be sync or async, enabling integration with validation libraries:

```typescript
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

@Controller('/users')
class UserController {
  @Post()
  async create(
    @Body({ transform: CreateUserSchema.parseAsync }) data: z.infer<typeof CreateUserSchema>
  ) {
    // data is validated and typed
    return this.userService.create(data);
  }
}
```

## Metadata Readers

Read decorator metadata programmatically (used internally by `@nextrush/controllers`):

```typescript
import {
  isController,
  getControllerMetadata,
  getRouteMetadata,
  getParamMetadata,
  getAllGuards,
  isGuardClass,
} from '@nextrush/decorators';

// Check if class is a controller
isController(UserController); // true

// Get controller path
getControllerMetadata(UserController);
// { path: '/users', version: undefined, ... }

// Get all routes
getRouteMetadata(UserController);
// [{ method: 'GET', path: '/', ... }, ...]

// Get all guards for a route
getAllGuards(UserController, 'findOne');
// [AuthGuard, RoleGuard]

// Check guard type
isGuardClass(AuthGuard); // true for class, false for function
```

## API Reference

### Types

```typescript
// Guard types
type GuardFn = (ctx: GuardContext) => boolean | Promise<boolean>;

interface CanActivate {
  canActivate(ctx: GuardContext): boolean | Promise<boolean>;
}

type Guard = GuardFn | Constructor<CanActivate>;

// Transform type (sync or async)
type TransformFn<TInput = unknown, TOutput = unknown> =
  | ((value: TInput) => TOutput)
  | ((value: TInput) => Promise<TOutput>);

// Metadata types
interface ControllerMetadata {
  path: string;
  version?: string;
  middleware?: MiddlewareRef[];
  tags?: string[];
}

interface RouteMetadata {
  method: RouteMethods;
  path: string;
  methodName: string | symbol;
  propertyKey: string | symbol;
  middleware?: MiddlewareRef[];
  statusCode?: number;
  description?: string;
  deprecated?: boolean;
}

interface ParamMetadata {
  source: ParamSource;
  index: number;
  name?: string;
  required?: boolean;
  defaultValue?: unknown;
  transform?: TransformFn;
}

type RouteMethods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
type ParamSource = 'body' | 'query' | 'param' | 'header' | 'ctx' | 'req' | 'res';
```

### Exports

```typescript
// Decorators
export { Controller, Get, Post, Put, Patch, Delete, Head, Options, All };
export { Body, Param, Query, Header, Ctx, Req, Res };
export { UseGuard };

// Types
export type { GuardFn, GuardContext, CanActivate, Guard, Constructor };
export type { ControllerMetadata, RouteMetadata, ParamMetadata, TransformFn };

// Metadata readers
export { isController, getControllerMetadata, getRouteMetadata, getParamMetadata };
export { getAllGuards, getClassGuards, getMethodGuards, isGuardClass };

// Type guards
export { isValidHttpMethod, isValidParamSource };
```

## Common Mistakes

### Mistake 1: Using @Service with @Controller

```typescript
// ❌ Wrong - redundant
@Controller('/users')
@Service()
class UserController {}

// ✅ Correct - @Controller includes DI
@Controller('/users')
class UserController {}
```

### Mistake 2: Running with tsx

```typescript
// ❌ Won't work - no decorator metadata
npx tsx src/index.ts

// ✅ Works - full decorator support
npx nextrush-dev
```

### Mistake 3: Forgetting reflect-metadata

```typescript
// ❌ Wrong - decorators won't work
import { Controller } from '@nextrush/decorators';

// ✅ Correct - must be first import
import 'reflect-metadata';
import { Controller } from '@nextrush/decorators';
```

### Mistake 4: Guards modifying response

```typescript
// ❌ Wrong - guards shouldn't send responses
const BadGuard: GuardFn = (ctx) => {
  ctx.json({ error: 'Not allowed' }); // GuardContext has no json()!
  return false;
};

// ✅ Correct - just return false, let error handler respond
const GoodGuard: GuardFn = (ctx) => {
  return Boolean(ctx.get('authorization'));
};
```

## License

MIT

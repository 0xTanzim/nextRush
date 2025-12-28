# @nextrush/decorators

Decorator-based metadata for building HTTP controllers in NextRush. This package provides `@Controller`, route decorators (`@Get`, `@Post`, etc.), and parameter decorators (`@Body`, `@Param`, `@Query`, etc.).

## Features

- 🎮 **@Controller** - Marks class as HTTP controller **with automatic DI registration**
- 🛤️ **Route Decorators** - `@Get`, `@Post`, `@Put`, `@Delete`, `@Patch`
- 📦 **Parameter Decorators** - `@Body`, `@Param`, `@Query`, `@Header`, `@Ctx`
- 🔄 **Auto DI** - `@Controller` automatically makes the class injectable

## 🚀 Development

For the best development experience with full decorator and DI support, we highly recommend using **`@nextrush/dev`**.

```bash
pnpm add -D @nextrush/dev
```

Then in your `package.json`:

```json
{
  "scripts": {
    "dev": "nextrush-dev"
  }
}
```

### Why nextrush-dev?

TypeScript decorators with constructor injection require **`emitDecoratorMetadata`** to work. Most modern fast runners (like `tsx` or `node --experimental-strip-types`) strip types but **do not** emit this metadata, causing DI to fail.

| Runtime | Decorator Metadata | Recommended |
|---------|-------------------|-------------|
| **nextrush-dev** | ✅ Full Support | **✅ Highly Recommended** |
| **tsc + node** | ✅ Full Support | ✅ Yes (Production) |
| **tsx / esbuild** | ❌ Not Supported | ❌ No |
| **ts-node --esm** | ⚠️ Issues | ❌ No |

## Installation

```bash
pnpm add @nextrush/decorators reflect-metadata
```

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

> **Note:** Stage 3 decorators don't support parameter decorators. We use legacy decorators for full feature support.

## Quick Start

```typescript
import 'reflect-metadata';
import { Controller, Get, Post, Delete, Body, Param, Query } from '@nextrush/decorators';

// @Controller includes DI registration - no need for @Service()!
@Controller('/users')
class UserController {
  // Dependencies are automatically injected
  constructor(private userService: UserService) {}

  @Get()
  findAll(@Query('page') page: string, @Query('limit') limit: string) {
    return { page, limit };
  }

  @Get('/:id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Post()
  create(@Body() data: CreateUserDto) {
    return this.userService.create(data);
  }

  @Delete('/:id')
  remove(@Param('id') id: string) {
    return { deleted: id };
  }
}
```

## Controller Decorator

### `@Controller(path?)`

Marks a class as an HTTP controller **and registers it for dependency injection**.

**You do NOT need `@Service()` when using `@Controller()`!**

```typescript
// ✅ Correct - @Controller includes DI
@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}  // Auto-injected!
}

// ❌ Redundant - Don't use both!
@Controller('/users')
@Service()  // NOT NEEDED!
class UserController {}
```

### Controller Options

```typescript
// With explicit path
@Controller('/users')
class UserController {}

// With options
@Controller({ path: '/users', version: 'v1', tags: ['users'] })
class UserController {}

// Auto-derived path (removes 'Controller' suffix, converts to kebab-case)
@Controller()
class UserProfileController {} // → '/user-profile'
```

| Option | Type | Description |
|--------|------|-------------|
| `path` | `string` | Base path prefix |
| `version` | `string` | API version (e.g., 'v1' → '/v1/users') |
| `middleware` | `MiddlewareRef[]` | Controller-level middleware |
| `tags` | `string[]` | Documentation tags |

## Route Decorators

### `@Get(path?, options?)`

```typescript
@Controller('/users')
class UserController {
  @Get()           // GET /users
  findAll() {}

  @Get('/:id')     // GET /users/:id
  findOne() {}

  @Get('/search', { description: 'Search users' })
  search() {}
}
```

### All HTTP Methods

| Decorator | HTTP Method |
|-----------|-------------|
| `@Get()` | GET |
| `@Post()` | POST |
| `@Put()` | PUT |
| `@Delete()` | DELETE |
| `@Patch()` | PATCH |
| `@Head()` | HEAD |
| `@Options()` | OPTIONS |
| `@All()` | All methods |

### Route Options

| Option | Type | Description |
|--------|------|-------------|
| `middleware` | `MiddlewareRef[]` | Route-specific middleware |
| `statusCode` | `number` | Response status code |
| `description` | `string` | Route description |
| `deprecated` | `boolean` | Mark as deprecated |

## Parameter Decorators

### `@Body(property?, options?)`

```typescript
// Entire body
@Post()
create(@Body() data: CreateUserDto) {}

// Specific property
@Post()
updateEmail(@Body('email') email: string) {}

// With transform
@Post()
create(@Body({ transform: validateUser }) data: CreateUserDto) {}
```

### `@Param(name?, options?)`

```typescript
// All params
@Get('/:id/:action')
handle(@Param() params: { id: string; action: string }) {}

// Specific param
@Get('/:id')
findOne(@Param('id') id: string) {}

// With transform to number
@Get('/:id')
findOne(@Param('id', { transform: Number }) id: number) {}
```

### `@Query(name?, options?)`

```typescript
// All query params
@Get()
findAll(@Query() query: Record<string, string>) {}

// Specific query param
@Get()
findAll(@Query('page') page: string) {}

// With default value and transform
@Get()
findAll(
  @Query('limit', { defaultValue: 10, transform: Number }) limit: number
) {}
```

### `@Header(name?, options?)`

```typescript
// Specific header
@Get()
handle(@Header('authorization') auth: string) {}

// All headers
@Get()
handle(@Header() headers: Record<string, string>) {}
```

### `@Ctx()`

Injects the full NextRush Context object.

```typescript
@Get('/:id')
findOne(@Ctx() ctx: Context) {
  const id = ctx.params.id;
  ctx.json({ id });
}
```

### `@Req()` / `@Res()`

Injects raw request/response objects (adapter-specific).

```typescript
@Post('/upload')
upload(@Req() req: IncomingMessage) {}

@Get('/download')
download(@Res() res: ServerResponse) {}
```

## Metadata Readers

Utility functions to read decorator metadata (used internally by `@nextrush/controllers`).

```typescript
import {
  isController,
  getControllerMetadata,
  getRouteMetadata,
  getParamMetadata,
  getControllerDefinition,
  buildFullPath,
} from '@nextrush/decorators';

// Check if class is a controller
isController(UserController); // true

// Get controller metadata
getControllerMetadata(UserController);
// { path: '/users', version: undefined, ... }

// Get all routes
getRouteMetadata(UserController);
// [{ method: 'GET', path: '/', ... }, ...]

// Get params for a method
getParamMetadata(UserController, 'findOne');
// [{ source: 'param', index: 0, name: 'id' }]
```

## API Reference

### Types

```typescript
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

## License

MIT

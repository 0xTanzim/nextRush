# @nextrush/decorators

Decorator-based metadata for building HTTP controllers in NextRush. This package provides `@Controller`, route decorators (`@Get`, `@Post`, etc.), and parameter decorators (`@Body`, `@Param`, `@Query`, etc.).

## Installation

```bash
pnpm add @nextrush/decorators reflect-metadata
```

**TypeScript Configuration:**

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

@Controller('/users')
class UserController {
  @Get()
  findAll(@Query('page') page: string, @Query('limit') limit: string) {
    return { page, limit };
  }

  @Get('/:id')
  findOne(@Param('id') id: string) {
    return { id };
  }

  @Post()
  create(@Body() data: CreateUserDto) {
    return data;
  }

  @Delete('/:id')
  remove(@Param('id') id: string) {
    return { deleted: id };
  }
}
```

## Controller Decorator

### `@Controller(path?)`

Marks a class as an HTTP controller.

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

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `path` | `string` | Base path prefix |
| `version` | `string` | API version (e.g., 'v1' → '/v1/users') |
| `middleware` | `MiddlewareRef[]` | Controller-level middleware |
| `tags` | `string[]` | Documentation tags |

## Route Decorators

### `@Get(path?, options?)`

Marks a method as handling HTTP GET requests.

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

### Other HTTP Methods

| Decorator | HTTP Method |
|-----------|-------------|
| `@Post()` | POST |
| `@Put()` | PUT |
| `@Delete()` | DELETE |
| `@Patch()` | PATCH |
| `@Head()` | HEAD |
| `@Options()` | OPTIONS |
| `@All()` | All methods |

**Route Options:**

| Option | Type | Description |
|--------|------|-------------|
| `middleware` | `MiddlewareRef[]` | Route-specific middleware |
| `statusCode` | `number` | Response status code |
| `description` | `string` | Route description |
| `deprecated` | `boolean` | Mark as deprecated |

## Parameter Decorators

### `@Body(property?, options?)`

Injects the request body.

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

Injects route parameters.

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

Injects query parameters.

```typescript
// All query params
@Get()
findAll(@Query() query: Record<string, string>) {}

// Specific query param
@Get()
findAll(@Query('page') page: string) {}

// With default value
@Get()
findAll(@Query('limit', { defaultValue: 10, transform: Number }) limit: number) {}
```

### `@Header(name?, options?)`

Injects request headers.

```typescript
// All headers
@Get()
handle(@Header() headers: Record<string, string>) {}

// Specific header
@Get()
handle(@Header('authorization') auth: string) {}
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

Utility functions to read decorator metadata (used by `@nextrush/controllers`).

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

// Get full definition
getControllerDefinition(UserController);
// { target, controller, routes, params }

// Build full route path
buildFullPath({ path: '/users', version: 'v1' }, { path: '/:id' });
// '/v1/users/:id'
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

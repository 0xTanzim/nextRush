# Controllers and Decorators

NextRush provides a full decorator-based controller system across three packages:

- **`@nextrush/decorators`** — `@Controller`, route decorators, param decorators, guards
- **`@nextrush/di`** — `@Service`, `@Repository`, container
- **`@nextrush/controllers`** — auto-discovery plugin that wires everything together

All three are re-exported from `@nextrush/controllers` for convenience.

---

## Setup

```bash
pnpm add @nextrush/di @nextrush/decorators @nextrush/controllers
```

`tsconfig.json` requirements:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

Always import `reflect-metadata` at the application entry point (before any other code):

```typescript
import 'reflect-metadata';
```

---

## `@Controller(path)`

Marks a class as an HTTP controller. The path becomes the base prefix for all routes in the class.

```typescript
import { Controller } from '@nextrush/decorators';

@Controller('/users')
class UserController {
  // routes defined here are prefixed with /users
}
```

---

## Route Decorators

| Decorator | HTTP Method |
|---|---|
| `@Get(path?)` | GET |
| `@Post(path?)` | POST |
| `@Put(path?)` | PUT |
| `@Patch(path?)` | PATCH |
| `@Delete(path?)` | DELETE |
| `@Head(path?)` | HEAD |
| `@Options(path?)` | OPTIONS |
| `@All(path?)` | All HTTP methods |

The `path` argument is optional and defaults to `'/'` (relative to the controller prefix).

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
}
```

### Route Options

```typescript
@Get('/', { statusCode: 200, deprecated: false, description: 'List all users' })
findAll() {}
```

### `@Redirect(url, status?)`

```typescript
@Redirect('/new-path', 301)
@Get('/old-path')
oldRoute() {}
```

### `@SetHeader(name, value)`

```typescript
@SetHeader('Cache-Control', 'no-store')
@Get()
sensitiveData() {}
```

---

## Parameter Decorators

| Decorator | Description |
|---|---|
| `@Body()` | Full parsed request body |
| `@Body('field')` | Specific field from body |
| `@Param()` | All route parameters as object |
| `@Param('name')` | Specific route parameter |
| `@Query()` | All query parameters as object |
| `@Query('name')` | Specific query parameter |
| `@Header()` | All request headers as object |
| `@Header('name')` | Specific header value |
| `@Ctx()` | Full `Context` object |
| `@Req()` | Raw request (escape hatch) |
| `@Res()` | Raw response (escape hatch) |

```typescript
@Controller('/users')
class UserController {
  @Get('/:id')
  findOne(
    @Param('id') id: string,
    @Query('include') include?: string
  ) {
    return { id, include };
  }

  @Post()
  create(@Body() body: { name: string; email: string }) {
    return body;
  }

  @Get()
  search(
    @Query() query: Record<string, string>,
    @Header('x-tenant') tenant: string
  ) {
    return { query, tenant };
  }

  @Get('/ctx')
  withContext(@Ctx() ctx: Context) {
    return { path: ctx.path };
  }
}
```

### Parameter Transforms

Apply a synchronous or asynchronous transform to convert the raw string value:

```typescript
@Get('/:id')
findOne(@Param('id', { transform: Number }) id: number) {
  return { id };  // id is already a number
}

@Post()
async create(@Body({ transform: myZodSchema.parseAsync }) body: MyType) {
  return body;  // body has been validated and typed by Zod
}
```

### Optional and Default Values

```typescript
@Get()
list(
  @Query('page', { required: false, defaultValue: '1' }) page: string,
  @Query('limit', { required: false, defaultValue: '20' }) limit: string,
) {}
```

---

## Guard System

Guards run before route handlers and control access by returning a boolean. They can be applied at the controller level (all routes) or method level (specific route).

### Function-Based Guard

```typescript
import type { GuardFn } from '@nextrush/decorators';

const AuthGuard: GuardFn = async (ctx) => {
  const token = ctx.get('authorization');
  if (!token) return false;       // reject
  ctx.state.user = verifyToken(token);
  return true;                    // allow
};
```

### Class-Based Guard (with DI)

```typescript
import { Service } from '@nextrush/di';
import type { CanActivate, GuardContext } from '@nextrush/decorators';

@Service()
class RoleGuard implements CanActivate {
  constructor(private roleService: RoleService) {}

  async canActivate(ctx: GuardContext): Promise<boolean> {
    return this.roleService.hasRole(ctx.state.user, 'admin');
  }
}
```

### Guard Factory

```typescript
const RequireRole = (role: string): GuardFn => async (ctx) =>
  ctx.state.user?.role === role;
```

### Applying Guards

```typescript
// Controller-level: applies to all routes
@UseGuard(AuthGuard)
@Controller('/users')
class UserController {
  @Get()
  findAll() {}        // protected by AuthGuard

  // Method-level: stacked with controller guard
  @UseGuard(RequireRole('admin'))
  @Delete('/:id')
  remove() {}         // protected by AuthGuard + RequireRole('admin')
}
```

Guards are executed in order: class guards first, then method guards. All guards must pass for the request to proceed.

### `GuardContext` Interface

Guards receive a lightweight context (no response methods):

```typescript
interface GuardContext {
  readonly method: string;
  readonly path: string;
  readonly params: Record<string, string>;
  readonly query: Record<string, string | string[] | undefined>;
  readonly body: unknown;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly state: Record<string, unknown>;
  get(name: string): string | undefined;
}
```

---

## Controllers Plugin

The `controllersPlugin` auto-discovers all `@Controller` classes in a directory and registers their routes.

### Auto-Discovery (Recommended)

```typescript
import 'reflect-metadata';
import { createApp, createRouter, listen } from 'nextrush';
import { controllersPlugin } from '@nextrush/controllers';

const app = createApp();
const router = createRouter();

app.plugin(controllersPlugin({
  router,
  root: './src',       // scan this directory recursively
  prefix: '/api/v1',   // optional global prefix
  debug: true,         // log discovered controllers to stderr
}));

app.route('/', router);
listen(app, 3000);
```

### Manual Registration

```typescript
app.plugin(controllersPlugin({
  router,
  controllers: [UserController, PostController, AuthController],
}));
```

### Plugin Options

| Option | Type | Description |
|---|---|---|
| `router` | `Router` | Router instance to register routes on |
| `root` | `string` | Directory to scan for `@Controller` classes |
| `prefix` | `string` | Global route prefix (e.g. `'/api/v1'`) |
| `controllers` | `Constructor[]` | Explicit list of controller classes (alternative to `root`) |
| `include` | `string[]` | Glob patterns to include (default: `['**/*.ts', '**/*.js']`) |
| `exclude` | `string[]` | Glob patterns to exclude (default: test files, `dist/`, `node_modules/`) |
| `debug` | `boolean` | Log discovered controllers to stderr |
| `container` | `ContainerInterface` | Custom DI container (default: global container) |

### Plugin Errors

| Error | Description |
|---|---|
| `DiscoveryError` | Failed to scan the `root` directory |
| `NotAControllerError` | A discovered class is not a `@Controller` |
| `ControllerResolutionError` | Failed to resolve a controller from the DI container |
| `RouteRegistrationError` | Failed to register a route on the router |
| `GuardRejectionError` | A guard returned `false` (403 response) |
| `MissingParameterError` | A required parameter was missing from the request |
| `ParameterInjectionError` | Failed to extract a parameter from the request |

---

## Return Values

Controller methods can return any value. The plugin serializes them automatically:

```typescript
@Get()
findAll() {
  return [{ id: 1 }];          // → 200 JSON
}

@Get('/:id')
async findOne(@Param('id') id: string) {
  const user = await db.find(id);
  if (!user) throw new NotFoundError();   // → 404 JSON
  return user;                             // → 200 JSON
}
```

Return `void` or `undefined` to handle the response manually via `@Ctx()`:

```typescript
@Get('/stream')
stream(@Ctx() ctx: Context) {
  ctx.status = 200;
  ctx.set('Content-Type', 'text/event-stream');
  // manual response handling
}
```

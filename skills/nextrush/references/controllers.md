# Controllers & Decorators

Decorator-based controllers with route decorators, parameter injection, guards,
response decorators, and auto-discovery via `controllersPlugin`.

## Prerequisites

- Import from `nextrush/class` — auto-imports `reflect-metadata` (no manual import needed)
- TypeScript `experimentalDecorators` and `emitDecoratorMetadata` enabled in tsconfig.json
- `nextrush dev` validates tsconfig flags at startup and warns if missing

```typescript
// Using meta-package (recommended)
import { createApp, createRouter, listen } from 'nextrush';
import { Controller, Get, Post, Body, Param, Service, controllersPlugin } from 'nextrush/class';
import type { GuardFn, CanActivate, GuardContext } from 'nextrush/class';

// Using individual packages
import { Controller, Get, Post } from '@nextrush/decorators';
import { Service } from '@nextrush/di';
import { controllersPlugin } from '@nextrush/controllers';
```

## Create a Controller

```typescript
import { Controller, Get, Post, Put, Delete, Body, Param, Service } from 'nextrush/class';
import { NotFoundError } from 'nextrush';

@Service()
class ProductService {
  async findAll() {
    return [];
  }
  async findById(id: string) {
    return null;
  }
  async create(data: { name: string }) {
    return { id: '1', ...data };
  }
}

@Controller('/products')
class ProductController {
  constructor(private productService: ProductService) {}

  @Get()
  async list() {
    return this.productService.findAll();
  }

  @Get('/:id')
  async findOne(@Param('id') id: string) {
    const product = await this.productService.findById(id);
    if (!product) throw new NotFoundError('Product not found');
    return product;
  }

  @Post()
  async create(@Body() data: { name: string }) {
    return this.productService.create(data);
  }

  @Put('/:id')
  async update(@Param('id') id: string, @Body() data: { name: string }) {
    return { id, ...data };
  }

  @Delete('/:id')
  async remove(@Param('id') id: string) {
    return { deleted: id };
  }
}
```

## Register Controllers

```typescript
import { createApp, createRouter, listen } from 'nextrush';
import { controllersPlugin } from 'nextrush/class';

const app = createApp();
const router = createRouter();

// Auto-discovery: scans ALL .ts/.js files under root for @Controller classes
await app.plugin(
  controllersPlugin({
    router,
    root: './src',
    prefix: '/api',
  })
);

app.route('/', router);
listen(app, 3000);
```

## Parameter Decorators

| Decorator                  | Source                      | Example                                         |
| -------------------------- | --------------------------- | ----------------------------------------------- |
| `@Body()`                  | Full request body           | `create(@Body() data: CreateDto)`               |
| `@Body('name')`            | Single body field           | `create(@Body('name') name: string)`            |
| `@Param()`                 | All route params            | `show(@Param() params: Record<string, string>)` |
| `@Param('id')`             | Single route param          | `show(@Param('id') id: string)`                 |
| `@Query()`                 | All query params            | `list(@Query() q: Record<string, string>)`      |
| `@Query('page')`           | Single query param          | `list(@Query('page') page: string)`             |
| `@Header()`                | All headers                 | `check(@Header() h: Record<string, string>)`    |
| `@Header('authorization')` | Single header               | `check(@Header('authorization') auth: string)`  |
| `@Ctx()`                   | Full context object         | `handle(@Ctx() ctx: Context)`                   |
| `@Req()`                   | Raw request (escape hatch)  | `handle(@Req() req: IncomingMessage)`           |
| `@Res()`                   | Raw response (escape hatch) | `handle(@Res() res: ServerResponse)`            |

## Parameter Transforms

```typescript
// Sync — convert param to number
@Get('/:id')
findOne(@Param('id', { transform: Number }) id: number) { }

// Async — validate with Zod
@Post()
create(@Body({ transform: zodSchema.parseAsync }) data: CreateProduct) { }

// Default value
@Get()
list(@Query('limit', { defaultValue: 10, transform: Number }) limit: number) { }
```

## Custom Parameter Decorators

```typescript
import { createCustomParamDecorator } from 'nextrush/class';

// Extract authenticated user from state
const CurrentUser = createCustomParamDecorator((ctx) => ctx.state.user);

// Parameterized: extract a specific cookie
const Cookie = (name: string) =>
  createCustomParamDecorator(
    (ctx) =>
      ctx
        .get('cookie')
        ?.split(';')
        .find((c) => c.trim().startsWith(name + '='))
        ?.split('=')[1]
  );

@Controller('/users')
class UserController {
  @Get('/me')
  getProfile(@CurrentUser user: User) {
    return user;
  }

  @Get('/prefs')
  getPrefs(@Cookie('theme') theme: string) {
    return { theme };
  }
}
```

Signature: `createCustomParamDecorator(extractor, options?)` where options has `transform?` and `required?`.

## Guards

Guards control route access. Return `true` to allow, `false` to reject (403).

### Function Guard

```typescript
import type { GuardFn } from 'nextrush/class';

const AuthGuard: GuardFn = async (ctx) => {
  return Boolean(ctx.get('authorization'));
};
```

### Class Guard (with DI)

```typescript
import { Service } from 'nextrush/class';
import type { CanActivate, GuardContext } from 'nextrush/class';

@Service()
class RoleGuard implements CanActivate {
  constructor(private roles: RoleService) {}

  async canActivate(ctx: GuardContext): Promise<boolean> {
    return this.roles.check(ctx.state.user);
  }
}
```

### Apply Guards

```typescript
import { Controller, Delete, Param, UseGuard } from 'nextrush/class';

@UseGuard(AuthGuard) // Class-level — applies to ALL methods
@Controller('/admin')
class AdminController {
  @UseGuard(RoleGuard) // Method-level — this route only
  @Delete('/:id')
  async remove(@Param('id') id: string) {
    return { deleted: id };
  }
}
```

**Execution order**: class guards → method guards. Any guard returning `false` throws `GuardRejectionError` (403).

`GuardContext` is a lightweight read-only context (no response methods): `method`, `path`, `params`, `query`, `body`, `headers`, `state`, `get()`.

## Response Decorators

```typescript
import { Get, Redirect, SetHeader } from 'nextrush/class';

@Controller('/pages')
class PageController {
  @Redirect('/new-page', 301) // Permanent redirect
  @Get('/old-page')
  redirectOld() {}

  @Redirect('/fallback') // 302 by default
  @Get('/dynamic')
  dynamicRedirect() {
    return '/other-page'; // Return string to override URL
  }

  @SetHeader('Cache-Control', 'max-age=3600')
  @SetHeader('X-Custom', 'value') // Multiple headers can be stacked
  @Get('/cached')
  getCached() {
    return { data: 'cached' };
  }
}
```

## controllersPlugin Options

| Option        | Type                 | Default                     | Description                                       |
| ------------- | -------------------- | --------------------------- | ------------------------------------------------- |
| `router`      | `Router`             | _required_                  | Router instance for route registration            |
| `root`        | `string`             | —                           | Directory to scan for `@Controller` classes       |
| `include`     | `string[]`           | `['**/*.ts', '**/*.js']`    | Glob patterns for auto-discovery                  |
| `exclude`     | `string[]`           | test/spec/node_modules/dist | Patterns to exclude                               |
| `prefix`      | `string`             | `''`                        | Route prefix for all controllers                  |
| `debug`       | `boolean`            | `false`                     | Log discovered controllers to stderr              |
| `controllers` | `Function[]`         | `[]`                        | Manual controller list (skip auto-discovery)      |
| `container`   | `ContainerInterface` | global                      | Custom DI container                               |
| `middleware`  | `Middleware[]`       | `[]`                        | Global middleware for all controllers             |
| `strict`      | `boolean`            | `false`                     | Throw on discovery errors (default logs warnings) |

## Rules

- Import from `nextrush/class` to auto-load `reflect-metadata` — no manual import needed
- Controller method return values are auto-serialized as JSON
- `undefined` return = empty response
- One `@Controller()` prefix per class
- Guard rejection throws `GuardRejectionError` (403)
- Missing required parameter throws `MissingParameterError` (400)
- Route decorators: `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`, `@Head`, `@Options`, `@All`
- Parameter decorators can only be used on method parameters (not constructor)
- `@Req()` and `@Res()` are escape hatches — prefer `@Ctx()` for portability

## Troubleshooting

| Problem              | Cause                               | Solution                                                     |
| -------------------- | ----------------------------------- | ------------------------------------------------------------ |
| DI resolution fails  | `reflect-metadata` not loaded       | Import from `nextrush/class` (auto-loads it)                 |
| Controller not found | File outside `root`                 | Ensure controller is under the `root` path in plugin config  |
| Guard always rejects | Returns falsy (not explicit `true`) | Return `true` explicitly for allowed requests                |
| Parameters undefined | Missing decorator                   | Add `@Body()`, `@Param()` etc. to method params              |
| Decorator errors     | Missing tsconfig flags              | Enable `experimentalDecorators` + `emitDecoratorMetadata`    |
| "TypeInfo not known" | `emitDecoratorMetadata` false       | Enable in tsconfig.json; `nextrush dev` validates at startup |
| Route not registered | Missing `app.route()`               | Mount the router after calling `controllersPlugin`           |
| Double response      | Handler sends + returns             | Either return a value OR use `ctx.json()` — not both         |

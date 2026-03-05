# Controllers & Decorators

Decorator-based controllers with route decorators, parameter injection, guards,
and auto-discovery via `controllersPlugin`.

## Prerequisites

- `reflect-metadata` imported as the **first** import in your entry file
- TypeScript `experimentalDecorators` and `emitDecoratorMetadata` in tsconfig.json
- Packages: `@nextrush/decorators`, `@nextrush/di`, `@nextrush/controllers`

## Create a Controller

```typescript
import { Controller, Get, Post, Put, Delete } from '@nextrush/decorators';
import { Body, ParamProp, QueryProp } from '@nextrush/decorators';
import { Service } from '@nextrush/di';
import { NotFoundError } from '@nextrush/errors';

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
  async findOne(@ParamProp('id') id: string) {
    const product = await this.productService.findById(id);
    if (!product) throw new NotFoundError('Product not found');
    return product;
  }

  @Post()
  async create(@Body() data: { name: string }) {
    return this.productService.create(data);
  }
}
```

## Register Controllers

```typescript
import 'reflect-metadata';
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { controllersPlugin } from '@nextrush/controllers';

const app = createApp();
// Scans ALL .ts/.js files under root — no file naming convention required.
// Any file exporting a class with @Controller is discovered automatically.
await app.plugin(
  controllersPlugin({
    router: createRouter(),
    root: './src',
    prefix: '/api',
  })
);
app.listen(3000);
```

> `include` is optional — default scans `**/*.ts` and `**/*.js`. Only set it to narrow
> the scan to specific patterns (e.g. `['modules/**/*.controller.ts']`).

## Parameter Decorators

| Decorator                      | Source             | Example                                             |
| ------------------------------ | ------------------ | --------------------------------------------------- |
| `@Body()`                      | Full request body  | `create(@Body() data: CreateDto)`                   |
| `@BodyProp('name')`            | Single body field  | `create(@BodyProp('name') name: string)`            |
| `@Param()`                     | All route params   | `show(@Param() params: Record<string, string>)`     |
| `@ParamProp('id')`             | Single route param | `show(@ParamProp('id') id: string)`                 |
| `@Query()`                     | All query params   | `list(@Query() query: Record<string, string>)`      |
| `@QueryProp('page')`           | Single query param | `list(@QueryProp('page') page: string)`             |
| `@Headers()`                   | All headers        | `check(@Headers() headers: Record<string, string>)` |
| `@HeaderProp('authorization')` | Single header      | `check(@HeaderProp('authorization') auth: string)`  |
| `@State()`                     | Middleware state   | `show(@State() state: Record<string, unknown>)`     |
| `@Ctx()`                       | Full context       | `handle(@Ctx() ctx: Context)`                       |

## Parameter Transforms

```typescript
// Sync transform
@ParamProp('id', { transform: Number }) id: number

// Async transform (validation libraries)
@Body({ transform: zodSchema.parseAsync }) data: CreateProduct
```

## Guards

Guards control route access. Return `true` to allow, `false` to reject (403).

### Function Guard

```typescript
import type { GuardFn } from '@nextrush/decorators';

const AuthGuard: GuardFn = async (ctx) => {
  return Boolean(ctx.get('authorization'));
};
```

### Class Guard (with DI)

```typescript
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
@UseGuard(AuthGuard) // Class-level — applies to all methods
@Controller('/admin')
class AdminController {
  @UseGuard(RoleGuard) // Method-level — applies to this route only
  @Delete('/:id')
  async remove(@ParamProp('id') id: string) {
    return { deleted: id };
  }
}
```

Execution order: class guards run first, then method guards. Any guard returning `false` throws `GuardRejectionError` (403).

## Rules

- `reflect-metadata` must be the first import in entry file
- Controller methods return values are auto-serialized as JSON
- `undefined` return = empty response
- One controller per class, one `@Controller()` prefix per class
- Guard rejection throws `GuardRejectionError` (403)

## Troubleshooting

| Problem              | Cause                               | Solution                                                                                  |
| -------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| DI resolution fails  | Missing `reflect-metadata`          | Add `import 'reflect-metadata'` as first import                                           |
| Controller not found | File outside `root`                 | Ensure controller is under the `root` path in plugin config                               |
| Guard always rejects | Returns falsy (not explicit `true`) | Return `true` explicitly for allowed requests                                             |
| Parameters undefined | Missing decorator                   | Add `@Body()`, `@ParamProp()` etc. to method params                                       |
| Decorator errors     | Missing tsconfig flags              | `nextrush dev` warns at startup; add `experimentalDecorators` and `emitDecoratorMetadata` |
| "TypeInfo not known" | `emitDecoratorMetadata` false       | Enable in tsconfig.json; `nextrush dev` validates this on startup                         |

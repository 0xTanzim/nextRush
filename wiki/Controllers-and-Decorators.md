# Controllers & Decorators


Class-based controllers turn the functional API's per-route wiring into declarations. Instead of
extracting request values, checking dependencies, guarding auth, and mapping errors by hand in
every handler, you decorate a class once and `registerControllers` builds the whole graph.

The class runtime is a **registrar on top of the functional core** — it reads `app.router` and
`app.container` and mounts routes. It is not a framework rewrite.

## Why class-based controllers

The functional API reads well for a handful of routes, but each handler repeats the same
plumbing: pulling values off `ctx`, constructing dependencies, re-running auth, re-mapping errors.

| Aspect | Functional | Class-based |
| ------ | ---------- | ----------- |
| Lines of code | ~80 | ~200 |
| Setup | Minimal | More boilerplate |
| DI support | Manual | Automatic |
| Testing | Mock functions | Inject mocks |
| Type safety | Good | Excellent |
| Scalability | Medium | High |

Choose class-based when you have enough routes, services, and collaborators that automatic DI and
declarative structure pay for the extra boilerplate.

## Prerequisites

Decorators need metadata emitted at compile time. Your `tsconfig.json` must enable:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

The `nextrush` meta-package auto-imports `reflect-metadata`, so no manual import is needed when
you use `nextrush/class`. Build class apps with `nextrush dev` / `nextrush build` — fast bundlers
(esbuild, tsx, swc) skip decorator-metadata emission, and DI resolution then fails with
`undefined` constructor arguments.

## Minimal example

```ts
import { createApp, listen } from 'nextrush';
import { Controller, Get, Post, Param, Body, Service, registerControllers } from 'nextrush/class';

@Service() // singleton, one instance shared
class UserService {
  private users = [{ id: '1', name: 'Ada' }];
  findAll() { return this.users; }
  findOne(id: string) { return this.users.find((u) => u.id === id) ?? null; }
  create(data: { name: string }) {
      const user = { id: String(this.users.length + 1), ...data };
      this.users.push(user);
      return user;
  }
}

@Controller('/users')
class UserController {
  constructor(private readonly users: UserService) {} // resolved from DI

  @Get()
  findAll() { return this.users.findAll(); }

  @Get('/:id')
  findOne(@Param('id') id: string) { return this.users.findOne(id); }

  @Post()
  create(@Body() data: { name: string }) { return this.users.create(data); }
}

const app = createApp();
await registerControllers(app, { controllers: [UserController] });

await listen(app, 8080);
```

Nobody writes `new` or reads `ctx` by hand. `@Controller` marks the class an HTTP controller
(and DI-resolvable), the constructor declares its dependency, `@Param('id')` extracts the route
param, and `registerControllers` registers and builds all routes — eagerly resolving every
controller once at boot so a broken dependency fails here, not as a first-request 500.

## Decorator reference

| Decorator | Runs on | What it does |
| --------- | ------- | ------------ |
| `@Controller(path \| options)` | class | Marks an HTTP controller; adds a path prefix (+ optional `version`, `middleware`, `tags`) |
| `@Get` `@Post` `@Put` `@Patch` `@Delete` `@Head` `@Options` `@All` | method | Bind a method to an HTTP verb + path |
| `@Body` | parameter | Request body (whole body, or `@Body('name')` for a field) |
| `@Param` | parameter | Route parameter (one, or all with `@Param()`) |
| `@Query` | parameter | Query string (one key, or all) |
| `@Header` | parameter | A header (or all) |
| `@Ctx` | parameter | The full `Context` |
| `@Req` / `@Res` | parameter | Raw request / response objects |
| `@SetHeader(name, value)` | method | Set a response header (stackable) |
| `@Redirect(url, status?)` | method | Redirect via the `Location` header (default `302`) |
| `@HttpCode(status)` | method | Fixed success status for the route |
| `@UseGuard` | class / method | Attach a `GuardFn` or a DI-resolved `CanActivate` class |
| `@UseInterceptor` | class / method | Wrap the handler (around advice) |
| `@Catch(...)` + `@UseFilter(...)` | class | Map thrown errors to responses for a controller/route |
| `createCustomParamDecorator` | factory | Build a reusable custom parameter extractor |

Example response decorators:

```ts
import { Controller, Get, SetHeader, HttpCode, Post } from 'nextrush/class';

@Controller('/api')
class ApiController {
  @SetHeader('Cache-Control', 'no-store')
  @Get('/status')
  getData() { return { result: 'ok' }; }
}

@Controller('/users')
class UserController {
  @HttpCode(201)
  @Post()
  create() { return { created: true }; }
}
```

For guards, interceptors, filters, parameter transforms, and custom decorators, see the docs-site
Decorators reference.

## Registering controllers

`registerControllers(app, options)` is a plain `async` registrar you `await` once before starting
the server:

```ts
import { createApp, listen } from 'nextrush';
import { registerControllers } from 'nextrush/class';

const app = createApp();

// Auto-discovery: scans ./src for *.controller.* files
await registerControllers(app, { root: './src', prefix: '/api' });

// OR an explicit list — no filesystem scan (tests, serverless):
// await registerControllers(app, { controllers: [UserController] });

await listen(app, 8080);
```

| Option | Type | Default | Meaning |
| ------ | ---- | ------- | ------- |
| `controllers` | `Function[]` | `[]` | Explicit classes; merged with `root` discovery |
| `root` | `string` | — | Directory to scan; enables auto-discovery |
| `include` | `string[]` | `*.controller.{ts,js}` | Glob patterns for discovery |
| `exclude` | `string[]` | test / `node_modules` / `dist` | Patterns excluded |
| `prefix` | `string` | `''` | Prefix prepended to every route |
| `container` | `Container` | `app.container` → global | Container to resolve from |
| `middleware` | `Middleware[]` | `[]` | Global middleware for all routes |
| `validate` | `boolean` | `true` | Eagerly resolve every controller at boot |
| `strict` | `boolean` | `false` | Throw on discovery errors instead of logging |
| `debug` | `boolean` | `false` | Log discovery/registration to stderr |

> Discovery dynamically `import()`s every matched file, running its top-level code. Prefer a
> narrow scope or an explicit `controllers` list when a source file has side effects.

## Singletons and status codes

Controllers resolve as **singletons** and are shared across requests — keep them stateless and put
per-request data in `ctx.state` via `@Ctx()`, never on `this`. A returned value serializes as JSON
with HTTP 200. To change the status: `@HttpCode(201)` for a fixed value, inject `@Ctx()` and set
`ctx.status` for runtime logic, or throw an `HttpError` subclass to signal an error:

```ts
import { NotFoundError } from 'nextrush';

@Controller('/users')
export class UserController {
  @Get('/:id')
  findById(@Param('id') id: string) {
    const user = this.userService.findById(id);
    if (!user) throw new NotFoundError('User not found'); // → 404
    return user;
  }
}
```

## Next steps

- [Dependency Injection](Dependency-Injection) — how the container assembles and scopes the graph
- [Modules](Modules) — group a feature's controllers and providers behind one declaration
- [Extensions](Extensions) — long-lived app-scoped services
- [Streaming](Streaming) — respond in chunks (text / SSE / NDJSON)
- Class guide: https://0xtanzim.github.io/nextRush/docs/guides/api-development
- Decorators reference: https://0xtanzim.github.io/nextRush/docs/reference/class/decorators
- Controllers reference: https://0xtanzim.github.io/nextRush/docs/reference/class/controllers


# @nextrush/class

> The unified class-based runtime for NextRush — `@Controller` + route/parameter decorators, guards, interceptors, exception filters, lifecycle hooks, modules, request scope, and automatic controller registration, with dependency injection re-exported from `@nextrush/di`.

[![npm version](https://img.shields.io/npm/v/@nextrush/class.svg)](https://www.npmjs.com/package/@nextrush/class)
[![downloads](https://img.shields.io/npm/dm/@nextrush/class.svg)](https://www.npmjs.com/package/@nextrush/class)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/class.svg)](https://bundlephobia.com/package/@nextrush/class)
[![types](https://img.shields.io/npm/types/@nextrush/class.svg)](https://www.npmjs.com/package/@nextrush/class)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/class.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Structure a NextRush app as classes — decorate a controller, declare routes and parameters, add guards/interceptors/filters, and let `registerControllers` / `registerModule` wire the whole graph |
| **Package type** | Core (Registrar + decorator runtime) |
| **Status** | Stable ✅ |
| **Included in `nextrush`?** | ✅ Yes — via the `nextrush/class` subpath (`import { Controller, Get } from 'nextrush/class'`) |
| **Support tier** | Public — core (stable, semver-guarded) — see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Universal for the decorator + request pipeline · filesystem discovery is Node-only (see [Compatibility](#compatibility)) |
| **Requires** | Node `>=22` · ESM-only · TypeScript `>=5.x` (with `experimentalDecorators` + `emitDecoratorMetadata`) |
| **Introduced** | `v3.0.0` (consolidated into `@nextrush/class` in `v3.1.0`) |

## Highlights

- 🧩 **One import for the whole class API** — controllers, routes, params, guards, interceptors, filters, modules, lifecycle, and DI, from `nextrush/class`
- 🏗️ **Registrar, not a framework rewrite** — `registerControllers` / `registerModule` read `app.router` + `app.container` and build routes; the functional core is untouched
- 🔁 **Request scope that bubbles** — a request-scoped dependency anywhere in a controller's graph makes that controller resolve fresh per request; pure-singleton graphs keep the memoized fast path
- ⚡ **Zero reflection on the request path** — decorator metadata is read once at bootstrap and baked into an immutable route graph; requests execute pre-built handlers
- 🧰 **Fail-at-boot validation + opt-in diagnostics** — unresolvable/circular controllers and guards throw at registration, not as a first-request 500
- ✅ **ESM-only**, **fully typed** — strict TypeScript, zero `any`

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) · [When to use](#when-to-use) · [Installation](#installation) · [Quick start](#quick-start) · [Capabilities](#capabilities) · [Mental model](#mental-model) · [Common tasks](#common-tasks) · [API overview](#api-overview) · [Options](#options) · [Compatibility](#compatibility) · [Troubleshooting](#troubleshooting) · [FAQ](#faq) · [Package relationships](#package-relationships) · [Architecture](#architecture) · [Resources](#resources)

</details>

---

## The problem

The functional API is direct for a handful of routes, but a growing app repeats the same wiring by hand: pull each value off `ctx`, look up dependencies, thread shared services through every handler, and re-implement auth checks and error mapping per route. The controller's actual job — take an id, return a user — gets buried under plumbing.

```ts
// TODAY, without the class runtime — every handler re-does the same extraction,
// wiring, guarding, and error mapping by hand:
router.get('/users/:id', async (ctx) => {
  const token = ctx.get('authorization');
  if (!token || !(await verify(token))) {   // auth, inline, copy-pasted per route
    ctx.status = 403;
    return ctx.json({ error: 'forbidden' });
  }
  const db = getDb();                        // dependency lookup, by hand
  const repo = new UserRepository(db);       // construction, by hand
  const id = ctx.params.id;                  // extraction, by hand
  ctx.json(await repo.findOne(id));
});
```

As routes multiply, the extraction, construction, auth, and error handling are duplicated at every call site, and a shared instance (a connection pool) can be built twice by accident. `@nextrush/class` moves each of those into a declaration: `@Param('id')` extracts, the constructor declares dependencies, `@UseGuard` attaches auth once, `@UseFilter` maps errors, and the registrar builds the routes.

## When to use

`@nextrush/class` is the class-based half of NextRush. It sits on top of the same `Application` and router the functional API uses — you are not choosing a different framework, only a different authoring style for the parts that benefit from structure.

**Use `@nextrush/class` if:**

- ✓ You want controllers with declarative routes (`@Get`, `@Post`, …) and typed parameter extraction (`@Body`, `@Param`, `@Query`, …)
- ✓ You want dependency injection for services shared across routes, with singleton / transient / request scopes
- ✓ You want cross-cutting concerns as reusable units — `@UseGuard` for auth, `@UseInterceptor` for wrapping/timing, `@UseFilter` + `@Catch` for error mapping
- ✓ You want feature modules (`@Module`) and one-call registration of a whole app graph (`registerModule`)

**Reach for something else if:**

- ✗ You have a small, flat set of routes and prefer no decorators or reflection → use the functional API from [`nextrush`](../nextrush) (`createApp` / `createRouter`)
- ✗ You only need the DI container on its own, or the parts this package does not re-export (`@Config`, `@Injectable`, `@Optional`, `delay`, DI error classes) → use [`@nextrush/di`](../di) directly

---

## Installation

```bash
pnpm add nextrush
# npm i nextrush · yarn add nextrush · bun add nextrush
```

The class API is exposed through the `nextrush/class` subpath, so installing `nextrush` is enough. Install the package directly (`pnpm add @nextrush/class`) only if you depend on it without the meta package.

> [!NOTE]
> Already using `nextrush`? The whole class surface — decorators, `registerControllers`,
> `registerModule`, and the re-exported DI (`Service`, `container`, …) — imports from
> `nextrush/class`. You do not install `@nextrush/class` separately.

> [!IMPORTANT]
> Decorators need `reflect-metadata` loaded once before any decorated class is defined, and your
> `tsconfig.json` needs `"experimentalDecorators": true` and `"emitDecoratorMetadata": true`.
> Importing `nextrush/class` loads `reflect-metadata` for you — no manual import required.

## Quick start

```ts
import { createApp, listen } from 'nextrush';
import { Controller, Get, Post, Param, Body, Service, registerControllers } from 'nextrush/class';

@Service() // singleton by default — @Controller injects it automatically
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
listen(app, 8080);
```

You never construct `UserService` or read `ctx` by hand. `@Controller` marks the class resolvable, the constructor declares its dependency, `@Param('id')` extracts the route param, and `registerControllers` builds and mounts the routes on `app.router` — after eagerly resolving every controller once so a broken dependency fails here, not on the first request.

## Capabilities

**Routing & extraction**
- **`@Controller(path)`** — mark a class as an HTTP controller (path derived from the class name if omitted)
- **Route decorators** — `@Get` `@Post` `@Put` `@Patch` `@Delete` `@Head` `@Options` `@All`
- **Parameter decorators** — `@Body` `@Param` `@Query` `@Header` `@Ctx` `@Req` `@Res`, with `transform` on `@Body`/`@Param`/`@Query` and `defaultValue` on `@Param`/`@Query`/`@Header` (`@Ctx`/`@Req`/`@Res` take no options), plus `createCustomParamDecorator` for your own extractors
- **Response decorators** — `@HttpCode(status)`, `@Redirect(url, status?)`, `@SetHeader(name, value)`

**Cross-cutting concerns**
- **Guards** — `@UseGuard(...)` accepts a `GuardFn` or a `CanActivate` class (resolved from DI); a `false` return throws a 403, a thrown `HttpError` keeps its own status
- **Interceptors** — `@UseInterceptor(...)` wraps the handler (onion / around advice); the return value replaces the result
- **Exception filters** — `@Catch(...ErrorTypes)` + `@UseFilter(...)` map thrown errors to responses; unmatched errors fall through to the global error middleware

**Composition & lifecycle**
- **Dependency injection** — `@Service` / `@Repository` with `singleton` / `transient` / `request` scopes, re-exported from [`@nextrush/di`](../di)
- **Modules** — `@Module({ imports, controllers, providers, exports })` + `registerModule` wire a feature graph in one call
- **Lifecycle hooks** — duck-typed `OnInit` / `OnShutdown` (no decorator) run at `app.ready()` / `app.close()` in dependency order
- **Request scope** — bubbles automatically: a request-scoped dependency makes its whole controller graph resolve per request

**Registration & tooling**
- **`registerControllers`** — filesystem auto-discovery (`root`) or an explicit `controllers` list, with fail-at-boot validation
- **Discovery sources** — `FilesystemSource` / `MemorySource` behind the `DiscoverySource` interface
- **Diagnostics** — opt-in (`diagnostics: true`) route/provider/duplicate/cycle/timing report via `getClassDiagnostics(app)`

**Performance & DX**
- **Zero reflection per request** — metadata is read once at bootstrap and baked into an immutable route graph
- **Memoized singleton controllers** — the default path adds no per-request resolution cost
- **Fully typed** — strict TypeScript, zero `any`

## Mental model

Decorators only *record metadata* on your classes. Nothing runs until `registerControllers` (or `registerModule`) reads that metadata at bootstrap, builds one handler per route, and mounts them on the app's router. At request time, the pre-built handler runs the pipeline in a fixed order.

```text
  @Controller / @Get / @Body / @UseGuard ...     (decorators record metadata)
                       |
                       v
  registerControllers(app, options)  --- reads app.router + app.container,
        |                                  builds routes ONCE at bootstrap
        v
  per request:  guards --> resolve controller --> params --> interceptors
                   --> handler --> response      (all wrapped by exception filters)
```

**Rule:** decorators declare, the registrar builds at bootstrap, and requests execute a baked handler — so no decorator metadata is read on the hot path.

> [!TIP]
> The full request pipeline, the bootstrap stages, and the request-scope lifecycle (with Mermaid
> diagrams) are in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Define a controller with typed parameters

```ts
import { Controller, Get, Post, Param, Query, Body } from 'nextrush/class';

@Controller('/articles')
class ArticleController {
  @Get()
  list(@Query('page', { defaultValue: 1, transform: Number }) page: number) {
    return { page };
  }

  @Get('/:id')
  read(@Param('id') id: string) {
    return { id };
  }

  @Post()
  create(@Body() data: { title: string }) {
    return { created: data.title };
  }
}
```

### Protect a route with a guard

```ts
import { Controller, Get, UseGuard, Service } from 'nextrush/class';
import type { CanActivate, GuardContext } from 'nextrush/class';

@Service()
class AuthGuard implements CanActivate {
  canActivate(ctx: GuardContext): boolean {
    return Boolean(ctx.get('authorization')); // false -> 403; throw an HttpError for another status
  }
}

@Controller('/admin')
@UseGuard(AuthGuard) // class-level: applies to every route; resolved from DI
class AdminController {
  @Get()
  dashboard() {
    return { ok: true };
  }
}
```

### Map errors with an exception filter

```ts
import { Controller, Get, UseFilter, Catch, Service } from 'nextrush/class';
import type { ExceptionFilter } from 'nextrush/class';
import type { Context } from '@nextrush/types';

class EntityNotFoundError extends Error {}

@Service()
@Catch(EntityNotFoundError) // no argument = catch-all
class NotFoundFilter implements ExceptionFilter {
  catch(_error: unknown, ctx: Context): void {
    ctx.status = 404;
    ctx.json({ error: 'Resource not found' });
  }
}

@Controller('/items')
@UseFilter(NotFoundFilter)
class ItemController {
  @Get('/:id')
  read() {
    throw new EntityNotFoundError(); // handled by NotFoundFilter -> 404
  }
}
```

### Group features with a module

```ts
import { createApp, listen } from 'nextrush';
import { Module, registerModule } from 'nextrush/class';

@Module({ controllers: [UserController], providers: [UserService] })
class UserModule {}

@Module({ imports: [UserModule] }) // compose feature modules through `imports`
class AppModule {}

const app = createApp();
await registerModule(app, AppModule, { prefix: '/api' });
listen(app, 8080);
```

### Run setup/teardown with lifecycle hooks

```ts
import { Service } from 'nextrush/class';
import type { OnInit, OnShutdown } from 'nextrush/class';

@Service()
class Database implements OnInit, OnShutdown {
  async onInit() { /* runs at app.ready(), dependencies first */ }
  async onShutdown() { /* runs at app.close(), reverse order */ }
}
```

## API overview

The sealed public surface (ADR-0005), grouped by role. DI exports (`Service`, `Repository`, `container`, `createContainer`, `inject`, `Container`) are re-exported from [`@nextrush/di`](../di) — see its docs for the container contract.

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `Controller` | `(pathOrOptions?: string \| ControllerOptions) => ClassDecorator` | `3.0.0` | Stable ✅ | Mark a class an HTTP controller; makes it DI-resolvable. |
| `Get` `Post` `Put` `Patch` `Delete` `Head` `Options` `All` | `(pathOrOptions?, options?) => MethodDecorator` | `3.0.0` | Stable ✅ | Bind a method to an HTTP method + path. |
| `Body` `Param` `Query` `Header` | `(name?/options?, options?) => ParameterDecorator` | `3.0.0` | Stable ✅ | Extract body / route param / query / header (`transform` on `Body`/`Param`/`Query`; `defaultValue` on `Param`/`Query`/`Header`). |
| `Ctx` `Req` `Res` | `() => ParameterDecorator` | `3.0.0` | Stable ✅ | Inject the `Context`, or the raw request/response (adapter-specific). |
| `createCustomParamDecorator` | `(extractor, options?) => ParameterDecorator` | `3.0.0` | Stable ✅ | Build a custom parameter extractor. |
| `HttpCode` | `(statusCode: number) => MethodDecorator` | `3.0.0` | Stable ✅ | Set the success status code (overrides the route `statusCode`). |
| `Redirect` | `(url: string, statusCode?: number) => MethodDecorator` | `3.0.0` | Stable ✅ | Redirect the response (default `302`). |
| `SetHeader` | `(name: string, value: string) => MethodDecorator` | `3.0.0` | Stable ✅ | Attach a response header (stackable). |
| `UseGuard` | `(...guards: Guard[]) => ClassDecorator & MethodDecorator` | `3.0.0` | Stable ✅ | Attach guards (`GuardFn` or `CanActivate` class). |
| `UseInterceptor` | `(...interceptors: InterceptorClass[]) => ClassDecorator & MethodDecorator` | `3.0.0` | Stable ✅ | Wrap the handler with interceptors. |
| `UseFilter` · `Catch` | `(...filters/errorTypes) => ClassDecorator & MethodDecorator` | `3.0.0` | Stable ✅ | Attach exception filters and declare which errors they catch. |
| `Module` | `(options?: ModuleOptions) => ClassDecorator` | `3.1.0` | Stable ✅ | Declare a feature module (`imports`/`controllers`/`providers`/`exports`). |
| `registerControllers` | `(app, options?: ControllersOptions) => Promise<void>` | `3.0.0` | Stable ✅ | Discover/register controllers and build routes. |
| `registerModule` | `(app, rootModule, options?: ModuleRegistrationOptions) => Promise<void>` | `3.1.0` | Stable ✅ | Register a whole `@Module` graph in one call. |
| `FilesystemSource` · `MemorySource` | `class implements DiscoverySource` | `3.1.0` | Stable ✅ | Filesystem-scan / in-memory controller discovery. |
| `discoverControllers` · `getControllersFromResults` · `getErrorsFromResults` | `(…) => …` | `3.0.0` | Stable ✅ | Lower-level filesystem discovery helpers. |
| `getClassDiagnostics` | `(app) => DiagnosticsReport \| undefined` | `3.1.0` | Stable ✅ | Read the opt-in diagnostics report (`diagnostics: true`). |
| `getControllerDefinition` · `getRouteMetadata` · `getParamMetadata` · `isController` · … | `(target[, method]) => …` | `3.0.0` | Stable ✅ | Metadata readers for introspection / renderers (e.g. OpenAPI). |
| `ControllerRegistry` · `buildRoutes` | `class` / `(…) => BuiltRoute[]` | `3.0.0` | Stable ✅ | Lower-level registry + route builder. |
| `isOnInit` · `isOnShutdown` · `isGuardClass` · `isModule` · `getModuleMetadata` | `(value) => boolean/meta` | `3.x` | Stable ✅ | Duck-typed lifecycle/guard/module detection. |
| `ControllerError` · `ControllerResolutionError` · `DiscoveryError` · `GuardRejectionError` · `MissingParameterError` · `ParameterInjectionError` · `NoRoutesError` · `NotAControllerError` · `NotAModuleError` · `RouteRegistrationError` · `HttpError` | `class` | `3.0.0` | Stable ✅ | The class-runtime error hierarchy (4xx extend `@nextrush/errors`, 5xx are config errors). |
| `Service` · `Repository` · `container` · `createContainer` · `inject` · `type Container` | — | `3.0.0` | Stable ✅ | Re-exported from [`@nextrush/di`](../di) (its docs are the DI reference). |
| `type OnInit` · `OnShutdown` · `Guard` · `GuardFn` · `CanActivate` · `Interceptor` · `ExceptionFilter` · `ModuleOptions` · `ControllersOptions` · `BuiltRoute` · `DiagnosticsReport` · … | — | `3.x` | Stable ✅ | Public contracts for the surface above. |

## Options

`registerControllers(app, options)` accepts the following (all optional). `registerModule` accepts the subset `prefix` · `middleware` · `container` · `isolate` · `validate` · `debug`.

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------ | ----------- |
| `controllers` | `Function[]` | No | `[]` | — | Explicit controller classes to register (merged with `root` discovery). |
| `root` | `string` | No | `undefined` | ⚠️ | Directory to auto-discover; each matched file is dynamically `import()`ed (runs its top-level code). |
| `include` | `string[]` | No | `['**/*.controller.ts', '**/*.controller.js']` | — | Glob patterns for auto-discovery. |
| `exclude` | `string[]` | No | test / `node_modules` / `dist` globs | — | Glob patterns excluded from discovery. |
| `source` | `DiscoverySource` | No | `undefined` | — | Custom discovery source (precedes `root`; incompatible with `controllers`). |
| `container` | `Container` | No | `app.container` then the global container | — | DI container to resolve from; an explicit one always wins. |
| `isolate` | `boolean` | No | `false` | — | Give this registration its own fresh container so apps in one process do not share service singletons. |
| `prefix` | `string` | No | `''` | — | Path prefix prepended to every route (e.g. `/api`). |
| `middleware` | `Middleware[]` | No | `[]` | — | Global middleware applied to all controllers. |
| `validate` | `boolean` | No | `true` | — | Eagerly resolve every controller (and class guard) at boot so broken dependencies fail there, not as a first-request 500. |
| `strict` | `boolean` | No | `false` | — | Throw on discovery errors instead of logging warnings. |
| `diagnostics` | `boolean` | No | `false` | — | Collect the route/provider/duplicate/cycle/timing report (`getClassDiagnostics`); zero-cost when off. |
| `debug` | `boolean` | No | `false` | — | Write discovery/registration logs to `stderr`. |

## Compatibility

**Requirements**

| Requirement | Version |
| ----------- | ------- |
| NextRush | `3.x` |
| Node.js | `>=22` |
| TypeScript | `>=5.x` (with `experimentalDecorators` + `emitDecoratorMetadata`) |

**Runtimes**

| Runtime | Supported | Notes |
| ------- | --------- | ----- |
| Node.js `>=22` | ✅ | ESM-only; the only runtime where filesystem auto-discovery (`root` / `FilesystemSource`) works |
| Bun / Deno / Edge | ✅ / ✅ / ✅ | The decorator, DI, and request pipeline are runtime-agnostic — register with an explicit `controllers` list or `MemorySource` (no filesystem scan) |

**Integration**
- **Peer dependencies:** [`@nextrush/core`](../core) and [`@nextrush/router`](../router) (the app + router it builds onto); also depends on [`@nextrush/di`](../di), [`@nextrush/errors`](../errors), [`@nextrush/types`](../types), and `reflect-metadata`.
- **Works with:** [`@nextrush/openapi`](../middleware/openapi) (reads the route metadata it contributes), any `@nextrush/*` middleware via the `middleware` option.
- **Incompatible with:** the deprecated `@nextrush/decorators` and `@nextrush/controllers` shims — this package supersedes both; do not mix.

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** — no CommonJS build. On Node `>=22`, CommonJS consumers can
> `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong><code>ControllerResolutionError</code> / a DI error at startup</strong></summary>

**Cause:** a controller (or something in its constructor graph) can't be resolved — a missing `@Service()`, an interface injected without `@inject('TOKEN')`, or a circular dependency. With `validate: true` (the default) this surfaces at boot instead of as a first-request 500. **Fix:** decorate the service, inject tokens explicitly, or break the cycle (see [`@nextrush/di`](../di) troubleshooting). A `@nextrush/di` error is rethrown as-is so its actionable message shows.

</details>

<details>
<summary><strong>"No controllers found" warning and no routes registered</strong></summary>

**Cause:** auto-discovery scanned `root` but matched nothing — the default `include` only matches `*.controller.ts` / `*.controller.js`. **Fix:** name files with the `.controller.` convention, pass a custom `include`, or register with an explicit `controllers: [...]` list.

</details>

<details>
<summary><strong>A <code>request</code>-scoped service behaves like a singleton</strong></summary>

**Cause:** `request` scope only takes effect per-request child container. The class runtime creates one automatically **only** when a controller (or its graph) is effectively request-scoped. **Fix:** ensure the request-scoped `@Service({ scope: 'request' })` is actually in the controller's dependency graph — scope bubbles up from the dependency, so the controller resolves fresh per request. DI-scope details live in [`@nextrush/di`](../di).

</details>

<details>
<summary><strong>Lifecycle hooks (<code>onInit</code>/<code>onShutdown</code>) never run</strong></summary>

**Cause:** `registerControllers` bridges hooks into the app's lifecycle at registration time — if it runs *after* `serve()`/`listen()`/`ready()`, the config is frozen and it throws. Controllers' own hooks also require `validate: true`. **Fix:** call `registerControllers` / `registerModule` **before** `listen()`, and keep `validate` on (the default).

</details>

## FAQ

**Do I need `@Service()` on a `@Controller`?**
No. `@Controller` already makes the class DI-resolvable. Add `@Service({ scope })` to a controller only to change its scope; add it to the *services* it depends on.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun, Deno, and Edge?**
Yes for the decorator, DI, and request pipeline. Filesystem auto-discovery (`root`) is Node-only; on other runtimes register with an explicit `controllers` list or a `MemorySource`.

**How is `@nextrush/class` different from `@nextrush/decorators` / `@nextrush/controllers`?**
It consolidates both (plus modules, request scope, and diagnostics) into one package and re-exports `@nextrush/di`. The two older packages are deprecated shims — migrate to `nextrush/class`.

---

## Package relationships

```text
                 depends on         @nextrush/core · router · di · errors · types  (+ reflect-metadata)
@nextrush/class ----------------->
                 re-exports         @nextrush/di   (Service, Repository, container, createContainer, inject)
                 exposed via        nextrush        (the `nextrush/class` subpath)
                 supersedes         @nextrush/decorators · @nextrush/controllers  (deprecated)
```

- **Depends on:** [`@nextrush/core`](../core) + [`@nextrush/router`](../router) (peer — the app/router it builds on), [`@nextrush/di`](../di) (DI, re-exported), [`@nextrush/errors`](../errors) (error base classes), [`@nextrush/types`](../types) (shared contracts).
- **Re-exports:** [`@nextrush/di`](../di) — the DI surface reaches users through this package; its docs are the canonical DI reference.
- **Exposed via:** [`nextrush`](../nextrush) — the meta package's `nextrush/class` subpath is the recommended import.
- **Alternative:** the functional API in [`nextrush`](../nextrush) for apps that prefer no decorators.

## Architecture

Maintaining or contributing to this package? The internal design — the bootstrap pipeline, the
per-request handler pipeline (guards -> resolve -> params -> interceptors -> handler -> filters),
request-scope bubbling, the immutable route graph, the architectural invariants, and the decisions
and trade-offs behind them (with diagrams) — is in **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**.
Design history: [RFC-NEXTRUSH-CLASS-CONSOLIDATION, RFC-NEXTRUSH-MODULES, RFC-NEXTRUSH-REQUEST-SCOPE](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC) · [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md).

## Resources

- 📖 **Learn** — [Documentation](https://0xtanzim.github.io/nextRush/docs) · [Architecture](./ARCHITECTURE.md) · [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- 📝 **Changelog** — [CHANGELOG.md](./CHANGELOG.md)
- 🐛 **Report an issue** — [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- 🤝 **Contribute** — [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT © [Tanzim Hossain](https://github.com/0xTanzim)

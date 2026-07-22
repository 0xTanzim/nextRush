# nextrush

> The meta package - install this one to build a NextRush app: `createApp`, `createRouter`, `listen`, HTTP errors, and the shared types, plus an opt-in `nextrush/class` subpath for decorators and DI.

[![npm version](https://img.shields.io/npm/v/nextrush.svg)](https://www.npmjs.com/package/nextrush)
[![downloads](https://img.shields.io/npm/dm/nextrush.svg)](https://www.npmjs.com/package/nextrush)
[![bundle size](https://img.shields.io/bundlephobia/minzip/nextrush.svg)](https://bundlephobia.com/package/nextrush)
[![types](https://img.shields.io/npm/types/nextrush.svg)](https://www.npmjs.com/package/nextrush)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/nextrush.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | The single entry point for building a NextRush app - re-exports `createApp`, `createRouter`, `listen`, HTTP errors, and the shared types; `nextrush/class` adds decorators and DI as an explicit, separate install |
| **Package type** | Core (meta package) |
| **Status** | Stable [x] |
| **Included in `nextrush`?** | This *is* `nextrush` - the package everything else in the ecosystem re-exports through |
| **Support tier** | Public - core (stable, semver-guarded) - see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Node.js (via `@nextrush/adapter-node`) - other runtimes via their own adapter, imported directly |
| **Requires** | Node `>=22`, ESM-only, TypeScript `>=5.x` |
| **Introduced** | `v3.0.0` |

## Highlights

- [x] **Zero runtime dependencies on the functional path** - `createApp`/`createRouter`/`listen` pull in no third-party package
- [x] **`@nextrush/class`, `@nextrush/di`, and `reflect-metadata` are optional peers** - a plain `pnpm add nextrush` never resolves them onto disk
- [x] **ESM-only**, tree-shakable; only the `nextrush/class` subpath carries a side effect (`reflect-metadata`'s global patch)
- **Bundle:** the functional entry re-exports five workspace packages with no added weight of its own

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) | [When to use](#when-to-use) | [Installation](#installation) | [Quick start](#quick-start) | [Capabilities](#capabilities) | [Mental model](#mental-model) | [Common tasks](#common-tasks) | [API overview](#api-overview) | [Options](#options) | [Compatibility](#compatibility) | [Troubleshooting](#troubleshooting) | [FAQ](#faq) | [Package relationships](#package-relationships) | [Architecture](#architecture) | [Resources](#resources)

</details>

---

## The problem

NextRush is deliberately split into ~35 independent packages - a router, a core engine, an adapter per runtime, a class/DI runtime, and dozens of middleware/extension packages - so that each piece can version, test, and ship on its own. That is good for the packages and bad for a first-time user: nobody wants to work out that `createApp` lives in `@nextrush/core` but needs a router from `@nextrush/router` wired in by hand, and an HTTP server from `@nextrush/adapter-node` on top, before a single request can be served.

```ts
// TODAY, without the meta package - wiring the pieces by hand:
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { listen } from '@nextrush/adapter-node';

const app = createApp({ router: createRouter() }); // router is NOT wired in for you here
listen(app, 8080);
```

`nextrush` is that wiring, done once, correctly: its own `createApp` injects a router so `app.get(...)` works immediately, and its barrel re-exports exactly the symbols a functional app needs - nothing from the class/DI stack, so a functional-only install stays as small as the "zero-dependency core" claim promises.

## When to use

**Use `nextrush` if:**

- You're building a NextRush application - this is the entry point every quick-start example uses
- You want `createApp` to come with a router already attached, so route shortcuts (`app.get`, `app.post`, ...) work without extra setup
- You want the class-based API (`@Controller`, `@Service`, DI) available behind one additional, explicit install (`nextrush/class`), never bundled into the functional path

**Reach for something else if:**

- You're building your own meta-package, adapter, or runtime on top of NextRush and need the raw, router-agnostic `Application` - use [`@nextrush/core`](../core) directly
- You need only route matching, with no application/lifecycle layer - use [`@nextrush/router`](../router) directly
- You're targeting Bun, Deno, or an edge runtime - `nextrush`'s `listen`/`serve` come from `@nextrush/adapter-node`; import the matching `@nextrush/adapter-{bun,deno,edge}` directly for other runtimes

---

## Installation

```bash
pnpm add nextrush
# npm i nextrush | yarn add nextrush | bun add nextrush
```

This resolves only the functional core and its five workspace dependencies (`@nextrush/core`,
`@nextrush/router`, `@nextrush/adapter-node`, `@nextrush/errors`, `@nextrush/types`) - no class
runtime, no DI container, no `reflect-metadata`. See [Compatibility](#compatibility) for the
exact dependency footprint by usage path.

> [!NOTE]
> Scaffolding a new project? `pnpm create nextrush my-api` sets up `nextrush` (and, for
> class-based/full templates, `@nextrush/class`) for you - see
> [Scaffold a project](#scaffold-a-project) below.

## Quick start

```ts
import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();
const router = createRouter();

router.get('/', (ctx) => {
  ctx.json({ message: 'Hello NextRush!' });
});

app.route('/', router);

listen(app, 8080);
```

`createApp()` here wraps `@nextrush/core`'s `createApp` and injects a default router, so
`app.get(...)` also works without the explicit `createRouter()` step above - the two forms are
equivalent; this one shows the router as its own object because most real apps mount several
feature routers with `app.route(prefix, router)`.

## Capabilities

**Application & routing**
- **`createApp` / `Application`** - an `@nextrush/core` application with a router pre-wired
- **`createRouter` / `Router` / `endpoint`** - the segment-trie router and its route-metadata marker
- **`compose`** - the Koa-style middleware composer, re-exported standalone

**Server**
- **`listen` / `serve` / `createHandler`** - start an HTTP server on Node.js via `@nextrush/adapter-node`

**Errors**
- **The full `HttpError` hierarchy** - `BadRequestError`, `NotFoundError`, `UnauthorizedError`, and every other 4xx/5xx class
- **`createError` / `isHttpError` / `errorHandler` / `notFoundHandler`** - error factories and middleware
- **`ERROR_CODES` / `codeForStatus` / `ValidationError`** - the central error-code registry

**Types & constants**
- **`Context`, `Middleware`, `Next`, `Extension`, `ExtensionContext`, `RouteHandler`, `RouteDefinition`, `RouteMetadata`, `HttpMethod`** - the shared contracts every NextRush package builds on
- **`HttpStatus`, `ContentType`** - HTTP constants

**Class-based (opt-in, via `nextrush/class`)**
- **Decorators, DI, controllers, modules, guards, interceptors, filters** - see [Class-based controllers](#class-based-controllers)

**Developer experience**
- **Fully typed, zero `any`** - every re-export carries its source package's exact types
- **Actionable failure on a missing peer** - importing `nextrush/class` without its peers installed throws a message naming the exact install command, not an opaque resolution error

## Mental model

`nextrush` is a **barrel with one behavioral addition**: its root entry re-exports the functional stack as-is, except `createApp`, which wraps `@nextrush/core`'s version to inject a default router. The `nextrush/class` subpath is a second, independent barrel that dynamically loads the optional class/DI peers and re-exports their runtime values by assignment - so a resolution failure there produces an actionable error instead of crashing at import time.

```text
'nextrush'         ---> re-exports @nextrush/{core,router,adapter-node,errors,types}
                          (createApp wraps @nextrush/core's, injecting a default router)

'nextrush/class'   ---> dynamically imports reflect-metadata + @nextrush/di + @nextrush/class
                          (only if you import this subpath - never loaded by the root entry)
```

**Rule:** importing `nextrush` never touches the class/DI stack. Importing `nextrush/class` is
the one and only place that stack gets loaded - and only if you've installed its peers.

> [!TIP]
> The exports-map routing between the two entries, and the dynamic-import/re-export-by-assignment
> mechanism behind `nextrush/class`, are diagrammed in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Build a functional app

```ts
import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();
const users = createRouter();

users.get('/', (ctx) => ctx.json([]));
users.get('/:id', (ctx) => ctx.json({ id: ctx.params.id }));

app.route('/users', users); // Hono-style composition - mount a feature router at a prefix

listen(app, 8080);
```

### Add middleware

```bash
pnpm add @nextrush/cors @nextrush/body-parser
```

```ts
import { createApp, listen } from 'nextrush';
import { cors } from '@nextrush/cors';
import { json } from '@nextrush/body-parser';

const app = createApp();

app.use(cors());
app.use(json());

app.post('/api/users', (ctx) => {
  const { name, email } = ctx.body as { name: string; email: string };
  ctx.status = 201;
  ctx.json({ id: Date.now(), name, email });
});

listen(app, 8080);
```

### Handle errors

```ts
import { NotFoundError, BadRequestError } from 'nextrush';

app.get('/users/:id', async (ctx) => {
  const user = await db.findUser(ctx.params.id);
  if (!user) throw new NotFoundError('User not found');
  ctx.json(user);
});
```

Any `HttpError` subclass thrown from a handler is caught by `@nextrush/core`'s default error
path and serialized through the same contract as `errorHandler()` - no manual `try`/`catch`
needed around individual routes.

### Scaffold a project

```bash
pnpm create nextrush my-api
cd my-api && pnpm dev
```

The `create nextrush` form (with a space) installs the `create-nextrush` package - you can also
use `npx create-nextrush@latest` or `pnpm dlx create-nextrush@latest`. The interactive
scaffolder lets you choose functional, class-based, or full style, a middleware preset, and a
runtime target; class-based and full templates add `@nextrush/class` to your `package.json`
automatically. See the
[create-nextrush docs](https://github.com/0xTanzim/nextRush/tree/main/packages/create-nextrush#usage).

## Class-Based Controllers

Class-based APIs (decorators, DI, controllers) live behind the `nextrush/class` subpath, an
explicit, optional install:

```bash
pnpm add nextrush @nextrush/class
```

```ts
import { createApp, listen } from 'nextrush';
import { Controller, Get, Service, registerControllers } from 'nextrush/class';

@Service()
class GreetService {
  greet() {
    return { message: 'Hello!' };
  }
}

@Controller('/api')
class HelloController {
  constructor(private svc: GreetService) {}

  @Get()
  hello() {
    return this.svc.greet();
  }
}

const app = createApp();
await registerControllers(app, { root: './src' });
await listen(app, 8080);
```

The `nextrush/class` entry auto-imports `reflect-metadata`, so decorators and DI work with no
extra setup once `@nextrush/class` is installed. `registerControllers` is a **registrar**, not a
plugin - call and `await` it directly; it reads `app.router` and `app.container` (both injected
by `nextrush`'s `createApp()`) and must resolve before `listen()`/`serve()` starts the server.

> [!IMPORTANT]
> `experimentalDecorators` and `emitDecoratorMetadata` must be enabled in `tsconfig.json` when
> using `nextrush/class`. `create-nextrush` turns them **on** for class-based and full templates
> and **omits** them for functional (routes-only) projects, where they are unnecessary.

## API overview

The sealed public surface (ADR-0005), by entry point.

### `nextrush` (root entry)

| Export | From | Since | Stability | Description |
| ------ | ---- | ----- | --------- | ----------- |
| `createApp` | wraps `@nextrush/core` | `3.0.0` | Stable [x] | Creates an `Application` with a default router pre-wired. |
| `Application`, `compose` | `@nextrush/core` | `3.0.0` | Stable [x] | The application class and the middleware composer. |
| `Router`, `createRouter`, `endpoint` | `@nextrush/router` | `3.0.0` | Stable [x] | Segment-trie router and its route-metadata marker. |
| `createHandler`, `listen`, `serve` | `@nextrush/adapter-node` | `3.0.0` | Stable [x] | Start an HTTP server on Node.js. |
| `HttpError`, `NextRushError`, and every 4xx/5xx class | `@nextrush/errors` | `3.0.0` | Stable [x] | `BadRequestError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `MethodNotAllowedError`, `UnprocessableEntityError`, `TooManyRequestsError`, `InternalServerError`, `NotImplementedError`, `BadGatewayError`, `ServiceUnavailableError`, `GatewayTimeoutError`. |
| `createError`, `isHttpError`, `errorHandler`, `notFoundHandler` | `@nextrush/errors` | `3.0.0` | Stable [x] | Error factory and middleware. |
| `ERROR_CODES`, `codeForStatus`, `ValidationError` | `@nextrush/errors` | `3.1.0` | Stable [x] | The central error-code registry and validation error type. |
| `ContentType`, `HttpStatus` | `@nextrush/types` | `3.0.0` | Stable [x] | HTTP constants. |
| `type ApplicationOptions`, `ComposedMiddleware` | `@nextrush/core` | `3.0.0` | Stable [x] | Application-level contracts. |
| `type RouterOptions` | `@nextrush/router` | `3.0.0` | Stable [x] | Router configuration. |
| `type ServeOptions`, `ServerInstance` | `@nextrush/adapter-node` | `3.0.0` | Stable [x] | Server-start contracts. |
| `type ErrorHandlerOptions`, `HttpErrorOptions`, `ValidationIssue` | `@nextrush/errors` | `3.0.0` | Stable [x] | Error-handling contracts. |
| `type Context`, `Extension`, `ExtensionContext`, `HttpMethod`, `HttpStatusCode`, `Middleware`, `Next`, `RouteHandler`, `RouteDefinition`, `RouteMetadata`, `Runtime` | `@nextrush/types` | `3.0.0` | Stable [x] | The shared contracts every NextRush package builds on. |

This runtime surface is locked by `src/__tests__/public-surface.test.ts`; if this table ever
claims an export that test doesn't list, that's a documentation bug - please file an issue.

### `nextrush/class` (opt-in subpath)

| Export | From | Since | Stability | Description |
| ------ | ---- | ----- | --------- | ----------- |
| `Controller`, `Get`, `Post`, `Put`, `Patch`, `Delete`, `Head`, `Options`, `All` | `@nextrush/class` | `3.0.0` | Stable [x] | Class and route decorators. |
| `Body`, `Param`, `Query`, `Header`, `Ctx`, `Req`, `Res`, `createCustomParamDecorator` | `@nextrush/class` | `3.0.0` | Stable [x] | Parameter-binding decorators. |
| `HttpCode`, `Redirect`, `SetHeader` | `@nextrush/class` | `3.0.0` | Stable [x] | Response decorators. |
| `UseGuard`, `UseInterceptor`, `Catch`, `UseFilter` | `@nextrush/class` | `3.0.0` | Stable [x] | Guards, interceptors, exception filters. |
| `isOnInit`, `isOnShutdown` | `@nextrush/class` | `3.0.0` | Stable [x] | Lifecycle-hook type guards. |
| `Module`, `getModuleMetadata`, `isModule`, `registerModule` | `@nextrush/class` | `3.1.0` | Stable [x] | Module composition and registration. |
| `registerControllers` | `@nextrush/class` | `3.0.0` | Stable [x] | Registrar - discovers and wires controllers into an app. |
| `Config`, `container`, `createContainer`, `delay`, `inject`, `Injectable`, `Optional`, `Repository`, `Service` | `@nextrush/di` | `3.0.0` | Stable [x] | The DI container surface. |
| `type ClassProvider`, `ConfigOptions`, `Container`, `FactoryProvider`, `Provider`, `Scope`, `ServiceOptions`, `Token`, `ValueProvider` | `@nextrush/di` | `3.0.0` | Stable [x] | DI contracts. |
| `type BodyOptions`, `CanActivate`, `ControllerMetadata`, `ControllerOptions`, `ControllerRouteMetadata`, `CustomParamExtractor`, `ExceptionFilter`, `GuardContext`, `GuardFn`, `HeaderOptions`, `Interceptor`, `ModuleMetadata`, `ModuleOptions`, `ModuleProvider`, `ModuleProviderConfig`, `ParamMetadata`, `ParamOptions`, `ParamSource`, `QueryOptions`, `RouteOptions`, `TransformFn`, `OnInit`, `OnShutdown`, `ControllersOptions`, `ModuleRegistrationOptions` | `@nextrush/class` | `3.0.0`-`3.1.0` | Stable [x] | Class-runtime contracts. |
| `type RouteMetadata` (from `@nextrush/class`) | `@nextrush/class` | `3.0.0` | Deprecated | Superseded by `ControllerRouteMetadata`; removed in the next major. |

Loading `nextrush/class` requires `@nextrush/class`, `@nextrush/di`, and `reflect-metadata` to be
installed - see [Compatibility](#compatibility).

## Options

`createApp(options?)` re-exports `@nextrush/core`'s `ApplicationOptions` unchanged - see
[`@nextrush/core`'s Options](../core#options) for the full table. There is no configuration
specific to the meta package itself: it adds one behavior (a default router injected into
`options.router` when you don't pass one) and no new option.

## Compatibility

**Requirements**

| Requirement | Version |
| ----------- | ------- |
| NextRush | `3.x` |
| Node.js | `>=22` |
| TypeScript | `>=5.x` |

**Runtimes**

| Runtime | Supported | Notes |
| ------- | --------- | ----- |
| Node.js `>=22` | [x] | Via `@nextrush/adapter-node`; ESM-only |
| Bun / Deno / Edge | Not via this package | Import `@nextrush/core` + `@nextrush/router` + the matching `@nextrush/adapter-{bun,deno,edge}` directly - `nextrush`'s `listen`/`serve` are Node-specific |

**Dependency footprint by usage path**

| Usage path | Entry point | Install | Runtime dependencies |
| ---------- | ----------- | ------- | --------------------- |
| Functional core | `createApp`, `createRouter`, `listen` from `nextrush` | `pnpm add nextrush` | `@nextrush/core`, `@nextrush/router`, `@nextrush/adapter-node`, `@nextrush/errors`, `@nextrush/types` (all hard `dependencies`) |
| Class-based / DI | `nextrush/class` | `pnpm add nextrush @nextrush/class` | Adds `@nextrush/class`, `@nextrush/di` (wraps `tsyringe@^4.10.0`), `reflect-metadata@^0.2.2` |

`@nextrush/class`, `@nextrush/di`, and `reflect-metadata` are declared as **optional
`peerDependencies`** in `package.json` (`peerDependenciesMeta.<name>.optional: true`) - a
functional-only `pnpm add nextrush` never resolves any of the three onto disk. If you import
`nextrush/class` without installing the peers, the import throws an actionable error naming the
exact install command instead of an opaque module-resolution failure.

`@nextrush/stream` and `@nextrush/runtime` ship transitively through `@nextrush/adapter-node`'s
own dependencies - they are present once `nextrush` is installed, but are not re-exported from
`nextrush` directly. Add either as a direct dependency of your own project only if you import its
API yourself rather than through the adapter.

**Integration**
- **Peer dependencies:** `@nextrush/class`, `@nextrush/di`, `reflect-metadata` - all optional, needed only for `nextrush/class`.
- **Works with:** every `@nextrush/*` middleware and extension package (installed separately - see the [package catalog](https://0xtanzim.github.io/nextRush/docs/resources/package-catalog)).
- **Incompatible with:** none.

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** - no CommonJS build. On Node `>=22`, CommonJS consumers
> can `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong><code>Cannot find module '@nextrush/class'</code> when importing <code>nextrush/class</code></strong></summary>

**Cause:** `@nextrush/class`, `@nextrush/di`, and `reflect-metadata` are optional peer
dependencies - a plain `pnpm add nextrush` never installs them. **Fix:** install the peer
explicitly:

```bash
pnpm add @nextrush/class reflect-metadata
```

</details>

<details>
<summary><strong>Decorators throw or metadata is missing at runtime</strong></summary>

**Cause:** `experimentalDecorators` and/or `emitDecoratorMetadata` are not enabled in
`tsconfig.json`. **Fix:** enable both - `create-nextrush` does this automatically for
class-based/full templates:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

</details>

<details>
<summary><strong><code>app.get(...)</code> throws <code>No router configured</code></strong></summary>

**Cause:** you're calling `@nextrush/core`'s own `createApp()` (router-agnostic by design)
instead of `nextrush`'s. **Fix:** import `createApp` from `nextrush`, which injects a router:

```ts
import { createApp } from 'nextrush'; // injects a router; app.get works
```

</details>

## FAQ

**Can I skip the meta package and use `@nextrush/core` / `@nextrush/router` / `@nextrush/adapter-node` directly?**
Yes - see [Direct package usage](#direct-package-usage) below. `nextrush` only adds the pre-wired router and the convenience barrel; nothing it re-exports is otherwise inaccessible.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
Not through `nextrush` itself - its `listen`/`serve` come from `@nextrush/adapter-node`. For other runtimes, import `@nextrush/core` + `@nextrush/router` + the matching `@nextrush/adapter-{bun,deno,edge}` directly; the functional API is otherwise identical, and parity across adapters is enforced by the conformance suite.

**Why are `@nextrush/class` and `@nextrush/di` peer dependencies instead of regular dependencies?**
So a functional-only install never downloads or resolves the class/DI stack (and its `tsyringe`/`reflect-metadata` supply-chain surface) - see [ADR-0009](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0009-framework-composition-and-functional-install-boundary.md).

---

## Direct Package Usage

For maximum control, skip the meta package's convenience wrapping:

```ts
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { listen } from '@nextrush/adapter-node';
import { cors } from '@nextrush/cors';
```

`@nextrush/core`'s `createApp` does not inject a router - pass one explicitly
(`createApp({ router: createRouter() })`) if you take this path.

## Package relationships

```text
                 depends on            @nextrush/core, @nextrush/router, @nextrush/adapter-node
nextrush -------------------------->   @nextrush/errors, @nextrush/types
                 optional peer          @nextrush/class, @nextrush/di, reflect-metadata
                 usually used next      @nextrush/cors, @nextrush/body-parser, any middleware/extension
```

- **Depends on:** [`@nextrush/core`](../core), [`@nextrush/router`](../router), [`@nextrush/adapter-node`](../adapters/node), [`@nextrush/errors`](../errors), [`@nextrush/types`](../types) - hard dependencies, resolved on every install.
- **Optional peer:** [`@nextrush/class`](../class), [`@nextrush/di`](../di), `reflect-metadata` - resolved only if you install them, for `nextrush/class`.
- **Often used with:** [`create-nextrush`](https://github.com/0xTanzim/nextRush/tree/main/packages/create-nextrush) - scaffolds a project that already depends on `nextrush` correctly configured.
- **Usually used next:** any middleware package (`@nextrush/cors`, `@nextrush/body-parser`, `@nextrush/helmet`, ...) - see the [package catalog](https://0xtanzim.github.io/nextRush/docs/resources/package-catalog).
- **Alternative:** [`@nextrush/core`](../core) directly, if you're building your own meta-package or adapter and don't want the pre-wired router.

## Architecture

Maintaining or contributing to this package? The internal design - the exports-map routing
between the root entry and the `nextrush/class` subpath, the dynamic-import/re-export-by-
assignment mechanism that turns a missing optional peer into an actionable error, the single-DI-
instance guarantee, and the decisions and trade-offs behind them (with diagrams) - is in
**[`ARCHITECTURE.md`](./ARCHITECTURE.md)**. Design history:
[RFC-020 - framework composition integrity](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC/framework-composition/020-framework-composition-integrity.md),
[ADR-0009](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0009-framework-composition-and-functional-install-boundary.md).

## Resources

- **Learn** - [Documentation](https://0xtanzim.github.io/nextRush/docs) | [Getting started](https://0xtanzim.github.io/nextRush/docs/getting-started) | [Architecture](./ARCHITECTURE.md) | [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- **Changelog** - [CHANGELOG.md](./CHANGELOG.md)
- **Migration** - [Framework composition migration guide](https://github.com/0xTanzim/nextRush/blob/main/docs/guides/migration-framework-composition.md)
- **Examples** - [create-nextrush templates](https://github.com/0xTanzim/nextRush/tree/main/packages/create-nextrush)
- **Report an issue** - [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- **Contribute** - [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)

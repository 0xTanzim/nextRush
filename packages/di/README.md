# @nextrush/di

> A lightweight dependency-injection container for NextRush — decorator-driven constructor injection over `tsyringe`, with singleton / transient / request scopes and errors that tell you how to fix them.

[![npm version](https://img.shields.io/npm/v/@nextrush/di.svg)](https://www.npmjs.com/package/@nextrush/di)
[![downloads](https://img.shields.io/npm/dm/@nextrush/di.svg)](https://www.npmjs.com/package/@nextrush/di)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/di.svg)](https://bundlephobia.com/package/@nextrush/di)
[![types](https://img.shields.io/npm/types/@nextrush/di.svg)](https://www.npmjs.com/package/@nextrush/di)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/di.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Decorator-driven dependency injection for NextRush — mark a class `@Service()`, declare dependencies in its constructor, and `container.resolve()` wires the graph |
| **Package type** | Core |
| **Status** | Stable ✅ |
| **Included in `nextrush`?** | Partially — `Service`, `Repository`, `container`, `createContainer`, `inject`, and the `Container` type are re-exported through [`nextrush/class`](../class). Install `@nextrush/di` directly to use `@Config`, `@Injectable`, `@Optional`, `delay`, the DI error classes, or the metadata readers. |
| **Support tier** | Public — core (stable, semver-guarded) — see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Universal — Node · Bun · Deno · Edge |
| **Requires** | Node `>=22` · ESM-only · TypeScript `>=5.x` |
| **Introduced** | `v3.0.0` |

## Highlights

- 🧩 **Decorator-driven** — `@Service()` / `@Repository()` + constructor parameters; no manual wiring for the common case
- 🔁 **Three scopes** — `singleton` (default), `transient`, and `request` (per-request child container)
- 🧭 **Actionable errors** — circular dependencies and unregistered tokens throw messages that name the cycle and list fixes
- 📦 **Peer-depends on `tsyringe` + `reflect-metadata`** — this is the one core package with runtime dependencies (a sanctioned exception; the container wraps `tsyringe`)
- ✅ **ESM-only**, side-effect-free, **fully typed** — strict TypeScript, zero `any`

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) · [When to use](#when-to-use) · [Installation](#installation) · [Quick start](#quick-start) · [Capabilities](#capabilities) · [Mental model](#mental-model) · [Common tasks](#common-tasks) · [API overview](#api-overview) · [Options](#options) · [Compatibility](#compatibility) · [Troubleshooting](#troubleshooting) · [FAQ](#faq) · [Package relationships](#package-relationships) · [Architecture](#architecture) · [Resources](#resources)

</details>

---

## The problem

Wiring dependencies by hand starts simple and rots fast. A service needs a repository, which needs a database client, which needs config — and every construction site has to know the whole chain and build it in the right order. Swapping an implementation (a real repository for a fake in a test) means threading the change through every caller.

```ts
// TODAY, without a container — every call site rebuilds the whole graph by hand,
// in the right order, and a swapped implementation ripples everywhere:
const config = new DatabaseConfig();
const db = new DatabaseClient(config);
const userRepo = new UserRepository(db);
const userService = new UserService(userRepo);
// …and the next module that needs UserService does all of this again.
```

As the graph grows, ordering bugs and duplicated construction multiply, and a single shared instance (a connection pool) can be built twice by accident. `@nextrush/di` inverts this: a class declares *what it needs* in its constructor and *how it should be shared* with a decorator, and the container resolves the graph once, in order, memoizing singletons.

## When to use

`@nextrush/di` is the DI container behind NextRush's class-based runtime. If you use `@Controller` / `@Service` through [`nextrush/class`](../class), you are already using it. Reach for it **directly** when you want the container on its own, or the parts `nextrush/class` does not re-export.

**Use `@nextrush/di` if:**

- ✓ You want constructor injection with decorators (`@Service`, `@Repository`) and automatic dependency resolution
- ✓ You need lifecycle control — one shared instance (`singleton`), a fresh one each resolve (`transient`), or one per request (`request`)
- ✓ You want circular-dependency and missing-dependency errors that explain how to fix them
- ✓ You need the pieces beyond the `nextrush/class` re-export: `@Config`, `@Injectable`, `@Optional`, `delay()`, or the DI error classes

**Reach for something else if:**

- ✗ You only need controllers, guards, and request scope wired for you → use [`nextrush/class`](../class), which re-exports the common surface and drives the container for you
- ✗ You have a two-object graph you construct once — a container is more machinery than a `new` call needs

---

## Installation

```bash
pnpm add @nextrush/di
# npm i @nextrush/di · yarn add @nextrush/di · bun add @nextrush/di
```

> [!NOTE]
> Already using `nextrush`? `Service`, `Repository`, `container`, `createContainer`, and `inject`
> are re-exported from [`nextrush/class`](../class) — `import { Service, container } from 'nextrush/class'`
> works without installing this directly. Install `@nextrush/di` when you need `@Config`,
> `@Injectable`, `@Optional`, `delay`, the DI error classes, or the metadata readers.

> [!IMPORTANT]
> Decorators need `reflect-metadata` loaded once before any decorated class is defined, and your
> `tsconfig.json` needs `"experimentalDecorators": true` and `"emitDecoratorMetadata": true`.
> Importing `@nextrush/di` (or `nextrush/class`) loads `reflect-metadata` for you.

## Quick start

```ts
import { Service, Repository, container } from '@nextrush/di';

@Repository()
class UserRepository {
  findAll() {
    return [{ id: 1, name: 'Ada' }];
  }
}

@Service()
class UserService {
  constructor(private readonly repo: UserRepository) {}

  getUsers() {
    return this.repo.findAll();
  }
}

// Resolve the whole graph — UserRepository is constructed and injected automatically.
const users = container.resolve(UserService);
console.log(users.getUsers()); // [{ id: 1, name: 'Ada' }]
```

You never construct `UserRepository` yourself. `@Service()` marks `UserService` as resolvable, the constructor declares what it needs, and `container.resolve()` builds the graph in dependency order — memoizing each singleton so the second resolve returns the same instances.

## Capabilities

**Injection**
- **Constructor injection** — declare dependencies as constructor parameters; the container resolves them by type
- **`@inject(token)`** — inject by string/symbol token or interface when the type can't be inferred at runtime
- **`@Optional()`** — an unresolved optional dependency is injected as `undefined` instead of throwing
- **`delay(() => Class)`** — lazily resolve a dependency to break a circular reference

**Scopes** (the canonical reference — see [Mental model](#mental-model))
- **`singleton`** (default) — one shared instance for the process lifetime
- **`transient`** — a fresh instance on every resolve
- **`request`** — one instance per request, shared within it, via a per-request child container

**Providers**
- **`useClass`** — construct a class (honoring its declared scope)
- **`useValue`** — register a constant (config object, pre-built client)
- **`useFactory`** — build lazily, optionally injecting other tokens; async factories are awaited by `bootstrap()`

**Safety & developer experience**
- **Circular-dependency detection** — an O(1) resolution-stack guard throws a `CircularDependencyError` that names the cycle *before* the call stack overflows
- **Actionable errors** — `DependencyResolutionError` lists concrete fixes; `InvalidProviderError` shows the valid provider shapes
- **Fully typed** — strict TypeScript, zero `any`; the container contract is shared through `@nextrush/types`

## Mental model

A class declares **what it needs** (constructor parameters) and **how it should be shared** (its scope). The container owns the *when* and *how many* — it resolves the graph in order and memoizes according to scope.

```text
@Service() / @Repository()  --->  container.register(token, { useClass }, { scope })
class + constructor deps                    |   singleton | transient | request
                                            v
container.resolve(token)     --->  tsyringe constructs, injecting resolved deps
        |
        +-- cycle detected?  --->  CircularDependencyError (names the cycle, before the stack blows)
        +-- token missing?   --->  DependencyResolutionError (lists the fixes)
```

**Rule:** the class's declared scope — not the call site — decides singleton vs transient; an explicit `register(..., { scope })` only overrides it deliberately.

> [!TIP]
> The resolution sequence, the request-scoped child container, and the instance lifecycle per
> scope (with Mermaid diagrams) are in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Mark a service and inject it

```ts
import { Service } from '@nextrush/di';

@Service() // singleton by default — one shared instance
class Logger {
  info(msg: string) { console.log(msg); }
}

@Service()
class OrderService {
  constructor(private readonly logger: Logger) {} // injected automatically
}
```

### Choose a scope

```ts
import { Service } from '@nextrush/di';

@Service()                        // singleton — one shared instance
class ConfigService {}

@Service({ scope: 'transient' })  // a fresh instance on every resolve
class Formatter {}

@Service({ scope: 'request' })    // one instance per request, shared within it
class RequestId {
  readonly id = crypto.randomUUID();
}
```

`request` scope only takes effect when the service is resolved from a per-request child container — the class-based runtime does this for you (see [`nextrush/class`](../class)); to do it manually, `container.createChild()` per request and resolve from the child.

### Inject by token, or make a dependency optional

```ts
import { Service, inject, Optional } from '@nextrush/di';

@Service()
class NotificationService {
  constructor(
    @inject('MAILER') private readonly mailer: Mailer,          // by string token
    @Optional() @inject('SMS') private readonly sms?: SmsClient, // undefined if unregistered
  ) {}
}
```

### Register a value or a factory manually

```ts
import { container } from '@nextrush/di';

container.register('CONFIG', { useValue: { port: 8080 } });
container.register('CLOCK', { useFactory: () => new Date() });

// Factory with injected dependencies + an async factory awaited by bootstrap()
container.register('DB', {
  useFactory: (url: string) => connect(url),
  inject: ['DATABASE_URL'],
});
await container.bootstrap(); // resolves and caches async factory results
```

### Isolate a container for tests

```ts
import { createContainer } from '@nextrush/di';

const testContainer = createContainer(); // fresh, isolated child container
testContainer.register(UserRepository, { useClass: FakeUserRepository });
const service = testContainer.resolve(UserService); // uses the fake
```

## API overview

The sealed public surface (ADR-0005), grouped by role.

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `container` | `Container` | `3.0.0` | Stable ✅ | The default DI container instance. |
| `createContainer` | `() => Container` | `3.0.0` | Stable ✅ | Create a fresh, isolated container (testing / scoping). |
| `Service` | `(options?: ServiceOptions) => ClassDecorator` | `3.0.0` | Stable ✅ | Mark a class injectable (singleton by default). |
| `Repository` | `(options?: ServiceOptions) => ClassDecorator` | `3.0.0` | Stable ✅ | Same as `Service`, semantically a data-access class. |
| `Config` | `(options?: ConfigOptions) => ClassDecorator` | `3.0.0` | Stable ✅ | Mark a configuration holder — always a singleton. |
| `Injectable` | `() => ClassDecorator` | `3.0.0` | Stable ✅ | Make a class resolvable without service metadata (transient). |
| `inject` | `(token: unknown) => ParameterDecorator` | `3.0.0` | Stable ✅ | Inject a dependency by class/string/symbol token. |
| `Optional` | `() => ParameterDecorator` | `3.0.0` | Stable ✅ | Inject `undefined` for an unresolved dependency instead of throwing. |
| `delay` | `(factory: () => Constructor) => unknown` | `3.0.0` | Stable ✅ | Lazily resolve a token to break a circular dependency. |
| `markInjectable` | `(target: Constructor) => void` | `3.0.0` | Stable ✅ | Make a class resolvable without service metadata (used by `@Controller`). |
| `hasServiceMetadata` · `getServiceType` · `getServiceScope` · `getConfigPrefix` | `(target) => …` | `3.0.0` | Stable ✅ | Metadata readers for discovery / diagnostics. |
| `getOptionalParams` · `isParameterOptional` | `(target[, index]) => …` | `3.0.0` | Stable ✅ | Read `@Optional()` parameter markers. |
| `DIError` · `DependencyResolutionError` · `CircularDependencyError` · `InvalidProviderError` | `class` | `3.0.0` | Stable ✅ | The DI error hierarchy. |
| `METADATA_KEYS` | `Readonly<Record<string, string>>` | `3.0.0` | Stable ✅ | The metadata key constants decorators write under. |
| `type Container` · `Scope` · `Token` · `Provider` · `ClassProvider` · `FactoryProvider` · `ValueProvider` · `RegisterOptions` · `ServiceOptions` · `ConfigOptions` · `Constructor` | — | `3.0.0` | Stable ✅ | Public contracts (re-exported from `@nextrush/types`). |

The `Container` interface exposes: `register`, `resolve`, `resolveAsync`, `bootstrap`, `resolveAll`, `isRegistered`, `clearInstances`, `reset`, and `createChild`.

## Options

`@nextrush/di` is decorator- and API-driven; the configurable inputs are the decorator/registration option bags.

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------ | ----------- |
| `ServiceOptions.scope` | `'singleton' \| 'transient' \| 'request'` | No | `'singleton'` | — | Lifecycle for `@Service()` / `@Repository()`. |
| `RegisterOptions.scope` | `'singleton' \| 'transient' \| 'request'` | No | class's declared scope (else `'singleton'` for a decorated class) | — | Per-`register()` override; an explicit scope wins over the class's declared scope. |
| `ConfigOptions.prefix` | `string` | No | `undefined` | — | Environment-variable prefix recorded on a `@Config()` class (documents the `PREFIX_*` vars it reads). |

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
| Node.js `>=22` | ✅ | ESM-only |
| Bun / Deno / Edge | ✅ / ✅ / ✅ | Uses only `tsyringe` + `reflect-metadata` — no `node:*` APIs — so behavior is identical across runtimes |

**Integration**
- **Peer dependencies:** `tsyringe@^4.10.0` and `reflect-metadata@^0.2.2` (runtime), plus `@nextrush/types` (contract, types erased at build).
- **Works with:** [`nextrush/class`](../class) (re-exports the common surface and drives the container per request), [`@nextrush/core`](../core) (each `Application` may own a container).
- **Incompatible with:** none.

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** — no CommonJS build. On Node `>=22`, CommonJS consumers can
> `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong><code>DependencyResolutionError</code>: a token is "not registered in the container"</strong></summary>

**Cause:** the class you're resolving depends on a token nothing registered — usually a missing `@Service()` / `@Repository()` decorator, an interface injected without `@inject('TOKEN')`, or a module imported after `resolve()` ran. **Fix:** decorate the class, inject interface/string tokens explicitly, or register it manually.

```ts
container.register(UserRepository, { useClass: UserRepository });
// or add @Repository() to the class, or @inject('IUserRepository') on the parameter
```

</details>

<details>
<summary><strong><code>CircularDependencyError</code>: "circular dependency detected"</strong></summary>

**Cause:** two (or more) classes depend on each other, so neither can be constructed first. The container detects the cycle and names it before the call stack overflows. **Fix:** break the cycle — extract shared logic into a third service, or lazily resolve one side with `delay()`.

```ts
import { inject, delay, Service } from '@nextrush/di';

@Service()
class A {
  constructor(@inject(delay(() => B)) private readonly b: B) {}
}
```

</details>

<details>
<summary><strong>Decorators throw <code>Reflect.getMetadata is not a function</code> or types don't inject</strong></summary>

**Cause:** `reflect-metadata` wasn't loaded, or `emitDecoratorMetadata` is off, so no constructor type information exists. **Fix:** ensure `reflect-metadata` is imported once at your entry point (importing `@nextrush/di` / `nextrush/class` does this), and enable `experimentalDecorators` + `emitDecoratorMetadata` in `tsconfig.json`.

</details>

<details>
<summary><strong>A <code>request</code>-scoped service behaves like a singleton</strong></summary>

**Cause:** `request` scope only yields a per-request instance when resolved from a per-request **child** container. Resolving from the root container shares one instance. **Fix:** resolve from `container.createChild()` per request — the [`nextrush/class`](../class) runtime does this automatically for request-scoped controllers and their dependencies.

</details>

## FAQ

**Can I use `@nextrush/di` without the rest of NextRush?**
Yes. The container, decorators, and errors are standalone — they depend on `tsyringe`, `reflect-metadata`, and the types-only `@nextrush/types`. Nothing ties them to the HTTP layer.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun, Deno, and Edge?**
Yes. The package uses only `tsyringe` and `reflect-metadata` (no `node:*` APIs), so resolution behaves identically across every supported runtime.

**How is `request` scope different from `transient`?**
`transient` builds a fresh instance on *every* resolve; `request` builds one instance per request and shares it across every collaborator resolved within that request's child container. Two services that both depend on a `request`-scoped value receive the *same* value within one request.

---

## Package relationships

```text
                depends on         @nextrush/types  (Container / Scope / Provider contract, types only)
@nextrush/di ---------------->     tsyringe · reflect-metadata  (runtime — the container wraps tsyringe)
                re-exported by     @nextrush/class  (Service, Repository, container, createContainer, inject)
                used by            @nextrush/class  (resolves controllers, guards, interceptors, filters)
```

- **Depends on:** [`@nextrush/types`](../types) — the shared `Container` / `Scope` / `Provider` / `Token` contracts (types, erased at build) · `tsyringe` + `reflect-metadata` (runtime).
- **Re-exported by:** [`nextrush/class`](../class) — `Service`, `Repository`, `container`, `createContainer`, `inject`, and the `Container` type reach users through the class runtime.
- **Used by:** [`@nextrush/class`](../class) — resolves controllers, guards, interceptors, and exception filters from the container, and drives request scope.
- **Alternative:** none within NextRush — this is the framework's DI container.

## Architecture

Maintaining or contributing to this package? The internal design — how the container wraps `tsyringe`,
the scope-to-lifecycle mapping, the per-request child container behind `request` scope, circular- and
missing-dependency detection, the architectural invariants, and the decisions and trade-offs behind
them (with diagrams) — is in **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**. Design history:
[ADR-0005 (package tiers & sealed surface)](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md).

## Resources

- 📖 **Learn** — [Documentation](https://0xtanzim.github.io/nextRush/docs) · [Architecture](./ARCHITECTURE.md) · [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- 📝 **Changelog** — [CHANGELOG.md](./CHANGELOG.md)
- 🐛 **Report an issue** — [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- 🤝 **Contribute** — [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT © [Tanzim Hossain](https://github.com/0xTanzim)

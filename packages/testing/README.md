# @nextrush/testing

> Isolated, type-safe test modules for NextRush controllers and services -- DI overrides plus in-memory request routing, no HTTP server required.

[![npm version](https://img.shields.io/npm/v/@nextrush/testing.svg)](https://www.npmjs.com/package/@nextrush/testing)
[![downloads](https://img.shields.io/npm/dm/@nextrush/testing.svg)](https://www.npmjs.com/package/@nextrush/testing)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/testing.svg)](https://bundlephobia.com/package/@nextrush/testing)
[![types](https://img.shields.io/npm/types/@nextrush/testing.svg)](https://www.npmjs.com/package/@nextrush/testing)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/testing.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Compile an isolated DI container + router from `@Controller`/`@Service` classes, drive requests against it, and override any provider with a fake |
| **Package type** | Tooling |
| **Status** | Stable |
| **Included in `nextrush`?** | No -- standalone install (dev dependency) |
| **Support tier** | Public -- stable (sealed public API) -- see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Node.js (test runner) -- exercises the same `@nextrush/core`/`@nextrush/class` code path apps run on any adapter |
| **Requires** | Node `>=22` * ESM-only * TypeScript `>=5.x` |
| **Introduced** | v1.0.0 |

## Highlights

- Peer-depends on `@nextrush/core`, `@nextrush/router`, `@nextrush/di`, `@nextrush/class`, `@nextrush/types`, and `reflect-metadata` -- not zero-dependency
- ESM-only, fully typed, zero `any`
- Each `.compile()` call produces a brand-new container and router -- no shared singletons across tests

## The problem

Testing a `@Controller` class the honest way means either booting a real HTTP server per test (slow, port conflicts, teardown bugs) or hand-rolling a fake `Context` and manually resolving the DI graph -- a construction that drifts from how `registerControllers` actually wires things in production the moment either one changes. Neither approach gives a clean way to swap one `@Service` for a fake without also faking everything around it.

```ts
// TODAY, without this package -- the manual construction that drifts from production wiring:
const container = createContainer();
container.register(UserService, { useClass: UserService });
const router = new Router();
const app = new Application({ router, container });
await registerControllers(app, { source: new MemorySource([UserController]), container });
// ...then hand-build a fake Context object to invoke the matched route handler.
```

## When to use

**Use `@nextrush/testing` if:**

- You are unit- or integration-testing `@Controller`/`@Service` classes from `@nextrush/class`
- You need to override a real provider with a fake value, class, or factory for one test
- You want request/response behavior verified without opening a real socket

**Reach for something else if:**

- You are testing plain functional routes (`createRouter`, no DI) -- drive them directly with the router's `match()` result, this package's `TestModuleRef.request()` is class-runtime-specific
- You need a real end-to-end HTTP test (headers, keep-alive, actual sockets) -- start the app with `listen()` from `@nextrush/adapter-node` and use an HTTP client instead

---

## Installation

```bash
pnpm add --save-dev @nextrush/testing
# npm i -D @nextrush/testing * yarn add -D @nextrush/testing * bun add -d @nextrush/testing
```

> [!NOTE]
> Not included in the `nextrush` meta package. It is a dev-only dependency -- install it directly in the project whose controllers/services you are testing.

## Quick start

```ts
import { createTestModule } from '@nextrush/testing';
import { Controller, Get, Service } from '@nextrush/class';

@Service()
class UserService {
  getUser(id: string) {
    return { id, name: 'Alice' };
  }
}

@Controller('/users')
class UserController {
  constructor(private users: UserService) {}

  @Get('/:id')
  getUser() {
    return this.users.getUser('123');
  }
}

const ref = await createTestModule({
  controllers: [UserController],
  providers: [UserService],
}).compile();

const response = await ref.request('GET', '/users/123');
// response.status === 200
// response.body   === { id: '123', name: 'Alice' }

await ref.close();
```

`compile()` builds a fresh DI container and router, registers the given controllers/providers through the same `registerControllers` path a real app uses, and hands back a `TestModuleRef` you can drive requests against.

## Capabilities

**Capabilities**
- **Isolated compile** -- every `.compile()` call gets its own container and router; no state leaks between test modules
- **Provider overrides** -- `.override(token).useValue(...)` / `.useClass(...)` / `.useFactory(fn, inject?)`, chainable for multiple tokens
- **In-memory request driving** -- `.request(method, path, body?)` matches the route, builds a capturing `Context`, and returns `{ status, body }` without opening a socket
- **Direct resolution** -- `.get<T>(token)` resolves straight from the isolated container for unit-style assertions

**Developer experience**
- Fully typed -- `get<T>()`, `override()`'s three branches, and `TestModuleConfig` are all generic-safe, no `any` in the public surface

## Mental model

```text
createTestModule(config) --> .override(token).useX(...) [optional, repeatable] --> .compile()
                                                                                          |
                                                                                          v
                                                                               TestModuleRef
                                                                          (isolated container + router)
                                                                           .get() / .request() / .close()
```

**Rule:** nothing touches a real container, router, or provider until `.compile()` runs -- everything before it is configuration only.

> [!TIP]
> The full compile/override/resolve sequence (Mermaid) is in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Override one provider with a fake value

```ts
const ref = await createTestModule({
  controllers: [UserController],
  providers: [UserService],
})
  .override(UserService)
  .useValue({ getUser: (id: string) => ({ id, name: 'Fake User' }) })
  .compile();
// UserController's injected UserService is now the fake object.
```

### Override multiple providers in one chain

```ts
const ref = await createTestModule({
  providers: [Service1, Service2, Service3],
})
  .override(Service1)
  .useValue(fakeService1)
  .override(Service2)
  .useClass(AlternateService2)
  .override(Service3)
  .useFactory(() => new Service3({ debug: true }))
  .compile();
```

### Resolve a service directly, without going through a route

```ts
const ref = await createTestModule({ providers: [UserService] }).compile();
const userService = ref.get<UserService>(UserService);
userService.getUser('1');
```

### Confirm two compiled modules do not share singletons

```ts
const ref1 = await createTestModule({ providers: [UserService] }).compile();
const ref2 = await createTestModule({ providers: [UserService] }).compile();
ref1.get<UserService>(UserService) !== ref2.get<UserService>(UserService); // true
```

## API overview

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `createTestModule` | `(config?: TestModuleConfig) => TestModuleBuilder` | 1.0.0 | Stable | Entry point -- returns a builder, nothing is compiled yet |
| `TestModuleBuilder` | class | 1.0.0 | Stable | `.override(token)` and `.compile()` |
| `TestModuleRef` | class | 1.0.0 | Stable | `.get()`, `.request()`, `.close()` |
| `type TestModuleConfig` | `{ controllers?: Function[]; providers?: ModuleProvider[] }` | 1.0.0 | Stable | Input to `createTestModule` |

**`TestModuleBuilder` methods:**

| Method | Signature | Description |
| ------ | --------- | ----------- |
| `.override(token)` | `(token: Token) => { useValue, useClass, useFactory }` | Returns an object with three terminal methods, each of which records the override and returns `this` (the same `TestModuleBuilder`, chainable) |
| `.compile()` | `() => Promise<TestModuleRef>` | Builds the container, applies providers then overrides (overrides win), registers controllers via `registerControllers`, returns the ref |

**`.override(token)`'s three terminal methods** (each returns `TestModuleBuilder`, so chaining continues):

| Method | Signature |
| ------ | --------- |
| `.useValue(value)` | `(value: unknown) => TestModuleBuilder` |
| `.useClass(cls)` | `(cls: Constructor) => TestModuleBuilder` |
| `.useFactory(fn, inject?)` | `(fn: (...args: unknown[]) => unknown, inject?: Token[]) => TestModuleBuilder` |

**`TestModuleRef` methods:**

| Method | Signature | Description |
| ------ | --------- | ----------- |
| `.get<T>(token)` | `(token: Token<T>) => T` | Resolves from the isolated container |
| `.request(method, path, body?)` | `(method: string, path: string, body?: unknown) => Promise<{ status: number; body: unknown }>` | Matches the route via the compiled router and invokes its handler with a capturing `Context`; throws `Error` if no route matches |
| `.close()` | `() => Promise<void>` | Calls `app.close()`, which runs registered `OnShutdown` hooks |

## Options

`TestModuleConfig` (passed to `createTestModule`) -- no separate options object.

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------- | ----------- |
| `controllers` | `Function[]` | No | `[]` | -- | `@Controller` classes registered through `MemorySource` |
| `providers` | `ModuleProvider[]` | No | `[]` | -- | Bare classes or `{ provide, useClass \| useValue \| useFactory, inject?, scope? }` configs, same shape `@Module` accepts |

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
| Node.js `>=22` | Yes | Test runner only -- `TestModuleRef.request()` never opens a socket, so the runtime running the test suite (Vitest, on Node) is the only runtime involved |
| Bun / Deno / Edge | Not applicable | This package is a test harness, not an app runtime target; test the code your app runs on those runtimes through the normal cross-adapter conformance suite instead |

**Integration**
- **Peer dependencies:** `@nextrush/core`, `@nextrush/router`, `@nextrush/di`, `@nextrush/class`, `@nextrush/types`, `reflect-metadata`
- **Works with:** any test runner that can `await` a Promise (Vitest, in this repo's own test suite)
- **Incompatible with:** none

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** -- no CommonJS build. On Node `>=22`, CJS consumers can `require()` this ESM package natively. See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong>Error: No route matched: GET /some/path</strong></summary>

**Cause:** `.request()` calls the compiled router's `match()` directly; if the controller wasn't included in `controllers`, or the path/method doesn't match a registered `@Get`/`@Post`/etc. route, there is nothing to invoke. **Fix:** confirm the controller class is listed in `createTestModule({ controllers: [...] })` and that the path matches the decorator's route exactly (including the controller's base path).

```ts
createTestModule({ controllers: [UserController] }); // must include every controller under test
```

</details>

<details>
<summary><strong>get(Token) throws instead of returning the fake I set with .override()</strong></summary>

**Cause:** `.override(token)` records the override by the exact token object/class passed in; `.compile()` applies providers first, then overrides on top, so an override always wins over a real provider -- but only if the token matches. **Fix:** pass the same class reference used in `providers`, not a re-declared class with the same name.

```ts
createTestModule({ providers: [UserService] })
  .override(UserService) // same reference as above
  .useValue(fake);
```

</details>

## FAQ

**Can I use this without `nextrush`?**
Yes -- it depends directly on `@nextrush/core`, `@nextrush/router`, `@nextrush/di`, and `@nextrush/class`, not the `nextrush` meta package.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
The harness itself runs wherever your test runner runs (Node, via Vitest in this repo). It exercises `@nextrush/core` and `@nextrush/class` directly rather than through a runtime adapter, so it does not by itself prove Bun/Deno/Edge parity -- that is the conformance suite's job.

**Do request-scoped services get a fresh instance per `.request()` call?**
Yes -- a `@Service({ scope: 'request' })` provider resolves to a new instance on every `.request()` call, the same request-scope contract `registerControllers` provides in a real app.

---

## Package relationships

```text
                 depends on            @nextrush/core, @nextrush/router, @nextrush/di, @nextrush/class
@nextrush/testing -------------->
                 often used with       @nextrush/di (for CanActivate guards under test)
                 usually used next     a test runner (Vitest) invoking createTestModule() in a *.test.ts file
```

- **Depends on:** [`@nextrush/core`](../core), [`@nextrush/router`](../router), [`@nextrush/di`](../di), [`@nextrush/class`](../class) -- compiles the same `Application`/`Router`/container/`registerControllers` pipeline a real app runs
- **Often used with:** [`@nextrush/di`](../di) -- guards and interceptors under test typically implement `CanActivate` from this package
- **Usually used next:** nothing in the framework itself -- the compiled `TestModuleRef` is asserted against directly in your test file
- **Alternative:** none in this framework; starting a real app with `@nextrush/adapter-node`'s `listen()` and hitting it with an HTTP client is the alternative for true end-to-end tests

## Architecture

Maintaining or contributing to this package? The internal design -- module layout, the compile/override/resolve sequence, invariants -- is in **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**.

## Resources

- **Learn** -- [Documentation](https://0xtanzim.github.io/nextRush/docs) * [Architecture](./ARCHITECTURE.md)
- **Changelog** -- [CHANGELOG.md](./CHANGELOG.md)
- **Report an issue** -- [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- **Contribute** -- [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)

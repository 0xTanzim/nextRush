# nextrush

## 4.0.0

### Major Changes

- d7eb075: Extension Model — replace the plugin system with Composition-First (RFC-NEXTRUSH-PLUGIN-SYSTEM).

  **Breaking changes**
  - **Removed the plugin system.** `Plugin`, `PluginWithHooks`, `PluginMeta`, `PluginFactory`, `ApplicationLike`, `app.plugin()`, `app.pluginAsync()`, `app.getPlugin()`, `app.hasPlugin()`, and the deprecated `app.onError()` setter are gone.
  - **New `Extension` contract** (`@nextrush/types`): `{ name, needs?, setup(ctx), destroy? }`, registered via `app.extend()` and booted at `app.ready()` (a deferred boot barrier that adapters call automatically before serving — eliminating the un-awaited-async-plugin race). Extensions decorate the app via the extension-only `ctx.decorate()`; `app.hasDecorator()` is the public read side. Error handling: use `app.setErrorHandler()`.
  - **App-owned router.** `Application` accepts `{ router }`; `app.get/post/put/patch/delete/head/all` delegate to it and it mounts last at `ready()`. `nextrush`'s `createApp()` injects a default router (batteries-included); `@nextrush/core`'s `createApp()` is bring-your-own-router. (No `app.options()` verb — it collides with the config property; use `app.all()`/CORS for OPTIONS.)
  - **Per-app DI container.** The container contract moved to `@nextrush/types` (`Container`); `@nextrush/di` re-exports it (the previous `ContainerInterface` alias has been removed — use `Container` directly). Each app owns its container (`app.container`, `createApp({ container })`), exposed to extensions via `ExtensionContext.container`.
  - **Package reclassification:** `@nextrush/events` → an Extension (`events()`); `@nextrush/openapi` → middleware (`app.use(openapi({ router }))`); `@nextrush/template` → middleware only (`templatePlugin()` removed); `@nextrush/controllers` → `registerControllers(app, options)` registrar (`ControllersPlugin`/`controllersPlugin` removed, `ControllersPluginOptions` → `ControllersOptions`). Adapter `serve()`/`listen()` are now async on Bun and Deno.

  See `docs/guides/migration-extension-model.md` for a full before/after guide.

### Minor Changes

- 32a0db6: Add the Route Metadata System — the framework-level foundation that lets any tool (OpenAPI, and later SDK/Postman/RPC generators) read a route's request/response shapes and documentation without duplication.
  - **`@nextrush/types`**: new `RouteDefinition` / `RouteMetadata` contracts and the `ROUTE_METADATA` contribution symbol. `StandardSchemaV1` moved here (from `@nextrush/validation`) as a shared contract.
  - **`@nextrush/router`**: new `endpoint()` metadata marker and `getRoutes(): readonly RouteDefinition[]` introspection. The router collects each route's metadata at registration by partitioning entries (functions run; pure markers contribute only) and merging contributions. Metadata lives in a side registry — the request hot path (`match()`, `HandlerEntry`, radix nodes) is byte-identical, and an interleaved A/B benchmark confirmed dispatch throughput is unchanged.
  - **`@nextrush/validation`**: `validate()` now contributes its request schemas via the protocol (non-enumerable internal marker — public API unchanged), so validated routes are documented for free.
  - **`@nextrush/controllers`**: class-based routes now contribute decorator documentation (`@Controller({ tags })`, `@Get/@Post({ description, deprecated })`) into their `RouteDefinition` via the same protocol, so controller routes appear fully documented in the spec alongside functional routes.
  - **`nextrush`**: re-exports `endpoint()` (and the `RouteDefinition` / `RouteMetadata` types) so it sits next to `createRouter` — `import { endpoint } from 'nextrush'`.

  Additive and backward-compatible: existing route registration and dispatch are unaffected.

### Patch Changes

- Updated dependencies [d7eb075]
- Updated dependencies [0e2b399]
- Updated dependencies [32a0db6]
  - @nextrush/types@4.0.0
  - @nextrush/core@4.0.0
  - @nextrush/adapter-node@4.0.0
  - @nextrush/di@4.0.0
  - @nextrush/controllers@4.0.0
  - @nextrush/errors@4.0.0
  - @nextrush/router@4.0.0
  - @nextrush/decorators@4.0.0

## 3.0.7

### Patch Changes

- [#26](https://github.com/0xTanzim/nextRush/pull/26) [`c9723dd`](https://github.com/0xTanzim/nextRush/commit/c9723ddb29e4bf834625f294eadb0c9e1c28432e) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Simplify template code and auto-install dev package

- Updated dependencies [[`c9723dd`](https://github.com/0xTanzim/nextRush/commit/c9723ddb29e4bf834625f294eadb0c9e1c28432e)]:
  - @nextrush/core@3.0.7
  - @nextrush/adapter-node@3.0.7
  - @nextrush/controllers@3.0.7
  - @nextrush/router@3.0.7
  - @nextrush/types@3.0.7
  - @nextrush/errors@3.0.7
  - @nextrush/di@3.0.7
  - @nextrush/decorators@3.0.7

## 3.0.6

### Patch Changes

- [#23](https://github.com/0xTanzim/nextRush/pull/23) [`9f1d44e`](https://github.com/0xTanzim/nextRush/commit/9f1d44ebc7807955a5d218c2b52a228911a06236) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Fix CLI install reliability:
  - Ensure the `nextrush` meta-package never declares a `bin` entry (prevents pnpm bin-link conflicts).
  - Ensure `@nextrush/dev` always builds before publish so `nextrush`/`nextrush-dev` binaries work.
  - Add a repo-wide bin validator to catch missing `bin` targets during verification.
  - Scaffold projects with `nextrush dev` / `nextrush build` scripts (no `npx`).
  - Include `@nextrush/dev` in scaffolded dev dependencies so fresh installs expose the local CLI.

- Updated dependencies []:
  - @nextrush/types@3.0.6
  - @nextrush/errors@3.0.6
  - @nextrush/core@3.0.6
  - @nextrush/router@3.0.6
  - @nextrush/di@3.0.6
  - @nextrush/decorators@3.0.6
  - @nextrush/controllers@3.0.6
  - @nextrush/adapter-node@3.0.6

## 3.0.5

### Patch Changes

- [#21](https://github.com/0xTanzim/nextRush/pull/21) [`1f97078`](https://github.com/0xTanzim/nextRush/commit/1f970782653a9454e3a67e7ac004cb40dd791ae5) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Stable **3.0.4**: **`@nextrush/di`** clears resolution tracking on **`container.reset()`** and runs Vitest test files sequentially (`fileParallelism: false`) so the global singleton container is not stressed by parallel test files—fixes flaky / hung circular-dependency tests in CI and locally. Unified semver and docs/wiki surfaces updated to **3.0.4**.

- Updated dependencies [[`1f97078`](https://github.com/0xTanzim/nextRush/commit/1f970782653a9454e3a67e7ac004cb40dd791ae5)]:
  - @nextrush/adapter-node@3.0.5
  - @nextrush/controllers@3.0.5
  - @nextrush/decorators@3.0.5
  - @nextrush/dev@3.0.5
  - @nextrush/di@3.0.5
  - @nextrush/errors@3.0.5
  - @nextrush/router@3.0.5
  - @nextrush/types@3.0.5
  - @nextrush/core@3.0.5

## 3.0.4

### Patch Changes

- Stable **3.0.4**: **`@nextrush/di`** clears resolution tracking on **`container.reset()`** and runs Vitest test files sequentially (`fileParallelism: false`) so the global singleton container is not stressed by parallel test files—fixes flaky / hung circular-dependency tests in CI and locally. Unified semver and docs/wiki surfaces updated to **3.0.4**.

- Updated dependencies []:
  - @nextrush/adapter-node@3.0.4
  - @nextrush/controllers@3.0.4
  - @nextrush/decorators@3.0.4
  - @nextrush/dev@3.0.4
  - @nextrush/di@3.0.4
  - @nextrush/errors@3.0.4
  - @nextrush/router@3.0.4
  - @nextrush/types@3.0.4
  - @nextrush/core@3.0.4

## 3.0.3

### Patch Changes

- Patch **3.0.3**: **`nextrush`** ships the **`nextrush`** CLI via **`@nextrush/dev`**; **`@nextrush/dev`** skips false-positive decorator `tsconfig` warnings on functional scaffolds; **`create-nextrush`** / docs / plugin metadata aligned to **3.0.3**.

- Updated dependencies []:
  - @nextrush/adapter-node@3.0.3
  - @nextrush/controllers@3.0.3
  - @nextrush/decorators@3.0.3
  - @nextrush/dev@3.0.3
  - @nextrush/di@3.0.3
  - @nextrush/errors@3.0.3
  - @nextrush/router@3.0.3
  - @nextrush/types@3.0.3
  - @nextrush/core@3.0.3

## 3.0.1

### Patch Changes

- [#15](https://github.com/0xTanzim/nextRush/pull/15) [`6c37c2f`](https://github.com/0xTanzim/nextRush/commit/6c37c2f1a60c24eda5fba50c7543627104fb776c) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Sync package metadata and documentation URLs, and ensure package-level homepage/readme publishing metadata is consistent across released packages.

- Updated dependencies []:
  - @nextrush/types@3.0.1
  - @nextrush/errors@3.0.1
  - @nextrush/core@3.0.1
  - @nextrush/router@3.0.1
  - @nextrush/di@3.0.1
  - @nextrush/decorators@3.0.1
  - @nextrush/controllers@3.0.1
  - @nextrush/adapter-node@3.0.1

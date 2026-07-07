# @nextrush/core

## 3.1.0

### Major Changes

- d7eb075: Extension Model — replace the plugin system with Composition-First (RFC-NEXTRUSH-PLUGIN-SYSTEM).

  **Breaking changes**
  - **Removed the plugin system.** `Plugin`, `PluginWithHooks`, `PluginMeta`, `PluginFactory`, `ApplicationLike`, `app.plugin()`, `app.pluginAsync()`, `app.getPlugin()`, `app.hasPlugin()`, and the deprecated `app.onError()` setter are gone.
  - **New `Extension` contract** (`@nextrush/types`): `{ name, needs?, setup(ctx), destroy? }`, registered via `app.extend()` and booted at `app.ready()` (a deferred boot barrier that adapters call automatically before serving — eliminating the un-awaited-async-plugin race). Extensions decorate the app via the extension-only `ctx.decorate()`; `app.hasDecorator()` is the public read side. Error handling: use `app.setErrorHandler()`.
  - **App-owned router.** `Application` accepts `{ router }`; `app.get/post/put/patch/delete/head/all` delegate to it and it mounts last at `ready()`. `nextrush`'s `createApp()` injects a default router (batteries-included); `@nextrush/core`'s `createApp()` is bring-your-own-router. (No `app.options()` verb — it collides with the config property; use `app.all()`/CORS for OPTIONS.)
  - **Per-app DI container.** The container contract moved to `@nextrush/types` (`Container`); `@nextrush/di` re-exports it (the previous `ContainerInterface` alias has been removed — use `Container` directly). Each app owns its container (`app.container`, `createApp({ container })`), exposed to extensions via `ExtensionContext.container`.
  - **Package reclassification:** `@nextrush/events` → an Extension (`events()`); `@nextrush/openapi` → middleware (`app.use(openapi({ router }))`); `@nextrush/template` → middleware only (`templatePlugin()` removed); `@nextrush/controllers` → `registerControllers(app, options)` registrar (`ControllersPlugin`/`controllersPlugin` removed, `ControllersPluginOptions` → `ControllersOptions`). Adapter `serve()`/`listen()` are now async on Bun and Deno.

  See `docs/guides/migration-extension-model.md` for a full before/after guide.

### Patch Changes

- Updated dependencies [d7eb075]
- Updated dependencies [0e2b399]
- Updated dependencies [32a0db6]
  - @nextrush/types@3.1.0
  - @nextrush/errors@3.1.0

## 3.0.7

### Patch Changes

- [#26](https://github.com/0xTanzim/nextRush/pull/26) [`c9723dd`](https://github.com/0xTanzim/nextRush/commit/c9723ddb29e4bf834625f294eadb0c9e1c28432e) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Simplify template code and auto-install dev package

- Updated dependencies []:
  - @nextrush/types@3.0.7
  - @nextrush/errors@3.0.7

## 3.0.6

### Patch Changes

- Updated dependencies []:
  - @nextrush/types@3.0.6
  - @nextrush/errors@3.0.6

## 3.0.5

### Patch Changes

- Updated dependencies [[`1f97078`](https://github.com/0xTanzim/nextRush/commit/1f970782653a9454e3a67e7ac004cb40dd791ae5)]:
  - @nextrush/errors@3.0.5
  - @nextrush/types@3.0.5

## 3.0.4

### Patch Changes

- Updated dependencies []:
  - @nextrush/errors@3.0.4
  - @nextrush/types@3.0.4

## 3.0.3

### Patch Changes

- Updated dependencies []:
  - @nextrush/errors@3.0.3
  - @nextrush/types@3.0.3

## 3.0.1

### Patch Changes

- Updated dependencies []:
  - @nextrush/types@3.0.1
  - @nextrush/errors@3.0.1

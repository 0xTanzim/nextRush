# create-nextrush

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

## 3.0.9

### Patch Changes

- [#31](https://github.com/0xTanzim/nextRush/pull/31) [`d599592`](https://github.com/0xTanzim/nextRush/commit/d599592e28a499d57a25f234ca455c5d960bdb40) Thanks [@0xTanzim](https://github.com/0xTanzim)! - versions retrieve issue fix

## 3.0.8

### Patch Changes

- [#29](https://github.com/0xTanzim/nextRush/pull/29) [`39d1bed`](https://github.com/0xTanzim/nextRush/commit/39d1bedb098d751c9b464a3d16bfbcc67eb378d9) Thanks [@0xTanzim](https://github.com/0xTanzim)! - version mismatch fix. The generated `package.json` should use `^3.0.0` for `nextrush` and related packages, not the exact version from `constants.js`. This allows users to get compatible updates without being locked to a specific version.

## 3.0.7

### Patch Changes

- [#26](https://github.com/0xTanzim/nextRush/pull/26) [`c9723dd`](https://github.com/0xTanzim/nextRush/commit/c9723ddb29e4bf834625f294eadb0c9e1c28432e) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Simplify template code and auto-install dev package

## 3.0.6

### Patch Changes

- [#23](https://github.com/0xTanzim/nextRush/pull/23) [`9f1d44e`](https://github.com/0xTanzim/nextRush/commit/9f1d44ebc7807955a5d218c2b52a228911a06236) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Fix CLI install reliability:
  - Ensure the `nextrush` meta-package never declares a `bin` entry (prevents pnpm bin-link conflicts).
  - Ensure `@nextrush/dev` always builds before publish so `nextrush`/`nextrush-dev` binaries work.
  - Add a repo-wide bin validator to catch missing `bin` targets during verification.
  - Scaffold projects with `nextrush dev` / `nextrush build` scripts (no `npx`).
  - Include `@nextrush/dev` in scaffolded dev dependencies so fresh installs expose the local CLI.

## 3.0.5

### Patch Changes

- [#21](https://github.com/0xTanzim/nextRush/pull/21) [`1f97078`](https://github.com/0xTanzim/nextRush/commit/1f970782653a9454e3a67e7ac004cb40dd791ae5) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Stable **3.0.4**: **`@nextrush/di`** clears resolution tracking on **`container.reset()`** and runs Vitest test files sequentially (`fileParallelism: false`) so the global singleton container is not stressed by parallel test files—fixes flaky / hung circular-dependency tests in CI and locally. Unified semver and docs/wiki surfaces updated to **3.0.4**.

## 3.0.4

### Patch Changes

- Stable **3.0.4**: **`@nextrush/di`** clears resolution tracking on **`container.reset()`** and runs Vitest test files sequentially (`fileParallelism: false`) so the global singleton container is not stressed by parallel test files—fixes flaky / hung circular-dependency tests in CI and locally. Unified semver and docs/wiki surfaces updated to **3.0.4**.

## 3.0.3

### Patch Changes

- Patch **3.0.3**: **`nextrush`** ships the **`nextrush`** CLI via **`@nextrush/dev`**; **`@nextrush/dev`** skips false-positive decorator `tsconfig` warnings on functional scaffolds; **`create-nextrush`** / docs / plugin metadata aligned to **3.0.3**.

## 3.0.1

### Patch Changes

- [#15](https://github.com/0xTanzim/nextRush/pull/15) [`6c37c2f`](https://github.com/0xTanzim/nextRush/commit/6c37c2f1a60c24eda5fba50c7543627104fb776c) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Sync package metadata and documentation URLs, and ensure package-level homepage/readme publishing metadata is consistent across released packages.
